import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import AddressSearch from './AddressSearch'
import MapView from './MapView'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
    const { error: insertError } = await supabase.from('bookings').insert({
      customer,
      service,
      date,
      time,
      address: address || null,
      status: 'pending',
      via: 'form',
    })

    if (insertError) {
      console.error('추가 실패:', insertError)
      setError('예약 추가에 실패했습니다')
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
    setLoading(false)
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
      <h2 className="text-2xl font-bold mb-6">새로운 예약</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-2">고객사 *</label>
          <input
            type="text"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            placeholder="고객사 이름"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">서비스 *</label>
          <input
            type="text"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            placeholder="서비스 유형"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">날짜 *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">시간 *</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">주소</label>
          <AddressSearch
            value={address}
            onChange={setAddress}
            onSelect={setSelectedLocation}
          />
        </div>
      </div>

      {selectedLocation && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
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
        className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? '예약 중...' : '예약하기'}
      </button>
    </form>
  )
}
