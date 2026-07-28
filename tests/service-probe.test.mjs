import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { isPortFree, probeService, waitForService } from '../scripts/service-probe.mjs';

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
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
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

test('waits until a delayed service becomes ready', async () => {
  let ready = false;
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ service: ready ? 'save-slot-api' : 'starting' }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP server address.');
  setTimeout(() => {
    ready = true;
  }, 120);

  try {
    const result = await waitForService({
      url: `http://127.0.0.1:${address.port}/health`,
      expectedService: 'save-slot-api',
      timeoutMs: 2_000,
      intervalMs: 50,
    });
    assert.equal(result.state, 'mismatch');
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
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
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  assert.equal(await isPortFree({ host: '127.0.0.1', port: address.port }), true);
});
