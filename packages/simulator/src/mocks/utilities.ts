import { randomUUID } from 'node:crypto';

/**
 * Mock implementations for miscellaneous GAS globals:
 * Logger, Session, Utilities, MailApp, HtmlService
 */

export function createLoggerMock() {
  const logs: string[] = [];

  return {
    log(msg: string): void {
      logs.push(msg);
      console.log(`[GAS Logger] ${msg}`);
    },
    /** Simulator-only: retrieve captured logs */
    _getLogs(): string[] {
      return [...logs];
    },
    /** Simulator-only: clear captured logs */
    _clearLogs(): void {
      logs.length = 0;
    },
  };
}

export function createSessionMock(email = 'dev@localhost', timeZone = 'UTC') {
  return {
    getActiveUser() {
      return {
        getEmail() {
          return email;
        },
      };
    },
    getScriptTimeZone() {
      return timeZone;
    },
  };
}

export function createUtilitiesMock() {
  return {
    getUuid(): string {
      return randomUUID();
    },

    base64Encode(data: string | number[]): string {
      if (typeof data === 'string') {
        return Buffer.from(data, 'utf-8').toString('base64');
      }
      return Buffer.from(data).toString('base64');
    },

    base64Decode(data: string): number[] {
      return [...Buffer.from(data, 'base64')];
    },

    formatDate(date: Date, timeZone: string, format: string): string {
      // Simple formatter covering common patterns: yyyy-MM-dd HH:mm:ss
      const opts: Intl.DateTimeFormatOptions = {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(date);
      const map: Record<string, string> = {};
      for (const p of parts) {
        map[p.type] = p.value;
      }

      return format
        .replace('yyyy', map.year ?? '')
        .replace('MM', map.month ?? '')
        .replace('dd', map.day ?? '')
        .replace('HH', map.hour ?? '')
        .replace('mm', map.minute ?? '')
        .replace('ss', map.second ?? '');
    },
  };
}

export function createMailAppMock() {
  const sent: Array<{ recipient: string; subject: string; body: string; options?: unknown }> = [];

  return {
    sendEmail(recipient: string, subject: string, body: string, options?: { htmlBody?: string }): void {
      sent.push({ recipient, subject, body, options });
      console.log(`[GAS MailApp] → ${recipient}: "${subject}"`);
    },
    /** Simulator-only: retrieve sent mails for assertions */
    _getSentEmails() {
      return [...sent];
    },
  };
}

export function createHtmlServiceMock() {
  function createOutput(content: string) {
    let title = '';
    const meta: Array<{ name: string; content: string }> = [];

    const output = {
      getContent() {
        return content;
      },
      setTitle(t: string) {
        title = t;
        return output;
      },
      getTitle() {
        return title;
      },
      addMetaTag(name: string, c: string) {
        meta.push({ name, content: c });
        return output;
      },
      setXFrameOptionsMode(_mode: unknown) {
        return output;
      },
    };
    return output;
  }

  return {
    createTemplateFromFile(_filename: string) {
      return {
        evaluate() {
          return createOutput(`<!-- template: ${_filename} -->`);
        },
      };
    },

    createHtmlOutput(html: string) {
      return createOutput(html);
    },

    createHtmlOutputFromFile(filename: string) {
      return createOutput(`<!-- file: ${filename} -->`);
    },

    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
  };
}
