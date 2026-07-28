import {
  collectionExportSchema,
  type CollectionEntry,
  type CollectionExport,
  type ReleaseSnapshot,
  type UserList,
} from '@save-slot/domain';
import {
  IndexedDbCollectionRepository,
  MemoryCollectionRepository,
  createDefaultList,
  createUserList,
  ensureDefaultList,
  normalizeCollectionMembership,
  type CollectionRepository,
} from './index';

export {
  IndexedDbCollectionRepository,
  MemoryCollectionRepository,
  createDefaultList,
  createUserList,
  ensureDefaultList,
  normalizeCollectionMembership,
};
export type { CollectionRepository };

const PROJECT_LIBRARY_URL = 'http://127.0.0.1:8791';
const FILE_WRITE_DELAY_MS = 120;

interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

type WindowWithCapacitor = Window & { Capacitor?: CapacitorBridge };
type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export interface ProjectFileMirrorContext {
  hostname: string;
  protocol: string;
  native?: boolean;
  standalone?: boolean;
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
}

export function shouldUseProjectFileMirror(context: ProjectFileMirrorContext): boolean {
  if (context.native || context.standalone) return false;
  if (!['http:', 'https:'].includes(context.protocol.toLowerCase())) return false;
  return ['localhost', '127.0.0.1', '::1'].includes(normalizeHostname(context.hostname));
}

function isNativeCapacitorPlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = (window as WindowWithCapacitor).Capacitor;
  if (!bridge) return false;
  try {
    if (bridge.isNativePlatform?.()) return true;
    return ['android', 'ios'].includes(bridge.getPlatform?.() ?? '');
  } catch {
    return false;
  }
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  return Boolean((window.navigator as NavigatorWithStandalone).standalone);
}

function emitCacheStatus(status: 'ready' | 'saved' | 'unavailable' | 'error', message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('save-slot-library-cache', {
      detail: { status, message, timestamp: new Date().toISOString() },
    }),
  );
}

class ProjectFileMirroredRepository implements CollectionRepository {
  private readonly ready: Promise<void>;
  private writeQueue: Promise<void> = Promise.resolve();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly base: CollectionRepository,
    private readonly baseUrl = PROJECT_LIBRARY_URL,
  ) {
    this.ready = this.restoreFromProjectFile();
  }

  private async restoreFromProjectFile(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/library`, { cache: 'no-store' });
      if (response.status === 404) {
        const existing = await this.base.exportData();
        const hasLocalData =
          existing.entries.length > 0 || existing.lists.length > 0 || existing.snapshots.length > 0;
        if (hasLocalData) {
          await this.enqueueWrite(existing);
        } else {
          emitCacheStatus('ready', 'Файл колекції буде створено після першої зміни.');
        }
        return;
      }
      if (!response.ok) throw new Error(`Project library read failed with HTTP ${response.status}.`);
      const payload = collectionExportSchema.parse(await response.json());
      await this.base.importData(payload);
      emitCacheStatus('ready', 'Колекцію відновлено з .save-slot-data/library.json.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[Save Slot] Project library cache unavailable:', message);
      emitCacheStatus('unavailable', `Файловий кеш недоступний: ${message}`);
    }
  }

  private async writePayload(payload: CollectionExport): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/library`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Project library write failed with HTTP ${response.status}.`);
      emitCacheStatus('saved', 'Колекцію збережено у .save-slot-data/library.json.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[Save Slot] Could not mirror collection to project folder:', message);
      emitCacheStatus('error', `Не вдалося записати файл колекції: ${message}`);
    }
  }

  private async enqueueWrite(payload?: CollectionExport): Promise<void> {
    const snapshot = payload ?? (await this.base.exportData());
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(() => this.writePayload(snapshot));
    await this.writeQueue;
  }

  private scheduleProjectFileSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      void this.enqueueWrite();
    }, FILE_WRITE_DELAY_MS);
  }

  private async flushProjectFileSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
    await this.enqueueWrite();
  }

  async listEntries(): Promise<CollectionEntry[]> {
    await this.ready;
    return this.base.listEntries();
  }

  async putEntry(entry: CollectionEntry): Promise<void> {
    await this.ready;
    await this.base.putEntry(entry);
    this.scheduleProjectFileSave();
  }

  async deleteEntry(id: string): Promise<void> {
    await this.ready;
    await this.base.deleteEntry(id);
    this.scheduleProjectFileSave();
  }

  async listLists(): Promise<UserList[]> {
    await this.ready;
    return this.base.listLists();
  }

  async putList(list: UserList): Promise<void> {
    await this.ready;
    await this.base.putList(list);
    this.scheduleProjectFileSave();
  }

  async deleteList(id: string): Promise<void> {
    await this.ready;
    await this.base.deleteList(id);
    this.scheduleProjectFileSave();
  }

  async setEntryLists(entryId: string, listIds: string[]): Promise<void> {
    await this.ready;
    await this.base.setEntryLists(entryId, listIds);
    this.scheduleProjectFileSave();
  }

  async putSnapshot(snapshot: ReleaseSnapshot): Promise<void> {
    await this.ready;
    await this.base.putSnapshot(snapshot);
    this.scheduleProjectFileSave();
  }

  async getSnapshot(releaseId: string): Promise<ReleaseSnapshot | undefined> {
    await this.ready;
    return this.base.getSnapshot(releaseId);
  }

  async exportData(): Promise<CollectionExport> {
    await this.ready;
    return this.base.exportData();
  }

  async importData(payload: unknown): Promise<void> {
    await this.ready;
    await this.base.importData(collectionExportSchema.parse(payload));
    await this.flushProjectFileSave();
  }

  async clear(): Promise<void> {
    await this.ready;
    await this.base.clear();
    await this.flushProjectFileSave();
  }
}

export function createCollectionRepository(): CollectionRepository {
  const base =
    typeof indexedDB === 'undefined'
      ? new MemoryCollectionRepository()
      : new IndexedDbCollectionRepository();

  if (typeof window === 'undefined') return base;

  const native = isNativeCapacitorPlatform();
  const standalone = isStandalonePwa();
  const mirrorProjectFile = shouldUseProjectFileMirror({
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    native,
    standalone,
  });

  if (!mirrorProjectFile) {
    queueMicrotask(() =>
      emitCacheStatus(
        'ready',
        native ? 'IndexedDB · local app storage' : 'IndexedDB · local browser storage',
      ),
    );
    return base;
  }

  return new ProjectFileMirroredRepository(base);
}
