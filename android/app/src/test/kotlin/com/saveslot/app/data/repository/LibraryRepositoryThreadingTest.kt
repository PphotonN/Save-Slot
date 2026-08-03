package com.saveslot.app.data.repository

import app.cash.turbine.test
import com.saveslot.app.data.local.CollectionDao
import com.saveslot.app.data.local.CollectionEntryEntity
import com.saveslot.app.data.local.GameSerializer
import com.saveslot.app.data.local.NoteEntity
import com.saveslot.app.data.local.RecentGameEntity
import com.saveslot.app.data.local.RecentGamesDao
import com.saveslot.app.domain.model.Game
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards the threading contract: payload decoding must not run on the collector's thread.
 *
 * Flow operators execute wherever the collector runs, and these flows are collected by
 * `stateIn(viewModelScope)` — the main thread. A `flowOn` deleted by accident would be invisible in
 * a functional test and would show up only as dropped frames on a device, so the dispatcher the work
 * lands on is asserted directly.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class LibraryRepositoryThreadingTest {

    private val serializer = GameSerializer(Json { ignoreUnknownKeys = true })

    private fun game(id: String) = Game(id = id, title = "Game $id", platforms = listOf("Nintendo 64"))

    @Test
    fun `collection entries are decoded off the collecting thread`() = runTest {
        val collectionDao = FakeCollectionDao()
        val recentDao = FakeRecentGamesDao()
        val decodeThreads = mutableSetOf<String>()

        val repository = LibraryRepository(
            collectionDao = collectionDao,
            recentGamesDao = recentDao,
            serializer = object : GameSerializer(Json { ignoreUnknownKeys = true }) {
                override fun decode(payload: String): Game? {
                    decodeThreads += Thread.currentThread().name
                    return super.decode(payload)
                }
            },
            workDispatcher = Dispatchers.Default,
        )

        collectionDao.entries.value = listOf(entity("Q1"))

        repository.entries.test {
            val first = awaitItem()
            assertEquals(1, first.size)
            cancelAndIgnoreRemainingEvents()
        }

        assertTrue("decode never ran", decodeThreads.isNotEmpty())
        val collectorThread = Thread.currentThread().name
        assertTrue(
            "decode ran on the collecting thread: $decodeThreads",
            decodeThreads.none { it == collectorThread },
        )
    }

    @Test
    fun `writes encode off the calling thread`() = runTest {
        val collectionDao = FakeCollectionDao()
        val recentDao = FakeRecentGamesDao()
        val encodeThreads = mutableSetOf<String>()

        val repository = LibraryRepository(
            collectionDao = collectionDao,
            recentGamesDao = recentDao,
            serializer = object : GameSerializer(Json { ignoreUnknownKeys = true }) {
                override fun encode(game: Game): String {
                    encodeThreads += Thread.currentThread().name
                    return super.encode(game)
                }
            },
            workDispatcher = Dispatchers.Default,
        )

        // rememberRecent runs on every game open, so it is the most frequent encode on the app's
        // main thread if it is not dispatched away.
        repository.rememberRecent(game("Q7"))

        assertTrue("encode never ran", encodeThreads.isNotEmpty())
        assertTrue(
            "encode ran on the calling thread: $encodeThreads",
            encodeThreads.none { it == Thread.currentThread().name },
        )
    }

    private fun entity(id: String) = CollectionEntryEntity(
        gameId = id,
        payload = serializer.encode(game(id)),
        status = "planned",
        format = "unknown",
        owned = false,
        favorite = false,
        playedOn = "Nintendo 64",
        rating = null,
        addedAt = 1L,
        updatedAt = 1L,
    )

    /** Minimal in-memory stand-ins; only the members these flows touch are implemented. */
    private class FakeCollectionDao : CollectionDao {
        val entries = MutableStateFlow<List<CollectionEntryEntity>>(emptyList())
        val notes = MutableStateFlow<List<NoteEntity>>(emptyList())

        override fun observeEntries(): Flow<List<CollectionEntryEntity>> = entries
        override fun observeAllNotes(): Flow<List<NoteEntity>> = notes
        override fun observeEntry(gameId: String): Flow<CollectionEntryEntity?> =
            entries.map { list -> list.firstOrNull { it.gameId == gameId } }
        override fun observeNotes(gameId: String): Flow<List<NoteEntity>> =
            notes.map { list -> list.filter { it.gameId == gameId } }

        override suspend fun entry(gameId: String): CollectionEntryEntity? =
            entries.value.firstOrNull { it.gameId == gameId }

        override suspend fun upsert(entry: CollectionEntryEntity) {
            entries.value = entries.value.filterNot { it.gameId == entry.gameId } + entry
        }

        override suspend fun delete(gameId: String) {
            entries.value = entries.value.filterNot { it.gameId == gameId }
        }

        override suspend fun clear() { entries.value = emptyList() }
        override suspend fun notesFor(gameIds: List<String>): List<NoteEntity> =
            notes.value.filter { it.gameId in gameIds }
        override suspend fun insertNote(note: NoteEntity) { notes.value = notes.value + note }
        override suspend fun deleteNote(noteId: String) {
            notes.value = notes.value.filterNot { it.id == noteId }
        }
        override suspend fun clearNotes() { notes.value = emptyList() }
    }

    private class FakeRecentGamesDao : RecentGamesDao {
        val rows = MutableStateFlow<List<RecentGameEntity>>(emptyList())

        override fun observe(limit: Int): Flow<List<RecentGameEntity>> = rows
        override suspend fun snapshot(limit: Int): List<RecentGameEntity> = rows.value.take(limit)
        override suspend fun upsert(entry: RecentGameEntity) {
            rows.value = listOf(entry) + rows.value.filterNot { it.gameId == entry.gameId }
        }
        override suspend fun trimTo(keep: Int) { rows.value = rows.value.take(keep) }
        override suspend fun clear() { rows.value = emptyList() }
    }

    @Suppress("unused")
    private val unusedDispatcher = StandardTestDispatcher()
}
