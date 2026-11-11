#!/usr/bin/env node
/**
 * Build DSH plugin packages found under packages/plugins.
 *
 *   node scripts/build-plugin.mjs                     # every plugin
 *   node scripts/build-plugin.mjs packages/plugins/starter
 *
 * Each plugin produces:
 *   1. dist/index.js         Host entry   (ESM, Node, official packages external)
 *   2. dist/client.browser.js Client entry (CJS wrapped for __ModuleLoader__)
 *   3. dist/*.d.ts           declarations
 */
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pluginsRoot = join(root, 'packages/plugins')

/** Every directory under packages/plugins that has a package.json. */
function pluginDirectories() {
  if (!existsSync(pluginsRoot)) return []
  return readdirSync(pluginsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(pluginsRoot, entry.name))
    .filter(directory => existsSync(join(directory, 'package.json')))
    .sort()
}

async function buildPlugin(pluginDir) {
  const manifest = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'))
  const dist = join(pluginDir, 'dist')
  mkdirSync(dist, { recursive: true })
  // Drop previous artifacts so a face that was removed cannot linger in dist.
  for (const leftover of ['index.js', 'client.browser.js']) rmSync(join(dist, leftover), { force: true })

  const hasHost = existsSync(join(pluginDir, 'src/index.ts'))
  const hasClient = existsSync(join(pluginDir, 'src/client.tsx'))
  if (!hasHost && !hasClient) {
    throw new Error(`${manifest.name}: expected src/index.ts (Host) and/or src/client.tsx (client)`)
  }

  if (hasHost) {
    await build({
      absWorkingDir: pluginDir,
      entryPoints: ['src/index.ts'],
      outfile: 'dist/index.js',
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node22',
      // The Profile installs these; the bundle must not embed a second copy.
      packages: 'external',
      logLevel: 'warning',
    })
  }

  if (hasClient) {
    const client = await build({
      absWorkingDir: pluginDir,
      entryPoints: ['src/client.tsx'],
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'browser',
      target: 'es2022',
      jsx: 'automatic',
      // Shared singletons: React and every official client package must stay external.
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@deepseek-ai/*',
      ],
      logLevel: 'warning',
    })

    writeFileSync(
      join(dist, 'client.browser.js'),
      `window.__ModuleLoader__.load({
  id: ${JSON.stringify(manifest.name)},
  factory: function (require) {
    const module = { exports: {} };
${client.outputFiles[0].text}
    return module.exports;
  }
});
`,
    )
  }

  execFileSync(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(pluginDir, 'tsconfig.json')],
    { stdio: 'inherit' },
  )

  const faces = [hasHost && 'host', hasClient && 'client'].filter(Boolean).join('+')
  console.log(`built ${manifest.name} [${faces}] -> ${dist}`)
}

const requested = process.argv[2]
const targets = requested ? [resolve(root, requested)] : pluginDirectories()
if (!targets.length) {
  console.error('No plugins found under packages/plugins/*')
  process.exit(1)
}
for (const directory of targets) await buildPlugin(directory)
