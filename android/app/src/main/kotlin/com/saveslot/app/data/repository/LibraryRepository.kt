package com.saveslot.app.data.repository

import com.saveslot.app.data.local.CollectionDao
import com.saveslot.app.data.local.GameSerializer
import com.saveslot.app.data.local.RecentGameEntity
import com.saveslot.app.data.local.RecentGamesDao
import com.saveslot.app.data.local.toDomain
import com.saveslot.app.data.local.toEntity
import com.saveslot.app.domain.model.CollectionEntry
import com.saveslot.app.domain.model.CollectionFilter
import com.saveslot.app.domain.model.CopyFormat
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.Note
import com.saveslot.app.domain.model.NoteType
import com.saveslot.app.domain.model.NoteWithGame
import com.saveslot.app.domain.model.PlayStatus
import kotlin.time.Clock
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map

/**
 * The user's own data: collection entries, notes and recently viewed games.
 *
 * This is the only state in the app that cannot be re-fetched, so writes are immediate and reads
 * are exposed as Flows that the UI observes rather than snapshots it has to refresh.
 */
class LibraryRepository(
    private val collectionDao: CollectionDao,
    private val recentGamesDao: RecentGamesDao,
    private val serializer: GameSerializer,
    private val clock: Clock = Clock.System,
) {

    /** Collection entries with their notes attached, newest-touched first. */
    val entries: Flow<List<CollectionEntry>> =
        combine(
            collectionDao.observeEntries(),
            collectionDao.observeAllNotes(),
        ) { entities, noteEntities ->
            val notesByGame = noteEntities.groupBy { it.gameId }
            entities.mapNotNull { entity ->
                val game = serializer.decode(entity.payload) ?: return@mapNotNull null
                entity.toDomain(
                    game = game,
                    notes = notesByGame[entity.gameId].orEmpty().map { it.toDomain() },
                )
            }
        }

    /** Every note in the app, joined to its game, for the notes journal. */
    val notes: Flow<List<NoteWithGame>> = entries.map { list ->
        list.flatMap { entry -> entry.notes.map { NoteWithGame(note = it, game = entry.game) } }
            .sortedByDescending { it.note.updatedAt }
    }

    val recent: Flow<List<Game>> = recentGamesDao.observe(RECENT_LIMIT).map { rows ->
        rows.mapNotNull { serializer.decode(it.payload) }
    }

    fun entry(gameId: String): Flow<CollectionEntry?> =
        combine(
            collectionDao.observeEntry(gameId),
            collectionDao.observeNotes(gameId),
        ) { entity, noteEntities ->
            val game = entity?.payload?.let(serializer::decode) ?: return@combine null
            entity.toDomain(game = game, notes = noteEntities.map { it.toDomain() })
        }

    fun filtered(filter: CollectionFilter): Flow<List<CollectionEntry>> = entries.map { list ->
        when (filter) {
            CollectionFilter.All -> list
            CollectionFilter.Owned -> list.filter { it.owned }
            CollectionFilter.Playing -> list.filter { it.status == PlayStatus.Playing }
            CollectionFilter.Planned -> list.filter { it.status == PlayStatus.Planned }
            // "Completed" covers both a normal finish and a 100% run.
            CollectionFilter.Completed -> list.filter {
                it.status == PlayStatus.Completed || it.status == PlayStatus.CompletedFully
            }
        }
    }

    suspend fun isInCollection(gameId: String): Boolean = collectionDao.entry(gameId) != null

    suspend fun addToCollection(game: Game) {
        if (collectionDao.entry(game.id) != null) return
        val now = clock.now().toEpochMilliseconds()
        collectionDao.upsert(
            CollectionEntry(
                game = game,
                playedOn = game.activePlatform,
                addedAt = now,
                updatedAt = now,
            ).toEntity(serializer),
        )
    }

    suspend fun removeFromCollection(gameId: String) = collectionDao.delete(gameId)

    suspend fun toggleFavorite(game: Game) {
        val existing = collectionDao.entry(game.id)
        if (existing == null) {
            // Favouriting a game the user has not added yet implies adding it.
            addToCollection(game)
            collectionDao.entry(game.id)?.let { fresh ->
                collectionDao.upsert(
                    fresh.copy(favorite = true, updatedAt = clock.now().toEpochMilliseconds()),
                )
            }
            return
        }
        collectionDao.upsert(
            existing.copy(
                favorite = !existing.favorite,
                updatedAt = clock.now().toEpochMilliseconds(),
            ),
        )
    }

    /** Saves the personal fields from the detail screen's editor. */
    suspend fun saveEntryDetails(
        game: Game,
        status: PlayStatus,
        format: CopyFormat,
        playedOn: String,
        rating: Double?,
        owned: Boolean,
    ) {
        val existing = collectionDao.entry(game.id)
        val now = clock.now().toEpochMilliseconds()
        val base = existing ?: run {
            addToCollection(game)
            collectionDao.entry(game.id)
        } ?: return
        collectionDao.upsert(
            base.copy(
                payload = serializer.encode(game),
                status = status.storageKey,
                format = format.storageKey,
                playedOn = playedOn.trim(),
                // Ratings are half-point steps in 0..10; anything else is a UI or import bug.
                rating = rating?.let { (it * 2).toInt().coerceIn(0, 20) / 2.0 },
                owned = owned,
                updatedAt = now,
            ),
        )
    }

    suspend fun addNote(game: Game, type: NoteType, title: String, body: String) {
        val trimmedBody = body.trim()
        if (trimmedBody.isEmpty()) return
        // A note implies the game belongs in the collection, so the FK always has a parent row.
        if (collectionDao.entry(game.id) == null) addToCollection(game)
        val now = clock.now().toEpochMilliseconds()
        collectionDao.insertNote(
            Note(
                id = "n$now-${(0..0xFFFF).random().toString(16)}",
                gameId = game.id,
                type = type,
                title = title.trim().ifEmpty { DEFAULT_NOTE_TITLE },
                body = trimmedBody,
                createdAt = now,
                updatedAt = now,
            ).toEntity(),
        )
        touchEntry(game.id, now)
    }

    suspend fun deleteNote(noteId: String) = collectionDao.deleteNote(noteId)

    /** Records a game as recently viewed, keeping the list bounded. */
    suspend fun rememberRecent(game: Game) {
        recentGamesDao.remember(
            entry = RecentGameEntity(
                gameId = game.id,
                payload = serializer.encode(game),
                viewedAt = clock.now().toEpochMilliseconds(),
            ),
            keep = RECENT_LIMIT,
        )
    }

    /** Wipes collection, notes and history — the destructive settings action. */
    suspend fun clearPersonalData() {
        collectionDao.clearNotes()
        collectionDao.clear()
        recentGamesDao.clear()
    }

    private suspend fun touchEntry(gameId: String, timestamp: Long) {
        collectionDao.entry(gameId)?.let { collectionDao.upsert(it.copy(updatedAt = timestamp)) }
    }

    private companion object {
        const val RECENT_LIMIT = 12
        const val DEFAULT_NOTE_TITLE = "Нотатка"
    }
}
