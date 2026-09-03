import { useState } from 'react'
import { supabase } from '../supabaseClient'
import LocationPicker from './LocationPicker'
import TimeSelect from './TimeSelect'

interface BookingFormProps {
  /** 방금 만든 예약 id 를 넘겨, 목록에서 그 줄을 강조할 수 있게 한다. */
  onSuccess?: (newId?: number) => void
}

export default function BookingForm({ onSuccess }: BookingFormProps) {
  const [customer, setCustomer] = useState('')
  const [service, setService] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 필수 칸 검증
    if (!customer || !service || !date || !time) {
      setError('모든 필수 칸을 입력해주세요')
      return
    }

    setLoading(true)

    // RLS 의 insert 정책이 user_id = auth.uid() 를 요구한다.
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id

    if (!userId) {
      setError('로그인이 만료됐습니다. 다시 로그인해 주세요.')
      setLoading(false)
      return
    }

    const { data: inserted, error: insertError } = await supabase.from('bookings').insert({
      customer,
      service,
      date,
      time,
      address: address || null,
      status: 'pending',
      via: 'form',
      user_id: userId,
    })
      .select('id')
      .single()

    if (insertError) {
      console.error('추가 실패 상세:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
      })
      setError(`예약 추가 실패: ${insertError.message}`)
      setLoading(false)
      return
    }

    // 성공
    setCustomer('')
    setService('')
    setDate('')
    setTime('')
    setAddress('')
    setLoading(false)
    onSuccess?.(inserted?.id)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] mb-8 relative z-30 font-['Pretendard',sans-serif]">
      {error && (
        <div className="mb-6 p-4 bg-[#ff4b4b]/10 border-2 border-[#ff4b4b] rounded-2xl text-[#ff4b4b] text-xs font-black">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 relative">
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

        <div>
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">서비스 *</label>
          <input
            type="text"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all"
            placeholder="서비스 유형"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">날짜 *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">시간 *</label>
          <TimeSelect value={time} onChange={setTime} />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">주소</label>
          <LocationPicker value={address} onChange={setAddress} />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#58cc02] hover:bg-[#46a302] disabled:bg-gray-300 text-white font-black py-4 px-6 rounded-2xl transition-all uppercase tracking-wider text-sm shadow-[0_4px_0_#46a302] active:translate-y-[4px] active:shadow-none cursor-pointer"
      >
        {loading ? '예약 처리 중...' : '예약하기'}
      </button>
    </form>
  )
}