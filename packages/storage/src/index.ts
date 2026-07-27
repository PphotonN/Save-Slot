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
  deleteList(id: string): Promise<void>;
  setEntryLists(entryId: string, listIds: string[]): Promise<void>;
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

function uniqueExisting(values: string[], existing: Set<string>): string[] {
  return [...new Set(values)].filter((value) => existing.has(value));
}

export function normalizeCollectionMembership(
  entriesInput: CollectionEntry[],
  listsInput: UserList[],
): { entries: CollectionEntry[]; lists: UserList[] } {
  const entries = entriesInput.map((entry) => collectionEntrySchema.parse(entry));
  const lists = listsInput.map((list) => userListSchema.parse(list));
  const entryIds = new Set(entries.map((entry) => entry.id));
  const listIds = new Set(lists.map((list) => list.id));
  const memberships = new Map(entries.map((entry) => [entry.id, new Set(uniqueExisting(entry.listIds, listIds))]));

  for (const list of lists) {
    for (const entryId of uniqueExisting(list.entryIds, entryIds)) {
      memberships.get(entryId)?.add(list.id);
    }
  }

  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    listIds: [...(memberships.get(entry.id) ?? [])],
  }));
  const normalizedLists = lists.map((list) => ({
    ...list,
    entryIds: normalizedEntries
      .filter((entry) => entry.listIds.includes(list.id))
      .map((entry) => entry.id),
  }));

  return {
    entries: normalizedEntries.map((entry) => collectionEntrySchema.parse(entry)),
    lists: normalizedLists.map((list) => userListSchema.parse(list)),
  };
}

export function createUserList(
  name: string,
  preset: UserList['preset'] = 'custom',
): UserList {
  const now = new Date().toISOString();
  return userListSchema.parse({
    id: makeLocalId('list'),
    name: name.trim(),
    preset,
    entryIds: [],
    preferredView: 'rows',
    sort: 'manual',
    createdAt: now,
    updatedAt: now,
  });
}

export function createDefaultList(): UserList {
  return createUserList('Моя колекція', 'collection');
}

function updateListMembership(
  list: UserList,
  entryId: string,
  included: boolean,
  now: string,
): UserList {
  const entryIds = included
    ? [...new Set([...list.entryIds, entryId])]
    : list.entryIds.filter((id) => id !== entryId);
  if (entryIds.length === list.entryIds.length && entryIds.every((id, index) => id === list.entryIds[index])) {
    return list;
  }
  return userListSchema.parse({ ...list, entryIds, updatedAt: now });
}

function updateEntryMembership(
  entry: CollectionEntry,
  listId: string,
  included: boolean,
  now: string,
): CollectionEntry {
  const listIds = included
    ? [...new Set([...entry.listIds, listId])]
    : entry.listIds.filter((id) => id !== listId);
  if (listIds.length === entry.listIds.length && listIds.every((id, index) => id === entry.listIds[index])) {
    return entry;
  }
  return collectionEntrySchema.parse({ ...entry, listIds, updatedAt: now });
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
    const validListIds = uniqueExisting(parsed.listIds, new Set(this.lists.keys()));
    const updated = collectionEntrySchema.parse({ ...parsed, listIds: validListIds });
    this.entries.set(updated.id, structuredClone(updated));
    const now = new Date().toISOString();
    for (const [listId, list] of this.lists) {
      this.lists.set(
        listId,
        structuredClone(updateListMembership(list, updated.id, validListIds.includes(listId), now)),
      );
    }
  }

  async deleteEntry(id: string): Promise<void> {
    this.entries.delete(id);
    const now = new Date().toISOString();
    for (const [listId, list] of this.lists) {
      this.lists.set(listId, structuredClone(updateListMembership(list, id, false, now)));
    }
  }

  async listLists(): Promise<UserList[]> {
    return structuredClone([...this.lists.values()]);
  }

  async putList(list: UserList): Promise<void> {
    const parsed = userListSchema.parse(list);
    const validEntryIds = uniqueExisting(parsed.entryIds, new Set(this.entries.keys()));
    const updated = userListSchema.parse({ ...parsed, entryIds: validEntryIds });
    this.lists.set(updated.id, structuredClone(updated));
    const now = new Date().toISOString();
    for (const [entryId, entry] of this.entries) {
      this.entries.set(
        entryId,
        structuredClone(updateEntryMembership(entry, updated.id, validEntryIds.includes(entryId), now)),
      );
    }
  }

  async deleteList(id: string): Promise<void> {
    this.lists.delete(id);
    const now = new Date().toISOString();
    for (const [entryId, entry] of this.entries) {
      this.entries.set(entryId, structuredClone(updateEntryMembership(entry, id, false, now)));
    }
  }

  async setEntryLists(entryId: string, listIds: string[]): Promise<void> {
    const entry = this.entries.get(entryId);
    if (!entry) throw new Error(`Collection entry not found: ${entryId}`);
    const valid = uniqueExisting(listIds, new Set(this.lists.keys()));
    const now = new Date().toISOString();
    const updated = collectionEntrySchema.parse({ ...entry, listIds: valid, updatedAt: now });
    this.entries.set(entryId, structuredClone(updated));
    for (const [listId, list] of this.lists) {
      this.lists.set(
        listId,
        structuredClone(updateListMembership(list, entryId, valid.includes(listId), now)),
      );
    }
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
    const membership = normalizeCollectionMembership(await this.listEntries(), await this.listLists());
    return collectionExportSchema.parse({
      format: 'save-slot-collection',
      version: 1,
      exportedAt: new Date().toISOString(),
      lists: membership.lists,
      entries: membership.entries,
      snapshots: structuredClone([...this.snapshots.values()]),
    });
  }

  async importData(payload: unknown): Promise<void> {
    const data = collectionExportSchema.parse(payload);
    const membership = normalizeCollectionMembership(data.entries, data.lists);
    await this.clear();
    for (const entry of membership.entries) this.entries.set(entry.id, structuredClone(entry));
    for (const list of membership.lists) this.lists.set(list.id, structuredClone(list));
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
    const completed = transactionComplete(transaction);
    const values = await requestResult(transaction.objectStore(storeName).getAll());
    await completed;
    return values as T[];
  }

  private async put(storeName: StoreName, value: unknown): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction(storeName, 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(storeName).put(value);
    await completed;
  }

  async listEntries(): Promise<CollectionEntry[]> {
    return (await this.readAll<unknown>(ENTRY_STORE)).map((entry) => collectionEntrySchema.parse(entry));
  }

  async putEntry(entry: CollectionEntry): Promise<void> {
    const parsed = collectionEntrySchema.parse(entry);
    const database = await this.databasePromise;
    const transaction = database.transaction([ENTRY_STORE, LIST_STORE], 'readwrite');
    const completed = transactionComplete(transaction);
    const entryStore = transaction.objectStore(ENTRY_STORE);
    const listStore = transaction.objectStore(LIST_STORE);
    const lists = (await requestResult(listStore.getAll())).map((list) => userListSchema.parse(list));
    const validListIds = uniqueExisting(parsed.listIds, new Set(lists.map((list) => list.id)));
    const updated = collectionEntrySchema.parse({ ...parsed, listIds: validListIds });
    entryStore.put(updated);
    const now = new Date().toISOString();
    for (const list of lists) {
      listStore.put(updateListMembership(list, updated.id, validListIds.includes(list.id), now));
    }
    await completed;
  }

  async deleteEntry(id: string): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction([ENTRY_STORE, LIST_STORE], 'readwrite');
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENTRY_STORE).delete(id);
    const listStore = transaction.objectStore(LIST_STORE);
    const lists = (await requestResult(listStore.getAll())).map((list) => userListSchema.parse(list));
    const now = new Date().toISOString();
    for (const list of lists) listStore.put(updateListMembership(list, id, false, now));
    await completed;
  }

  async listLists(): Promise<UserList[]> {
    return (await this.readAll<unknown>(LIST_STORE)).map((list) => userListSchema.parse(list));
  }

  async putList(list: UserList): Promise<void> {
    const parsed = userListSchema.parse(list);
    const database = await this.databasePromise;
    const transaction = database.transaction([ENTRY_STORE, LIST_STORE], 'readwrite');
    const completed = transactionComplete(transaction);
    const entryStore = transaction.objectStore(ENTRY_STORE);
    const listStore = transaction.objectStore(LIST_STORE);
    const entries = (await requestResult(entryStore.getAll())).map((entry) => collectionEntrySchema.parse(entry));
    const validEntryIds = uniqueExisting(parsed.entryIds, new Set(entries.map((entry) => entry.id)));
    const updated = userListSchema.parse({ ...parsed, entryIds: validEntryIds });
    listStore.put(updated);
    const now = new Date().toISOString();
    for (const entry of entries) {
      entryStore.put(updateEntryMembership(entry, updated.id, validEntryIds.includes(entry.id), now));
    }
    await completed;
  }

  async deleteList(id: string): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction([ENTRY_STORE, LIST_STORE], 'readwrite');
    const completed = transactionComplete(transaction);
    const entryStore = transaction.objectStore(ENTRY_STORE);
    transaction.objectStore(LIST_STORE).delete(id);
    const entries = (await requestResult(entryStore.getAll())).map((entry) => collectionEntrySchema.parse(entry));
    const now = new Date().toISOString();
    for (const entry of entries) entryStore.put(updateEntryMembership(entry, id, false, now));
    await completed;
  }

  async setEntryLists(entryId: string, listIds: string[]): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction([ENTRY_STORE, LIST_STORE], 'readwrite');
    const completed = transactionComplete(transaction);
    const entryStore = transaction.objectStore(ENTRY_STORE);
    const listStore = transaction.objectStore(LIST_STORE);
    const rawEntry = await requestResult(entryStore.get(entryId));
    if (!rawEntry) {
      transaction.abort();
      throw new Error(`Collection entry not found: ${entryId}`);
    }
    const entry = collectionEntrySchema.parse(rawEntry);
    const lists = (await requestResult(listStore.getAll())).map((list) => userListSchema.parse(list));
    const valid = uniqueExisting(listIds, new Set(lists.map((list) => list.id)));
    const now = new Date().toISOString();
    entryStore.put(collectionEntrySchema.parse({ ...entry, listIds: valid, updatedAt: now }));
    for (const list of lists) {
      listStore.put(updateListMembership(list, entryId, valid.includes(list.id), now));
    }
    await completed;
  }

  async putSnapshot(snapshot: ReleaseSnapshot): Promise<void> {
    await this.put(SNAPSHOT_STORE, releaseSnapshotSchema.parse(snapshot));
  }

  async getSnapshot(releaseId: string): Promise<ReleaseSnapshot | undefined> {
    const database = await this.databasePromise;
    const transaction = database.transaction(SNAPSHOT_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const value = await requestResult(transaction.objectStore(SNAPSHOT_STORE).get(releaseId));
    await completed;
    return value ? releaseSnapshotSchema.parse(value) : undefined;
  }

  async exportData(): Promise<CollectionExport> {
    const membership = normalizeCollectionMembership(await this.listEntries(), await this.listLists());
    return collectionExportSchema.parse({
      format: 'save-slot-collection',
      version: 1,
      exportedAt: new Date().toISOString(),
      lists: membership.lists,
      entries: membership.entries,
      snapshots: (await this.readAll<unknown>(SNAPSHOT_STORE)).map((snapshot) =>
        releaseSnapshotSchema.parse(snapshot),
      ),
    });
  }

  async importData(payload: unknown): Promise<void> {
    const data = collectionExportSchema.parse(payload);
    const membership = normalizeCollectionMembership(data.entries, data.lists);
    const database = await this.databasePromise;
    const transaction = database.transaction(
      [ENTRY_STORE, LIST_STORE, SNAPSHOT_STORE],
      'readwrite',
    );
    const completed = transactionComplete(transaction);
    const entryStore = transaction.objectStore(ENTRY_STORE);
    const listStore = transaction.objectStore(LIST_STORE);
    const snapshotStore = transaction.objectStore(SNAPSHOT_STORE);
    entryStore.clear();
    listStore.clear();
    snapshotStore.clear();
    for (const entry of membership.entries) entryStore.put(entry);
    for (const list of membership.lists) listStore.put(list);
    for (const snapshot of data.snapshots) snapshotStore.put(snapshot);
    await completed;
  }

  async clear(): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction(
      [ENTRY_STORE, LIST_STORE, SNAPSHOT_STORE],
      'readwrite',
    );
    const completed = transactionComplete(transaction);
    transaction.objectStore(ENTRY_STORE).clear();
    transaction.objectStore(LIST_STORE).clear();
    transaction.objectStore(SNAPSHOT_STORE).clear();
    await completed;
  }
}

export function createCollectionRepository(): CollectionRepository {
  return typeof indexedDB === 'undefined'
    ? new MemoryCollectionRepository()
    : new IndexedDbCollectionRepository();
}

export async function ensureDefaultList(repository: CollectionRepository): Promise<UserList> {
  const existing = await repository.listLists();
  const collection = existing.find((list) => list.preset === 'collection');
  if (collection) return collection;
  const list = createDefaultList();
  await repository.putList(list);
  return list;
}
