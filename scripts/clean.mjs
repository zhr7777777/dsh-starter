#!/usr/bin/env node
import { readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targets = ['.dsh-home', '.artifacts', ...readdirSync(join(root, 'packages/plugins'), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => `packages/plugins/${entry.name}/dist`)]

for (const path of targets) {
  rmSync(join(root, path), { recursive: true, force: true })
  console.log(`removed ${path}`)
}
