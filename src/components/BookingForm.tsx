import { useState } from 'react'
import { supabase } from '../supabaseClient'
import AddressSearch from './AddressSearch'
import TimeSelect from './TimeSelect'
import MapView from './MapView'

interface BookingFormProps {
  onSuccess?: () => void
}

interface AddressResult {
  address: string
  lat: number
  lon: number
  display_name: string
}

export default function BookingForm({ onSuccess }: BookingFormProps) {
  const [customer, setCustomer] = useState('')
  const [service, setService] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [address, setAddress] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<AddressResult | null>(null)
  const [addressOpen, setAddressOpen] = useState(false)
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
    // 로그인한 본인 id 를 반드시 같이 넣어야 저장된다.
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id

    if (!userId) {
      setError('로그인이 만료됐습니다. 다시 로그인해 주세요.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('bookings').insert({
      customer,
      service,
      date,
      time,
      address: address || null,
      status: 'pending',
      via: 'form',
      user_id: userId,
    })

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
    setSelectedLocation(null)
    setAddressOpen(false)
    setLoading(false)
    onSuccess?.()
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

        <div className="md:col-span-2 relative z-20">
          <label className="block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider">주소</label>
          <AddressSearch
            value={address}
            onChange={setAddress}
            onSelect={setSelectedLocation}
            onOpenChange={setAddressOpen}
          />
        </div>
      </div>

      {/* 검색 목록이 지도를 덮어 지저분해지므로, 고르는 동안에는 지도를 감춘다 */}
      {selectedLocation && !addressOpen && (
        <div className="mb-6 p-4 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl">
          <MapView
            lat={selectedLocation.lat}
            lon={selectedLocation.lon}
            address={selectedLocation.display_name}
          />
        </div>
      )}

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
