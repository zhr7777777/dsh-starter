/**
 * Presentation dock for the official Settings dialog.
 *
 * The official shell (`@deepseek-ai/dsh-client-ui-settings-general`) owns the
 * Settings trigger, its open state, the 800×800 panel, and the `settings.section`
 * projection — and it always portals that panel to `document.body` as a modal.
 * There is no slot that lets a plugin replace only the dialog chrome, so this
 * plugin leaves the official shell untouched and restyles its portal instead:
 *
 *   - the overlay keeps the panel but loses the full-viewport mask;
 *   - the panel is positioned over the `main` column (the same area where
 *     `sidebar.panellist` pages render) instead of the viewport centre;
 *   - clicking another sidebar row closes Settings first, so navigating away
 *     behaves like any other global panel.
 *
 * All selectors are public, stable markers (`data-shortcut-modal`, `data-slot`,
 * `role`), not the shell's hashed CSS-module class names. The panel still uses
 * the shell's own navigation, sections, close button, focus trap and Escape
 * handling; nothing is copied from the official package.
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-inline-settings-client'
export const inject = [] as const

const STYLE_ID = 'dsh-inline-settings-style'

const PANEL = '[data-shortcut-modal="settings"]'
const OVERLAY = `body > div[role="presentation"]:has(> ${PANEL})`
const MAIN_COLUMN = '[data-slot="main"]'
const SIDEBAR = '[data-slot="sidebar"]'
const SETTINGS_SEAT = '[data-slot="sidebar.settings"]'

const CSS = `
/* Keep the portal in place, but stop it from covering the sidebar. */
${OVERLAY} {
  inset:
    var(--dsh-settings-dock-top, 0px)
    var(--dsh-settings-dock-right, 0px)
    var(--dsh-settings-dock-bottom, 0px)
    var(--dsh-settings-dock-left, 0px);
  display: block;
  background: transparent;
  pointer-events: none;
}

/* The modal mask has no meaning once the panel is docked to a column. */
${OVERLAY} > [aria-hidden="true"] {
  display: none;
}

/* Fill the main column exactly; the shell keeps its own internal geometry. */
${OVERLAY} > ${PANEL} {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  border-radius: 0;
  box-shadow: none;
  pointer-events: auto;
}

/* The shell's nav rail is 188px. Keep it usable on narrow windows. */
${OVERLAY} > ${PANEL} > nav {
  width: min(188px, 42%);
}
`

function mainColumn(): HTMLElement | null {
  const main = document.querySelector(MAIN_COLUMN)
  return main instanceof HTMLElement ? main.parentElement : null
}

function overlay(): HTMLElement | null {
  const element = document.querySelector(OVERLAY)
  return element instanceof HTMLElement ? element : null
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.dataset.plugin = 'dsh-inline-settings-plugin'
  style.textContent = CSS
  document.head.appendChild(style)
}

/** Move the panel's viewport inset onto the live main-column rectangle. */
function syncDock(): void {
  const layer = overlay()
  const column = mainColumn()
  if (layer === null || column === null) return

  const rect = column.getBoundingClientRect()
  layer.style.setProperty('--dsh-settings-dock-top', `${rect.top}px`)
  layer.style.setProperty('--dsh-settings-dock-left', `${rect.left}px`)
  layer.style.setProperty('--dsh-settings-dock-right', `${Math.max(0, window.innerWidth - rect.right)}px`)
  layer.style.setProperty('--dsh-settings-dock-bottom', `${Math.max(0, window.innerHeight - rect.bottom)}px`)
}

/**
 * Close Settings through the shell's own close control, so its state, focus
 * restoration and Escape bookkeeping all run exactly as they do for a click in
 * the panel header. The keyboard event is a fallback for structural changes.
 */
function closeSettings(): void {
  const panel = document.querySelector(PANEL)
  if (!(panel instanceof HTMLElement)) return

  const header = panel.lastElementChild?.firstElementChild
  const close = header?.querySelector(':scope > button')
  if (close instanceof HTMLElement) {
    close.click()
    return
  }

  panel.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    }),
  )
}

export function apply(ctx: Context): void {
  ctx.effect(() => {
    ensureStyle()

    let observedColumn: HTMLElement | null = null
    const resize = new ResizeObserver(() => syncDock())

    const observeColumn = (): void => {
      const column = mainColumn()
      if (column === observedColumn) return
      if (observedColumn !== null) resize.unobserve(observedColumn)
      observedColumn = column
      if (column !== null) resize.observe(column)
    }

    // The panel is portaled in and out by React; watch its insertion rather
    // than scheduling a fixed delay after the trigger click.
    const mutations = new MutationObserver(() => {
      if (overlay() === null) return
      observeColumn()
      syncDock()
    })
    mutations.observe(document.body, { childList: true })

    const onResize = (): void => syncDock()
    const onClick = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (document.querySelector(PANEL) === null) return

      // Only sidebar navigation dismisses the docked page. The Settings seat
      // itself (trigger/account launcher) must keep its own behaviour.
      if (target.closest(SIDEBAR) === null) return
      if (target.closest(SETTINGS_SEAT) !== null) return
      closeSettings()
    }

    window.addEventListener('resize', onResize)
    document.addEventListener('click', onClick, true)

    observeColumn()
    syncDock()

    return () => {
      mutations.disconnect()
      resize.disconnect()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('click', onClick, true)
      document.getElementById(STYLE_ID)?.remove()
    }
  }, 'dsh-inline-settings-plugin.dock')
}
