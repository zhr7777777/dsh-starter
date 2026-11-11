#!/usr/bin/env node
/**
 * Assemble the desktop runtime payload that the Electron shell launches.
 *
 *   node scripts/build-runtime.mjs            # plugins + profile template only (dev)
 *   node scripts/build-runtime.mjs --with-node  # + a self-contained official node_modules
 *
 * Output: apps/desktop/runtime/
 *   profile/                    profile template, copied into DSH_HOME on first run
 *     package.json              bundle list (dsh.profile.bundles)
 *     cordis.yml                empty entry list; the tree is composed from patches
 *     cordis.patch.yml          the user-editable patch layer
 *     node_modules/<plugin>/    our built plugins, plain directories
 *   node_modules/               only with --with-node: `pnpm deploy` of @deepseek-ai/dsh
 *
 * Why copy the plugins in as plain directories instead of registering a tarball
 * through `dsh plugin add`: the packaged app must start without pnpm, without a
 * registry and without network. The official loader resolves a profile bundle
 * from the profile's own node_modules first, so a plain copy is enough — the
 * package is self-describing (exports + dsh.client + cordis.patch.yml).
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pluginsRoot = join(root, 'packages/plugins')
const runtimeDir = join(root, 'apps/desktop/runtime')
const profileDir = join(runtimeDir, 'profile')
const withNode = process.argv.includes('--with-node')

const PROFILES = ['starter']

/** Plugin packages that ship both faces or only the Host face. */
function pluginDirectories() {
  if (!existsSync(pluginsRoot)) return []
  return readdirSync(pluginsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(pluginsRoot, entry.name))
    .filter(directory => existsSync(join(directory, 'package.json')))
    .sort()
}

const CORDIS_YML = `# dsh profile root — an empty entry list. The tree is composed as patches:
# each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any
# --patch overlays. Edit cordis.patch.yml, not this file.
[]
`

const CORDIS_PATCH_YML = `# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).
[]
`

// 1) build every plugin so the copies below are current
execFileSync(process.execPath, [join(root, 'scripts/build-plugin.mjs')], { cwd: root, stdio: 'inherit' })

// 2) profile template
console.log(`\nAssembling ${profileDir.slice(root.length + 1)}`)
rmSync(profileDir, { recursive: true, force: true })
mkdirSync(join(profileDir, 'node_modules'), { recursive: true })

const plugins = pluginDirectories().map(directory => ({
  directory,
  manifest: JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')),
}))

// Official bundles first, then ours in name order. Order among our plugins does
// not decide correctness: cross-plugin cooperation happens at event time (see
// expert-team checking the `main` slot before jumping), not at activation.
const bundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', ...plugins.map(p => p.manifest.name)]

writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
  name: `dsh-profile-${PROFILES[0]}`,
  private: true,
  type: 'module',
  // Intentionally empty: the packages below are plain directories inside this
  // profile, so no package manager has to run to resolve them.
  dependencies: {},
  dsh: { profile: { bundles } },
}, null, 2) + '\n')
writeFileSync(join(profileDir, 'cordis.yml'), CORDIS_YML)
writeFileSync(join(profileDir, 'cordis.patch.yml'), CORDIS_PATCH_YML)

for (const { directory, manifest } of plugins) {
  const target = join(profileDir, 'node_modules', manifest.name)
  if (manifest.dsh?.bundle?.patch !== undefined && !manifest.exports?.['.']) {
    throw new Error(`${manifest.name}: a bundle needs a Host entry (exports["."])`)
  }
  mkdirSync(target, { recursive: true })
  cpSync(join(directory, 'package.json'), join(target, 'package.json'))
  cpSync(join(directory, 'cordis.patch.yml'), join(target, 'cordis.patch.yml'))
  cpSync(join(directory, 'dist'), join(target, 'dist'), { recursive: true })
  console.log(`  + ${manifest.name}${manifest.dsh?.client ? ' (host+client)' : ' (host only)'}`)
}

// 3) optional self-contained official runtime
//
// `pnpm deploy <dir>` writes <dir>/node_modules. It deploys into runtime/host
// rather than runtime/ because electron-builder's extraResources filter drops a
// root-level `node_modules` in any copied tree (app-builder-lib/out/util/filter.js:
// `if (relative === "node_modules") return false`). One extra directory level
// keeps the layout intact without an afterPack hook.
const hostDir = join(runtimeDir, 'host')
const runtimeNodeModules = join(hostDir, 'node_modules')
if (withNode) {
  console.log('\nDeploying the official runtime (@deepseek-ai/dsh + its bundles)')
  rmSync(hostDir, { recursive: true, force: true })
  // --legacy: this workspace does not inject workspace packages; the deploy
  // target only depends on the published official package.
  execFileSync('corepack', ['pnpm', '--filter', 'dsh-desktop-runtime', 'deploy', '--prod', '--legacy', hostDir], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, npm_config_registry: process.env.npm_config_registry ?? 'https://registry.npmmirror.com' },
  })
  console.log(`  deployed: ${hostDir.slice(root.length + 1)}`)
} else if (existsSync(runtimeNodeModules)) {
  console.log('\nKeeping the previously deployed official runtime (omit --with-node to rebuild it)')
} else {
  console.log('\nNo official runtime deployed: dev mode resolves it from the project node_modules')
}

console.log(`\nruntime ready: ${runtimeDir.slice(root.length + 1)}`)
