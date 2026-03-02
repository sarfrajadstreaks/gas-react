import { describe, it, expect } from 'vitest';
import { initApp } from '../src/server/init/index';

// ── Mock HtmlService ─────────────────────────────────────────────────
function createMockHtmlOutput(content: string) {
  const meta: Array<{ name: string; content: string }> = [];
  let title = '';
  let xframeMode: unknown = null;

  return {
    getContent: () => content,
    setTitle: (t: string) => {
      title = t;
      return createMockHtmlOutput(content);
    },
    addMetaTag: (name: string, c: string) => {
      meta.push({ name, content: c });
      const out = createMockHtmlOutput(content);
      out._meta = meta;
      out._title = title;
      out._xframe = xframeMode;
      return out;
    },
    setXFrameOptionsMode: (mode: unknown) => {
      xframeMode = mode;
      const out = createMockHtmlOutput(content);
      out._meta = meta;
      out._title = title;
      out._xframe = xframeMode;
      return out;
    },
    _meta: meta,
    _title: title,
    _xframe: xframeMode,
  };
}

(globalThis as Record<string, unknown>).HtmlService = {
  createHtmlOutputFromFile: (filename: string) => createMockHtmlOutput(`<html>${filename}</html>`),
  createHtmlOutput: (html: string) => createMockHtmlOutput(html),
  XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
};

// ── Tests ────────────────────────────────────────────────────────────
describe('initApp', () => {
  it('returns an object with doGet method', () => {
    const app = initApp({ title: 'Test App' });
    expect(app.doGet).toBeTypeOf('function');
  });

  it('doGet returns an HtmlOutput', () => {
    const app = initApp({ title: 'Test App' });
    const output = app.doGet();
    expect(output).toBeDefined();
    expect(output.getContent).toBeTypeOf('function');
  });

  it('uses default htmlEntry "index"', () => {
    const app = initApp({ title: 'Test App' });
    const output = app.doGet();
    expect(output.getContent()).toContain('index');
  });

  it('accepts custom htmlEntry', () => {
    const app = initApp({ title: 'Test', htmlEntry: 'dashboard' });
    const output = app.doGet();
    expect(output.getContent()).toContain('dashboard');
  });

  it('returns error HTML on exception', () => {
    // Override to throw
    const g = globalThis as unknown as Record<string, Record<string, unknown>>;
    const originalFn = g.HtmlService.createHtmlOutputFromFile;
    g.HtmlService.createHtmlOutputFromFile = () => {
      throw new Error('File not found');
    };

    const app = initApp({ title: 'Test' });
    const output = app.doGet();
    expect(output.getContent()).toContain('Error');

    // Restore
    g.HtmlService.createHtmlOutputFromFile = originalFn;
  });
});
