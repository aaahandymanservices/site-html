/*
 * Reading configuration, in whichever runtime the function landed in.
 *
 * Netlify Functions expose `Netlify.env`, but the same files run under plain
 * Node during local tooling, where only `process.env` exists. Both lookups are
 * wrapped because referencing an undeclared global throws rather than reporting
 * undefined, and a missing variable is a normal state here -- every caller has
 * a defined behaviour for the empty string.
 */
export const getEnv = (name: string): string => {
  try {
    if (typeof Netlify !== "undefined" && Netlify.env) {
      return Netlify.env.get(name) ?? "";
    }
  } catch {}
  try {
    const globalProcess = (globalThis as any).process;
    if (globalProcess && globalProcess.env) {
      return globalProcess.env[name] ?? "";
    }
  } catch {}
  return "";
};
