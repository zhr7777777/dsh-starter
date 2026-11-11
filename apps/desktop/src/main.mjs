/**
 * Electron main process: the carrier around the official `dsh web` server.
 *
 * It owns exactly four things — a window, a child process, the ready URL, and
 * shutdown. All Host/Client code stays inside the official packages; this file
 * contains no DSH business logic and no frontend code.
 *
 * Flow
 *   1. resolve the runtime (dev: project node_modules, packaged: resources/runtime)
 *   2. seed DSH_HOME with the profile template on first launch
 *   3. spawn the official CLI with ELECTRON_RUN_AS_NODE=1 (no bundled Node needed)
 *   4. wait for `dsh web: http://127.0.0.1:PORT/?token=…` on stdout
 *   5. load that URL into the window; kill the child when the app quits
 */
import { spawn } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, shell } from 'electron'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = join(here, '..')
const projectRoot = join(appRoot, '..', '..')

const packaged = app.isPackaged
const runtimeDir = packaged ? join(process.resourcesPath, 'runtime') : join(appRoot, 'runtime')
const profileName = process.env.DSH_PROFILE ?? 'starter'

/** The launcher banner is the only readiness signal the official CLI prints. */
const READY_PATTERN = /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+\/?\?token=[^\s]+)/u

/**
 * The official native loader (`node-addon-require-builtin`) intercepts builtins
 * by fingerprint and only accepts Electron versions on its allow-list. Running
 * the Host on an unlisted Electron aborts with
 * `unsupported Electron runtime fingerprint`. Keep the pinned version in
 * apps/desktop/package.json and bump it when the official list widens.
 */
const ELECTRON_FINGERPRINT_ERROR = 'unsupported Electron runtime fingerprint'
const START_TIMEOUT_MS = Number(process.env.DSH_START_TIMEOUT_MS ?? 180_000)

let window
let child
let readyUrl
let quitting = false
let logFile
const logLines = []

function track(line) {
  const text = line.trimEnd()
  if (!text) return
  logLines.push(text)
  if (logLines.length > 200) logLines.shift()
  if (logFile) {
    try { appendFileSync(logFile, text + '\n') } catch { /* logging must never break startup */ }
  }
}

/** The CLI plus the profile template, wherever this build keeps them. */
function resolveRuntime() {
  // The packaged tree is resources/runtime/host/node_modules: the extra `host`
  // level is what keeps electron-builder's extraResources filter from dropping
  // the official packages (see scripts/build-runtime.mjs).
  const cli = packaged
    ? join(runtimeDir, 'host', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    : join(projectRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const template = join(runtimeDir, 'profile')
  return { cli, template }
}

/**
 * DSH_HOME: the official per-user directory. Development reuses the project's
 * .dsh-home so `pnpm dev` and the desktop window share sessions; a packaged app
 * keeps everything under the OS user-data directory.
 */
function resolveHome() {
  if (process.env.DSH_HOME) return process.env.DSH_HOME
  return packaged ? join(app.getPath('userData'), 'dsh-home') : join(projectRoot, '.dsh-home')
}

/** Seed the profile on first launch so the app is usable without a build step. */
function ensureProfile(home, template) {
  const profileDir = join(home, 'profiles', profileName)
  if (existsSync(join(profileDir, 'package.json'))) return profileDir
  if (!existsSync(template)) throw new Error(`profile template missing: ${template}`)
  mkdirSync(join(home, 'profiles'), { recursive: true })
  cpSync(template, profileDir, { recursive: true })
  track(`seeded profile from template: ${profileDir}`)
  return profileDir
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolvePort(port))
    })
  })
}

const escape = text => String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

/** A local data: page, so startup needs no extra HTTP round-trip or file window. */
function page(file, message) {
  const html = existsSync(file)
    ? readFileSync(file, 'utf8').replace('<!-- MESSAGE -->', escape(message))
    : `<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;padding:24px;white-space:pre-wrap">${escape(message)}</body>`
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}

function openWindow() {
  window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0e1116',
    show: true,
    title: 'DSH Starter',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      // The page is the official web client: no Node, no preload bridge, no
      // shared context. Everything it needs comes over HTTP from the Host.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  })

  // Links that leave the app go to the system browser; nothing opens a second
  // Electron window we do not control.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const current = window.webContents.getURL()
    if (new URL(url).origin === new URL(current || 'http://127.0.0.1').origin) return
    event.preventDefault()
    void shell.openExternal(url)
  })

  window.on('closed', () => { window = undefined })
  window.loadURL(page(join(appRoot, 'src', 'splash.html'), '正在启动 DSH…'))
  return window
}

function fail(message, detail = '') {
  track(`startup failed: ${message}`)
  const tail = logLines.slice(-12).join('\n')
  const body = [message, detail, tail].filter(Boolean).join('\n\n')
  if (window && !window.isDestroyed()) {
    void window.loadURL(page(join(appRoot, 'src', 'error.html'), body))
  }
  stopChild()
}

/**
 * Optional self-check for CI: open the ready URL, complete the token→cookie
 * handshake, confirm the page carries the official boot manifest, then exit.
 * Used by `DSH_DESKTOP_SELFTEST=1` so a packaged app can be verified without a
 * human looking at the window.
 */
async function selfTest(url) {
  try {
    const redirect = await fetch(url, { redirect: 'manual' })
    const cookie = ((redirect.headers.getSetCookie?.() ?? [])[0] ?? '').split(';')[0]
    const page = await fetch(new URL('/', url), { headers: cookie ? { cookie } : {} })
    const html = await page.text()
    const boot = html.includes('__DSH_BOOT__')
    track(`selftest: status=${page.status} boot-manifest=${boot}`)
    quitting = true
    stopChild()
    app.exit(page.ok && boot ? 0 : 1)
  } catch (error) {
    track(`selftest: failed ${String(error)}`)
    quitting = true
    stopChild()
    app.exit(1)
  }
}

function stopChild() {
  if (!child || child.exitCode !== null) return
  const target = child
  child = undefined
  target.kill('SIGTERM')
  setTimeout(() => {
    if (target.exitCode === null) target.kill('SIGKILL')
  }, 5_000).unref()
}

async function start() {
  // A Host we already own stays authoritative: reopening the window (macOS
  // dock click) must not start a second server on a second port.
  if (child) {
    if (readyUrl && window && !window.isDestroyed()) void window.loadURL(readyUrl)
    return
  }

  const { cli, template } = resolveRuntime()
  const home = resolveHome()

  if (!existsSync(cli)) {
    fail(`Cannot find the official DSH CLI at ${cli}`, packaged
      ? 'The packaged runtime is incomplete: rebuild with `pnpm run dist`.'
      : 'Run `pnpm install` in the project root first.')
    return
  }

  mkdirSync(home, { recursive: true })
  logFile = join(home, 'desktop.log')
  writeFileSync(logFile, `# desktop launch ${new Date().toISOString()}\n`)
  track(`cli:  ${cli}`)
  track(`home: ${home}`)

  let profileDir
  try {
    profileDir = ensureProfile(home, template)
  } catch (error) {
    fail('Cannot prepare the DSH profile', String(error))
    return
  }
  track(`profile: ${profileDir}`)

  const port = await freePort()
  const args = [cli, '--profile', profileName, '--host', '127.0.0.1', '--port', String(port), '--no-open']
  track(`spawn: ${process.execPath} ${args.slice(1).join(' ')}`)

  child = spawn(process.execPath, args, {
    cwd: home,
    // ELECTRON_RUN_AS_NODE turns this same binary into a plain Node runtime, so
    // the app carries no second Node installation.
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DSH_HOME: home,
      DSH_AGENTS_HOME: process.env.DSH_AGENTS_HOME ?? join(home, 'agents'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let buffer = ''
  let settled = false
  const finish = (callback, ...values) => {
    if (settled) return
    settled = true
    callback(...values)
  }

  const timer = setTimeout(() => {
    finish(() => fail(`DSH did not report a ready URL within ${START_TIMEOUT_MS / 1000}s`))
  }, START_TIMEOUT_MS)
  timer.unref?.()

  const consume = (chunk) => {
    buffer += chunk
    let index
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      track(line)
      const match = READY_PATTERN.exec(line)
      if (match) {
        clearTimeout(timer)
        finish(() => {
          if (quitting) return
          readyUrl = match[1]
          if (process.env.DSH_DESKTOP_SELFTEST) {
            void selfTest(match[1])
            return
          }
          window?.loadURL(match[1]).catch(error => fail('Cannot open the DSH window', String(error)))
        })
      }
    }
  }

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', consume)
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => {
    for (const line of String(chunk).split('\n')) track(line)
  })

  child.on('error', error => {
    clearTimeout(timer)
    finish(() => fail('Cannot start the DSH Host process', String(error)))
  })
  child.on('exit', (code, signal) => {
    clearTimeout(timer)
    child = undefined
    if (quitting) return
    finish(() => {
      const fingerprint = logLines.find(line => line.includes(ELECTRON_FINGERPRINT_ERROR))
      if (fingerprint) {
        fail('Electron 版本不在官方允许列表内，Host 拒绝启动',
          `${fingerprint}\n\n把 apps/desktop/package.json 的 electron 固定到官方允许的版本（错误里会列出），重新 pnpm install。`)
        return
      }
      fail(`The DSH Host process exited (code ${code ?? 'null'}, signal ${signal ?? 'none'})`)
    })
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  app.whenReady().then(() => {
    openWindow()
    void start()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length) return
      openWindow()
      void start()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    quitting = true
    stopChild()
  })
  app.on('will-quit', stopChild)
  process.on('exit', stopChild)
}
