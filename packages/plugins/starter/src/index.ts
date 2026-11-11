/**
 * Host entry: runs inside the DSH Host process.
 *
 * It provides one service other Host plugins can consume. A browser component
 * cannot call this directly — client↔host data needs the official remote/API
 * layer, which this starter deliberately leaves out.
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-starter-plugin'
export const inject = [] as const

export interface StarterService {
  /** Trivial business capability, only to prove the service is reachable on the Host. */
  greeting(who?: string): string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    starter: StarterService
  }
}

export function apply(ctx: Context): void {
  const logger = ctx.logger('dsh-starter-plugin')
  const starter: StarterService = {
    greeting: (who = 'world') => `Hello, ${who}!`,
  }

  ctx.provide('starter', starter)

  ctx.effect(() => {
    logger.info('dsh-starter-plugin ready')
    return () => logger.info('dsh-starter-plugin disposed')
  }, 'dsh-starter-plugin.lifecycle')
}
