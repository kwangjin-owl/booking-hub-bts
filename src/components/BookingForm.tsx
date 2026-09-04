import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { judge } from '../lib/judge'
import { decide, type Booking as DecideBooking } from '../lib/decide'
import AddressSearch from './AddressSearch'

interface BookingFormProps {
  onSuccess?: (newId?: number) => void
}

const SLOTS = [
  { id: 'morning', label: '오전 10-12' },
  { id: 'afternoon1', label: '오후-1 13-15' },
  { id: 'afternoon2', label: '오후-2 15-17' },
]

export default function BookingForm({ onSuccess }: BookingFormProps) {
  const [customer, setCustomer] = useState('')
  const [kind, setKind] = useState('')
  const [form, setForm] = useState('')
  const [memo, setMemo] = useState('')
  const [address, setAddress] = useState('')
  const [date, setDate] = useState('')
  const [slotsWanted, setSlotsWanted] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const judgement = judge({ customer, kind, form, memo, address, date, slotsWanted })
  const slotPriority: Record<string, number> = slotsWanted.reduce<Record<string, number>>(
    (acc, slot) => {
      acc[slot] = (acc[slot] || 0) + 1
      return acc
    },
    { morning: 0, afternoon1: 0, afternoon2: 0 }
  )

  const toggleSlot = (slotId: string) => {
    if (slotsWanted.includes(slotId)) {
      setSlotsWanted(slotsWanted.filter((s) => s !== slotId))
    } else {
      setSlotsWanted([...slotsWanted, slotId])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (judgement.route === 'ask') {
      setError(judgement.message)
      return
    }

    setLoading(true)

    const slotsString = slotsWanted.join(',')
    const service = memo

    const { data, error: insertError } = await supabase
      .from('bookings')
      .insert({
        customer,
        kind,
        form,
        memo,
        address: address || null,
        date,
        slots_wanted: slotsString,
        service,
        decision: 'pending',
        status: 'pending',
        time: '',
        via: 'form',
      })
      .select()

    if (insertError) {
      console.error('예약 추가 실패:', insertError)
      setError(`예약 추가 실패: ${insertError.message}`)
      setLoading(false)
      return
    }

    // 판정 실행
    if (data && data.length > 0) {
      try {
        const autoOn = localStorage.getItem('auto-judge') !== 'false'
        const { data: allBookings } = await supabase.from('bookings').select('*')

        if (allBookings) {
          const newBooking = data[0]
          const decideBooking: DecideBooking = {
            id: newBooking.id,
            kind: newBooking.kind,
            date: newBooking.date,
            slots_wanted: newBooking.slots_wanted,
            decision: newBooking.decision,
            slot_assigned: newBooking.slot_assigned,
            reason: newBooking.reason,
            options: newBooking.options,
            trace: newBooking.trace,
            customer: newBooking.customer,
          }

          const result = decide(decideBooking, allBookings, autoOn)

          await supabase
            .from('bookings')
            .update({
              decision: result.decision,
              slot_assigned: result.slotAssigned || null,
              reason: result.reason,
              options: result.options ? result.options.join(',') : null,
              trace: result.trace.join('\n'),
            })
            .eq('id', newBooking.id)
        }
      } catch (err) {
        console.error('판정 실패:', err)
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
    onSuccess?.(data?.[0]?.id)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] mb-8 relative z-30 font-['Pretendard',sans-serif]">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-[#58cc02] flex items-center justify-center text-white text-xl font-black shadow-[0_3px_0_#46a302]">
          📝
        </div>
        <div>
          <h2 className="text-2xl font-black text-[#042c60]">새로운 예약</h2>
          <p className="text-xs text-[#777777] font-bold">필수 정보를 입력하여 예약을 등록하세요</p>
        </div>
      </div>

      {error && (
        <div className={`mb-6 p-4 border-2 rounded-2xl text-xs font-black ${
          judgement.route === 'ask'
            ? 'bg-[#1cb0f6]/10 border-[#1cb0f6] text-[#1cb0f6]'
            : 'bg-[#ff4b4b]/10 border-[#ff4b4b] text-[#ff4b4b]'
        }`}>
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* 고객사 */}
        <div>
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">고객사 *</label>
          <input
            type="text"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="w-full px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all"
            placeholder="고객사 이름"
          />
        </div>

        {/* 종류 */}
        <div>
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">종류 *</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all"
          >
            <option value="">선택하세요</option>
            <option value="서울">서울</option>
            <option value="경기">경기</option>
            <option value="지방">지방</option>
            <option value="내부">내부</option>
          </select>
        </div>

        {/* 형태 */}
        <div>
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">형태 *</label>
          <select
            value={form}
            onChange={(e) => setForm(e.target.value)}
            className="w-full px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all"
          >
            <option value="">선택하세요</option>
            <option value="외근">외근</option>
            <option value="온라인">온라인</option>
          </select>
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">메모 *</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all"
            placeholder="미팅, 기획 회의 등"
          />
        </div>

        {/* 위치 */}
        <div className="relative z-20">
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">
            위치 {form === '외근' && '*'}
          </label>
          <AddressSearch value={address} onChange={setAddress} onSelect={() => {}} />
        </div>

        {/* 날짜 */}
        <div>
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">날짜 *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all"
          />
        </div>

        {/* 희망 슬롯 */}
        <div>
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-3 tracking-wider">희망 슬롯 *</label>
          <div className="space-y-2">
            {SLOTS.map((slot) => (
              <label key={slot.id} className="flex items-center gap-3 cursor-pointer p-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-xl hover:bg-white transition-all">
                <input
                  type="checkbox"
                  checked={slotsWanted.includes(slot.id)}
                  onChange={() => toggleSlot(slot.id)}
                  className="w-5 h-5"
                />
                <span className="flex-1 font-bold text-[#3c3c3c]">{slot.label}</span>
                {slotPriority[slot.id as keyof typeof slotPriority] > 0 && (
                  <span className="bg-[#58cc02] text-white text-xs font-black px-2 py-1 rounded-full">
                    {slotPriority[slot.id as keyof typeof slotPriority]}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || judgement.route === 'ask'}
        className={`w-full mt-8 font-black py-4 px-6 rounded-2xl transition-all uppercase tracking-wider text-sm shadow-[0_4px_0_#46a302] active:translate-y-[4px] active:shadow-none cursor-pointer ${
          judgement.route === 'book'
            ? 'bg-[#58cc02] hover:bg-[#46a302] text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? '예약 처리 중...' : '예약하기'}
      </button>
    </form>
  )
}
