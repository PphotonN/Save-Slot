import {
  collectionEntrySchema,
  collectionExportSchema,
  makeLocalId,
  releaseSnapshotSchema,
  userListSchema,
  type CollectionEntry,
  type CollectionExport,
  type ReleaseSnapshot,
  type UserList,
} from '@save-slot/domain';

const DATABASE_NAME = 'save-slot-v1';
const DATABASE_VERSION = 1;
const ENTRY_STORE = 'entries';
const LIST_STORE = 'lists';
const SNAPSHOT_STORE = 'snapshots';

type StoreName = typeof ENTRY_STORE | typeof LIST_STORE | typeof SNAPSHOT_STORE;

export interface CollectionRepository {
  listEntries(): Promise<CollectionEntry[]>;
  putEntry(entry: CollectionEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  listLists(): Promise<UserList[]>;
  putList(list: UserList): Promise<void>;
  putSnapshot(snapshot: ReleaseSnapshot): Promise<void>;
  getSnapshot(releaseId: string): Promise<ReleaseSnapshot | undefined>;
  exportData(): Promise<CollectionExport>;
  importData(payload: unknown): Promise<void>;
  clear(): Promise<void>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ENTRY_STORE)) {
        database.createObjectStore(ENTRY_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(LIST_STORE)) {
        database.createObjectStore(LIST_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'release.id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab.'));
  });
}

export function createDefaultList(): UserList {
  const now = new Date().toISOString();
  return userListSchema.parse({
    id: makeLocalId('list'),
    name: 'Моя колекція',
    preset: 'collection',
    entryIds: [],
    preferredView: 'rows',
    sort: 'manual',
    createdAt: now,
    updatedAt: now,
  });
}

export class MemoryCollectionRepository implements CollectionRepository {
  private readonly entries = new Map<string, CollectionEntry>();
  private readonly lists = new Map<string, UserList>();
  private readonly snapshots = new Map<string, ReleaseSnapshot>();

  async listEntries(): Promise<CollectionEntry[]> {
    return structuredClone([...this.entries.values()]);
  }

  async putEntry(entry: CollectionEntry): Promise<void> {
    const parsed = collectionEntrySchema.parse(entry);
    this.entries.set(parsed.id, structuredClone(parsed));
  }

  async deleteEntry(id: string): Promise<void> {
    this.entries.delete(id);
    for (const [listId, list] of this.lists) {
      if (!list.entryIds.includes(id)) continue;
      this.lists.set(listId, {
        ...list,
        entryIds: list.entryIds.filter((entryId) => entryId !== id),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async listLists(): Promise<UserList[]> {
    return structuredClone([...this.lists.values()]);
  }

  async putList(list: UserList): Promise<void> {
    const parsed = userListSchema.parse(list);
    this.lists.set(parsed.id, structuredClone(parsed));
  }

  async putSnapshot(snapshot: ReleaseSnapshot): Promise<void> {
    const parsed = releaseSnapshotSchema.parse(snapshot);
    this.snapshots.set(parsed.release.id, structuredClone(parsed));
  }

  async getSnapshot(releaseId: string): Promise<ReleaseSnapshot | undefined> {
    const snapshot = this.snapshots.get(releaseId);
    return snapshot ? structuredClone(snapshot) : undefined;
  }

  async exportData(): Promise<CollectionExport> {
    return collectionExportSchema.parse({
      format: 'save-slot-collection',
      version: 1,
      exportedAt: new Date().toISOString(),
      lists: await this.listLists(),
      entries: await this.listEntries(),
      snapshots: structuredClone([...this.snapshots.values()]),
    });
  }

  async importData(payload: unknown): Promise<void> {
    const data = collectionExportSchema.parse(payload);
    await this.clear();
    for (const list of data.lists) await this.putList(list);
    for (const entry of data.entries) await this.putEntry(entry);
    for (const snapshot of data.snapshots) await this.putSnapshot(snapshot);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.lists.clear();
    this.snapshots.clear();
  }
}

export class IndexedDbCollectionRepository implements CollectionRepository {
  private readonly databasePromise = openDatabase();

  private async readAll<T>(storeName: StoreName): Promise<T[]> {
    const database = await this.databasePromise;
    const transaction = database.transaction(storeName, 'readonly');
    const values = await requestResult(transaction.objectStore(storeName).getAll());
    await transactionComplete(transaction);
    return values as T[];
  }

  private async put(storeName: StoreName, value: unknown): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    await transactionComplete(transaction);
  }

  async listEntries(): Promise<CollectionEntry[]> {
    return (await this.readAll<unknown>(ENTRY_STORE)).map((entry) => collectionEntrySchema.parse(entry));
  }

  async putEntry(entry: CollectionEntry): Promise<void> {
    await this.put(ENTRY_STORE, collectionEntrySchema.parse(entry));
  }

  async deleteEntry(id: string): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction([ENTRY_STORE, LIST_STORE], 'readwrite');
    transaction.objectStore(ENTRY_STORE).delete(id);
    const listStore = transaction.objectStore(LIST_STORE);
    const lists = (await requestResult(listStore.getAll())).map((list) => userListSchema.parse(list));
    for (const list of lists) {
      if (!list.entryIds.includes(id)) continue;
      listStore.put({
        ...list,
        entryIds: list.entryIds.filter((entryId) => entryId !== id),
        updatedAt: new Date().toISOString(),
      });
    }
    await transactionComplete(transaction);
  }

  async listLists(): Promise<UserList[]> {
    return (await this.readAll<unknown>(LIST_STORE)).map((list) => userListSchema.parse(list));
  }

  async putList(list: UserList): Promise<void> {
    await this.put(LIST_STORE, userListSchema.parse(list));
  }

  async putSnapshot(snapshot: ReleaseSnapshot): Promise<void> {
    await this.put(SNAPSHOT_STORE, releaseSnapshotSchema.parse(snapshot));
  }

  async getSnapshot(releaseId: string): Promise<ReleaseSnapshot | undefined> {
    const database = await this.databasePromise;
    const transaction = database.transaction(SNAPSHOT_STORE, 'readonly');
    const value = await requestResult(transaction.objectStore(SNAPSHOT_STORE).get(releaseId));
    await transactionComplete(transaction);
    return value ? releaseSnapshotSchema.parse(value) : undefined;
  }

  async exportData(): Promise<CollectionExport> {
    return collectionExportSchema.parse({
      format: 'save-slot-collection',
      version: 1,
      exportedAt: new Date().toISOString(),
      lists: await this.listLists(),
      entries: await this.listEntries(),
      snapshots: (await this.readAll<unknown>(SNAPSHOT_STORE)).map((snapshot) =>
        releaseSnapshotSchema.parse(snapshot),
      ),
    });
  }

  async importData(payload: unknown): Promise<void> {
    const data = collectionExportSchema.parse(payload);
    const database = await this.databasePromise;
    const transaction = database.transaction(
      [ENTRY_STORE, LIST_STORE, SNAPSHOT_STORE],
      'readwrite',
    );
    const entryStore = transaction.objectStore(ENTRY_STORE);
    const listStore = transaction.objectStore(LIST_STORE);
    const snapshotStore = transaction.objectStore(SNAPSHOT_STORE);
    entryStore.clear();
    listStore.clear();
    snapshotStore.clear();
    for (const entry of data.entries) entryStore.put(entry);
    for (const list of data.lists) listStore.put(list);
    for (const snapshot of data.snapshots) snapshotStore.put(snapshot);
    await transactionComplete(transaction);
  }

  async clear(): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction(
      [ENTRY_STORE, LIST_STORE, SNAPSHOT_STORE],
      'readwrite',
    );
    transaction.objectStore(ENTRY_STORE).clear();
    transaction.objectStore(LIST_STORE).clear();
    transaction.objectStore(SNAPSHOT_STORE).clear();
    await transactionComplete(transaction);
  }
}

export function createCollectionRepository(): CollectionRepository {
  return typeof indexedDB === 'undefined'
    ? new MemoryCollectionRepository()
    : new IndexedDbCollectionRepository();
}

export async function ensureDefaultList(repository: CollectionRepository): Promise<UserList> {
  const existing = await repository.listLists();
  if (existing[0]) return existing[0];
  const list = createDefaultList();
  await repository.putList(list);
  return list;
}
