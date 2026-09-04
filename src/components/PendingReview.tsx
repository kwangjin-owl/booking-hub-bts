import { Fragment, useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { candidatesFor, occupiedExcept } from '../lib/decide'
import { decisionBadge, decisionLabel } from '../lib/decisionMeta'
import {
  SLOTS,
  humanizeSlotText,
  joinSlots,
  joinSlotsForDisplay,
  parseSlots,
  type Slot,
} from '../lib/slots'
import DateField from './DateField'
import { fetchAllBookings, judgeAndSave, judgeMany, readAutoOn } from '../lib/judgeRunner'
import { syncCalendar } from '../lib/calendarSync'
import type { BookingRow } from '../lib/types'

interface PendingReviewProps {
  refreshKey?: number
}

const UNSETTLED = ['pending', 'review', 'rejected', 'asking'] as const

const KINDS = ['서울', '경기', '지방', '내부']

export default function PendingReview({ refreshKey = 0 }: PendingReviewProps) {
  // 전체를 들고 있는다. 판정에 그 날 다른 예약이 필요하기 때문이다.
  const [all, setAll] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [openTrace, setOpenTrace] = useState<Set<number>>(new Set())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<{ kind: string; date: string; slots: Slot[] }>({
    kind: '',
    date: '',
    slots: [],
  })

  const reload = useCallback(async () => {
    try {
      setAll(await fetchAllBookings())
    } catch (err) {
      setMessage({ kind: 'err', text: `조회 실패: ${(err as Error).message}` })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    reload()
  }, [reload, refreshKey])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), message.kind === 'ok' ? 4000 : 8000)
    return () => clearTimeout(t)
  }, [message])

  const unsettled = all
    .filter((b) => UNSETTLED.includes((b.decision ?? 'pending') as (typeof UNSETTLED)[number]))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  /**
   * 실패하면 메시지를 띄운다.
   * 목록은 성공·실패와 무관하게 다시 읽는다 - 캘린더만 실패하고 판정은 저장된 경우가 있어,
   * 여기서 안 읽으면 화면이 옛 상태로 남아 같은 걸 또 누르게 된다.
   */
  const run = async (id: number, work: () => Promise<string>) => {
    setBusyId(id)
    setMessage(null)
    try {
      const text = await work()
      setMessage({ kind: 'ok', text })
    } catch (err) {
      setMessage({ kind: 'err', text: (err as Error).message })
    } finally {
      await reload()
      setBusyId(null)
    }
  }

  const handleJudge = (b: BookingRow) =>
    run(b.id, async () => {
      const fresh = await fetchAllBookings()
      const current = fresh.find((x) => x.id === b.id) ?? b
      const { result, calendarError } = await judgeAndSave(current, fresh, readAutoOn())
      if (calendarError) throw new Error(calendarError)
      return `${b.customer}: ${decisionLabel(result.decision)} - ${result.reason}`
    })

  /**
   * 자동 off 로 대기 중인 예약을 확정한다.
   *
   * 저장된 후보를 그대로 믿지 않는다. 판정한 뒤 시간이 지나 그 칸이 이미 찼을 수 있고,
   * 그대로 넣으면 같은 칸에 둘이 들어간다.
   */
  const handleConfirm = (b: BookingRow) =>
    run(b.id, async () => {
      const fresh = await fetchAllBookings()
      const current = fresh.find((x) => x.id === b.id) ?? b
      const stillFree = candidatesFor(current, occupiedExcept(current, fresh))
      const cand = parseSlots(current.candidate)

      if (cand.length === 0) throw new Error('후보 칸이 없습니다. 먼저 판정하세요.')
      if (!stillFree.some((c) => joinSlots(c) === joinSlots(cand))) {
        throw new Error(
          `${b.customer}: 후보 ${joinSlotsForDisplay(cand)} 가 그 사이에 찼습니다. 다시 판정하세요.`,
        )
      }

      const { error } = await supabase
        .from('bookings')
        .update({
          decision: 'confirmed_human',
          slot_assigned: joinSlots(cand),
          candidate: null,
          reason: `확정 버튼 - 칸 ${joinSlotsForDisplay(cand)}`,
          trace: `${b.trace ?? ''}\n사람이 확정: ${joinSlotsForDisplay(cand)}`.trim(),
        })
        .eq('id', b.id)
      if (error) throw new Error(error.message)

      // 확정됐으니 캘린더에 올린다
      const sync = await syncCalendar({
        ...b,
        decision: 'confirmed_human',
        slot_assigned: joinSlots(cand),
      })
      if (sync.error) throw new Error(sync.error)

      return `${b.customer} 를 ${joinSlotsForDisplay(cand)} 로 확정하고 캘린더에 올렸습니다.`
    })

  /**
   * 검토(동점) 해결. options 에는 고객사 이름 둘이 들어 있다.
   * 이름으로 update 하면 다른 날 같은 고객사까지 바뀌므로, 같은 날짜에서 id 를 찾아 id 로 갱신한다.
   */
  const handlePick = (b: BookingRow, winnerName: string) =>
    run(b.id, async () => {
      const fresh = await fetchAllBookings()

      // 그 날 검토로 묶인 예약 전부가 대상이다. 둘만 놓고 고르는 것이 아니다.
      const group = fresh.filter((x) => x.date === b.date && x.decision === 'review')
      const winner = group.find((x) => x.customer === winnerName)
      if (!winner) throw new Error(`${winnerName} 예약을 찾지 못했습니다. 다시 판정해 주세요.`)

      // 이긴 쪽이 받을 칸. 저장된 값이 아니라 지금 달력을 다시 본다.
      const cand = candidatesFor(winner, occupiedExcept(winner, fresh))[0]
      if (!cand) throw new Error(`${winnerName} 에게 줄 빈 칸이 이미 없습니다. 다시 판정하세요.`)

      const { error: e1 } = await supabase
        .from('bookings')
        .update({
          decision: 'confirmed_human',
          slot_assigned: joinSlots(cand),
          candidate: null,
          options: null,
          reason: `검토에서 선택 - 칸 ${joinSlotsForDisplay(cand)}`,
          trace: `${winner.trace ?? ''}\n사람이 선택: ${winnerName} 에게 ${joinSlotsForDisplay(cand)}`.trim(),
        })
        .eq('id', winner.id)
      if (e1) throw new Error(e1.message)

      const wSync = await syncCalendar({
        ...winner,
        decision: 'confirmed_human',
        slot_assigned: joinSlots(cand),
      })

      // 밀린 쪽은 대기로 돌려놓고 다시 판정한다.
      // 이긴 쪽이 자리를 잡고 나면 남은 칸으로 들어갈 수 있는 예약이 있다.
      const losers = group.filter((x) => x.id !== winner.id)
      for (const l of losers) {
        await supabase
          .from('bookings')
          .update({
            decision: 'pending',
            slot_assigned: null,
            candidate: null,
            options: null,
            reason: `${winnerName} 쪽으로 정해져 다시 판정 대상`,
          })
          .eq('id', l.id)
        // 확정돼 캘린더에 올라가 있었다면 지운다
        await syncCalendar({ ...l, decision: 'pending', slot_assigned: null })
      }

      const { calendarErrors } = await judgeMany(
        losers.map((l) => l.id),
        readAutoOn(),
      )

      const errors = [wSync.error, ...calendarErrors].filter(Boolean)
      if (errors.length > 0) throw new Error(errors.join(' / '))

      return `${winnerName} 로 확정하고, 나머지 ${losers.length}건을 다시 판정했습니다.`
    })

  const startEdit = (b: BookingRow) => {
    setEditingId(b.id)
    setDraft({ kind: b.kind ?? '', date: b.date, slots: parseSlots(b.slots_wanted) })
  }

  /** 질문(빈 칸) 상태에 답을 채워 넣고 바로 다시 판정한다. */
  const saveEdit = (b: BookingRow) =>
    run(b.id, async () => {
      const { error } = await supabase
        .from('bookings')
        .update({ kind: draft.kind || null, date: draft.date, slots_wanted: joinSlots(draft.slots) })
        .eq('id', b.id)
      if (error) throw new Error(error.message)

      const fresh = await fetchAllBookings()
      const current = fresh.find((x) => x.id === b.id)
      if (!current) throw new Error('저장한 예약을 다시 찾지 못했습니다.')
      const { result, calendarError } = await judgeAndSave(current, fresh, readAutoOn())
      setEditingId(null)
      if (calendarError) throw new Error(calendarError)
      return `${b.customer}: ${decisionLabel(result.decision)} - ${result.reason}`
    })

  const toggleTrace = (id: number) =>
    setOpenTrace((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (loading) {
    return <div className="text-center py-12 text-[#777777] font-bold">로딩 중...</div>
  }

  // 검토는 날짜별로 한 덩어리다.
  // 같은 충돌인데 예약마다 한 줄씩 나오면 같은 걸 다섯 번 처리하는 것처럼 보인다.
  const reviewByDate = new Map<string, BookingRow[]>()
  for (const b of unsettled) {
    if (b.decision !== 'review') continue
    const list = reviewByDate.get(b.date) ?? []
    list.push(b)
    reviewByDate.set(b.date, list)
  }
  const reviewGroups = [...reviewByDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const others = unsettled.filter((b) => b.decision !== 'review')

  /** 예약 한 건의 판정 과정 접이식 */
  const traceBlock = (b: BookingRow) => {
    const lines = (b.trace ?? '').split('\n').filter(Boolean)
    return (
      <>
        <button
          onClick={() => toggleTrace(b.id)}
          className="text-xs font-bold text-[#1cb0f6] hover:underline cursor-pointer"
        >
          {openTrace.has(b.id) ? '▼ 과정 닫기' : '▶ 과정 보기'}
        </button>
        {openTrace.has(b.id) && (
          <div className="mt-1 p-2 bg-[#f7f7f7] rounded-xl">
            {lines.length === 0 ? (
              <p className="text-xs font-bold text-[#afafaf]">아직 판정하지 않았습니다</p>
            ) : (
              <ol className="list-decimal ml-5 text-xs font-bold text-[#555555] space-y-1">
                {lines.map((line, i) => (
                  <li key={i}>{humanizeSlotText(line)}</li>
                ))}
              </ol>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="space-y-5 font-['Pretendard',sans-serif]">
      {message && (
        <div
          className={`p-4 border-2 rounded-2xl text-xs font-black ${
            message.kind === 'ok'
              ? 'bg-[#d7ffb8]/40 border-[#58cc02] text-[#58a700]'
              : 'bg-[#ff4b4b]/10 border-[#ff4b4b] text-[#ff4b4b]'
          }`}
        >
          {message.text}
        </div>
      )}

      {unsettled.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border-2 border-[#e5e5e5] text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-[#777777] font-bold">미확정 예약이 없습니다</p>
        </div>
      )}

      {/* ---------- 검토: 날짜별 충돌 한 덩어리 ---------- */}
      {reviewGroups.map(([date, group]) => (
        <div
          key={date}
          className="bg-[#fff8e6] border-2 border-[#ffc800] rounded-2xl shadow-[0_4px_0_#e0b000] overflow-hidden"
        >
          <div className="px-5 py-4 border-b-2 border-[#ffc800]/40">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black px-3 py-1 rounded-full bg-[#ffc800] text-[#042c60]">
                검토
              </span>
              <h3 className="font-black text-[#042c60]">{date} · 칸이 겹칩니다</h3>
              <span className="text-xs font-bold text-[#8a6d00]">{group.length}건 경합</span>
            </div>
            <p className="text-xs font-bold text-[#8a6d00] mt-1.5">
              모두 물러설 곳이 없어 자동으로 정하지 않았습니다. 한 곳을 고르면 나머지는 다시
              판정되어, 남은 칸에 들어갈 수 있는 예약은 자동으로 자리를 잡습니다.
            </p>
          </div>

          <div className="divide-y-2 divide-[#ffc800]/30">
            {group.map((b) => {
              const isBusy = busyId === b.id
              return (
                <div key={b.id} className="px-5 py-3 bg-white/60">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-black text-[#042c60]">{b.customer}</p>
                      <p className="text-xs font-bold text-[#777777] mt-0.5">
                        {b.kind ?? '종류 없음'} · {b.form ?? '-'} · 희망{' '}
                        {parseSlots(b.slots_wanted).join(' > ') || '없음'}
                        {b.kind === '지방' && ' (하루 전체 필요)'}
                      </p>
                      <div className="mt-1.5">{traceBlock(b)}</div>
                    </div>

                    <button
                      onClick={() => handlePick(b, b.customer)}
                      disabled={isBusy}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-[#ffc800] text-[#042c60] hover:bg-[#e0b000] shadow-[0_2px_0_#b39300] active:translate-y-[2px] active:shadow-none cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {isBusy ? '처리 중...' : '이 쪽으로 확정'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* ---------- 나머지: 대기 · 기각 · 질문 ---------- */}
      {others.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5] overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[12%]" />
              <col className="w-[32%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-[#f7f7f7] border-b-2 border-[#e5e5e5] text-xs font-black uppercase tracking-wider text-[#777777]">
              <tr>
                <th className="px-4 py-3 text-left">예약</th>
                <th className="px-4 py-3 text-left">판정</th>
                <th className="px-4 py-3 text-left">이유</th>
                <th className="px-4 py-3 text-right">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#f0f0f0]">
              {others.map((b) => {
                const isBusy = busyId === b.id
                const isEditing = editingId === b.id
                const decision = b.decision ?? 'pending'
                const optionNames = (b.options ?? '')
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean)

                return (
                  <Fragment key={b.id}>
                    <tr className="align-top">
                      <td className="px-4 py-4">
                        <p className="font-black text-[#042c60]">{b.customer}</p>
                        <p className="text-xs font-bold text-[#777777] mt-0.5">
                          {b.date} · {b.kind ?? '종류 없음'} · {b.form ?? '-'}
                        </p>
                        <p className="text-xs font-bold text-[#555555] mt-0.5">
                          희망: {parseSlots(b.slots_wanted).join(' > ') || '없음'}
                        </p>
                        {b.candidate && decision === 'pending' && (
                          <p className="text-xs font-black text-[#58a700] mt-0.5">
                            후보: {joinSlotsForDisplay(parseSlots(b.candidate))}
                          </p>
                        )}

                        {isEditing && (
                          <div className="mt-3 p-3 bg-[#e5f4ff]/50 border-2 border-[#1cb0f6] rounded-xl space-y-2">
                            <select
                              value={draft.kind}
                              onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs font-bold border-2 border-[#e5e5e5] rounded-lg bg-white"
                            >
                              <option value="">종류 선택</option>
                              {KINDS.map((k) => (
                                <option key={k} value={k}>
                                  {k}
                                </option>
                              ))}
                            </select>
                            <DateField
                              value={draft.date}
                              onChange={(d) => setDraft({ ...draft, date: d })}
                              className="w-full px-2 py-1.5 text-xs font-bold border-2 border-[#e5e5e5] rounded-lg bg-white"
                            />
                            <div className="flex gap-3 flex-wrap">
                              {SLOTS.map((sl) => {
                                const order = draft.slots.indexOf(sl) + 1
                                return (
                                  <label
                                    key={sl}
                                    className="flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      className="accent-[#58cc02]"
                                      checked={order > 0}
                                      onChange={() =>
                                        setDraft({
                                          ...draft,
                                          slots:
                                            order > 0
                                              ? draft.slots.filter((x) => x !== sl)
                                              : [...draft.slots, sl],
                                        })
                                      }
                                    />
                                    {sl}
                                    {order > 0 && <span className="text-[#58a700]">({order})</span>}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        <div className="mt-2">{traceBlock(b)}</div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-black px-3 py-1 rounded-full ${decisionBadge(decision)}`}
                        >
                          {decisionLabel(decision)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-xs font-bold text-[#555555]">
                        <p>
                          {b.reason ? (
                            humanizeSlotText(b.reason)
                          ) : (
                            <span className="text-[#afafaf]">아직 판정 전</span>
                          )}
                        </p>
                        {decision === 'rejected' && (
                          <p className="text-[#777777] mt-1">
                            그 날 빈 칸: {optionNames.length > 0 ? optionNames.join(', ') : '없음'}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => handleJudge(b)}
                            disabled={isBusy || isEditing}
                            className="w-24 py-2 rounded-xl text-xs font-black bg-white border-2 border-[#3c3c3c] text-[#3c3c3c] hover:bg-[#f7f7f7] cursor-pointer disabled:opacity-50"
                          >
                            {isBusy ? '처리 중' : '판정'}
                          </button>

                          {decision === 'pending' && b.candidate && (
                            <button
                              onClick={() => handleConfirm(b)}
                              disabled={isBusy}
                              className="w-24 py-2 rounded-xl text-xs font-black bg-[#58cc02] text-white shadow-[0_2px_0_#46a302] active:translate-y-[2px] active:shadow-none cursor-pointer disabled:opacity-50"
                            >
                              확정
                            </button>
                          )}

                          {decision === 'asking' &&
                            (isEditing ? (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => saveEdit(b)}
                                  disabled={isBusy}
                                  className="px-3 py-2 rounded-xl text-xs font-black bg-[#1cb0f6] text-white cursor-pointer disabled:opacity-50"
                                >
                                  저장 후 판정
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-3 py-2 rounded-xl text-xs font-black bg-white border-2 border-[#e5e5e5] text-[#777777] cursor-pointer"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEdit(b)}
                                disabled={isBusy}
                                className="w-24 py-2 rounded-xl text-xs font-black bg-[#1cb0f6] text-white cursor-pointer disabled:opacity-50"
                              >
                                답 채우기
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
