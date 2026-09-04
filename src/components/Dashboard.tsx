import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { isDecision } from '../lib/decisionMeta'
import {
  fetchAllBookings,
  findSlotOverlaps,
  judgeAllPending,
  judgeMany,
  readAutoOn,
  writeAutoOn,
} from '../lib/judgeRunner'
import { syncCalendar } from '../lib/calendarSync'
import { supabase } from '../supabaseClient'
import type { BookingRow, Decision } from '../lib/types'
import AutoJudgeControl from './AutoJudgeControl'
import WorkflowGraph, { type GraphNode } from './WorkflowGraph'
import DecisionLog, { type LogEntry } from './DecisionLog'
import StatusBoard from './StatusBoard'
import WeatherStrip from './WeatherStrip'

interface DashboardProps {
  refreshKey?: number
}

const MAX_LOG = 12

/**
 * 판정 하나가 지나간 화살표들.
 * 화살표 이름은 WorkflowGraph 의 edge id 와 같다 ("from>to").
 */
function pathFor(prev: Decision | null | undefined, next: Decision): string[] {
  if (prev === 'review' && next === 'confirmed_human') return ['review>confirmed_human']
  if (prev === 'asking' && next === 'pending') return ['asking>pending']
  if (prev === 'confirmed_human' && next === 'pending') return ['confirmed_human>pending']
  if (next === 'pending' && prev !== 'pending') return []
  // 그 밖에는 전부 "대기 -> 판정 -> 결과" 다. 자동 off 로 후보만 받은 것은 판정 -> 대기.
  return ['pending>judge', `judge>${next}`]
}

/**
 * 관리자 대시보드. 데이터와 realtime 채널을 여기 한 곳에서만 들고
 * 흐름도·판정 로그·상태 보드는 받은 것을 그리기만 한다.
 * (전에는 셋이 각자 채널을 열고 각자 전체를 조회해 세 번씩 돌았다)
 */
export default function Dashboard({ refreshKey = 0 }: DashboardProps) {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [autoOn, setAutoOn] = useState(readAutoOn)
  const [judging, setJudging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [activeEdges, setActiveEdges] = useState<string[]>([])
  // 같은 화살표를 연달아 지나도 굵어지는 애니메이션이 다시 돌게 하는 신호
  const [pulseKey, setPulseKey] = useState(0)

  // realtime UPDATE 에 old 값이 안 실려 올 때를 대비해 마지막으로 본 값을 기억한다.
  const knownRef = useRef<Map<number, { decision: Decision | null; trace: string | null }>>(new Map())

  const remember = useCallback((rows: readonly BookingRow[]) => {
    const m = new Map<number, { decision: Decision | null; trace: string | null }>()
    for (const r of rows) m.set(r.id, { decision: r.decision, trace: r.trace })
    knownRef.current = m
  }, [])

  const reload = useCallback(async () => {
    try {
      const rows = await fetchAllBookings()
      setBookings(rows)
      remember(rows)
    } catch (err) {
      setNotice(`조회 실패: ${(err as Error).message}`)
    }
  }, [remember])

  useEffect(() => {
    reload()
  }, [reload, refreshKey])

  useEffect(() => {
    writeAutoOn(autoOn)
  }, [autoOn])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  // 한 채널로 INSERT / UPDATE / DELETE 를 다 듣는다.
  useEffect(() => {
    const handle = (payload: RealtimePostgresChangesPayload<BookingRow>) => {
      if (payload.eventType === 'INSERT') {
        const row = payload.new
        setBookings((prev) => (prev.some((b) => b.id === row.id) ? prev : [...prev, row]))
        knownRef.current.set(row.id, { decision: row.decision, trace: row.trace })
        setActiveEdges(['intake>pending'])
        setPulseKey((k) => k + 1)
        return
      }

      if (payload.eventType === 'DELETE') {
        const id = (payload.old as Partial<BookingRow>).id
        if (id == null) return
        setBookings((prev) => prev.filter((b) => b.id !== id))
        knownRef.current.delete(id)
        return
      }

      const row = payload.new
      const before = knownRef.current.get(row.id)
      const oldDecision =
        (payload.old as Partial<BookingRow>).decision ?? before?.decision ?? null
      const oldTrace = (payload.old as Partial<BookingRow>).trace ?? before?.trace ?? null

      setBookings((prev) => prev.map((b) => (b.id === row.id ? row : b)))
      knownRef.current.set(row.id, { decision: row.decision, trace: row.trace })

      const changed = row.decision !== oldDecision || row.trace !== oldTrace
      if (!changed || !isDecision(row.decision)) return

      const next = row.decision
      const edges = pathFor(isDecision(oldDecision) ? oldDecision : null, next)
      if (edges.length) {
        setActiveEdges(edges)
        setPulseKey((k) => k + 1)
      }

      setLog((prev) =>
        [
          {
            key: `${row.id}-${Date.now()}`,
            at: Date.now(),
            customer: row.customer,
            decision: next,
            reason: row.reason ?? '',
            traceLines: (row.trace ?? '').split('\n').filter(Boolean),
          },
          ...prev,
        ].slice(0, MAX_LOG),
      )
    }

    const channel = supabase
      .channel('bookings-board')
      .on<BookingRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        handle,
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setNotice('실시간 연결이 끊겼습니다. db/05_slots.sql 의 realtime 등록을 확인하세요.')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  /**
   * 같은 칸에 둘 이상 확정된 것을 푼다.
   * 먼저 접수한 쪽이 자리를 지키고, 나중 것은 대기로 돌려 다시 판정한다.
   */
  const handleFixOverlaps = async () => {
    setJudging(true)
    setNotice(null)
    try {
      const overlaps = findSlotOverlaps(bookings)
      // 한 예약이 여러 칸에서 겹칠 수 있으므로 id 를 모아 한 번씩만 처리한다
      const losers = new Map<number, BookingRow>()
      for (const o of overlaps) {
        for (const b of o.bookings.slice(1)) losers.set(b.id, b)
      }

      for (const b of losers.values()) {
        await supabase
          .from('bookings')
          .update({
            decision: 'pending',
            slot_assigned: null,
            candidate: null,
            reason: '같은 칸에 겹쳐 대기로 되돌림',
          })
          .eq('id', b.id)
        await syncCalendar({ ...b, decision: 'pending', slot_assigned: null })
      }

      await judgeMany([...losers.keys()], autoOn)
      setNotice(`겹친 ${losers.size}건을 대기로 되돌리고 다시 판정했습니다.`)
      await reload()
    } catch (err) {
      setNotice(`겹침 정리 실패: ${(err as Error).message}`)
    } finally {
      setJudging(false)
    }
  }

  const handleJudgeAll = async () => {
    setJudging(true)
    setNotice(null)
    try {
      const { judged, calendarErrors } = await judgeAllPending(autoOn)
      if (judged === 0) {
        setNotice('다시 판정할 예약이 없습니다.')
      } else if (calendarErrors.length > 0) {
        // 판정은 됐는데 캘린더만 실패한 경우. 어느 건이 실패했는지 그대로 보여준다.
        setNotice(`${judged}건 판정 · 캘린더 ${calendarErrors.length}건 실패 — ${calendarErrors[0]}`)
      } else {
        setNotice(`${judged}건을 다시 판정했습니다. 확정된 건은 구글 캘린더에 올라갔습니다.`)
      }
      // realtime 이 꺼져 있어도 화면은 맞아야 한다.
      await reload()
    } catch (err) {
      setNotice(`전부 판정 실패: ${(err as Error).message}`)
    } finally {
      setJudging(false)
    }
  }

  const counts: Record<GraphNode, number> = {
    intake: bookings.length,
    pending: 0,
    judge: 0,
    confirmed_auto: 0,
    confirmed_human: 0,
    review: 0,
    rejected: 0,
    asking: 0,
  }
  for (const b of bookings) {
    const d = b.decision ?? 'pending'
    if (isDecision(d)) counts[d] += 1
  }

  // 오늘 이후로 잡힌 예약 중 아직 사람 손이 필요한 것
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const needsAttention = bookings.filter(
    (b) =>
      b.date >= todayStr &&
      (b.decision === 'review' || b.decision === 'rejected' || b.decision === 'asking'),
  ).length

  const overlaps = findSlotOverlaps(bookings)

  const summary: { label: string; n: number; cls: string }[] = [
    { label: '전체', n: bookings.length, cls: 'bg-[#3c3c3c] text-white' },
    { label: '대기', n: counts.pending, cls: 'bg-[#e5e5e5] text-[#3c3c3c]' },
    {
      label: '확정',
      n: counts.confirmed_auto + counts.confirmed_human,
      cls: 'bg-[#58cc02] text-white',
    },
    { label: '검토', n: counts.review, cls: 'bg-[#ffc800] text-[#042c60]' },
    { label: '기각', n: counts.rejected, cls: 'bg-[#ff4b4b] text-white' },
    { label: '질문', n: counts.asking, cls: 'bg-[#1cb0f6] text-white' },
  ]

  return (
    <div className="space-y-5 font-['Pretendard',sans-serif]">
      <AutoJudgeControl
        autoOn={autoOn}
        onToggle={setAutoOn}
        onJudgeAll={handleJudgeAll}
        judging={judging}
      />

      {notice && (
        <div className="p-3 bg-[#fff8e6] border-2 border-[#ffc800] rounded-2xl text-xs font-black text-[#042c60]">
          {notice}
        </div>
      )}

      {/* 숫자를 맨 위에 한 줄로. 그래프까지 안 내려가도 현황이 보인다. */}
      <div className="flex flex-wrap items-center gap-2">
        {summary.map((s) => (
          <span
            key={s.label}
            className={`px-3 py-1.5 rounded-xl text-xs font-black tabular-nums ${s.cls}`}
          >
            {s.label} {s.n}
          </span>
        ))}
        <span
          className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-black border-2 ${
            needsAttention > 0
              ? 'bg-white border-[#ff4b4b] text-[#ff4b4b]'
              : 'bg-white border-[#e5e5e5] text-[#afafaf]'
          }`}
        >
          {needsAttention > 0 ? `사람이 볼 것 ${needsAttention}건` : '사람이 볼 것 없음'}
        </span>
      </div>

      {/* 같은 칸에 둘이 들어간 것은 조용히 두면 안 된다. 맨 위에 드러낸다. */}
      {overlaps.length > 0 && (
        <div className="p-4 bg-[#ff4b4b]/10 border-2 border-[#ff4b4b] rounded-2xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-black text-[#ff4b4b]">
                ⚠ 같은 칸에 확정이 겹쳤습니다 ({overlaps.length}곳)
              </p>
              <ul className="mt-2 space-y-1">
                {overlaps.map((o) => (
                  <li key={`${o.date}-${o.slot}`} className="text-xs font-bold text-[#3c3c3c]">
                    {o.date} · {o.slot} — {o.bookings.map((b) => b.customer).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={handleFixOverlaps}
              disabled={judging}
              className="px-4 py-2 rounded-xl text-xs font-black bg-[#ff4b4b] text-white shadow-[0_2px_0_#c63030] active:translate-y-[2px] active:shadow-none cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              먼저 접수한 쪽만 남기고 다시 판정
            </button>
          </div>
        </div>
      )}

      {/* 지금 날씨 + 다가오는 확정 외근의 예보 */}
      <WeatherStrip bookings={bookings} />

      {/* 넓은 화면에서는 흐름도와 로그를 나란히 둔다. 상태 보드가 스크롤 없이 보이게 하려는 것이다. */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-5 items-start">
        <WorkflowGraph counts={counts} activeEdges={activeEdges} pulseKey={pulseKey} />
        <DecisionLog entries={log} />
      </div>

      <StatusBoard bookings={bookings} />
    </div>
  )
}
