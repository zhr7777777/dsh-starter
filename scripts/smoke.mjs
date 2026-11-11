#!/usr/bin/env node
/**
 * Headless acceptance check:
 *   start `pnpm dev` on an OS-assigned port, wait for the printed token URL,
 *   fetch the page with the session cookie, and assert the official boot
 *   manifest really contains this plugin's client module.
 *
 * Exits non-zero on timeout or a missing module, so it can gate CI.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pluginsRoot = join(root, 'packages/plugins')
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 240_000)

// Every plugin that declares a browser face must reach the official boot
// manifest; a Host-only plugin has no module to find.
const clientModules = readdirSync(pluginsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => join(pluginsRoot, entry.name, 'package.json'))
  .filter(path => existsSync(path))
  .map(path => JSON.parse(readFileSync(path, 'utf8')))
  .filter(manifest => manifest.dsh?.client)
  .map(manifest => `${manifest.name}/client.js`)
  .sort()

if (!clientModules.length) {
  console.error('smoke: no plugin declares dsh.client')
  process.exit(1)
}

const dev = spawn(process.execPath, [join(root, 'scripts/dev.mjs')], {
  cwd: root,
  env: { ...process.env, PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

const hostMarker = '[dsh-host-only-plugin] applied'
let buffer = ''
const waitFor = async (predicate, ms) => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return predicate()
}
const finish = (code, message) => {
  clearTimeout(timer)
  dev.kill('SIGTERM')
  if (message) console[code === 0 ? 'log' : 'error'](message)
  process.exitCode = code
}

const timer = setTimeout(() => finish(1, `smoke: timed out after ${timeoutMs}ms`), timeoutMs)
process.on('SIGINT', () => finish(130))
process.on('SIGTERM', () => finish(143))

const onData = async (chunk) => {
  buffer += chunk.toString()
  const match = buffer.match(/dsh web: (http:\/\/\S+)/)
  if (!match || onData.done) return
  onData.done = true

  try {
    const entry = new URL(match[1])
    // The token URL answers 303 with a session cookie; keep the cookie by hand.
    const redirect = await fetch(entry, { redirect: 'manual' })
    const cookies = redirect.headers.getSetCookie?.() ?? []
    const cookie = (cookies[0] ?? redirect.headers.get('set-cookie') ?? '').split(';')[0]
    if (!cookie) throw new Error(`no session cookie from ${entry.pathname} (status ${redirect.status})`)

    const page = await fetch(new URL('/', entry), { headers: { cookie } })
    if (!page.ok) throw new Error(`page returned ${page.status}`)
    const html = await page.text()
    const missing = clientModules.filter(id => !html.includes(id))
    if (missing.length) {
      throw new Error(`boot manifest is missing ${missing.join(', ')} (official client modules: ${/plugins\/\?\?([^"]*)/.exec(html)?.[1]?.slice(0, 120) ?? 'none'})`)
    }
    if (!await waitFor(() => buffer.includes(hostMarker), 5_000)) {
      throw new Error(`host-only plugin did not apply: missing "${hostMarker}" in Host output`)
    }
    finish(0, `smoke: ok — ${entry.origin} served ${clientModules.length} client module(s), and the host-only plugin applied`)
  } catch (error) {
    finish(1, `smoke: ${error instanceof Error ? error.message : String(error)}`)
  }
}

dev.stdout.on('data', onData)
dev.stderr.on('data', chunk => { buffer += chunk.toString() })
dev.on('exit', (code) => {
  if (onData.done) return
  clearTimeout(timer)
  console.error(buffer.split('\n').slice(-25).join('\n'))
  console.error(`smoke: dev exited early with ${code}`)
  process.exitCode = 1
})
