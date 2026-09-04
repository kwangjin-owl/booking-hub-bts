import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { candidatesFor, occupiedExcept } from '../lib/decide'
import { decisionBadge, decisionLabel } from '../lib/decisionMeta'
import { SLOTS, joinSlots, joinSlotsForDisplay, parseSlots, type Slot } from '../lib/slots'
import { fetchAllBookings, judgeAndSave, readAutoOn } from '../lib/judgeRunner'
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

  /** 실패하면 메시지를 띄우고, 성공하면 목록을 다시 읽는다. */
  const run = async (id: number, work: () => Promise<string>) => {
    setBusyId(id)
    setMessage(null)
    try {
      const text = await work()
      await reload()
      setMessage({ kind: 'ok', text })
    } catch (err) {
      setMessage({ kind: 'err', text: (err as Error).message })
    } finally {
      setBusyId(null)
    }
  }

  const handleJudge = (b: BookingRow) =>
    run(b.id, async () => {
      const fresh = await fetchAllBookings()
      const current = fresh.find((x) => x.id === b.id) ?? b
      const { result } = await judgeAndSave(current, fresh, readAutoOn())
      return `${b.customer}: ${decisionLabel(result.decision)} - ${result.reason}`
    })

  /** 자동 off 로 대기 중인 예약. 판정이 남긴 후보 칸을 그대로 확정한다. */
  const handleConfirm = (b: BookingRow) =>
    run(b.id, async () => {
      const cand = parseSlots(b.candidate)
      if (cand.length === 0) throw new Error('후보 칸이 없습니다. 먼저 판정하세요.')
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
      return `${b.customer} 를 ${joinSlotsForDisplay(cand)} 로 확정했습니다.`
    })

  /**
   * 검토(동점) 해결. options 에는 고객사 이름 둘이 들어 있다.
   * 이름으로 update 하면 다른 날 같은 고객사까지 바뀌므로, 같은 날짜에서 id 를 찾아 id 로 갱신한다.
   */
  const handlePick = (b: BookingRow, winnerName: string) =>
    run(b.id, async () => {
      const fresh = await fetchAllBookings()
      const names = (b.options ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const loserName = names.find((n) => n !== winnerName)

      const findOnDay = (name: string) =>
        name === b.customer
          ? fresh.find((x) => x.id === b.id)
          : fresh.find(
              (x) =>
                x.id !== b.id &&
                x.date === b.date &&
                x.customer === name &&
                (x.decision === 'pending' || x.decision === 'review'),
            )

      const winner = findOnDay(winnerName)
      if (!winner) throw new Error(`${winnerName} 예약을 같은 날짜에서 찾지 못했습니다.`)
      const loser = loserName ? findOnDay(loserName) : undefined

      // 이긴 쪽이 받을 칸. 지금 달력 기준 첫 후보다.
      const occ = occupiedExcept(winner, fresh)
      const cand = candidatesFor(winner, occ)[0]
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

      if (loser) {
        const { error: e2 } = await supabase
          .from('bookings')
          .update({
            decision: 'pending',
            slot_assigned: null,
            candidate: null,
            options: null,
            reason: `검토에서 밀림 - 다시 판정 필요`,
            trace: `${loser.trace ?? ''}\n사람이 선택: ${winnerName} 쪽 - 대기로 되돌림`.trim(),
          })
          .eq('id', loser.id)
        if (e2) throw new Error(e2.message)
      }
      return `${winnerName} 로 확정했습니다. ${loserName ?? ''} 는 대기로 돌아갔습니다.`
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
      const { result } = await judgeAndSave(current, fresh, readAutoOn())
      setEditingId(null)
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

  return (
    <div className="space-y-4 font-['Pretendard',sans-serif]">
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

      {unsettled.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border-2 border-[#e5e5e5] text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-[#777777] font-bold">미확정 예약이 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f7f7] border-b-2 border-[#e5e5e5] text-xs font-black uppercase tracking-wider text-[#777777]">
              <tr>
                <th className="px-4 py-3 text-left">예약</th>
                <th className="px-4 py-3 text-left">판정</th>
                <th className="px-4 py-3 text-left">reason</th>
                <th className="px-4 py-3 text-right">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#f0f0f0]">
              {unsettled.map((b) => {
                const isBusy = busyId === b.id
                const isEditing = editingId === b.id
                const decision = b.decision ?? 'pending'
                const traceLines = (b.trace ?? '').split('\n').filter(Boolean)
                const optionNames = (b.options ?? '').split(',').map((s) => s.trim()).filter(Boolean)

                return (
                  <tr key={b.id} className="align-top">
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
                          <input
                            type="date"
                            value={draft.date}
                            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs font-bold border-2 border-[#e5e5e5] rounded-lg bg-white"
                          />
                          <div className="flex gap-3 flex-wrap">
                            {SLOTS.map((s) => {
                              const order = draft.slots.indexOf(s) + 1
                              return (
                                <label key={s} className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="accent-[#58cc02]"
                                    checked={order > 0}
                                    onChange={() =>
                                      setDraft({
                                        ...draft,
                                        slots:
                                          order > 0
                                            ? draft.slots.filter((x) => x !== s)
                                            : [...draft.slots, s],
                                      })
                                    }
                                  />
                                  {s}
                                  {order > 0 && <span className="text-[#58a700]">({order})</span>}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => toggleTrace(b.id)}
                        className="mt-2 text-xs font-bold text-[#1cb0f6] hover:underline cursor-pointer"
                      >
                        {openTrace.has(b.id) ? '▼ 과정 닫기' : '▶ 과정 보기'}
                      </button>
                      {openTrace.has(b.id) && (
                        <ol className="mt-1 ml-4 list-decimal text-xs font-bold text-[#555555] space-y-0.5">
                          {traceLines.length === 0 ? (
                            <li className="list-none -ml-4 text-[#afafaf]">아직 판정하지 않았습니다</li>
                          ) : (
                            traceLines.map((line, i) => <li key={i}>{line}</li>)
                          )}
                        </ol>
                      )}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`text-xs font-black px-3 py-1 rounded-full ${decisionBadge(decision)}`}>
                        {decisionLabel(decision)}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs font-bold text-[#555555]">
                      <p>{b.reason ?? <span className="text-[#afafaf]">아직 판정 전</span>}</p>
                      {decision === 'rejected' && optionNames.length > 0 && (
                        <p className="text-[#777777] mt-1">그 날 빈 칸: {optionNames.join(', ')}</p>
                      )}
                      {decision === 'review' && optionNames.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {optionNames.map((name) => (
                            <li key={name} className="flex items-center gap-2">
                              <span className="text-[#042c60]">{name}</span>
                              <button
                                onClick={() => handlePick(b, name)}
                                disabled={isBusy}
                                className="px-2 py-1 rounded-lg text-[11px] font-black bg-[#ffc800] text-[#042c60] hover:bg-[#e0b000] cursor-pointer disabled:opacity-50"
                              >
                                이 쪽으로 확정
                              </button>
                            </li>
                          ))}
                        </ul>
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
