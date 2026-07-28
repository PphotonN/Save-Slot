import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { isPortFree, probeService, waitForService } from '../scripts/service-probe.mjs';

async function closeServer(server) {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function withJsonServer(payload, callback) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(`${JSON.stringify(payload)}\n`);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP server address.');

  try {
    await callback({
      port: address.port,
      url: `http://127.0.0.1:${address.port}/health`,
    });
  } finally {
    await closeServer(server);
  }
}

test('accepts a matching service and project root', async () => {
  await withJsonServer(
    { service: 'save-slot-library-cache', projectRoot: process.cwd(), status: 'ok' },
    async ({ url }) => {
      const result = await probeService({
        url,
        expectedService: 'save-slot-library-cache',
        expectedProjectRoot: process.cwd(),
      });
      assert.equal(result.state, 'ready');
    },
  );
});

test('rejects a wrong service or another project folder', async () => {
  await withJsonServer(
    { service: 'another-service', projectRoot: process.cwd() },
    async ({ url }) => {
      const result = await probeService({ url, expectedService: 'save-slot-web' });
      assert.equal(result.state, 'mismatch');
    },
  );

  await withJsonServer(
    { service: 'save-slot-library-cache', projectRoot: `${process.cwd()}-other` },
    async ({ url }) => {
      const result = await probeService({
        url,
        expectedService: 'save-slot-library-cache',
        expectedProjectRoot: process.cwd(),
      });
      assert.equal(result.state, 'mismatch');
    },
  );
});

test('waits until an unavailable service starts', async () => {
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const address = reservation.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP server address.');
  const port = address.port;
  await closeServer(reservation);

  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ service: 'save-slot-api', status: 'ok' }));
  });

  const startPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    }, 150);
  });

  try {
    const result = await waitForService({
      url: `http://127.0.0.1:${port}/health`,
      expectedService: 'save-slot-api',
      timeoutMs: 2_000,
      intervalMs: 50,
    });
    await startPromise;
    assert.equal(result.state, 'ready');
  } finally {
    if (server.listening) await closeServer(server);
  }
});

test('detects free and occupied ports', async () => {
  const server = createServer((_request, response) => response.end('ok'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP server address.');

  try {
    assert.equal(await isPortFree({ host: '127.0.0.1', port: address.port }), false);
  } finally {
    await closeServer(server);
  }

  assert.equal(await isPortFree({ host: '127.0.0.1', port: address.port }), true);
});
