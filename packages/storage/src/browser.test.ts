import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCollectionRepository,
  createDefaultList,
  shouldUseProjectFileMirror,
} from './browser';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function browserWindow(
  dispatchEvent: ReturnType<typeof vi.fn>,
  options: {
    hostname?: string;
    protocol?: string;
    standalone?: boolean;
    native?: boolean;
  } = {},
) {
  return {
    dispatchEvent,
    location: {
      hostname: options.hostname ?? 'localhost',
      protocol: options.protocol ?? 'http:',
    },
    matchMedia: vi.fn().mockReturnValue({ matches: options.standalone ?? false }),
    navigator: {},
    Capacitor: options.native
      ? {
          isNativePlatform: () => true,
          getPlatform: () => 'android',
        }
      : undefined,
  };
}

describe('project file mirror activation', () => {
  it.each([
    ['localhost', 'http:'],
    ['LOCALHOST', 'https:'],
    ['127.0.0.1', 'http:'],
    ['::1', 'http:'],
    ['[::1]', 'https:'],
  ])('allows launcher origin %s', (hostname, protocol) => {
    expect(shouldUseProjectFileMirror({ hostname, protocol })).toBe(true);
  });

  it.each([
    ['save-slot.example', 'https:'],
    ['192.168.1.20', 'http:'],
    ['localhost.example', 'https:'],
    ['localhost', 'file:'],
  ])('rejects non-launcher origin %s', (hostname, protocol) => {
    expect(shouldUseProjectFileMirror({ hostname, protocol })).toBe(false);
  });

  it('rejects standalone PWA and native Capacitor contexts', () => {
    expect(
      shouldUseProjectFileMirror({ hostname: 'localhost', protocol: 'http:', standalone: true }),
    ).toBe(false);
    expect(
      shouldUseProjectFileMirror({ hostname: 'localhost', protocol: 'http:', native: true }),
    ).toBe(false);
  });
});

describe('browser collection repository', () => {
  it('restores through the desktop cache endpoint and mirrors collection changes', async () => {
    vi.useFakeTimers();
    const dispatchEvent = vi.fn();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'library_not_found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValue(
        new Response(JSON.stringify({ saved: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    vi.stubGlobal('window', browserWindow(dispatchEvent));
    vi.stubGlobal('fetch', fetchMock);

    const repository = createCollectionRepository();
    const list = createDefaultList();
    await repository.putList(list);
    await vi.advanceTimersByTimeAsync(150);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8791/library',
      expect.objectContaining({ cache: 'no-store' }),
    );

    const writeCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT');
    expect(writeCall).toBeDefined();
    expect(writeCall?.[0]).toBe('http://127.0.0.1:8791/library');

    const body = JSON.parse(String(writeCall?.[1]?.body));
    expect(body.format).toBe('save-slot-collection');
    expect(body.version).toBe(1);
    expect(body.lists[0]?.id).toBe(list.id);
    expect(dispatchEvent).toHaveBeenCalled();
  });

  it('uses browser-only storage on a public site', async () => {
    const dispatchEvent = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal(
      'window',
      browserWindow(dispatchEvent, { hostname: 'save-slot.example', protocol: 'https:' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const repository = createCollectionRepository();
    const list = createDefaultList();
    await repository.putList(list);
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await repository.listLists())[0]?.id).toBe(list.id);
  });

  it('uses browser-only storage in an installed PWA', async () => {
    const dispatchEvent = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('window', browserWindow(dispatchEvent, { standalone: true }));
    vi.stubGlobal('fetch', fetchMock);

    const repository = createCollectionRepository();
    const list = createDefaultList();
    await repository.putList(list);
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await repository.listLists())[0]?.id).toBe(list.id);
  });

  it('uses local-only storage on a native Capacitor platform', async () => {
    const dispatchEvent = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('window', browserWindow(dispatchEvent, { native: true }));
    vi.stubGlobal('fetch', fetchMock);

    const repository = createCollectionRepository();
    const list = createDefaultList();
    await repository.putList(list);
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await repository.listLists())[0]?.id).toBe(list.id);
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'save-slot-library-cache',
      }),
    );
  });
});
