import { describe, it, expect, afterEach } from 'vitest';

describe('index exports', () => {
  it('exports GASWebpackPlugin', async () => {
    const mod = await import('../src/index');
    expect(mod.GASWebpackPlugin).toBeDefined();
    expect(typeof mod.GASWebpackPlugin).toBe('function');
  });

  it('exports isLocalDev', async () => {
    const mod = await import('../src/index');
    expect(typeof mod.isLocalDev).toBe('function');
  });

  it('exports createGASWebpackConfig', async () => {
    const mod = await import('../src/index');
    expect(typeof mod.createGASWebpackConfig).toBe('function');
  });
});

describe('isLocalDev', () => {
  const originalEnv = process.env.GAS_LOCAL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GAS_LOCAL;
    } else {
      process.env.GAS_LOCAL = originalEnv;
    }
  });

  it('returns false when GAS_LOCAL is not set', async () => {
    delete process.env.GAS_LOCAL;
    const { isLocalDev } = await import('../src/index');
    expect(isLocalDev()).toBe(false);
  });

  it('returns true when GAS_LOCAL is "true"', async () => {
    process.env.GAS_LOCAL = 'true';
    const { isLocalDev } = await import('../src/index');
    expect(isLocalDev()).toBe(true);
  });

  it('returns false when GAS_LOCAL is "false"', async () => {
    process.env.GAS_LOCAL = 'false';
    const { isLocalDev } = await import('../src/index');
    expect(isLocalDev()).toBe(false);
  });
});

