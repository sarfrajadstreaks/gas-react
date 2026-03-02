import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isLocalDev, createGASViteConfig } from '../src/index';

describe('isLocalDev', () => {
  const originalEnv = process.env.GAS_LOCAL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GAS_LOCAL = originalEnv;
    } else {
      delete process.env.GAS_LOCAL;
    }
  });

  it('returns false when GAS_LOCAL is not set', () => {
    delete process.env.GAS_LOCAL;
    expect(isLocalDev()).toBe(false);
  });

  it('returns false when GAS_LOCAL is "false"', () => {
    process.env.GAS_LOCAL = 'false';
    expect(isLocalDev()).toBe(false);
  });

  it('returns true when GAS_LOCAL is "true"', () => {
    process.env.GAS_LOCAL = 'true';
    expect(isLocalDev()).toBe(true);
  });
});

describe('createGASViteConfig', () => {
  beforeEach(() => {
    delete process.env.GAS_LOCAL;
  });

  it('returns a config object with default values', async () => {
    const config = await createGASViteConfig();
    expect(config.root).toBe('src/client');
    expect(config.build).toBeDefined();
    expect((config.build as Record<string, unknown>).emptyOutDir).toBe(true);
    expect(config.resolve).toBeDefined();
  });

  it('uses custom clientRoot', async () => {
    const config = await createGASViteConfig({ clientRoot: 'src' });
    expect(config.root).toBe('src');
  });

  it('sets up @ alias pointing to src/', async () => {
    const config = await createGASViteConfig();
    const resolve = config.resolve as Record<string, unknown>;
    const alias = resolve.alias as Record<string, string>;
    expect(alias['@']).toContain('src');
  });

  it('merges custom aliases', async () => {
    const config = await createGASViteConfig({
      aliases: { '~': 'lib' },
    });
    const resolve = config.resolve as Record<string, unknown>;
    const alias = resolve.alias as Record<string, string>;
    expect(alias['~']).toBeDefined();
    expect(alias['@']).toBeDefined();
  });

  it('includes gas plugin in production mode', async () => {
    delete process.env.GAS_LOCAL;
    const config = await createGASViteConfig();
    const plugins = config.plugins as { name?: string }[];
    const gasPlugin = plugins.find(p => p && typeof p === 'object' && 'name' in p && p.name === 'vite-plugin-gas');
    expect(gasPlugin).toBeDefined();
  });

  it('excludes gas plugin in local dev mode', async () => {
    process.env.GAS_LOCAL = 'true';
    const config = await createGASViteConfig();
    const plugins = config.plugins as { name?: string }[];
    const gasPlugin = plugins.find(p => p && typeof p === 'object' && 'name' in p && p.name === 'vite-plugin-gas');
    expect(gasPlugin).toBeUndefined();
  });

  it('sets dev mode defines when GAS_LOCAL is true', async () => {
    process.env.GAS_LOCAL = 'true';
    const config = await createGASViteConfig({ devServerPort: 4000 });
    expect(config.define).toBeDefined();
    const define = config.define as Record<string, string>;
    expect(define['window.__GAS_DEV_MODE__']).toBe('true');
    expect(define['window.__GAS_DEV_SERVER__']).toContain('4000');
  });

  it('sets server config in local dev mode', async () => {
    process.env.GAS_LOCAL = 'true';
    const config = await createGASViteConfig({ devPort: 8080 });
    const server = config.server as Record<string, unknown>;
    expect(server.port).toBe(8080);
    expect(server.open).toBe(true);
  });

  it('applies vite overrides', async () => {
    const config = await createGASViteConfig({
      vite: { css: { modules: { localsConvention: 'camelCase' } } },
    });
    expect((config as Record<string, unknown>).css).toBeDefined();
  });

  it('deep merges object overrides into existing config keys', async () => {
    const config = await createGASViteConfig({
      vite: { build: { minify: false } },
    });
    const build = config.build as Record<string, unknown>;
    expect(build.minify).toBe(false);
    expect(build.emptyOutDir).toBe(true);
  });
});
