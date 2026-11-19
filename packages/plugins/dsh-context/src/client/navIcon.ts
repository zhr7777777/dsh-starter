import type { Translate } from './i18n'

/**
 * The official settings shell projects each `settings.section` registration to
 * `{ id, order, label }` and derives its nav glyph from the section id, so a
 * plugin-owned icon cannot be passed through the slot. Tag the matching nav row
 * instead and let CSS swap the glyph, while React keeps owning the original
 * nodes (no DOM replacement, so reconciliation stays safe).
 */
const NAV_ICON_CLASS = 'dsh-usage-nav-btn'

function patchNavIcons(label: string): void {
  for (const nav of document.querySelectorAll('[role="dialog"][aria-modal="true"] nav')) {
    for (const button of nav.querySelectorAll('button')) {
      if (!(button instanceof HTMLElement)) continue
      if ((button.textContent ?? '').trim() !== label) continue
      if (!button.classList.contains(NAV_ICON_CLASS)) button.classList.add(NAV_ICON_CLASS)
    }
  }
}

export function watchUsageNavIcon(t: Translate): () => void {
  let frame = 0
  const schedule = (): void => {
    if (frame !== 0) return
    frame = requestAnimationFrame(() => {
      frame = 0
      patchNavIcons(t('ov.title').trim())
    })
  }
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class'],
  })
  schedule()
  return () => {
    observer.disconnect()
    if (frame !== 0) cancelAnimationFrame(frame)
  }
}
