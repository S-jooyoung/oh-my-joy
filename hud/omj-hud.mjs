#!/usr/bin/env node
// OMJ HUD loader — statusLine protocol: stdin JSON in, one rendered line out.
// The HUD implementation is a self-contained esbuild bundle vendored from
// oh-my-claudecode (MIT, © 2025 Yeachan Heo) at vendor/hud/index.js, which
// runs main() on import. See NOTICE.md for attribution.
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  await import(pathToFileURL(join(__dirname, "vendor", "hud", "index.js")).href);
} catch (error) {
  // Fall back to a visible one-liner so the statusline never goes blank.
  console.log("[OMJ] HUD error - check stderr");
  console.error("[OMJ HUD Error]", error instanceof Error ? error.message : error);
}
