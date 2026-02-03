import * as esbuild from 'esbuild'
import { spawn, type ChildProcess } from 'child_process'
import { join } from 'path'
import { config } from 'dotenv'

// Load .env file
config({ path: join(import.meta.dir, '../.env') })

const electronDir = join(import.meta.dir, '../apps/electron')
let electronProcess: ChildProcess | null = null

async function buildMain() {
  await esbuild.build({
    entryPoints: [join(electronDir, 'src/main/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: join(electronDir, 'dist/main.cjs'),
    external: ['electron'],
    format: 'cjs',
    sourcemap: true,
  })
  console.log('✓ Main process built')
}

async function buildPreload() {
  await esbuild.build({
    entryPoints: [join(electronDir, 'src/preload/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: join(electronDir, 'dist/preload.cjs'),
    external: ['electron'],
    format: 'cjs',
    sourcemap: true,
  })
  console.log('✓ Preload script built')
}

function startElectron() {
  if (electronProcess) {
    electronProcess.kill()
  }
  electronProcess = spawn('electron', [electronDir], {
    stdio: 'inherit',
    env: { ...process.env },
  })
  electronProcess.on('close', () => {
    process.exit(0)
  })
}

function startVite() {
  const vite = spawn('bunx', ['vite', '--config', join(electronDir, 'vite.config.ts')], {
    stdio: 'inherit',
    cwd: electronDir,
  })
  vite.on('error', (err) => {
    console.error('Vite error:', err)
  })
}

async function dev() {
  console.log('Building main process and preload...')
  await Promise.all([buildMain(), buildPreload()])

  console.log('Starting Vite dev server...')
  startVite()

  // Wait for Vite to start
  await new Promise(resolve => setTimeout(resolve, 2000))

  console.log('Starting Electron...')
  startElectron()
}

dev().catch(console.error)
