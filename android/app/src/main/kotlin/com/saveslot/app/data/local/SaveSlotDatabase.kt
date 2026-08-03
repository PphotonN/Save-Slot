package com.saveslot.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        CachedGameEntity::class,
        QueryCacheEntity::class,
        RecentGameEntity::class,
        CollectionEntryEntity::class,
        NoteEntity::class,
        TaxonomyTermEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class SaveSlotDatabase : RoomDatabase() {

    abstract fun gameCacheDao(): GameCacheDao

    abstract fun queryCacheDao(): QueryCacheDao

    abstract fun recentGamesDao(): RecentGamesDao

    abstract fun collectionDao(): CollectionDao

    abstract fun taxonomyDao(): TaxonomyDao

    companion object {
        private const val NAME = "save-slot.db"

        fun build(context: Context): SaveSlotDatabase =
            Room.databaseBuilder(context, SaveSlotDatabase::class.java, NAME)
                // Notes cascade from collection entries; without this the FK is inert.
                .setJournalMode(JournalMode.WRITE_AHEAD_LOGGING)
                .build()
    }
}
