/**
 * Library Proxy — For GAS Library deployment mode.
 *
 * USE THIS WHEN:
 * Your app is deployed as a GAS **Library** (not bundled via npm).
 * Another GAS project imports the library and serves the web app.
 * In this model, the client HTML lives inside the library, but
 * `google.script.run` can only call functions defined in the
 * **consumer** script, not in the library. So the consumer defines
 * a single `runLibraryFunction` that delegates to the library's proxy.
 *
 * HOW IT WORKS:
 *
 *   Client  ──google.script.run.runLibraryFunction(name, args)──►  Consumer Script
 *   Consumer Script  ──MyLib.runLibraryFunction(name, args)──►      Library Proxy
 *   Library Proxy  ──dispatches to registered function──►           Your Code
 *
 * EXAMPLE — Library side (your project):
 *
 *   const proxy = createLibraryProxy({
 *     getOrders:  (token) => { ... },
 *     createOrder: (data, token) => { ... },
 *   });
 *   export const runLibraryFunction = proxy.runLibraryFunction;
 *   export const doGet = engine.doGet;
 *
 * EXAMPLE — Consumer side (the GAS project that imports your library):
 *
 *   // Code.gs
 *   function doGet(e) {
 *     return MyLib.doGet(e);
 *   }
 *   function runLibraryFunction(funcName, args) {
 *     return MyLib.runLibraryFunction(funcName, args);
 *   }
 *
 * DEFAULT MODE:
 * If you're building with npm + esbuild (the default framework workflow),
 * you don't need this. `export function` in your server/index.ts becomes
 * a GAS global, callable directly via `google.script.run.functionName()`.
 */

export interface LibraryProxy {
  /**
   * RPC dispatcher — receives a function name and args array,
   * looks up the function, calls it, returns the result.
   *
   * GAS handles serialisation of the args array and return value
   * across the google.script.run boundary — no JSON needed.
   */
  runLibraryFunction(funcName: string, args?: unknown[]): unknown;
}

/**
 * Create a library proxy that dispatches calls to registered functions.
 *
 * @param functions - Map of function name → implementation.
 *                    Every server function the client needs to call
 *                    must be registered here.
 */
export function createLibraryProxy(
  functions: Record<string, (...args: unknown[]) => unknown>
): LibraryProxy {
  return {
    runLibraryFunction(funcName: string, args: unknown[] = []): unknown {
      const fn = functions[funcName];
      if (typeof fn !== 'function') {
        throw new Error(
          `Library function '${funcName}' not found. ` +
          `Registered functions: ${Object.keys(functions).join(', ')}`
        );
      }
      return fn(...args);
    },
  };
}
