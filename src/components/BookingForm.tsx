import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { judge } from '../lib/judge'
import { isAdminEmail } from '../lib/auth'
import { SLOTS, SLOT_LABELS, joinSlots, type Slot } from '../lib/slots'
import { judgeAndSave, fetchAllBookings, readAutoOn } from '../lib/judgeRunner'
import type { BookingRow } from '../lib/types'

interface BookingFormProps {
  onSuccess?: (newId?: number) => void
}

const KINDS = ['서울', '경기', '지방', '내부'] as const
const FORMS = ['외근', '온라인'] as const

const inputClass =
  'w-full px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all'
const labelClass = 'block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider'

export default function BookingForm({ onSuccess }: BookingFormProps) {
  const [customer, setCustomer] = useState('')
  const [kind, setKind] = useState('')
  const [form, setForm] = useState('')
  const [memo, setMemo] = useState('')
  const [address, setAddress] = useState('')
  const [date, setDate] = useState('')
  // 체크한 순서가 곧 우선순위다. 배열 순서를 그대로 저장한다.
  const [slotsWanted, setSlotsWanted] = useState<Slot[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const judgement = judge({ customer, kind, form, memo, address, date, slotsWanted })

  const toggleSlot = (slot: Slot) => {
    setSlotsWanted((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (judgement.route === 'ask') return

    setLoading(true)

    // RLS 'insert own' 이 user_id = auth.uid() 를 요구한다. 빼면 저장이 거절된다.
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData?.session?.user
    if (!user) {
      setError('로그인이 풀렸습니다. 다시 로그인해 주세요.')
      setLoading(false)
      return
    }

    const trimmedMemo = memo.trim()
    const { data, error: insertError } = await supabase
      .from('bookings')
      .insert({
        customer: customer.trim(),
        kind,
        form,
        memo: trimmedMemo || null,
        address: address.trim() || null,
        date,
        slots_wanted: joinSlots(slotsWanted),
        // 시간 칸은 없앴다. not null 이라 빈 문자열을 넣는다.
        time: '',
        // 예약 목록의 '서비스' 열이 비지 않도록 메모를 같이 넣는다.
        service: trimmedMemo || `${kind} ${form}`,
        decision: 'pending',
        status: 'pending',
        via: 'form',
        user_id: user.id,
      })
      .select()
      .single()

    if (insertError || !data) {
      setError(`예약 추가 실패: ${insertError?.message ?? '알 수 없는 오류'}`)
      setLoading(false)
      return
    }

    const newRow = data as BookingRow

    // 판정 결과 저장은 RLS 상 관리자만 된다.
    // 일반 사용자의 예약은 pending 으로 두고, 관리자가 대시보드의 '전부 판정' 으로 처리한다.
    if (isAdminEmail(user.email)) {
      try {
        const all = await fetchAllBookings()
        await judgeAndSave(newRow, all, readAutoOn())
      } catch (err) {
        // 예약 자체는 들어갔으니 실패해도 화면을 막지 않는다. 미확정 관리에서 다시 판정하면 된다.
        console.error('판정 저장 실패:', err)
      }
    }

    setCustomer('')
    setKind('')
    setForm('')
    setMemo('')
    setAddress('')
    setDate('')
    setSlotsWanted([])
    setLoading(false)
    onSuccess?.(newRow.id)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-8 rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] mb-8 font-['Pretendard',sans-serif]"
    >
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#58cc02] flex items-center justify-center text-white text-xl font-black shadow-[0_3px_0_#46a302]">
            📝
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#042c60]">새로운 예약</h2>
            <p className="text-xs text-[#777777] font-bold">희망 슬롯은 체크한 순서가 우선순위입니다</p>
          </div>
        </div>

        {/* judge 결과 배지. 비어 있으면 파랑, 다 차면 초록 */}
        <span
          className={`text-xs font-black px-3 py-1.5 rounded-full border-2 ${
            judgement.badgeColor === 'green'
              ? 'bg-[#d7ffb8] border-[#58cc02] text-[#58a700]'
              : 'bg-[#e5f4ff] border-[#1cb0f6] text-[#1cb0f6]'
          }`}
        >
          {judgement.message}
        </span>
      </div>

      {error && (
        <div className="mb-6 p-4 border-2 rounded-2xl text-xs font-black bg-[#ff4b4b]/10 border-[#ff4b4b] text-[#ff4b4b]">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className={labelClass}>고객사 *</label>
          <input
            type="text"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className={inputClass}
            placeholder="고객사 이름"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>종류 *</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
              <option value="">선택하세요</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>형태 *</label>
            <select value={form} onChange={(e) => setForm(e.target.value)} className={inputClass}>
              <option value="">선택하세요</option>
              {FORMS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>메모</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className={inputClass}
            placeholder="미팅, 기획 회의 등 한 줄"
          />
        </div>

        <div>
          <label className={labelClass}>위치 {form === '외근' ? '*' : '(온라인이면 비워도 됩니다)'}</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
            placeholder={form === '온라인' ? '온라인 - 비워도 됩니다' : '방문할 주소'}
          />
        </div>

        <div>
          <label className={labelClass}>날짜 *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>희망 슬롯 * (체크한 순서 = 우선순위)</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {SLOTS.map((slot) => {
              const order = slotsWanted.indexOf(slot) + 1
              const checked = order > 0
              return (
                <label
                  key={slot}
                  className={`flex items-center gap-3 cursor-pointer p-3 border-2 rounded-xl transition-all ${
                    checked
                      ? 'bg-[#d7ffb8]/40 border-[#58cc02]'
                      : 'bg-[#f7f7f7] border-[#e5e5e5] hover:bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSlot(slot)}
                    className="w-5 h-5 accent-[#58cc02]"
                  />
                  <span className="flex-1 font-bold text-[#3c3c3c]">{SLOT_LABELS[slot]}</span>
                  {checked && (
                    <span className="w-6 h-6 flex items-center justify-center bg-[#58cc02] text-white text-xs font-black rounded-full">
                      {order}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || judgement.route === 'ask'}
        className={`w-full mt-8 font-black py-4 px-6 rounded-2xl transition-all uppercase tracking-wider text-sm ${
          judgement.route === 'book' && !loading
            ? 'bg-[#58cc02] hover:bg-[#46a302] text-white shadow-[0_4px_0_#46a302] active:translate-y-[4px] active:shadow-none cursor-pointer'
            : 'bg-[#e5e5e5] text-[#afafaf] cursor-not-allowed'
        }`}
      >
        {loading ? '예약 처리 중...' : '예약하기'}
      </button>
    </form>
  )
}
