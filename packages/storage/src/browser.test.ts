import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCollectionRepository, createDefaultList } from './browser';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('project file mirrored repository', () => {
  it('restores through the cache endpoint and mirrors collection changes', async () => {
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

    vi.stubGlobal('window', { dispatchEvent });
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
});
