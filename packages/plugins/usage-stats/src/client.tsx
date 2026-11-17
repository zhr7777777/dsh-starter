/**
 * Settings → 用量统计.
 *
 * The page is a read-only consumer of dsh-context's overview route
 * (`POST api/dsh-context/overview`). That plugin owns the projection cache and
 * the cold-session backfill, so we reuse its numbers instead of re-folding the
 * session logs here; only the HTTP contract is touched, never its internals.
 *
 * The slot is `settings.section` with `order: -5`: the official General page
 * registers at 0 and Account at -10, so this lands directly above 通用设置.
 */
import * as React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: merges `settings.section` into SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'

export const name = 'dsh-usage-stats-client'
export const inject = ['slots'] as const

const SECTION_ID = 'usage-stats'
const ROUTE = 'api/dsh-context/overview'
const REFRESH_MS = 30_000

type Range = 'today' | '7d' | '30d'

interface PartTotal {
  key: string
  value: number
}

interface Coverage {
  complete: boolean
  running: boolean
  covered: number
  total: number
}

interface Summary {
  sessions: number
  tokens: number
  turns: number
  toolCalls: number
  costUsd: number | null
  costSessions: number
  usageSessions: number
  cacheHit: string | null
  tokenParts: PartTotal[]
  coverage: Coverage
}

interface Day {
  key: string
  tokens: number
  sessions: number
  costUsd: number | null
}

interface TallyStat {
  name: string
  n: number
  sessions: number
}

interface PageRow {
  id: string
  title: string
  tokens: number
  turns: number
  costUsd: number | null
  updatedAt: number
}

type Phase = 'loading' | 'ready' | 'unavailable'

interface Overview {
  phase: Phase
  summary: Summary | null
  days: Day[]
  tools: TallyStat[]
  rows: PageRow[]
  updatedAt: number
}

const PART_LABEL: Record<string, string> = {
  system: '系统提示词',
  tools: '工具定义',
  user: '用户消息',
  inject: '注入上下文',
  skill: '技能注入',
  toolCalls: '工具调用',
  thinking: '推理',
  answers: '回答',
}

const PART_COLOR: Record<string, string> = {
  system: '#8b8fe8',
  tools: '#5bb3c9',
  user: '#e8b04b',
  inject: '#b07ad6',
  skill: '#4fbf8f',
  toolCalls: '#e07a5f',
  thinking: '#9a9a9a',
  answers: '#5b8def',
}

const RANGES: { id: Range; label: string; days: number }[] = [
  { id: 'today', label: '今天', days: 1 },
  { id: '7d', label: '近 7 天', days: 7 },
  { id: '30d', label: '近 30 天', days: 30 },
]

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function numOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function strOf(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function partsOf(value: unknown): PartTotal[] {
  if (!Array.isArray(value)) return []
  const parts: PartTotal[] = []
  for (const entry of value) {
    const record = recordOf(entry)
    if (record === null) continue
    const key = strOf(record.key)
    if (key === undefined) continue
    parts.push({ key, value: numOf(record.value) })
  }
  return parts
}

function summaryOf(value: unknown): Summary | null {
  const record = recordOf(value)
  if (record === null) return null
  const coverage = recordOf(record.coverage)
  const timing = recordOf(record.windowTiming)
  return {
    sessions: numOf(record.sessions),
    tokens: numOf(record.tokens),
    turns: numOf(record.turns),
    toolCalls: numOf(timing?.toolCalls),
    costUsd: numOrNull(record.costUsd),
    costSessions: numOf(record.costSessions),
    usageSessions: numOf(record.usageSessions),
    cacheHit: strOf(record.cacheHit) ?? null,
    tokenParts: partsOf(record.tokenParts),
    coverage: {
      complete: coverage?.complete === true,
      running: coverage?.running === true,
      covered: numOf(coverage?.covered),
      total: numOf(coverage?.total),
    },
  }
}

function daysOf(value: unknown): Day[] {
  if (!Array.isArray(value)) return []
  const days: Day[] = []
  for (const entry of value) {
    const record = recordOf(entry)
    if (record === null) continue
    const key = strOf(record.key)
    if (key === undefined) continue
    days.push({
      key,
      tokens: numOf(record.tokens),
      sessions: numOf(record.sessions),
      costUsd: numOrNull(record.costUsd),
    })
  }
  return days
}

function toolsOf(value: unknown): TallyStat[] {
  const stats = recordOf(value)?.stats
  if (!Array.isArray(stats)) return []
  const tools: TallyStat[] = []
  for (const entry of stats) {
    const record = recordOf(entry)
    if (record === null) continue
    const toolName = strOf(record.name)
    if (toolName === undefined) continue
    tools.push({ name: toolName, n: numOf(record.n), sessions: numOf(record.sessions) })
  }
  return tools
}

function rowsOf(value: unknown): PageRow[] {
  const items = recordOf(value)?.items
  if (!Array.isArray(items)) return []
  const rows: PageRow[] = []
  for (const entry of items) {
    const record = recordOf(entry)
    if (record === null) continue
    const id = strOf(record.id)
    if (id === undefined) continue
    rows.push({
      id,
      title: strOf(record.title) ?? id,
      tokens: numOf(record.tokens),
      turns: numOf(record.turns),
      costUsd: numOrNull(record.costUsd),
      updatedAt: numOf(record.updatedAt),
    })
  }
  return rows
}

/** POST one overview part and unwrap `{ ok, revision, value }`. */
async function readPart(body: Record<string, unknown>, signal: AbortSignal): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    })
    if (!response.ok) return null
    const envelope = recordOf(await response.json())
    if (envelope === null || envelope.ok !== true) return null
    return recordOf(envelope.value)
  } catch {
    return null
  }
}

function useOverview(range: Range): Overview {
  const [overview, setOverview] = React.useState<Overview>({
    phase: 'loading',
    summary: null,
    days: [],
    tools: [],
    rows: [],
    updatedAt: 0,
  })

  React.useEffect(() => {
    const controller = new AbortController()
    let disposed = false

    const load = async () => {
      const scope = { range, coverage: 'all' }
      const [summaryValue, daysValue, toolsValue, pageValue] = await Promise.all([
        readPart({ part: 'summary', scope }, controller.signal),
        readPart({ part: 'days', scope: { coverage: 'all' } }, controller.signal),
        readPart({ part: 'tally', scope, tally: 'tools' }, controller.signal),
        readPart({ part: 'page', scope, sort: 'tokens', page: 0 }, controller.signal),
      ])
      if (disposed) return
      const summary = summaryOf(summaryValue?.summary)
      if (summary === null) {
        setOverview(previous => previous.phase === 'ready' ? previous : {
          phase: 'unavailable',
          summary: null,
          days: [],
          tools: [],
          rows: [],
          updatedAt: 0,
        })
        return
      }
      setOverview({
        phase: 'ready',
        summary,
        days: daysOf(daysValue?.days),
        tools: toolsOf(toolsValue?.tally),
        rows: rowsOf(pageValue?.page),
        updatedAt: Date.now(),
      })
    }

    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
    return () => {
      disposed = true
      clearInterval(timer)
      controller.abort()
    }
  }, [range])

  return overview
}

function formatTokens(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(Math.round(value))
}

function formatUsd(value: number | null): string {
  if (value === null) return '—'
  if (value >= 100) return `US$${value.toFixed(0)}`
  if (value >= 1) return `US$${value.toFixed(2)}`
  return `US$${value.toFixed(4)}`
}

function formatDay(key: string): string {
  return key.slice(5)
}

function dayKeyOf(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Local-day keys ending today, oldest first. */
function windowKeys(range: Range): string[] {
  const count = RANGES.find(entry => entry.id === range)?.days ?? 7
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const keys: string[] = []
  for (let offset = count - 1; offset >= 0; offset--) {
    const day = new Date(today)
    day.setDate(day.getDate() - offset)
    keys.push(dayKeyOf(day))
  }
  return keys
}

function formatUpdatedAt(value: number): string {
  if (value <= 0) return ''
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-md)',
        background: 'var(--dsw-alias-bg-layer-2)',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.6, whiteSpace: 'nowrap' }}>{value}</div>
      {hint !== undefined && (
        <div style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{children}</h2>
      {extra}
    </div>
  )
}

function DailyChart({ days, range }: { days: Day[]; range: Range }) {
  const keys = windowKeys(range)
  const byKey = new Map(days.map(day => [day.key, day]))
  const values = keys.map(key => byKey.get(key)?.tokens ?? 0)
  const max = Math.max(1, ...values)
  const dense = keys.length > 10
  const labelEvery = dense ? Math.ceil(keys.length / 6) : 1
  const total = values.reduce((sum, value) => sum + value, 0)

  if (total <= 0) {
    return (
      <div>
        <SectionTitle>按日用量</SectionTitle>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed var(--dsw-alias-border-l2)',
            borderRadius: 'var(--dsw-radius-md)',
            fontSize: 12,
            color: 'var(--dsw-alias-label-tertiary)',
          }}
        >
          该时间范围内还没有 token 用量
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionTitle extra={<span style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }}>合计 {formatTokens(total)} tokens</span>}>
        按日用量
      </SectionTitle>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: dense ? 2 : 6, height: 92 }}>
        {keys.map((key, index) => {
          const value = values[index] ?? 0
          const height = value > 0 ? Math.max(3, Math.round((value / max) * 88)) : 2
          return (
            <div
              key={key}
              title={`${key} · ${formatTokens(value)} tokens · ${byKey.get(key)?.sessions ?? 0} 个会话`}
              style={{
                flex: 1,
                minWidth: 0,
                height,
                borderRadius: 3,
                background: value > 0
                  ? 'var(--dsw-alias-brand-primary-new-colorprimary-new-color)'
                  : 'var(--dsw-alias-border-l2)',
                opacity: value > 0 ? 0.9 : 0.5,
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: dense ? 2 : 6, marginTop: 6 }}>
        {keys.map((key, index) => (
          <div
            key={key}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'center',
              fontSize: 10,
              color: 'var(--dsw-alias-label-tertiary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {index % labelEvery === 0 ? formatDay(key) : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function Composition({ parts }: { parts: PartTotal[] }) {
  const positive = parts.filter(part => part.value > 0)
  const total = positive.reduce((sum, part) => sum + part.value, 0)
  if (total <= 0) return null

  return (
    <div>
      <SectionTitle extra={<span style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }}>按上下文分类</span>}>
        Token 构成
      </SectionTitle>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--dsw-alias-border-l2)' }}>
        {positive.map(part => (
          <div
            key={part.key}
            title={`${PART_LABEL[part.key] ?? part.key} · ${formatTokens(part.value)} (${((part.value / total) * 100).toFixed(1)}%)`}
            style={{ width: `${(part.value / total) * 100}%`, background: PART_COLOR[part.key] ?? '#8b8fe8' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10 }}>
        {positive.map(part => (
          <span key={part.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: PART_COLOR[part.key] ?? '#8b8fe8' }} />
            <span style={{ color: 'var(--dsw-alias-label-secondary)' }}>{PART_LABEL[part.key] ?? part.key}</span>
            <span style={{ color: 'var(--dsw-alias-label-tertiary)' }}>{((part.value / total) * 100).toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function ToolList({ tools }: { tools: TallyStat[] }) {
  const top = [...tools].sort((left, right) => right.n - left.n).slice(0, 6)
  return (
    <div style={{ minWidth: 0 }}>
      <SectionTitle extra={<span style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }}>{tools.length} 种工具</span>}>
        工具调用
      </SectionTitle>
      {top.length === 0
        ? <p style={{ margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }}>该时间范围内没有工具调用</p>
        : top.map(tool => (
          <div key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
            <code style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tool.name}
            </code>
            <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary)', fontVariantNumeric: 'tabular-nums' }}>{tool.n} 次</span>
            <span style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', width: 52, textAlign: 'right' }}>{tool.sessions} 会话</span>
          </div>
        ))}
    </div>
  )
}

function SessionList({ rows }: { rows: PageRow[] }) {
  const top = rows.slice(0, 8)
  return (
    <div style={{ minWidth: 0 }}>
      <SectionTitle extra={<span style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }}>按 Token 排序</span>}>
        会话
      </SectionTitle>
      {top.length === 0
        ? <p style={{ margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }}>该时间范围内没有会话</p>
        : top.map(row => (
          <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
            <span
              title={row.title}
              style={{ flex: 1, minWidth: 0, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {row.title}
            </span>
            <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary)', fontVariantNumeric: 'tabular-nums', width: 62, textAlign: 'right' }}>
              {formatTokens(row.tokens)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', width: 52, textAlign: 'right' }}>
              {row.turns} 轮
            </span>
          </div>
        ))}
    </div>
  )
}

function UsagePage() {
  const [range, setRange] = React.useState<Range>('7d')
  const overview = useOverview(range)
  const summary = overview.summary

  const column: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    paddingTop: 4,
    color: 'var(--dsw-alias-label-primary)',
  }

  return (
    <div style={column}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 650 }}>用量统计</h1>
          <div role="group" aria-label="时间范围" style={{ display: 'inline-flex', gap: 4 }}>
            {RANGES.map(entry => {
              const active = entry.id === range
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRange(entry.id)}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    borderRadius: 'var(--dsw-radius-sm)',
                    border: '1px solid var(--dsw-alias-border-l2)',
                    color: active ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
                    background: active ? 'var(--dsw-specific-sidebar-nav-item-active)' : 'transparent',
                  }}
                >
                  {entry.label}
                </button>
              )
            })}
          </div>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' }}>
          数据来自 <code>dsh-context</code> 的只读接口 <code>api/dsh-context/overview</code>，按 step 发生日归因；每 30 秒自动刷新。
        </p>
      </div>

      {overview.phase === 'loading' && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-tertiary)' }}>正在汇总用量…</p>
      )}

      {overview.phase === 'unavailable' && (
        <div
          style={{
            padding: '14px 16px',
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 'var(--dsw-radius-md)',
            background: 'var(--dsw-alias-bg-layer-2)',
            fontSize: 12,
            lineHeight: 1.8,
          }}
        >
          <strong style={{ display: 'block', marginBottom: 4 }}>暂时拿不到用量数据</strong>
          <span style={{ color: 'var(--dsw-alias-label-secondary)' }}>
            本页读取 dsh-context 的只读接口 <code>api/dsh-context/overview</code>。
            确认 Profile 已安装并启用 <code>dsh-context</code>（重新运行 <code>pnpm dev</code> 会自动注册），且至少完成过一轮对话。
          </span>
        </div>
      )}

      {overview.phase === 'ready' && summary !== null && (
        <>
          {summary.sessions === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }}>
              该时间范围内还没有会话。开一轮对话后这里会自动出现统计数据。
            </p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10 }}>
                <Card
                  label="计费 Token"
                  value={formatTokens(summary.tokens)}
                  hint={`${summary.sessions} 个会话`}
                />
                <Card
                  label="预估成本"
                  value={formatUsd(summary.costUsd)}
                  hint={summary.costSessions > 0 ? `${summary.costSessions} 个会话已计价` : '等待价格表'}
                />
                <Card
                  label="轮次"
                  value={String(summary.turns)}
                  hint={`${summary.toolCalls} 次工具调用`}
                />
                <Card
                  label="缓存命中率"
                  value={summary.cacheHit === null ? '—' : `${summary.cacheHit}%`}
                  hint={`${summary.usageSessions} 个会话有计费数据`}
                />
              </div>

              {!summary.coverage.complete && summary.coverage.total > 0 && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }}>
                  正在后台补齐历史会话的投影（{summary.coverage.covered}/{summary.coverage.total}），数字会继续增长。
                </p>
              )}

              <DailyChart days={overview.days} range={range} />
              <Composition parts={summary.tokenParts} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                <ToolList tools={overview.tools} />
                <SessionList rows={overview.rows} />
              </div>

              <p style={{ margin: 0, fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' }}>
                {overview.updatedAt > 0 ? `更新于 ${formatUpdatedAt(overview.updatedAt)}` : ''}
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function apply(ctx: Context): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: SECTION_ID, order: -5, label: '用量统计' },
    UsagePage,
  ))
}
