import type { Translate } from './i18n'
import type { ContextSettings } from './settings'
import type { ClientCtx } from './services'
import { watchGate } from './toggleGate'

export const INSIGHT_PANEL_ID = 'dsh-context'

/**
 * Settings navigation order: Account is -10 and General is 0, so -5 lands
 * directly above 通用设置. The context dashboard replaces the old usage-stats
 * section with the plugin's full overview page.
 */
export const INSIGHT_PANEL_ORDER = -5

export function watchInsightPage(
  ctx: ClientCtx,
  settings: ContextSettings,
  page: (props: { sessionId?: string } & Record<string, unknown>) => unknown,
  t: Translate,
  ns: string,
): () => void {
  return watchGate(
    settings.store,
    () => settings.insightsEntry() === 'show',
    () => [
      ctx.slots.inject('settings.section', () => ctx.slots.register(
        { name: 'settings.section', id: INSIGHT_PANEL_ID, order: INSIGHT_PANEL_ORDER, label: () => t('ov.title'), locale: ns },
        page,
      )),
    ],
  )
}
