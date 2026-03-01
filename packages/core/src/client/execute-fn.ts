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

export type ExecutionMode = 'direct' | 'library';

export interface ExecutionConfig {
  mode: ExecutionMode;
}

let currentConfig: ExecutionConfig = { mode: 'direct' };

export function configureExecution(config: Partial<ExecutionConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

export function getExecutionMode(): ExecutionMode {
  return currentConfig.mode;
}

export function executeFn<T = unknown>(funcName: string, args: unknown[] = []): Promise<T> {
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

  return new Promise<T>((resolve, reject) => {
    const runner = google.script.run
      .withSuccessHandler((result: unknown) => resolve(result as T))
      .withFailureHandler((error: Error) => reject(error));

    if (currentConfig.mode === 'library') {
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
      const fn = runner[funcName];
      if (typeof fn !== 'function') {
        reject(new Error(`Server function '${funcName}' not found`));
        return;
      }
      (fn as (...a: unknown[]) => void).apply(runner, args);
    }
  });
}
