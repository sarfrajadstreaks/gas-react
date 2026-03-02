import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';

export interface DevServerOptions {
  /** Port to listen on (default: 3001) */
  port?: number;
  /** Map of function name → implementation */
  functions: Record<string, (...args: unknown[]) => unknown>;
  /** Enable CORS for all origins (default: true) */
  cors?: boolean;
  /** Log requests to console (default: true) */
  verbose?: boolean;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function createDevServer(options: DevServerOptions): Server {
  const {
    port = 3001,
    functions,
    cors = true,
    verbose = true,
  } = options;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (cors) setCorsHeaders(res);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const match = url.pathname.match(/^\/api\/(.+)$/);

    if (!match) {
      jsonResponse(res, 404, { error: `Not found: ${url.pathname}` });
      return;
    }

    const funcName = match[1];
    const fn = functions[funcName];

    if (!fn) {
      jsonResponse(res, 404, {
        error: `Function '${funcName}' not registered`,
        available: Object.keys(functions),
      });
      return;
    }

    try {
      let args: unknown[] = [];

      if (req.method === 'POST') {
        const body = await readBody(req);
        if (body.trim()) {
          const parsed = JSON.parse(body) as { args?: unknown[] };
          args = parsed.args ?? [];
        }
      }

      if (verbose) {
        console.log(`[lite-gas-simulator] ${req.method} /api/${funcName}`, args.length ? args : '');
      }

      const result = await fn(...args);
      jsonResponse(res, 200, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (verbose) {
        console.error(`[lite-gas-simulator] Error in ${funcName}:`, message);
      }
      jsonResponse(res, 500, { error: message });
    }
  });

  server.listen(port, () => {
    if (verbose) {
      console.log(`[lite-gas-simulator] Dev server running at http://localhost:${port}`);
      console.log(`[lite-gas-simulator] Registered functions: ${Object.keys(functions).join(', ')}`);
    }
  });

  return server;
}
