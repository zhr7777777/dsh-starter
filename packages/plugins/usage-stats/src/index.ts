/**
 * Host face of a UI-only plugin.
 *
 * The page lives in `client.tsx` and reads dsh-context's public overview route.
 * This entry exists because the official client-modules service discovers
 * browser bundles by scanning *host loader entries* for `dsh.client`
 * declarations — no loader row means no client module.
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-usage-stats-plugin'
export const inject = [] as const

export function apply(ctx: Context): void {
  ctx.effect(() => {
    ctx.logger('dsh-usage-stats-plugin').debug('usage stats settings page mounted from dsh-usage-stats-plugin/client')
    return () => {}
  }, 'dsh-usage-stats-plugin.lifecycle')
}
