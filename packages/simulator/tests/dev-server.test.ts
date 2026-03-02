import { describe, it, expect, afterEach } from 'vitest';
import { createDevServer } from '../src/dev-server';
import type { Server } from 'node:http';

let server: Server | null = null;

function getPort(): number {
  // Use a random high port to avoid conflicts
  return 30000 + Math.floor(Math.random() * 10000);
}

afterEach(() => {
  return new Promise<void>((resolve) => {
    if (server) {
      server.close(() => resolve());
      server = null;
    } else {
      resolve();
    }
  });
});

describe('Dev server', () => {
  it('responds to registered function calls', async () => {
    const port = getPort();
    server = createDevServer({
      port,
      functions: {
        getUsers: () => [{ id: '1', name: 'Alice' }],
      },
      verbose: false,
    });

    // Wait for server to start
    await new Promise((r) => setTimeout(r, 100));

    const res = await fetch(`http://localhost:${port}/api/getUsers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [] }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual([{ id: '1', name: 'Alice' }]);
  });

  it('passes args to the function', async () => {
    const port = getPort();
    server = createDevServer({
      port,
      functions: {
        add: (a: unknown, b: unknown) => (a as number) + (b as number),
      },
      verbose: false,
    });

    await new Promise((r) => setTimeout(r, 100));

    const res = await fetch(`http://localhost:${port}/api/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [2, 3] }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toBe(5);
  });

  it('returns 404 for unregistered function', async () => {
    const port = getPort();
    server = createDevServer({
      port,
      functions: {},
      verbose: false,
    });

    await new Promise((r) => setTimeout(r, 100));

    const res = await fetch(`http://localhost:${port}/api/unknown`, {
      method: 'POST',
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('unknown');
  });

  it('returns 404 for non-api paths', async () => {
    const port = getPort();
    server = createDevServer({
      port,
      functions: {},
      verbose: false,
    });

    await new Promise((r) => setTimeout(r, 100));

    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(404);
  });

  it('handles function errors with 500', async () => {
    const port = getPort();
    server = createDevServer({
      port,
      functions: {
        fail: () => {
          throw new Error('Oops!');
        },
      },
      verbose: false,
    });

    await new Promise((r) => setTimeout(r, 100));

    const res = await fetch(`http://localhost:${port}/api/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [] }),
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Oops!');
  });

  it('handles CORS preflight', async () => {
    const port = getPort();
    server = createDevServer({
      port,
      functions: {},
      verbose: false,
    });

    await new Promise((r) => setTimeout(r, 100));

    const res = await fetch(`http://localhost:${port}/api/test`, {
      method: 'OPTIONS',
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('supports async functions', async () => {
    const port = getPort();
    server = createDevServer({
      port,
      functions: {
        asyncFn: async () => {
          await new Promise((r) => setTimeout(r, 10));
          return { async: true };
        },
      },
      verbose: false,
    });

    await new Promise((r) => setTimeout(r, 100));

    const res = await fetch(`http://localhost:${port}/api/asyncFn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: [] }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ async: true });
  });
});
