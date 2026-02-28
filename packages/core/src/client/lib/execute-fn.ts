/**
 * executeFn — Bridge between React and GAS server.
 *
 * Supports two execution modes:
 *
 * **Direct mode (default)** — npm-bundled apps
 *   esbuild bundles server code into Code.js with top-level globals.
 *   Every `export function` is directly callable via `google.script.run.functionName()`.
 *
 * **Library mode** — GAS Library apps (like hotel-booking-library)
 *   The app is deployed as a GAS Library. The consumer script defines a
 *   `runLibraryFunction(funcName, args)` that delegates to the library.
 *   All calls are funneled through that single dispatcher.
 *
 * In dev mode (both), calls a local mock server via HTTP.
 *
 * Call `configureExecution({ mode: 'library' })` once at app init to switch modes.
 */

// Declare the GAS client-side API
declare const google: {
  script: {
    run: {
      withSuccessHandler(fn: (result: unknown) => void): typeof google.script.run;
      withFailureHandler(fn: (error: Error) => void): typeof google.script.run;
      [key: string]: unknown;
    };
  };
};

declare global {
  interface Window {
    __GAS_DEV_MODE__?: boolean;
    __GAS_DEV_SERVER__?: string;
  }
}

// ─── Execution Mode Configuration ────────────────────────────────────────────

export type ExecutionMode = 'direct' | 'library';

export interface ExecutionConfig {
  /** 'direct' (default) = call GAS globals directly.
   *  'library' = route all calls through runLibraryFunction. */
  mode: ExecutionMode;
}

let currentConfig: ExecutionConfig = { mode: 'direct' };

/**
 * Configure how executeFn communicates with the GAS server.
 *
 * Call once at app startup, before any server calls.
 *
 * @example
 * // For npm-bundled apps (default — no need to call)
 * configureExecution({ mode: 'direct' });
 *
 * @example
 * // For GAS Library apps
 * configureExecution({ mode: 'library' });
 */
export function configureExecution(config: Partial<ExecutionConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/** Get the current execution mode. */
export function getExecutionMode(): ExecutionMode {
  return currentConfig.mode;
}

// ─── Main Bridge ─────────────────────────────────────────────────────────────

export function executeFn<T = unknown>(funcName: string, args: unknown[] = []): Promise<T> {
  // Dev mode — call local mock server
  if (typeof window !== 'undefined' && window.__GAS_DEV_MODE__) {
    const devServer = window.__GAS_DEV_SERVER__ ?? 'http://localhost:3001';
    return fetch(`${devServer}/api/${funcName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args }),
    }).then((res) => {
      if (!res.ok) throw new Error(`${funcName} failed: ${res.statusText}`);
      return res.json() as Promise<T>;
    });
  }

  // Production — call via google.script.run
  return new Promise<T>((resolve, reject) => {
    const runner = google.script.run
      .withSuccessHandler((result: unknown) => resolve(result as T))
      .withFailureHandler((error: Error) => reject(error));

    if (currentConfig.mode === 'library') {
      // Library mode — funnel through runLibraryFunction(name, args)
      const proxyFn = runner.runLibraryFunction;
      if (typeof proxyFn !== 'function') {
        reject(new Error(
          'Library mode: runLibraryFunction not found on google.script.run. ' +
          'Make sure the consumer script defines: ' +
          'function runLibraryFunction(funcName, args) { return MyLib.runLibraryFunction(funcName, args); }'
        ));
        return;
      }
      (proxyFn as (...a: unknown[]) => void).call(runner, funcName, args);
    } else {
      // Direct mode — each GAS global is a method on google.script.run
      const fn = runner[funcName];
      if (typeof fn !== 'function') {
        reject(new Error(`Server function '${funcName}' not found`));
        return;
      }
      (fn as (...a: unknown[]) => void).apply(runner, args);
    }
  });
}
