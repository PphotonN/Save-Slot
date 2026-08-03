package com.saveslot.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface GameCacheDao {

    @Upsert
    suspend fun upsert(games: List<CachedGameEntity>)

    @Query("SELECT * FROM cached_games WHERE id = :id")
    suspend fun byId(id: String): CachedGameEntity?

    @Query("SELECT * FROM cached_games WHERE id IN (:ids)")
    suspend fun byIds(ids: List<String>): List<CachedGameEntity>

    @Query("SELECT * FROM cached_games ORDER BY updatedAt DESC LIMIT :limit")
    suspend fun recentlyCached(limit: Int): List<CachedGameEntity>

    @Query("SELECT COUNT(*) FROM cached_games")
    suspend fun count(): Int

    @Query("SELECT SUM(LENGTH(payload)) FROM cached_games")
    fun approximateBytes(): Flow<Long?>

    @Query("SELECT MAX(updatedAt) FROM cached_games")
    fun lastUpdate(): Flow<Long?>

    /**
     * Drops the least recently touched cached games, never evicting ones the user has
     * personally kept (collection or recent history).
     */
    @Query(
        """
        DELETE FROM cached_games WHERE id IN (
            SELECT id FROM cached_games
            WHERE id NOT IN (SELECT gameId FROM collection_entries)
              AND id NOT IN (SELECT gameId FROM recent_games)
            ORDER BY updatedAt ASC
            LIMIT :excess
        )
        """,
    )
    suspend fun trimOldest(excess: Int)

    @Query("DELETE FROM cached_games")
    suspend fun clear()

    @Transaction
    suspend fun trimTo(maxRows: Int) {
        val excess = count() - maxRows
        if (excess > 0) trimOldest(excess)
    }
}

@Dao
interface QueryCacheDao {

    @Upsert
    suspend fun upsert(entry: QueryCacheEntity)

    @Query("SELECT * FROM query_cache WHERE query = :query")
    suspend fun byQuery(query: String): QueryCacheEntity?

    @Query(
        """
        DELETE FROM query_cache WHERE query NOT IN (
            SELECT query FROM query_cache ORDER BY createdAt DESC LIMIT :keep
        )
        """,
    )
    suspend fun trimTo(keep: Int)

    @Query("DELETE FROM query_cache")
    suspend fun clear()
}

@Dao
interface RecentGamesDao {

    @Query("SELECT * FROM recent_games ORDER BY viewedAt DESC LIMIT :limit")
    fun observe(limit: Int): Flow<List<RecentGameEntity>>

    @Query("SELECT * FROM recent_games ORDER BY viewedAt DESC LIMIT :limit")
    suspend fun snapshot(limit: Int): List<RecentGameEntity>

    @Upsert
    suspend fun upsert(entry: RecentGameEntity)

    @Query(
        """
        DELETE FROM recent_games WHERE gameId NOT IN (
            SELECT gameId FROM recent_games ORDER BY viewedAt DESC LIMIT :keep
        )
        """,
    )
    suspend fun trimTo(keep: Int)

    @Transaction
    suspend fun remember(entry: RecentGameEntity, keep: Int) {
        upsert(entry)
        trimTo(keep)
    }

    @Query("DELETE FROM recent_games")
    suspend fun clear()
}

@Dao
interface CollectionDao {

    @Query("SELECT * FROM collection_entries ORDER BY updatedAt DESC")
    fun observeEntries(): Flow<List<CollectionEntryEntity>>

    @Query("SELECT * FROM collection_entries WHERE gameId = :gameId")
    fun observeEntry(gameId: String): Flow<CollectionEntryEntity?>

    @Query("SELECT * FROM collection_entries WHERE gameId = :gameId")
    suspend fun entry(gameId: String): CollectionEntryEntity?

    @Upsert
    suspend fun upsert(entry: CollectionEntryEntity)

    @Query("DELETE FROM collection_entries WHERE gameId = :gameId")
    suspend fun delete(gameId: String)

    @Query("DELETE FROM collection_entries")
    suspend fun clear()

    @Query("SELECT * FROM notes ORDER BY updatedAt DESC")
    fun observeAllNotes(): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes WHERE gameId = :gameId ORDER BY updatedAt DESC")
    fun observeNotes(gameId: String): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes WHERE gameId IN (:gameIds) ORDER BY updatedAt DESC")
    suspend fun notesFor(gameIds: List<String>): List<NoteEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNote(note: NoteEntity)

    @Query("DELETE FROM notes WHERE id = :noteId")
    suspend fun deleteNote(noteId: String)

    @Query("DELETE FROM notes")
    suspend fun clearNotes()
}

@Dao
interface TaxonomyDao {

    @Query("SELECT * FROM taxonomy_terms WHERE kind = :kind ORDER BY value")
    fun observe(kind: String): Flow<List<TaxonomyTermEntity>>

    @Upsert
    suspend fun upsert(terms: List<TaxonomyTermEntity>)
}
