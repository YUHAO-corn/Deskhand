/**
 * Deskhand Electron dev script
 * Starts Vite dev server + builds main/preload + launches Electron
 */

import { spawn, type Subprocess } from "bun";
import { existsSync, rmSync, mkdirSync, statSync } from "fs";
import { join } from "path";
import * as esbuild from "esbuild";

const ROOT_DIR = join(import.meta.dir, "..");
const ELECTRON_DIR = join(ROOT_DIR, "apps/electron");
const DIST_DIR = join(ELECTRON_DIR, "dist");

const IS_WINDOWS = process.platform === "win32";
const BIN_EXT = IS_WINDOWS ? ".exe" : "";
const VITE_BIN = join(ROOT_DIR, `node_modules/.bin/vite${BIN_EXT}`);
const ELECTRON_BIN = join(ROOT_DIR, `node_modules/.bin/electron${BIN_EXT}`);

// Load .env file
function loadEnvFile(): void {
  const { readFileSync } = require("fs");
  const envPath = join(ROOT_DIR, ".env");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          let value = trimmed.slice(eqIndex + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      }
    }
    console.log("📄 Loaded .env file");
  }
}

// Kill process on port
async function killProcessOnPort(port: string): Promise<void> {
  try {
    if (IS_WINDOWS) {
      const netstat = spawn({
        cmd: ["cmd", "/c", `netstat -ano | findstr :${port}`],
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = await new Response(netstat.stdout).text();
      await netstat.exited;

      const pids = new Set<string>();
      for (const line of output.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid) && pid !== "0") {
            pids.add(pid);
          }
        }
      }

      for (const pid of pids) {
        const kill = spawn({
          cmd: ["taskkill", "/PID", pid, "/F"],
          stdout: "pipe",
          stderr: "pipe",
        });
        await kill.exited;
      }
    } else {
      const lsof = spawn({
        cmd: ["sh", "-c", `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`],
        stdout: "pipe",
        stderr: "pipe",
      });
      await lsof.exited;
    }
  } catch {
    // Port may not be in use
  }
}

// Build using esbuild
async function runEsbuild(entryPoint: string, outfile: string): Promise<{ success: boolean; error?: string }> {
  try {
    await esbuild.build({
      entryPoints: [join(ROOT_DIR, entryPoint)],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: join(ROOT_DIR, outfile),
      external: ["electron"],
      packages: "external",
      logLevel: "warning",
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Wait for file to stabilize
async function waitForFileStable(filePath: string, timeoutMs = 5000): Promise<boolean> {
  const startTime = Date.now();
  let lastSize = -1;
  let stableCount = 0;

  while (Date.now() - startTime < timeoutMs) {
    if (!existsSync(filePath)) {
      await Bun.sleep(100);
      continue;
    }

    const stats = statSync(filePath);
    if (stats.size === lastSize) {
      stableCount++;
      if (stableCount >= 3) return true;
    } else {
      stableCount = 0;
      lastSize = stats.size;
    }

    await Bun.sleep(100);
  }

  return false;
}

async function main(): Promise<void> {
  console.log("🚀 Starting Deskhand dev environment...\n");

  loadEnvFile();

  // Ensure dist directory exists
  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  const vitePort = "5173";
  await killProcessOnPort(vitePort);

  // Build main and preload
  console.log("🔨 Building main process...");

  const mainCjsPath = join(DIST_DIR, "main.cjs");
  const preloadCjsPath = join(DIST_DIR, "preload.cjs");

  if (existsSync(mainCjsPath)) rmSync(mainCjsPath);
  if (existsSync(preloadCjsPath)) rmSync(preloadCjsPath);

  const [mainResult, preloadResult] = await Promise.all([
    runEsbuild("apps/electron/src/main/index.ts", "apps/electron/dist/main.cjs"),
    runEsbuild("apps/electron/src/preload/index.ts", "apps/electron/dist/preload.cjs"),
  ]);

  if (!mainResult.success) {
    console.error("❌ Main process build failed:", mainResult.error);
    process.exit(1);
  }

  if (!preloadResult.success) {
    console.error("❌ Preload build failed:", preloadResult.error);
    process.exit(1);
  }

  await Promise.all([
    waitForFileStable(mainCjsPath),
    waitForFileStable(preloadCjsPath),
  ]);

  console.log("✅ Initial build complete\n");

  // Start dev servers
  console.log("📡 Starting dev servers...\n");

  const processes: Subprocess[] = [];
  const esbuildContexts: esbuild.BuildContext[] = [];

  // 1. Vite dev server
  const viteProc = spawn({
    cmd: [VITE_BIN, "dev", "--config", "apps/electron/vite.config.ts", "--port", vitePort, "--strictPort"],
    cwd: ROOT_DIR,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    env: process.env as Record<string, string>,
  });
  processes.push(viteProc);

  // 2. Main process watcher
  const mainContext = await esbuild.context({
    entryPoints: [join(ROOT_DIR, "apps/electron/src/main/index.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: join(ROOT_DIR, "apps/electron/dist/main.cjs"),
    external: ["electron"],
    packages: "external",
    logLevel: "info",
  });
  await mainContext.watch();
  esbuildContexts.push(mainContext);
  console.log("👀 Watching main process...");

  // 3. Preload watcher
  const preloadContext = await esbuild.context({
    entryPoints: [join(ROOT_DIR, "apps/electron/src/preload/index.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: join(ROOT_DIR, "apps/electron/dist/preload.cjs"),
    external: ["electron"],
    packages: "external",
    logLevel: "info",
  });
  await preloadContext.watch();
  esbuildContexts.push(preloadContext);
  console.log("👀 Watching preload...");

  // Wait a bit for Vite to start
  await Bun.sleep(2000);

  // 4. Start Electron
  console.log("🚀 Starting Electron...\n");

  const electronProc = spawn({
    cmd: [ELECTRON_BIN, "apps/electron"],
    cwd: ROOT_DIR,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env as Record<string, string>,
      VITE_DEV_SERVER_URL: `http://localhost:${vitePort}`,
    },
  });
  processes.push(electronProc);

  // Cleanup on exit
  const cleanup = async () => {
    console.log("\n🛑 Shutting down...");
    for (const ctx of esbuildContexts) {
      try { await ctx.dispose(); } catch {}
    }
    for (const proc of processes) {
      try { proc.kill(); } catch {}
    }
    process.exit(0);
  };

  process.on("SIGINT", () => cleanup());
  process.on("SIGTERM", () => cleanup());

  await electronProc.exited;
  await cleanup();
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
