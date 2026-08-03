package com.saveslot.app.domain.model

import kotlinx.serialization.Serializable

/** How far the user has got with a game. */
enum class PlayStatus(val storageKey: String) {
    Planned("planned"),
    Playing("playing"),
    Completed("completed"),
    CompletedFully("completed100"),
    Paused("paused"),
    Dropped("dropped"),
    Replaying("replaying");

    companion object {
        fun fromKey(key: String?): PlayStatus =
            entries.firstOrNull { it.storageKey == key } ?: Planned
    }
}

/** What kind of copy the user owns. */
enum class CopyFormat(val storageKey: String) {
    Unknown("unknown"),
    Physical("physical"),
    Digital("digital"),
    Cartridge("cartridge"),
    Disc("disc"),
    Collector("collector"),
    Backup("backup");

    companion object {
        fun fromKey(key: String?): CopyFormat =
            entries.firstOrNull { it.storageKey == key } ?: Unknown
    }
}

enum class NoteType(val storageKey: String) {
    Impression("impression"),
    Walkthrough("walkthrough"),
    Technical("technical"),
    Translation("translation"),
    CopyCondition("collection");

    companion object {
        fun fromKey(key: String?): NoteType =
            entries.firstOrNull { it.storageKey == key } ?: Impression
    }
}

@Serializable
data class Note(
    val id: String,
    val gameId: String,
    val type: NoteType,
    val title: String,
    val body: String,
    val createdAt: Long,
    val updatedAt: Long,
)

/** One game in the user's personal archive, with their own metadata. */
data class CollectionEntry(
    val game: Game,
    val status: PlayStatus = PlayStatus.Planned,
    val format: CopyFormat = CopyFormat.Unknown,
    val owned: Boolean = false,
    val favorite: Boolean = false,
    val playedOn: String = game.activePlatform,
    /** 0..10 in half-point steps, or null when unrated. */
    val rating: Double? = null,
    val notes: List<Note> = emptyList(),
    val addedAt: Long,
    val updatedAt: Long,
)

/** A note joined with the game it belongs to, for the notes journal. */
data class NoteWithGame(
    val note: Note,
    val game: Game,
)

/** Filter tabs on the collection screen. */
enum class CollectionFilter {
    All,
    Playing,
    Planned,
    Completed,
    Owned,
}
