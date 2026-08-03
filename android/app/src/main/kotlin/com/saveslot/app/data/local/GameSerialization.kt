package com.saveslot.app.data.local

import com.saveslot.app.core.text.GameTitles
import com.saveslot.app.core.text.PlatformNames
import com.saveslot.app.domain.model.CollectionEntry
import com.saveslot.app.domain.model.CopyFormat
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.MediaRecord
import com.saveslot.app.domain.model.Note
import com.saveslot.app.domain.model.NoteType
import com.saveslot.app.domain.model.PlayStatus
import kotlinx.serialization.json.Json

/**
 * Converts between [Game] and its stored JSON form, repairing records on the way out.
 *
 * Persisted rows can predate a canonicalisation rule or have been written when an upstream label
 * was missing, so every load re-normalises platform names and re-derives the display title. Doing
 * it here means the rest of the app can treat any [Game] it receives as already sane.
 */
class GameSerializer(private val json: Json) {

    fun encode(game: Game): String = json.encodeToString(Game.serializer(), game)

    fun decode(payload: String): Game? =
        runCatching { json.decodeFromString(Game.serializer(), payload) }.getOrNull()?.let(::repair)

    /**
     * Brings a stored record up to date:
     *  - platform and genre lists re-canonicalised and de-duplicated,
     *  - media keys re-keyed onto canonical platform names,
     *  - selected platform forced to one the game actually has,
     *  - title re-resolved so old rows showing "Q12345" heal themselves.
     */
    fun repair(game: Game): Game {
        val platforms = PlatformNames.sanitize(game.platforms, isPlatform = true)
        val genres = PlatformNames.sanitize(game.genres, isPlatform = false)

        val media = mutableMapOf<String, MediaRecord>()
        for ((key, record) in game.mediaByPlatform) {
            val canonicalKey = if (key == Game.GENERIC_PLATFORM_KEY) {
                key
            } else {
                PlatformNames.canonical(key).ifEmpty { Game.GENERIC_PLATFORM_KEY }
            }
            val platformName = if (canonicalKey == Game.GENERIC_PLATFORM_KEY) "" else canonicalKey
            // Two legacy keys can collapse onto one canonical platform; keep whichever has artwork.
            val existing = media[canonicalKey]
            media[canonicalKey] = when {
                existing == null -> record.copy(platform = platformName)
                existing.boxArt != null -> existing
                else -> record.copy(platform = platformName)
            }
        }

        val selected = PlatformNames.canonical(game.selectedPlatform)
            .takeIf { it.isNotEmpty() && platforms.contains(it) }
            ?: platforms.firstOrNull().orEmpty()

        val title = GameTitles.chooseBest(
            listOf(
                game.title,
                game.originalTitle,
                game.ukWikiTitle,
                game.enWikiTitle,
            ) + game.aliases + listOf(GameTitles.inferFromDescription(game.description)),
        ).ifEmpty { if (GameTitles.isInvalid(game.title)) GameTitles.PENDING_TITLE else game.title }

        return game.copy(
            title = title,
            originalTitle = if (GameTitles.isInvalid(game.originalTitle)) title else game.originalTitle,
            platforms = platforms,
            genres = genres,
            selectedPlatform = selected,
            mediaByPlatform = media,
        )
    }
}

internal fun CollectionEntryEntity.toDomain(game: Game, notes: List<Note>): CollectionEntry =
    CollectionEntry(
        game = game,
        status = PlayStatus.fromKey(status),
        format = CopyFormat.fromKey(format),
        owned = owned,
        favorite = favorite,
        playedOn = playedOn,
        // Stored ratings are clamped on read as well as write: a hand-edited database or an older
        // build could hold something outside the slider's range.
        rating = rating?.coerceIn(0.0, 10.0),
        notes = notes,
        addedAt = addedAt,
        updatedAt = updatedAt,
    )

internal fun CollectionEntry.toEntity(serializer: GameSerializer): CollectionEntryEntity =
    CollectionEntryEntity(
        gameId = game.id,
        payload = serializer.encode(game),
        status = status.storageKey,
        format = format.storageKey,
        owned = owned,
        favorite = favorite,
        playedOn = playedOn,
        rating = rating,
        addedAt = addedAt,
        updatedAt = updatedAt,
    )

internal fun NoteEntity.toDomain(): Note = Note(
    id = id,
    gameId = gameId,
    type = NoteType.fromKey(type),
    title = title,
    body = body,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

internal fun Note.toEntity(): NoteEntity = NoteEntity(
    id = id,
    gameId = gameId,
    type = type.storageKey,
    title = title,
    body = body,
    createdAt = createdAt,
    updatedAt = updatedAt,
)
