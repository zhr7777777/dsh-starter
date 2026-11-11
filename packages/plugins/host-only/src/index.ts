/**
 * Host-only plugin: no browser entry, no slots, no UI.
 *
 * It shows the smallest real Host contribution: a service other Host plugins
 * can consume plus a lifecycle effect that is cleaned up on unload.
 *
 * Deliberately import-free at runtime. A profile does not resolve the official
 * packages that the launcher itself uses, so a plugin that needs `dsh-tools`,
 * `dsh-skill` or `dsh-llm` must install that exact official version into the
 * Profile (peer dependency + `dsh plugin add`). Keeping this example on `ctx`
 * alone makes the boundary explicit.
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-host-only-plugin'
export const inject = [] as const

export interface HostHeartbeat {
  /** Whole seconds since the plugin was applied. */
  uptimeSeconds(): number
  /** Scheduler ticks elapsed; a cheap liveness probe for other Host plugins. */
  ticks(): number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    hostHeartbeat: HostHeartbeat
  }
}

export function apply(ctx: Context): void {
  const logger = ctx.logger('dsh-host-only-plugin')
  const startedAt = Date.now()
  let ticks = 0

  const timer = setInterval(() => { ticks += 1 }, 30_000)
  // Never keep the Host process alive just for a heartbeat.
  timer.unref?.()

  ctx.provide('hostHeartbeat', {
    uptimeSeconds: () => Math.round((Date.now() - startedAt) / 1000),
    ticks: () => ticks,
  } satisfies HostHeartbeat)

  ctx.effect(() => {
    logger.info('dsh-host-only-plugin ready (host-only, no UI surface)')
    // No UI means no visible surface. One stdout line makes the load observable
    // in `pnpm dev` and assertable in `pnpm smoke`.
    process.stdout.write('[dsh-host-only-plugin] applied\n')
    return () => {
      clearInterval(timer)
      logger.info('dsh-host-only-plugin disposed')
    }
  }, 'dsh-host-only-plugin.lifecycle')
}
