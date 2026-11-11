#!/usr/bin/env node
/**
 * Local development loop:
 *   1. build every plugin under packages/plugins/*
 *   2. scaffold the Profile from the official Web default (first run only)
 *   3. pack changed plugins to content-addressed archives and register them
 *   4. start the official dsh Web server against that Profile
 *
 * Everything lives under ./.dsh-home so the project stays self-contained.
 */
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(root, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
const pluginsRoot = join(root, 'packages/plugins')
const home = resolve(process.env.DSH_HOME ?? join(root, '.dsh-home'))
const profileName = process.env.DSH_PROFILE ?? 'starter'
const profileDir = join(home, 'profiles', profileName)
const artifacts = join(root, '.artifacts')
const port = process.env.PORT ?? '18990'
const host = process.env.HOST ?? '127.0.0.1'

if (!existsSync(cli)) {
  console.error(`Missing ${cli}\nRun: pnpm install`)
  process.exit(1)
}
if (!existsSync(pluginsRoot)) {
  console.error(`Missing ${pluginsRoot}`)
  process.exit(1)
}

const env = { ...process.env, DSH_HOME: home, DSH_AGENTS_HOME: process.env.DSH_AGENTS_HOME ?? join(home, 'agents') }

// The Profile is its own pnpm project. Inherit this project's registry choice
// (mirror, proxy, private registry) through the environment so scaffold,
// `plugin add` and any later resolution agree on one registry.
const npmrcPath = join(root, '.npmrc')
const configuredRegistry = existsSync(npmrcPath)
  ? /(?:^|\n)\s*registry\s*=\s*(\S+)/.exec(readFileSync(npmrcPath, 'utf8'))?.[1]
  : undefined
const registry = process.env.npm_config_registry ?? configuredRegistry
if (registry) env.npm_config_registry = registry

const node = process.execPath
const run = (args) => execFileSync(node, [cli, ...args], { cwd: root, env, stdio: 'inherit', timeout: 1_800_000 })

function pluginDirectories() {
  return readdirSync(pluginsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(pluginsRoot, entry.name))
    .filter(directory => existsSync(join(directory, 'package.json')))
    .sort()
}

// 1) build
execFileSync(node, [join(root, 'scripts/build-plugin.mjs')], { cwd: root, stdio: 'inherit' })

// 2) profile scaffold: official base + official Web shell, untouched
if (!existsSync(join(profileDir, 'package.json'))) {
  console.log(`Scaffolding Profile "${profileName}" from the official Web default…`)
  run(['--profile', profileName, '--from-default-profile', 'web', '--dump-config'])
}

// 3) pack each plugin; address archives by content so a rebuilt plugin is
//    never served from a stale package-manager cache entry.
mkdirSync(artifacts, { recursive: true })
const pnpmEntry = process.env.npm_execpath
const pnpm = pnpmEntry && /pnpm/.test(pnpmEntry)
  ? { command: node, args: [pnpmEntry] }
  : { command: 'corepack', args: ['pnpm'] }

const layout = pluginDirectories().map(directory => {
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  execFileSync(pnpm.command, [...pnpm.args, 'pack', '--pack-destination', artifacts], {
    cwd: directory,
    stdio: 'pipe',
  })
  const packed = join(artifacts, `${manifest.name}-${manifest.version}.tgz`)
  const digest = createHash('sha256').update(readFileSync(packed)).digest('hex')
  const archiveDir = join(artifacts, digest.slice(0, 16))
  mkdirSync(archiveDir, { recursive: true })
  const archive = join(archiveDir, `${manifest.name}-${manifest.version}.tgz`)
  copyFileSync(packed, archive)
  rmSync(packed, { force: true })
  return { manifest, archive }
})

const profileManifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
const pending = layout.filter(({ manifest, archive }) => profileManifest.dependencies?.[manifest.name] !== `file:${archive}`)

for (const { manifest, archive } of pending) {
  console.log(`registering ${manifest.name} (${archive.slice(artifacts.length + 1)})`)
  // A changed content-addressed path must not be satisfied by the previously
  // extracted copy: pnpm can keep the old directory when name+version match.
  rmSync(join(profileDir, 'node_modules', manifest.name), { recursive: true, force: true })
}

if (pending.length) {
  // -w: a scaffolded Profile is a single-package pnpm workspace, so pnpm needs
  // the explicit workspace-root flag. `dsh plugin` forwards arguments verbatim.
  run(['plugin', '--profile', profileName, 'add', '-w', ...pending.map(({ archive }) => archive)])
} else {
  console.log(`all ${layout.length} plugin(s) already registered with the current build`)
}

// 4) serve
console.log(`Starting dsh web on http://${host}:${port} (DSH_HOME=${home})`)
const child = spawn(
  node,
  [cli, '--profile', profileName, '--host', host, '--port', port, '--no-open'],
  { cwd: root, env, stdio: 'inherit' },
)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})
