import type { CollectionExport } from '@save-slot/domain';

function defaultLibraryUrl(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8791';
  const configured = import.meta.env.VITE_SAVE_SLOT_LIBRARY_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return `${window.location.protocol}//${window.location.hostname}:8791`;
}

export interface LibraryCacheHealth {
  service: string;
  status: string;
  projectRoot: string;
  cacheDirectory: string;
  libraryPath: string;
  exists: boolean;
}

export class LibraryCacheClient {
  readonly baseUrl: string;

  constructor(baseUrl = defaultLibraryUrl()) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async health(signal?: AbortSignal): Promise<LibraryCacheHealth> {
    const response = await fetch(`${this.baseUrl}/health`, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Library cache health check failed: ${response.status}`);
    return (await response.json()) as LibraryCacheHealth;
  }

  async load(signal?: AbortSignal): Promise<CollectionExport | null> {
    const response = await fetch(`${this.baseUrl}/library`, { signal, cache: 'no-store' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Library cache read failed: ${response.status}`);
    return (await response.json()) as CollectionExport;
  }

  async save(payload: CollectionExport, signal?: AbortSignal): Promise<void> {
    const response = await fetch(`${this.baseUrl}/library`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Library cache write failed: ${response.status}${detail ? ` — ${detail}` : ''}`);
    }
  }
}
