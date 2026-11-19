#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pluginsRoot = join(root, 'packages/plugins')
const rootTsc = join(root, 'node_modules/typescript/bin/tsc')

const plugins = readdirSync(pluginsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => join(pluginsRoot, entry.name))
  .filter(directory => existsSync(join(directory, 'tsconfig.json')))
  .sort()

if (!plugins.length) {
  console.error('No plugins found under packages/plugins/*')
  process.exit(1)
}

for (const directory of plugins) {
  // Packages that pin their own compiler (dsh-context uses TypeScript 7's
  // native checker) typecheck with it; everything else uses the repo version.
  const localTsc = join(directory, 'node_modules/typescript/bin/tsc')
  const tsc = existsSync(localTsc) ? localTsc : rootTsc
  execFileSync(process.execPath, [tsc, '-p', join(directory, 'tsconfig.json'), '--noEmit'], { stdio: 'inherit' })
  console.log(`typecheck ok: ${directory.slice(root.length + 1)}`)
}
