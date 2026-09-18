// Bundles netlify/function-src/api.mts (the Express app included) into ONE
// self-contained file, netlify/functions/api.mjs. Netlify does not bundle
// modern ES-module functions itself and cannot see the pnpm-workspace
// dependencies, so without this step the function fails with
// "Cannot find package 'express'".
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

await build({
  entryPoints: [path.resolve(root, "netlify/function-src/api.mts")],
  outfile: path.resolve(root, "netlify/functions/api.mjs"),
  platform: "node",
  format: "esm",
  bundle: true,
  target: "node22",
  logLevel: "info",
  external: ["pg-native", "*.node"],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  // Lets CommonJS-only dependencies (express, pg, ...) run inside the ESM bundle.
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);`,
  },
});
