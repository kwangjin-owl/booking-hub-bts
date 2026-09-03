import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import MapView from './MapView'

interface Booking {
  id: number
  customer: string
  service: string
  date: string
  time: string
  status: string
  address?: string
}

interface BookingTableProps {
  refreshKey?: number
}

export default function BookingTable({ refreshKey = 0 }: BookingTableProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [mapData, setMapData] = useState<{ lat: number; lon: number } | null>(null)

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('bookings')
        .select('id, customer, service, date, time, status, address, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('조회 실패:', error.message, error.code, error.details)
        setBookings([])
      } else {
        setBookings(data || [])
      }
      setLoading(false)
    }

    fetchBookings()
  }, [refreshKey])

  const handleStatusToggle = async (bookingId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'confirmed' : 'pending'

    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId)

    if (error) {
      console.error('상태 변경 실패:', error)
      return
    }

    // 목록 다시 조회
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
    )
  }

  const handleShowMap = async (booking: Booking) => {
    if (!booking.address) return

    setExpandedId(expandedId === booking.id ? null : booking.id)

    if (expandedId !== booking.id) {
      // Nominatim API로 좌표 조회
      try {
        const searchUrl = new URL('https://nominatim.openstreetmap.org/search')
        searchUrl.searchParams.append('q', booking.address)
        searchUrl.searchParams.append('format', 'json')
        searchUrl.searchParams.append('limit', '1')
        searchUrl.searchParams.append('countrycodes', 'kr')
        searchUrl.searchParams.append('accept-language', 'ko')

        const response = await fetch(searchUrl.toString())
        const data = await response.json()
        if (data.length > 0) {
          setMapData({
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
          })
        }
      } catch (error) {
        console.error('좌표 조회 실패:', error)
      }
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-[#777777] font-bold">로딩 중...</div>
  }

  if (bookings.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl border-2 border-[#e5e5e5] text-center font-['Pretendard',sans-serif]">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-[#777777] font-bold">등록된 예약이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-['Pretendard',sans-serif]">
      <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f7f7f7] border-b-2 border-[#e5e5e5] text-[#777777] text-xs font-black uppercase tracking-wider">
                <th className="px-6 py-4 text-left">고객사</th>
                <th className="px-6 py-4 text-left">서비스</th>
                <th className="px-6 py-4 text-left">날짜</th>
                <th className="px-6 py-4 text-left">시간</th>
                <th className="px-6 py-4 text-left">위치</th>
                <th className="px-6 py-4 text-left">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#e5e5e5]">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-[#f7f7f7]/50 transition-colors">
                  <td className="px-6 py-4 font-black text-[#042c60]">{booking.customer}</td>
                  <td className="px-6 py-4 font-bold text-[#3c3c3c]">{booking.service}</td>
                  <td className="px-6 py-4 font-bold text-[#777777]">{booking.date}</td>
                  <td className="px-6 py-4 font-bold text-[#777777]">{booking.time}</td>
                  <td className="px-6 py-4 font-medium">
                    {booking.address ? (
                      <button
                        onClick={() => handleShowMap(booking)}
                        className="text-[#1cb0f6] font-black underline hover:text-[#0d99dc] cursor-pointer inline-flex items-center gap-1"
                      >
                        {expandedId === booking.id ? '✓ ' : ''}
                        {booking.address.substring(0, 15)}...
                      </button>
                    ) : (
                      <span className="text-[#afafaf]">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleStatusToggle(booking.id, booking.status)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-[0_2px_0_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none ${
                        booking.status === 'pending'
                          ? 'bg-[#ffc800] text-[#042c60] hover:bg-[#e6b400]'
                          : 'bg-[#58cc02] text-white hover:bg-[#46a302]'
                      }`}
                    >
                      {booking.status === 'pending' ? '대기 중' : '확정 완료'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {expandedId && mapData && (
        <div className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] animate-fade-in">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="font-black text-[#042c60] text-lg">
              📍 {bookings.find((b) => b.id === expandedId)?.address}
            </h3>
            <button
              onClick={() => setExpandedId(null)}
              className="w-8 h-8 rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] text-[#777777] font-black hover:bg-[#ff4b4b] hover:text-white hover:border-[#ff4b4b] transition-colors flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="rounded-xl overflow-hidden border-2 border-[#e5e5e5]">
            <MapView
              lat={mapData.lat}
              lon={mapData.lon}
              address={bookings.find((b) => b.id === expandedId)?.address || ''}
            />
          </div>
        </div>
      )}
    </div>
  )
}
