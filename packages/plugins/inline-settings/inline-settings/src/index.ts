/**
 * Host face of a UI-only plugin.
 *
 * The dock lives in `client.tsx`. This entry exists because the official
 * client-modules service discovers browser bundles by scanning *host loader
 * entries* for `dsh.client` declarations — no loader row means no client module.
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-inline-settings-plugin'
export const inject = [] as const

export function apply(ctx: Context): void {
  ctx.effect(() => {
    ctx.logger('dsh-inline-settings-plugin').debug('inline settings dock mounted from dsh-inline-settings-plugin/client')
    return () => {}
  }, 'dsh-inline-settings-plugin.lifecycle')
}
