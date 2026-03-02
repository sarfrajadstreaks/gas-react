import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeFn, configureExecution, getExecutionMode } from '../src/client/execute-fn';

// ── Helpers ──────────────────────────────────────────────────────────
function mockGoogleScriptRun(serverFns: Record<string, (...args: unknown[]) => unknown>) {
  let successHandler: ((r: unknown) => void) | null = null;
  let failureHandler: ((e: Error) => void) | null = null;

  const runner: Record<string, unknown> = {
    withSuccessHandler(fn: (r: unknown) => void) {
      successHandler = fn;
      return runner;
    },
    withFailureHandler(fn: (e: Error) => void) {
      failureHandler = fn;
      return runner;
    },
  };

  for (const [name, impl] of Object.entries(serverFns)) {
    runner[name] = (...args: unknown[]) => {
      try {
        const result = impl(...args);
        successHandler?.(result);
      } catch (err) {
        failureHandler?.(err as Error);
      }
    };
  }

  (globalThis as Record<string, unknown>).google = { script: { run: runner } };
}

function clearGoogleGlobal() {
  delete (globalThis as Record<string, unknown>).google;
}

// ── Tests ────────────────────────────────────────────────────────────
describe('configureExecution / getExecutionMode', () => {
  beforeEach(() => {
    configureExecution({ mode: 'direct' });
  });

  it('defaults to direct mode', () => {
    expect(getExecutionMode()).toBe('direct');
  });

  it('switches to library mode', () => {
    configureExecution({ mode: 'library' });
    expect(getExecutionMode()).toBe('library');
  });
});

describe('executeFn — direct mode', () => {
  beforeEach(() => {
    configureExecution({ mode: 'direct' });
    // Ensure dev mode is off
    (globalThis as Record<string, unknown>).window = {};
  });

  afterEach(() => {
    clearGoogleGlobal();
    delete (globalThis as Record<string, unknown>).window;
  });

  it('calls the named server function and resolves', async () => {
    mockGoogleScriptRun({
      getUsers: () => [{ id: '1', name: 'Alice' }],
    });

    const result = await executeFn('getUsers');
    expect(result).toEqual([{ id: '1', name: 'Alice' }]);
  });

  it('passes arguments to the server function', async () => {
    const spy = vi.fn((...args: unknown[]) => ({ found: true, query: args[0] }));
    mockGoogleScriptRun({ findUser: spy });

    const result = await executeFn('findUser', ['abc']);
    expect(spy).toHaveBeenCalledWith('abc');
    expect(result).toEqual({ found: true, query: 'abc' });
  });

  it('rejects when server function is not found', async () => {
    mockGoogleScriptRun({});

    await expect(executeFn('nonExistent')).rejects.toThrow(
      "Server function 'nonExistent' not found",
    );
  });

  it('rejects when server function throws', async () => {
    mockGoogleScriptRun({
      failing: () => {
        throw new Error('Sheet not found');
      },
    });

    await expect(executeFn('failing')).rejects.toThrow('Sheet not found');
  });
});

describe('executeFn — library mode', () => {
  beforeEach(() => {
    configureExecution({ mode: 'library' });
    (globalThis as Record<string, unknown>).window = {};
  });

  afterEach(() => {
    clearGoogleGlobal();
    configureExecution({ mode: 'direct' });
    delete (globalThis as Record<string, unknown>).window;
  });

  it('routes through runLibraryFunction', async () => {
    const spy = vi.fn((...params: unknown[]) => ({
      routed: true,
      fn: params[0],
      args: params[1],
    }));
    mockGoogleScriptRun({ runLibraryFunction: spy });

    const result = await executeFn('getUsers', []);
    expect(spy).toHaveBeenCalledWith('getUsers', []);
    expect(result).toEqual({ routed: true, fn: 'getUsers', args: [] });
  });

  it('rejects when runLibraryFunction is missing', async () => {
    mockGoogleScriptRun({});

    await expect(executeFn('getUsers')).rejects.toThrow(
      'Library mode: runLibraryFunction not found',
    );
  });
});

describe('executeFn — dev mode', () => {
  beforeEach(() => {
    configureExecution({ mode: 'direct' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).window;
  });

  it('sends POST to dev server when __GAS_DEV_MODE__ is true', async () => {
    (globalThis as Record<string, unknown>).window = {
      __GAS_DEV_MODE__: true,
      __GAS_DEV_SERVER__: 'http://localhost:4000',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1' }]),
    });
    (globalThis as Record<string, unknown>).fetch = mockFetch;

    const result = await executeFn('getUsers', ['arg1']);

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/api/getUsers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: ['arg1'] }),
    });
    expect(result).toEqual([{ id: '1' }]);

    delete (globalThis as Record<string, unknown>).fetch;
  });

  it('defaults dev server to localhost:3001', async () => {
    (globalThis as Record<string, unknown>).window = {
      __GAS_DEV_MODE__: true,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve('ok'),
    });
    (globalThis as Record<string, unknown>).fetch = mockFetch;

    await executeFn('ping');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/ping',
      expect.any(Object),
    );

    delete (globalThis as Record<string, unknown>).fetch;
  });

  it('rejects when dev server responds with error', async () => {
    (globalThis as Record<string, unknown>).window = {
      __GAS_DEV_MODE__: true,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
    });
    (globalThis as Record<string, unknown>).fetch = mockFetch;

    await expect(executeFn('broken')).rejects.toThrow(
      'broken failed: Internal Server Error',
    );

    delete (globalThis as Record<string, unknown>).fetch;
  });
});
