/**
 * Browser entry: assembled by the official client module loader.
 *
 * Only public slot APIs are used here. The shell owns layout, the sidebar
 * button, accessibility and selection state; this file contributes a glyph and
 * one panel body.
 */
import * as React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: merges `sidebar.panellist` into SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: merges `main` into SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'

export const name = 'dsh-starter-client'
export const inject = ['slots'] as const

/** Sidebar list id === main keyed slot key, so the row actually opens this panel. */
const PANEL_ID = 'starter-hello'

function StarterIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l2.3 5.7L20 11l-5.7 2.3L12 19l-2.3-5.7L4 11l5.7-2.3z" />
    </svg>
  )
}

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

export function apply(ctx: Context): void {
  // List slot: id is dedupe key + order position + accessibility label.
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_ID, label: '示例', order: 15 },
      StarterIcon,
    ),
  )

  // Keyed slot: the key must equal the sidebar row id above.
  ctx.slots.inject('main', () =>
    ctx.slots.register({ name: 'main', key: PANEL_ID }, StarterPanel),
  )
}
