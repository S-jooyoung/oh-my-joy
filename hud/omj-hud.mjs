#!/usr/bin/env node
// OMJ HUD loader — statusLine protocol: stdin JSON in, one rendered line out.
// The HUD implementation is a self-contained esbuild bundle vendored from
// oh-my-claudecode (MIT, © 2025 Yeachan Heo) at vendor/hud/index.js, which
// runs main() on import. See NOTICE.md for attribution.
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function shortHudLoadError(error) {
  const message = typeof error?.message === "string" ? error.message : String(error);
  const compactMessage = message.replace(/\s+/g, " ").trim();
  if (!compactMessage) return "unknown error";
  return compactMessage.length > 100 ? `${compactMessage.slice(0, 97)}...` : compactMessage;
}

try {
  await import(pathToFileURL(join(__dirname, "vendor", "hud", "index.js")).href);
} catch (error) {
  // The status line names the cause, since the cache wrapper keeps stderr out of sight.
  console.log(`[OMJ HUD] HUD failed to load: ${shortHudLoadError(error)}`);
  console.error("[OMJ HUD Error]", error instanceof Error ? error.message : error);
}
