#!/usr/bin/env node

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/stdin.js
import { existsSync as existsSync2, readFileSync as readFileSync2, statSync, writeFileSync as writeFileSync2, mkdirSync as mkdirSync2 } from "fs";
import { dirname as dirname2, join as join3 } from "path";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/lib/worktree-paths.js
import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, readdirSync, writeFileSync, unlinkSync } from "fs";
import { homedir as homedir2, tmpdir } from "os";
import { resolve, normalize as normalize2, relative, sep as sep2, join as join2, isAbsolute, basename, dirname } from "path";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/utils/config-dir.js
import { join, normalize, parse, sep } from "path";
import { homedir } from "os";
function stripTrailingSep(p) {
  if (!p.endsWith(sep)) {
    return p;
  }
  return p === parse(p).root ? p : p.slice(0, -1);
}
function getClaudeConfigDir() {
  const home = homedir();
  const configured = process.env.CLAUDE_CONFIG_DIR?.trim();
  if (!configured) {
    return stripTrailingSep(normalize(join(home, ".claude")));
  }
  if (configured === "~") {
    return stripTrailingSep(normalize(home));
  }
  if (configured.startsWith("~/") || configured.startsWith("~\\")) {
    return stripTrailingSep(normalize(join(home, configured.slice(2))));
  }
  return stripTrailingSep(normalize(configured));
}
function getOmcConfigDir() {
  return join(getClaudeConfigDir(), ".omc");
}
function getUpdateCheckCachePath() {
  return join(getOmcConfigDir(), "update-check.json");
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/utils/encode-project-path.js
function encodeProjectPath(projectPath) {
  return projectPath.replace(/[^a-zA-Z0-9]/g, "-");
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/lib/worktree-paths.js
var WORKSPACE_MARKER = ".omc-workspace";
var OmcPaths = {
  ROOT: ".omc",
  STATE: ".omc/state",
  SESSIONS: ".omc/state/sessions",
  PLANS: ".omc/plans",
  RESEARCH: ".omc/research",
  NOTEPAD: ".omc/notepad.md",
  PROJECT_MEMORY: ".omc/project-memory.json",
  DRAFTS: ".omc/drafts",
  NOTEPADS: ".omc/notepads",
  LOGS: ".omc/logs",
  SCIENTIST: ".omc/scientist",
  AUTOPILOT: ".omc/autopilot",
  SKILLS: ".omc/skills",
  SHARED_MEMORY: ".omc/state/shared-memory",
  DEEPINIT_MANIFEST: ".omc/deepinit-manifest.json"
};
var MAX_WORKTREE_CACHE_SIZE = 8;
var worktreeCacheMap = /* @__PURE__ */ new Map();
var toplevelCacheMap = /* @__PURE__ */ new Map();
var superprojectCacheMap = /* @__PURE__ */ new Map();
var workspaceCacheMap = /* @__PURE__ */ new Map();
function findWorkspaceRoot(startDir) {
  if (process.env.OMC_DISABLE_MULTIREPO === "1")
    return null;
  const effectiveStart = startDir || process.cwd();
  let current;
  try {
    current = resolve(effectiveStart);
  } catch {
    return null;
  }
  if (workspaceCacheMap.has(current)) {
    const cached = workspaceCacheMap.get(current) ?? null;
    workspaceCacheMap.delete(current);
    workspaceCacheMap.set(current, cached);
    return cached;
  }
  const home = (() => {
    try {
      return resolve(homedir2());
    } catch {
      return null;
    }
  })();
  let cursor = current;
  let result = null;
  while (true) {
    if (home && cursor === home)
      break;
    if (existsSync(join2(cursor, WORKSPACE_MARKER))) {
      result = cursor;
      break;
    }
    const parent = dirname(cursor);
    if (parent === cursor)
      break;
    cursor = parent;
  }
  if (workspaceCacheMap.size >= MAX_WORKTREE_CACHE_SIZE) {
    const oldest = workspaceCacheMap.keys().next().value;
    if (oldest !== void 0)
      workspaceCacheMap.delete(oldest);
  }
  workspaceCacheMap.set(current, result);
  return result;
}
function readWorkspaceMarkerConfig(workspaceRoot) {
  try {
    const raw = readFileSync(join2(workspaceRoot, WORKSPACE_MARKER), "utf-8").trim();
    if (!raw)
      return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}
function isDefinitiveNonGitError(error) {
  if (!error || typeof error !== "object")
    return false;
  const { status, stderr } = error;
  if (status !== 128)
    return false;
  const output = typeof stderr === "string" ? stderr : Buffer.isBuffer(stderr) ? stderr.toString() : "";
  return /not a git repository/i.test(output);
}
function resolveSuperprojectRoot(cwd) {
  const cacheKey = resolve(cwd);
  if (superprojectCacheMap.has(cacheKey)) {
    const cached = superprojectCacheMap.get(cacheKey) ?? null;
    superprojectCacheMap.delete(cacheKey);
    superprojectCacheMap.set(cacheKey, cached);
    return cached;
  }
  let anchor = null;
  let probeCwd = cacheKey;
  let completed = false;
  for (let depth = 0; depth < 32; depth++) {
    let superRoot;
    try {
      superRoot = execFileSync("git", ["rev-parse", "--show-superproject-working-tree"], {
        cwd: probeCwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        timeout: 5e3
      }).trim();
    } catch (error) {
      completed = depth === 0 && isDefinitiveNonGitError(error);
      break;
    }
    if (!superRoot) {
      completed = true;
      break;
    }
    anchor = superRoot;
    probeCwd = superRoot;
  }
  if (completed) {
    if (superprojectCacheMap.size >= MAX_WORKTREE_CACHE_SIZE) {
      const oldest = superprojectCacheMap.keys().next().value;
      if (oldest !== void 0)
        superprojectCacheMap.delete(oldest);
    }
    superprojectCacheMap.set(cacheKey, anchor);
  }
  return anchor;
}
function resolveStateAnchorRoot(worktreeRoot) {
  if (worktreeRoot)
    return resolveSuperprojectRoot(worktreeRoot) || worktreeRoot;
  return getWorktreeRoot() || process.cwd();
}
function getGitTopLevel(cwd) {
  const effectiveCwd = cwd || process.cwd();
  if (toplevelCacheMap.has(effectiveCwd)) {
    const root = toplevelCacheMap.get(effectiveCwd);
    toplevelCacheMap.delete(effectiveCwd);
    toplevelCacheMap.set(effectiveCwd, root);
    return root || null;
  }
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: effectiveCwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      timeout: 5e3
    }).trim();
    if (toplevelCacheMap.size >= MAX_WORKTREE_CACHE_SIZE) {
      const oldest = toplevelCacheMap.keys().next().value;
      if (oldest !== void 0)
        toplevelCacheMap.delete(oldest);
    }
    toplevelCacheMap.set(effectiveCwd, root);
    return root;
  } catch {
    return null;
  }
}
function getWorktreeRoot(cwd) {
  const effectiveCwd = cwd || process.cwd();
  if (worktreeCacheMap.has(effectiveCwd)) {
    const root2 = worktreeCacheMap.get(effectiveCwd);
    worktreeCacheMap.delete(effectiveCwd);
    worktreeCacheMap.set(effectiveCwd, root2);
    return root2 || null;
  }
  const root = resolveSuperprojectRoot(effectiveCwd) || getGitTopLevel(effectiveCwd);
  if (!root) {
    return null;
  }
  if (worktreeCacheMap.size >= MAX_WORKTREE_CACHE_SIZE) {
    const oldest = worktreeCacheMap.keys().next().value;
    if (oldest !== void 0) {
      worktreeCacheMap.delete(oldest);
    }
  }
  worktreeCacheMap.set(effectiveCwd, root);
  return root;
}
function validatePath(inputPath) {
  if (inputPath.includes("..")) {
    throw new Error(`Invalid path: path traversal not allowed (${inputPath})`);
  }
  if (inputPath.startsWith("~") || isAbsolute(inputPath)) {
    throw new Error(`Invalid path: absolute paths not allowed (${inputPath})`);
  }
}
var dualDirWarnings = /* @__PURE__ */ new Set();
function getProjectIdentifier(worktreeRoot) {
  const root = worktreeRoot || getGitTopLevel() || process.cwd();
  const workspaceRoot = findWorkspaceRoot(root);
  if (workspaceRoot) {
    const cfg = readWorkspaceMarkerConfig(workspaceRoot);
    if (cfg.id && typeof cfg.id === "string" && cfg.id.trim()) {
      const safeId = cfg.id.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
      const hash3 = createHash("sha256").update(safeId).digest("hex").slice(0, 16);
      return `${safeId}-${hash3}`;
    }
    const hash2 = createHash("sha256").update(workspaceRoot).digest("hex").slice(0, 16);
    const dirName2 = basename(workspaceRoot).replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${dirName2}-${hash2}`;
  }
  let source;
  try {
    const remoteUrl = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    }).trim();
    source = remoteUrl || root;
  } catch {
    source = root;
  }
  let primaryRoot = root;
  try {
    const commonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      timeout: 5e3
    }).trim();
    const isGitDir = basename(commonDir) === ".git";
    const isSubmodule = commonDir.includes(`${sep2}.git${sep2}modules`);
    if (isGitDir && !isSubmodule) {
      const resolved = dirname(commonDir);
      if (resolved && resolved !== root) {
        primaryRoot = resolved;
      }
    }
  } catch {
  }
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 16);
  const dirName = basename(primaryRoot).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${dirName}-${hash}`;
}
function getOmcRoot(worktreeRoot) {
  const customDir = process.env.OMC_STATE_DIR;
  if (customDir) {
    const root2 = worktreeRoot || getGitTopLevel() || process.cwd();
    const projectId = getProjectIdentifier(root2);
    const centralizedPath = join2(customDir, projectId);
    const legacyPath = join2(root2, OmcPaths.ROOT);
    const warningKey = `${legacyPath}:${centralizedPath}`;
    if (!dualDirWarnings.has(warningKey) && existsSync(legacyPath) && existsSync(centralizedPath)) {
      dualDirWarnings.add(warningKey);
      console.warn(`[omc] Both legacy state dir (${legacyPath}) and centralized state dir (${centralizedPath}) exist. Using centralized dir. Consider migrating data from the legacy dir and removing it.`);
    }
    return centralizedPath;
  }
  const workspaceAnchor = findWorkspaceRoot(worktreeRoot);
  if (workspaceAnchor) {
    return join2(workspaceAnchor, OmcPaths.ROOT);
  }
  const root = resolveStateAnchorRoot(worktreeRoot);
  return join2(root, OmcPaths.ROOT);
}
function resolveOmcPath(relativePath, worktreeRoot) {
  validatePath(relativePath);
  const omcDir = getOmcRoot(worktreeRoot);
  const fullPath = normalize2(resolve(omcDir, relativePath));
  const relativeToOmc = relative(omcDir, fullPath);
  if (relativeToOmc.startsWith("..") || relativeToOmc.startsWith(sep2 + "..")) {
    throw new Error(`Path escapes omc boundary: ${relativePath}`);
  }
  return fullPath;
}
function resolveStatePath(stateName, worktreeRoot) {
  const normalizedName = stateName.endsWith("-state") ? stateName : `${stateName}-state`;
  return resolveOmcPath(`state/${normalizedName}.json`, worktreeRoot);
}
var SESSION_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,255}$/;
var processSessionId = null;
function getProcessSessionId() {
  if (!processSessionId) {
    const pid = process.pid;
    const startTime = Date.now();
    processSessionId = `pid-${pid}-${startTime}`;
  }
  return processSessionId;
}
function validateSessionId(sessionId) {
  if (!sessionId) {
    throw new Error("Session ID cannot be empty");
  }
  if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
    throw new Error(`Invalid session ID: path traversal not allowed (${sessionId})`);
  }
  if (!SESSION_ID_REGEX.test(sessionId)) {
    throw new Error(`Invalid session ID: must be alphanumeric with hyphens/underscores, max 256 chars (${sessionId})`);
  }
}
function resolveSessionStatePath(stateName, sessionId, worktreeRoot) {
  validateSessionId(sessionId);
  const normalizedName = stateName.endsWith("-state") ? stateName : `${stateName}-state`;
  return resolveOmcPath(`state/sessions/${sessionId}/${normalizedName}.json`, worktreeRoot);
}
function resolveSessionStatePaths(stateName, sessionId, worktreeRoot, _opts) {
  const normalizedName = stateName.endsWith("-state") ? stateName : `${stateName}-state`;
  const legacy = resolveStatePath(stateName, worktreeRoot);
  if (!sessionId) {
    return {
      sessionScoped: "",
      legacy,
      effectiveRead: legacy,
      effectiveWrite: legacy
    };
  }
  validateSessionId(sessionId);
  const sessionScoped = resolveOmcPath(`state/sessions/${sessionId}/${normalizedName}.json`, worktreeRoot);
  const effectiveRead = existsSync(sessionScoped) ? sessionScoped : legacy;
  return {
    sessionScoped,
    legacy,
    effectiveRead,
    effectiveWrite: sessionScoped
  };
}
function isLegacyStateMigrationEnabled() {
  return process.env.OMC_MIGRATE_LEGACY_STATE === "1";
}
function getSessionStateDir(sessionId, worktreeRoot) {
  validateSessionId(sessionId);
  return join2(getOmcRoot(worktreeRoot), "state", "sessions", sessionId);
}
function listSessionIds(worktreeRoot) {
  const sessionsDir = join2(getOmcRoot(worktreeRoot), "state", "sessions");
  if (!existsSync(sessionsDir)) {
    return [];
  }
  try {
    const entries = readdirSync(sessionsDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && SESSION_ID_REGEX.test(entry.name)).map((entry) => entry.name);
  } catch {
    return [];
  }
}
function ensureSessionStateDir(sessionId, worktreeRoot) {
  const sessionDir = getSessionStateDir(sessionId, worktreeRoot);
  if (!existsSync(sessionDir)) {
    try {
      mkdirSync(sessionDir, { recursive: true });
    } catch (err) {
      if (err.code !== "EEXIST")
        throw err;
    }
  }
  return sessionDir;
}
function resolveToWorktreeRoot(directory) {
  const resolveRoot = process.env.OMC_STATE_DIR ? getGitTopLevel : getWorktreeRoot;
  if (directory) {
    const resolved = resolve(directory);
    const root = resolveRoot(resolved);
    if (root)
      return root;
    console.error("[worktree] non-git directory provided, falling back to process root", {
      directory: resolved
    });
  }
  return resolveRoot(process.cwd()) || process.cwd();
}
function resolveTranscriptPath(transcriptPath, cwd) {
  if (!transcriptPath)
    return void 0;
  if (existsSync(transcriptPath))
    return transcriptPath;
  const worktreeSegmentPattern = /--claude-worktrees-[^/\\]+/;
  if (worktreeSegmentPattern.test(transcriptPath)) {
    const resolved = transcriptPath.replace(worktreeSegmentPattern, "");
    if (existsSync(resolved))
      return resolved;
  }
  const effectiveCwd = cwd || process.cwd();
  const normalizedCwd = normalize2(effectiveCwd);
  const worktreeMarker = normalize2("/.claude/worktrees/");
  const markerIdx = normalizedCwd.indexOf(worktreeMarker);
  if (markerIdx !== -1) {
    const mainProjectRoot = normalizedCwd.substring(0, markerIdx);
    const sessionFile = basename(transcriptPath);
    if (sessionFile) {
      const projectsDir = join2(getClaudeConfigDir(), "projects");
      if (existsSync(projectsDir)) {
        const encodedMain = encodeProjectPath(mainProjectRoot);
        const resolvedPath = join2(projectsDir, encodedMain, sessionFile);
        if (existsSync(resolvedPath))
          return resolvedPath;
      }
    }
  }
  try {
    const gitCommonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: effectiveCwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    }).trim();
    const absoluteCommonDir = resolve(effectiveCwd, gitCommonDir);
    let mainRepoRoot = dirname(absoluteCommonDir);
    if (mainRepoRoot.endsWith(join2(".git", "worktrees"))) {
      mainRepoRoot = dirname(dirname(mainRepoRoot));
    }
    try {
      mainRepoRoot = realpathSync(mainRepoRoot);
    } catch {
    }
    const worktreeTop = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: effectiveCwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    }).trim();
    if (mainRepoRoot !== worktreeTop) {
      const sessionFile = basename(transcriptPath);
      if (sessionFile) {
        const projectsDir = join2(getClaudeConfigDir(), "projects");
        if (existsSync(projectsDir)) {
          const encodedMain = encodeProjectPath(mainRepoRoot);
          const resolvedPath = join2(projectsDir, encodedMain, sessionFile);
          if (existsSync(resolvedPath))
            return resolvedPath;
        }
      }
    }
  } catch {
  }
  return transcriptPath;
}
function validateWorkingDirectory(workingDirectory) {
  const trustedRoot = getGitTopLevel(process.cwd()) || process.cwd();
  if (!workingDirectory) {
    return trustedRoot;
  }
  const resolved = resolve(workingDirectory);
  let trustedRootReal;
  try {
    trustedRootReal = realpathSync(trustedRoot);
  } catch {
    trustedRootReal = trustedRoot;
  }
  const providedRoot = getGitTopLevel(resolved);
  if (providedRoot) {
    let providedRootReal;
    try {
      providedRootReal = realpathSync(providedRoot);
    } catch {
      throw new Error(`workingDirectory '${workingDirectory}' does not exist or is not accessible.`);
    }
    if (providedRootReal !== trustedRootReal) {
      console.error("[worktree] workingDirectory resolved to different git worktree root, using trusted root", {
        workingDirectory: resolved,
        providedRoot: providedRootReal,
        trustedRoot: trustedRootReal
      });
      return trustedRoot;
    }
    return providedRoot;
  }
  let resolvedReal;
  try {
    resolvedReal = realpathSync(resolved);
  } catch {
    throw new Error(`workingDirectory '${workingDirectory}' does not exist or is not accessible.`);
  }
  const rel = relative(trustedRootReal, resolvedReal);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`workingDirectory '${workingDirectory}' is outside the trusted worktree root '${trustedRoot}'.`);
  }
  return trustedRoot;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/stdin.js
var TRANSIENT_CONTEXT_PERCENT_TOLERANCE = 3;
var SESSION_ID_ENV_VARS = ["CLAUDE_SESSION_ID", "CLAUDECODE_SESSION_ID"];
function normalizeCandidate(value) {
  if (!value)
    return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
function getStdinCachePath() {
  const root = getWorktreeRoot() || process.cwd();
  for (const envVar of SESSION_ID_ENV_VARS) {
    const candidate = normalizeCandidate(process.env[envVar]);
    if (!candidate)
      continue;
    try {
      return join3(getSessionStateDir(candidate, root), "hud-stdin-cache.json");
    } catch {
    }
  }
  return resolveOmcPath("state/hud-stdin-cache.json", root);
}
function writeStdinCache(stdin) {
  try {
    const cachePath = getStdinCachePath();
    const cacheDir = dirname2(cachePath);
    if (!existsSync2(cacheDir)) {
      mkdirSync2(cacheDir, { recursive: true });
    }
    writeFileSync2(cachePath, JSON.stringify(stdin));
  } catch {
  }
}
function readStdinCache() {
  const root = getWorktreeRoot() || process.cwd();
  const scopedPath = getStdinCachePath();
  const tryRead = (p) => {
    try {
      if (!existsSync2(p))
        return null;
      return JSON.parse(readFileSync2(p, "utf-8"));
    } catch {
      return null;
    }
  };
  const scoped = tryRead(scopedPath);
  if (scoped)
    return scoped;
  const legacyPath = resolveOmcPath("state/hud-stdin-cache.json", root);
  if (scopedPath !== legacyPath) {
    return null;
  }
  return readMostRecentSessionCache(root);
}
function readMostRecentSessionCache(root) {
  let sessionIds;
  try {
    sessionIds = listSessionIds(root);
  } catch {
    return null;
  }
  let bestPath = null;
  let bestMtime = -Infinity;
  for (const sid of sessionIds) {
    let candidate;
    try {
      candidate = join3(getSessionStateDir(sid, root), "hud-stdin-cache.json");
    } catch {
      continue;
    }
    try {
      const st = statSync(candidate);
      if (!st.isFile())
        continue;
      if (st.mtimeMs > bestMtime) {
        bestMtime = st.mtimeMs;
        bestPath = candidate;
      }
    } catch {
    }
  }
  if (!bestPath)
    return null;
  try {
    return JSON.parse(readFileSync2(bestPath, "utf-8"));
  } catch {
    return null;
  }
}
async function readStdin() {
  if (process.stdin.isTTY) {
    return null;
  }
  const chunks = [];
  try {
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = chunks.join("");
    if (!raw.trim()) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function getCurrentUsage(stdin) {
  return stdin.context_window?.current_usage;
}
function clampPercent(value) {
  if (value == null || !isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}
function parseResetDate(value) {
  if (value == null) {
    return null;
  }
  const numericValue = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (Number.isFinite(numericValue)) {
    const millis = Math.abs(numericValue) < 1e12 ? numericValue * 1e3 : numericValue;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
function getTotalTokens(stdin) {
  const usage = getCurrentUsage(stdin);
  return (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0);
}
function getTotalInputTokens(stdin) {
  return stdin.context_window?.total_input_tokens ?? 0;
}
function getRoundedNativeContextPercent(stdin) {
  const nativePercent = stdin?.context_window?.used_percentage;
  if (typeof nativePercent !== "number" || Number.isNaN(nativePercent)) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round(nativePercent)));
}
function getPositiveNativeContextPercent(stdin) {
  const nativePercent = stdin?.context_window?.used_percentage;
  if (typeof nativePercent !== "number" || Number.isNaN(nativePercent) || nativePercent <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round(nativePercent)));
}
function getManualContextPercent(stdin) {
  const size = stdin.context_window?.context_window_size;
  if (!size || size <= 0) {
    return null;
  }
  const totalTokens = getTotalTokens(stdin);
  return Math.min(100, Math.round(totalTokens / size * 100));
}
function getPositiveManualContextPercent(stdin) {
  const manualPercent = getManualContextPercent(stdin);
  return manualPercent !== null && manualPercent > 0 ? manualPercent : null;
}
function getTotalInputContextPercent(stdin) {
  const size = stdin.context_window?.context_window_size;
  if (!size || size <= 0) {
    return null;
  }
  const totalInputTokens = getTotalInputTokens(stdin);
  if (totalInputTokens <= 0) {
    return null;
  }
  return Math.min(100, Math.round(totalInputTokens / size * 100));
}
function isSameContextStream(current, previous) {
  return current.cwd === previous.cwd && current.transcript_path === previous.transcript_path && current.context_window?.context_window_size === previous.context_window?.context_window_size;
}
function stabilizeContextPercent(stdin, previousStdin) {
  if (getPositiveNativeContextPercent(stdin) !== null) {
    return stdin;
  }
  if (!previousStdin || !isSameContextStream(stdin, previousStdin)) {
    return stdin;
  }
  const previousNativePercent = getRoundedNativeContextPercent(previousStdin);
  if (previousNativePercent === null) {
    return stdin;
  }
  const fallbackPercent = getPositiveManualContextPercent(stdin) ?? getTotalInputContextPercent(stdin);
  if (fallbackPercent === null && getRoundedNativeContextPercent(stdin) === 0) {
    return stdin;
  }
  if (fallbackPercent !== null && Math.abs(fallbackPercent - previousNativePercent) > TRANSIENT_CONTEXT_PERCENT_TOLERANCE) {
    return stdin;
  }
  return {
    ...stdin,
    context_window: {
      ...stdin.context_window,
      used_percentage: previousStdin.context_window?.used_percentage ?? previousNativePercent
    }
  };
}
function getContextPercent(stdin) {
  return getPositiveNativeContextPercent(stdin) ?? getPositiveManualContextPercent(stdin) ?? getTotalInputContextPercent(stdin) ?? 0;
}
function getRateLimitsFromStdin(stdin) {
  const fiveHour = stdin.rate_limits?.five_hour?.used_percentage;
  const sevenDay = stdin.rate_limits?.seven_day?.used_percentage;
  if (fiveHour == null && sevenDay == null) {
    return null;
  }
  const result = {};
  if (fiveHour != null) {
    result.fiveHourPercent = clampPercent(fiveHour);
    result.fiveHourResetsAt = parseResetDate(stdin.rate_limits?.five_hour?.resets_at);
  }
  if (sevenDay != null) {
    result.weeklyPercent = clampPercent(sevenDay);
    result.weeklyResetsAt = parseResetDate(stdin.rate_limits?.seven_day?.resets_at);
  }
  return result;
}
function getModelId(stdin) {
  const modelId = stdin.model?.id?.trim();
  return modelId || null;
}
function getModelName(stdin) {
  const displayName = stdin.model?.display_name?.trim();
  return displayName || getModelId(stdin);
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/transcript.js
import { createReadStream, existsSync as existsSync3, statSync as statSync2, openSync, readSync, closeSync } from "fs";
import { createInterface } from "readline";
import { basename as basename2 } from "path";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/agent-kind.js
var WRAPPER_TAGS = [
  { tag: "task-notification", kind: "subagent" },
  { tag: "teammate-message", kind: "teammate" },
  { tag: "agent-message", kind: "peer-session" }
];
function classifyAgentSpawn(input) {
  const spawnedBy = input.sessionId || void 0;
  return input.hasName ? { kind: "teammate", spawnedBy } : { kind: "subagent", spawnedBy };
}
function extractAttribute(openTag, attr) {
  const match = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i").exec(openTag);
  return match ? match[1] : void 0;
}
function extractTaskId(payload) {
  const match = /<task[-_]id>([^<]+)<\/task[-_]id>/i.exec(payload);
  return match ? match[1] : void 0;
}
function parseIncomingAgentWrapper(content, sessionId) {
  if (!content || typeof content !== "string")
    return null;
  let best = null;
  for (const wrapper of WRAPPER_TAGS) {
    const index = content.indexOf(`<${wrapper.tag}`);
    if (index !== -1 && (best === null || index < best.index)) {
      best = { index, tag: wrapper.tag, kind: wrapper.kind };
    }
  }
  if (!best)
    return null;
  const openTagEnd = content.indexOf(">", best.index);
  if (openTagEnd === -1)
    return null;
  const openTag = content.slice(best.index, openTagEnd + 1);
  switch (best.kind) {
    case "subagent":
      return {
        kind: "subagent",
        senderId: extractTaskId(content.slice(openTagEnd + 1)) ?? "unknown",
        spawnedBy: sessionId || void 0,
        redacted: true
      };
    case "teammate":
      return {
        kind: "teammate",
        senderId: extractAttribute(openTag, "teammate_id") ?? "unknown",
        spawnedBy: "native-team",
        redacted: true
      };
    case "peer-session":
      return {
        kind: "peer-session",
        senderId: extractAttribute(openTag, "from") ?? "unknown",
        spawnedBy: void 0,
        redacted: true
      };
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/transcript.js
var MAX_TAIL_BYTES = 4 * 1024 * 1024;
var MAX_AGENT_MAP_SIZE = 100;
var PERMISSION_TOOLS = [
  "Edit",
  "Write",
  "Bash",
  "proxy_Edit",
  "proxy_Write",
  "proxy_Bash"
];
var PERMISSION_THRESHOLD_MS = 3e3;
var pendingPermissionMap = /* @__PURE__ */ new Map();
var THINKING_PART_TYPES = ["thinking", "reasoning"];
var THINKING_RECENCY_MS = 3e4;
var transcriptCache = /* @__PURE__ */ new Map();
var TRANSCRIPT_CACHE_MAX_SIZE = 20;
async function parseTranscript(transcriptPath, options) {
  pendingPermissionMap.clear();
  const result = {
    agents: [],
    todos: [],
    incomingMessages: [],
    lastActivatedSkill: void 0,
    toolCallCount: 0,
    agentCallCount: 0,
    skillCallCount: 0,
    lastToolName: null
  };
  if (!transcriptPath || !existsSync3(transcriptPath)) {
    return result;
  }
  let cacheKey = null;
  try {
    const stat = statSync2(transcriptPath);
    cacheKey = `${transcriptPath}:${stat.size}:${stat.mtimeMs}`;
    const cached = transcriptCache.get(transcriptPath);
    if (cached?.cacheKey === cacheKey) {
      return finalizeTranscriptResult(cloneTranscriptData(cached.baseResult), options, cached.pendingPermissions);
    }
  } catch {
    return result;
  }
  const agentMap = /* @__PURE__ */ new Map();
  const backgroundAgentMap = /* @__PURE__ */ new Map();
  const latestTodos = [];
  const sessionTokenTotals = {
    inputTokens: 0,
    outputTokens: 0,
    seenUsage: false
  };
  let sessionTotalsReliable = false;
  const observedSessionIds = /* @__PURE__ */ new Set();
  try {
    const stat = statSync2(transcriptPath);
    const fileSize = stat.size;
    if (fileSize > MAX_TAIL_BYTES) {
      const lines = readTailLines(transcriptPath, fileSize, MAX_TAIL_BYTES);
      for (const line of lines) {
        if (!line.trim())
          continue;
        try {
          const entry = JSON.parse(line);
          processEntry(entry, agentMap, latestTodos, result, MAX_AGENT_MAP_SIZE, backgroundAgentMap, sessionTokenTotals, observedSessionIds);
        } catch {
        }
      }
      sessionTotalsReliable = sessionTokenTotals.seenUsage;
    } else {
      const fileStream = createReadStream(transcriptPath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      for await (const line of rl) {
        if (!line.trim())
          continue;
        try {
          const entry = JSON.parse(line);
          processEntry(entry, agentMap, latestTodos, result, MAX_AGENT_MAP_SIZE, backgroundAgentMap, sessionTokenTotals, observedSessionIds);
        } catch {
        }
      }
      sessionTotalsReliable = observedSessionIds.size <= 1;
    }
  } catch {
    return finalizeTranscriptResult(result, options, []);
  }
  const running = Array.from(agentMap.values()).filter((a) => a.status === "running");
  const completed = Array.from(agentMap.values()).filter((a) => a.status === "completed");
  result.agents = [
    ...running,
    ...completed.slice(-(10 - running.length))
  ].slice(0, 10);
  result.todos = latestTodos;
  if (sessionTotalsReliable && sessionTokenTotals.seenUsage) {
    result.sessionTotalTokens = sessionTokenTotals.inputTokens + sessionTokenTotals.outputTokens;
  }
  const pendingPermissions = Array.from(pendingPermissionMap.values()).map(clonePendingPermission);
  const finalized = finalizeTranscriptResult(result, options, pendingPermissions);
  if (cacheKey) {
    if (transcriptCache.size >= TRANSCRIPT_CACHE_MAX_SIZE) {
      transcriptCache.clear();
    }
    transcriptCache.set(transcriptPath, {
      cacheKey,
      baseResult: cloneTranscriptData(finalized),
      pendingPermissions
    });
  }
  return finalized;
}
function cloneDate(value) {
  return value ? new Date(value.getTime()) : void 0;
}
function clonePendingPermission(permission) {
  return {
    ...permission,
    timestamp: new Date(permission.timestamp.getTime())
  };
}
function cloneTranscriptData(result) {
  return {
    ...result,
    agents: result.agents.map((agent) => ({
      ...agent,
      startTime: new Date(agent.startTime.getTime()),
      endTime: cloneDate(agent.endTime)
    })),
    todos: result.todos.map((todo) => ({ ...todo })),
    incomingMessages: result.incomingMessages?.map((message) => ({ ...message })),
    sessionStart: cloneDate(result.sessionStart),
    lastActivatedSkill: result.lastActivatedSkill ? {
      ...result.lastActivatedSkill,
      timestamp: new Date(result.lastActivatedSkill.timestamp.getTime())
    } : void 0,
    pendingPermission: result.pendingPermission ? clonePendingPermission(result.pendingPermission) : void 0,
    thinkingState: result.thinkingState ? {
      ...result.thinkingState,
      lastSeen: cloneDate(result.thinkingState.lastSeen)
    } : void 0,
    lastRequestTokenUsage: result.lastRequestTokenUsage ? { ...result.lastRequestTokenUsage } : void 0
  };
}
function finalizeTranscriptResult(result, options, pendingPermissions) {
  const staleMinutes = options?.staleTaskThresholdMinutes ?? 30;
  const staleAgentThresholdMs = staleMinutes * 60 * 1e3;
  const now = Date.now();
  for (const agent of result.agents) {
    if (agent.status === "running") {
      const runningTime = now - agent.startTime.getTime();
      if (runningTime > staleAgentThresholdMs) {
        agent.status = "completed";
        agent.endTime = new Date(agent.startTime.getTime() + staleAgentThresholdMs);
      }
    }
  }
  result.pendingPermission = void 0;
  for (const permission of pendingPermissions) {
    const age = now - permission.timestamp.getTime();
    if (age <= PERMISSION_THRESHOLD_MS) {
      result.pendingPermission = clonePendingPermission(permission);
      break;
    }
  }
  if (result.thinkingState?.lastSeen) {
    const age = now - result.thinkingState.lastSeen.getTime();
    result.thinkingState.active = age <= THINKING_RECENCY_MS;
  }
  return result;
}
function readTailLines(filePath, fileSize, maxBytes) {
  const startOffset = Math.max(0, fileSize - maxBytes);
  const bytesToRead = fileSize - startOffset;
  const fd = openSync(filePath, "r");
  const buffer = Buffer.alloc(bytesToRead);
  try {
    readSync(fd, buffer, 0, bytesToRead, startOffset);
  } finally {
    closeSync(fd);
  }
  const content = buffer.toString("utf8");
  const lines = content.split("\n");
  if (startOffset > 0 && lines.length > 0) {
    lines.shift();
  }
  return lines;
}
function extractBackgroundAgentId(content) {
  const text = typeof content === "string" ? content : content.find((c) => c.type === "text")?.text || "";
  const match = text.match(/agentId:\s*([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}
function parseTaskOutputResult(content) {
  const text = typeof content === "string" ? content : content.find((c) => c.type === "text")?.text || "";
  const taskIdMatch = text.match(/<task-id>([^<]+)<\/task-id>/) || text.match(/<task_id>([^<]+)<\/task_id>/);
  const statusMatch = text.match(/<status>([^<]+)<\/status>/);
  const toolUseIdMatch = text.match(/<tool-use-id>([^<]+)<\/tool-use-id>/) || text.match(/<tool_use_id>([^<]+)<\/tool_use_id>/);
  if (taskIdMatch && statusMatch) {
    return {
      taskId: taskIdMatch[1],
      toolUseId: toolUseIdMatch ? toolUseIdMatch[1] : null,
      status: statusMatch[1]
    };
  }
  return null;
}
function extractTargetSummary(input, toolName) {
  if (!input || typeof input !== "object")
    return "...";
  const inp = input;
  if (toolName.includes("Edit") || toolName.includes("Write")) {
    const filePath = inp.file_path;
    if (filePath) {
      return basename2(filePath) || filePath;
    }
  }
  if (toolName.includes("Bash")) {
    const cmd = inp.command;
    if (cmd) {
      const trimmed = cmd.trim().substring(0, 20);
      return trimmed.length < cmd.trim().length ? `${trimmed}...` : trimmed;
    }
  }
  return "...";
}
function processEntry(entry, agentMap, latestTodos, result, maxAgentMapSize = 50, backgroundAgentMap, sessionTokenTotals, observedSessionIds) {
  const timestamp2 = entry.timestamp ? new Date(entry.timestamp) : /* @__PURE__ */ new Date();
  if (entry.sessionId) {
    observedSessionIds?.add(entry.sessionId);
  }
  const usage = extractLastRequestTokenUsage(entry.message?.usage);
  if (usage) {
    result.lastRequestTokenUsage = usage;
    if (sessionTokenTotals) {
      sessionTokenTotals.inputTokens += usage.inputTokens;
      sessionTokenTotals.outputTokens += usage.outputTokens;
      sessionTokenTotals.seenUsage = true;
    }
  }
  if (!result.sessionStart && entry.timestamp) {
    result.sessionStart = timestamp2;
  }
  const content = entry.message?.content;
  if (typeof content === "string") {
    if (content.includes("<task-notification>") || content.includes("<task_id>") || content.includes("<task-id>")) {
      const taskOutput = parseTaskOutputResult(content);
      if (taskOutput && taskOutput.status === "completed") {
        let toolUseId;
        if (taskOutput.toolUseId) {
          toolUseId = taskOutput.toolUseId;
        } else if (backgroundAgentMap) {
          toolUseId = backgroundAgentMap.get(taskOutput.taskId);
        }
        if (toolUseId) {
          const agent = agentMap.get(toolUseId);
          if (agent && agent.status === "running") {
            agent.status = "completed";
            agent.endTime = timestamp2;
          }
        }
      }
    }
    const wrapper = parseIncomingAgentWrapper(content, entry.sessionId);
    if (wrapper) {
      result.incomingMessages?.push(wrapper);
    }
    return;
  }
  if (!content || !Array.isArray(content))
    return;
  for (const block of content) {
    if (THINKING_PART_TYPES.includes(block.type)) {
      result.thinkingState = {
        active: true,
        lastSeen: timestamp2
      };
    }
    if (block.type === "text") {
      const text = block.text;
      if (text) {
        const wrapper = parseIncomingAgentWrapper(text, entry.sessionId);
        if (wrapper)
          result.incomingMessages?.push(wrapper);
      }
    }
    if (block.type === "tool_use" && block.id && block.name) {
      result.toolCallCount++;
      result.lastToolName = block.name;
      if (block.name === "Task" || block.name === "proxy_Task" || block.name === "Agent" || block.name === "proxy_Agent") {
        result.agentCallCount++;
        const input = block.input;
        const spawn3 = classifyAgentSpawn({
          hasName: Boolean(input?.name),
          sessionId: entry.sessionId
        });
        const agentEntry = {
          id: block.id,
          type: input?.subagent_type ?? "unknown",
          model: input?.model,
          name: input?.name,
          description: input?.description,
          status: "running",
          startTime: timestamp2,
          kind: spawn3.kind,
          spawnedBy: spawn3.spawnedBy
        };
        if (agentMap.size >= maxAgentMapSize) {
          let oldestCompleted = null;
          let oldestTime = Infinity;
          for (const [id, agent] of agentMap) {
            if (agent.status === "completed" && agent.startTime) {
              const time = agent.startTime.getTime();
              if (time < oldestTime) {
                oldestTime = time;
                oldestCompleted = id;
              }
            }
          }
          if (oldestCompleted) {
            agentMap.delete(oldestCompleted);
          }
        }
        agentMap.set(block.id, agentEntry);
      } else if (block.name === "TodoWrite" || block.name === "proxy_TodoWrite") {
        const input = block.input;
        if (input?.todos && Array.isArray(input.todos)) {
          latestTodos.length = 0;
          latestTodos.push(...input.todos.map((t) => ({
            content: t.content,
            status: t.status,
            activeForm: t.activeForm
          })));
        }
      } else if (block.name === "Skill" || block.name === "proxy_Skill") {
        result.skillCallCount++;
        const input = block.input;
        if (input?.skill) {
          result.lastActivatedSkill = {
            name: input.skill,
            args: input.args,
            timestamp: timestamp2
          };
        }
      }
      if (PERMISSION_TOOLS.includes(block.name)) {
        pendingPermissionMap.set(block.id, {
          toolName: block.name.replace("proxy_", ""),
          targetSummary: extractTargetSummary(block.input, block.name),
          timestamp: timestamp2
        });
      }
    }
    if (block.type === "tool_result" && block.tool_use_id) {
      pendingPermissionMap.delete(block.tool_use_id);
      const agent = agentMap.get(block.tool_use_id);
      if (agent) {
        const blockContent = block.content;
        const ASYNC_LAUNCH_PREFIX = "Async agent launched";
        const startsWithAsyncLaunch = (text) => !!text && text.trimStart().startsWith(ASYNC_LAUNCH_PREFIX);
        const isBackgroundLaunch = typeof blockContent === "string" ? startsWithAsyncLaunch(blockContent) : Array.isArray(blockContent) && blockContent.length > 0 && typeof blockContent[0] === "object" && blockContent[0] !== null && blockContent[0].type === "text" && startsWithAsyncLaunch(blockContent[0].text);
        if (isBackgroundLaunch) {
          if (backgroundAgentMap && blockContent) {
            const bgAgentId = extractBackgroundAgentId(blockContent);
            if (bgAgentId) {
              backgroundAgentMap.set(bgAgentId, block.tool_use_id);
            }
          }
        } else {
          agent.status = "completed";
          agent.endTime = timestamp2;
        }
      }
      if (block.content) {
        const taskOutput = parseTaskOutputResult(block.content);
        if (taskOutput && taskOutput.status === "completed") {
          let toolUseId;
          if (taskOutput.toolUseId) {
            toolUseId = taskOutput.toolUseId;
          } else if (backgroundAgentMap) {
            toolUseId = backgroundAgentMap.get(taskOutput.taskId);
          }
          if (toolUseId) {
            const bgAgent = agentMap.get(toolUseId);
            if (bgAgent && bgAgent.status === "running") {
              bgAgent.status = "completed";
              bgAgent.endTime = timestamp2;
            }
          }
        }
      }
    }
  }
}
function extractLastRequestTokenUsage(usage) {
  if (!usage)
    return null;
  const inputTokens = getNumericUsageValue(usage.input_tokens);
  const outputTokens = getNumericUsageValue(usage.output_tokens);
  const reasoningTokens = getNumericUsageValue(usage.reasoning_tokens ?? usage.output_tokens_details?.reasoning_tokens ?? usage.output_tokens_details?.reasoningTokens ?? usage.completion_tokens_details?.reasoning_tokens ?? usage.completion_tokens_details?.reasoningTokens);
  if (inputTokens == null && outputTokens == null) {
    return null;
  }
  const normalized = {
    inputTokens: Math.max(0, Math.round(inputTokens ?? 0)),
    outputTokens: Math.max(0, Math.round(outputTokens ?? 0))
  };
  if (reasoningTokens != null && reasoningTokens > 0) {
    normalized.reasoningTokens = Math.max(0, Math.round(reasoningTokens));
  }
  return normalized;
}
function getNumericUsageValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/state.js
import { existsSync as existsSync6, readFileSync as readFileSync6, mkdirSync as mkdirSync5, unlinkSync as unlinkSync4 } from "fs";
import { join as join6 } from "path";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/lib/atomic-write.js
import * as fsSync from "fs";
import * as path from "path";
import * as crypto from "crypto";
function ensureDirSync(dir) {
  if (fsSync.existsSync(dir)) {
    return;
  }
  try {
    fsSync.mkdirSync(dir, { recursive: true });
  } catch (err) {
    if (err.code === "EEXIST") {
      return;
    }
    throw err;
  }
}
function writeAllSync(fd, content, label) {
  const bytes = Buffer.from(content, "utf-8");
  let offset = 0;
  while (offset < bytes.length) {
    const written = fsSync.writeSync(fd, bytes, offset, bytes.length - offset);
    if (!Number.isInteger(written) || written <= 0) {
      throw new Error(`${label} made no progress`);
    }
    offset += written;
  }
  if (fsSync.fstatSync(fd).size !== bytes.length) {
    throw new Error(`${label} size verification failed`);
  }
}
function atomicWriteFileSync(filePath, content) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tempPath = path.join(dir, `.${base}.tmp.${crypto.randomUUID()}`);
  let fd = null;
  let success = false;
  try {
    ensureDirSync(dir);
    fd = fsSync.openSync(tempPath, "wx", 384);
    writeAllSync(fd, content, "atomic write");
    fsSync.fsyncSync(fd);
    fsSync.closeSync(fd);
    fd = null;
    fsSync.renameSync(tempPath, filePath);
    success = true;
    try {
      const dirFd = fsSync.openSync(dir, "r");
      try {
        fsSync.fsyncSync(dirFd);
      } finally {
        fsSync.closeSync(dirFd);
      }
    } catch {
    }
  } finally {
    if (fd !== null) {
      try {
        fsSync.closeSync(fd);
      } catch {
      }
    }
    if (!success) {
      try {
        fsSync.unlinkSync(tempPath);
      } catch {
      }
    }
  }
}
function atomicWriteJsonSync(filePath, data) {
  const jsonContent = JSON.stringify(data, null, 2);
  atomicWriteFileSync(filePath, jsonContent);
}
var ATOMIC_BATCH_MAX_CONTENT_BYTES = 1024 * 1024;

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/mission-board.js
import { copyFileSync, existsSync as existsSync5, mkdirSync as mkdirSync4, readFileSync as readFileSync5, readdirSync as readdirSync2, renameSync as renameSync2 } from "node:fs";
import { join as join5 } from "node:path";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/lib/file-lock.js
import { openSync as openSync3, closeSync as closeSync3, unlinkSync as unlinkSync3, writeSync as writeSync2, readFileSync as readFileSync4, statSync as statSync3, constants as fsConstants } from "fs";
import * as path2 from "path";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/platform/index.js
import { readFileSync as readFileSync3 } from "fs";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/platform/process-utils.js
import { execFileSync as execFileSync2, execFile, spawnSync } from "child_process";
import { promisify } from "util";
var execFileAsync = promisify(execFile);
function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0)
    return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "EPERM") {
      return true;
    }
    return false;
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/platform/index.js
var PLATFORM = process.platform;
function isWSL() {
  if (process.env.WSLENV !== void 0) {
    return true;
  }
  try {
    const procVersion = readFileSync3("/proc/version", "utf8");
    return procVersion.toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/lib/file-lock.js
var DEFAULT_STALE_LOCK_MS = 3e4;
var DEFAULT_RETRY_DELAY_MS = 50;
function isLockStale(lockPath, staleLockMs) {
  try {
    const stat = statSync3(lockPath);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < staleLockMs)
      return false;
    try {
      const raw = readFileSync4(lockPath, "utf-8");
      const payload = JSON.parse(raw);
      if (payload.pid && isProcessAlive(payload.pid))
        return false;
    } catch {
    }
    return true;
  } catch {
    return false;
  }
}
function lockPathFor(filePath) {
  return filePath + ".lock";
}
function tryAcquireSync(lockPath, staleLockMs) {
  ensureDirSync(path2.dirname(lockPath));
  try {
    const fd = openSync3(lockPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 384);
    try {
      const payload = JSON.stringify({ pid: process.pid, timestamp: Date.now() });
      writeSync2(fd, payload, null, "utf-8");
    } catch (writeErr) {
      try {
        closeSync3(fd);
      } catch {
      }
      try {
        unlinkSync3(lockPath);
      } catch {
      }
      throw writeErr;
    }
    return { fd, path: lockPath };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "EEXIST") {
      if (isLockStale(lockPath, staleLockMs)) {
        try {
          unlinkSync3(lockPath);
        } catch {
        }
        try {
          const fd = openSync3(lockPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 384);
          try {
            const payload = JSON.stringify({ pid: process.pid, timestamp: Date.now() });
            writeSync2(fd, payload, null, "utf-8");
          } catch (writeErr) {
            try {
              closeSync3(fd);
            } catch {
            }
            try {
              unlinkSync3(lockPath);
            } catch {
            }
            throw writeErr;
          }
          return { fd, path: lockPath };
        } catch {
          return null;
        }
      }
      return null;
    }
    throw err;
  }
}
function acquireFileLockSync(lockPath, opts) {
  const staleLockMs = opts?.staleLockMs ?? DEFAULT_STALE_LOCK_MS;
  const timeoutMs = opts?.timeoutMs ?? 0;
  const retryDelayMs = opts?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const handle = tryAcquireSync(lockPath, staleLockMs);
  if (handle || timeoutMs <= 0)
    return handle;
  const deadline = Date.now() + timeoutMs;
  const sharedBuf = new SharedArrayBuffer(4);
  const sharedArr = new Int32Array(sharedBuf);
  while (Date.now() < deadline) {
    const waitMs = Math.min(retryDelayMs, deadline - Date.now());
    try {
      Atomics.wait(sharedArr, 0, 0, waitMs);
    } catch {
      const waitUntil = Date.now() + waitMs;
      while (Date.now() < waitUntil) {
      }
    }
    const retryHandle = tryAcquireSync(lockPath, staleLockMs);
    if (retryHandle)
      return retryHandle;
  }
  return null;
}
function releaseFileLockSync(handle) {
  try {
    closeSync3(handle.fd);
  } catch {
  }
  try {
    unlinkSync3(handle.path);
  } catch {
  }
}
function withFileLockSync(lockPath, fn, opts) {
  const handle = acquireFileLockSync(lockPath, opts);
  if (!handle) {
    throw new Error(`Failed to acquire file lock: ${lockPath}`);
  }
  try {
    return fn();
  } finally {
    releaseFileLockSync(handle);
  }
}
function sleep(ms) {
  return new Promise((resolve6) => setTimeout(resolve6, ms));
}
async function acquireFileLock(lockPath, opts) {
  const staleLockMs = opts?.staleLockMs ?? DEFAULT_STALE_LOCK_MS;
  const timeoutMs = opts?.timeoutMs ?? 0;
  const retryDelayMs = opts?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const handle = tryAcquireSync(lockPath, staleLockMs);
  if (handle || timeoutMs <= 0)
    return handle;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(Math.min(retryDelayMs, deadline - Date.now()));
    const retryHandle = tryAcquireSync(lockPath, staleLockMs);
    if (retryHandle)
      return retryHandle;
  }
  return null;
}
function releaseFileLock(handle) {
  releaseFileLockSync(handle);
}
async function withFileLock(lockPath, fn, opts) {
  const handle = await acquireFileLock(lockPath, opts);
  if (!handle) {
    throw new Error(`Failed to acquire file lock: ${lockPath}`);
  }
  try {
    return await fn();
  } finally {
    releaseFileLock(handle);
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/utils/string-width.js
function isCJKCharacter(codePoint) {
  return (
    // CJK Unified Ideographs (Chinese characters)
    codePoint >= 19968 && codePoint <= 40959 || // CJK Unified Ideographs Extension A
    codePoint >= 13312 && codePoint <= 19903 || // CJK Unified Ideographs Extension B-F (rare characters)
    codePoint >= 131072 && codePoint <= 191471 || // CJK Compatibility Ideographs
    codePoint >= 63744 && codePoint <= 64255 || // Hangul Syllables (Korean)
    codePoint >= 44032 && codePoint <= 55215 || // Hangul Jamo (Korean components)
    codePoint >= 4352 && codePoint <= 4607 || // Hangul Compatibility Jamo
    codePoint >= 12592 && codePoint <= 12687 || // Hangul Jamo Extended-A
    codePoint >= 43360 && codePoint <= 43391 || // Hangul Jamo Extended-B
    codePoint >= 55216 && codePoint <= 55295 || // Hiragana (Japanese)
    codePoint >= 12352 && codePoint <= 12447 || // Katakana (Japanese)
    codePoint >= 12448 && codePoint <= 12543 || // Katakana Phonetic Extensions
    codePoint >= 12784 && codePoint <= 12799 || // Full-width ASCII variants
    codePoint >= 65281 && codePoint <= 65376 || // Full-width punctuation and symbols
    codePoint >= 65504 && codePoint <= 65510 || // CJK Symbols and Punctuation
    codePoint >= 12288 && codePoint <= 12351 || // Enclosed CJK Letters and Months
    codePoint >= 12800 && codePoint <= 13055 || // CJK Compatibility
    codePoint >= 13056 && codePoint <= 13311 || // CJK Compatibility Forms
    codePoint >= 65072 && codePoint <= 65103
  );
}
function isZeroWidth(codePoint) {
  return (
    // Zero-width characters
    codePoint === 8203 || // Zero Width Space
    codePoint === 8204 || // Zero Width Non-Joiner
    codePoint === 8205 || // Zero Width Joiner
    codePoint === 65279 || // Byte Order Mark / Zero Width No-Break Space
    // Combining diacritical marks (they modify previous character)
    codePoint >= 768 && codePoint <= 879 || // Combining Diacritical Marks Extended
    codePoint >= 6832 && codePoint <= 6911 || // Combining Diacritical Marks Supplement
    codePoint >= 7616 && codePoint <= 7679 || // Combining Diacritical Marks for Symbols
    codePoint >= 8400 && codePoint <= 8447 || // Combining Half Marks
    codePoint >= 65056 && codePoint <= 65071
  );
}
function getCharWidth(char) {
  const codePoint = char.codePointAt(0);
  if (codePoint === void 0)
    return 0;
  if (isZeroWidth(codePoint))
    return 0;
  if (isCJKCharacter(codePoint))
    return 2;
  return 1;
}
function stringWidth(str) {
  if (!str)
    return 0;
  const stripped = stripAnsi(str);
  let width = 0;
  for (const char of stripped) {
    width += getCharWidth(char);
  }
  return width;
}
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
}
function truncateToWidth(str, maxWidth, suffix = "...") {
  if (!str || maxWidth <= 0)
    return "";
  const strWidth = stringWidth(str);
  if (strWidth <= maxWidth)
    return str;
  const suffixWidth = stringWidth(suffix);
  const targetWidth = maxWidth - suffixWidth;
  if (targetWidth <= 0) {
    return truncateToWidthNoSuffix(suffix, maxWidth);
  }
  return truncateToWidthNoSuffix(str, targetWidth) + suffix;
}
function truncateToWidthNoSuffix(str, maxWidth) {
  let width = 0;
  let result = "";
  for (const char of str) {
    const charWidth = getCharWidth(char);
    if (width + charWidth > maxWidth)
      break;
    result += char;
    width += charWidth;
  }
  return result;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/team/worker-canonicalization.js
function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function hasAssignedTasks(worker) {
  return Array.isArray(worker.assigned_tasks) && worker.assigned_tasks.length > 0;
}
function workerPriority(worker) {
  if (hasText(worker.pane_id))
    return 4;
  if (typeof worker.pid === "number" && Number.isFinite(worker.pid))
    return 3;
  if (hasAssignedTasks(worker))
    return 2;
  if (typeof worker.index === "number" && worker.index > 0)
    return 1;
  return 0;
}
function mergeAssignedTasks(primary, secondary) {
  const merged = [];
  for (const taskId of [...primary ?? [], ...secondary ?? []]) {
    if (typeof taskId !== "string" || taskId.trim() === "" || merged.includes(taskId))
      continue;
    merged.push(taskId);
  }
  return merged;
}
function backfillText(primary, secondary) {
  return hasText(primary) ? primary : secondary;
}
function backfillBoolean(primary, secondary) {
  return typeof primary === "boolean" ? primary : secondary;
}
function backfillNumber(primary, secondary, predicate) {
  const isUsable = (value) => typeof value === "number" && Number.isFinite(value) && (predicate ? predicate(value) : true);
  return isUsable(primary) ? primary : isUsable(secondary) ? secondary : void 0;
}
function chooseWinningWorker(existing, incoming) {
  const existingPriority = workerPriority(existing);
  const incomingPriority = workerPriority(incoming);
  if (incomingPriority > existingPriority)
    return { winner: incoming, loser: existing };
  if (incomingPriority < existingPriority)
    return { winner: existing, loser: incoming };
  if ((incoming.index ?? 0) >= (existing.index ?? 0))
    return { winner: incoming, loser: existing };
  return { winner: existing, loser: incoming };
}
function canonicalizeWorkers(workers) {
  const byName = /* @__PURE__ */ new Map();
  const duplicateNames = /* @__PURE__ */ new Set();
  for (const worker of workers) {
    const name = typeof worker.name === "string" ? worker.name.trim() : "";
    if (!name)
      continue;
    const normalized = {
      ...worker,
      name,
      assigned_tasks: Array.isArray(worker.assigned_tasks) ? worker.assigned_tasks : []
    };
    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, normalized);
      continue;
    }
    duplicateNames.add(name);
    const { winner, loser } = chooseWinningWorker(existing, normalized);
    byName.set(name, {
      ...winner,
      name,
      assigned_tasks: mergeAssignedTasks(winner.assigned_tasks, loser.assigned_tasks),
      pane_id: backfillText(winner.pane_id, loser.pane_id),
      pid: backfillNumber(winner.pid, loser.pid),
      index: backfillNumber(winner.index, loser.index, (value) => value > 0) ?? 0,
      role: backfillText(winner.role, loser.role) ?? winner.role,
      worker_cli: backfillText(winner.worker_cli, loser.worker_cli),
      working_dir: backfillText(winner.working_dir, loser.working_dir),
      worktree_repo_root: backfillText(winner.worktree_repo_root, loser.worktree_repo_root),
      worktree_path: backfillText(winner.worktree_path, loser.worktree_path),
      worktree_branch: backfillText(winner.worktree_branch, loser.worktree_branch),
      worktree_detached: backfillBoolean(winner.worktree_detached, loser.worktree_detached),
      worktree_created: backfillBoolean(winner.worktree_created, loser.worktree_created),
      team_state_root: backfillText(winner.team_state_root, loser.team_state_root)
    });
  }
  return {
    workers: Array.from(byName.values()),
    duplicateNames: Array.from(duplicateNames.values())
  };
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/mission-board.js
var DEFAULT_CONFIG = {
  enabled: false,
  maxMissions: 2,
  maxAgentsPerMission: 3,
  maxTimelineEvents: 3,
  persistCompletedForMinutes: 20
};
var STATUS_ORDER = {
  running: 0,
  blocked: 1,
  waiting: 2,
  done: 3
};
var DEFAULT_MISSION_BOARD_CONFIG = DEFAULT_CONFIG;
function resolveConfig(config) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    enabled: config?.enabled ?? DEFAULT_CONFIG.enabled
  };
}
function readJsonSafe(path3) {
  if (!existsSync5(path3))
    return null;
  try {
    return JSON.parse(readFileSync5(path3, "utf-8"));
  } catch {
    return null;
  }
}
function readJsonLinesSafe(path3) {
  if (!existsSync5(path3))
    return [];
  try {
    return readFileSync5(path3, "utf-8").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
function maybeMigrateLegacy(paths) {
  if (!isLegacyStateMigrationEnabled())
    return;
  if (!paths.sessionScoped)
    return;
  if (existsSync5(paths.sessionScoped))
    return;
  if (!existsSync5(paths.legacy))
    return;
  const sentinel = paths.sessionScoped + ".migrating";
  try {
    const sessionDir = join5(paths.sessionScoped, "..");
    if (!existsSync5(sessionDir)) {
      mkdirSync4(sessionDir, { recursive: true });
    }
    copyFileSync(paths.legacy, sentinel);
    renameSync2(sentinel, paths.sessionScoped);
  } catch {
    try {
      renameSync2(sentinel, sentinel + ".failed");
    } catch {
    }
  }
}
function writeState(directory, state, sessionId) {
  const paths = resolveSessionStatePaths("mission-state", sessionId, directory);
  const writePath = paths.effectiveWrite;
  const stateDir = join5(writePath, "..");
  if (!existsSync5(stateDir)) {
    mkdirSync4(stateDir, { recursive: true });
  }
  withFileLockSync(writePath + ".lock", () => {
    atomicWriteJsonSync(writePath, state);
  });
  return state;
}
function parseTime(value) {
  if (!value)
    return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function compactText(value, width = 64) {
  const trimmed = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!trimmed)
    return null;
  return truncateToWidth(trimmed, width);
}
function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return "--:--";
  return date.toISOString().slice(11, 16);
}
function latest(...values) {
  return values.filter((value) => Boolean(value)).sort((left, right) => parseTime(right) - parseTime(left))[0];
}
function summarizeTask(task) {
  if (!task)
    return null;
  return compactText(task.result || task.summary || task.error || task.subject || task.description, 56);
}
function readMissionBoardState(directory, sessionId) {
  const effectiveSessionId = sessionId ?? getProcessSessionId();
  const paths = resolveSessionStatePaths("mission-state", effectiveSessionId, directory);
  maybeMigrateLegacy(paths);
  if (effectiveSessionId) {
    return readJsonSafe(paths.sessionScoped);
  }
  return readJsonSafe(paths.effectiveRead);
}
function deriveTeamStatus(taskCounts, agents) {
  if (taskCounts.inProgress > 0 || agents.some((agent) => agent.status === "running")) {
    return "running";
  }
  if (taskCounts.blocked > 0 || taskCounts.failed > 0 || agents.some((agent) => agent.status === "blocked")) {
    return "blocked";
  }
  if (taskCounts.total > 0 && taskCounts.completed === taskCounts.total) {
    return "done";
  }
  return "waiting";
}
function deriveWorkerStatus(workerStatus, task) {
  if (workerStatus?.state === "blocked" || workerStatus?.state === "failed" || task?.status === "blocked" || task?.status === "failed")
    return "blocked";
  if (workerStatus?.state === "working" || task?.status === "in_progress")
    return "running";
  if (workerStatus?.state === "done" || task?.status === "completed")
    return "done";
  return "waiting";
}
function collectTeamMission(teamRoot, teamName, config) {
  const teamConfig = readJsonSafe(join5(teamRoot, "config.json"));
  if (!teamConfig)
    return null;
  const workers = canonicalizeWorkers((Array.isArray(teamConfig.workers) ? teamConfig.workers : []).map((worker, index) => ({
    name: worker.name ?? "",
    index: index + 1,
    role: worker.role ?? "worker",
    assigned_tasks: Array.isArray(worker.assigned_tasks) ? worker.assigned_tasks : []
  }))).workers;
  const tasksDir = join5(teamRoot, "tasks");
  const tasks = existsSync5(tasksDir) ? readdirSync2(tasksDir).filter((entry) => /^(?:task-)?\d+\.json$/i.test(entry)).map((entry) => readJsonSafe(join5(tasksDir, entry))).filter((task) => Boolean(task?.id)) : [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskCounts = {
    total: tasks.length,
    pending: tasks.filter((task) => task.status === "pending").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    failed: tasks.filter((task) => task.status === "failed").length
  };
  const timeline = [];
  for (const event of readJsonLinesSafe(join5(teamRoot, "events.jsonl"))) {
    if (!event.created_at || !event.type)
      continue;
    if (event.type === "task_completed" || event.type === "task_failed") {
      timeline.push({
        id: `event:${event.event_id || `${event.type}:${event.created_at}`}`,
        at: event.created_at,
        kind: event.type === "task_completed" ? "completion" : "failure",
        agent: event.worker || "leader-fixed",
        detail: compactText(`${event.type === "task_completed" ? "completed" : "failed"} task ${event.task_id ?? "?"}`, 72) || event.type,
        sourceKey: `event:${event.event_id || event.type}`
      });
    } else if (event.type === "team_leader_nudge" || event.type === "worker_idle" || event.type === "worker_stopped") {
      timeline.push({
        id: `event:${event.event_id || `${event.type}:${event.created_at}`}`,
        at: event.created_at,
        kind: "update",
        agent: event.worker || "leader-fixed",
        detail: compactText(event.reason || event.type.replace(/_/g, " "), 72) || event.type,
        sourceKey: `event:${event.event_id || event.type}`
      });
    }
  }
  for (const worker of workers) {
    const workerName = worker.name?.trim();
    if (!workerName)
      continue;
    const mailbox = readJsonSafe(join5(teamRoot, "mailbox", `${workerName}.json`));
    for (const message of mailbox?.messages ?? []) {
      if (!message.created_at || !message.body)
        continue;
      timeline.push({
        id: `handoff:${message.message_id || `${workerName}:${message.created_at}`}`,
        at: message.created_at,
        kind: "handoff",
        agent: workerName,
        detail: compactText(message.body, 72) || "handoff",
        sourceKey: `handoff:${message.message_id || workerName}`
      });
    }
  }
  timeline.sort((left, right) => parseTime(left.at) - parseTime(right.at));
  const agents = workers.slice(0, config.maxAgentsPerMission).map((worker) => {
    const workerName = worker.name?.trim() || "worker";
    const workerStatus = readJsonSafe(join5(teamRoot, "workers", workerName, "status.json"));
    const heartbeat = readJsonSafe(join5(teamRoot, "workers", workerName, "heartbeat.json"));
    const ownedTasks = tasks.filter((task) => task.owner === workerName);
    const currentTask = (workerStatus?.current_task_id ? taskById.get(workerStatus.current_task_id) : void 0) || ownedTasks.find((task) => task.status === "in_progress") || ownedTasks.find((task) => task.status === "blocked") || (worker.assigned_tasks || []).map((taskId) => taskById.get(taskId)).find(Boolean) || void 0;
    const completedTask = [...ownedTasks].filter((task) => task.status === "completed" || task.status === "failed").sort((left, right) => parseTime(right.completed_at) - parseTime(left.completed_at))[0];
    const latestTimeline = [...timeline].reverse().find((entry) => entry.agent === workerName);
    const ownership = Array.from(new Set([
      ...worker.assigned_tasks || [],
      ...ownedTasks.map((task) => task.id || "")
    ].filter(Boolean))).map((taskId) => `#${taskId}`).join(",");
    return {
      name: workerName,
      role: worker.role,
      ownership: ownership || void 0,
      status: deriveWorkerStatus(workerStatus ?? null, currentTask),
      currentStep: compactText(workerStatus?.reason || (currentTask?.id && currentTask.subject ? `#${currentTask.id} ${currentTask.subject}` : currentTask?.subject) || currentTask?.description, 56),
      latestUpdate: compactText(workerStatus?.reason || latestTimeline?.detail || summarizeTask(currentTask), 64),
      completedSummary: summarizeTask(completedTask),
      updatedAt: latest(workerStatus?.updated_at, heartbeat?.last_turn_at, latestTimeline?.at, completedTask?.completed_at)
    };
  });
  const createdAt = teamConfig.created_at || latest(...timeline.map((entry) => entry.at)) || (/* @__PURE__ */ new Date()).toISOString();
  const updatedAt = latest(createdAt, ...timeline.map((entry) => entry.at), ...agents.map((agent) => agent.updatedAt)) || createdAt;
  return {
    id: `team:${teamName}`,
    source: "team",
    teamName,
    name: teamName,
    objective: compactText(teamConfig.task, 72) || teamName,
    createdAt,
    updatedAt,
    status: deriveTeamStatus(taskCounts, agents),
    workerCount: workers.length,
    taskCounts,
    agents,
    timeline: timeline.slice(-config.maxTimelineEvents)
  };
}
function mergeMissions(previous, teamMissions, config) {
  const previousMissions = previous?.missions || [];
  const sessionMissions = previousMissions.filter((mission) => mission.source === "session");
  const currentIds = new Set(teamMissions.map((mission) => mission.id));
  const cutoff = Date.now() - config.persistCompletedForMinutes * 6e4;
  const preservedTeams = previousMissions.filter((mission) => mission.source === "team" && !currentIds.has(mission.id) && mission.status === "done" && parseTime(mission.updatedAt) >= cutoff);
  return [...teamMissions, ...sessionMissions, ...preservedTeams].sort((left, right) => {
    const statusDelta = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusDelta !== 0)
      return statusDelta;
    return parseTime(right.updatedAt) - parseTime(left.updatedAt);
  }).slice(0, config.maxMissions);
}
function refreshMissionBoardState(directory, rawConfig = DEFAULT_CONFIG, sessionId) {
  const effectiveSessionId = sessionId ?? getProcessSessionId();
  const config = resolveConfig(rawConfig);
  const previous = readMissionBoardState(directory, effectiveSessionId);
  const teamsRoot = join5(getOmcRoot(directory), "state", "team");
  const teamMissions = existsSync5(teamsRoot) ? readdirSync2(teamsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => collectTeamMission(join5(teamsRoot, entry.name), entry.name, config)).filter((mission) => Boolean(mission)) : [];
  const state = {
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    missions: mergeMissions(previous, teamMissions, config)
  };
  return writeState(directory, state, effectiveSessionId);
}
function renderMissionBoard(state, rawConfig = DEFAULT_CONFIG) {
  if (!state || !Array.isArray(state.missions) || state.missions.length === 0)
    return [];
  const config = resolveConfig(rawConfig);
  const lines = [];
  for (const mission of state.missions.slice(0, config.maxMissions)) {
    const summary = [
      `${mission.taskCounts.completed}/${mission.taskCounts.total} done`,
      ...mission.taskCounts.inProgress > 0 ? [`${mission.taskCounts.inProgress} active`] : [],
      ...mission.taskCounts.blocked > 0 ? [`${mission.taskCounts.blocked} blocked`] : [],
      ...mission.taskCounts.pending > 0 ? [`${mission.taskCounts.pending} waiting`] : [],
      ...mission.taskCounts.failed > 0 ? [`${mission.taskCounts.failed} failed`] : []
    ].join(" \xB7 ");
    lines.push(`MISSION ${mission.name} [${mission.status}] \xB7 ${summary} \xB7 ${mission.objective}`);
    for (const agent of mission.agents.slice(0, config.maxAgentsPerMission)) {
      const badge = agent.status === "running" ? "run" : agent.status === "blocked" ? "blk" : agent.status === "done" ? "done" : "wait";
      const detail = agent.status === "done" ? agent.completedSummary || agent.latestUpdate || agent.currentStep || "done" : agent.latestUpdate || agent.currentStep || "no update";
      lines.push(`  [${badge}] ${agent.name}${agent.role ? ` (${agent.role})` : ""}${agent.ownership ? ` \xB7 own:${agent.ownership}` : ""} \xB7 ${detail}`);
    }
    if (mission.timeline.length > 0) {
      const timeline = mission.timeline.slice(-config.maxTimelineEvents).map((entry) => {
        const label = entry.kind === "completion" ? "done" : entry.kind === "failure" ? "fail" : entry.kind;
        return `${formatTime(entry.at)} ${label} ${entry.agent}: ${entry.detail}`;
      }).join(" | ");
      lines.push(`  timeline: ${timeline}`);
    }
  }
  return lines;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/types.js
var DEFAULT_HUD_LABELS = {
  context: "ctx",
  tokens: "tok",
  tool: "T",
  agent: "A",
  skill: "S",
  ralph: "ralph",
  background: "bg",
  thinking: "thinking",
  model: "Model",
  staged: "+",
  modified: "!",
  untracked: "?",
  ahead: "\u21E1",
  behind: "\u21E3"
};
var HUD_LOCALE_LABELS = {
  en: DEFAULT_HUD_LABELS,
  "zh-CN": {
    context: "\u4E0A\u4E0B\u6587",
    tokens: "\u4EE4\u724C",
    tool: "\u5DE5\u5177",
    agent: "\u667A\u80FD\u4F53",
    skill: "\u6280\u80FD",
    ralph: "\u5FAA\u73AF",
    background: "\u540E\u53F0",
    thinking: "\u601D\u8003",
    model: "\u6A21\u578B",
    staged: "\u5DF2\u6682\u5B58",
    modified: "\u5DF2\u4FEE\u6539",
    untracked: "\u672A\u8DDF\u8E2A",
    ahead: "\u9886\u5148",
    behind: "\u843D\u540E"
  }
};
var HUD_LABEL_KEYS = Object.freeze(Object.keys(DEFAULT_HUD_LABELS));
function isHudLocale(value) {
  return value === "en" || value === "zh-CN";
}
function sanitizeHudLabels(labels) {
  if (!labels || typeof labels !== "object")
    return {};
  const sanitized = {};
  for (const key of HUD_LABEL_KEYS) {
    const value = labels[key];
    if (typeof value === "string" && value.length > 0) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
function resolveHudLabels(locale, labels) {
  return {
    ...DEFAULT_HUD_LABELS,
    ...isHudLocale(locale) ? HUD_LOCALE_LABELS[locale] : {},
    ...sanitizeHudLabels(labels)
  };
}
var DEFAULT_ELEMENT_ORDER = {
  line1: ["hostname", "cwd", "gitRepo", "gitBranch", "gitStatus", "apiKeySource", "profile"],
  main: [
    "omcLabel",
    "model",
    "enterpriseCost",
    "rateLimits",
    "customBuckets",
    "permission",
    "thinking",
    "promptTime",
    "session",
    "tokens",
    "ralph",
    "autopilot",
    "prd",
    "skills",
    "lastSkill",
    "contextBar",
    "agents",
    "background",
    "callCounts",
    "lastTool",
    "sessionSummary"
  ],
  detail: ["missionBoard", "agents", "contextWarning", "payloadWarning", "todos"]
};
var DEFAULT_HUD_USAGE_POLL_INTERVAL_MS = 90 * 1e3;
var DEFAULT_HUD_CONFIG = {
  preset: "focused",
  locale: "en",
  labels: DEFAULT_HUD_LABELS,
  elements: {
    cwd: false,
    // Disabled by default for backward compatibility
    cwdFormat: "relative",
    useHyperlinks: false,
    gitRepo: false,
    // Disabled by default for backward compatibility
    gitBranch: false,
    // Disabled by default for backward compatibility
    gitStatus: false,
    // Disabled by default for backward compatibility
    gitInfoPosition: "above",
    // Git info above main HUD line (backward compatible)
    model: true,
    // Show only when Claude Code statusline stdin provides a model
    modelFormat: "versioned",
    // Preserve model version by default
    omcLabel: true,
    updateNotification: true,
    // Preserve existing update prompt behavior by default
    rateLimits: true,
    // Show rate limits by default
    ralph: true,
    autopilot: true,
    prdStory: true,
    activeSkills: true,
    contextBar: true,
    agents: true,
    agentsFormat: "multiline",
    // Multi-line for rich agent visualization
    agentsMaxLines: 5,
    // Show up to 5 agent detail lines
    backgroundTasks: true,
    todos: true,
    lastSkill: true,
    permissionStatus: false,
    // Disabled: heuristic-based, causes false positives
    thinking: true,
    thinkingFormat: "text",
    // Text format for backward compatibility
    apiKeySource: false,
    // Disabled by default
    hostname: false,
    profile: true,
    // Show profile name when CLAUDE_CONFIG_DIR is set
    missionBoard: false,
    // Opt-in mission board for whole-run progress tracking
    promptTime: true,
    // Show last prompt time by default
    sessionHealth: true,
    showSessionDuration: true,
    showHealthIndicator: true,
    showTokens: false,
    useBars: false,
    // Disabled by default for backwards compatibility
    showCallCounts: true,
    // Show tool/agent/skill call counts by default (Issue #710)
    callCountsFormat: "auto",
    // Preserve platform-based emoji/ASCII defaults unless explicitly overridden
    showLastTool: false,
    sessionSummary: false,
    // Disabled by default - opt-in AI-generated session summary
    maxOutputLines: 4,
    safeMode: true
    // Enabled by default to prevent terminal rendering corruption (Issue #346)
  },
  thresholds: {
    contextWarning: 70,
    contextCompactSuggestion: 80,
    contextCritical: 85,
    ralphWarning: 7
  },
  staleTaskThresholdMinutes: 10,
  contextLimitWarning: {
    threshold: 80,
    autoCompact: false
  },
  missionBoard: DEFAULT_MISSION_BOARD_CONFIG,
  usageApiPollIntervalMs: DEFAULT_HUD_USAGE_POLL_INTERVAL_MS,
  wrapMode: "truncate"
};
var PRESET_CONFIGS = {
  minimal: {
    cwd: false,
    cwdFormat: "folder",
    useHyperlinks: false,
    gitRepo: false,
    gitBranch: false,
    gitStatus: false,
    gitInfoPosition: "above",
    model: true,
    modelFormat: "versioned",
    omcLabel: true,
    updateNotification: true,
    rateLimits: true,
    ralph: true,
    autopilot: true,
    prdStory: false,
    activeSkills: true,
    lastSkill: true,
    contextBar: false,
    agents: true,
    agentsFormat: "count",
    agentsMaxLines: 0,
    backgroundTasks: false,
    todos: true,
    permissionStatus: false,
    thinking: false,
    thinkingFormat: "text",
    apiKeySource: false,
    hostname: false,
    profile: true,
    missionBoard: false,
    promptTime: false,
    sessionHealth: false,
    showSessionDuration: true,
    showHealthIndicator: true,
    showTokens: false,
    useBars: false,
    showCallCounts: false,
    showLastTool: false,
    sessionSummary: false,
    maxOutputLines: 2,
    safeMode: true
  },
  focused: {
    cwd: false,
    cwdFormat: "relative",
    useHyperlinks: false,
    gitRepo: false,
    gitBranch: true,
    gitStatus: true,
    gitInfoPosition: "above",
    model: true,
    modelFormat: "versioned",
    omcLabel: true,
    updateNotification: true,
    rateLimits: true,
    ralph: true,
    autopilot: true,
    prdStory: true,
    activeSkills: true,
    lastSkill: true,
    contextBar: true,
    agents: true,
    agentsFormat: "multiline",
    agentsMaxLines: 3,
    backgroundTasks: true,
    todos: true,
    permissionStatus: false,
    thinking: true,
    thinkingFormat: "text",
    apiKeySource: false,
    hostname: false,
    profile: true,
    missionBoard: false,
    promptTime: true,
    sessionHealth: true,
    showSessionDuration: true,
    showHealthIndicator: true,
    showTokens: false,
    useBars: true,
    showCallCounts: true,
    showLastTool: false,
    sessionSummary: false,
    // Opt-in: sends transcript to claude -p
    maxOutputLines: 4,
    safeMode: true
  },
  full: {
    cwd: false,
    cwdFormat: "relative",
    useHyperlinks: false,
    gitRepo: true,
    gitBranch: true,
    gitStatus: true,
    gitInfoPosition: "above",
    model: true,
    modelFormat: "versioned",
    omcLabel: true,
    updateNotification: true,
    rateLimits: true,
    ralph: true,
    autopilot: true,
    prdStory: true,
    activeSkills: true,
    lastSkill: true,
    contextBar: true,
    agents: true,
    agentsFormat: "multiline",
    agentsMaxLines: 10,
    backgroundTasks: true,
    todos: true,
    permissionStatus: false,
    thinking: true,
    thinkingFormat: "text",
    apiKeySource: true,
    hostname: false,
    profile: true,
    missionBoard: false,
    promptTime: true,
    sessionHealth: true,
    showSessionDuration: true,
    showHealthIndicator: true,
    showTokens: false,
    useBars: true,
    showCallCounts: true,
    showLastTool: false,
    sessionSummary: false,
    // Opt-in: sends transcript to claude -p
    maxOutputLines: 12,
    safeMode: true
  },
  opencode: {
    cwd: false,
    cwdFormat: "relative",
    useHyperlinks: false,
    gitRepo: false,
    gitBranch: true,
    gitStatus: false,
    gitInfoPosition: "above",
    model: true,
    modelFormat: "versioned",
    omcLabel: true,
    updateNotification: true,
    rateLimits: false,
    ralph: true,
    autopilot: true,
    prdStory: false,
    activeSkills: true,
    lastSkill: true,
    contextBar: true,
    agents: true,
    agentsFormat: "codes",
    agentsMaxLines: 0,
    backgroundTasks: false,
    todos: true,
    permissionStatus: false,
    thinking: true,
    thinkingFormat: "text",
    apiKeySource: false,
    hostname: false,
    profile: true,
    missionBoard: false,
    promptTime: true,
    sessionHealth: true,
    showSessionDuration: true,
    showHealthIndicator: true,
    showTokens: false,
    useBars: false,
    showCallCounts: true,
    showLastTool: false,
    sessionSummary: false,
    maxOutputLines: 4,
    safeMode: true
  },
  dense: {
    cwd: false,
    cwdFormat: "relative",
    useHyperlinks: false,
    gitRepo: true,
    gitBranch: true,
    gitStatus: true,
    gitInfoPosition: "above",
    model: true,
    modelFormat: "versioned",
    omcLabel: true,
    updateNotification: true,
    rateLimits: true,
    ralph: true,
    autopilot: true,
    prdStory: true,
    activeSkills: true,
    lastSkill: true,
    contextBar: true,
    agents: true,
    agentsFormat: "multiline",
    agentsMaxLines: 5,
    backgroundTasks: true,
    todos: true,
    permissionStatus: false,
    thinking: true,
    thinkingFormat: "text",
    apiKeySource: true,
    hostname: false,
    profile: true,
    missionBoard: false,
    promptTime: true,
    sessionHealth: true,
    showSessionDuration: true,
    showHealthIndicator: true,
    showTokens: false,
    useBars: true,
    showCallCounts: true,
    showLastTool: false,
    sessionSummary: false,
    // Opt-in: sends transcript to claude -p
    maxOutputLines: 6,
    safeMode: true
  }
};

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/background-cleanup.js
var STALE_TASK_THRESHOLD_MS = 30 * 60 * 1e3;
function getTaskStartMs(task) {
  const raw = task.startedAt ?? task.startTime;
  if (!raw)
    return NaN;
  return new Date(raw).getTime();
}
async function cleanupStaleBackgroundTasks(thresholdMs = STALE_TASK_THRESHOLD_MS, directory, sessionId) {
  const state = readHudState(directory, sessionId);
  if (!state || !state.backgroundTasks) {
    return 0;
  }
  const now = Date.now();
  const originalCount = state.backgroundTasks.length;
  let statusChanged = false;
  for (const task of state.backgroundTasks) {
    if (task.status === "running") {
      const startMs = getTaskStartMs(task);
      if (Number.isNaN(startMs)) {
        task.status = "failed";
        task.completedAt = (/* @__PURE__ */ new Date()).toISOString();
        statusChanged = true;
      } else {
        const taskAge = now - startMs;
        if (taskAge > thresholdMs) {
          task.status = "failed";
          task.completedAt = (/* @__PURE__ */ new Date()).toISOString();
          statusChanged = true;
        }
      }
    }
  }
  state.backgroundTasks = state.backgroundTasks.filter((task) => {
    if (task.status === "running")
      return true;
    if (task.completedAt) {
      const completedMs = new Date(task.completedAt).getTime();
      if (Number.isNaN(completedMs))
        return true;
      return now - completedMs < thresholdMs;
    }
    return true;
  });
  if (state.backgroundTasks.length > 20) {
    const running = state.backgroundTasks.filter((t) => t.status === "running");
    const nonRunning = state.backgroundTasks.filter((t) => t.status !== "running").slice(-Math.max(0, 20 - running.length));
    state.backgroundTasks = [...running, ...nonRunning];
  }
  const removedCount = originalCount - state.backgroundTasks.length;
  if (removedCount > 0 || statusChanged) {
    state.timestamp = (/* @__PURE__ */ new Date()).toISOString();
    writeHudState(state, directory, sessionId);
  }
  return removedCount;
}
async function detectOrphanedTasks(directory, sessionId) {
  const state = readHudState(directory, sessionId);
  if (!state || !state.backgroundTasks) {
    return [];
  }
  const orphaned = [];
  for (const task of state.backgroundTasks) {
    if (task.status === "running") {
      const taskAge = Date.now() - new Date(task.startedAt).getTime();
      const TWO_HOURS_MS = 2 * 60 * 60 * 1e3;
      if (taskAge > TWO_HOURS_MS) {
        orphaned.push(task);
      }
    }
  }
  return orphaned;
}
async function markOrphanedTasksAsStale(directory, sessionId) {
  const state = readHudState(directory, sessionId);
  if (!state || !state.backgroundTasks) {
    return 0;
  }
  const orphaned = await detectOrphanedTasks(directory, sessionId);
  let marked = 0;
  for (const orphanedTask of orphaned) {
    const task = state.backgroundTasks.find((t) => t.id === orphanedTask.id);
    if (task && task.status === "running") {
      task.status = "completed";
      marked++;
    }
  }
  if (marked > 0) {
    writeHudState(state, directory, sessionId);
  }
  return marked;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/state.js
function getLocalStateFilePath(directory) {
  const baseDir = validateWorkingDirectory(directory);
  const omcStateDir = join6(getOmcRoot(baseDir), "state");
  return join6(omcStateDir, "hud-state.json");
}
function getLegacyRootStateFilePath(directory) {
  const baseDir = validateWorkingDirectory(directory);
  return join6(getOmcRoot(baseDir), "hud-state.json");
}
function getStateFilePath(directory, sessionId) {
  const baseDir = validateWorkingDirectory(directory);
  if (sessionId) {
    return resolveSessionStatePath("hud", sessionId, baseDir);
  }
  return getLocalStateFilePath(baseDir);
}
function getSettingsFilePath() {
  return join6(getClaudeConfigDir(), "settings.json");
}
function getConfigFilePath() {
  return join6(getClaudeConfigDir(), ".omc", "hud-config.json");
}
function readJsonFile(filePath) {
  if (!existsSync6(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync6(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function getLegacyHudConfig() {
  return readJsonFile(getConfigFilePath());
}
function mergeElements(primary, secondary) {
  return {
    ...primary ?? {},
    ...secondary ?? {}
  };
}
function mergeThresholds(primary, secondary) {
  return {
    ...primary ?? {},
    ...secondary ?? {}
  };
}
function mergeContextLimitWarning(primary, secondary) {
  return {
    ...primary ?? {},
    ...secondary ?? {}
  };
}
function mergeMissionBoardConfig(primary, secondary) {
  return {
    ...primary ?? {},
    ...secondary ?? {}
  };
}
function ensureStateDir(directory) {
  const baseDir = validateWorkingDirectory(directory);
  const omcStateDir = join6(getOmcRoot(baseDir), "state");
  if (!existsSync6(omcStateDir)) {
    mkdirSync5(omcStateDir, { recursive: true });
  }
}
function ensureHudStateDir(directory, sessionId) {
  if (sessionId) {
    ensureSessionStateDir(sessionId, validateWorkingDirectory(directory));
    return;
  }
  ensureStateDir(directory);
}
function readHudState(directory, sessionId) {
  if (sessionId) {
    const sessionStateFile = getStateFilePath(directory, sessionId);
    if (!existsSync6(sessionStateFile)) {
      return null;
    }
    try {
      const content = readFileSync6(sessionStateFile, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error("[HUD] Failed to read session state:", error instanceof Error ? error.message : error);
      return null;
    }
  }
  const localStateFile = getLocalStateFilePath(directory);
  if (existsSync6(localStateFile)) {
    try {
      const content = readFileSync6(localStateFile, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error("[HUD] Failed to read local state:", error instanceof Error ? error.message : error);
    }
  }
  const legacyStateFile = getLegacyRootStateFilePath(directory);
  if (existsSync6(legacyStateFile)) {
    try {
      const content = readFileSync6(legacyStateFile, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error("[HUD] Failed to read legacy state:", error instanceof Error ? error.message : error);
      return null;
    }
  }
  return null;
}
function writeHudState(state, directory, sessionId) {
  try {
    ensureHudStateDir(directory, sessionId);
    const stateFile = getStateFilePath(directory, sessionId);
    const nextState = sessionId ? { ...state, sessionId } : state;
    atomicWriteJsonSync(stateFile, nextState);
    if (sessionId) {
      const legacyCandidates = [
        getLegacyRootStateFilePath(directory)
      ];
      for (const legacyFile of legacyCandidates) {
        if (!existsSync6(legacyFile)) {
          continue;
        }
        try {
          const content = readFileSync6(legacyFile, "utf-8");
          const legacyState = JSON.parse(content);
          if (!legacyState.sessionId || legacyState.sessionId === sessionId) {
            unlinkSync4(legacyFile);
          }
        } catch {
        }
      }
    }
    return true;
  } catch (error) {
    console.error("[HUD] Failed to write state:", error instanceof Error ? error.message : error);
    return false;
  }
}
function getRunningTasks(state) {
  if (!state)
    return [];
  return state.backgroundTasks.filter((task) => task.status === "running");
}
function readHudConfig() {
  const settingsFile = getSettingsFilePath();
  const legacyConfig = getLegacyHudConfig();
  if (existsSync6(settingsFile)) {
    try {
      const content = readFileSync6(settingsFile, "utf-8");
      const settings = JSON.parse(content);
      if (settings.omcHud) {
        return mergeWithDefaults({
          ...legacyConfig,
          ...settings.omcHud,
          elements: mergeElements(legacyConfig?.elements, settings.omcHud.elements),
          thresholds: mergeThresholds(legacyConfig?.thresholds, settings.omcHud.thresholds),
          contextLimitWarning: mergeContextLimitWarning(legacyConfig?.contextLimitWarning, settings.omcHud.contextLimitWarning),
          missionBoard: mergeMissionBoardConfig(legacyConfig?.missionBoard, settings.omcHud.missionBoard),
          locale: isHudLocale(settings.omcHud.locale) ? settings.omcHud.locale : legacyConfig?.locale,
          labels: {
            ...sanitizeHudLabels(legacyConfig?.labels),
            ...sanitizeHudLabels(settings.omcHud.labels)
          }
        });
      }
    } catch (error) {
      console.error("[HUD] Failed to read settings.json:", error instanceof Error ? error.message : error);
    }
  }
  if (legacyConfig) {
    return mergeWithDefaults(legacyConfig);
  }
  return mergeWithDefaults({});
}
function mergeWithDefaults(config) {
  const preset = config.preset ?? DEFAULT_HUD_CONFIG.preset;
  const presetElements = PRESET_CONFIGS[preset] ?? {};
  const missionBoardEnabled = config.missionBoard?.enabled ?? config.elements?.missionBoard ?? DEFAULT_HUD_CONFIG.missionBoard?.enabled ?? false;
  const missionBoard = {
    ...DEFAULT_MISSION_BOARD_CONFIG,
    ...DEFAULT_HUD_CONFIG.missionBoard,
    ...config.missionBoard,
    enabled: missionBoardEnabled
  };
  const locale = isHudLocale(config.locale) ? config.locale : DEFAULT_HUD_CONFIG.locale;
  return {
    preset,
    locale,
    labels: resolveHudLabels(locale, config.labels),
    elements: {
      ...DEFAULT_HUD_CONFIG.elements,
      // Base defaults
      ...presetElements,
      // Preset overrides
      ...config.elements
      // User overrides
    },
    thresholds: {
      ...DEFAULT_HUD_CONFIG.thresholds,
      ...config.thresholds
    },
    staleTaskThresholdMinutes: config.staleTaskThresholdMinutes ?? DEFAULT_HUD_CONFIG.staleTaskThresholdMinutes,
    contextLimitWarning: {
      ...DEFAULT_HUD_CONFIG.contextLimitWarning,
      ...config.contextLimitWarning
    },
    missionBoard,
    usageApiPollIntervalMs: config.usageApiPollIntervalMs ?? DEFAULT_HUD_CONFIG.usageApiPollIntervalMs,
    ...config.elementOrder !== void 0 ? { elementOrder: config.elementOrder } : {},
    wrapMode: config.wrapMode ?? DEFAULT_HUD_CONFIG.wrapMode,
    ...config.rateLimitsProvider ? { rateLimitsProvider: config.rateLimitsProvider } : {},
    ...config.maxWidth != null ? { maxWidth: config.maxWidth } : {},
    ...config.layout ? { layout: config.layout } : {}
  };
}
async function initializeHUDState(directory, sessionId) {
  const removedStale = await cleanupStaleBackgroundTasks(void 0, directory, sessionId);
  const markedOrphaned = await markOrphanedTasksAsStale(directory, sessionId);
  if (removedStale > 0 || markedOrphaned > 0) {
    console.error(`HUD cleanup: removed ${removedStale} stale tasks, marked ${markedOrphaned} orphaned tasks`);
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/omc-state.js
import { existsSync as existsSync7, readFileSync as readFileSync7, statSync as statSync4, readdirSync as readdirSync3 } from "fs";
import { join as join9 } from "path";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hooks/autopilot/named-workflow-resume-validator.js
import { basename as basename4, join as join8, parse as parse2, relative as relative2, resolve as resolve2, sep as sep3 } from "path";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hooks/autopilot/pipeline.js
import { createHash as createHash2 } from "crypto";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/lib/mode-state-io.js
var LOCK_REMOVAL_SCRIPT = String.raw`
const fs = require('fs');
const [operation, lockPath, expectedRaw] = process.argv.slice(1);
const keys = ['createdAt', 'nonce', 'pid', 'processStart', 'version'];
function readOwner() {
  try {
    const value = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const actual = Object.keys(value).sort();
    if (actual.length !== keys.length || !actual.every((key, index) => key === keys[index]) || value.version !== 1 || !Number.isSafeInteger(value.pid) || value.pid <= 0 || typeof value.processStart !== 'string' || !/^\d+$/.test(value.processStart) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.nonce !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.nonce)) return null;
    return value;
  } catch (error) { if (error && error.code === 'ENOENT') process.exit(0); return null; }
}
const owner = readOwner();
if (!owner) process.exit(3);
if (operation === 'release') {
  let expected;
  try { expected = JSON.parse(expectedRaw); } catch { process.exit(3); }
  if (owner.pid !== expected.pid || owner.processStart !== expected.processStart || owner.nonce !== expected.nonce) process.exit(4);
  try { fs.unlinkSync(lockPath); process.exit(0); } catch { process.exit(3); }
}
if (process.platform !== 'linux') process.exit(3);
let currentStart;
try {
  const stat = fs.readFileSync('/proc/' + owner.pid + '/stat', 'utf8');
  const end = stat.lastIndexOf(')');
  const fields = end >= 0 ? stat.slice(end + 2).trim().split(/\s+/) : [];
  currentStart = fields[19] && /^\d+$/.test(fields[19]) ? fields[19] : null;
} catch (error) { currentStart = error && error.code === 'ENOENT' ? 'absent' : null; }
if (currentStart === null) process.exit(3);
if (currentStart !== 'absent' && currentStart === owner.processStart) process.exit(2);
try { fs.unlinkSync(lockPath); process.exit(0); } catch { process.exit(3); }
`;
var RECOVERY_CLAIM_SCRIPT = String.raw`
const fs = require('fs');
const [operation, claimPath, expectedRaw] = process.argv.slice(1);
const keys = ['createdAt', 'nonce', 'pid', 'processStart', 'version'];
function readOwner() {
  try {
    const value = JSON.parse(fs.readFileSync(claimPath, 'utf8'));
    const actual = Object.keys(value).sort();
    if (actual.length !== keys.length || !actual.every((key, index) => key === keys[index]) || value.version !== 1 || !Number.isSafeInteger(value.pid) || value.pid <= 0 || typeof value.processStart !== 'string' || !/^\d+$/.test(value.processStart) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.nonce !== 'string' || !/^[0-9a-f-]{36}$/i.test(value.nonce)) return null;
    return value;
  } catch (error) { return error && error.code === 'ENOENT' ? 'absent' : null; }
}
function exact(left, right) { return left.pid === right.pid && left.processStart === right.processStart && left.nonce === right.nonce; }
function stale(owner) {
  if (process.platform !== 'linux') return null;
  try {
    const stat = fs.readFileSync('/proc/' + owner.pid + '/stat', 'utf8');
    const end = stat.lastIndexOf(')');
    const fields = end >= 0 ? stat.slice(end + 2).trim().split(/\s+/) : [];
    const start = fields[19] && /^\d+$/.test(fields[19]) ? fields[19] : null;
    return start === null ? null : start !== owner.processStart;
  } catch (error) { return error && error.code === 'ENOENT' ? true : null; }
}
let expected;
try { expected = JSON.parse(expectedRaw); } catch { process.exit(3); }
if (operation === 'release') {
  const current = readOwner();
  if (current === 'absent') process.exit(0);
  if (!current || !exact(current, expected)) process.exit(4);
  try { fs.unlinkSync(claimPath); process.exit(0); } catch { process.exit(3); }
}
const current = readOwner();
if (current !== 'absent') {
  if (!current) process.exit(3);
  const isStale = stale(current);
  if (isStale !== true) process.exit(isStale === false ? 2 : 3);
  try { fs.unlinkSync(claimPath); } catch { process.exit(3); }
}
let fd;
try {
  fd = fs.openSync(claimPath, 'wx', 0o600);
  const bytes = Buffer.from(JSON.stringify(expected));
  let offset = 0;
  while (offset < bytes.length) {
    const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
    if (written <= 0) throw new Error('recovery claim made no progress');
    offset += written;
  }
  fs.fsyncSync(fd);
  if (fs.statSync(claimPath).size !== bytes.length) throw new Error('recovery claim truncated');
  fs.closeSync(fd);
  process.exit(0);
} catch { try { if (fd !== undefined) fs.closeSync(fd); } catch {} try { fs.unlinkSync(claimPath); } catch {} process.exit(3); }
`;

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/shared/types.js
var CANONICAL_TEAM_ROLES = [
  "orchestrator",
  "planner",
  "analyst",
  "architect",
  "executor",
  "debugger",
  "critic",
  "code-reviewer",
  "security-reviewer",
  "test-engineer",
  "designer",
  "writer",
  "code-simplifier",
  "explore",
  "document-specialist"
];
var CURSOR_EXECUTOR_TEAM_ROLES = ["executor"];
var KNOWN_AGENT_NAMES = [
  "omc",
  "explore",
  "analyst",
  "planner",
  "architect",
  "debugger",
  "executor",
  "verifier",
  "securityReviewer",
  "codeReviewer",
  "testEngineer",
  "designer",
  "writer",
  "qaTester",
  "scientist",
  "tracer",
  "gitMaster",
  "codeSimplifier",
  "critic",
  "documentSpecialist"
];

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/utils/paths.js
import { join as join7, dirname as dirname5 } from "path";
var PLUGIN_ROOT_REQUIREMENTS = [
  join7("hooks", "hooks.json"),
  join7("scripts", "run.cjs"),
  "scripts"
];
var OCCUPIED_CODES = new Set(process.platform === "win32" ? ["EEXIST", "ENOTEMPTY", "ENOTDIR", "EISDIR", "EPERM", "EACCES"] : ["EEXIST", "ENOTEMPTY", "ENOTDIR", "EISDIR"]);
var STALE_THRESHOLD_MS = 10 * 60 * 1e3;

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/utils/ssrf-guard.js
var BLOCKED_HOST_PATTERNS = [
  // Exact matches
  /^localhost$/i,
  /^127\.[0-9]+\.[0-9]+\.[0-9]+$/,
  // Loopback
  /^10\.[0-9]+\.[0-9]+\.[0-9]+$/,
  // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]+\.[0-9]+$/,
  // Class B private
  /^192\.168\.[0-9]+\.[0-9]+$/,
  // Class C private
  /^169\.254\.[0-9]+\.[0-9]+$/,
  // Link-local
  /^(0|22[4-9]|23[0-9])\.[0-9]+\.[0-9]+\.[0-9]+$/,
  // Multicast, reserved
  /^\[?::1\]?$/,
  // IPv6 loopback
  /^\[?fc00:/i,
  // IPv6 unique local
  /^\[?fe80:/i,
  // IPv6 link-local
  /^\[?::ffff:/i,
  // IPv6-mapped IPv4 (all private ranges accessible via this prefix)
  /^\[?0{0,4}:{0,2}ffff:/i
  // IPv6-mapped IPv4 expanded forms
];
var ALLOWED_SCHEMES = ["https:", "http:"];
function validateUrlForSSRF(urlString) {
  if (!urlString || typeof urlString !== "string") {
    return { allowed: false, reason: "URL is empty or invalid" };
  }
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return { allowed: false, reason: "Invalid URL format" };
  }
  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return { allowed: false, reason: `Protocol '${parsed.protocol}' is not allowed` };
  }
  const hostname2 = parsed.hostname.toLowerCase();
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(hostname2)) {
      return {
        allowed: false,
        reason: `Hostname '${hostname2}' resolves to a blocked internal/private address`
      };
    }
  }
  if (/^0x[0-9a-f]+$/i.test(hostname2)) {
    return {
      allowed: false,
      reason: `Hostname '${hostname2}' looks like a hex-encoded IP address`
    };
  }
  if (/^\d+$/.test(hostname2) && hostname2.length > 3) {
    return {
      allowed: false,
      reason: `Hostname '${hostname2}' looks like a decimal-encoded IP address`
    };
  }
  if (/^0\d+\./.test(hostname2)) {
    return {
      allowed: false,
      reason: `Hostname '${hostname2}' looks like an octal-encoded IP address`
    };
  }
  if (parsed.username || parsed.password) {
    return { allowed: false, reason: "URLs with embedded credentials are not allowed" };
  }
  const dangerousPaths = [
    "/metadata",
    "/meta-data",
    "/latest/meta-data",
    "/computeMetadata"
  ];
  const pathLower = parsed.pathname.toLowerCase();
  for (const dangerous of dangerousPaths) {
    if (pathLower.startsWith(dangerous)) {
      return {
        allowed: false,
        reason: `Path '${parsed.pathname}' is blocked (cloud metadata access)`
      };
    }
  }
  return { allowed: true };
}
function validateAnthropicBaseUrl(urlString) {
  const result = validateUrlForSSRF(urlString);
  if (!result.allowed) {
    return result;
  }
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return { allowed: false, reason: "Invalid URL" };
  }
  if (parsed.protocol === "http:") {
    console.warn("[SSRF Guard] Warning: Using HTTP instead of HTTPS for ANTHROPIC_BASE_URL");
  }
  return { allowed: true };
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/config/models.js
var TIER_ENV_KEYS = {
  LOW: [
    "OMC_MODEL_LOW",
    "CLAUDE_CODE_BEDROCK_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL"
  ],
  MEDIUM: [
    "OMC_MODEL_MEDIUM",
    "CLAUDE_CODE_BEDROCK_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL"
  ],
  HIGH: [
    "OMC_MODEL_HIGH",
    "CLAUDE_CODE_BEDROCK_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL"
  ]
};
var CLAUDE_FAMILY_DEFAULTS = {
  HAIKU: "claude-haiku-4-5",
  SONNET: "claude-sonnet-5",
  OPUS: "claude-opus-4-8",
  FABLE: "claude-fable-5"
};
var BUILTIN_TIER_MODEL_DEFAULTS = {
  LOW: CLAUDE_FAMILY_DEFAULTS.HAIKU,
  MEDIUM: CLAUDE_FAMILY_DEFAULTS.SONNET,
  HIGH: CLAUDE_FAMILY_DEFAULTS.OPUS
};
var CLAUDE_FAMILY_HIGH_VARIANTS = {
  HAIKU: `${CLAUDE_FAMILY_DEFAULTS.HAIKU}-high`,
  SONNET: `${CLAUDE_FAMILY_DEFAULTS.SONNET}-high`,
  OPUS: `${CLAUDE_FAMILY_DEFAULTS.OPUS}-high`,
  FABLE: `${CLAUDE_FAMILY_DEFAULTS.FABLE}-high`
};
var BUILTIN_EXTERNAL_MODEL_DEFAULTS = {
  codexModel: "gpt-5.3-codex",
  geminiModel: "gemini-3.1-pro-preview",
  antigravityModel: "Gemini 3.1 Pro (High)"
};
function readEnvValue(key) {
  const value = process.env[key]?.trim();
  return value || void 0;
}
function resolveTierModelFromEnv(tier) {
  for (const key of TIER_ENV_KEYS[tier]) {
    const value = readEnvValue(key);
    if (value) {
      return value;
    }
  }
  return void 0;
}
function getDefaultModelHigh() {
  return resolveTierModelFromEnv("HIGH") || BUILTIN_TIER_MODEL_DEFAULTS.HIGH;
}
function getDefaultModelMedium() {
  return resolveTierModelFromEnv("MEDIUM") || BUILTIN_TIER_MODEL_DEFAULTS.MEDIUM;
}
function getDefaultModelLow() {
  return resolveTierModelFromEnv("LOW") || BUILTIN_TIER_MODEL_DEFAULTS.LOW;
}
function getDefaultTierModels() {
  return {
    LOW: getDefaultModelLow(),
    MEDIUM: getDefaultModelMedium(),
    HIGH: getDefaultModelHigh()
  };
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/config/loader.js
function buildDefaultConfig() {
  const defaultTierModels = getDefaultTierModels();
  return {
    agents: {
      omc: { model: defaultTierModels.HIGH },
      explore: { model: defaultTierModels.LOW },
      analyst: { model: defaultTierModels.HIGH },
      planner: { model: defaultTierModels.HIGH },
      architect: { model: defaultTierModels.HIGH },
      debugger: { model: defaultTierModels.MEDIUM },
      executor: { model: defaultTierModels.MEDIUM },
      verifier: { model: defaultTierModels.MEDIUM },
      securityReviewer: { model: defaultTierModels.MEDIUM },
      codeReviewer: { model: defaultTierModels.HIGH },
      testEngineer: { model: defaultTierModels.MEDIUM },
      designer: { model: defaultTierModels.MEDIUM },
      writer: { model: defaultTierModels.LOW },
      qaTester: { model: defaultTierModels.MEDIUM },
      scientist: { model: defaultTierModels.MEDIUM },
      tracer: { model: defaultTierModels.MEDIUM },
      gitMaster: { model: defaultTierModels.MEDIUM },
      codeSimplifier: { model: defaultTierModels.HIGH },
      critic: { model: defaultTierModels.HIGH },
      documentSpecialist: { model: defaultTierModels.MEDIUM }
    },
    features: {
      parallelExecution: true,
      lspTools: true,
      // Real LSP integration with language servers
      astTools: true,
      // Real AST tools using ast-grep
      continuationEnforcement: true,
      autoContextInjection: true
    },
    mcpServers: {
      exa: { enabled: true },
      context7: { enabled: true }
    },
    companyContext: {
      onError: "warn"
    },
    permissions: {
      allowBash: true,
      allowEdit: true,
      allowWrite: true,
      maxBackgroundTasks: 5
    },
    magicKeywords: {
      ultrawork: ["ultrawork", "ulw", "uw"],
      search: ["search", "find", "locate"],
      analyze: ["analyze", "investigate", "examine"],
      ultrathink: ["ultrathink", "think", "reason", "ponder"]
    },
    // Intelligent model routing configuration
    routing: {
      enabled: true,
      defaultTier: "MEDIUM",
      forceInherit: false,
      escalationEnabled: true,
      maxEscalations: 2,
      tierModels: { ...defaultTierModels },
      agentOverrides: {
        architect: {
          tier: "HIGH",
          reason: "Advisory agent requires deep reasoning"
        },
        planner: {
          tier: "HIGH",
          reason: "Strategic planning requires deep reasoning"
        },
        critic: {
          tier: "HIGH",
          reason: "Critical review requires deep reasoning"
        },
        analyst: {
          tier: "HIGH",
          reason: "Pre-planning analysis requires deep reasoning"
        },
        explore: { tier: "LOW", reason: "Exploration is search-focused" },
        writer: { tier: "LOW", reason: "Documentation is straightforward" }
      },
      escalationKeywords: [
        "critical",
        "production",
        "urgent",
        "security",
        "breaking",
        "architecture",
        "refactor",
        "redesign",
        "root cause"
      ],
      simplificationKeywords: [
        "find",
        "list",
        "show",
        "where",
        "search",
        "locate",
        "grep"
      ]
    },
    // External models configuration (Codex, Gemini)
    // Static defaults only — env var overrides applied in loadEnvConfig()
    externalModels: {
      defaults: {
        codexModel: BUILTIN_EXTERNAL_MODEL_DEFAULTS.codexModel,
        geminiModel: BUILTIN_EXTERNAL_MODEL_DEFAULTS.geminiModel,
        antigravityModel: BUILTIN_EXTERNAL_MODEL_DEFAULTS.antigravityModel
      },
      fallbackPolicy: {
        onModelFailure: "provider_chain",
        allowCrossProvider: false,
        crossProviderOrder: ["codex", "gemini"]
      }
    },
    // Delegation routing configuration (opt-in feature for external model routing)
    delegationRouting: {
      enabled: false,
      defaultProvider: "claude",
      roles: {}
    },
    // /team role routing (Option E — /team-scoped per-role provider & model)
    // Empty defaults: zero behavior change until user opts in.
    team: {
      ops: {},
      roleRouting: {}
    },
    autopilot: {
      execution: "solo"
    },
    planOutput: {
      directory: ".omc/plans",
      filenameTemplate: "{{name}}.md"
    },
    teleport: {
      symlinkNodeModules: true
    },
    startupCodebaseMap: {
      enabled: true,
      maxFiles: 200,
      maxDepth: 4
    },
    taskSizeDetection: {
      enabled: true,
      smallWordLimit: 50,
      largeWordLimit: 200,
      suppressHeavyModesForSmallTasks: true
    },
    promptPrerequisites: {
      enabled: true,
      sectionNames: {
        memory: ["M\xC9MOIRE", "MEMOIRE", "MEMORY"],
        skills: ["SKILLS"],
        verifyFirst: ["VERIFY-FIRST", "VERIFY FIRST", "VERIFY_FIRST"],
        context: ["CONTEXT"]
      },
      blockingTools: ["Edit", "MultiEdit", "Write", "Agent", "Task"],
      executionKeywords: ["ralph", "ultrawork", "autopilot"]
    }
  };
}
var DEFAULT_CONFIG2 = buildDefaultConfig();
var CANONICAL_TEAM_ROLE_SET = new Set(CANONICAL_TEAM_ROLES);
var CURSOR_EXECUTOR_TEAM_ROLE_SET = new Set(CURSOR_EXECUTOR_TEAM_ROLES);
var KNOWN_AGENT_NAME_SET = new Set(KNOWN_AGENT_NAMES);

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hooks/ralph/stale-prd.js
var DEFAULT_STALE_PRD_AFTER_MS = 2 * 60 * 60 * 1e3;
var GIT_MAX_BUFFER = 1024 * 1024;

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/lib/mode-names.js
var MODE_NAMES = {
  AUTOPILOT: "autopilot",
  AUTORESEARCH: "autoresearch",
  TEAM: "team",
  RALPH: "ralph",
  ULTRAWORK: "ultrawork",
  RALPLAN: "ralplan",
  DEEP_INTERVIEW: "deep-interview",
  MERGE_READINESS: "merge-readiness",
  SELF_IMPROVE: "self-improve"
};
var ALL_MODE_NAMES = [
  MODE_NAMES.AUTOPILOT,
  MODE_NAMES.AUTORESEARCH,
  MODE_NAMES.TEAM,
  MODE_NAMES.RALPH,
  MODE_NAMES.ULTRAWORK,
  MODE_NAMES.RALPLAN,
  MODE_NAMES.DEEP_INTERVIEW,
  MODE_NAMES.MERGE_READINESS,
  MODE_NAMES.SELF_IMPROVE
];
var MODE_STATE_FILE_MAP = {
  [MODE_NAMES.AUTOPILOT]: "autopilot-state.json",
  [MODE_NAMES.AUTORESEARCH]: "autoresearch-state.json",
  [MODE_NAMES.TEAM]: "team-state.json",
  [MODE_NAMES.RALPH]: "ralph-state.json",
  [MODE_NAMES.ULTRAWORK]: "ultrawork-state.json",
  [MODE_NAMES.RALPLAN]: "ralplan-state.json",
  [MODE_NAMES.DEEP_INTERVIEW]: "deep-interview-state.json",
  [MODE_NAMES.MERGE_READINESS]: "merge-readiness-state.json",
  [MODE_NAMES.SELF_IMPROVE]: "self-improve-state.json"
};
var SESSION_END_MODE_STATE_FILES = [
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.AUTOPILOT], mode: MODE_NAMES.AUTOPILOT },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.AUTORESEARCH], mode: MODE_NAMES.AUTORESEARCH },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.TEAM], mode: MODE_NAMES.TEAM },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.RALPH], mode: MODE_NAMES.RALPH },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.ULTRAWORK], mode: MODE_NAMES.ULTRAWORK },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.RALPLAN], mode: MODE_NAMES.RALPLAN },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.DEEP_INTERVIEW], mode: MODE_NAMES.DEEP_INTERVIEW },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.SELF_IMPROVE], mode: MODE_NAMES.SELF_IMPROVE },
  { file: "skill-active-state.json", mode: "skill-active" }
];
var SESSION_METRICS_MODE_FILES = [
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.AUTOPILOT], mode: MODE_NAMES.AUTOPILOT },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.AUTORESEARCH], mode: MODE_NAMES.AUTORESEARCH },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.RALPH], mode: MODE_NAMES.RALPH },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.ULTRAWORK], mode: MODE_NAMES.ULTRAWORK },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.RALPLAN], mode: MODE_NAMES.RALPLAN },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.DEEP_INTERVIEW], mode: MODE_NAMES.DEEP_INTERVIEW },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.MERGE_READINESS], mode: MODE_NAMES.MERGE_READINESS },
  { file: MODE_STATE_FILE_MAP[MODE_NAMES.SELF_IMPROVE], mode: MODE_NAMES.SELF_IMPROVE }
];

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hooks/mode-registry/index.js
var MODE_CONFIGS = {
  [MODE_NAMES.AUTOPILOT]: {
    name: "Autopilot",
    stateFile: MODE_STATE_FILE_MAP[MODE_NAMES.AUTOPILOT],
    activeProperty: "active"
  },
  [MODE_NAMES.AUTORESEARCH]: {
    name: "Autoresearch",
    stateFile: MODE_STATE_FILE_MAP[MODE_NAMES.AUTORESEARCH],
    activeProperty: "active",
    hasGlobalState: false
  },
  [MODE_NAMES.TEAM]: {
    name: "Team",
    stateFile: MODE_STATE_FILE_MAP[MODE_NAMES.TEAM],
    activeProperty: "active",
    hasGlobalState: false
  },
  [MODE_NAMES.RALPH]: {
    name: "Ralph",
    stateFile: MODE_STATE_FILE_MAP[MODE_NAMES.RALPH],
    markerFile: "ralph-verification.json",
    activeProperty: "active",
    hasGlobalState: false
  },
  [MODE_NAMES.ULTRAWORK]: {
    name: "Ultrawork",
    stateFile: MODE_STATE_FILE_MAP[MODE_NAMES.ULTRAWORK],
    activeProperty: "active",
    hasGlobalState: false
  },
  [MODE_NAMES.DEEP_INTERVIEW]: {
    name: "Deep Interview",
    stateFile: MODE_STATE_FILE_MAP[MODE_NAMES.DEEP_INTERVIEW],
    activeProperty: "active"
  },
  [MODE_NAMES.MERGE_READINESS]: {
    name: "Merge Readiness",
    stateFile: MODE_STATE_FILE_MAP[MODE_NAMES.MERGE_READINESS],
    activeProperty: "active"
  },
  [MODE_NAMES.SELF_IMPROVE]: {
    name: "Self Improve",
    stateFile: MODE_STATE_FILE_MAP[MODE_NAMES.SELF_IMPROVE],
    activeProperty: "active"
  }
};
var EXCLUSIVE_MODES = [MODE_NAMES.AUTOPILOT, MODE_NAMES.AUTORESEARCH];
var WORKFLOW_SLOT_TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1e3;

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hooks/autopilot/pipeline.js
var WORKFLOW_STAGE_SEQUENCES = [
  ["ralplan", "execution"],
  ["ralplan", "execution", "ralph"],
  ["ralplan", "execution", "qa"],
  ["ralplan", "execution", "ralph", "qa"]
];
function isWorkflowStageSequence(stages) {
  return WORKFLOW_STAGE_SEQUENCES.some((sequence) => stages.length === sequence.length && stages.every((stage, index) => stage === sequence[index]));
}
var RESERVED_WORKFLOW_NAMES = /* @__PURE__ */ new Set([
  "autopilot",
  "ralplan",
  "execution",
  "ralph",
  "qa",
  "autoresearch",
  "ultraqa",
  "merge-readiness",
  "self-improve",
  "ultrawork",
  "ultragoal",
  "ultrapilot",
  "swarm",
  "pipeline",
  "plan",
  "team",
  "cancel",
  "deep-interview",
  "deepsearch",
  "ultrathink",
  "tdd",
  "code-review",
  "security-review",
  "analyze",
  "search",
  "default"
]);
function canonicalizeJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("Canonical JSON requires finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`).join(",")}}`;
  }
  throw new TypeError("Canonical JSON requires JSON-compatible values");
}
function normalizeWorkflowProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile))
    return null;
  const record = profile;
  if (record.version !== 1 || !Array.isArray(record.stages))
    return null;
  if (Object.keys(record).some((key) => key !== "version" && key !== "stages"))
    return null;
  const stages = record.stages;
  if (!stages.every((stage) => typeof stage === "string"))
    return null;
  if (!isWorkflowStageSequence(stages))
    return null;
  return {
    version: 1,
    stages: [...stages]
  };
}
function createWorkflowDescriptor(workflowName, profile) {
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(workflowName) || RESERVED_WORKFLOW_NAMES.has(workflowName))
    return null;
  const normalized = normalizeWorkflowProfile(profile);
  if (!normalized)
    return null;
  const canonical = canonicalizeJson({
    descriptorVersion: 1,
    workflowName,
    profileVersion: 1,
    stages: normalized.stages
  });
  return {
    descriptorVersion: 1,
    workflowName,
    profileVersion: 1,
    stages: normalized.stages,
    profileHash: createHash2("sha256").update(canonical).digest("hex")
  };
}
function verifyWorkflowDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor))
    return false;
  const record = descriptor;
  const expectedKeys = [
    "descriptorVersion",
    "profileHash",
    "profileVersion",
    "stages",
    "workflowName"
  ];
  if (Object.keys(record).length !== expectedKeys.length || expectedKeys.some((key) => !(key in record)) || record.descriptorVersion !== 1 || typeof record.workflowName !== "string" || typeof record.profileHash !== "string") {
    return false;
  }
  const expected = createWorkflowDescriptor(record.workflowName, {
    version: record.profileVersion,
    stages: record.stages
  });
  return expected !== null && expected.profileHash === record.profileHash;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hooks/autopilot/named-workflow-resume-validator.js
var NAMED_SIGNALS = {
  ralplan: "PIPELINE_RALPLAN_COMPLETE",
  execution: "PIPELINE_EXECUTION_COMPLETE",
  ralph: "PIPELINE_RALPH_COMPLETE",
  qa: "PIPELINE_QA_COMPLETE"
};
var TRANSCRIPT_CHUNK_BYTES = 64 * 1024;
var MAX_JSONL_RECORD_BYTES = 8 * 1024 * 1024;
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function safeInteger(value) {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
function timestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function validFileIdentity(value) {
  return isRecord(value) && exactKeys(value, [
    "device",
    "inode",
    "size",
    "mtimeNs",
    "ctimeNs",
    "contentSha256"
  ]) && safeInteger(value.device) && safeInteger(value.inode) && safeInteger(value.size) && typeof value.mtimeNs === "string" && /^\d+$/.test(value.mtimeNs) && typeof value.ctimeNs === "string" && /^\d+$/.test(value.ctimeNs) && typeof value.contentSha256 === "string" && /^[a-f0-9]{64}$/.test(value.contentSha256);
}
function validBoundaryShape(value, sessionId) {
  if (!isRecord(value) || !exactKeys(value, [
    "transcriptPath",
    "transcriptRoot",
    "transcriptBasename",
    "sessionId",
    "byteOffset",
    "fileIdentity"
  ]) || typeof sessionId !== "string" || value.sessionId !== sessionId || typeof value.transcriptRoot !== "string" || resolve2(value.transcriptRoot) !== value.transcriptRoot || typeof value.transcriptPath !== "string" || resolve2(value.transcriptPath) !== value.transcriptPath || basename4(value.transcriptPath) !== `${sessionId}.jsonl` || value.transcriptBasename !== `${sessionId}.jsonl` || !safeInteger(value.byteOffset) || !validFileIdentity(value.fileIdentity) || value.fileIdentity.size !== value.byteOffset)
    return false;
  const relativePath = relative2(value.transcriptRoot, value.transcriptPath);
  return relativePath.length > 0 && relativePath !== ".." && !relativePath.startsWith(`..${sep3}`);
}
function validateNamedWorkflowStateStructure(state, sessionId) {
  if (!Object.prototype.hasOwnProperty.call(state, "workflow") || !Object.prototype.hasOwnProperty.call(state, "workflowRunId") || !Object.prototype.hasOwnProperty.call(state, "pipelineTracking"))
    return null;
  const workflow = state.workflow;
  const tracking = state.pipelineTracking;
  const task = typeof state.prompt === "string" ? state.prompt.trim() : "";
  if (!verifyWorkflowDescriptor(workflow) || typeof sessionId !== "string" || typeof state.session_id !== "string" || state.session_id !== sessionId || !isRecord(tracking) || task.length === 0 || typeof state.active !== "boolean" || typeof state.workflowRunId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(state.workflowRunId))
    return null;
  const terminal = state.phase === "complete";
  if (terminal && state.active)
    return null;
  const maximumStageIndex = terminal ? workflow.stages.length : workflow.stages.length - 1;
  if (!exactKeys(tracking, ["stages", "currentStageIndex", "trackingRevision", "activationBoundary", "completionObservations"]) || !Array.isArray(tracking.stages) || !Array.isArray(tracking.completionObservations) || !safeInteger(tracking.currentStageIndex) || !safeInteger(tracking.trackingRevision) || tracking.currentStageIndex > maximumStageIndex || tracking.trackingRevision !== tracking.currentStageIndex || tracking.completionObservations.length !== tracking.currentStageIndex || terminal && (tracking.currentStageIndex !== workflow.stages.length || tracking.trackingRevision !== workflow.stages.length || tracking.completionObservations.length !== workflow.stages.length) || !validBoundaryShape(tracking.activationBoundary, sessionId) || tracking.stages.length !== workflow.stages.length)
    return null;
  for (let index = 0; index < tracking.stages.length; index += 1) {
    const stage = tracking.stages[index];
    if (!isRecord(stage))
      return null;
    const status = terminal ? "complete" : index < tracking.currentStageIndex ? "complete" : index === tracking.currentStageIndex ? "active" : "pending";
    const keys = status === "complete" ? ["id", "status", "iterations", "startedAt", "completedAt"] : status === "active" ? ["id", "status", "iterations", "startedAt"] : ["id", "status", "iterations"];
    if (!exactKeys(stage, keys) || stage.id !== workflow.stages[index] || stage.status !== status || !safeInteger(stage.iterations) || stage.startedAt !== void 0 && !timestamp(stage.startedAt) || stage.completedAt !== void 0 && !timestamp(stage.completedAt))
      return null;
  }
  let previousObservation = null;
  for (let index = 0; index < tracking.completionObservations.length; index += 1) {
    const observation = tracking.completionObservations[index];
    if (!isRecord(observation) || !exactKeys(observation, ["stageId", "sessionId", "signalId", "lineNumber", "byteOffset", "recordContentSha256", "stableFile", "activationBoundary", "observedAt"]) || observation.stageId !== workflow.stages[index] || observation.sessionId !== sessionId || observation.signalId !== NAMED_SIGNALS[String(observation.stageId)] || !safeInteger(observation.lineNumber) || !safeInteger(observation.byteOffset) || typeof observation.recordContentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(observation.recordContentSha256) || !validFileIdentity(observation.stableFile) || !validBoundaryShape(observation.activationBoundary, sessionId) || !timestamp(observation.observedAt))
      return null;
    const boundary = observation.activationBoundary;
    const stable = observation.stableFile;
    if (Number(observation.byteOffset) < Number(boundary.byteOffset) || Number(stable.size) <= Number(observation.byteOffset))
      return null;
    if (previousObservation) {
      const previousBoundary = previousObservation.activationBoundary;
      const previousStable = previousObservation.stableFile;
      if (boundary.transcriptPath !== previousBoundary.transcriptPath || boundary.byteOffset !== previousStable.size || JSON.stringify(boundary.fileIdentity) !== JSON.stringify(previousStable))
        return null;
    }
    previousObservation = observation;
  }
  if (previousObservation) {
    const current = tracking.activationBoundary;
    const stable = previousObservation.stableFile;
    const boundary = previousObservation.activationBoundary;
    if (current.transcriptPath !== boundary.transcriptPath || current.byteOffset !== stable.size || JSON.stringify(current.fileIdentity) !== JSON.stringify(stable))
      return null;
  }
  if (terminal ? state.phase !== "complete" : state.phase !== workflow.stages[tracking.currentStageIndex])
    return null;
  return { tracking, task };
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/omc-state.js
var MAX_STATE_AGE_MS = 2 * 60 * 60 * 1e3;
function isStateFileStale(filePath) {
  try {
    const stat = statSync4(filePath);
    const age = Date.now() - stat.mtimeMs;
    return age > MAX_STATE_AGE_MS;
  } catch {
    return true;
  }
}
function resolveStatePath2(directory, filename, sessionId) {
  const omcRoot = getOmcRoot(directory);
  if (sessionId) {
    const sessionPath = join9(omcRoot, "state", "sessions", sessionId, filename);
    return existsSync7(sessionPath) ? sessionPath : null;
  }
  let bestPath = null;
  let bestMtime = 0;
  const sessionsDir = join9(omcRoot, "state", "sessions");
  if (existsSync7(sessionsDir)) {
    try {
      const entries = readdirSync3(sessionsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory())
          continue;
        const sessionFile = join9(sessionsDir, entry.name, filename);
        if (existsSync7(sessionFile)) {
          try {
            const mtime = statSync4(sessionFile).mtimeMs;
            if (mtime > bestMtime) {
              bestMtime = mtime;
              bestPath = sessionFile;
            }
          } catch {
          }
        }
      }
    } catch {
    }
  }
  const newPath = join9(omcRoot, "state", filename);
  if (existsSync7(newPath)) {
    try {
      const mtime = statSync4(newPath).mtimeMs;
      if (mtime > bestMtime) {
        bestMtime = mtime;
        bestPath = newPath;
      }
    } catch {
      if (!bestPath)
        bestPath = newPath;
    }
  }
  const legacyPath = join9(omcRoot, filename);
  if (existsSync7(legacyPath)) {
    try {
      const mtime = statSync4(legacyPath).mtimeMs;
      if (mtime > bestMtime) {
        bestPath = legacyPath;
      }
    } catch {
      if (!bestPath)
        bestPath = legacyPath;
    }
  }
  return bestPath;
}
function readRalphStateForHud(directory, sessionId) {
  const stateFile = resolveStatePath2(directory, "ralph-state.json", sessionId);
  if (!stateFile) {
    return null;
  }
  if (isStateFileStale(stateFile)) {
    return null;
  }
  try {
    const content = readFileSync7(stateFile, "utf-8");
    const state = JSON.parse(content);
    if (!state.active) {
      return null;
    }
    return {
      active: state.active,
      iteration: state.iteration,
      maxIterations: state.max_iterations,
      prdMode: state.prd_mode,
      currentStoryId: state.current_story_id
    };
  } catch {
    return null;
  }
}
function readUltraworkStateForHud(directory, sessionId) {
  const localFile = resolveStatePath2(directory, "ultrawork-state.json", sessionId);
  if (!localFile || isStateFileStale(localFile)) {
    return null;
  }
  try {
    const content = readFileSync7(localFile, "utf-8");
    const state = JSON.parse(content);
    if (!state.active) {
      return null;
    }
    return {
      active: state.active,
      reinforcementCount: state.reinforcement_count
    };
  } catch {
    return null;
  }
}
function readPrdStateForHud(directory) {
  let prdPath = join9(directory, "prd.json");
  if (!existsSync7(prdPath)) {
    prdPath = join9(getOmcRoot(directory), "prd.json");
    if (!existsSync7(prdPath)) {
      return null;
    }
  }
  try {
    const content = readFileSync7(prdPath, "utf-8");
    const prd = JSON.parse(content);
    if (!prd.userStories || !Array.isArray(prd.userStories)) {
      return null;
    }
    const stories = prd.userStories;
    const completed = stories.filter((s) => s.passes).length;
    const total = stories.length;
    const incomplete = stories.filter((s) => !s.passes).sort((a, b) => a.priority - b.priority);
    return {
      currentStoryId: incomplete[0]?.id || null,
      completed,
      total
    };
  } catch {
    return null;
  }
}
function hasNamedWorkflowMarker(state) {
  const record = state;
  return ["workflow", "workflowRunId", "pipelineTracking"].some((marker) => Object.prototype.hasOwnProperty.call(record, marker));
}
function getWorkflowHudState(state) {
  if (!hasNamedWorkflowMarker(state)) {
    return void 0;
  }
  const record = state;
  const sessionId = typeof record.session_id === "string" ? record.session_id : void 0;
  if (!sessionId || !validateNamedWorkflowStateStructure(state, sessionId)) {
    return { invalid: true };
  }
  const workflow = state.workflow;
  const pipelineTracking = state.pipelineTracking;
  const currentStageIndex = pipelineTracking.currentStageIndex;
  const currentStage = pipelineTracking.stages[currentStageIndex]?.id;
  return {
    name: workflow.workflowName,
    version: workflow.profileVersion,
    shortHash: workflow.profileHash.slice(0, 12),
    currentStage: currentStage ?? "complete",
    currentStageIndex: Math.min(currentStageIndex + 1, workflow.stages.length),
    stagesTotal: workflow.stages.length
  };
}
function readAutopilotStateForHud(directory, sessionId) {
  const stateFile = resolveStatePath2(directory, "autopilot-state.json", sessionId);
  if (!stateFile) {
    return null;
  }
  if (isStateFileStale(stateFile)) {
    return null;
  }
  try {
    const content = readFileSync7(stateFile, "utf-8");
    const state = JSON.parse(content);
    if (!state.active) {
      return null;
    }
    const phase = state.phase ?? state.current_phase;
    if (!phase) {
      return null;
    }
    return {
      active: state.active,
      phase,
      iteration: state.iteration,
      maxIterations: state.max_iterations,
      tasksCompleted: state.execution?.tasks_completed,
      tasksTotal: state.execution?.tasks_total,
      filesCreated: state.execution?.files_created?.length,
      workflow: getWorkflowHudState(state)
    };
  } catch {
    return null;
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/usage-api.js
import { existsSync as existsSync8, readFileSync as readFileSync8, writeFileSync as writeFileSync3, renameSync as renameSync3, unlinkSync as unlinkSync5, mkdirSync as mkdirSync6 } from "fs";
import { join as join10, dirname as dirname6 } from "path";
import { execFileSync as execFileSync3 } from "child_process";
import { createHash as createHash3 } from "crypto";
import { userInfo } from "os";
import https from "https";
var CACHE_TTL_FAILURE_MS = 15 * 1e3;
var CACHE_TTL_TRANSIENT_NETWORK_MS = 2 * 60 * 1e3;
var MAX_RATE_LIMITED_BACKOFF_MS = 5 * 60 * 1e3;
var API_TIMEOUT_MS = 1e4;
var MAX_STALE_DATA_MS = 15 * 60 * 1e3;
var TOKEN_REFRESH_URL_HOSTNAME = "platform.claude.com";
var USAGE_CACHE_LOCK_OPTS = { staleLockMs: API_TIMEOUT_MS + 5e3 };
var TOKEN_REFRESH_URL_PATH = "/v1/oauth/token";
var DEFAULT_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
function isEnterpriseUsageContext(options) {
  if (!options)
    return true;
  const subscriptionType = options.subscriptionType?.toLowerCase() ?? null;
  const rateLimitTier = options.rateLimitTier ?? null;
  if (subscriptionType == null && rateLimitTier == null)
    return true;
  return subscriptionType === "enterprise" || /claude_zero/i.test(rateLimitTier ?? "");
}
var ZAI_UNIT_WEEK = 6;
function isZaiHost(urlString) {
  try {
    const url = new URL(urlString);
    const hostname2 = url.hostname.toLowerCase();
    return hostname2 === "z.ai" || hostname2.endsWith(".z.ai");
  } catch {
    return false;
  }
}
function isMinimaxHost(urlString) {
  try {
    const url = new URL(urlString);
    const hostname2 = url.hostname.toLowerCase();
    return hostname2 === "minimax.io" || hostname2.endsWith(".minimax.io") || hostname2 === "minimaxi.com" || hostname2.endsWith(".minimaxi.com") || hostname2 === "minimax.com" || hostname2.endsWith(".minimax.com");
  } catch {
    return false;
  }
}
function isKimiHost(urlString) {
  try {
    const url = new URL(urlString);
    const hostname2 = url.hostname.toLowerCase();
    return hostname2 === "kimi.com" || hostname2.endsWith(".kimi.com");
  } catch {
    return false;
  }
}
var KIMI_USAGE_HOSTNAMES = /* @__PURE__ */ new Set(["api.kimi.com", "kimi.com"]);
var KIMI_USAGE_PATH = "/coding/v1/usages";
function getLegacyCachePath() {
  return join10(getClaudeConfigDir(), "plugins", "oh-my-claudecode", ".usage-cache.json");
}
function getCachePath(source) {
  return join10(getClaudeConfigDir(), "plugins", "oh-my-claudecode", `.usage-cache-${source}.json`);
}
function migrateLegacyCache(source) {
  try {
    const legacyPath = getLegacyCachePath();
    if (!existsSync8(legacyPath))
      return;
    if (existsSync8(getCachePath(source)))
      return;
    const content = readFileSync8(legacyPath, "utf-8");
    const cache = JSON.parse(content);
    if (cache.source !== source)
      return;
    const newPath = getCachePath(source);
    const cacheDir = dirname6(newPath);
    if (!existsSync8(cacheDir)) {
      mkdirSync6(cacheDir, { recursive: true });
    }
    writeFileSync3(newPath, content);
  } catch {
  }
}
function readCache(source) {
  try {
    const cachePath = getCachePath(source);
    if (!existsSync8(cachePath))
      return null;
    const content = readFileSync8(cachePath, "utf-8");
    const cache = JSON.parse(content);
    if (cache.data) {
      if (cache.data.fiveHourResetsAt) {
        cache.data.fiveHourResetsAt = new Date(cache.data.fiveHourResetsAt);
      }
      if (cache.data.weeklyResetsAt) {
        cache.data.weeklyResetsAt = new Date(cache.data.weeklyResetsAt);
      }
      if (cache.data.sonnetWeeklyResetsAt) {
        cache.data.sonnetWeeklyResetsAt = new Date(cache.data.sonnetWeeklyResetsAt);
      }
      if (cache.data.opusWeeklyResetsAt) {
        cache.data.opusWeeklyResetsAt = new Date(cache.data.opusWeeklyResetsAt);
      }
      if (cache.data.monthlyResetsAt) {
        cache.data.monthlyResetsAt = new Date(cache.data.monthlyResetsAt);
      }
      if (cache.data.extraUsageResetsAt) {
        cache.data.extraUsageResetsAt = new Date(cache.data.extraUsageResetsAt);
      }
      if (Array.isArray(cache.data.scopedWeeklyBuckets)) {
        for (const bucket of cache.data.scopedWeeklyBuckets) {
          const rawResetsAt = bucket?.resetsAt;
          if (rawResetsAt == null || rawResetsAt instanceof Date)
            continue;
          const parsedResetsAt = new Date(rawResetsAt);
          bucket.resetsAt = isNaN(parsedResetsAt.getTime()) ? null : parsedResetsAt;
        }
      }
    }
    return cache;
  } catch {
    return null;
  }
}
function writeCache(opts) {
  try {
    const cachePath = getCachePath(opts.source);
    const cacheDir = dirname6(cachePath);
    if (!existsSync8(cacheDir)) {
      mkdirSync6(cacheDir, { recursive: true });
    }
    const cache = {
      timestamp: Date.now(),
      data: opts.data,
      error: opts.error,
      errorReason: opts.errorReason,
      source: opts.source,
      rateLimited: opts.rateLimited || void 0,
      rateLimitedCount: opts.rateLimitedCount && opts.rateLimitedCount > 0 ? opts.rateLimitedCount : void 0,
      rateLimitedUntil: opts.rateLimitedUntil,
      lastSuccessAt: opts.lastSuccessAt
    };
    writeFileSync3(cachePath, JSON.stringify(cache, null, 2));
  } catch {
  }
}
function sanitizePollIntervalMs(value) {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_HUD_USAGE_POLL_INTERVAL_MS;
  }
  return Math.max(1e3, Math.floor(value));
}
function getUsagePollIntervalMs() {
  try {
    return sanitizePollIntervalMs(readHudConfig().usageApiPollIntervalMs);
  } catch {
    return DEFAULT_HUD_USAGE_POLL_INTERVAL_MS;
  }
}
function getRateLimitedBackoffMs(pollIntervalMs, count) {
  const normalizedPollIntervalMs = sanitizePollIntervalMs(pollIntervalMs);
  return Math.min(normalizedPollIntervalMs * Math.pow(2, Math.max(0, count - 1)), MAX_RATE_LIMITED_BACKOFF_MS);
}
function getTransientNetworkBackoffMs(pollIntervalMs) {
  return Math.max(CACHE_TTL_TRANSIENT_NETWORK_MS, sanitizePollIntervalMs(pollIntervalMs));
}
function isCacheValid(cache, pollIntervalMs) {
  if (cache.rateLimited) {
    if (cache.rateLimitedUntil != null) {
      return Date.now() < cache.rateLimitedUntil;
    }
    const count = cache.rateLimitedCount || 1;
    return Date.now() - cache.timestamp < getRateLimitedBackoffMs(pollIntervalMs, count);
  }
  const ttl = cache.error ? cache.errorReason === "network" ? getTransientNetworkBackoffMs(pollIntervalMs) : CACHE_TTL_FAILURE_MS : sanitizePollIntervalMs(pollIntervalMs);
  return Date.now() - cache.timestamp < ttl;
}
function hasUsableStaleData(cache) {
  if (!cache?.data) {
    return false;
  }
  if (cache.lastSuccessAt && Date.now() - cache.lastSuccessAt > MAX_STALE_DATA_MS) {
    return false;
  }
  return true;
}
function getCachedUsageResult(cache) {
  if (cache.rateLimited) {
    if (!hasUsableStaleData(cache) && cache.data) {
      return { rateLimits: null, error: "rate_limited" };
    }
    return { rateLimits: cache.data, error: "rate_limited", stale: cache.data ? true : void 0 };
  }
  if (cache.error) {
    const errorReason = cache.errorReason || "network";
    if (hasUsableStaleData(cache)) {
      return { rateLimits: cache.data, error: errorReason, stale: true };
    }
    return { rateLimits: null, error: errorReason };
  }
  return { rateLimits: cache.data };
}
function createRateLimitedCacheEntry(source, data, pollIntervalMs, previousCount, lastSuccessAt) {
  const timestamp2 = Date.now();
  const rateLimitedCount = previousCount + 1;
  return {
    timestamp: timestamp2,
    data,
    error: false,
    errorReason: "rate_limited",
    source,
    rateLimited: true,
    rateLimitedCount,
    rateLimitedUntil: timestamp2 + getRateLimitedBackoffMs(pollIntervalMs, rateLimitedCount),
    lastSuccessAt
  };
}
function getKeychainServiceName() {
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  if (configDir) {
    const hash = createHash3("sha256").update(configDir).digest("hex").slice(0, 8);
    return `Claude Code-credentials-${hash}`;
  }
  return "Claude Code-credentials";
}
function isCredentialExpired(creds) {
  return creds.expiresAt != null && creds.expiresAt <= Date.now();
}
function readKeychainCredential(serviceName, account) {
  try {
    const args = account ? ["find-generic-password", "-s", serviceName, "-a", account, "-w"] : ["find-generic-password", "-s", serviceName, "-w"];
    const result = execFileSync3("/usr/bin/security", args, {
      encoding: "utf-8",
      timeout: 2e3,
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    if (!result)
      return null;
    const parsed = JSON.parse(result);
    const creds = parsed.claudeAiOauth || parsed;
    if (!creds.accessToken)
      return null;
    return {
      accessToken: creds.accessToken,
      expiresAt: creds.expiresAt,
      refreshToken: creds.refreshToken,
      source: "keychain",
      keychainAccount: account ?? null,
      subscriptionType: creds.subscriptionType,
      rateLimitTier: creds.rateLimitTier
    };
  } catch {
    return null;
  }
}
function readKeychainCredentials() {
  if (process.platform !== "darwin")
    return null;
  const serviceName = getKeychainServiceName();
  const candidateAccounts = [];
  try {
    const username = userInfo().username?.trim();
    if (username) {
      candidateAccounts.push(username);
    }
  } catch {
  }
  candidateAccounts.push(void 0);
  let expiredFallback = null;
  for (const account of candidateAccounts) {
    const creds = readKeychainCredential(serviceName, account);
    if (!creds)
      continue;
    if (!isCredentialExpired(creds)) {
      return creds;
    }
    expiredFallback ??= creds;
  }
  return expiredFallback;
}
function readFileCredentials() {
  try {
    const credPath = join10(getClaudeConfigDir(), ".credentials.json");
    if (!existsSync8(credPath))
      return null;
    const content = readFileSync8(credPath, "utf-8");
    const parsed = JSON.parse(content);
    const creds = parsed.claudeAiOauth || parsed;
    if (creds.accessToken) {
      return {
        accessToken: creds.accessToken,
        expiresAt: creds.expiresAt,
        refreshToken: creds.refreshToken,
        source: "file",
        subscriptionType: creds.subscriptionType,
        rateLimitTier: creds.rateLimitTier
      };
    }
  } catch {
  }
  return null;
}
function getCredentials() {
  const keychainCreds = readKeychainCredentials();
  if (keychainCreds)
    return keychainCreds;
  return readFileCredentials();
}
function getSubscriptionInfo() {
  try {
    const creds = getCredentials();
    return {
      subscriptionType: creds?.subscriptionType ?? null,
      rateLimitTier: creds?.rateLimitTier ?? null
    };
  } catch {
    return { subscriptionType: null, rateLimitTier: null };
  }
}
function validateCredentials(creds) {
  if (!creds.accessToken)
    return false;
  return !isCredentialExpired(creds);
}
function refreshAccessToken(refreshToken) {
  return new Promise((resolve6) => {
    const clientId = process.env.CLAUDE_CODE_OAUTH_CLIENT_ID || DEFAULT_OAUTH_CLIENT_ID;
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId
    }).toString();
    const req = https.request({
      hostname: TOKEN_REFRESH_URL_HOSTNAME,
      path: TOKEN_REFRESH_URL_PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body)
      },
      timeout: API_TIMEOUT_MS
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            if (parsed.access_token) {
              resolve6({
                accessToken: parsed.access_token,
                refreshToken: parsed.refresh_token || refreshToken,
                expiresAt: parsed.expires_in ? Date.now() + parsed.expires_in * 1e3 : parsed.expires_at
              });
              return;
            }
          } catch {
          }
        }
        if (process.env.OMC_DEBUG) {
          console.error(`[usage-api] Token refresh failed: HTTP ${res.statusCode}`);
        }
        resolve6(null);
      });
    });
    req.on("error", () => resolve6(null));
    req.on("timeout", () => {
      req.destroy();
      resolve6(null);
    });
    req.end(body);
  });
}
function fetchUsageFromApi(accessToken) {
  return new Promise((resolve6) => {
    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/api/oauth/usage",
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json"
      },
      timeout: API_TIMEOUT_MS
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            resolve6({ data: JSON.parse(data) });
          } catch {
            resolve6({ data: null });
          }
        } else if (res.statusCode === 429) {
          if (process.env.OMC_DEBUG) {
            console.error(`[usage-api] Anthropic API returned 429 (rate limited)`);
          }
          resolve6({ data: null, rateLimited: true });
        } else {
          resolve6({ data: null });
        }
      });
    });
    req.on("error", () => resolve6({ data: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve6({ data: null });
    });
    req.end();
  });
}
function fetchUsageFromZai() {
  return new Promise((resolve6) => {
    const baseUrl = process.env.ANTHROPIC_BASE_URL;
    const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
    if (!baseUrl || !authToken) {
      resolve6({ data: null });
      return;
    }
    const validation = validateAnthropicBaseUrl(baseUrl);
    if (!validation.allowed) {
      console.error(`[SSRF Guard] Blocking usage API call: ${validation.reason}`);
      resolve6({ data: null });
      return;
    }
    try {
      const url = new URL(baseUrl);
      const baseDomain = `${url.protocol}//${url.host}`;
      const quotaLimitUrl = `${baseDomain}/api/monitor/usage/quota/limit`;
      const urlObj = new URL(quotaLimitUrl);
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: "GET",
        headers: {
          "Authorization": authToken,
          "Content-Type": "application/json",
          "Accept-Language": "en-US,en"
        },
        timeout: API_TIMEOUT_MS
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              resolve6({ data: JSON.parse(data) });
            } catch {
              resolve6({ data: null });
            }
          } else if (res.statusCode === 429) {
            if (process.env.OMC_DEBUG) {
              console.error(`[usage-api] z.ai API returned 429 (rate limited)`);
            }
            resolve6({ data: null, rateLimited: true });
          } else {
            resolve6({ data: null });
          }
        });
      });
      req.on("error", () => resolve6({ data: null }));
      req.on("timeout", () => {
        req.destroy();
        resolve6({ data: null });
      });
      req.end();
    } catch {
      resolve6({ data: null });
    }
  });
}
function writeKeychainCredentials(creds) {
  if (process.platform !== "darwin")
    return;
  try {
    const serviceName = getKeychainServiceName();
    const account = creds.keychainAccount ?? void 0;
    const readArgs = account ? ["find-generic-password", "-s", serviceName, "-a", account, "-w"] : ["find-generic-password", "-s", serviceName, "-w"];
    let existing = {};
    try {
      const raw = execFileSync3("/usr/bin/security", readArgs, {
        encoding: "utf-8",
        timeout: 2e3,
        stdio: ["pipe", "pipe", "pipe"]
      }).trim();
      if (raw)
        existing = JSON.parse(raw);
    } catch {
    }
    if (existing.claudeAiOauth && typeof existing.claudeAiOauth === "object") {
      const inner = existing.claudeAiOauth;
      inner.accessToken = creds.accessToken;
      if (creds.expiresAt != null)
        inner.expiresAt = creds.expiresAt;
      if (creds.refreshToken)
        inner.refreshToken = creds.refreshToken;
    } else {
      existing.accessToken = creds.accessToken;
      if (creds.expiresAt != null)
        existing.expiresAt = creds.expiresAt;
      if (creds.refreshToken)
        existing.refreshToken = creds.refreshToken;
    }
    const newJson = JSON.stringify(existing);
    const writeArgs = account ? ["add-generic-password", "-s", serviceName, "-a", account, "-w", newJson, "-U"] : ["add-generic-password", "-s", serviceName, "-w", newJson, "-U"];
    execFileSync3("/usr/bin/security", writeArgs, {
      encoding: "utf-8",
      timeout: 2e3,
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch {
    if (process.env.OMC_DEBUG) {
      console.error("[usage-api] Failed to write back refreshed credentials to Keychain");
    }
  }
}
function writeBackCredentials(creds) {
  if (creds.source === "keychain") {
    writeKeychainCredentials(creds);
    return;
  }
  try {
    const credPath = join10(getClaudeConfigDir(), ".credentials.json");
    if (!existsSync8(credPath))
      return;
    const content = readFileSync8(credPath, "utf-8");
    const parsed = JSON.parse(content);
    if (parsed.claudeAiOauth) {
      parsed.claudeAiOauth.accessToken = creds.accessToken;
      if (creds.expiresAt != null) {
        parsed.claudeAiOauth.expiresAt = creds.expiresAt;
      }
      if (creds.refreshToken) {
        parsed.claudeAiOauth.refreshToken = creds.refreshToken;
      }
    } else {
      parsed.accessToken = creds.accessToken;
      if (creds.expiresAt != null) {
        parsed.expiresAt = creds.expiresAt;
      }
      if (creds.refreshToken) {
        parsed.refreshToken = creds.refreshToken;
      }
    }
    const tmpPath = `${credPath}.tmp.${process.pid}`;
    try {
      writeFileSync3(tmpPath, JSON.stringify(parsed, null, 2), { mode: 384 });
      renameSync3(tmpPath, credPath);
    } catch (writeErr) {
      try {
        if (existsSync8(tmpPath)) {
          unlinkSync5(tmpPath);
        }
      } catch {
      }
      throw writeErr;
    }
  } catch {
    if (process.env.OMC_DEBUG) {
      console.error("[usage-api] Failed to write back refreshed credentials");
    }
  }
}
function clamp(v) {
  if (v == null || !isFinite(v))
    return 0;
  return Math.max(0, Math.min(100, v));
}
function resolveScopedWeeklyLimits(limits, parseDate) {
  const result = { generic: [] };
  if (!Array.isArray(limits))
    return result;
  const byKey = /* @__PURE__ */ new Map();
  for (const entry of limits) {
    if (!entry || typeof entry !== "object")
      continue;
    if (entry.kind !== "weekly_scoped")
      continue;
    if (typeof entry.percent !== "number" || !isFinite(entry.percent))
      continue;
    const displayName = entry.scope?.model?.display_name;
    if (typeof displayName !== "string" || displayName.trim() === "")
      continue;
    const key = displayName.trim().toLowerCase();
    const isActive = entry.is_active === true;
    const existing = byKey.get(key);
    if (!existing || isActive && !existing.isActive) {
      byKey.set(key, {
        percent: entry.percent,
        resetsAt: entry.resets_at,
        isActive,
        modelId: entry.scope?.model?.id,
        displayName: displayName.trim()
      });
    }
  }
  for (const bucket of byKey.values()) {
    const percent = clamp(bucket.percent);
    const resetsAt = parseDate(bucket.resetsAt);
    const lower = bucket.displayName.toLowerCase();
    const isSonnetFamily = lower.includes("sonnet");
    const isOpusFamily = lower.includes("opus");
    if (isSonnetFamily) {
      if (result.sonnet == null)
        result.sonnet = { percent, resetsAt };
    } else if (isOpusFamily) {
      if (result.opus == null)
        result.opus = { percent, resetsAt };
    } else {
      const id = typeof bucket.modelId === "string" && bucket.modelId.trim() !== "" ? bucket.modelId : lower;
      result.generic.push({ id, label: bucket.displayName, percent, resetsAt, isActive: bucket.isActive });
    }
  }
  return result;
}
function minorUnitDecimals(currency, decimalPlaces) {
  if (decimalPlaces != null && Number.isInteger(decimalPlaces) && decimalPlaces >= 0 && decimalPlaces <= 4) {
    return decimalPlaces;
  }
  if (currency === "USD")
    return 2;
  return null;
}
function parseUsageResponse(response, options) {
  const fiveHour = response.five_hour?.utilization;
  const sevenDay = response.seven_day?.utilization;
  const sonnetSevenDay = response.seven_day_sonnet?.utilization;
  const opusSevenDay = response.seven_day_opus?.utilization;
  const extra = response.extra_usage;
  const usedCredits = extra?.used_credits;
  const extraCurrency = (extra?.currency ?? "USD").toUpperCase();
  const minorDecimals = minorUnitDecimals(extraCurrency, extra?.decimal_places);
  const minorDivisor = minorDecimals == null ? null : 10 ** minorDecimals;
  const isEnterpriseContext = isEnterpriseUsageContext(options);
  const hasUsableEnterprise = isEnterpriseContext && usedCredits != null && minorDivisor != null;
  const hasUsableUsdExtraUsage = extra?.limit_usd != null && extra.limit_usd > 0;
  const hasUsableCreditExtraUsage = !isEnterpriseContext && usedCredits != null && extraCurrency === "USD" && extra?.monthly_limit != null && extra.monthly_limit > 0;
  const hasUsableExtraUsage = hasUsableUsdExtraUsage || hasUsableCreditExtraUsage;
  const parseDate = (dateStr) => {
    if (!dateStr)
      return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };
  const scopedWeekly = resolveScopedWeeklyLimits(response.limits, parseDate);
  if (fiveHour == null && sevenDay == null && sonnetSevenDay == null && opusSevenDay == null && !hasUsableEnterprise && !hasUsableExtraUsage && scopedWeekly.sonnet == null && scopedWeekly.opus == null && scopedWeekly.generic.length === 0)
    return null;
  const sonnetResetsAt = response.seven_day_sonnet?.resets_at;
  const result = {};
  if (fiveHour != null) {
    result.fiveHourPercent = clamp(fiveHour);
    result.fiveHourResetsAt = parseDate(response.five_hour?.resets_at);
  }
  if (sevenDay != null) {
    result.weeklyPercent = clamp(sevenDay);
    result.weeklyResetsAt = parseDate(response.seven_day?.resets_at);
  }
  if (sonnetSevenDay != null) {
    result.sonnetWeeklyPercent = clamp(sonnetSevenDay);
    result.sonnetWeeklyResetsAt = parseDate(sonnetResetsAt);
  } else if (scopedWeekly.sonnet != null) {
    result.sonnetWeeklyPercent = scopedWeekly.sonnet.percent;
    result.sonnetWeeklyResetsAt = scopedWeekly.sonnet.resetsAt;
  }
  const opusResetsAt = response.seven_day_opus?.resets_at;
  if (opusSevenDay != null) {
    result.opusWeeklyPercent = clamp(opusSevenDay);
    result.opusWeeklyResetsAt = parseDate(opusResetsAt);
  } else if (scopedWeekly.opus != null) {
    result.opusWeeklyPercent = scopedWeekly.opus.percent;
    result.opusWeeklyResetsAt = scopedWeekly.opus.resetsAt;
  }
  if (scopedWeekly.generic.length > 0) {
    result.scopedWeeklyBuckets = scopedWeekly.generic;
  }
  if (extra != null) {
    const currency = extraCurrency;
    if (extra.used_credits != null && minorDivisor != null && isEnterpriseContext) {
      result.enterpriseSpentUsd = extra.used_credits / minorDivisor;
      result.enterpriseLimitUsd = extra.monthly_limit == null ? null : extra.monthly_limit / minorDivisor;
      result.enterpriseCurrency = currency;
      if (minorDecimals != null)
        result.enterpriseDecimalPlaces = minorDecimals;
      if (extra.monthly_limit != null && extra.monthly_limit > 0) {
        result.enterpriseUtilization = clamp(extra.used_credits / extra.monthly_limit * 100);
      }
    } else if (extra.used_credits != null && currency === "USD" && !isEnterpriseContext && extra.monthly_limit != null && extra.monthly_limit > 0) {
      const spentUsd = extra.used_credits / 100;
      result.extraUsageSpentUsd = spentUsd;
      result.extraUsageLimitUsd = extra.monthly_limit / 100;
      result.extraUsagePercent = extra.utilization != null ? clamp(extra.utilization) : clamp(extra.used_credits / extra.monthly_limit * 100);
      result.extraUsageResetsAt = parseDate(extra.resets_at);
    } else if (extra.limit_usd != null && extra.limit_usd > 0) {
      const spentUsd = extra.spent_usd ?? 0;
      result.extraUsageSpentUsd = spentUsd;
      result.extraUsageLimitUsd = extra.limit_usd;
      result.extraUsagePercent = extra.utilization != null ? clamp(extra.utilization) : clamp(spentUsd / extra.limit_usd * 100);
      result.extraUsageResetsAt = parseDate(extra.resets_at);
    }
  }
  return result;
}
function parseZaiResponse(response) {
  const limits = response.data?.limits;
  if (!limits || limits.length === 0)
    return null;
  const allTokensLimits = limits.filter((l) => l.type === "TOKENS_LIMIT");
  const timeLimit = limits.find((l) => l.type === "TIME_LIMIT");
  if (allTokensLimits.length === 0 && !timeLimit)
    return null;
  const parseResetTime = (timestamp2) => {
    if (!timestamp2)
      return null;
    try {
      const date = new Date(timestamp2);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };
  const sortByResetTime = (a, b) => {
    const aTime = a.nextResetTime && a.nextResetTime > 0 ? a.nextResetTime : Infinity;
    const bTime = b.nextResetTime && b.nextResetTime > 0 ? b.nextResetTime : Infinity;
    if (aTime !== bTime)
      return aTime - bTime;
    return (a.percentage ?? 0) - (b.percentage ?? 0);
  };
  const weeklyByUnit = allTokensLimits.find((l) => l.unit === ZAI_UNIT_WEEK);
  let fiveHourBucket;
  let weeklyBucket;
  if (weeklyByUnit) {
    weeklyBucket = weeklyByUnit;
    fiveHourBucket = allTokensLimits.filter((l) => l.unit !== ZAI_UNIT_WEEK).slice().sort(sortByResetTime)[0];
  } else {
    const sorted = allTokensLimits.slice().sort(sortByResetTime);
    fiveHourBucket = sorted[0];
    weeklyBucket = sorted[1];
  }
  if (allTokensLimits.length > 2 && process.env.OMC_DEBUG) {
    console.error(`[usage-api] z.ai returned ${allTokensLimits.length} TOKENS_LIMIT entries; using unit-based classification`);
  }
  const result = {
    fiveHourPercent: clamp(fiveHourBucket?.percentage),
    fiveHourResetsAt: parseResetTime(fiveHourBucket?.nextResetTime),
    monthlyPercent: timeLimit ? clamp(timeLimit.percentage) : void 0,
    monthlyResetsAt: timeLimit ? parseResetTime(timeLimit.nextResetTime) ?? null : void 0
  };
  if (weeklyBucket) {
    result.weeklyPercent = clamp(weeklyBucket.percentage);
    result.weeklyResetsAt = parseResetTime(weeklyBucket.nextResetTime);
  }
  return result;
}
function fetchUsageFromMinimax(apiKey) {
  return new Promise((resolve6) => {
    const baseUrl = process.env.ANTHROPIC_BASE_URL;
    if (!baseUrl) {
      resolve6({ data: null });
      return;
    }
    const validation = validateAnthropicBaseUrl(baseUrl);
    if (!validation.allowed) {
      console.error(`[SSRF Guard] Blocking usage API call: ${validation.reason}`);
      resolve6({ data: null });
      return;
    }
    try {
      const url = new URL(baseUrl);
      const baseDomain = `${url.protocol}//${url.host}`;
      const quotaUrl = `${baseDomain}/v1/api/openplatform/coding_plan/remains`;
      const urlObj = new URL(quotaUrl);
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: API_TIMEOUT_MS
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              resolve6({ data: JSON.parse(data) });
            } catch {
              resolve6({ data: null });
            }
          } else if (res.statusCode === 429) {
            if (process.env.OMC_DEBUG) {
              console.error(`[usage-api] MiniMax API returned 429 (rate limited)`);
            }
            resolve6({ data: null, rateLimited: true });
          } else {
            resolve6({ data: null });
          }
        });
      });
      req.on("error", () => resolve6({ data: null }));
      req.on("timeout", () => {
        req.destroy();
        resolve6({ data: null });
      });
      req.end();
    } catch {
      resolve6({ data: null });
    }
  });
}
function parseMinimaxResponse(response) {
  if (response.base_resp?.status_code != null && response.base_resp.status_code !== 0) {
    return null;
  }
  const models = response.model_remains;
  if (!models || models.length === 0)
    return null;
  const codingModel = models.find((m) => m.model_name.toLowerCase().startsWith("minimax-m"));
  if (!codingModel) {
    if (process.env.OMC_DEBUG) {
      console.error("[usage-api] No MiniMax-M* model found in coding plan response");
    }
    return null;
  }
  const intervalTotal = codingModel.current_interval_total_count;
  const intervalUsed = intervalTotal - codingModel.current_interval_usage_count;
  const intervalPercent = intervalTotal > 0 ? intervalUsed / intervalTotal * 100 : 0;
  const weeklyTotal = codingModel.current_weekly_total_count;
  const weeklyUsed = weeklyTotal - codingModel.current_weekly_usage_count;
  const weeklyPercent = weeklyTotal > 0 ? weeklyUsed / weeklyTotal * 100 : 0;
  const parseResetTime = (timestamp2) => {
    if (!timestamp2)
      return null;
    try {
      const date = new Date(timestamp2);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };
  return {
    fiveHourPercent: clamp(intervalPercent),
    fiveHourResetsAt: parseResetTime(codingModel.end_time),
    weeklyPercent: clamp(weeklyPercent),
    weeklyResetsAt: parseResetTime(codingModel.weekly_end_time)
  };
}
function fetchUsageFromKimi(apiKey) {
  return new Promise((resolve6) => {
    const baseUrl = process.env.ANTHROPIC_BASE_URL;
    if (!baseUrl) {
      resolve6({ data: null });
      return;
    }
    const validation = validateAnthropicBaseUrl(baseUrl);
    if (!validation.allowed) {
      console.error(`[SSRF Guard] Blocking usage API call: ${validation.reason}`);
      resolve6({ data: null });
      return;
    }
    try {
      const hostname2 = new URL(baseUrl).hostname.toLowerCase();
      if (!KIMI_USAGE_HOSTNAMES.has(hostname2)) {
        if (process.env.OMC_DEBUG) {
          console.error(`[usage-api] Refusing to send Kimi credentials to non-canonical host '${hostname2}'`);
        }
        resolve6({ data: null });
        return;
      }
      const req = https.request({
        hostname: hostname2,
        path: KIMI_USAGE_PATH,
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json"
        },
        timeout: API_TIMEOUT_MS
      }, (res) => {
        let data = "";
        res.on("error", () => resolve6({ data: null }));
        res.on("aborted", () => resolve6({ data: null }));
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              resolve6({ data: JSON.parse(data) });
            } catch {
              resolve6({ data: null });
            }
          } else if (res.statusCode === 429) {
            if (process.env.OMC_DEBUG) {
              console.error(`[usage-api] Kimi API returned 429 (rate limited)`);
            }
            resolve6({ data: null, rateLimited: true });
          } else {
            resolve6({ data: null });
          }
        });
      });
      req.on("error", () => resolve6({ data: null }));
      req.on("timeout", () => {
        req.destroy();
        resolve6({ data: null });
      });
      req.end();
    } catch {
      resolve6({ data: null });
    }
  });
}
function kimiToNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function parseKimiResetTime(row) {
  const raw = row?.resetTime ?? row?.reset_at ?? row?.resetAt;
  if (typeof raw !== "string" || raw.length === 0)
    return null;
  let normalized = raw;
  if (normalized.includes(".") && normalized.endsWith("Z")) {
    const [base, frac] = normalized.slice(0, -1).split(".");
    if (base && frac) {
      normalized = `${base}.${frac.slice(0, 3)}Z`;
    }
  }
  try {
    const date = new Date(normalized);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}
function kimiCurrencyCode(value) {
  return typeof value === "string" && value.length > 0 ? value.toUpperCase() : null;
}
function kimiUsedQuota(row) {
  const used = kimiToNumber(row.used);
  if (used != null)
    return used;
  const limit = kimiToNumber(row.limit);
  const remaining = kimiToNumber(row.remaining);
  if (limit != null && remaining != null)
    return limit - remaining;
  return null;
}
function kimiWindowMinutes(window) {
  const duration = window?.duration;
  const rawUnit = window?.timeUnit;
  const timeUnit = typeof rawUnit === "string" ? rawUnit : "";
  if (duration == null || !Number.isFinite(duration) || duration <= 0)
    return null;
  if (timeUnit.includes("MINUTE"))
    return duration;
  if (timeUnit.includes("HOUR"))
    return duration * 60;
  if (timeUnit.includes("DAY"))
    return duration * 60 * 24;
  return null;
}
var KIMI_FIVE_HOUR_WINDOW_MINUTES = 300;
function parseKimiResponse(response) {
  const result = {};
  let hasAny = false;
  const weekly = response.usage;
  if (weekly) {
    const limit = kimiToNumber(weekly.limit);
    const used = kimiUsedQuota(weekly);
    if (limit != null && limit > 0 && used != null) {
      result.weeklyPercent = clamp(used / limit * 100);
      result.weeklyResetsAt = parseKimiResetTime(weekly);
      hasAny = true;
    }
  }
  const limits = Array.isArray(response.limits) ? response.limits : [];
  let filledFiveHour = false;
  let sawOtherWindow = false;
  for (const entry of limits) {
    if (!entry || typeof entry !== "object")
      continue;
    if (kimiWindowMinutes(entry.window) !== KIMI_FIVE_HOUR_WINDOW_MINUTES) {
      sawOtherWindow = true;
      continue;
    }
    const row = entry.detail ?? entry;
    const limit = kimiToNumber(row.limit);
    const used = kimiUsedQuota(row);
    if (limit == null || limit <= 0 || used == null)
      continue;
    result.fiveHourPercent = clamp(used / limit * 100);
    result.fiveHourResetsAt = parseKimiResetTime(row);
    hasAny = true;
    filledFiveHour = true;
    break;
  }
  if (!filledFiveHour && sawOtherWindow && process.env.OMC_DEBUG) {
    console.error(`[usage-api] Kimi limits[] carried no ${KIMI_FIVE_HOUR_WINDOW_MINUTES}-minute window \u2014 5h bucket left empty`);
  }
  const wallet = response.boosterWallet;
  if (wallet?.balance?.type === "BOOSTER") {
    const limitCents = kimiToNumber(wallet.monthlyChargeLimit?.priceInCents);
    const usedCents = kimiToNumber(wallet.monthlyUsed?.priceInCents);
    const limitCurrency = kimiCurrencyCode(wallet.monthlyChargeLimit?.currency);
    const usedCurrency = kimiCurrencyCode(wallet.monthlyUsed?.currency);
    if (wallet.monthlyChargeLimitEnabled === true && limitCents != null && limitCents > 0 && usedCents != null && limitCurrency === "USD" && usedCurrency === "USD") {
      result.extraUsageSpentUsd = usedCents / 100;
      result.extraUsageLimitUsd = limitCents / 100;
      result.extraUsagePercent = clamp(usedCents / limitCents * 100);
      hasAny = true;
    }
  }
  return hasAny ? result : null;
}
async function fetchAndCacheUsage(opts) {
  const { source, fetchFn, parseFn, cache, pollIntervalMs } = opts;
  const result = await fetchFn();
  if (result.rateLimited) {
    const prevLastSuccess = cache?.lastSuccessAt;
    const rateLimitedCache = createRateLimitedCacheEntry(source, cache?.data || null, pollIntervalMs, cache?.rateLimitedCount || 0, prevLastSuccess);
    writeCache({
      data: rateLimitedCache.data,
      error: rateLimitedCache.error,
      source,
      rateLimited: true,
      rateLimitedCount: rateLimitedCache.rateLimitedCount,
      rateLimitedUntil: rateLimitedCache.rateLimitedUntil,
      errorReason: "rate_limited",
      lastSuccessAt: rateLimitedCache.lastSuccessAt
    });
    if (rateLimitedCache.data) {
      if (prevLastSuccess && Date.now() - prevLastSuccess > MAX_STALE_DATA_MS) {
        return { rateLimits: null, error: "rate_limited" };
      }
      return { rateLimits: rateLimitedCache.data, error: "rate_limited", stale: true };
    }
    return { rateLimits: null, error: "rate_limited" };
  }
  if (!result.data) {
    const fallbackData = hasUsableStaleData(cache) ? cache.data : null;
    writeCache({
      data: fallbackData,
      error: true,
      source,
      errorReason: "network",
      lastSuccessAt: cache?.lastSuccessAt
    });
    if (fallbackData) {
      return { rateLimits: fallbackData, error: "network", stale: true };
    }
    return { rateLimits: null, error: "network" };
  }
  const usage = parseFn(result.data);
  writeCache({ data: usage, error: !usage, source, lastSuccessAt: Date.now() });
  return { rateLimits: usage };
}
async function getUsage() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const isMinimax = baseUrl != null && isMinimaxHost(baseUrl);
  const isKimi = baseUrl != null && isKimiHost(baseUrl);
  const isZai = baseUrl != null && isZaiHost(baseUrl);
  const minimaxApiKey = process.env.MINIMAX_API_KEY || authToken;
  const kimiApiKey = process.env.KIMI_API_KEY || process.env.ANTHROPIC_API_KEY || authToken;
  const currentSource = isMinimax ? "minimax" : isKimi ? "kimi" : isZai && authToken ? "zai" : "anthropic";
  const pollIntervalMs = getUsagePollIntervalMs();
  migrateLegacyCache(currentSource);
  const initialCache = readCache(currentSource);
  if (initialCache && isCacheValid(initialCache, pollIntervalMs) && initialCache.source === currentSource) {
    return getCachedUsageResult(initialCache);
  }
  try {
    return await withFileLock(lockPathFor(getCachePath(currentSource)), async () => {
      const cache = readCache(currentSource);
      if (cache && isCacheValid(cache, pollIntervalMs) && cache.source === currentSource) {
        return getCachedUsageResult(cache);
      }
      if (isMinimax) {
        if (!minimaxApiKey) {
          writeCache({ data: null, error: true, source: "minimax", errorReason: "no_credentials" });
          return { rateLimits: null, error: "no_credentials" };
        }
        return fetchAndCacheUsage({
          source: "minimax",
          fetchFn: () => fetchUsageFromMinimax(minimaxApiKey),
          parseFn: parseMinimaxResponse,
          cache,
          pollIntervalMs
        });
      }
      if (isKimi) {
        if (!kimiApiKey) {
          writeCache({ data: null, error: true, source: "kimi", errorReason: "no_credentials" });
          return { rateLimits: null, error: "no_credentials" };
        }
        return fetchAndCacheUsage({
          source: "kimi",
          fetchFn: () => fetchUsageFromKimi(kimiApiKey),
          parseFn: parseKimiResponse,
          cache,
          pollIntervalMs
        });
      }
      if (isZai && authToken) {
        return fetchAndCacheUsage({
          source: "zai",
          fetchFn: () => fetchUsageFromZai(),
          parseFn: parseZaiResponse,
          cache,
          pollIntervalMs
        });
      }
      let creds = getCredentials();
      if (creds) {
        if (!validateCredentials(creds)) {
          if (creds.refreshToken) {
            const refreshed = await refreshAccessToken(creds.refreshToken);
            if (refreshed) {
              creds = { ...creds, ...refreshed };
              writeBackCredentials(creds);
            } else {
              writeCache({ data: null, error: true, source: "anthropic", errorReason: "auth" });
              return { rateLimits: null, error: "auth" };
            }
          } else {
            writeCache({ data: null, error: true, source: "anthropic", errorReason: "auth" });
            return { rateLimits: null, error: "auth" };
          }
        }
        const accessToken = creds.accessToken;
        const subscriptionType = creds.subscriptionType;
        const rateLimitTier = creds.rateLimitTier;
        return fetchAndCacheUsage({
          source: "anthropic",
          fetchFn: () => fetchUsageFromApi(accessToken),
          parseFn: (data) => parseUsageResponse(data, {
            subscriptionType,
            rateLimitTier
          }),
          cache,
          pollIntervalMs
        });
      }
      writeCache({ data: null, error: true, source: "anthropic", errorReason: "no_credentials" });
      return { rateLimits: null, error: "no_credentials" };
    }, USAGE_CACHE_LOCK_OPTS);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Failed to acquire file lock")) {
      if (initialCache?.data) {
        return { rateLimits: initialCache.data, stale: true };
      }
      return { rateLimits: null, error: "network" };
    }
    return { rateLimits: null, error: "network" };
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/custom-rate-provider.js
import { spawn } from "child_process";
import { existsSync as existsSync9, readFileSync as readFileSync9, writeFileSync as writeFileSync4, mkdirSync as mkdirSync7 } from "fs";
import { join as join11, dirname as dirname7 } from "path";
var CACHE_TTL_MS = 3e4;
var DEFAULT_TIMEOUT_MS = 800;
function getCachePath2() {
  return join11(getClaudeConfigDir(), "plugins", "oh-my-claudecode", ".custom-rate-cache.json");
}
function readCache2() {
  try {
    const p = getCachePath2();
    if (!existsSync9(p))
      return null;
    return JSON.parse(readFileSync9(p, "utf-8"));
  } catch {
    return null;
  }
}
function writeCache2(buckets) {
  try {
    const p = getCachePath2();
    const dir = dirname7(p);
    if (!existsSync9(dir))
      mkdirSync7(dir, { recursive: true });
    const cache = { timestamp: Date.now(), buckets };
    writeFileSync4(p, JSON.stringify(cache, null, 2));
  } catch {
  }
}
function isCacheValid2(cache) {
  return Date.now() - cache.timestamp < CACHE_TTL_MS;
}
function spawnWithTimeout(cmd, timeoutMs) {
  return new Promise((resolve6, reject) => {
    const [executable, ...args] = Array.isArray(cmd) ? cmd : ["sh", "-c", cmd];
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
    const killTree = (signal) => {
      if (child.pid === void 0)
        return;
      try {
        if (process.platform === "win32") {
          child.kill(signal);
        } else {
          process.kill(-child.pid, signal);
        }
      } catch {
      }
    };
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    let timedOut = false;
    let escalationTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree("SIGTERM");
      child.stdout.destroy();
      child.stderr.destroy();
      escalationTimer = setTimeout(() => killTree("SIGKILL"), 200);
      reject(new Error(`Custom rate limit command timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (!timedOut && escalationTimer)
        clearTimeout(escalationTimer);
      if (!timedOut) {
        if (code === 0) {
          resolve6(stdout);
        } else {
          reject(new Error(`Command exited with code ${code}`));
        }
      }
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      if (!timedOut)
        reject(err);
    });
  });
}
function parseOutput(raw, periods) {
  let parsed;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || parsed.version !== 1 || !Array.isArray(parsed.buckets)) {
    return null;
  }
  const buckets = parsed.buckets.filter((b) => {
    if (typeof b.id !== "string" || typeof b.label !== "string")
      return false;
    if (!b.usage || typeof b.usage.type !== "string")
      return false;
    const u = b.usage;
    if (u.type === "percent")
      return typeof u.value === "number";
    if (u.type === "credit") {
      return typeof u.used === "number" && typeof u.limit === "number";
    }
    if (u.type === "string")
      return typeof u.value === "string";
    return false;
  });
  if (periods && periods.length > 0) {
    return buckets.filter((b) => periods.includes(b.id));
  }
  return buckets;
}
async function executeCustomProvider(config) {
  const cache = readCache2();
  if (cache && isCacheValid2(cache)) {
    return { buckets: cache.buckets, stale: false };
  }
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const stdout = await spawnWithTimeout(config.command, timeoutMs);
    const buckets = parseOutput(stdout, config.periods);
    if (buckets === null) {
      if (process.env.OMC_DEBUG) {
        console.error("[custom-rate-provider] Invalid output format from command");
      }
      if (cache)
        return { buckets: cache.buckets, stale: true };
      return { buckets: [], stale: false, error: "invalid output" };
    }
    writeCache2(buckets);
    return { buckets, stale: false };
  } catch (err) {
    if (process.env.OMC_DEBUG) {
      console.error("[custom-rate-provider] Command failed:", err instanceof Error ? err.message : err);
    }
    if (cache)
      return { buckets: cache.buckets, stale: true };
    return { buckets: [], stale: false, error: "command failed" };
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/colors.js
var RESET = "\x1B[0m";
var DIM = "\x1B[2m";
var BOLD = "\x1B[1m";
var RED = "\x1B[31m";
var GREEN = "\x1B[32m";
var YELLOW = "\x1B[33m";
var MAGENTA = "\x1B[35m";
var CYAN = "\x1B[36m";
function green(text) {
  return `${GREEN}${text}${RESET}`;
}
function yellow(text) {
  return `${YELLOW}${text}${RESET}`;
}
function red(text) {
  return `${RED}${text}${RESET}`;
}
function cyan(text) {
  return `${CYAN}${text}${RESET}`;
}
function dim(text) {
  return `${DIM}${text}${RESET}`;
}
function bold(text) {
  return `${BOLD}${text}${RESET}`;
}
function getModelTierColor(model) {
  if (!model)
    return CYAN;
  const tier = model.toLowerCase();
  if (tier.includes("opus"))
    return MAGENTA;
  if (tier.includes("sonnet"))
    return YELLOW;
  if (tier.includes("haiku"))
    return GREEN;
  return CYAN;
}
function getDurationColor(durationMs) {
  const minutes = durationMs / 6e4;
  if (minutes >= 5)
    return RED;
  if (minutes >= 2)
    return YELLOW;
  return GREEN;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/lib/version.js
import { readFileSync as readFileSync10, existsSync as existsSync10, lstatSync, realpathSync as realpathSync2 } from "fs";
import { join as join12, dirname as dirname8 } from "path";
import { fileURLToPath } from "url";
function getRuntimePackageVersion() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname2 = dirname8(__filename);
    for (let i = 0; i < 5; i++) {
      const candidate = join12(__dirname2, ...Array(i + 1).fill(".."), "package.json");
      try {
        const pkg = JSON.parse(readFileSync10(candidate, "utf-8"));
        if (pkg.name && pkg.version) {
          return pkg.version;
        }
      } catch {
        continue;
      }
    }
  } catch {
  }
  try {
    const __filename = fileURLToPath(import.meta.url);
    const pathMatch = __filename.match(/oh-my-claudecode\/(\d+\.\d+\.\d+[^/]*)\//);
    if (pathMatch?.[1]) {
      return pathMatch[1];
    }
  } catch {
  }
  return "unknown";
}
function isRuntimePackageLocal() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname2 = dirname8(__filename);
    let pkgRoot = null;
    for (let i = 0; i < 5; i++) {
      const candidate = join12(__dirname2, ...Array(i + 1).fill(".."));
      if (existsSync10(join12(candidate, "package.json"))) {
        pkgRoot = candidate;
        break;
      }
    }
    if (!pkgRoot)
      return false;
    if (existsSync10(join12(pkgRoot, ".git")))
      return true;
    if (existsSync10(join12(pkgRoot, "src")))
      return true;
    try {
      const real = realpathSync2(pkgRoot);
      const norm = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "");
      if (norm(real) !== norm(pkgRoot))
        return true;
    } catch {
    }
    let cursor = pkgRoot;
    for (let i = 0; i < 6; i++) {
      const parent = dirname8(cursor);
      if (parent === cursor)
        break;
      try {
        if (lstatSync(cursor).isSymbolicLink())
          return true;
      } catch {
      }
      cursor = parent;
    }
  } catch {
  }
  return false;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/ralph.js
var RED2 = "\x1B[31m";
var YELLOW2 = "\x1B[33m";
var GREEN2 = "\x1B[32m";
function renderRalph(state, thresholds, labels = DEFAULT_HUD_LABELS) {
  if (!state?.active) {
    return null;
  }
  const { iteration, maxIterations } = state;
  const warningThreshold = thresholds.ralphWarning;
  const criticalThreshold = Math.floor(maxIterations * 0.9);
  let color;
  if (iteration >= criticalThreshold) {
    color = RED2;
  } else if (iteration >= warningThreshold) {
    color = YELLOW2;
  } else {
    color = GREEN2;
  }
  return `${labels.ralph}:${color}${iteration}/${maxIterations}${RESET}`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/features/agent-addressability/index.js
var SHORT_ID_LENGTH = 7;
function shortId(id, length = SHORT_ID_LENGTH) {
  if (!id)
    return "";
  return id.length <= length ? id : id.slice(0, length);
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/agents.js
var CYAN2 = "\x1B[36m";
var AGENT_TYPE_CODES = {
  // ============================================================
  // BUILD/ANALYSIS LANE
  // ============================================================
  // Explore - 'E' for Explore (haiku)
  explore: "e",
  // Analyst - 'T' for aTalyst (A taken by Architect)
  analyst: "T",
  // opus
  // Planner - 'P' for Planner
  planner: "P",
  // opus
  // Architect - 'A' for Architect
  architect: "A",
  // opus
  // Debugger - 'g' for debuGger (d taken by designer)
  debugger: "g",
  // sonnet
  // Executor - 'x' for eXecutor (sonnet default, opus for complex tasks)
  executor: "x",
  // sonnet/opus
  // Verifier - 'V' for Verifier (but vision uses 'v'... use uppercase 'V' for governance role)
  verifier: "V",
  // sonnet
  // ============================================================
  // REVIEW LANE
  // ============================================================
  // Style Reviewer - 'Y' for stYle
  "style-reviewer": "y",
  // haiku
  // API Reviewer - 'I' for Interface/API
  "api-reviewer": "i",
  // sonnet
  // Security Reviewer - 'K' for Security (S taken by Scientist)
  "security-reviewer": "K",
  // sonnet
  // Performance Reviewer - 'O' for perfOrmance
  "performance-reviewer": "o",
  // sonnet
  // Code Reviewer - 'R' for Review (uppercase, opus tier)
  "code-reviewer": "R",
  // opus
  // ============================================================
  // DOMAIN SPECIALISTS
  // ============================================================
  // Dependency Expert - 'L' for Library expert
  "dependency-expert": "l",
  // sonnet
  // Test Engineer - 'T' (but analyst uses 'T'... use uppercase 'T')
  "test-engineer": "t",
  // sonnet
  // Quality Strategist - 'Qs' for Quality Strategist (disambiguated from quality-reviewer)
  "quality-strategist": "Qs",
  // sonnet
  // Designer - 'd' for Designer
  designer: "d",
  // sonnet
  // Writer - 'W' for Writer
  writer: "w",
  // haiku
  // QA Tester - 'Q' for QA
  "qa-tester": "q",
  // sonnet
  // Scientist - 'S' for Scientist
  scientist: "s",
  // sonnet
  // Git Master - 'M' for Master
  "git-master": "m",
  // sonnet
  // ============================================================
  // PRODUCT LANE
  // ============================================================
  // Product Manager - 'Pm' for Product Manager (disambiguated from planner)
  "product-manager": "Pm",
  // sonnet
  // UX Researcher - 'u' for Ux
  "ux-researcher": "u",
  // sonnet
  // Information Architect - 'Ia' for Information Architect (disambiguated from api-reviewer)
  "information-architect": "Ia",
  // sonnet
  // Product Analyst - 'a' for analyst
  "product-analyst": "a",
  // sonnet
  // ============================================================
  // COORDINATION
  // ============================================================
  // Critic - 'C' for Critic
  critic: "C",
  // opus
  // Vision - 'V' for Vision (lowercase since sonnet)
  vision: "v",
  // sonnet
  // Document Specialist - 'D' for Document
  "document-specialist": "D",
  // sonnet
  // ============================================================
  // BACKWARD COMPATIBILITY (Deprecated)
  // ============================================================
  // Researcher - 'r' for Researcher (deprecated, points to document-specialist)
  researcher: "r"
  // sonnet
};
function getAgentCode(agentType, model) {
  const parts = agentType.split(":");
  const shortName = parts[parts.length - 1] || agentType;
  let code = AGENT_TYPE_CODES[shortName];
  if (!code) {
    code = shortName.charAt(0).toUpperCase();
  }
  if (model) {
    const tier = model.toLowerCase();
    if (code.length === 1) {
      code = tier.includes("opus") ? code.toUpperCase() : code.toLowerCase();
    } else {
      const first = tier.includes("opus") ? code[0].toUpperCase() : code[0].toLowerCase();
      code = first + code.slice(1);
    }
  }
  return code;
}
function formatDuration(durationMs) {
  const seconds = Math.floor(durationMs / 1e3);
  const minutes = Math.floor(seconds / 60);
  if (seconds < 10) {
    return "";
  } else if (seconds < 60) {
    return `(${seconds}s)`;
  } else if (minutes < 10) {
    return `(${minutes}m)`;
  } else {
    return "!";
  }
}
function renderAgents(agents) {
  const running = agents.filter((a) => a.status === "running").length;
  if (running === 0) {
    return null;
  }
  return `agents:${CYAN2}${running}${RESET}`;
}
function sortByFreshest(agents) {
  return [...agents].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
}
function renderAgentsCoded(agents) {
  const running = sortByFreshest(agents.filter((a) => a.status === "running"));
  if (running.length === 0) {
    return null;
  }
  const codes = running.map((a) => {
    const code = getAgentCode(a.type, a.model);
    const color = getModelTierColor(a.model);
    return `${color}${code}${RESET}`;
  });
  return `agents:${codes.join("")}`;
}
function renderAgentsCodedWithDuration(agents) {
  const running = sortByFreshest(agents.filter((a) => a.status === "running"));
  if (running.length === 0) {
    return null;
  }
  const now = Date.now();
  const codes = running.map((a) => {
    const code = getAgentCode(a.type, a.model);
    const durationMs = now - a.startTime.getTime();
    const duration = formatDuration(durationMs);
    const modelColor = getModelTierColor(a.model);
    if (duration === "!") {
      const durationColor = getDurationColor(durationMs);
      return `${modelColor}${code}${durationColor}!${RESET}`;
    } else if (duration) {
      return `${modelColor}${code}${dim(duration)}${RESET}`;
    } else {
      return `${modelColor}${code}${RESET}`;
    }
  });
  return `agents:${codes.join("")}`;
}
function renderAgentsDetailed(agents) {
  const running = sortByFreshest(agents.filter((a) => a.status === "running"));
  if (running.length === 0) {
    return null;
  }
  const now = Date.now();
  const names = running.map((a) => {
    const parts = a.type.split(":");
    let name = parts[parts.length - 1] || a.type;
    if (name === "executor")
      name = "exec";
    if (name === "deep-executor")
      name = "exec";
    if (name === "designer")
      name = "design";
    if (name === "qa-tester")
      name = "qa";
    if (name === "scientist")
      name = "sci";
    if (name === "security-reviewer")
      name = "sec";
    if (name === "build-fixer")
      name = "debug";
    if (name === "code-reviewer")
      name = "review";
    if (name === "git-master")
      name = "git";
    if (name === "style-reviewer")
      name = "style";
    if (name === "quality-reviewer")
      name = "review";
    if (name === "api-reviewer")
      name = "api-rev";
    if (name === "performance-reviewer")
      name = "perf";
    if (name === "dependency-expert")
      name = "dep-exp";
    if (name === "document-specialist")
      name = "doc-spec";
    if (name === "test-engineer")
      name = "test-eng";
    if (name === "quality-strategist")
      name = "qs";
    if (name === "debugger")
      name = "debug";
    if (name === "verifier")
      name = "verify";
    if (name === "product-manager")
      name = "pm";
    if (name === "ux-researcher")
      name = "uxr";
    if (name === "information-architect")
      name = "ia";
    if (name === "product-analyst")
      name = "pa";
    const durationMs = now - a.startTime.getTime();
    const duration = formatDuration(durationMs);
    return duration ? `${name}${duration}` : name;
  });
  return `agents:[${CYAN2}${names.join(",")}${RESET}]`;
}
function truncateDescription(desc, maxWidth = 20) {
  if (!desc)
    return "...";
  return truncateToWidth(desc, maxWidth);
}
function truncateDescriptionWithId(desc, id, maxWidth) {
  const suffix = ` (${shortId(id)})`;
  if (!desc)
    return `...${suffix}`;
  const budget = Math.max(4, maxWidth - 10 - 3);
  return `${truncateToWidth(desc, budget)}${suffix}`;
}
function getShortAgentName(agentType) {
  const parts = agentType.split(":");
  const name = parts[parts.length - 1] || agentType;
  const abbrevs = {
    // Build/Analysis Lane
    "executor": "exec",
    "deep-executor": "exec",
    // deprecated alias
    "debugger": "debug",
    "verifier": "verify",
    // Review Lane
    "style-reviewer": "style",
    "quality-reviewer": "review",
    // deprecated alias
    "api-reviewer": "api-rev",
    "security-reviewer": "sec",
    "performance-reviewer": "perf",
    "code-reviewer": "review",
    // Domain Specialists
    "dependency-expert": "dep-exp",
    "document-specialist": "doc-spec",
    "test-engineer": "test-eng",
    "quality-strategist": "qs",
    "build-fixer": "debug",
    // deprecated alias
    "designer": "design",
    "qa-tester": "qa",
    "scientist": "sci",
    "git-master": "git",
    // Product Lane
    "product-manager": "pm",
    "ux-researcher": "uxr",
    "information-architect": "ia",
    "product-analyst": "pa",
    // Backward compat
    "researcher": "dep-exp"
  };
  return abbrevs[name] || name;
}
function getTeammateName(agent) {
  const name = agent.name?.trim();
  return name ? name : null;
}
function getAgentDisplayName(agent) {
  const teammateName = getTeammateName(agent);
  return teammateName ? `tm:${teammateName}` : getShortAgentName(agent.type);
}
function getAgentDisplayMarker(agent) {
  return getTeammateName(agent) ? "\u25C6" : getAgentCode(agent.type, agent.model);
}
function getAgentDisplayColor(agent) {
  return getTeammateName(agent) ? CYAN2 : getModelTierColor(agent.model);
}
function renderAgentsWithDescriptions(agents) {
  const running = sortByFreshest(agents.filter((a) => a.status === "running"));
  if (running.length === 0) {
    return null;
  }
  const now = Date.now();
  const entries = running.map((a) => {
    const code = getAgentDisplayMarker(a);
    const color = getAgentDisplayColor(a);
    const teammateName = getTeammateName(a);
    const displayName = getAgentDisplayName(a);
    const desc = teammateName ? truncateDescription(a.description, 30) : truncateDescriptionWithId(a.description, a.id, 25);
    const label = teammateName ? `${displayName}${desc ? ` ${desc}` : ""}` : desc;
    const durationMs = now - a.startTime.getTime();
    const duration = formatDuration(durationMs);
    let entry = `${color}${code}${RESET}:${dim(label)}`;
    if (duration && duration !== "!") {
      entry += dim(duration);
    } else if (duration === "!") {
      const durationColor = getDurationColor(durationMs);
      entry += `${durationColor}!${RESET}`;
    }
    return entry;
  });
  return entries.join(dim(" | "));
}
function renderAgentsDescOnly(agents) {
  const running = sortByFreshest(agents.filter((a) => a.status === "running"));
  if (running.length === 0) {
    return null;
  }
  const now = Date.now();
  const descriptions = running.map((a) => {
    const color = getAgentDisplayColor(a);
    const shortName = getAgentDisplayName(a);
    const desc = getTeammateName(a) ? a.description ? truncateDescription(a.description, 20) : shortName : truncateDescriptionWithId(a.description, a.id, 20);
    const durationMs = now - a.startTime.getTime();
    const duration = formatDuration(durationMs);
    if (duration === "!") {
      const durationColor = getDurationColor(durationMs);
      return `${color}${desc}${durationColor}!${RESET}`;
    } else if (duration) {
      return `${color}${desc}${dim(duration)}${RESET}`;
    }
    return `${color}${desc}${RESET}`;
  });
  return `[${descriptions.join(dim(", "))}]`;
}
function formatDurationPadded(durationMs) {
  const seconds = Math.floor(durationMs / 1e3);
  const minutes = Math.floor(seconds / 60);
  if (seconds < 10) {
    return "    ";
  } else if (seconds < 60) {
    return `${seconds}s`.padStart(4);
  } else if (minutes < 10) {
    return `${minutes}m`.padStart(4);
  } else {
    return `${minutes}m`.padStart(4);
  }
}
function renderAgentsMultiLine(agents, maxLines = 5) {
  const running = sortByFreshest(agents.filter((a) => a.status === "running"));
  if (running.length === 0) {
    return { headerPart: null, detailLines: [] };
  }
  const headerPart = `agents:${CYAN2}${running.length}${RESET}`;
  const now = Date.now();
  const detailLines = [];
  const displayCount = Math.min(running.length, maxLines);
  running.slice(0, maxLines).forEach((a, index) => {
    const isLast = index === displayCount - 1 && running.length <= maxLines;
    const prefix = isLast ? "\u2514\u2500" : "\u251C\u2500";
    const code = getAgentDisplayMarker(a);
    const color = getAgentDisplayColor(a);
    const shortName = getAgentDisplayName(a).padEnd(12);
    const durationMs = now - a.startTime.getTime();
    const duration = formatDurationPadded(durationMs);
    const durationColor = getDurationColor(durationMs);
    const truncatedDesc = getTeammateName(a) ? truncateToWidth(a.description || "...", 45) : truncateDescriptionWithId(a.description, a.id, 45);
    detailLines.push(`${dim(prefix)} ${color}${code}${RESET} ${dim(shortName)}${durationColor}${duration}${RESET}  ${truncatedDesc}`);
  });
  if (running.length > maxLines) {
    const remaining = running.length - maxLines;
    detailLines.push(`${dim(`\u2514\u2500 +${remaining} more agents...`)}`);
  }
  return { headerPart, detailLines };
}
function renderAgentsByFormat(agents, format) {
  switch (format) {
    case "count":
      return renderAgents(agents);
    case "codes":
      return renderAgentsCoded(agents);
    case "codes-duration":
      return renderAgentsCodedWithDuration(agents);
    case "detailed":
      return renderAgentsDetailed(agents);
    case "descriptions":
      return renderAgentsWithDescriptions(agents);
    case "tasks":
      return renderAgentsDescOnly(agents);
    case "multiline":
      return renderAgentsMultiLine(agents).headerPart;
    default:
      return renderAgentsCoded(agents);
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/todos.js
var GREEN3 = "\x1B[32m";
var YELLOW3 = "\x1B[33m";
var CYAN3 = "\x1B[36m";
var DIM2 = "\x1B[2m";
function renderTodosWithCurrent(todos) {
  if (todos.length === 0) {
    return null;
  }
  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;
  const inProgress = todos.find((t) => t.status === "in_progress");
  const percent = completed / total * 100;
  let color;
  if (percent >= 80) {
    color = GREEN3;
  } else if (percent >= 50) {
    color = YELLOW3;
  } else {
    color = CYAN3;
  }
  let result = `todos:${color}${completed}/${total}${RESET}`;
  if (inProgress) {
    const activeText = inProgress.activeForm || inProgress.content || "...";
    const truncated = truncateToWidth(activeText, 30);
    result += ` ${DIM2}(working: ${truncated})${RESET}`;
  }
  return result;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/skills.js
var MAGENTA2 = "\x1B[35m";
var BRIGHT_MAGENTA = "\x1B[95m";
function truncate(str, maxWidth) {
  return truncateToWidth(str, maxWidth);
}
function getSkillDisplayName(skillName) {
  return skillName.split(":").pop() || skillName;
}
function isActiveMode(skillName, ultrawork, ralph) {
  if (skillName === "ultrawork" && ultrawork?.active)
    return true;
  if (skillName === "ralph" && ralph?.active)
    return true;
  if (skillName === "ultrawork+ralph" && ultrawork?.active && ralph?.active)
    return true;
  return false;
}
function renderSkills(ultrawork, ralph, lastSkill) {
  const parts = [];
  if (ralph?.active && ultrawork?.active) {
    parts.push(`${BRIGHT_MAGENTA}ultrawork+ralph${RESET}`);
  } else if (ultrawork?.active) {
    parts.push(`${MAGENTA2}ultrawork${RESET}`);
  } else if (ralph?.active) {
    parts.push(`${MAGENTA2}ralph${RESET}`);
  }
  if (lastSkill && !isActiveMode(lastSkill.name, ultrawork, ralph)) {
    const argsDisplay = lastSkill.args ? `(${truncate(lastSkill.args, 15)})` : "";
    const displayName = getSkillDisplayName(lastSkill.name);
    parts.push(cyan(`skill:${displayName}${argsDisplay}`));
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
function renderLastSkill(lastSkill) {
  if (!lastSkill)
    return null;
  const argsDisplay = lastSkill.args ? `(${truncate(lastSkill.args, 15)})` : "";
  const displayName = getSkillDisplayName(lastSkill.name);
  return cyan(`skill:${displayName}${argsDisplay}`);
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/context.js
var GREEN4 = "\x1B[32m";
var YELLOW4 = "\x1B[33m";
var RED3 = "\x1B[31m";
var DIM3 = "\x1B[2m";
var CONTEXT_DISPLAY_HYSTERESIS = 2;
var CONTEXT_DISPLAY_STATE_TTL_MS = 5e3;
var lastDisplayedPercent = null;
var lastDisplayedSeverity = null;
var lastDisplayScope = null;
var lastDisplayUpdatedAt = 0;
function clampContextPercent(percent) {
  return Math.min(100, Math.max(0, Math.round(percent)));
}
function getContextSeverity(safePercent, thresholds) {
  if (safePercent >= thresholds.contextCritical) {
    return "critical";
  }
  if (safePercent >= thresholds.contextCompactSuggestion) {
    return "compact";
  }
  if (safePercent >= thresholds.contextWarning) {
    return "warning";
  }
  return "normal";
}
function getContextDisplayStyle(safePercent, thresholds) {
  const severity = getContextSeverity(safePercent, thresholds);
  switch (severity) {
    case "critical":
      return { color: RED3, suffix: " CRITICAL" };
    case "compact":
      return { color: YELLOW4, suffix: " COMPRESS?" };
    case "warning":
      return { color: YELLOW4, suffix: "" };
    default:
      return { color: GREEN4, suffix: "" };
  }
}
function getStableContextDisplayPercent(percent, thresholds, displayScope) {
  const safePercent = clampContextPercent(percent);
  const severity = getContextSeverity(safePercent, thresholds);
  const nextScope = displayScope ?? null;
  const now = Date.now();
  if (nextScope !== lastDisplayScope) {
    lastDisplayedPercent = null;
    lastDisplayedSeverity = null;
    lastDisplayScope = nextScope;
  }
  if (lastDisplayedPercent === null || lastDisplayedSeverity === null || now - lastDisplayUpdatedAt > CONTEXT_DISPLAY_STATE_TTL_MS) {
    lastDisplayedPercent = safePercent;
    lastDisplayedSeverity = severity;
    lastDisplayUpdatedAt = now;
    return safePercent;
  }
  if (severity !== lastDisplayedSeverity) {
    lastDisplayedPercent = safePercent;
    lastDisplayedSeverity = severity;
    lastDisplayUpdatedAt = now;
    return safePercent;
  }
  if (Math.abs(safePercent - lastDisplayedPercent) <= CONTEXT_DISPLAY_HYSTERESIS) {
    lastDisplayUpdatedAt = now;
    return lastDisplayedPercent;
  }
  lastDisplayedPercent = safePercent;
  lastDisplayedSeverity = severity;
  lastDisplayUpdatedAt = now;
  return safePercent;
}
function renderContext(percent, thresholds, displayScope, labels = DEFAULT_HUD_LABELS) {
  const safePercent = getStableContextDisplayPercent(percent, thresholds, displayScope);
  const { color, suffix } = getContextDisplayStyle(safePercent, thresholds);
  return `${labels.context}:${color}${safePercent}%${suffix}${RESET}`;
}
function renderContextWithBar(percent, thresholds, barWidth = 10, displayScope, labels = DEFAULT_HUD_LABELS) {
  const safePercent = getStableContextDisplayPercent(percent, thresholds, displayScope);
  const filled = Math.round(safePercent / 100 * barWidth);
  const empty = barWidth - filled;
  const { color, suffix } = getContextDisplayStyle(safePercent, thresholds);
  const bar = `${color}${"\u2588".repeat(filled)}${DIM3}${"\u2591".repeat(empty)}${RESET}`;
  return `${labels.context}:[${bar}]${color}${safePercent}%${suffix}${RESET}`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/background.js
var CYAN4 = "\x1B[36m";
var GREEN5 = "\x1B[32m";
var YELLOW5 = "\x1B[33m";
var MAX_CONCURRENT = 5;
function renderBackground(tasks, labels = DEFAULT_HUD_LABELS) {
  const running = tasks.filter((t) => t.status === "running").length;
  if (running === 0) {
    return null;
  }
  let color;
  if (running >= MAX_CONCURRENT) {
    color = YELLOW5;
  } else if (running >= MAX_CONCURRENT - 1) {
    color = CYAN4;
  } else {
    color = GREEN5;
  }
  return `${labels.background}:${color}${running}/${MAX_CONCURRENT}${RESET}`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/prd.js
var CYAN5 = "\x1B[36m";
var GREEN6 = "\x1B[32m";
function renderPrd(state) {
  if (!state) {
    return null;
  }
  const { currentStoryId, completed, total } = state;
  if (completed === total) {
    return `${GREEN6}PRD:done${RESET}`;
  }
  if (currentStoryId) {
    return `${CYAN5}${currentStoryId}${RESET}`;
  }
  return null;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/limits.js
var GREEN7 = "\x1B[32m";
var YELLOW6 = "\x1B[33m";
var RED4 = "\x1B[31m";
var DIM4 = "\x1B[2m";
var WARNING_THRESHOLD = 70;
var CRITICAL_THRESHOLD = 90;
function getColor(percent) {
  if (percent >= CRITICAL_THRESHOLD) {
    return RED4;
  } else if (percent >= WARNING_THRESHOLD) {
    return YELLOW6;
  }
  return GREEN7;
}
function formatResetTime(date) {
  if (!date)
    return null;
  const now = Date.now();
  const resetMs = date.getTime();
  const diffMs = resetMs - now;
  if (diffMs <= 0)
    return null;
  const diffMinutes = Math.floor(diffMs / 6e4);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return `${diffDays}d${remainingHours}h`;
  }
  const remainingMinutes = diffMinutes % 60;
  return `${diffHours}h${remainingMinutes}m`;
}
function renderRateLimits(limits, stale) {
  if (!limits)
    return null;
  const staleMarker = stale ? `${DIM4}*${RESET}` : "";
  const resetPrefix = stale ? "~" : "";
  const parts = [];
  if (limits.fiveHourPercent != null) {
    const fiveHour = Math.min(100, Math.max(0, Math.round(limits.fiveHourPercent)));
    const fiveHourColor = getColor(fiveHour);
    const fiveHourReset = formatResetTime(limits.fiveHourResetsAt);
    const fiveHourPart = fiveHourReset ? `5h:${fiveHourColor}${fiveHour}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${fiveHourReset})${RESET}` : `5h:${fiveHourColor}${fiveHour}%${RESET}${staleMarker}`;
    parts.push(fiveHourPart);
  }
  if (limits.weeklyPercent != null) {
    const weekly = Math.min(100, Math.max(0, Math.round(limits.weeklyPercent)));
    const weeklyColor = getColor(weekly);
    const weeklyReset = formatResetTime(limits.weeklyResetsAt);
    const weeklyPart = weeklyReset ? `${DIM4}wk:${RESET}${weeklyColor}${weekly}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${weeklyReset})${RESET}` : `${DIM4}wk:${RESET}${weeklyColor}${weekly}%${RESET}${staleMarker}`;
    parts.push(weeklyPart);
  }
  if (limits.monthlyPercent != null) {
    const monthly = Math.min(100, Math.max(0, Math.round(limits.monthlyPercent)));
    const monthlyColor = getColor(monthly);
    const monthlyReset = formatResetTime(limits.monthlyResetsAt);
    const monthlyPart = monthlyReset ? `${DIM4}mo:${RESET}${monthlyColor}${monthly}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${monthlyReset})${RESET}` : `${DIM4}mo:${RESET}${monthlyColor}${monthly}%${RESET}${staleMarker}`;
    parts.push(monthlyPart);
  }
  if (limits.sonnetWeeklyPercent != null) {
    const sonnet = Math.min(100, Math.max(0, Math.round(limits.sonnetWeeklyPercent)));
    const sonnetColor = getColor(sonnet);
    const sonnetReset = formatResetTime(limits.sonnetWeeklyResetsAt);
    const sonnetPart = sonnetReset ? `${DIM4}sn:${RESET}${sonnetColor}${sonnet}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${sonnetReset})${RESET}` : `${DIM4}sn:${RESET}${sonnetColor}${sonnet}%${RESET}${staleMarker}`;
    parts.push(sonnetPart);
  }
  if (limits.opusWeeklyPercent != null) {
    const opus = Math.min(100, Math.max(0, Math.round(limits.opusWeeklyPercent)));
    const opusColor = getColor(opus);
    const opusReset = formatResetTime(limits.opusWeeklyResetsAt);
    const opusPart = opusReset ? `${DIM4}op:${RESET}${opusColor}${opus}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${opusReset})${RESET}` : `${DIM4}op:${RESET}${opusColor}${opus}%${RESET}${staleMarker}`;
    parts.push(opusPart);
  }
  if (limits.scopedWeeklyBuckets != null) {
    for (const bucket of limits.scopedWeeklyBuckets) {
      const value = Math.min(100, Math.max(0, Math.round(bucket.percent)));
      const color = getColor(value);
      const reset = formatResetTime(bucket.resetsAt);
      const label = bucket.label.toLowerCase();
      const part = reset ? `${DIM4}${label}:${RESET}${color}${value}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${reset})${RESET}` : `${DIM4}${label}:${RESET}${color}${value}%${RESET}${staleMarker}`;
      parts.push(part);
    }
  }
  if (limits.extraUsagePercent != null && limits.extraUsageLimitUsd != null) {
    const extra = Math.min(100, Math.max(0, Math.round(limits.extraUsagePercent)));
    const extraColor = getColor(extra);
    const extraReset = formatResetTime(limits.extraUsageResetsAt);
    const dollarPart = `${DIM4}($${(limits.extraUsageSpentUsd ?? 0).toFixed(2)}/$${limits.extraUsageLimitUsd.toFixed(2)})${RESET}`;
    const extraPart = extraReset ? `${DIM4}extra:${RESET}${extraColor}${extra}%${RESET}${staleMarker}${dollarPart}${DIM4}(${resetPrefix}${extraReset})${RESET}` : `${DIM4}extra:${RESET}${extraColor}${extra}%${RESET}${staleMarker}${dollarPart}`;
    parts.push(extraPart);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
function renderRateLimitsWithBar(limits, barWidth = 8, stale) {
  if (!limits)
    return null;
  const staleMarker = stale ? `${DIM4}*${RESET}` : "";
  const resetPrefix = stale ? "~" : "";
  const parts = [];
  if (limits.fiveHourPercent != null) {
    const fiveHour = Math.min(100, Math.max(0, Math.round(limits.fiveHourPercent)));
    const fiveHourColor = getColor(fiveHour);
    const fiveHourFilled = Math.round(fiveHour / 100 * barWidth);
    const fiveHourEmpty = barWidth - fiveHourFilled;
    const fiveHourBar = `${fiveHourColor}${"\u2588".repeat(fiveHourFilled)}${DIM4}${"\u2591".repeat(fiveHourEmpty)}${RESET}`;
    const fiveHourReset = formatResetTime(limits.fiveHourResetsAt);
    const fiveHourPart = fiveHourReset ? `5h:[${fiveHourBar}]${fiveHourColor}${fiveHour}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${fiveHourReset})${RESET}` : `5h:[${fiveHourBar}]${fiveHourColor}${fiveHour}%${RESET}${staleMarker}`;
    parts.push(fiveHourPart);
  }
  if (limits.weeklyPercent != null) {
    const weekly = Math.min(100, Math.max(0, Math.round(limits.weeklyPercent)));
    const weeklyColor = getColor(weekly);
    const weeklyFilled = Math.round(weekly / 100 * barWidth);
    const weeklyEmpty = barWidth - weeklyFilled;
    const weeklyBar = `${weeklyColor}${"\u2588".repeat(weeklyFilled)}${DIM4}${"\u2591".repeat(weeklyEmpty)}${RESET}`;
    const weeklyReset = formatResetTime(limits.weeklyResetsAt);
    const weeklyPart = weeklyReset ? `${DIM4}wk:${RESET}[${weeklyBar}]${weeklyColor}${weekly}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${weeklyReset})${RESET}` : `${DIM4}wk:${RESET}[${weeklyBar}]${weeklyColor}${weekly}%${RESET}${staleMarker}`;
    parts.push(weeklyPart);
  }
  if (limits.monthlyPercent != null) {
    const monthly = Math.min(100, Math.max(0, Math.round(limits.monthlyPercent)));
    const monthlyColor = getColor(monthly);
    const monthlyFilled = Math.round(monthly / 100 * barWidth);
    const monthlyEmpty = barWidth - monthlyFilled;
    const monthlyBar = `${monthlyColor}${"\u2588".repeat(monthlyFilled)}${DIM4}${"\u2591".repeat(monthlyEmpty)}${RESET}`;
    const monthlyReset = formatResetTime(limits.monthlyResetsAt);
    const monthlyPart = monthlyReset ? `${DIM4}mo:${RESET}[${monthlyBar}]${monthlyColor}${monthly}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${monthlyReset})${RESET}` : `${DIM4}mo:${RESET}[${monthlyBar}]${monthlyColor}${monthly}%${RESET}${staleMarker}`;
    parts.push(monthlyPart);
  }
  if (limits.sonnetWeeklyPercent != null) {
    const sonnet = Math.min(100, Math.max(0, Math.round(limits.sonnetWeeklyPercent)));
    const sonnetColor = getColor(sonnet);
    const sonnetFilled = Math.round(sonnet / 100 * barWidth);
    const sonnetEmpty = barWidth - sonnetFilled;
    const sonnetBar = `${sonnetColor}${"\u2588".repeat(sonnetFilled)}${DIM4}${"\u2591".repeat(sonnetEmpty)}${RESET}`;
    const sonnetReset = formatResetTime(limits.sonnetWeeklyResetsAt);
    const sonnetPart = sonnetReset ? `${DIM4}sn:${RESET}[${sonnetBar}]${sonnetColor}${sonnet}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${sonnetReset})${RESET}` : `${DIM4}sn:${RESET}[${sonnetBar}]${sonnetColor}${sonnet}%${RESET}${staleMarker}`;
    parts.push(sonnetPart);
  }
  if (limits.opusWeeklyPercent != null) {
    const opus = Math.min(100, Math.max(0, Math.round(limits.opusWeeklyPercent)));
    const opusColor = getColor(opus);
    const opusFilled = Math.round(opus / 100 * barWidth);
    const opusEmpty = barWidth - opusFilled;
    const opusBar = `${opusColor}${"\u2588".repeat(opusFilled)}${DIM4}${"\u2591".repeat(opusEmpty)}${RESET}`;
    const opusReset = formatResetTime(limits.opusWeeklyResetsAt);
    const opusPart = opusReset ? `${DIM4}op:${RESET}[${opusBar}]${opusColor}${opus}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${opusReset})${RESET}` : `${DIM4}op:${RESET}[${opusBar}]${opusColor}${opus}%${RESET}${staleMarker}`;
    parts.push(opusPart);
  }
  if (limits.scopedWeeklyBuckets != null) {
    for (const bucket of limits.scopedWeeklyBuckets) {
      const value = Math.min(100, Math.max(0, Math.round(bucket.percent)));
      const color = getColor(value);
      const filled = Math.round(value / 100 * barWidth);
      const empty = barWidth - filled;
      const bar = `${color}${"\u2588".repeat(filled)}${DIM4}${"\u2591".repeat(empty)}${RESET}`;
      const reset = formatResetTime(bucket.resetsAt);
      const label = bucket.label.toLowerCase();
      const part = reset ? `${DIM4}${label}:${RESET}[${bar}]${color}${value}%${RESET}${staleMarker}${DIM4}(${resetPrefix}${reset})${RESET}` : `${DIM4}${label}:${RESET}[${bar}]${color}${value}%${RESET}${staleMarker}`;
      parts.push(part);
    }
  }
  if (limits.extraUsagePercent != null && limits.extraUsageLimitUsd != null) {
    const extra = Math.min(100, Math.max(0, Math.round(limits.extraUsagePercent)));
    const extraColor = getColor(extra);
    const extraFilled = Math.round(extra / 100 * barWidth);
    const extraEmpty = barWidth - extraFilled;
    const extraBar = `${extraColor}${"\u2588".repeat(extraFilled)}${DIM4}${"\u2591".repeat(extraEmpty)}${RESET}`;
    const extraReset = formatResetTime(limits.extraUsageResetsAt);
    const dollarPart = `${DIM4}($${(limits.extraUsageSpentUsd ?? 0).toFixed(2)}/$${limits.extraUsageLimitUsd.toFixed(2)})${RESET}`;
    const extraPart = extraReset ? `${DIM4}extra:${RESET}[${extraBar}]${extraColor}${extra}%${RESET}${staleMarker}${dollarPart}${DIM4}(${resetPrefix}${extraReset})${RESET}` : `${DIM4}extra:${RESET}[${extraBar}]${extraColor}${extra}%${RESET}${staleMarker}${dollarPart}`;
    parts.push(extraPart);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
function renderRateLimitsError(result) {
  if (!result?.error)
    return null;
  if (result.error === "no_credentials")
    return null;
  if (result.error === "rate_limited") {
    return result.rateLimits ? null : `${DIM4}[API 429]${RESET}`;
  }
  if (result.error === "auth")
    return `${YELLOW6}[API auth]${RESET}`;
  return `${YELLOW6}[API err]${RESET}`;
}
function renderApiKeyUsageHint(result, apiKeyMode, hasCustomProvider) {
  if (!apiKeyMode)
    return null;
  if (hasCustomProvider)
    return null;
  if (result?.error !== "no_credentials")
    return null;
  return `${DIM4}[usage: set omcHud.rateLimitsProvider]${RESET}`;
}
function bucketUsagePercent(usage) {
  if (usage.type === "percent")
    return usage.value;
  if (usage.type === "credit" && usage.limit > 0)
    return usage.used / usage.limit * 100;
  return null;
}
function renderBucketUsageValue(usage) {
  if (usage.type === "percent")
    return `${Math.round(usage.value)}%`;
  if (usage.type === "credit")
    return `${usage.used}/${usage.limit}`;
  return usage.value;
}
function renderCustomBuckets(result, thresholdPercent = 85) {
  if (result.error && result.buckets.length === 0) {
    return `${YELLOW6}[cmd:err]${RESET}`;
  }
  if (result.buckets.length === 0)
    return null;
  const staleMarker = result.stale ? `${DIM4}*${RESET}` : "";
  const parts = result.buckets.map((bucket) => {
    const pct = bucketUsagePercent(bucket.usage);
    const color = pct != null ? getColor(pct) : "";
    const colorReset = pct != null ? RESET : "";
    const usageStr = renderBucketUsageValue(bucket.usage);
    let resetPart = "";
    if (bucket.resetsAt && pct != null && pct >= thresholdPercent) {
      const d = new Date(bucket.resetsAt);
      if (!isNaN(d.getTime())) {
        const str = formatResetTime(d);
        if (str)
          resetPart = `${DIM4}(${str})${RESET}`;
      }
    }
    return `${DIM4}${bucket.label}:${RESET}${color}${usageStr}${colorReset}${staleMarker}${resetPart}`;
  });
  return parts.join(" ");
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/permission.js
function renderPermission(pending) {
  if (!pending)
    return null;
  return `${yellow("APPROVE?")} ${dim(pending.toolName.toLowerCase())}:${pending.targetSummary}`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/thinking.js
var CYAN6 = "\x1B[36m";
function renderThinking(state, format = "text", labels = DEFAULT_HUD_LABELS) {
  if (!state?.active)
    return null;
  switch (format) {
    case "bubble":
      return "\u{1F4AD}";
    case "brain":
      return "\u{1F9E0}";
    case "face":
      return "\u{1F914}";
    case "text":
      return `${CYAN6}${labels.thinking}${RESET}`;
    default:
      return "\u{1F4AD}";
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/session.js
function renderSession(session) {
  if (!session)
    return null;
  const colorize = session.health === "critical" ? red : session.health === "warning" ? yellow : green;
  return `session:${colorize(`${session.durationMinutes}m`)}`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/cli/utils/formatting.js
function formatTokenCount(tokens) {
  if (tokens < 1e3)
    return `${tokens}`;
  if (tokens < 1e6)
    return `${(tokens / 1e3).toFixed(1)}k`;
  return `${(tokens / 1e6).toFixed(2)}M`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/token-usage.js
function renderTokenUsage(usage, sessionTotalTokens, labels = DEFAULT_HUD_LABELS) {
  if (!usage)
    return null;
  const hasUsage = usage.inputTokens > 0 || usage.outputTokens > 0;
  if (!hasUsage)
    return null;
  const parts = [
    `${labels.tokens}:i${formatTokenCount(usage.inputTokens)}/o${formatTokenCount(usage.outputTokens)}`
  ];
  if (usage.reasoningTokens && usage.reasoningTokens > 0) {
    parts.push(`r${formatTokenCount(usage.reasoningTokens)}`);
  }
  if (sessionTotalTokens && sessionTotalTokens > 0) {
    parts.push(`s${formatTokenCount(sessionTotalTokens)}`);
  }
  return parts.join(" ");
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/enterprise-cost.js
var GREEN8 = "\x1B[32m";
var YELLOW7 = "\x1B[33m";
var RED5 = "\x1B[31m";
var DIM5 = "\x1B[2m";
var WARNING_THRESHOLD2 = 70;
var CRITICAL_THRESHOLD2 = 90;
function getColor2(percent) {
  if (percent >= CRITICAL_THRESHOLD2)
    return RED5;
  if (percent >= WARNING_THRESHOLD2)
    return YELLOW7;
  return GREEN8;
}
function formatMoney(amount, decimals) {
  const [intPart, decPart] = amount.toFixed(decimals).split(".");
  const withCommas = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}
function currencyPrefix(currency) {
  return currency.toUpperCase() === "USD" ? "$" : `${currency.toUpperCase()} `;
}
function renderEnterpriseCost(limits, stale) {
  if (!limits || limits.enterpriseSpentUsd === void 0)
    return null;
  const staleMarker = stale ? `${DIM5}*${RESET}` : "";
  const currency = limits.enterpriseCurrency ?? "USD";
  const prefix = currencyPrefix(currency);
  const decimals = limits.enterpriseDecimalPlaces ?? 2;
  const spentStr = formatMoney(limits.enterpriseSpentUsd, decimals);
  if (limits.enterpriseLimitUsd == null) {
    return `${DIM5}spent:${RESET}${prefix}${spentStr}${staleMarker}`;
  }
  const limitStr = formatMoney(limits.enterpriseLimitUsd, decimals);
  const utilization = limits.enterpriseUtilization ?? 0;
  const rounded = Math.min(100, Math.max(0, Math.round(utilization)));
  const color = getColor2(rounded);
  return `${DIM5}spent:${RESET}${prefix}${spentStr}/${prefix}${limitStr} ${color}(${rounded}%)${RESET}${staleMarker}`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/prompt-time.js
function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1e3);
  if (totalSeconds < 60)
    return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60)
    return `${totalMinutes}m${totalSeconds % 60}s`;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}h${totalMinutes % 60}m`;
}
function renderPromptTime(promptTime, now) {
  if (!promptTime)
    return null;
  if (now) {
    const elapsed = now.getTime() - promptTime.getTime();
    if (elapsed >= 0) {
      return `${dim("\u23F1")}${formatElapsed(elapsed)}`;
    }
  }
  const hours = String(promptTime.getHours()).padStart(2, "0");
  const minutes = String(promptTime.getMinutes()).padStart(2, "0");
  const seconds = String(promptTime.getSeconds()).padStart(2, "0");
  return `${dim("prompt:")}${hours}:${minutes}:${seconds}`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/autopilot.js
var CYAN7 = "\x1B[36m";
var GREEN9 = "\x1B[32m";
var YELLOW8 = "\x1B[33m";
var RED6 = "\x1B[31m";
var MAGENTA3 = "\x1B[35m";
var PHASE_NAMES = {
  expansion: "Expand",
  planning: "Plan",
  execution: "Build",
  qa: "QA",
  validation: "Verify",
  complete: "Done",
  failed: "Failed"
};
var PHASE_INDEX = {
  expansion: 1,
  planning: 2,
  execution: 3,
  qa: 4,
  validation: 5,
  complete: 5,
  failed: 0
};
function renderAutopilot(state, _thresholds) {
  if (!state?.active) {
    return null;
  }
  if (state.workflow?.invalid) {
    return `${CYAN7}[AUTOPILOT]${RESET} ${RED6}workflow:invalid${RESET}`;
  }
  if (state.workflow?.name && state.workflow.currentStage && state.workflow.currentStageIndex && state.workflow.stagesTotal) {
    const workflowName = state.workflow.name.slice(0, 32);
    return `${CYAN7}[AUTOPILOT]${RESET} workflow:${workflowName} v${state.workflow.version}#${state.workflow.shortHash} | ${state.workflow.currentStage} ${state.workflow.currentStageIndex}/${state.workflow.stagesTotal}`;
  }
  const { phase, iteration, maxIterations, tasksCompleted, tasksTotal, filesCreated } = state;
  const phaseNum = PHASE_INDEX[phase] || 0;
  const phaseName = PHASE_NAMES[phase] || phase;
  let phaseColor;
  switch (phase) {
    case "complete":
      phaseColor = GREEN9;
      break;
    case "failed":
      phaseColor = RED6;
      break;
    case "validation":
      phaseColor = MAGENTA3;
      break;
    case "qa":
      phaseColor = YELLOW8;
      break;
    default:
      phaseColor = CYAN7;
  }
  let output = `${CYAN7}[AUTOPILOT]${RESET} Phase ${phaseColor}${phaseNum}/5${RESET}: ${phaseName}`;
  if (iteration > 1) {
    output += ` (iter ${iteration}/${maxIterations})`;
  }
  if (phase === "execution" && tasksTotal && tasksTotal > 0) {
    const taskColor = tasksCompleted === tasksTotal ? GREEN9 : YELLOW8;
    output += ` | Tasks: ${taskColor}${tasksCompleted || 0}/${tasksTotal}${RESET}`;
  }
  if (filesCreated && filesCreated > 0) {
    output += ` | ${filesCreated} files`;
  }
  return output;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/cwd.js
import { homedir as homedir3 } from "node:os";
import { basename as basename5, dirname as dirname9 } from "node:path";
function osc8Link(url, text) {
  return `\x1B]8;;${url}\x1B\\${text}\x1B]8;;\x1B\\`;
}
function pathToFileUrl(absPath) {
  const normalized = absPath.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }
  return `file://${normalized}`;
}
function renderCwd(cwd, format = "relative", useHyperlinks = false) {
  if (!cwd)
    return null;
  let displayPath;
  switch (format) {
    case "relative": {
      const home = homedir3().replace(/\\/g, "/");
      const normalizedCwd = cwd.replace(/\\/g, "/");
      if (normalizedCwd === home) {
        displayPath = "~";
      } else if (normalizedCwd.startsWith(`${home}/`)) {
        displayPath = "~" + normalizedCwd.slice(home.length);
      } else {
        displayPath = cwd;
      }
      break;
    }
    case "absolute":
      displayPath = cwd;
      break;
    case "folder": {
      const parent = basename5(dirname9(cwd));
      const folder = basename5(cwd);
      displayPath = parent ? `${parent}/${folder}` : folder;
      break;
    }
    default:
      displayPath = cwd;
  }
  const rendered = `${dim(displayPath)}`;
  if (useHyperlinks) {
    const url = pathToFileUrl(cwd);
    return osc8Link(url, rendered);
  }
  return rendered;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/hostname.js
import { hostname } from "node:os";
function renderHostname() {
  const full = hostname();
  if (!full)
    return null;
  const short = full.split(".")[0];
  if (!short)
    return null;
  return cyan(`host:${short}`);
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/git.js
import { execFileSync as execFileSync4 } from "node:child_process";
import { realpathSync as realpathSync3 } from "node:fs";
import { resolve as resolve3, basename as basename6 } from "node:path";
var CACHE_TTL_MS2 = 3e4;
var repoCache = /* @__PURE__ */ new Map();
var branchCache = /* @__PURE__ */ new Map();
var worktreeCache = /* @__PURE__ */ new Map();
var statusCache = /* @__PURE__ */ new Map();
function git(args, cwd) {
  return execFileSync4("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: 1e3,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  }).trim();
}
function getGitRepoName(cwd) {
  const key = cwd ? resolve3(cwd) : process.cwd();
  const cached = repoCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  let result = null;
  try {
    const url = git(["remote", "get-url", "origin"], cwd);
    if (!url) {
      result = null;
    } else {
      const match = url.match(/\/([^/]+?)(?:\.git)?$/) || url.match(/:([^/]+?)(?:\.git)?$/);
      result = match ? match[1].replace(/\.git$/, "") : null;
    }
  } catch {
    result = null;
  }
  repoCache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS2 });
  return result;
}
function getGitBranch(cwd) {
  const key = cwd ? resolve3(cwd) : process.cwd();
  const cached = branchCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  let result = null;
  try {
    const branch = git(["branch", "--show-current"], cwd);
    result = branch || null;
  } catch {
    result = null;
  }
  branchCache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS2 });
  return result;
}
function getWorktreeInfo(cwd) {
  const key = cwd ? resolve3(cwd) : process.cwd();
  const cached = worktreeCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  let result = { isWorktree: false, worktreeName: null };
  try {
    const gitDir = git(["rev-parse", "--git-dir"], cwd);
    const gitCommonDir = git(["rev-parse", "--git-common-dir"], cwd);
    let resolvedGitDir = resolve3(key, gitDir);
    let resolvedCommonDir = resolve3(key, gitCommonDir);
    try {
      resolvedGitDir = realpathSync3(resolvedGitDir);
    } catch {
    }
    try {
      resolvedCommonDir = realpathSync3(resolvedCommonDir);
    } catch {
    }
    if (resolvedGitDir !== resolvedCommonDir) {
      result = { isWorktree: true, worktreeName: basename6(resolvedGitDir) };
    }
  } catch {
  }
  worktreeCache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS2 });
  return result;
}
function renderGitRepo(cwd) {
  const repo = getGitRepoName(cwd);
  if (!repo)
    return null;
  return `${dim("repo:")}${cyan(repo)}`;
}
function renderGitBranch(cwd) {
  const branch = getGitBranch(cwd);
  if (!branch)
    return null;
  const wtInfo = getWorktreeInfo(cwd);
  if (wtInfo.isWorktree && wtInfo.worktreeName) {
    return `${dim("branch:")}${cyan(branch)} ${dim("(wt:")}${cyan(wtInfo.worktreeName)}${dim(")")}`;
  }
  return `${dim("branch:")}${cyan(branch)}`;
}
function getGitStatusCounts(cwd) {
  const key = cwd ? resolve3(cwd) : process.cwd();
  const cached = statusCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  let result = null;
  try {
    const output = git(["--no-optional-locks", "status", "--porcelain", "-b"], cwd);
    let staged = 0, modified = 0, untracked = 0, ahead = 0, behind = 0;
    if (output) {
      const lines = output.split("\n");
      const branchLine = lines[0];
      const aheadMatch = branchLine.match(/\bahead (\d+)/);
      const behindMatch = branchLine.match(/\bbehind (\d+)/);
      if (aheadMatch)
        ahead = parseInt(aheadMatch[1], 10);
      if (behindMatch)
        behind = parseInt(behindMatch[1], 10);
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.length < 2)
          continue;
        const idx = line[0];
        const wt = line[1];
        if (idx === "?") {
          untracked++;
        } else {
          if (idx !== " " && idx !== "?")
            staged++;
          if (wt === "M" || wt === "D")
            modified++;
        }
      }
    }
    result = { staged, modified, untracked, ahead, behind };
  } catch {
    result = null;
  }
  statusCache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS2 });
  return result;
}
function renderGitStatus(cwd, labels = DEFAULT_HUD_LABELS) {
  const counts = getGitStatusCounts(cwd);
  if (!counts)
    return null;
  const { staged, modified, untracked, ahead, behind } = counts;
  if (staged === 0 && modified === 0 && untracked === 0 && ahead === 0 && behind === 0) {
    return null;
  }
  const parts = [];
  if (staged > 0)
    parts.push(`${green(labels.staged)}${staged}`);
  if (modified > 0)
    parts.push(`${red(labels.modified)}${modified}`);
  if (untracked > 0)
    parts.push(`${cyan(labels.untracked)}${untracked}`);
  if (ahead > 0)
    parts.push(`${green(labels.ahead)}${ahead}`);
  if (behind > 0)
    parts.push(`${red(labels.behind)}${behind}`);
  return parts.join(" ");
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/multi-repo.js
import { execFileSync as execFileSync5 } from "node:child_process";
import { existsSync as existsSync11, readdirSync as readdirSync4, statSync as statSync5 } from "node:fs";
import { basename as basename7, join as join13, resolve as resolve4 } from "node:path";
var ACTIVITY_WINDOW_MS = 5 * 60 * 1e3;
var SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var CACHE_TTL_MS3 = 3e4;
var multiRepoCache = /* @__PURE__ */ new Map();
function isGitRepo(dir) {
  try {
    execFileSync5("git", ["rev-parse", "--show-toplevel"], {
      cwd: dir,
      encoding: "utf-8",
      timeout: 1e3,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    return true;
  } catch {
    return false;
  }
}
function looksLikeRepo(entryPath) {
  return existsSync11(join13(entryPath, ".git"));
}
function countActiveSessions(cwd) {
  const sessionsDir = join13(getOmcRoot(cwd), "state", "sessions");
  if (!existsSync11(sessionsDir))
    return 0;
  const now = Date.now();
  let active = 0;
  try {
    const entries = readdirSync4(sessionsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory())
        continue;
      if (!SESSION_ID_PATTERN.test(entry.name))
        continue;
      const dirPath = join13(sessionsDir, entry.name);
      let fresh = false;
      try {
        if (now - statSync5(dirPath).mtimeMs < ACTIVITY_WINDOW_MS) {
          fresh = true;
        } else {
          for (const f of readdirSync4(dirPath)) {
            try {
              if (now - statSync5(join13(dirPath, f)).mtimeMs < ACTIVITY_WINDOW_MS) {
                fresh = true;
                break;
              }
            } catch {
            }
          }
        }
      } catch {
      }
      if (fresh)
        active++;
    }
  } catch {
    return 0;
  }
  return active;
}
function detectMultiRepo(cwd) {
  const key = cwd ? resolve4(cwd) : process.cwd();
  const cached = multiRepoCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  let result = null;
  try {
    if (isGitRepo(key)) {
      multiRepoCache.set(key, { value: null, expiresAt: Date.now() + CACHE_TTL_MS3 });
      return null;
    }
    let subrepoCount = 0;
    try {
      const entries = readdirSync4(key, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory())
          continue;
        if (entry.name.startsWith("."))
          continue;
        if (looksLikeRepo(join13(key, entry.name)))
          subrepoCount++;
      }
    } catch {
    }
    if (subrepoCount < 2) {
      multiRepoCache.set(key, { value: null, expiresAt: Date.now() + CACHE_TTL_MS3 });
      return null;
    }
    const hasMarker = existsSync11(join13(key, ".omc-workspace"));
    const activeSessions = hasMarker ? countActiveSessions(key) : 0;
    result = {
      isMultiRepo: true,
      hasMarker,
      parentName: basename7(key),
      subrepoCount,
      activeSessions
    };
  } catch {
    result = null;
  }
  multiRepoCache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS3 });
  return result;
}
function renderMultiRepo(cwd) {
  const info = detectMultiRepo(cwd);
  if (!info || !info.isMultiRepo)
    return null;
  if (!info.hasMarker) {
    return yellow("\u26A0 multi-repo detected") + dim(" \u2014 run: ") + cyan(`echo {} > "${info.parentName}/.omc-workspace"`) + dim(" to enable shared state");
  }
  const sessionsPart = info.activeSessions > 0 ? ` ${dim("sessions:~")}${green(String(info.activeSessions))}` : ` ${dim("sessions:~")}${dim("0")}`;
  return `${dim("mr:")}${cyan(info.parentName)} ${dim("repos:")}${cyan(String(info.subrepoCount))}` + sessionsPart;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/model.js
function extractVersion(modelId) {
  const idMatch = modelId.match(/(?:opus|sonnet|haiku)-(\d+)-(\d+)/i);
  if (idMatch)
    return `${idMatch[1]}.${idMatch[2]}`;
  const singleSegmentIdMatch = modelId.match(/(?:^|[.-])claude-(?:opus|sonnet|haiku)-(\d+)$/i);
  if (singleSegmentIdMatch)
    return singleSegmentIdMatch[1];
  const legacyIdMatch = modelId.match(/claude-(\d+)(?:-(\d+))?-(?:opus|sonnet|haiku)/i);
  if (legacyIdMatch) {
    return legacyIdMatch[2] ? `${legacyIdMatch[1]}.${legacyIdMatch[2]}` : legacyIdMatch[1];
  }
  const displayMatch = modelId.match(/(?:opus|sonnet|haiku)\s+(\d+(?:\.\d+)?)/i);
  if (displayMatch)
    return displayMatch[1];
  return null;
}
function formatModelName(modelId, format = "short") {
  if (!modelId)
    return null;
  if (format === "full") {
    return truncateToWidth(modelId, 40);
  }
  const id = modelId.toLowerCase();
  let shortName = null;
  if (id.includes("opus"))
    shortName = "Opus";
  else if (id.includes("sonnet"))
    shortName = "Sonnet";
  else if (id.includes("haiku"))
    shortName = "Haiku";
  if (!shortName) {
    return truncateToWidth(modelId, 20);
  }
  if (format === "versioned") {
    const version = extractVersion(id);
    if (version)
      return `${shortName} ${version}`;
  }
  return shortName;
}
function renderModel(modelId, format = "versioned", labels = DEFAULT_HUD_LABELS) {
  const name = formatModelName(modelId, format);
  if (!name)
    return null;
  return cyan(`${labels.model}: ${name}`);
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/api-key-source.js
import { existsSync as existsSync12, readFileSync as readFileSync11 } from "fs";
import { join as join14 } from "path";
function settingsFileHasApiKey(filePath) {
  try {
    if (!existsSync12(filePath))
      return false;
    const content = readFileSync11(filePath, "utf-8");
    const settings = JSON.parse(content);
    const env = settings?.env;
    if (typeof env !== "object" || env === null)
      return false;
    return "ANTHROPIC_API_KEY" in env;
  } catch {
    return false;
  }
}
function detectApiKeySource(cwd) {
  if (cwd) {
    const projectSettings = join14(cwd, ".claude", "settings.local.json");
    if (settingsFileHasApiKey(projectSettings))
      return "project";
  }
  const globalSettings = join14(getClaudeConfigDir(), "settings.json");
  if (settingsFileHasApiKey(globalSettings))
    return "global";
  if (process.env.ANTHROPIC_API_KEY)
    return "env";
  return null;
}
function renderApiKeySource(source) {
  if (!source)
    return null;
  return `${dim("key:")}${cyan(source)}`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/call-counts.js
function shouldUseAscii(format = "auto") {
  if (format === "ascii")
    return true;
  if (format === "emoji")
    return false;
  return process.platform === "win32" || isWSL();
}
function getIcons(format = "auto", labels = DEFAULT_HUD_LABELS) {
  const useAscii = shouldUseAscii(format);
  return {
    tool: useAscii ? `${labels.tool}:` : "\u{1F527}",
    agent: useAscii ? `${labels.agent}:` : "\u{1F916}",
    skill: useAscii ? `${labels.skill}:` : "\u26A1"
  };
}
function renderCallCounts(toolCalls, agentInvocations, skillUsages, format = "auto", labels = DEFAULT_HUD_LABELS) {
  const parts = [];
  const icons = getIcons(format, labels);
  if (toolCalls > 0) {
    parts.push(`${icons.tool}${toolCalls}`);
  }
  if (agentInvocations > 0) {
    parts.push(`${icons.agent}${agentInvocations}`);
  }
  if (skillUsages > 0) {
    parts.push(`${icons.skill}${skillUsages}`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/context-warning.js
var YELLOW9 = "\x1B[33m";
var RED7 = "\x1B[31m";
var BOLD2 = "\x1B[1m";
function renderContextLimitWarning(contextPercent, threshold, autoCompact) {
  const safePercent = Math.min(100, Math.max(0, Math.round(contextPercent)));
  if (safePercent < threshold) {
    return null;
  }
  const isCritical = safePercent >= 90;
  const color = isCritical ? RED7 : YELLOW9;
  const icon = isCritical ? "!!" : "!";
  const action = autoCompact ? "(auto-compact queued)" : "run /compact";
  return `${color}${BOLD2}[${icon}] ctx ${safePercent}% >= ${threshold}% threshold - ${action}${RESET}`;
}
function renderPayloadLimitWarning(payloadEstimate) {
  if (!payloadEstimate || payloadEstimate.pressure === "normal") {
    return null;
  }
  const isCritical = payloadEstimate.pressure === "critical";
  const color = isCritical ? RED7 : YELLOW9;
  const icon = isCritical ? "!!" : "!";
  const action = isCritical ? "compact may fail; consider new session" : "consider /compact soon";
  return `${color}${BOLD2}[${icon}] ${payloadEstimate.label} - ${action}${RESET}`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/session-summary.js
function renderSessionSummary(summaryState) {
  if (!summaryState?.summary)
    return null;
  return dim("summary:") + summaryState.summary;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/elements/last-tool.js
function renderLastTool(lastToolName) {
  if (!lastToolName)
    return null;
  return `${dim("tool:")}${lastToolName}`;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/render.js
var ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/;
var PLAIN_SEPARATOR = " | ";
var DIM_SEPARATOR = dim(PLAIN_SEPARATOR);
function buildMainElementOrder(elementOrder) {
  if (!Array.isArray(elementOrder) || elementOrder.length === 0) {
    return DEFAULT_ELEMENT_ORDER.main;
  }
  const known = new Set(DEFAULT_ELEMENT_ORDER.main);
  const seen = /* @__PURE__ */ new Set();
  const configured = elementOrder.filter((name) => {
    if (!known.has(name) || seen.has(name)) {
      return false;
    }
    seen.add(name);
    return true;
  });
  const remaining = DEFAULT_ELEMENT_ORDER.main.filter((name) => !configured.includes(name));
  return [...configured, ...remaining];
}
function truncateLineToMaxWidth(line, maxWidth) {
  if (maxWidth <= 0)
    return "";
  if (stringWidth(line) <= maxWidth)
    return line;
  const ELLIPSIS = "...";
  const ellipsisWidth = 3;
  const targetWidth = Math.max(0, maxWidth - ellipsisWidth);
  let visibleWidth = 0;
  let result = "";
  let hasAnsi = false;
  let i = 0;
  while (i < line.length) {
    const remaining = line.slice(i);
    const ansiMatch = remaining.match(ANSI_REGEX);
    if (ansiMatch && ansiMatch.index === 0) {
      result += ansiMatch[0];
      hasAnsi = true;
      i += ansiMatch[0].length;
      continue;
    }
    const codePoint = line.codePointAt(i);
    const codeUnits = codePoint > 65535 ? 2 : 1;
    const char = line.slice(i, i + codeUnits);
    const charWidth = getCharWidth(char);
    if (visibleWidth + charWidth > targetWidth)
      break;
    result += char;
    visibleWidth += charWidth;
    i += codeUnits;
  }
  const reset = hasAnsi ? "\x1B[0m" : "";
  return result + reset + ELLIPSIS;
}
function wrapLineToMaxWidth(line, maxWidth) {
  if (maxWidth <= 0)
    return [""];
  if (stringWidth(line) <= maxWidth)
    return [line];
  const separator = line.includes(DIM_SEPARATOR) ? DIM_SEPARATOR : line.includes(PLAIN_SEPARATOR) ? PLAIN_SEPARATOR : null;
  if (!separator) {
    return [truncateLineToMaxWidth(line, maxWidth)];
  }
  const segments = line.split(separator);
  if (segments.length <= 1) {
    return [truncateLineToMaxWidth(line, maxWidth)];
  }
  const wrapped = [];
  let current = segments[0] ?? "";
  for (let i = 1; i < segments.length; i += 1) {
    const nextSegment = segments[i] ?? "";
    const candidate = `${current}${separator}${nextSegment}`;
    if (stringWidth(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (stringWidth(current) > maxWidth) {
      wrapped.push(truncateLineToMaxWidth(current, maxWidth));
    } else {
      wrapped.push(current);
    }
    current = nextSegment;
  }
  if (stringWidth(current) > maxWidth) {
    wrapped.push(truncateLineToMaxWidth(current, maxWidth));
  } else {
    wrapped.push(current);
  }
  return wrapped;
}
function applyMaxWidthByMode(lines, maxWidth, wrapMode) {
  if (!maxWidth || maxWidth <= 0)
    return lines;
  if (wrapMode === "wrap") {
    return lines.flatMap((line) => wrapLineToMaxWidth(line, maxWidth));
  }
  return lines.map((line) => truncateLineToMaxWidth(line, maxWidth));
}
function limitOutputLines(lines, maxLines) {
  const limit = Math.max(1, maxLines ?? DEFAULT_HUD_CONFIG.elements.maxOutputLines);
  if (lines.length <= limit) {
    return lines;
  }
  const truncatedCount = lines.length - limit + 1;
  return [...lines.slice(0, limit - 1), `... (+${truncatedCount} lines)`];
}
async function render(context, config) {
  const { elements: enabledElements } = config;
  const hudLabels = config.labels ?? DEFAULT_HUD_LABELS;
  const rendered = /* @__PURE__ */ new Map();
  const renderedDetail = /* @__PURE__ */ new Map();
  if (enabledElements.hostname) {
    const hostnameElement = renderHostname();
    if (hostnameElement)
      rendered.set("hostname", hostnameElement);
  }
  if (enabledElements.cwd) {
    const cwdElement = renderCwd(context.cwd, enabledElements.cwdFormat || "relative", enabledElements.useHyperlinks ?? false);
    if (cwdElement)
      rendered.set("cwd", cwdElement);
  }
  const multiRepoElement = enabledElements.gitRepo ? renderMultiRepo(context.cwd) : null;
  if (multiRepoElement) {
    rendered.set("gitRepo", multiRepoElement);
  } else {
    if (enabledElements.gitRepo) {
      const gitRepoElement = renderGitRepo(context.cwd);
      if (gitRepoElement)
        rendered.set("gitRepo", gitRepoElement);
    }
    if (enabledElements.gitBranch) {
      const gitBranchElement = renderGitBranch(context.cwd);
      if (gitBranchElement)
        rendered.set("gitBranch", gitBranchElement);
    }
    if (enabledElements.gitStatus) {
      const gitStatusElement = renderGitStatus(context.cwd, hudLabels);
      if (gitStatusElement)
        rendered.set("gitStatus", gitStatusElement);
    }
  }
  const modelSource = enabledElements.modelFormat === "full" ? context.modelId ?? context.modelName : context.modelName;
  if (enabledElements.model && modelSource) {
    const modelElement = renderModel(modelSource, enabledElements.modelFormat, hudLabels);
    if (modelElement)
      rendered.set("model", modelElement);
  }
  if (enabledElements.apiKeySource && context.apiKeySource) {
    const keySource = renderApiKeySource(context.apiKeySource);
    if (keySource)
      rendered.set("apiKeySource", keySource);
  }
  if (enabledElements.profile && context.profileName) {
    rendered.set("profile", bold(`profile:${context.profileName}`));
  }
  if (enabledElements.omcLabel) {
    const localSuffix = isRuntimePackageLocal() ? "L" : "";
    const versionTag = context.omcVersion ? `#${context.omcVersion}${localSuffix}` : localSuffix ? `#${localSuffix}` : "";
    if (enabledElements.updateNotification !== false && context.updateAvailable) {
      rendered.set("omcLabel", bold(`[OMJ${versionTag}] -> ${context.updateAvailable} omj update`));
    } else {
      rendered.set("omcLabel", bold(`[OMJ${versionTag}]`));
    }
  }
  const isEnterprise = enabledElements.enterpriseMode !== void 0 ? enabledElements.enterpriseMode : (context.subscriptionType ?? "").toLowerCase() === "enterprise" || /claude_zero/i.test(context.rateLimitTier ?? "");
  const enterpriseCostReplacesRateLimits = isEnterprise && context.rateLimitsResult?.rateLimits?.enterpriseSpentUsd !== void 0;
  if (enabledElements.rateLimits && context.rateLimitsResult && !enterpriseCostReplacesRateLimits) {
    if (context.rateLimitsResult.rateLimits) {
      const stale = context.rateLimitsResult.stale;
      const limits = enabledElements.useBars ? renderRateLimitsWithBar(context.rateLimitsResult.rateLimits, void 0, stale) : renderRateLimits(context.rateLimitsResult.rateLimits, stale);
      if (limits)
        rendered.set("rateLimits", limits);
    } else {
      const errorIndicator = renderRateLimitsError(context.rateLimitsResult);
      if (errorIndicator) {
        rendered.set("rateLimits", errorIndicator);
      } else {
        const hint = renderApiKeyUsageHint(context.rateLimitsResult, context.apiKeyMode ?? false, config.rateLimitsProvider?.type === "custom");
        if (hint)
          rendered.set("rateLimits", hint);
      }
    }
  }
  if (context.customBuckets) {
    const thresholdPercent = config.rateLimitsProvider?.resetsAtDisplayThresholdPercent;
    const custom = renderCustomBuckets(context.customBuckets, thresholdPercent);
    if (custom)
      rendered.set("customBuckets", custom);
  }
  if (enabledElements.permissionStatus && context.pendingPermission) {
    const permission = renderPermission(context.pendingPermission);
    if (permission)
      rendered.set("permission", permission);
  }
  if (enabledElements.thinking && context.thinkingState) {
    const thinking = renderThinking(context.thinkingState, enabledElements.thinkingFormat, hudLabels);
    if (thinking)
      rendered.set("thinking", thinking);
  }
  if (enabledElements.promptTime) {
    const prompt = renderPromptTime(context.promptTime, /* @__PURE__ */ new Date());
    if (prompt)
      rendered.set("promptTime", prompt);
  }
  if (enabledElements.sessionHealth && context.sessionHealth) {
    const showDuration = enabledElements.showSessionDuration ?? true;
    if (showDuration) {
      const session = renderSession(context.sessionHealth);
      if (session)
        rendered.set("session", session);
    }
  }
  if (isEnterprise && enabledElements.showEnterpriseCost !== false) {
    const stale = context.rateLimitsResult?.stale;
    const cost = renderEnterpriseCost(context.rateLimitsResult?.rateLimits, stale);
    if (cost) {
      rendered.set("enterpriseCost", cost);
    } else if (enabledElements.showTokens === true) {
      const tokenUsage = renderTokenUsage(context.lastRequestTokenUsage, context.sessionTotalTokens, hudLabels);
      if (tokenUsage)
        rendered.set("tokens", tokenUsage);
    }
  } else if (enabledElements.showTokens === true) {
    const tokenUsage = renderTokenUsage(context.lastRequestTokenUsage, context.sessionTotalTokens, hudLabels);
    if (tokenUsage)
      rendered.set("tokens", tokenUsage);
  }
  if (enabledElements.ralph && context.ralph) {
    const ralph = renderRalph(context.ralph, config.thresholds, hudLabels);
    if (ralph)
      rendered.set("ralph", ralph);
  }
  if (enabledElements.autopilot && context.autopilot) {
    const autopilot = renderAutopilot(context.autopilot, config.thresholds);
    if (autopilot)
      rendered.set("autopilot", autopilot);
  }
  if (enabledElements.prdStory && context.prd) {
    const prd = renderPrd(context.prd);
    if (prd)
      rendered.set("prd", prd);
  }
  if (enabledElements.activeSkills) {
    const skills = renderSkills(context.ultrawork, context.ralph, enabledElements.lastSkill ?? true ? context.lastSkill : null);
    if (skills)
      rendered.set("skills", skills);
  }
  if ((enabledElements.lastSkill ?? true) && !enabledElements.activeSkills) {
    const lastSkillElement = renderLastSkill(context.lastSkill);
    if (lastSkillElement)
      rendered.set("lastSkill", lastSkillElement);
  }
  if (enabledElements.contextBar) {
    const ctx = enabledElements.useBars ? renderContextWithBar(context.contextPercent, config.thresholds, 10, context.contextDisplayScope, hudLabels) : renderContext(context.contextPercent, config.thresholds, context.contextDisplayScope, hudLabels);
    if (ctx)
      rendered.set("contextBar", ctx);
  }
  if (enabledElements.agents) {
    const format = enabledElements.agentsFormat || "codes";
    if (format === "multiline") {
      const maxLines = enabledElements.agentsMaxLines || 5;
      const result = renderAgentsMultiLine(context.activeAgents, maxLines);
      if (result.headerPart)
        rendered.set("agents", result.headerPart);
      if (result.detailLines.length > 0) {
        renderedDetail.set("agents", result.detailLines);
      }
    } else {
      const agents = renderAgentsByFormat(context.activeAgents, format);
      if (agents)
        rendered.set("agents", agents);
    }
  }
  if (enabledElements.backgroundTasks) {
    const bg = renderBackground(context.backgroundTasks, hudLabels);
    if (bg)
      rendered.set("background", bg);
  }
  const showCounts = enabledElements.showCallCounts ?? true;
  if (showCounts) {
    const counts = renderCallCounts(context.toolCallCount, context.agentCallCount, context.skillCallCount, enabledElements.callCountsFormat ?? "auto", hudLabels);
    if (counts)
      rendered.set("callCounts", counts);
  }
  if (enabledElements.showLastTool === true) {
    const tool = renderLastTool(context.lastToolName ?? null);
    if (tool)
      rendered.set("lastTool", tool);
  }
  if (enabledElements.sessionSummary && context.sessionSummary) {
    const summary = renderSessionSummary(context.sessionSummary);
    if (summary)
      rendered.set("sessionSummary", summary);
  }
  if (context.missionBoard && (config.missionBoard?.enabled ?? config.elements.missionBoard ?? false)) {
    const mbLines = renderMissionBoard(context.missionBoard, config.missionBoard);
    if (mbLines.length > 0)
      renderedDetail.set("missionBoard", mbLines);
  }
  const ctxWarning = renderContextLimitWarning(context.contextPercent, config.contextLimitWarning.threshold, config.contextLimitWarning.autoCompact);
  if (ctxWarning)
    renderedDetail.set("contextWarning", [ctxWarning]);
  const payloadWarning = renderPayloadLimitWarning(context.payloadEstimate);
  if (payloadWarning)
    renderedDetail.set("payloadWarning", [payloadWarning]);
  if (enabledElements.todos) {
    const todos = renderTodosWithCurrent(context.todos);
    if (todos)
      renderedDetail.set("todos", [todos]);
  }
  const safeArray = (v, fallback) => Array.isArray(v) ? v : fallback;
  const effectiveLayout = {
    line1: safeArray(config.layout?.line1, DEFAULT_ELEMENT_ORDER.line1),
    // `layout.main` remains the advanced authoritative layout control.
    // `elementOrder` is a narrow convenience alias for the main HUD line only.
    main: safeArray(config.layout?.main, buildMainElementOrder(config.elementOrder)),
    detail: safeArray(config.layout?.detail, DEFAULT_ELEMENT_ORDER.detail)
  };
  function collectInline(order) {
    const result = [];
    for (const name of order) {
      const el = rendered.get(name);
      if (el) {
        result.push(el);
      } else {
        const lines = renderedDetail.get(name);
        if (lines && lines.length > 0)
          result.push(lines.join(" "));
      }
    }
    return result;
  }
  function collectDetailLines(order) {
    const result = [];
    for (const name of order) {
      const lines = renderedDetail.get(name);
      if (lines)
        result.push(...lines);
      if (!lines) {
        const inline = rendered.get(name);
        if (inline)
          result.push(inline);
      }
    }
    return result;
  }
  const gitElements = collectInline(effectiveLayout.line1);
  const elements = collectInline(effectiveLayout.main);
  const detailLines = collectDetailLines(effectiveLayout.detail);
  const outputLines = [];
  const gitInfoLine = gitElements.length > 0 ? gitElements.join(dim(PLAIN_SEPARATOR)) : null;
  const headerLine = elements.length > 0 ? elements.join(dim(PLAIN_SEPARATOR)) : null;
  const gitPosition = config.elements.gitInfoPosition ?? "above";
  if (gitPosition === "above") {
    if (gitInfoLine) {
      outputLines.push(gitInfoLine);
    }
    if (headerLine) {
      outputLines.push(headerLine);
    }
  } else {
    if (headerLine) {
      outputLines.push(headerLine);
    }
    if (gitInfoLine) {
      outputLines.push(gitInfoLine);
    }
  }
  const widthAdjustedLines = applyMaxWidthByMode([...outputLines, ...detailLines], config.maxWidth, config.wrapMode);
  const limitedLines = limitOutputLines(widthAdjustedLines, config.elements.maxOutputLines);
  const finalLines = config.maxWidth && config.maxWidth > 0 ? limitedLines.map((line) => truncateLineToMaxWidth(line, config.maxWidth)) : limitedLines;
  return finalLines.join("\n");
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/sanitize.js
var CSI_NON_SGR_REGEX = /\x1b\[\??[0-9;]*[A-LN-Za-ln-z]/g;
var OSC_REGEX = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
var SIMPLE_ESC_REGEX = /\x1b[^[\]]/g;
function stripAnsi2(text) {
  return text.replace(CSI_NON_SGR_REGEX, "").replace(OSC_REGEX, "").replace(SIMPLE_ESC_REGEX, "");
}
function replaceUnicodeBlocks(text) {
  return text.replace(/█/g, "#").replace(/░/g, "-").replace(/▓/g, "=").replace(/▒/g, "-");
}
function sanitizeOutput(output) {
  let sanitized = stripAnsi2(output);
  sanitized = replaceUnicodeBlocks(sanitized);
  const lines = sanitized.split("\n").map((line) => line.trimEnd());
  sanitized = lines.join("\n");
  sanitized = sanitized.replace(/^\n+|\n+$/g, "");
  return sanitized;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/payload-estimate.js
import { closeSync as closeSync4, existsSync as existsSync13, openSync as openSync4, readSync as readSync2, statSync as statSync6 } from "fs";
var ANTHROPIC_REQUEST_PAYLOAD_LIMIT_BYTES = 32e6;
var PAYLOAD_WARNING_BYTES = 22e6;
var PAYLOAD_CRITICAL_BYTES = 26e6;
var COMPACT_BOUNDARY_MARKER = "compact_boundary";
var COMPACT_BOUNDARY_MARKER_BYTES = Buffer.from(COMPACT_BOUNDARY_MARKER);
var SCAN_CHUNK_BYTES = 64 * 1024;
var MAX_BOUNDARY_LINE_BYTES = 256 * 1024;
function toPressure(bytes) {
  if (bytes >= PAYLOAD_CRITICAL_BYTES)
    return "critical";
  if (bytes >= PAYLOAD_WARNING_BYTES)
    return "warning";
  return "normal";
}
function formatPayloadMegabytes(bytes) {
  const mb = bytes / 1e6;
  if (mb < 10)
    return mb.toFixed(1);
  return String(Math.round(mb));
}
function formatPayloadEstimateLabel(estimatedBytes, limitBytes = ANTHROPIC_REQUEST_PAYLOAD_LIMIT_BYTES) {
  return `payload est ~${formatPayloadMegabytes(estimatedBytes)} MB / ${formatPayloadMegabytes(limitBytes)} MB`;
}
function createPayloadEstimate(estimatedBytes, limitBytes = ANTHROPIC_REQUEST_PAYLOAD_LIMIT_BYTES) {
  if (!Number.isFinite(estimatedBytes) || estimatedBytes < 0)
    return null;
  return {
    estimatedBytes,
    limitBytes,
    pressure: toPressure(estimatedBytes),
    label: formatPayloadEstimateLabel(estimatedBytes, limitBytes)
  };
}
function containsCompactBoundaryMarker(value) {
  if (!value || typeof value !== "object")
    return false;
  if (Array.isArray(value)) {
    return value.some(containsCompactBoundaryMarker);
  }
  return Object.entries(value).some(([key, nestedValue]) => {
    if (key === COMPACT_BOUNDARY_MARKER)
      return true;
    if ((key === "type" || key === "subtype" || key === "event" || key === "kind") && nestedValue === COMPACT_BOUNDARY_MARKER) {
      return true;
    }
    return containsCompactBoundaryMarker(nestedValue);
  });
}
function isCompactBoundaryLine(line) {
  const text = line.toString("utf8").trim();
  if (!text.includes(COMPACT_BOUNDARY_MARKER))
    return false;
  if (text === COMPACT_BOUNDARY_MARKER)
    return true;
  try {
    return containsCompactBoundaryMarker(JSON.parse(text));
  } catch {
    return false;
  }
}
function findByteBackward(fd, fromExclusive, byte) {
  let end = fromExclusive;
  const buffer = Buffer.allocUnsafe(SCAN_CHUNK_BYTES);
  while (end > 0) {
    const start = Math.max(0, end - SCAN_CHUNK_BYTES);
    const length = end - start;
    readSync2(fd, buffer, 0, length, start);
    const index = buffer.subarray(0, length).lastIndexOf(byte);
    if (index !== -1)
      return start + index;
    end = start;
  }
  return -1;
}
function findByteForward(fd, fromInclusive, size, byte) {
  let start = fromInclusive;
  const buffer = Buffer.allocUnsafe(SCAN_CHUNK_BYTES);
  while (start < size) {
    const length = Math.min(SCAN_CHUNK_BYTES, size - start);
    readSync2(fd, buffer, 0, length, start);
    const index = buffer.subarray(0, length).indexOf(byte);
    if (index !== -1)
      return start + index;
    start += length;
  }
  return -1;
}
function readLineContainingOffset(fd, size, offset) {
  const previousNewline = findByteBackward(fd, offset, 10);
  const nextNewline = findByteForward(fd, offset, size, 10);
  const startOffset = previousNewline === -1 ? 0 : previousNewline + 1;
  const endOffset = nextNewline === -1 ? size : nextNewline + 1;
  const length = endOffset - startOffset;
  if (length <= 0 || length > MAX_BOUNDARY_LINE_BYTES)
    return null;
  const line = Buffer.allocUnsafe(length);
  readSync2(fd, line, 0, length, startOffset);
  return { line, endOffset };
}
function findLastCompactBoundaryEndOffset(transcriptPath, size) {
  if (size <= 0)
    return null;
  const fd = openSync4(transcriptPath, "r");
  try {
    let end = size;
    const buffer = Buffer.allocUnsafe(Math.min(SCAN_CHUNK_BYTES, size));
    while (end > 0) {
      const start = Math.max(0, end - SCAN_CHUNK_BYTES);
      const length = end - start;
      readSync2(fd, buffer, 0, length, start);
      const chunk = buffer.subarray(0, length);
      let index = chunk.lastIndexOf(COMPACT_BOUNDARY_MARKER_BYTES);
      while (index !== -1) {
        const candidateOffset = start + index;
        const line = readLineContainingOffset(fd, size, candidateOffset);
        if (line && isCompactBoundaryLine(line.line)) {
          return line.endOffset;
        }
        index = chunk.lastIndexOf(COMPACT_BOUNDARY_MARKER_BYTES, index - 1);
      }
      if (start === 0)
        break;
      end = start + COMPACT_BOUNDARY_MARKER_BYTES.length - 1;
    }
  } finally {
    closeSync4(fd);
  }
  return null;
}
function estimateTranscriptPayloadBytes(transcriptPath, size) {
  const boundaryEndOffset = findLastCompactBoundaryEndOffset(transcriptPath, size);
  return boundaryEndOffset === null ? size : Math.max(0, size - boundaryEndOffset);
}
function estimatePayloadFromTranscriptPath(transcriptPath) {
  if (!transcriptPath || !existsSync13(transcriptPath))
    return null;
  try {
    const stat = statSync6(transcriptPath);
    if (!stat.isFile())
      return null;
    return createPayloadEstimate(estimateTranscriptPayloadBytes(transcriptPath, stat.size));
  } catch {
    return null;
  }
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/features/auto-update.js
import { join as join18, dirname as dirname12 } from "path";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/installer/index.js
import { join as join17, dirname as dirname11, resolve as resolve5, isAbsolute as isAbsolute2, basename as basename9 } from "path";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/installer/hooks.js
import { join as join15, dirname as dirname10 } from "path";
import { readFileSync as readFileSync12, existsSync as existsSync14 } from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
import { homedir as homedir4 } from "os";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hooks/keyword-detector/ultrawork/default.js
var ULTRAWORK_DEFAULT_MESSAGE = `<ultrawork-mode>

**MANDATORY**: You MUST say "ULTRAWORK MODE ENABLED!" to the user as your first response when this mode activates. This is non-negotiable.

[CODE RED] Maximum precision required. Ultrathink before acting.

## CERTAINTY PROTOCOL

Do not implement until you understand:
- the user's exact intent
- the existing codebase pattern to follow
- which files own the behavior
- how you will verify the result

If uncertainty remains:
1. Explore the codebase in parallel
2. Gather external docs only when needed
3. Use a planner for non-trivial dependency graphs
4. Ask the user only if ambiguity still blocks safe execution

## AGENT UTILIZATION PRINCIPLES

- **Explore first**: spawn exploration work for code paths, patterns, and tests
- **Research when needed**: use document-specialist / researcher agents for external APIs and official docs
- **Plan non-trivial work**: create a dependency-aware task graph before multi-file implementation
- **Delegate by specialty**: use executor, test-engineer, writer, verifier, architect, or critic where each adds value
- **Parallelize independent work**: fire safe independent tasks simultaneously; keep dependent work sequential

## EXECUTION RULES

- **TODO**: Track every meaningful step and mark it complete immediately
- **PARALLEL**: Run independent exploration, implementation, and verification tasks in parallel where safe
- **BACKGROUND FIRST**: Use background tasks for long-running builds, installs, and test suites
- **CONCISE OUTPUTS**: Every Task/Agent result must return only a short execution summary, target under 100 words, covering what changed, files touched, verification status, and blockers
- **VERIFY**: Re-read the request before claiming completion and confirm every requirement is met

## PLANNING GATE

For non-trivial work, produce a plan that includes:
- Parallel Execution Waves
- Dependency Matrix
- critical path
- acceptance criteria
- verification steps

Do not skip planning just because the likely change feels obvious.

## VERIFICATION GUARANTEE

Nothing is done without proof.

Before reporting completion, collect evidence for:
- build/typecheck success
- relevant tests passing
- manual QA or direct feature exercise when applicable
- no new diagnostics on changed files

WITHOUT evidence = NOT verified = NOT done.

</ultrawork-mode>

---
`;
function getDefaultUltraworkMessage() {
  return ULTRAWORK_DEFAULT_MESSAGE;
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/installer/hooks.js
function getPackageDir() {
  if (typeof __dirname !== "undefined") {
    return join15(__dirname, "..");
  }
  try {
    const __filename = fileURLToPath2(import.meta.url);
    const __dirname2 = dirname10(__filename);
    return join15(__dirname2, "..", "..");
  } catch {
    return process.cwd();
  }
}
function loadTemplate(filename) {
  const templatePath = join15(getPackageDir(), "templates", "hooks", filename);
  if (!existsSync14(templatePath)) {
    return "";
  }
  return readFileSync12(templatePath, "utf-8");
}
function isWindows() {
  return process.platform === "win32";
}
function normalizePath(value) {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}
function isDefaultClaudeConfigDir() {
  return normalizePath(getClaudeConfigDir()) === normalizePath(join15(homedir4(), ".claude"));
}
function quoteCommandPath(path3) {
  return `"${path3.replace(/"/g, '\\"')}"`;
}
function buildHookCommand(filename) {
  if (isWindows()) {
    return `node ${quoteCommandPath(join15(getClaudeConfigDir(), "hooks", filename).replace(/\\/g, "/"))}`;
  }
  if (isDefaultClaudeConfigDir()) {
    return `node "\${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks/${filename}"`;
  }
  return `node ${quoteCommandPath(join15(getClaudeConfigDir(), "hooks", filename).replace(/\\/g, "/"))}`;
}
var ULTRAWORK_MESSAGE = getDefaultUltraworkMessage();
var KEYWORD_DETECTOR_SCRIPT_NODE = loadTemplate("keyword-detector.mjs");
var STOP_CONTINUATION_SCRIPT_NODE = loadTemplate("stop-continuation.mjs");
var PERSISTENT_MODE_SCRIPT_NODE = loadTemplate("persistent-mode.mjs");
var CODE_SIMPLIFIER_SCRIPT_NODE = loadTemplate("code-simplifier.mjs");
var SESSION_START_SCRIPT_NODE = loadTemplate("session-start.mjs");
var POST_TOOL_USE_SCRIPT_NODE = loadTemplate("post-tool-use.mjs");
var HOOKS_SETTINGS_CONFIG_NODE = {
  hooks: {
    UserPromptSubmit: [
      {
        hooks: [
          {
            type: "command",
            command: buildHookCommand("keyword-detector.mjs")
          }
        ]
      }
    ],
    SessionStart: [
      {
        hooks: [
          {
            type: "command",
            command: buildHookCommand("session-start.mjs")
          }
        ]
      }
    ],
    PreToolUse: [
      {
        hooks: [
          {
            type: "command",
            command: buildHookCommand("pre-tool-use.mjs")
          }
        ]
      }
    ],
    PostToolUse: [
      {
        hooks: [
          {
            type: "command",
            command: buildHookCommand("post-tool-use.mjs")
          }
        ]
      }
    ],
    PostToolUseFailure: [
      {
        hooks: [
          {
            type: "command",
            command: buildHookCommand("post-tool-use-failure.mjs")
          }
        ]
      }
    ],
    Stop: [
      {
        hooks: [
          {
            type: "command",
            command: buildHookCommand("persistent-mode.mjs")
          }
        ]
      },
      {
        hooks: [
          {
            type: "command",
            command: buildHookCommand("code-simplifier.mjs")
          }
        ]
      }
    ]
  }
};

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/lib/paths.js
var OMC_PLUGIN_MARKETPLACE_SLUG = "omc";
var OMC_PLUGIN_PACKAGE_NAME = "oh-my-claudecode";
var OMC_PLUGIN_CACHE_REL = `plugins/cache/${OMC_PLUGIN_MARKETPLACE_SLUG}/${OMC_PLUGIN_PACKAGE_NAME}`;
var OMC_PLUGIN_MARKETPLACE_REL = `plugins/marketplaces/${OMC_PLUGIN_MARKETPLACE_SLUG}`;
var OMC_CONFIG_FILE_REL = ".omc-config.json";

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/utils/user-skill-compat.js
import { basename as basename8, join as join16 } from "path";
var CLAUDE_SKILLS_DIR = join16(getClaudeConfigDir(), "skills");
var OMC_LEARNED_DIR = join16(CLAUDE_SKILLS_DIR, "omc-learned");

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/installer/claude-md-transaction.js
var CLAUDE_MD_IMPORT_START = "<!-- OMC:IMPORT:START -->";
var CLAUDE_MD_IMPORT_END = "<!-- OMC:IMPORT:END -->";
var CLAUDE_MD_IMPORT_BLOCK = `${CLAUDE_MD_IMPORT_START}
@CLAUDE-omc.md
${CLAUDE_MD_IMPORT_END}
`;

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/installer/historical-agent-ownership.js
var HISTORICAL_AGENT_OWNERSHIP = [
  { filename: "analyst.md", byteLength: 3539, sha256: "7508ad221b63a4195449a1d21fb82f79bc1bb1b18cc27cdbf9687050c738c645", gitBlob: "f5a6e73195c81488e10fdc2b0fdc0a61207e223f", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "analyst.md", byteLength: 4832, sha256: "2971ca1421c128b2ca6f569807860594f79da22ecb6cd1829cb678e8f362d631", gitBlob: "4332a1d2c65ae0f1a22ed6c72f57fa2ee8fe3c21", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.1.10" },
  { filename: "analyst.md", byteLength: 5431, sha256: "986259201ddbe054ad2248fec503ebbcee0a308fea54359715461aee30e007bd", gitBlob: "83bb4622e6ccb10cf1f3d8f7ff04fa352873a3ff", firstReleaseTag: "v4.1.11", lastReleaseTag: "v4.3.3" },
  { filename: "analyst.md", byteLength: 5434, sha256: "3f8d3717635e09f1533bcd55a541cd685eb022187a22ceb97672cff3f14a532f", gitBlob: "3b3e92cb03c1705543bee6d034943c75bceef7fd", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.8.2" },
  { filename: "analyst.md", byteLength: 5443, sha256: "b3a979c108514cf0b6b06dae7885f7fcbfd8f32208c7c4df7ea63becce66ad16", gitBlob: "c97e30968cb2a9dfa1aacc352874a7d42408f5d1", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "analyst.md", byteLength: 5432, sha256: "0df623596ef938c98780432fd851c0a18cab06bfc18a22dff5d54b1a196e2a18", gitBlob: "d4223b10c8466ed95b4eb3afed849fe5d9bccb7a", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "analyst.md", byteLength: 5565, sha256: "d61db30524426a5812432262a57fc8aa04021def3ef60870cdad64b2304a9f90", gitBlob: "a975598d3b0140fb732229e9ddc4189ec8d8cf2f", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.14.6" },
  { filename: "analyst.md", byteLength: 6317, sha256: "b08225a9bd349c84697a63b9e7e4e1016c01dafec5b3337bb95f70fce495ceb1", gitBlob: "fe2f523e108993aaffeb6e8ab8d8bbf268fa0eff", firstReleaseTag: "v4.14.7", lastReleaseTag: "v4.15.7" },
  { filename: "api-reviewer.md", byteLength: 5152, sha256: "fbffc73e2e84f4733b6b7af0445442e4ede9df7e65711c43d8fccf5bd5bde58c", gitBlob: "7350c070a21f09bcdca6a2f9e95389e92d1fa754", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "architect-low.md", byteLength: 2245, sha256: "57f68fe06802314af773fe82ecfeb1f56dc5d96971a260fa2fb79a3c26edb2b3", gitBlob: "1ef95d589bb7e0bc00796b2a9e99aa79f750a12b", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "architect-medium.md", byteLength: 4011, sha256: "eeb4fa3919cb5eee5d90776cc3531f85cb69a43928d500397b7ceea16bb69230", gitBlob: "d7b22e7ea9ac86f84c125d15afdee2595120a2d2", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "architect.md", byteLength: 9972, sha256: "2e27438266dd9b5adc9dda1463032738144b697532dc959a9da4ee35c2fab8f9", gitBlob: "0dfa116d390c638bc3be972e218f6de6df927636", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "architect.md", byteLength: 5445, sha256: "3423c63221d23af7a33aae6cce598f0c59c8ca039b8628c0bd40d972966ac8c0", gitBlob: "1f1593731cc262bbd8a7070987bd6f10d188fb82", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.1.18" },
  { filename: "architect.md", byteLength: 5953, sha256: "83e20105ca868873ceda0e8f2eb26398b8b60770d0d24d51893163dcbaf1e1b1", gitBlob: "cc0227bdb98e825bccbaa32679fc2d88746b1701", firstReleaseTag: "v4.2.0", lastReleaseTag: "v4.3.3" },
  { filename: "architect.md", byteLength: 5955, sha256: "4336126e0f5e83d52fb3146fead98469fe8a0afd32e32c51b98b4c453459fdbc", gitBlob: "30821e5b7c5b5d1369bae6b79f3130b4cd6ed732", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.3.4" },
  { filename: "architect.md", byteLength: 5846, sha256: "3c865d6fbf364b92ec33f3151803a4b7b9dd3a6a1a664fe599de5ef7be6fb570", gitBlob: "377de6ae92d9a03e515d5261e12d06766d258fb2", firstReleaseTag: "v4.4.0", lastReleaseTag: "v4.4.5" },
  { filename: "architect.md", byteLength: 6877, sha256: "fbac3c92794169a9a902c8a86877a77cf1a8ab6e82b4f26fe4159f516d881faa", gitBlob: "08d588daf546a5b8291807b7a1e392a8ffed1a23", firstReleaseTag: "v4.5.0", lastReleaseTag: "v4.8.2" },
  { filename: "architect.md", byteLength: 6886, sha256: "d47c9fce4ec9510121cbcf653e3c73db58d0c5dc9393588ba75dde862d3034d5", gitBlob: "de7f54e7db65096d9f8bdc425b990f9f376e812b", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "architect.md", byteLength: 6875, sha256: "c0a1081e607a333bb8ee3d7b097b7504eb3ad46b2d351dfccb72097cda24cf50", gitBlob: "cba04ad1c23f1a795f5b62b0a15d08d56ad94c33", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "architect.md", byteLength: 7008, sha256: "67c585938f2faa3384f6d88a65ef93932e027ec058b28ca12d9d15068370a44c", gitBlob: "c69fa8bcde0a9be39b37e8a20b5208123e8184cf", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.14.5" },
  { filename: "architect.md", byteLength: 7685, sha256: "054854158e573b95efc0022bf4ebdd1c947d02e4cbf0f820d8a37bb155e104b7", gitBlob: "1eefa8170204fe1a903e80e7f17e70f6fdb74fe9", firstReleaseTag: "v4.14.6", lastReleaseTag: "v4.15.7" },
  { filename: "build-fixer-low.md", byteLength: 1926, sha256: "4607140848cd41b1f1d62eb077202014d2b467dcc15a412353101fdedb1f8c00", gitBlob: "bcfa371c263bf4b1493ca1f856ef907b4bef2bd1", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "build-fixer.md", byteLength: 7244, sha256: "48020fac37ec37370151f7aa36d1eb2a84b73de61b5ab41efb00aac5038a0eba", gitBlob: "e025ee8c7085b261d24f21b2865a6a1350b1c79a", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "build-fixer.md", byteLength: 4544, sha256: "cac4a3306ff35f8d01c7173d436c351267accb95b4cdf92658240d46950de093", gitBlob: "e8e34458a508a8982f4fee6c453d4946d0eb6ffc", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.3" },
  { filename: "build-fixer.md", byteLength: 4555, sha256: "af080383b633f6871618f98b76678a8753aec11b5cb5688197495d17748a0c52", gitBlob: "f2e79fa048558cd1aefdd348c254cad299cb7981", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.7.7" },
  { filename: "code-reviewer-low.md", byteLength: 1903, sha256: "1903808be31c3a6db653cc2e0ab4af6a5838cc91365c950e7504e61686269125", gitBlob: "42b41b4cd615519889d712de9374080a772582eb", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "code-reviewer.md", byteLength: 6049, sha256: "31a8cac2f6245bc83cb23c572c78c5098b79a96e7751aa98a692b4ebc4da30ad", gitBlob: "d27eae057282c062d583244378d4d8a4ba5eab1f", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "code-reviewer.md", byteLength: 5126, sha256: "f50ab36aaf3ba2d0c688bd0890b7a8679aafaddceb5f4fd05e9c8209df501e16", gitBlob: "19e76d2fe57b3d764fb0d1087b856dfdff4326b2", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.1.18" },
  { filename: "code-reviewer.md", byteLength: 5634, sha256: "5391cf0065c167272d90a784b1938434443fb3b3d2b7c4d1b189b1303c445f3c", gitBlob: "f698de23b84b680cc9960fe2a8bc215f90649e18", firstReleaseTag: "v4.2.0", lastReleaseTag: "v4.3.0" },
  { filename: "code-reviewer.md", byteLength: 6138, sha256: "7acc7993d3bfd67cefd76c1b7597624068d147cf16d75a08d80ea78436227972", gitBlob: "64a8907e37ac4775e372beb85428f805beaee722", firstReleaseTag: "v4.3.1", lastReleaseTag: "v4.3.3" },
  { filename: "code-reviewer.md", byteLength: 6149, sha256: "b430cfb8f88d95c5f34195131e24df9b1ea300be7d4e5d7ad65f1040e7889567", gitBlob: "aedeb4cbbabde728281dbfd505085220c142085b", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.3.4" },
  { filename: "code-reviewer.md", byteLength: 6035, sha256: "164b987e66b33aebb625893137357dc864dc00ce378481adc9e575201340e57d", gitBlob: "7b4f5884b1d850b0bc28153e0a9d3ea41b3d606f", firstReleaseTag: "v4.4.0", lastReleaseTag: "v4.7.7" },
  { filename: "code-reviewer.md", byteLength: 11795, sha256: "972728c0e4ce00639cc3b2364a6366bcac21af074e74e069a5cddc49ebb82235", gitBlob: "0f8f30910814d148c6d87536830d9e2278e6db09", firstReleaseTag: "v4.7.8", lastReleaseTag: "v4.7.8" },
  { filename: "code-reviewer.md", byteLength: 12046, sha256: "c38b6d24149e4a1c57129b68be7343f80b237e58da4c4c49c73f9888b1c93ec8", gitBlob: "90ed95fdf18079ca8f58a407cf9ca31fcc9fbc77", firstReleaseTag: "v4.7.9", lastReleaseTag: "v4.8.2" },
  { filename: "code-reviewer.md", byteLength: 12055, sha256: "9a26e24f530c60e310274279087bb159578282fabf19d19bef208b24b844ad6f", gitBlob: "dd7d4fb54b601c3b6c18a83e13e41887b149e560", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "code-reviewer.md", byteLength: 12044, sha256: "42ea7e51311cffe7b7bbf9dda386b1debb2c48f4c03509b8bd02e43cf52c251c", gitBlob: "59ef9f9d6bedd65e363b612bd2729f241ec70c1e", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "code-reviewer.md", byteLength: 12177, sha256: "192c5c219bdf652516d8264caf03e0f72c075aede85b81c974815e6177db2469", gitBlob: "5590f872aad02595999358b4270f73f0aa9e73d8", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.13.5" },
  { filename: "code-reviewer.md", byteLength: 14463, sha256: "3e06d0421a5290340020a1f7904d144a0ea2a6a61ab8d8d41863cf37319d7d74", gitBlob: "f97ab6c31c14fd15da422a2f431c84bd6d51a7c0", firstReleaseTag: "v4.13.6", lastReleaseTag: "v4.14.5" },
  { filename: "code-reviewer.md", byteLength: 15169, sha256: "0194fe714d4dcd61cf049322ae1f737deda5e59356eba4faca51ad38d025e9fc", gitBlob: "1dea64c1089f5e50422304ad565c065c3a6168f8", firstReleaseTag: "v4.14.6", lastReleaseTag: "v4.15.7" },
  { filename: "code-simplifier.md", byteLength: 4403, sha256: "ad0bbcaeb000ac91b24906c160c309880c034d8b38e19cce625f09d4d3bab74f", gitBlob: "01676fe234df9e3d69bbd27af5da6ea40f79c139", firstReleaseTag: "v4.3.0", lastReleaseTag: "v4.3.3" },
  { filename: "code-simplifier.md", byteLength: 4414, sha256: "11952957123feb8d129b41e6cfaaab40ac018a71accdf25da3233c5c738a659d", gitBlob: "3130e378afbad6a1d90221f59f0b1634f7aef685", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.8.2" },
  { filename: "code-simplifier.md", byteLength: 4423, sha256: "5f30bef8a39fe76ac129cd31f5dcce5558c67151c3e76fce4675454c69aa2936", gitBlob: "15f53ab58f8ea5751662afdae6462e038019c5e0", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "code-simplifier.md", byteLength: 4412, sha256: "44a797ce76724e94821e6434cf9d578c6775ddd9eb233a3b4c071e2cb5f7f0cc", gitBlob: "d13c0859f7f2358835d75579a3584aa48fc29856", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.15.7" },
  { filename: "critic.md", byteLength: 6014, sha256: "5cb78048dbedbc37e6c915551596a21a2d4c2007e927be215d9b1260956bcc98", gitBlob: "2b1c94be413b2fc7062a60f8a57655a09d674b35", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "critic.md", byteLength: 5132, sha256: "7b22771fa5cdf27b586fc96e700b370eced37eeb097c5981c1f02a07b19be6c7", gitBlob: "dc1a2992664af1bb578f1a2337dc1a869e8850b5", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.3" },
  { filename: "critic.md", byteLength: 5143, sha256: "573a6e27c82dad59b16e89f47aaeb27e9dfc9155b645ef397980a176398c0ea4", gitBlob: "8632674a1b0c9e5ac8bc0c104f5f68a9c85de3f0", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.4.5" },
  { filename: "critic.md", byteLength: 6568, sha256: "ec453839d45cbc8c0b29e2a4081b9e6df162c0e32d1a77900d12a0bab5772f14", gitBlob: "3c0e2fdbf26f49e9fc861a2c4e078b7f8cc4fce8", firstReleaseTag: "v4.5.0", lastReleaseTag: "v4.7.7" },
  { filename: "critic.md", byteLength: 21440, sha256: "7a2571011570e0f56e5c059fc9ad13dde7808f71b69ab5f5337d03d5037d6dd3", gitBlob: "e3d0fc5dfdc2c0b6f51f3d4671f7e8188e79511a", firstReleaseTag: "v4.7.8", lastReleaseTag: "v4.8.2" },
  { filename: "critic.md", byteLength: 21449, sha256: "e552d8ca193166d1101fdcac7d51aa066de037ddff0987b7478bd4ec8ec665e0", gitBlob: "2db0f437824db9664640f116c0311d81e6965de1", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "critic.md", byteLength: 21438, sha256: "e9a7adc94895f2905735bb437f2b747c9eab258f2f72bd68066d294c70dd80b8", gitBlob: "6c42962e2afeea6437b3f12eeb3f75e463f896e2", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "critic.md", byteLength: 21571, sha256: "a6d716ab88db4a53377c1efa79942d9540aeca6e48a36dfa542b636681729779", gitBlob: "a0004ff231adc80a0c814cc53b73be56df98c8bc", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.14.5" },
  { filename: "critic.md", byteLength: 22285, sha256: "7ac22331649f07805eca351e784629520a831d6a7ff8596628c66e6d4703b072", gitBlob: "e697f33d01c1db27cebebca4b9f1c12a541fa4fe", firstReleaseTag: "v4.14.6", lastReleaseTag: "v4.15.7" },
  { filename: "debugger.md", byteLength: 5476, sha256: "454542081471de9a6abb99db54b640d0e13b9846849e954358cf9716636cc07f", gitBlob: "074a5f313b01d037c3cae3b6d3fb872bd5cb969b", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "debugger.md", byteLength: 5413, sha256: "05355b54d0e75079c0762d9dffe70da10844cefc6df83320dbe2e83ab95f4a73", gitBlob: "4713a8039d9debda27d733bd5c8f3d969f05b597", firstReleaseTag: "v4.3.1", lastReleaseTag: "v4.3.3" },
  { filename: "debugger.md", byteLength: 5424, sha256: "f1a71c40b3287bd33789bc37ea345dde91c2b56e4d3d3b179936d2d96e7752b7", gitBlob: "998a707f221135198e7a2278a8400a11392571e9", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.7.7" },
  { filename: "debugger.md", byteLength: 9057, sha256: "2d66952cd3adf85a10b5d49960bea8d27792ad707e8ea509144661db2443b2f7", gitBlob: "67517332d4bbb2c010c3fc771db7539af7c084e2", firstReleaseTag: "v4.7.8", lastReleaseTag: "v4.8.2" },
  { filename: "debugger.md", byteLength: 9066, sha256: "ea83d73afa5d668fd39d6610ea10ec867e02af9f9df9107a85d4de6b49700a47", gitBlob: "1596a0f18c517f5e1da1e5f1f210e8ad3f5ef6d3", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "debugger.md", byteLength: 9055, sha256: "e39b54b437720fd044cfb4b8c05d260741ba875ac5fa9459ab6aa3d0272bdb05", gitBlob: "d38cf27a5bc83f875313a8ef21276774e3ce4d66", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "debugger.md", byteLength: 9188, sha256: "1eb6caa1ced9dbead61b4a971f8fbc050fb32b5c669ad1291c5723a2ae8afa5f", gitBlob: "f53c46b4753b95145b2e10007d2cf0d2a9247271", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.14.6" },
  { filename: "debugger.md", byteLength: 9897, sha256: "14714f2a4671411e006c604291e0551cc38cc45c18e0665de2f30ef6996047c6", gitBlob: "904b667802399e03e4791858e31a38c23bf0a732", firstReleaseTag: "v4.14.7", lastReleaseTag: "v4.15.7" },
  { filename: "deep-executor.md", byteLength: 11518, sha256: "d69c8d02219bf96fec51313754a52d6c9e24be24a147c97952eb16422a82de06", gitBlob: "d96c3bc82dcb73ad3d75e734971560d3edfa7080", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "deep-executor.md", byteLength: 6069, sha256: "7ab2a7c26f5ed860ac015e5bbd13af8762979d83c995baa86a6a6a34d771d981", gitBlob: "432f6bedea76e968df701741e38010628b29d04f", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.1.18" },
  { filename: "deep-executor.md", byteLength: 6577, sha256: "46b65f7fd3cff8bf6e22d61e37e92c33e98f9c0f9139498cd154bccba58f4f28", gitBlob: "4f828fd1c85400c3d4516b93876488139fc8b9e2", firstReleaseTag: "v4.2.0", lastReleaseTag: "v4.2.7" },
  { filename: "deep-executor.md", byteLength: 6586, sha256: "084f040b7e50f255b695b839f272b8942e14bd907459df5ba42f26f2606cc15c", gitBlob: "3eb1721beb2c258004d134ab62b1f4d44e104090", firstReleaseTag: "v4.2.8", lastReleaseTag: "v4.3.3" },
  { filename: "deep-executor.md", byteLength: 6597, sha256: "60d0bcb3ca1ee03529509f857f969512cfbdc584033bce3a1a87a256f0b66ec7", gitBlob: "56b6607b79b08fd7c9bddf23df5ac24b62e9b541", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.3.4" },
  { filename: "deep-executor.md", byteLength: 6488, sha256: "392b91cb10baacdd876953c0b95f445bd6e3379e5d190b60bcb59ede30f761ca", gitBlob: "39b0dec823c8742179407ed1e4e8356808151e15", firstReleaseTag: "v4.4.0", lastReleaseTag: "v4.7.7" },
  { filename: "dependency-expert.md", byteLength: 5489, sha256: "ecb794b20ca9ce6b4ddd59c3d2f71c85492ea69141a8cb6d0a517b2f9fed2c5a", gitBlob: "4010a44001c73c99131168f124e8c114372251f4", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "designer-high.md", byteLength: 5931, sha256: "eecd781a3e473b249312493089ac4f14acd7ab714c9cd6ce48433641b10ca35c", gitBlob: "e9e76a3eba694efe490c725226c1fc8fa3685e87", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "designer-low.md", byteLength: 3313, sha256: "0225d48fda441738d6814bb46cdd033ec5cf6c1c8c115788e6738c4fa1dae9c0", gitBlob: "d9a64d2d812fd2dfed8a662b562d7e99ab1a079b", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "designer.md", byteLength: 4571, sha256: "037d2d6ca6d672cf93ffa3ab2a392203b3cb00faa13f369a9eafab9e647c6104", gitBlob: "9f85f1c046dceeaec4582d1e3c17fbac6f783106", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "designer.md", byteLength: 5458, sha256: "49f775dada948357b0dd5c6729adba7d8018a20a3229e5d8c1ef7e78488891b4", gitBlob: "fa451c264e1f2a8f5eb8e3685179c372fee445c3", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.1.18" },
  { filename: "designer.md", byteLength: 5960, sha256: "f4a31543b5a89834425778ad4dc18f8ba5017e8b07518918a4f2ea98ed8de2fb", gitBlob: "30dedaef6cff5e1aa19eb44bf6c473ab7cd21e39", firstReleaseTag: "v4.2.0", lastReleaseTag: "v4.3.3" },
  { filename: "designer.md", byteLength: 5971, sha256: "c5ace68ab4cf450e10d3141c54e2843e1a54edac4f9fa149d204e548a63ff100", gitBlob: "57de0b6046e46009c69ded9e092f3865bfebc19f", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.3.4" },
  { filename: "designer.md", byteLength: 5759, sha256: "f49ee8a8f7a462ec3344d74788ffd95f5eca15ddb285c0ce22e7dfed35183256", gitBlob: "c07252185c236232eb64e92a3f3132664d3608aa", firstReleaseTag: "v4.4.0", lastReleaseTag: "v4.8.2" },
  { filename: "designer.md", byteLength: 5768, sha256: "a300143947e297e45bd4b00a3d07b859475ba93691eff0270db414abaa7e26c5", gitBlob: "c0e4dbce6293adbb76c7eb642483616907858809", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "designer.md", byteLength: 5757, sha256: "4bbf0f7298beb56a381cf1a2f4265fda40a1ad3f9e665af31785efe3b6b838e6", gitBlob: "a7813997f46ae4d491fa7245154d861bca7b5f49", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "designer.md", byteLength: 5890, sha256: "de5a1df9885e72997d692c5ad4d4a66cec9da303862fe118a49dbb4cd6558e32", gitBlob: "780377a69c9452ba24c43c35375636b678991692", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.13.5" },
  { filename: "designer.md", byteLength: 9627, sha256: "61e77f70753e09e87d2ef4e549c4459c1572cab3eddd72e2a0a430169bb256c8", gitBlob: "d23f95782f8f207f4aacf18c0f44f78ee03f458b", firstReleaseTag: "v4.13.6", lastReleaseTag: "v4.15.7" },
  { filename: "document-specialist.md", byteLength: 4687, sha256: "06a876282a9b0a3df9f64eab4021643ce72b00d18a65afe66af026754595d45e", gitBlob: "a0abff1b62cfd7414d9af86665c08be25730942d", firstReleaseTag: "v4.2.8", lastReleaseTag: "v4.3.3" },
  { filename: "document-specialist.md", byteLength: 4698, sha256: "2ef90b21eb4c278384859ae149bd8db07dfc3a93f2ce2f49347f37dffdd2c1f0", gitBlob: "a1c7c2fce3326e3e3b6a4b60215a66924f18799f", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.7.6" },
  { filename: "document-specialist.md", byteLength: 5012, sha256: "301664b041188dda651e3c3f15ce9b8468c9f7096e5c3d6ff75c0610cf612ada", gitBlob: "41eae6251f76834ab3ebc32cbacc39c1ecc5804e", firstReleaseTag: "v4.7.7", lastReleaseTag: "v4.7.9" },
  { filename: "document-specialist.md", byteLength: 7183, sha256: "77bb82c1191ede4212acbb498ca98fb3a44049cfd08727583d82c5d1d04a7124", gitBlob: "238bf6afb0a2f4f52f9ec57266a9cd25d9e6ebe1", firstReleaseTag: "v4.7.10", lastReleaseTag: "v4.8.2" },
  { filename: "document-specialist.md", byteLength: 7192, sha256: "4897f3fac88e5be2fa46b9f93c578a864fb31bdc911ca6d7735017ad8eb529ab", gitBlob: "07a8f0c0b54858a7202d7bd84b9fcd62b2c63abc", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "document-specialist.md", byteLength: 7181, sha256: "1b306df45efb601d53e1b527e0f5dfa12594d0ab1e81832946a512a814230da3", gitBlob: "01b785a1cd973458c6441edb8b75751380badd36", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "document-specialist.md", byteLength: 7310, sha256: "d6f01d210e5e74bb8e6f534657fd77eb39ca5feebc2bb451088cbe6b7790fd74", gitBlob: "79215e89a82f5c1902758b6f695fa8089dfb56f5", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.15.7" },
  { filename: "executor-high.md", byteLength: 7350, sha256: "fcf788dd78c638cb36a0eec2742d2659f42d34fa26d567369636f14edfe6fb57", gitBlob: "04b88ed82c8c94af11121f2a97d7e63a3ac7a03b", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "executor-low.md", byteLength: 2503, sha256: "3599a83ee126ddcb89f0ec1db581a0b18cdf4ebe20e6772a61c3a66c0447b238", gitBlob: "5749ed21344c4934ca33e81ad8077a9385a91f0b", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "executor.md", byteLength: 4137, sha256: "7dddf0b285c82fbedfb260b8d6965db0035d803e5ebe6209f43fe2d3e8a21849", gitBlob: "4c665f9a515b18bb786ba7e6053ff4ed00161500", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "executor.md", byteLength: 4859, sha256: "90b54f845257fd373396b1babe4e1a197b107d50bceb93dd4e1062ddb628b011", gitBlob: "19eb61916842d30fb9e710372f6f775f58b3f5aa", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.1.18" },
  { filename: "executor.md", byteLength: 5266, sha256: "3c2ec2c771aa86698c9dfe4f902aa47475446f84b87b191552a6e0d46c3c4ba2", gitBlob: "b8c293d9fd2bed71cc680ee00bedc36ce971efe0", firstReleaseTag: "v4.2.0", lastReleaseTag: "v4.3.3" },
  { filename: "executor.md", byteLength: 5277, sha256: "89a0d768528192bea1791f824116f07d6e8befa3ab17473dc4f30a3a9262c3f8", gitBlob: "e490e54e2a720985aacb9e54aa9c87ffba973416", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.3.4" },
  { filename: "executor.md", byteLength: 5168, sha256: "baa9f75d91e72fd1596ea6e1cf232ed2a6b54427e3b43f5c8bf6ee60544935c2", gitBlob: "61528d077b26fe1530f038ba26a7ebca8cf2defe", firstReleaseTag: "v4.4.0", lastReleaseTag: "v4.7.7" },
  { filename: "executor.md", byteLength: 7432, sha256: "83df010c3ae92adf91fbdcefacd9383d407f30745bb4863ebc995d38d29f9cc5", gitBlob: "f5992eba462f3539bd663e3cce2f3a89208b57ee", firstReleaseTag: "v4.7.8", lastReleaseTag: "v4.8.2" },
  { filename: "executor.md", byteLength: 7441, sha256: "598fbcde9f3a8c2e5a39f9213ad8a0dd6674af848c34f97cf61886d79aa1ea14", gitBlob: "10aa2e0742807093e0cff6fc2bdb14d9e12b9855", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "executor.md", byteLength: 7430, sha256: "f467a68cf7636bb9faceedf4d5f07321ebaecc4d127f94947a436c5091421d5b", gitBlob: "92cb6dd6fdfab3beee911c91c4e7276fbe0efcff", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "executor.md", byteLength: 7563, sha256: "996bfa5ed0b560285c0ca020e75f02a60a4ef97062ecaac7b285699f57711865", gitBlob: "54c79972b7fdf7c6189daf3e2820ab358506bc49", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.15.7" },
  { filename: "explore-high.md", byteLength: 7728, sha256: "984d9fea47c45d54d47ebddb10cf5b8647f7667906c280400eb7ecfcd6c9eee3", gitBlob: "c535510a0e0e541d82d184be4211ae5e971aaf2d", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "explore-medium.md", byteLength: 4072, sha256: "8d60817e76cb7cc78eec5979b3007dcc4325af42e036dd4d539d031d5b1bc862", gitBlob: "fd2da7f453787061e6661b5d060302bd301539dc", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "explore.md", byteLength: 3164, sha256: "cce28c6147f00e841b6582f96c0593302523a51dfa38e1b19e01f5ace91f5d9f", gitBlob: "2aa5e2f04ab0a4b45c60926e85db78279b3bb3a0", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "explore.md", byteLength: 5260, sha256: "dcda623eae48287e7cd3efffdf578d48896afeb74ac27c50911669c1805c65b1", gitBlob: "c3639d424aa168d7a7f60b4fddc16a620078adc8", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.2.3" },
  { filename: "explore.md", byteLength: 6530, sha256: "f3a83dc262731c091e92503311d9e410472059a6a755d94261431d71a779c64a", gitBlob: "4ac0f53985b3095fb4f1cdf4d400df6faa288024", firstReleaseTag: "v4.2.4", lastReleaseTag: "v4.3.3" },
  { filename: "explore.md", byteLength: 6541, sha256: "3a34c91f7050ee8574a16e68f71b706f8b13ec2fadb39ed0ffd3ffffd8762419", gitBlob: "4c69af979c80d1f7155d4520265317beae533312", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.7.6" },
  { filename: "explore.md", byteLength: 6981, sha256: "47a4571bce3b7a18497a7cf8192024c314de9d86740b34ffcb50ee6c0eeb0873", gitBlob: "8a7a941f208db5199470421db7dd9291b776f405", firstReleaseTag: "v4.7.7", lastReleaseTag: "v4.8.2" },
  { filename: "explore.md", byteLength: 7401, sha256: "953af89c36968f6d735dbccc5ba494bb35872498f432e833235111e197a04693", gitBlob: "d527d2ab73674f697226d4b6187f61269a135987", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "explore.md", byteLength: 7390, sha256: "c75bad9c35876f30f273e855a1807cd76e0f362cf97872852370cb4da08d78c6", gitBlob: "86fd24c1c6e6a688fda6d0188499d6a76e588945", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "explore.md", byteLength: 7523, sha256: "a629637a20d2848e459c581057da0d258125e03eb243d8c984e98a0ed6636bcb", gitBlob: "519c61a2340c06d4373e9217c607e695f22652f4", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.15.7" },
  { filename: "git-master.md", byteLength: 3830, sha256: "7c51a5706ce8c828848293e03e6a5de491a9c09e487802c6b534a66bb33c2635", gitBlob: "b8784cfe636ce41b9b66433c9b4de06fbda68ef8", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "git-master.md", byteLength: 4660, sha256: "7238f26e331a35557f011b82f9b5a330130ceb20f0f76149121a52e4f302ae25", gitBlob: "a2a0eff138d781e6d90d84420cace53a9f65a2eb", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.3" },
  { filename: "git-master.md", byteLength: 4671, sha256: "73832c6808664765b73b2dd12d4b44b9fefc250831225cb154c843f50a89d927", gitBlob: "0d7a932695797a60c0eb036e8528f049e8f43f68", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.8.2" },
  { filename: "git-master.md", byteLength: 4680, sha256: "ee6dfffd47afcd06cfeb2756d9eb8ebbb36ac92083f1c04c2e9a2782ae96fbe9", gitBlob: "20830fe3ab69d8b7a2d255518f8bb6db65abd696", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "git-master.md", byteLength: 4669, sha256: "488cbd45d8a9d12597a1645969d6ff9041004e0a30dc08961a7e77aea1f9c1fd", gitBlob: "e1fded0b68999e4be736dda367d7bd7e04cd3365", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.12.0" },
  { filename: "git-master.md", byteLength: 4683, sha256: "097df0c648a60a3336daa89706c83722bce0ee1a7b7e3a367835e831c2433239", gitBlob: "dc0e65378c54fae99ce3358f0e39dafe8ae0f7d5", firstReleaseTag: "v4.12.1", lastReleaseTag: "v4.13.2" },
  { filename: "git-master.md", byteLength: 4816, sha256: "40fbc2b31b1b1e0f957dcc7343e8b3a9e92422927c868db68d46cbb07f4abb58", gitBlob: "313b3eaca08e56097e5334a7432b91373e7ebcde", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.15.7" },
  { filename: "harsh-critic.md", byteLength: 10040, sha256: "38d7365a2b0d4f17beee68a0438a4182d18ef9ca3bc74b8230d8a3d8a39f05d8", gitBlob: "913ed89ade29866f01bd2d90db7ef5cea4090b21", firstReleaseTag: "v4.6.1", lastReleaseTag: "v4.6.7" },
  { filename: "harsh-critic.md", byteLength: 16942, sha256: "1808d4fb454525036a51f1834bfa3f93259fe34c9ea9b25d9532c792d619067a", gitBlob: "2bf16a6d9f42cf91e16ff16fe1f3f717d9313689", firstReleaseTag: "v4.7.0", lastReleaseTag: "v4.7.1" },
  { filename: "harsh-critic.md", byteLength: 18824, sha256: "cc143eb707eca4993cbc63668dae3cacd62c80c11b09bdb928e5e70d6efa11d2", gitBlob: "4df066efe9701e279a3e70e5d273e0977d6e9448", firstReleaseTag: "v4.7.2", lastReleaseTag: "v4.7.7" },
  { filename: "information-architect.md", byteLength: 11899, sha256: "d538a4905e0cbfff57eae73061981dda3b1a03b2faf1ffd7b717fc4162b66b1b", gitBlob: "a66a9ca9fa8810c04b56fccfdd5c424536abbd83", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "performance-reviewer.md", byteLength: 5376, sha256: "c47749dbebd12958e2eefa1ac0eafb3e81dc3a8ce35e95fdbd936497ad46bdb9", gitBlob: "e27e0cd510c6059709ae4050b06ea0d359936b43", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "planner.md", byteLength: 12966, sha256: "ea8a64a6b168464c0090d91c9382f77c6f5bc177475de5513f52a3a0328ea87c", gitBlob: "6de233df1e19cfb51392fd6a2cad0e299e763d79", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "planner.md", byteLength: 5841, sha256: "fc2d772232f38ac01d34e06a60aea535819c7e620fbf01d7d9e251a3be35ea38", gitBlob: "87d6907d5be67e06e60e83e1598c877f8fe609f4", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.1.10" },
  { filename: "planner.md", byteLength: 6632, sha256: "53d040e23441cd5e29b635c2f42bfd3530151979fd233c69003d97ee2a03108a", gitBlob: "7c207a11df34015cb24e20b7a0099082c5c3fc0b", firstReleaseTag: "v4.1.11", lastReleaseTag: "v4.2.7" },
  { filename: "planner.md", byteLength: 6641, sha256: "aeb4e933ee7171643741eed2b19dd81eac14999cf2d6d0389a51cc71ce16764c", gitBlob: "5303ee52844f007fe0c361802ef7e9a97a0722c8", firstReleaseTag: "v4.2.8", lastReleaseTag: "v4.3.3" },
  { filename: "planner.md", byteLength: 6623, sha256: "128e90605aecb8f50847a2ff08d367d9e59008fb1770c127e36d6d109ced85f3", gitBlob: "3ff2465faed5761e95a3341ee7eebc0414a43376", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.4.5" },
  { filename: "planner.md", byteLength: 8487, sha256: "e92ad321aa66b146aa8116476b2d3060f41d016bc1ba81ebd59b072a9bc2f8d5", gitBlob: "12af6aec319522ddb12acb890ce68bb0a5afd1f3", firstReleaseTag: "v4.5.0", lastReleaseTag: "v4.8.2" },
  { filename: "planner.md", byteLength: 8496, sha256: "e9a47fc7cbdf15398f87d959ab47223f8c5429e44d55c59beb490675728ff21c", gitBlob: "fdf97cf5a29f16f1692edc2cd29020e5ce1e14bb", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "planner.md", byteLength: 8485, sha256: "ac766a3ea38b84e1931cce2374d25c680830a3e36d4ca5fe84d3f57ff818aa71", gitBlob: "c9ed9f57b488f051cda40036c69bcc0f6b2437a3", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "planner.md", byteLength: 8618, sha256: "20186e7bb9cc8298838cf2bd7caf187c79d9b9cb8ed941a9600b9c98454a09e5", gitBlob: "d6850ceab6fb5aa1ef8edeafc5b83682d7d02fb5", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.15.7" },
  { filename: "product-analyst.md", byteLength: 13212, sha256: "9645acd18b8a645095a80e0bc92a4c4f5000904468426703de6bd204569fc19b", gitBlob: "aa294db8a01f8c06ab8db4da99e62c4066dfb9b5", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "product-manager.md", byteLength: 9900, sha256: "f2bc3809e4e2009bb148ab4f9ae73d1034b1b76a346bcf76c16e1aa89e22d40c", gitBlob: "b88efcd2919eb4bbd4e828218d7ffa4a1ee6bad7", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "qa-tester-high.md", byteLength: 3481, sha256: "b6b9049fcb95a826dd18a341b8405febb7ce3bb41da0ce7601f2a1634196f92f", gitBlob: "e416eba7d64749e405c819d19cb419b12e683a8f", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "qa-tester.md", byteLength: 5781, sha256: "c00813d028fadc820a97b619efc5bb78d7721222608a3c50417c894aba4e64aa", gitBlob: "acd730c56088daf9251e517d42248b64f5e09f40", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "qa-tester.md", byteLength: 5073, sha256: "de9b01c276b5aaf169e889e4316d80b3c9dc856dd22ae9d19cddab75dc4d3e57", gitBlob: "6a7364fc775e4bb4f701f7149b41969ce264a4ad", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.3" },
  { filename: "qa-tester.md", byteLength: 5084, sha256: "f4dca79c8269aef8a95bc2a62598b24afb0e749ef44f80bb8a90c85cb017771e", gitBlob: "6423da37f6237d94ab540a329f8156f56c9614a1", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.8.2" },
  { filename: "qa-tester.md", byteLength: 5093, sha256: "b6cfa0dcc7d37bc3962381afbe853801bed5ec25ed8898ccb1b6368de3b096bc", gitBlob: "c43c3613ed33310fa5e27a636dbf5916c11ea8e7", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "qa-tester.md", byteLength: 5082, sha256: "2f808a58afc484440aff1d683341d71249f075e5b4ab6f3ec562ff83f3bb666d", gitBlob: "8a3e01707a6ec63e0675c55dee0ff6004aec7ec8", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "qa-tester.md", byteLength: 5215, sha256: "f34416b12bfc9c4071ee034c4e481733334b05e8e42d604cd84d579c557832ce", gitBlob: "968677a0daa644e5d4bfe33d5afba472872d76ea", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.15.7" },
  { filename: "quality-reviewer.md", byteLength: 5388, sha256: "18ecad81bd3e2af46e03981d6d12e98ff744ba61b7a0c0552676a41b1502f49a", gitBlob: "5e0a47a068a091a87c420c13bd57843d47b419a9", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.1.18" },
  { filename: "quality-reviewer.md", byteLength: 5896, sha256: "78eacd535f0b4eacd019cc615e2ca05f190c9386ff4878c6e2a72bfa7d09a78f", gitBlob: "908bbcd1f72ddee38b4ea45c140f9f384282e2d2", firstReleaseTag: "v4.2.0", lastReleaseTag: "v4.3.0" },
  { filename: "quality-reviewer.md", byteLength: 8630, sha256: "d90ef5cfc12bc412400ccbf18003ef2ea11497d6e59e5a05db8832ed09cfdf7a", gitBlob: "f92202e5b42e3350611ce39015094f85b33f9ead", firstReleaseTag: "v4.3.1", lastReleaseTag: "v4.3.3" },
  { filename: "quality-reviewer.md", byteLength: 8641, sha256: "8b949dbf776499ed2f61f8b9d9202caf74712857de04c12d5d6563ca0def6184", gitBlob: "4afa7cd79db5346e7ca9059fd4482e52a9d9bdc5", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.3.4" },
  { filename: "quality-reviewer.md", byteLength: 8535, sha256: "98f44f332f9fe951c9aac52fd34ad4e1183cf0e4fcce05c3d7493ca5919b9c14", gitBlob: "99812ffe67e72692aa1a6b72404945c7bd20ac53", firstReleaseTag: "v4.4.0", lastReleaseTag: "v4.7.7" },
  { filename: "quality-strategist.md", byteLength: 9211, sha256: "b67c4aadb5d669f88100a70f2755435b09cb405ed732c666db4df34d1e5e3dc8", gitBlob: "d07c77d41adc4b1e992182af66f1f69c3aeb86f7", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "researcher-low.md", byteLength: 2313, sha256: "42c6d5edc118b73c0d2f63cd9108be4c93be9f85fd3b4b3808e8fd2dd1076cb2", gitBlob: "ec9e58182d6b2fdcb33069685053d60d4dda3e91", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "researcher.md", byteLength: 1803, sha256: "9d2e37cd75f0b2c116f864d55366e53b0abcff04013fd14e4a26a1de903cde83", gitBlob: "475266b6548c09681194e783910028e909be4052", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "researcher.md", byteLength: 4681, sha256: "44df8878c71b3c46d3d29850cb127202cda699743b7854b31b90052661e8a976", gitBlob: "d5a398a06dabbdf7342d29748ec38ffc5291aee4", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.2.7" },
  { filename: "scientist-high.md", byteLength: 37441, sha256: "45bd55bf11f9b70b78672c0ae1b690af1a3f37c16de7420410c72c947219f09b", gitBlob: "982a6098c392ae68a00fec4a31315dfd73b0a6ff", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "scientist-low.md", byteLength: 6193, sha256: "36439720677aca15a6c5346113cef85150624ae2b561ce87f7ecc6a62f624c61", gitBlob: "9cd8c858106750676f9c599564d89bbf3bb09f94", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "scientist.md", byteLength: 36550, sha256: "a83691961b62ffb7ff05c37e0401bb186a0c65ac65a4e9cea5d2d726333c9050", gitBlob: "43cb1ad8ffd9b846c674ea9ddb238f96fbdfe11b", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "scientist.md", byteLength: 5357, sha256: "e9cf952be76a644f9dd693ab089fa39dbfc19b8d199a90603517ae7d645dd7a3", gitBlob: "f680515b2b83e73357d17b80f6294434cf30d904", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.2.7" },
  { filename: "scientist.md", byteLength: 5366, sha256: "17c8454bc6967a4bdd9feb66dd63736710cf6e54b08678b36248e6546c9bc946", gitBlob: "c837fdb858d3f4fa97000df8132a4aa33137f934", firstReleaseTag: "v4.2.8", lastReleaseTag: "v4.3.3" },
  { filename: "scientist.md", byteLength: 5377, sha256: "0eec3f270c1a8df330f00f01ce34c3c4b46a4f976ea0e5ec5913ede19602e514", gitBlob: "28580fc2da873437978eb358179a92bd6b21c04f", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.8.2" },
  { filename: "scientist.md", byteLength: 5386, sha256: "90a217575d1ec6750c1ad42d1b3cde89b79f9caf170c1c0104aedcbb58596ab5", gitBlob: "289f4a10ae0d0442ee60c118e308c9ffcf1f98bd", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "scientist.md", byteLength: 5375, sha256: "f99bf14660866bce2fe8ef9fcb33be630aa398ebfd6e332684fcd97552a678dd", gitBlob: "a420695a6309d1dd82f880991b30f541066451de", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "scientist.md", byteLength: 5508, sha256: "cbe304e00b334c4c6035325542e522f66f8671b631dbc5fff4db9383bbefcd23", gitBlob: "7414274edb22b6f0242d08e02a539658ebd15958", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.15.7" },
  { filename: "security-reviewer-low.md", byteLength: 2201, sha256: "d57c41f1e1320b3a83397780595e9a060069edfed6ff69774335d5b7ebf4e2f9", gitBlob: "c6600d08ba24ad6d034f0fc6dd12b91548189401", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "security-reviewer.md", byteLength: 6667, sha256: "57d92316f8610e52ef6793adc3c77296927f649bc1610429f35d0d236e26b3e5", gitBlob: "f3d4306ec7b7b5ad69c621d473c1ee4ad61008d6", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "security-reviewer.md", byteLength: 6147, sha256: "1156268997a8b5373995f36c853d3dd24c475a1b8444d21504ab59cc4d5ce849", gitBlob: "52242a753fc0daaa0bfda16e39dc4354be09aad5", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.1.18" },
  { filename: "security-reviewer.md", byteLength: 6655, sha256: "8218fc08e6dc9a514362323efcf869e84144bd8053e2923fd4c7970415dcde5a", gitBlob: "319e731457736aa8569f6339d172eded7a734978", firstReleaseTag: "v4.2.0", lastReleaseTag: "v4.3.0" },
  { filename: "security-reviewer.md", byteLength: 6602, sha256: "020b1e3450654ea4005e572fa66a2e91a7b6db1c64875bead93aefd7e2404980", gitBlob: "3128cf48d5301c48d5f37180c9391fca50fb06f0", firstReleaseTag: "v4.3.1", lastReleaseTag: "v4.3.3" },
  { filename: "security-reviewer.md", byteLength: 6613, sha256: "845741d632d40bbcfad56edbbb56eb8305bc3f7bb63e82eca70e28764ae6f053", gitBlob: "4e0b456cdcd4350544c5f9820ffd1b893194504a", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.3.4" },
  { filename: "security-reviewer.md", byteLength: 6503, sha256: "8769911a585ea2966c4fac875e2d536bc41ad8d023e429c0c910862c7deabc7f", gitBlob: "d4c1e42a75bf2d3957a5857cc051f4346a07d04b", firstReleaseTag: "v4.4.0", lastReleaseTag: "v4.7.7" },
  { filename: "security-reviewer.md", byteLength: 9014, sha256: "f3aeaed2e0195c91f7f4890118b7ae4f294c6933f3ed49cdb93f428165d35162", gitBlob: "92a7cf7c3a632cf93cd19f9105c6a6f628902cf0", firstReleaseTag: "v4.7.8", lastReleaseTag: "v4.8.2" },
  { filename: "security-reviewer.md", byteLength: 9023, sha256: "07d3980188922142f36d8e84c60ec3db0445a18548ea2bc70f609f4ceecfbfcb", gitBlob: "0f370a68b94e54ac186e7a8a645c8e91352b41d8", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "security-reviewer.md", byteLength: 9012, sha256: "11aeb0a4184206ca25a8fc1bd19824191d0062f1bca3c5f9f11bb157fd83b9b5", gitBlob: "76deaf6c2e087ea96a9e193a26f878af41dd19d0", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "security-reviewer.md", byteLength: 9145, sha256: "78e9fbd98057fd3ed113171957038df8096cc1cbe7d0870452ced2f3200e2200", gitBlob: "750501c59a9f129bc2be19ff102ddbd1567db628", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.14.5" },
  { filename: "security-reviewer.md", byteLength: 9818, sha256: "ede4e0af76067168dc3aecacffc73f330a950bf79ec187471950cb2d985de8e9", gitBlob: "c36f17c1cb74950e24f2f161458ff3d4cd58950b", firstReleaseTag: "v4.14.6", lastReleaseTag: "v4.15.7" },
  { filename: "style-reviewer.md", byteLength: 4430, sha256: "084bade0aadd36ddb0b220038ad599047bc187f698025d250a8ed3f3b8db7785", gitBlob: "6d301d91d448475e36ef8f7d13f217dea62a5e2d", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "tdd-guide-low.md", byteLength: 1922, sha256: "43b2d38c219bf5992c2cb79521e38d2da117b25466a0ac46b54dbf9de72b84ad", gitBlob: "a68d747f0dccdd677b4155e4e6da6ec9ae797344", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "tdd-guide.md", byteLength: 8236, sha256: "bbb6c65fa5375f6c6da6127c25a2340603d7b8df06ea3c874eaab24162f66154", gitBlob: "47c297e8968abfd0f83b303bc6ebabe9e28e1f7e", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "test-engineer.md", byteLength: 5147, sha256: "251c3cbf0dc27e518df950c0a6861905de1a4a537b5ae0b601ecad91f5e40fa9", gitBlob: "3ad8da1576ba79770b0af7ef49961479fbace2ea", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.1.18" },
  { filename: "test-engineer.md", byteLength: 5655, sha256: "804f615d83e6601af11473b0544392f5c35261aa916c1b8b1a1ddf216ed5948d", gitBlob: "b7bcf786691890c8e4d90bfa6ae554bb8795b048", firstReleaseTag: "v4.2.0", lastReleaseTag: "v4.3.0" },
  { filename: "test-engineer.md", byteLength: 5606, sha256: "1a38e356ad44133b9895ed4787e4b9a8c3a2b13c6e7cfbbb147b5237604b44a2", gitBlob: "d11a4743878e8bd8e64d8b8cb519c53baa252907", firstReleaseTag: "v4.3.1", lastReleaseTag: "v4.3.3" },
  { filename: "test-engineer.md", byteLength: 5617, sha256: "2c3d5793b7b5c7958e9953b97f07cef48e4c3ec524a4219adc1565f55b403f2e", gitBlob: "bc12d1d675c47f8d9b3d2db5a45a73b53cb7c423", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.3.4" },
  { filename: "test-engineer.md", byteLength: 5507, sha256: "4bb0f20f5f0e60ea92d5f7a8b46fe3f6c1dd8513362117813cf983559966c5a5", gitBlob: "5183e5b7b2e3f1318250915ef08d0639262fa727", firstReleaseTag: "v4.4.0", lastReleaseTag: "v4.7.7" },
  { filename: "test-engineer.md", byteLength: 6493, sha256: "1e0021206f87f59027f54180633eff7a5795d84d34b86146c8436d0b7512838b", gitBlob: "cd698af6aca64e6118e16b5225770096e26064ee", firstReleaseTag: "v4.7.8", lastReleaseTag: "v4.8.2" },
  { filename: "test-engineer.md", byteLength: 6502, sha256: "07c9cf50f6ceee2deddbe5e7f7908a95795a9e6991746d8e101fed333481a959", gitBlob: "9f7c1e60ff0520143f46755a8208fb1b9404e673", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "test-engineer.md", byteLength: 6491, sha256: "a107d60370ca5fb59e624d4341a2ad7d7d4b9b0f062d04ecec1f8f9618b3aa9b", gitBlob: "964f7227101d3adac264759aba7d454c7a663daa", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "test-engineer.md", byteLength: 6624, sha256: "6edcaf059b9cccc7eaa1ddde385bd23467d3e0ec798d0de153a3b6f03e5de939", gitBlob: "0ad8b2ecd975365fdc36d252677a14ee24309b64", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.15.7" },
  { filename: "tracer.md", byteLength: 11153, sha256: "85f84acf02f3a5bf7215c458235eeed3cea21fcb6cbbed15d411d8efbc7f2455", gitBlob: "44758846869323a1a1fea13778b372e6d1b4d52c", firstReleaseTag: "v4.8.0", lastReleaseTag: "v4.8.2" },
  { filename: "tracer.md", byteLength: 11162, sha256: "0388ac6d0d82d55c5e12ac42f9029fdc3e187dcac356f7797a2df4ba9f2dc9ee", gitBlob: "942b7400ab7143075696a1447604fc1cd558c0ae", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "tracer.md", byteLength: 11151, sha256: "43b87391b40d13670bd71bc9f145566c26471051c8a212a87077d51a2ea2acae", gitBlob: "62fd5922f832145a3cf9fc6521752d5fdff68900", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "tracer.md", byteLength: 11284, sha256: "17f21f7a43395bbb4b245122d9a3d0c5449d58d3054422858336f01318b7e816", gitBlob: "bbd69e0b76d16c2ce288e5416a6a4e5140264d34", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.14.6" },
  { filename: "tracer.md", byteLength: 12013, sha256: "948875149f833317423510482ac7c5f7b7fad845422986e87fdcd30c440232d7", gitBlob: "aea63f909d0a5ac8115a9e7e094e2aa7da9737bd", firstReleaseTag: "v4.14.7", lastReleaseTag: "v4.15.7" },
  { filename: "ux-researcher.md", byteLength: 12113, sha256: "0c8b96124a6ce8fd875e0781c178bd64a715f58e1dced2551317d4b849e61a6f", gitBlob: "10088f785f700118af6176ac8c214c097612d494", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "verifier.md", byteLength: 5225, sha256: "69295a5c3ee2088002328a4a677e179f62746796bea8168672b01873be4fa263", gitBlob: "b3187f6e30bddbaea78670cb68affff310758d5d", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "verifier.md", byteLength: 5180, sha256: "0609a092d3a338c0be559446f077635396e1f41d544b13b7bb03498b42debd1d", gitBlob: "08139669a0ad17ed7da3b25808d2617dc5a9b5ae", firstReleaseTag: "v4.3.1", lastReleaseTag: "v4.3.3" },
  { filename: "verifier.md", byteLength: 5191, sha256: "579b12a672c38b816cbe5926cefc3f2736f80439769f956f13a143bbf5670d03", gitBlob: "d44edaef38596e6aa5e0a08372374dc6b370f296", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.7.8" },
  { filename: "verifier.md", byteLength: 5430, sha256: "ceb8bf2c88ae4a2fcafc1660a239e9b5315ac52f2b04731b2230b2b76625c9ad", gitBlob: "af736ffbddffa6b319251375cc1a93b2cf2ccf84", firstReleaseTag: "v4.7.9", lastReleaseTag: "v4.8.2" },
  { filename: "verifier.md", byteLength: 5806, sha256: "cb365987c06a8941eef8cb99272d18db6df3a683e53aa5a511f86eb7c0e7e1d9", gitBlob: "cfa1c15aa2c256978ceef355f9d44ad80ef6bd90", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "verifier.md", byteLength: 5795, sha256: "b3989f4c2d1b6b6b2cc2817013005a3ba9fe2688b1c8040638b4b218022a19ab", gitBlob: "a54f08966962417020acbe54619e3c05d2b0f96e", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "verifier.md", byteLength: 5928, sha256: "aaff548cc93e96f411137495935733dbd768bc894b306fb01d78478da690dc8e", gitBlob: "a3ceb374176471f646a2479f3aae9d02fd8ccd75", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.14.6" },
  { filename: "verifier.md", byteLength: 6643, sha256: "8560d3a986199809497866a4fedbf9417cecca7cb670d0ba4aad70a7891e9a25", gitBlob: "aef6c20563c783639f5024426cb46c62badcbdd0", firstReleaseTag: "v4.14.7", lastReleaseTag: "v4.15.7" },
  { filename: "vision.md", byteLength: 1448, sha256: "6b749e4cd185a5b46678e253d714b5b3891f0b5be08aa9badfa565d284f550c0", gitBlob: "ebc0880d5e049b2632f89de00ed9669eb730c747", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "vision.md", byteLength: 3895, sha256: "6a71b35f94c2ba0b167546d76f6476123e94f2693e3fb118c00ccad26218df6e", gitBlob: "fab1612e86f8836b101ce83c7346dd195d23344f", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.0" },
  { filename: "writer.md", byteLength: 6914, sha256: "03f93c34c28637c58fb8c64f0af1291bed75f1eddc8d58817b7d94a95d0b52ec", gitBlob: "5b70b5412907175f28c8d6899a62eb3f1b6ac72e", firstReleaseTag: "v4.0.0", lastReleaseTag: "v4.0.10" },
  { filename: "writer.md", byteLength: 3984, sha256: "8c0ff3173cab8d3ab1a8f6fef1fbb509655711b82a0f163d85f38546caf9936f", gitBlob: "5884e9d95146d567abd30cea17a89ffd256467aa", firstReleaseTag: "v4.1.0", lastReleaseTag: "v4.3.3" },
  { filename: "writer.md", byteLength: 3995, sha256: "8fe1491421050c13285858dfb42c0e214d7ecebaaaa7bf62232609a144085bb3", gitBlob: "83370a7b17678f88f08c2214140be6add5370192", firstReleaseTag: "v4.3.4", lastReleaseTag: "v4.7.8" },
  { filename: "writer.md", byteLength: 4255, sha256: "855596d8c3c5f95ce39a905c94d48163c896c502a8af9af272508218c85bced3", gitBlob: "3aea07bfea9958f4672ad5aa90fead3f9681c8f1", firstReleaseTag: "v4.7.9", lastReleaseTag: "v4.8.2" },
  { filename: "writer.md", byteLength: 4264, sha256: "93f935811a29c8368dc8f5aa168622bd9a5bf7e4ad692ff16b9b996044f76bef", gitBlob: "84276bb10e2777d4fed43b395680eb00d4dd10da", firstReleaseTag: "v4.9.0", lastReleaseTag: "v4.11.6" },
  { filename: "writer.md", byteLength: 4253, sha256: "92c3e76dc8de5c25f01fe8ec72a787212195699bb2fc416edb1f4b5e6ca2a95c", gitBlob: "8deebfea03dc2098e7109565c5836b428c314c33", firstReleaseTag: "v4.12.0", lastReleaseTag: "v4.13.2" },
  { filename: "writer.md", byteLength: 4386, sha256: "ccbf8dc3957f1c633c95c5b99a0e74237ed1a393c562474cc3443c62abbc47c0", gitBlob: "f50c4ca484cc51d903a1079b0476a895f1400cac", firstReleaseTag: "v4.13.3", lastReleaseTag: "v4.15.7" }
];

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/config/builtin-skill-entitlements.json
var builtin_skill_entitlements_default = {
  schemaVersion: 1,
  skininthegamebrosOnlySkills: []
};

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/installer/index.js
var CLAUDE_CONFIG_DIR = getClaudeConfigDir();
var AGENTS_DIR = join17(CLAUDE_CONFIG_DIR, "agents");
var COMMANDS_DIR = join17(CLAUDE_CONFIG_DIR, "commands");
var SKILLS_DIR = join17(CLAUDE_CONFIG_DIR, "skills");
var HOOKS_DIR = join17(CLAUDE_CONFIG_DIR, "hooks");
var HUD_DIR = join17(CLAUDE_CONFIG_DIR, "hud");
var SETTINGS_FILE = join17(CLAUDE_CONFIG_DIR, "settings.json");
var VERSION_FILE = join17(CLAUDE_CONFIG_DIR, ".omc-version.json");
var VERSION = getRuntimePackageVersion();
var SKININTHEGAMEBROS_ONLY_SKILLS = new Set(builtin_skill_entitlements_default.skininthegamebrosOnlySkills.map((skill) => skill.trim().toLowerCase()));
function isSafeAgentFilename(filename) {
  return /^[a-z0-9-]+\.md$/.test(filename);
}
function isValidHistoricalAgent(record) {
  if (!record || typeof record !== "object")
    return false;
  const candidate = record;
  return typeof candidate.filename === "string" && isSafeAgentFilename(candidate.filename) && Number.isSafeInteger(candidate.byteLength) && candidate.byteLength > 0 && typeof candidate.sha256 === "string" && /^[a-f0-9]{64}$/.test(candidate.sha256) && typeof candidate.gitBlob === "string" && /^[a-f0-9]{40}$/.test(candidate.gitBlob) && typeof candidate.firstReleaseTag === "string" && /^v4\.\d+\.\d+$/.test(candidate.firstReleaseTag) && typeof candidate.lastReleaseTag === "string" && /^v4\.\d+\.\d+$/.test(candidate.lastReleaseTag);
}
var HISTORICAL_AGENT_HASHES_BY_FILENAME = /* @__PURE__ */ new Map();
for (const record of HISTORICAL_AGENT_OWNERSHIP) {
  if (!isValidHistoricalAgent(record))
    continue;
  const hashes = HISTORICAL_AGENT_HASHES_BY_FILENAME.get(record.filename) ?? /* @__PURE__ */ new Set();
  hashes.add(`${record.byteLength}:${record.sha256}`);
  HISTORICAL_AGENT_HASHES_BY_FILENAME.set(record.filename, hashes);
}

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/features/auto-update.js
var REPO_OWNER = "Yeachan-Heo";
var REPO_NAME = "oh-my-claudecode";
var GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
var GITHUB_RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}`;
var CLAUDE_CONFIG_DIR2 = getClaudeConfigDir();
var VERSION_FILE2 = join18(CLAUDE_CONFIG_DIR2, ".omc-version.json");
var CONFIG_FILE = join18(CLAUDE_CONFIG_DIR2, OMC_CONFIG_FILE_REL);
function compareVersions(a, b) {
  const cleanA = a.replace(/^v/, "");
  const cleanB = b.replace(/^v/, "");
  const partsA = cleanA.split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = cleanB.split(".").map((n) => parseInt(n, 10) || 0);
  const maxLength = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLength; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB)
      return -1;
    if (numA > numB)
      return 1;
  }
  return 0;
}
var SILENT_UPDATE_STATE_FILE = join18(CLAUDE_CONFIG_DIR2, ".omc-silent-update.json");

// ../../.claude/plugins/cache/omc/oh-my-claudecode/5.0.0/dist/hud/index.js
import { writeFileSync as writeFileSync5, mkdirSync as mkdirSync8, existsSync as existsSync15, readFileSync as readFileSync13 } from "fs";
import { access, readFile } from "fs/promises";
import { join as join19, basename as basename10, dirname as dirname13 } from "path";
import { spawn as spawn2 } from "child_process";
import { fileURLToPath as fileURLToPath3 } from "url";
function extractSessionIdFromPath(transcriptPath) {
  if (!transcriptPath)
    return null;
  const match = transcriptPath.match(/([0-9a-f-]{36})(?:\.jsonl)?$/i);
  return match ? match[1] : null;
}
function mergeStdinRateLimits(stdinRateLimits, usageResult) {
  if (!stdinRateLimits) {
    return usageResult;
  }
  return {
    ...usageResult ?? {},
    rateLimits: {
      ...usageResult?.rateLimits ?? {},
      ...stdinRateLimits
    }
  };
}
function readSessionSummary(stateDir, sessionId) {
  const statePath = join19(stateDir, `session-summary-${sessionId}.json`);
  if (!existsSync15(statePath))
    return null;
  try {
    return JSON.parse(readFileSync13(statePath, "utf-8"));
  } catch {
    return null;
  }
}
var lastSummarySpawnTimestamp = 0;
var summaryProcessPid = null;
function _resetSummarySpawnTimestamp() {
  lastSummarySpawnTimestamp = 0;
  summaryProcessPid = null;
}
function _getSummaryProcessPid() {
  return summaryProcessPid;
}
function spawnSessionSummaryScript(transcriptPath, stateDir, sessionId) {
  if (summaryProcessPid !== null) {
    try {
      process.kill(summaryProcessPid, 0);
      return;
    } catch {
      summaryProcessPid = null;
    }
  }
  const now = Date.now();
  if (now - lastSummarySpawnTimestamp < 12e4) {
    return;
  }
  lastSummarySpawnTimestamp = now;
  const thisDir = dirname13(fileURLToPath3(import.meta.url));
  const scriptPath = join19(thisDir, "..", "..", "scripts", "session-summary.mjs");
  if (!existsSync15(scriptPath)) {
    if (process.env.OMC_DEBUG) {
      console.error("[HUD] session-summary script not found:", scriptPath);
    }
    return;
  }
  try {
    const child = spawn2("node", [scriptPath, transcriptPath, stateDir, sessionId], {
      stdio: "ignore",
      detached: true,
      env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "session-summary" }
    });
    summaryProcessPid = child.pid ?? null;
    child.unref();
  } catch (error) {
    summaryProcessPid = null;
    if (process.env.OMC_DEBUG) {
      console.error("[HUD] Failed to spawn session-summary:", error instanceof Error ? error.message : error);
    }
  }
}
async function calculateSessionHealth(sessionStart, contextPercent) {
  const durationMs = sessionStart ? Date.now() - sessionStart.getTime() : 0;
  const durationMinutes = Math.floor(durationMs / 6e4);
  let health = "healthy";
  if (durationMinutes > 120 || contextPercent > 85)
    health = "critical";
  else if (durationMinutes > 60 || contextPercent > 70)
    health = "warning";
  return { durationMinutes, messageCount: 0, health };
}
function showDiagnostic() {
  const version = getRuntimePackageVersion();
  const configDir = getClaudeConfigDir();
  const hudScript = join19(configDir, "hud", "omj-hud.mjs");
  const settingsFile = join19(configDir, "settings.json");
  const hudExists = existsSync15(hudScript);
  let statusLineOk = false;
  try {
    const settings = JSON.parse(readFileSync13(settingsFile, "utf-8"));
    const sl = settings.statusLine;
    if (sl && typeof sl === "object" && typeof sl.command === "string") {
      statusLineOk = sl.command.includes("omj-hud");
    } else if (typeof sl === "string") {
      statusLineOk = sl.includes("omj-hud");
    }
  } catch {
  }
  const config = readHudConfig();
  const preset = config.preset ?? "focused";
  console.log(`[OMJ] HUD v${version} | preset: ${preset}`);
  console.log(`  HUD script:  ${hudExists ? "installed" : "MISSING"}`);
  console.log(`  statusLine:  ${statusLineOk ? "configured" : "NOT configured"}`);
  if (!hudExists || !statusLineOk) {
    console.log("  Run /oh-my-joy:setup to fix.");
  } else {
    console.log("  HUD renders automatically inside Claude Code sessions.");
  }
}
async function main(watchMode = false, skipInit = false) {
  try {
    const previousStdinCache = readStdinCache();
    let stdin = await readStdin();
    if (stdin) {
      stdin = stabilizeContextPercent(stdin, previousStdinCache);
      writeStdinCache(stdin);
    } else if (watchMode) {
      stdin = previousStdinCache;
      if (!stdin) {
        console.log("[OMJ] Starting...");
        return;
      }
    } else {
      showDiagnostic();
      return;
    }
    const cwd = resolveToWorktreeRoot(stdin.cwd || void 0);
    const config = { ...readHudConfig() };
    if (config.maxWidth === void 0) {
      const cols = process.stderr.columns || process.stdout.columns || parseInt(process.env.COLUMNS ?? "0", 10) || 0;
      if (cols > 0) {
        config.maxWidth = cols;
        if (config.wrapMode === "truncate")
          config.wrapMode = "wrap";
      }
    }
    const resolvedTranscriptPath = resolveTranscriptPath(stdin.transcript_path, cwd);
    const transcriptData = await parseTranscript(resolvedTranscriptPath, {
      staleTaskThresholdMinutes: config.staleTaskThresholdMinutes
    });
    const currentSessionId = extractSessionIdFromPath(resolvedTranscriptPath ?? stdin.transcript_path ?? "");
    if (!skipInit) {
      await initializeHUDState(cwd, currentSessionId ?? void 0);
    }
    const ralph = readRalphStateForHud(cwd, currentSessionId ?? void 0);
    const ultrawork = readUltraworkStateForHud(cwd, currentSessionId ?? void 0);
    const prd = readPrdStateForHud(cwd);
    const autopilot = readAutopilotStateForHud(cwd, currentSessionId ?? void 0);
    const hudState = readHudState(cwd, currentSessionId ?? void 0);
    const _backgroundTasks = hudState?.backgroundTasks || [];
    let sessionStart = transcriptData.sessionStart;
    const sameSession = hudState?.sessionId === currentSessionId;
    if (sameSession && hudState?.sessionStartTimestamp) {
      const persisted = new Date(hudState.sessionStartTimestamp);
      if (!isNaN(persisted.getTime())) {
        sessionStart = persisted;
      }
    } else if (sessionStart) {
      const stateToWrite = hudState || {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        backgroundTasks: []
      };
      stateToWrite.sessionStartTimestamp = sessionStart.toISOString();
      stateToWrite.sessionId = currentSessionId ?? void 0;
      stateToWrite.timestamp = (/* @__PURE__ */ new Date()).toISOString();
      writeHudState(stateToWrite, cwd, currentSessionId ?? void 0);
    }
    const stdinRateLimits = getRateLimitsFromStdin(stdin);
    const usageResult = config.elements.rateLimits === false ? null : await getUsage();
    const rateLimitsResult = config.elements.rateLimits === false ? null : mergeStdinRateLimits(stdinRateLimits, usageResult);
    const customBuckets = config.rateLimitsProvider?.type === "custom" ? await executeCustomProvider(config.rateLimitsProvider) : null;
    let omcVersion = null;
    let updateAvailable = null;
    try {
      omcVersion = getRuntimePackageVersion();
      if (omcVersion === "unknown")
        omcVersion = null;
    } catch (error) {
      if (process.env.OMC_DEBUG) {
        console.error("[HUD] Version detection error:", error instanceof Error ? error.message : error);
      }
    }
    try {
      const updateCacheFile = getUpdateCheckCachePath();
      await access(updateCacheFile);
      const content = await readFile(updateCacheFile, "utf-8");
      const cached = JSON.parse(content);
      if (cached?.latestVersion && omcVersion && compareVersions(omcVersion, cached.latestVersion) < 0) {
        updateAvailable = cached.latestVersion;
      }
    } catch (error) {
      if (process.env.OMC_DEBUG) {
        console.error("[HUD] Update cache read error:", error instanceof Error ? error.message : error);
      }
    }
    let sessionSummary = null;
    const sessionSummaryEnabled = config.elements.sessionSummary ?? false;
    if (sessionSummaryEnabled && resolvedTranscriptPath && currentSessionId) {
      const omcStateDir = join19(getOmcRoot(cwd), "state");
      sessionSummary = readSessionSummary(omcStateDir, currentSessionId);
      const shouldSpawn = !sessionSummary?.generatedAt || Date.now() - new Date(sessionSummary.generatedAt).getTime() > 6e4;
      if (shouldSpawn) {
        spawnSessionSummaryScript(resolvedTranscriptPath, omcStateDir, currentSessionId);
      }
    }
    const missionBoardEnabled = config.missionBoard?.enabled ?? config.elements.missionBoard ?? false;
    const missionBoard = missionBoardEnabled ? await refreshMissionBoardState(cwd, config.missionBoard) : null;
    const contextPercent = getContextPercent(stdin);
    const payloadEstimate = estimatePayloadFromTranscriptPath(resolvedTranscriptPath);
    const subscriptionInfo = (() => {
      try {
        return getSubscriptionInfo() ?? { subscriptionType: null, rateLimitTier: null };
      } catch {
        return { subscriptionType: null, rateLimitTier: null };
      }
    })();
    const context = {
      contextPercent,
      contextDisplayScope: currentSessionId ?? cwd,
      modelName: getModelName(stdin),
      modelId: getModelId(stdin),
      ralph,
      ultrawork,
      prd,
      autopilot,
      activeAgents: transcriptData.agents.filter((a) => a.status === "running"),
      todos: transcriptData.todos,
      backgroundTasks: getRunningTasks(hudState),
      cwd,
      missionBoard,
      lastSkill: transcriptData.lastActivatedSkill || null,
      rateLimitsResult,
      customBuckets,
      pendingPermission: transcriptData.pendingPermission || null,
      thinkingState: transcriptData.thinkingState || null,
      sessionHealth: await calculateSessionHealth(sessionStart, contextPercent),
      lastRequestTokenUsage: transcriptData.lastRequestTokenUsage || null,
      sessionTotalTokens: transcriptData.sessionTotalTokens ?? null,
      omcVersion,
      updateAvailable,
      toolCallCount: transcriptData.toolCallCount,
      agentCallCount: transcriptData.agentCallCount,
      skillCallCount: transcriptData.skillCallCount,
      promptTime: hudState?.lastPromptTimestamp ? new Date(hudState.lastPromptTimestamp) : null,
      apiKeySource: config.elements.apiKeySource ? detectApiKeySource(cwd) : null,
      apiKeyMode: detectApiKeySource(cwd) !== null,
      subscriptionType: subscriptionInfo.subscriptionType,
      rateLimitTier: subscriptionInfo.rateLimitTier,
      profileName: process.env.CLAUDE_CONFIG_DIR ? basename10(process.env.CLAUDE_CONFIG_DIR).replace(/^\./, "") : null,
      sessionSummary,
      lastToolName: transcriptData.lastToolName,
      payloadEstimate
    };
    if (process.env.OMC_DEBUG) {
      console.error("[HUD DEBUG] stdin.context_window:", JSON.stringify(stdin.context_window));
      console.error("[HUD DEBUG] sessionHealth:", JSON.stringify(context.sessionHealth));
    }
    if (config.contextLimitWarning.autoCompact && context.contextPercent >= config.contextLimitWarning.threshold) {
      try {
        const omcStateDir = join19(getOmcRoot(cwd), "state");
        mkdirSync8(omcStateDir, { recursive: true });
        const triggerFile = join19(omcStateDir, "compact-requested.json");
        writeFileSync5(triggerFile, JSON.stringify({
          requestedAt: (/* @__PURE__ */ new Date()).toISOString(),
          contextPercent: context.contextPercent,
          threshold: config.contextLimitWarning.threshold
        }));
      } catch (error) {
        if (process.env.OMC_DEBUG) {
          console.error("[HUD] Auto-compact trigger write error:", error instanceof Error ? error.message : error);
        }
      }
    }
    let output = await render(context, config);
    const useSafeMode = config.elements.safeMode !== false && (config.elements.safeMode || process.platform === "win32");
    if (useSafeMode) {
      output = sanitizeOutput(output);
      console.log(output);
    } else {
      const formattedOutput = output.replace(/ /g, "\xA0");
      console.log(formattedOutput);
    }
  } catch (error) {
    const isInstallError = error instanceof Error && (error.message.includes("ENOENT") || error.message.includes("MODULE_NOT_FOUND") || error.message.includes("Cannot find module"));
    if (isInstallError) {
      console.log("[OMJ] HUD install broken - re-run /oh-my-joy:setup");
    } else {
      console.log("[OMJ] HUD error - check stderr");
      console.error("[OMJ HUD Error]", error instanceof Error ? error.message : error);
    }
  }
}
main();
export {
  _getSummaryProcessPid,
  _resetSummarySpawnTimestamp,
  main
};
