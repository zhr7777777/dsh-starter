#!/usr/bin/env node
/**
 * Headless acceptance for the desktop payload — the same check the Electron
 * window relies on, without opening a window:
 *
 *   1. seed a throwaway DSH_HOME from apps/desktop/runtime/profile
 *   2. spawn the CLI exactly like the shell does (no pnpm, no registry)
 *   3. wait for `dsh web: …?token=…`
 *   4. exchange the token for a cookie and read the boot manifest
 *   5. assert every client plugin is listed and the Host-only plugin applied
 *
 * Run it after `pnpm desktop:runtime` (dev anchor) or after `--with-node`
 * (packaged anchor: adds `--runtime`). Exits non-zero on any failure so it can
 * gate a release.
 */
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeDir = join(root, 'apps/desktop/runtime')
const profileTemplate = join(runtimeDir, 'profile')
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 240_000)
const useDeployedRuntime = process.argv.includes('--runtime')

const cli = useDeployedRuntime
  ? join(runtimeDir, 'host/node_modules/@deepseek-ai/dsh/lib/bin.js')
  : join(root, 'node_modules/@deepseek-ai/dsh/lib/bin.js')

/** Every plugin with a browser face, read from the assembled profile. */
const profileManifest = join(profileTemplate, 'package.json')
if (!existsSync(profileManifest)) {
  console.error('desktop-smoke: no runtime payload; run `pnpm desktop:runtime` first')
  process.exit(1)
}
if (!existsSync(cli)) {
  console.error(useDeployedRuntime
    ? `desktop-smoke: no deployed runtime at ${cli}; run \`pnpm desktop:pack\` first`
    : `desktop-smoke: missing ${cli}; run \`pnpm install\` first`)
  process.exit(1)
}

const bundles = JSON.parse(readFileSync(profileManifest, 'utf8')).dsh?.profile?.bundles ?? []
const clientModules = bundles
  .map(name => join(profileTemplate, 'node_modules', name, 'package.json'))
  .filter(path => existsSync(path))
  .map(path => JSON.parse(readFileSync(path, 'utf8')))
  .filter(manifest => manifest.dsh?.client)
  .map(manifest => `${manifest.name}/client.js`)
  .sort()

if (!clientModules.length) {
  console.error('desktop-smoke: the profile template ships no client module')
  process.exit(1)
}

// A fresh home proves the first-run path: nothing is inherited from .dsh-home.
const home = mkdtempSync(join(tmpdir(), 'dsh-desktop-smoke-'))
mkdirSync(join(home, 'profiles'), { recursive: true })
cpSync(profileTemplate, join(home, 'profiles/starter'), { recursive: true })

const host = spawn(process.execPath, [
  cli, '--profile', 'starter', '--host', '127.0.0.1', '--port', '0', '--no-open',
], {
  cwd: home,
  env: { ...process.env, DSH_HOME: home, DSH_AGENTS_HOME: join(home, 'agents') },
  stdio: ['ignore', 'pipe', 'pipe'],
})

const hostMarker = '[dsh-host-only-plugin] applied'
let buffer = ''
let done = false
const finish = (code, message) => {
  if (done) return
  done = true
  clearTimeout(timer)
  host.kill('SIGTERM')
  rmSync(home, { recursive: true, force: true })
  if (message) console[code === 0 ? 'log' : 'error'](message)
  process.exitCode = code
}

const timer = setTimeout(() => finish(1, `desktop-smoke: timed out after ${timeoutMs}ms\n${buffer.split('\n').slice(-15).join('\n')}`), timeoutMs)
process.on('SIGINT', () => finish(130))
process.on('SIGTERM', () => finish(143))

host.stdout.on('data', async chunk => {
  buffer += chunk.toString()
  if (done) return
  const match = buffer.match(/dsh web: (http:\/\/\S+)/)
  if (!match) return
  try {
    const entry = new URL(match[1])
    const redirect = await fetch(entry, { redirect: 'manual' })
    const cookie = ((redirect.headers.getSetCookie?.() ?? [])[0] ?? '').split(';')[0]
    if (!cookie) throw new Error(`no session cookie from ${entry.pathname} (status ${redirect.status})`)

    const page = await fetch(new URL('/', entry), { headers: { cookie } })
    if (!page.ok) throw new Error(`index returned ${page.status}`)
    const html = await page.text()
    const missing = clientModules.filter(id => !html.includes(id))
    if (missing.length) throw new Error(`boot manifest is missing ${missing.join(', ')}`)
    if (!buffer.includes(hostMarker)) throw new Error(`host-only plugin did not apply: missing "${hostMarker}"`)

    finish(0, `desktop-smoke: ok — ${entry.origin} booted from a clean home (${useDeployedRuntime ? 'deployed' : 'project'} runtime), ${clientModules.length} client module(s) listed, host-only plugin applied`)
  } catch (error) {
    finish(1, `desktop-smoke: ${error instanceof Error ? error.message : String(error)}`)
  }
})

host.stderr.on('data', chunk => { buffer += chunk.toString() })
host.on('exit', code => {
  if (done) return
  finish(1, `desktop-smoke: the Host exited early with ${code}\n${buffer.split('\n').slice(-20).join('\n')}`)
})
