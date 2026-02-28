/**
 * executeFn — Bridge between React and GAS server.
 *
 * In production, calls google.script.run.runLibraryFunction().
 * In dev mode, calls a local mock server via HTTP.
 */

// Declare the GAS client-side API
declare const google: {
  script: {
    run: {
      withSuccessHandler(fn: (result: unknown) => void): typeof google.script.run;
      withFailureHandler(fn: (error: Error) => void): typeof google.script.run;
      runLibraryFunction(funcName: string, args: unknown[]): void;
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

  // Production — call GAS via google.script.run
  return new Promise<T>((resolve, reject) => {
    google.script.run
      .withSuccessHandler((result: unknown) => resolve(result as T))
      .withFailureHandler((error: Error) => reject(error))
      .runLibraryFunction(funcName, args);
  });
}
