import { describe, it, expect } from 'vitest';
import {
  createLoggerMock,
  createSessionMock,
  createUtilitiesMock,
  createMailAppMock,
  createHtmlServiceMock,
} from '../src/mocks/utilities';

describe('Logger mock', () => {
  it('captures log messages', () => {
    const logger = createLoggerMock();
    logger.log('hello');
    logger.log('world');
    expect(logger._getLogs()).toEqual(['hello', 'world']);
  });

  it('clearLogs resets', () => {
    const logger = createLoggerMock();
    logger.log('test');
    logger._clearLogs();
    expect(logger._getLogs()).toEqual([]);
  });
});

describe('Session mock', () => {
  it('returns configured email', () => {
    const session = createSessionMock('user@example.com');
    expect(session.getActiveUser().getEmail()).toBe('user@example.com');
  });

  it('returns default email', () => {
    const session = createSessionMock();
    expect(session.getActiveUser().getEmail()).toBe('dev@localhost');
  });

  it('returns configured timezone', () => {
    const session = createSessionMock(undefined, 'America/New_York');
    expect(session.getScriptTimeZone()).toBe('America/New_York');
  });
});

describe('Utilities mock', () => {
  it('getUuid returns unique UUIDs', () => {
    const utils = createUtilitiesMock();
    const a = utils.getUuid();
    const b = utils.getUuid();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('base64Encode/Decode round-trips strings', () => {
    const utils = createUtilitiesMock();
    const encoded = utils.base64Encode('Hello, World!');
    const decoded = utils.base64Decode(encoded);
    const text = String.fromCharCode(...decoded);
    expect(text).toBe('Hello, World!');
  });

  it('formatDate produces correct output', () => {
    const utils = createUtilitiesMock();
    const date = new Date('2025-06-15T10:30:45Z');
    const result = utils.formatDate(date, 'UTC', 'yyyy-MM-dd HH:mm:ss');
    expect(result).toBe('2025-06-15 10:30:45');
  });
});

describe('MailApp mock', () => {
  it('captures sent emails', () => {
    const mail = createMailAppMock();
    mail.sendEmail('test@test.com', 'Subject', 'Body');
    const sent = mail._getSentEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0].recipient).toBe('test@test.com');
    expect(sent[0].subject).toBe('Subject');
  });
});

describe('HtmlService mock', () => {
  it('createHtmlOutput returns content', () => {
    const html = createHtmlServiceMock();
    const output = html.createHtmlOutput('<h1>Hi</h1>');
    expect(output.getContent()).toBe('<h1>Hi</h1>');
  });

  it('setTitle is chainable', () => {
    const html = createHtmlServiceMock();
    const output = html.createHtmlOutput('test').setTitle('My App');
    expect(output.getTitle()).toBe('My App');
  });

  it('createHtmlOutputFromFile returns placeholder', () => {
    const html = createHtmlServiceMock();
    const output = html.createHtmlOutputFromFile('index');
    expect(output.getContent()).toContain('index');
  });

  it('XFrameOptionsMode.ALLOWALL exists', () => {
    const html = createHtmlServiceMock();
    expect(html.XFrameOptionsMode.ALLOWALL).toBeDefined();
  });
});
