/**
 * Expert team picker, contributed to the left side of the composer tool row.
 *
 * Everything is mocked in the browser: no Host round-trip, no Session mutation.
 * The only real integration is the slot contract — `conversation.input.left`
 * for the trigger and the `main` keyed slot for the jump target.
 */
import * as React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: merges `conversation.input.left` into SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

export const name = 'dsh-expert-team-client'
export const inject = ['slots', 'layout'] as const

/** List id of this trigger inside `conversation.input.left`. */
const SLOT_ID = 'dsh-expert-team'
/** Target panel contributed by packages/plugins/starter (sidebar id === main key). */
const STARTER_PANEL = 'starter-hello'

interface Expert {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly summary: string
  readonly avatar: string
  readonly accent: string
}

const experts: readonly Expert[] = [
  {
    id: 'analyst',
    name: '林澈',
    role: '数据分析师',
    summary: '拆解指标、写 SQL、把结论画成图。',
    avatar: '林',
    accent: 'linear-gradient(145deg,#2f6df6,#5aa9ff)',
  },
  {
    id: 'designer',
    name: '沈知',
    role: '产品设计师',
    summary: '梳理信息架构与交互流程，产出可评审方案。',
    avatar: '沈',
    accent: 'linear-gradient(145deg,#c2410c,#f59e0b)',
  },
  {
    id: 'architect',
    name: '周行',
    role: '技术架构师',
    summary: '评估技术选型、拆分模块、指出长期成本。',
    avatar: '周',
    accent: 'linear-gradient(145deg,#0f766e,#14b8a6)',
  },
]

const css = `
.dsh-expert-team{position:relative;display:flex;align-items:center}
.dsh-expert-team__trigger{display:flex;align-items:center;gap:7px;height:36px;padding:0 10px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);font:500 13px/1 var(--dsw-font-family,sans-serif);cursor:pointer}
.dsh-expert-team__trigger:hover,.dsh-expert-team__trigger[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-expert-team__trigger svg{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.dsh-expert-team__popover{position:fixed;z-index:90;box-sizing:border-box;width:336px;max-width:calc(100vw - 24px);padding:10px;border-radius:15px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-panel);font:14px/20px var(--dsw-font-family,sans-serif)}
.dsh-expert-team__popover *{box-sizing:border-box}
.dsh-expert-team__head{padding:6px 8px 10px}
.dsh-expert-team__head strong{display:block;font-size:14px;font-weight:600}
.dsh-expert-team__head small{display:block;margin-top:2px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dsh-expert-team__row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;padding:6px;border-radius:10px}
.dsh-expert-team__row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-expert-team__avatar{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;color:#fff;font-weight:600}
.dsh-expert-team__copy{min-width:0}
.dsh-expert-team__copy strong,.dsh-expert-team__copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-expert-team__copy strong{font-size:13.5px;font-weight:600}
.dsh-expert-team__copy small{margin-top:2px;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.dsh-expert-team__summon{min-width:56px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:500 12px/1 var(--dsw-font-family,sans-serif);cursor:pointer}
.dsh-expert-team__summon:hover{border-color:var(--dsw-alias-label-primary)}
.dsh-expert-team__foot{margin:6px 2px 0;padding:8px 8px 4px;border-top:.5px solid var(--dsw-alias-border-l2);font-size:11px;color:var(--dsw-alias-label-secondary)}
.dsh-expert-team__error{margin:6px 8px 0;font-size:11.5px;color:var(--dsw-alias-state-danger-primary,var(--dsw-alias-label-primary))}
@media (max-width:720px){.dsh-expert-team__trigger span{display:none}}
`

type TriggerProps = { summon: (expert: Expert) => boolean }

function ExpertTeamTrigger({ summon }: TriggerProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<{ left: number, bottom: number }>()
  const [error, setError] = React.useState('')

  // The composer sits in the middle of the window, and a 336px panel anchored
  // left would run past the right edge on narrow windows (or under the sidebar
  // when flipped). Measure the trigger and clamp a fixed-position panel inside
  // the viewport instead; re-place on resize, which also covers sidebar
  // collapse/expand moving the composer.
  React.useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = root.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(356, window.innerWidth - 24)
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        bottom: window.innerHeight - rect.top + 10,
      })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      root.current?.querySelector<HTMLButtonElement>('.dsh-expert-team__trigger')?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const pick = (expert: Expert) => {
    setError('')
    if (summon(expert)) {
      setOpen(false)
      return
    }
    setError('目标面板不可用：请确认 starter 插件已启用。')
  }

  return (
    <div className="dsh-expert-team" ref={root}>
      <style>{css}</style>
      <button
        type="button"
        className="dsh-expert-team__trigger"
        aria-label="召唤专家"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
          <circle cx="17.5" cy="9.5" r="2.4" />
          <path d="M15.4 14.6c2.6-.4 4.7 1.1 5.1 4.4" />
        </svg>
        <span>专家团</span>
      </button>

      {open ? (
        <div
          className="dsh-expert-team__popover"
          style={position ? { left: position.left, bottom: position.bottom } : { visibility: 'hidden' }}
          role="dialog"
          aria-label="召唤专家"
        >
          <div className="dsh-expert-team__head">
            <strong>召唤专家</strong>
            <small>选一位专家团成员，带着你的草稿进入协作</small>
          </div>

          {experts.map(expert => (
            <div className="dsh-expert-team__row" key={expert.id}>
              <span className="dsh-expert-team__avatar" style={{ background: expert.accent }} aria-hidden="true">
                {expert.avatar}
              </span>
              <span className="dsh-expert-team__copy">
                <strong>{expert.name} · {expert.role}</strong>
                <small>{expert.summary}</small>
              </span>
              <button
                type="button"
                className="dsh-expert-team__summon"
                aria-label={`召唤 ${expert.role} ${expert.name}`}
                onClick={() => pick(expert)}
              >
                召唤
              </button>
            </div>
          ))}

          <p className="dsh-expert-team__foot">示例数据：三位专家为本地 mock，召唤后跳转到 Starter 面板。</p>
          {error ? <p className="dsh-expert-team__foot dsh-expert-team__error" role="alert">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.left',
        id: SLOT_ID,
        order: 40,
        inject: () => ({
          summon: (expert: Expert): boolean => {
            // The sidebar row and the main panel share one string; verify the
            // target exists so a disabled starter plugin cannot strand the user
            // on an empty panel.
            const available = ctx.slots
              .entriesOfSlot('main')
              .some(entry => entry.options.key === STARTER_PANEL)
            if (!available) return false
            ctx.layout.selectPanel(STARTER_PANEL as MainPanelId)
            window.dispatchEvent(new CustomEvent('dsh-starter:expert-summoned', { detail: expert }))
            return true
          },
        }),
      },
      ExpertTeamTrigger,
    ),
  )
}
