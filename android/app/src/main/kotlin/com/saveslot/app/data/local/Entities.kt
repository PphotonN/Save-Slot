package com.saveslot.app.data.local

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Cached game facts. The Wikidata-shaped payload is stored as one JSON column: it is a
 * document we always read whole, and keeping it opaque means new upstream fields do not
 * force a schema migration.
 */
@Entity(tableName = "cached_games")
data class CachedGameEntity(
    @PrimaryKey val id: String,
    val payload: String,
    val updatedAt: Long,
)

/** Search query -> ordered result ids, so repeat searches can be answered offline. */
@Entity(tableName = "query_cache")
data class QueryCacheEntity(
    @PrimaryKey val query: String,
    val gameIds: String,
    val createdAt: Long,
)

/** Games the user opened recently, newest first by [viewedAt]. */
@Entity(tableName = "recent_games")
data class RecentGameEntity(
    @PrimaryKey val gameId: String,
    val payload: String,
    val viewedAt: Long,
)

@Entity(tableName = "collection_entries")
data class CollectionEntryEntity(
    @PrimaryKey val gameId: String,
    val payload: String,
    val status: String,
    val format: String,
    val owned: Boolean,
    val favorite: Boolean,
    val playedOn: String,
    val rating: Double?,
    val addedAt: Long,
    val updatedAt: Long,
)

@Entity(
    tableName = "notes",
    foreignKeys = [
        ForeignKey(
            entity = CollectionEntryEntity::class,
            parentColumns = ["gameId"],
            childColumns = ["gameId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("gameId"), Index("updatedAt")],
)
data class NoteEntity(
    @PrimaryKey val id: String,
    val gameId: String,
    val type: String,
    val title: String,
    val body: String,
    val createdAt: Long,
    val updatedAt: Long,
)

/** Platform/genre vocabulary discovered from games the app has seen. */
@Entity(tableName = "taxonomy_terms", primaryKeys = ["kind", "value"])
data class TaxonomyTermEntity(
    val kind: String,
    val value: String,
    val updatedAt: Long,
) {
    companion object {
        const val KIND_PLATFORM = "platform"
        const val KIND_GENRE = "genre"
    }
}
