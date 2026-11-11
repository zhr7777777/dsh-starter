/**
 * Host face of a UI-only plugin.
 *
 * The UI lives entirely in `client.tsx`. This entry exists because the official
 * client-modules service discovers browser bundles by scanning *host loader
 * entries* for `dsh.client` declarations — no loader row means no client module,
 * even if the package ships one.
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-expert-team-plugin'
export const inject = [] as const

export function apply(ctx: Context): void {
  ctx.effect(() => {
    ctx.logger('dsh-expert-team-plugin').debug('expert team UI mounted from dsh-expert-team-plugin/client')
    return () => {}
  }, 'dsh-expert-team-plugin.lifecycle')
}
