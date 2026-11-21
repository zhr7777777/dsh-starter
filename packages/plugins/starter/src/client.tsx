/**
 * Browser entry: assembled by the official client module loader.
 *
 * Only public slot APIs are used here. The shell owns layout, the sidebar
 * structure, accessibility and selection state; this file contributes one
 * programmatic panel body, the composer's computer-target picker, the New
 * Session recommended questions, and the New Session brand footer.
 */
import * as React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: merges `main` into SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: merges the composer slots into SlotMap and exposes the input face.
import type { InputActions, InputZone } from '@deepseek-ai/dsh-client-ui-conversation/client'

export const name = 'dsh-starter-client'
export const inject = ['slots'] as const

/** Main keyed slot key. The starter panel is opened programmatically (expert team). */
const PANEL_ID = 'starter-hello'

function StarterPanel() {
  return (
    <section style={{ padding: '32px 40px', maxWidth: 720, color: 'var(--dsw-alias-label-primary)' }}>
      <p
        style={{
          margin: '0 0 8px',
          fontSize: 12,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          opacity: 0.6,
        }}
      >
        Starter
      </p>
      <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 650 }}>第一个插槽面板</h1>
      <p style={{ margin: 0, lineHeight: 1.7, opacity: 0.78 }}>
        这段内容由 <code>dsh-starter-plugin</code> 的 <code>main</code> 插槽注册提供。
        官方 Conversation、Composer 与侧栏都没有被替换。
      </p>
    </section>
  )
}

const COMPUTER_SLOT_ID = 'dsh-computer-target'
const COMPUTER_STORAGE_KEY = 'dsh-starter:computer-target'

type ComputerTarget = 'local' | 'cloud'

interface ComputerOption {
  id: ComputerTarget
  label: string
}

const COMPUTER_OPTIONS: readonly ComputerOption[] = [
  { id: 'local', label: '本地电脑' },
  { id: 'cloud', label: '云电脑' },
]

const computerCss = `
.dsh-computer{position:relative;display:inline-flex;align-items:center;min-width:0}
.dsh-computer__trigger{border-radius:var(--dsw-radius-sm);min-width:0;max-width:160px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;outline:none;display:inline-flex;align-items:center;gap:4px;padding:0 4px 0 8px;font:500 13px/20px var(--dsw-font-family,sans-serif)}
.dsh-computer__trigger:hover,.dsh-computer__trigger[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-computer__trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}
@container (width <= 460px){.dsh-computer__label{display:none}}
.dsh-computer__icon{flex:none;display:inline-flex}
.dsh-computer__icon svg{width:14px;height:14px}
.dsh-computer__label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dsh-computer__chevron{flex:none;color:var(--dsw-alias-label-caption);display:inline-flex;transition:transform .12s}
.dsh-computer__chevron svg{width:12px;height:12px}
.dsh-computer__chevron--open{transform:rotate(180deg)}
.dsh-computer__menu{position:fixed;z-index:90;box-sizing:border-box;min-width:188px;padding:6px;border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-panel);font:13px/20px var(--dsw-font-family,sans-serif)}
.dsh-computer__menu *{box-sizing:border-box}
.dsh-computer__option{display:flex;align-items:center;gap:8px;width:100%;height:34px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dsh-computer__option:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-computer__option-icon{flex:none;display:inline-flex;color:var(--dsw-alias-label-secondary)}
.dsh-computer__option-icon svg{width:15px;height:15px}
.dsh-computer__option-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-computer__check{flex:none;display:inline-flex;color:var(--dsw-alias-brand-primary)}
.dsh-computer__check svg{width:14px;height:14px}
`

function MonitorIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.5" />
      <path d="M8 11.25V14M5.5 14h5" />
    </svg>
  )
}

function CloudIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.6 12h7.1a2.6 2.6 0 0 0 .3-5.18 3.7 3.7 0 0 0-7.1-.52A2.4 2.4 0 0 0 4.6 12Z" />
    </svg>
  )
}

function ChevronIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6.5 8 10l4-3.5" />
    </svg>
  )
}

function CheckIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-6.5" />
    </svg>
  )
}

function readComputerTarget(): ComputerTarget {
  try {
    return localStorage.getItem(COMPUTER_STORAGE_KEY) === 'cloud' ? 'cloud' : 'local'
  } catch {
    return 'local'
  }
}

/**
 * Composer-left computer picker. Mirrors the permission trigger's compact
 * 28px row style: device glyph, current target, chevron and a listbox that
 * opens above the composer. The selection is local to the browser.
 */
function ComputerTargetPicker(): React.ReactElement {
  const [target, setTarget] = React.useState<ComputerTarget>(readComputerTarget)
  const [open, setOpen] = React.useState(false)
  const [spot, setSpot] = React.useState<{ left: number; bottom: number } | null>(null)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  const close = (): void => { setOpen(false) }

  React.useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: MouseEvent): void => {
      const node = event.target
      if (!(node instanceof Node)) return
      if (rootRef.current?.contains(node) === true || menuRef.current?.contains(node) === true) return
      close()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  React.useLayoutEffect(() => {
    if (!open) return
    const anchor = rootRef.current
    const menu = menuRef.current
    if (anchor === null || menu === null) return
    const rect = anchor.getBoundingClientRect()
    const width = menu.offsetWidth
    const left = Math.max(8, Math.min(rect.left - 4, window.innerWidth - width - 8))
    const bottom = Math.max(8, window.innerHeight - rect.top + 6)
    setSpot(current => current !== null && current.left === left && current.bottom === bottom ? current : { left, bottom })
  })

  const choose = (next: ComputerTarget): void => {
    setTarget(next)
    setOpen(false)
    try { localStorage.setItem(COMPUTER_STORAGE_KEY, next) } catch { /* storage unavailable */ }
    window.dispatchEvent(new CustomEvent('dsh-starter:computer-target', { detail: next }))
  }

  const current = COMPUTER_OPTIONS.find(option => option.id === target) ?? COMPUTER_OPTIONS[0]!
  return (
    <div className="dsh-computer" ref={rootRef}>
      <style>{computerCss}</style>
      <button
        type="button"
        className="dsh-computer__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`运行位置：${current.label}`}
        title={`运行位置：${current.label}`}
        onClick={() => { setOpen(value => !value) }}
      >
        <span className="dsh-computer__icon">{target === 'cloud' ? <CloudIcon /> : <MonitorIcon />}</span>
        <span className="dsh-computer__label">{current.label}</span>
        <span className={'dsh-computer__chevron' + (open ? ' dsh-computer__chevron--open' : '')}><ChevronIcon /></span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          className="dsh-computer__menu"
          role="listbox"
          aria-label="选择运行位置"
          style={spot === null ? { left: 0, bottom: 0, visibility: 'hidden' } : { left: spot.left, bottom: spot.bottom }}
        >
          {COMPUTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="dsh-computer__option"
              role="option"
              aria-selected={option.id === target}
              onClick={() => { choose(option.id) }}
            >
              <span className="dsh-computer__option-icon">{option.id === 'cloud' ? <CloudIcon /> : <MonitorIcon />}</span>
              <span className="dsh-computer__option-label">{option.label}</span>
              {option.id === target ? <span className="dsh-computer__check"><CheckIcon /></span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const RECOMMENDED_SLOT_ID = 'dsh-recommended-questions'

interface RecommendedQuestion {
  readonly id: string
  readonly text: string
}

/**
 * Four prompts shown below the composer only while the current Session is a
 * New Session. Clicking one writes it into the official draft editor through
 * the public `inputActions` face, so every edit afterwards stays native.
 */
const RECOMMENDED_QUESTIONS: readonly RecommendedQuestion[] = [
  { id: 'explore', text: '帮我快速了解这个项目的目录结构和主要功能。' },
  { id: 'build', text: '帮我实现一个新功能，并告诉我需要修改哪些文件。' },
  { id: 'explain', text: '解释一下这段代码的实现思路和关键设计。' },
  { id: 'debug', text: '帮我排查一个报错，先分析可能的原因。' },
]

const recommendedCss = `
.dsh-recommended{box-sizing:border-box;order:1;width:100%;margin-top:2px;padding:0 16px}
.dsh-recommended *{box-sizing:border-box}
.dsh-recommended__grid{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.dsh-recommended__item{display:flex;align-items:center;gap:9px;min-width:0;max-width:100%;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:13px/20px var(--dsw-font-family,sans-serif);text-align:left;cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.dsh-recommended__item:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-primary)}
.dsh-recommended__item:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}
.dsh-recommended__icon{flex:none;display:inline-flex;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-secondary))}
.dsh-recommended__icon svg{width:15px;height:15px}
.dsh-recommended__text{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-recommended__arrow{flex:none;display:inline-flex;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-secondary));transition:transform .12s,color .12s}
.dsh-recommended__arrow svg{width:14px;height:14px}
.dsh-recommended__item:hover .dsh-recommended__arrow{color:var(--dsw-alias-label-primary);transform:translateX(2px)}
`

function SparkIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 1.75 9.2 5.4 12.8 6.6 9.2 7.8 8 11.4 6.8 7.8 3.2 6.6 6.8 5.4 8 1.75Z" />
      <path d="M12.4 10.6v2.2M11.3 11.7h2.2" />
    </svg>
  )
}

function ArrowIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.25 8h9.5M9 4.25 12.75 8 9 11.75" />
    </svg>
  )
}

function focusComposer(): void {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[data-composer-input]')?.focus()
  })
}

function RecommendedQuestions({ session, inputActions }: InputZone & { inputActions: InputActions }): React.ReactElement | null {
  // The official hero exists exactly while the Session is still a New Session.
  if (!session.blank || session.promptAttempted) return null

  const choose = (question: RecommendedQuestion): void => {
    inputActions.setDraft(question.text)
    focusComposer()
  }

  return (
    <>
      <section className="dsh-recommended" aria-label="推荐问">
        <style>{recommendedCss}</style>
        <div className="dsh-recommended__grid">
          {RECOMMENDED_QUESTIONS.map((question) => (
            <button
              key={question.id}
              type="button"
              className="dsh-recommended__item"
              title={question.text}
              onClick={() => { choose(question) }}
            >
              <span className="dsh-recommended__icon"><SparkIcon /></span>
              <span className="dsh-recommended__text">{question.text}</span>
              <span className="dsh-recommended__arrow"><ArrowIcon /></span>
            </button>
          ))}
        </div>
      </section>
      <PoweredByFooter />
    </>
  )
}

const poweredByCss = `
.dsh-powered-by{position:absolute;left:0;right:0;bottom:14px;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-secondary));font:400 12px/18px var(--dsw-font-family,sans-serif);pointer-events:none;user-select:none}
.dsh-powered-by__brand{color:var(--dsw-alias-label-secondary);font-weight:500}
`

/** Brand footer pinned to the bottom of the Conversation column. */
function PoweredByFooter(): React.ReactElement {
  return (
    <footer className="dsh-powered-by">
      <style>{poweredByCss}</style>
      <span>Powered by</span>
      <span className="dsh-powered-by__brand">平安智能体平台</span>
    </footer>
  )
}

export function apply(ctx: Context): void {
  // The starter panel no longer has a sidebar row; it stays mounted as a main
  // keyed slot and is opened programmatically by the expert-team trigger.
  ctx.slots.inject('main', () =>
    ctx.slots.register({ name: 'main', key: PANEL_ID }, StarterPanel),
  )

  // Composer row: sits directly right of the permission selector (single slot
  // rendered before this list) and left of the expert-team trigger (order 40).
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      { name: 'conversation.input.left', id: COMPUTER_SLOT_ID, order: 30 },
      ComputerTargetPicker,
    ),
  )

  // `order: 1` moves this dock below the composer card inside the hero stack.
  // The occupant renders nothing once the Session stops being a New Session.
  ctx.slots.inject('conversation.input.dock', () =>
    ctx.slots.register(
      { name: 'conversation.input.dock', id: RECOMMENDED_SLOT_ID, order: 10 },
      RecommendedQuestions,
    ),
  )
}
