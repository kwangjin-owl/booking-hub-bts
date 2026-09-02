import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import MapView from './MapView'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
        .select('id, customer, service, date, time, status, address')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('조회 실패:', error)
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
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(booking.address)}&format=json&limit=1`
        )
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
    return <div className="text-center py-8 text-gray-600">로딩 중...</div>
  }

  if (bookings.length === 0) {
    return <div className="text-center py-8 text-gray-600">예약이 없습니다</div>
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">고객사</th>
              <th className="border border-gray-300 px-4 py-2 text-left">서비스</th>
              <th className="border border-gray-300 px-4 py-2 text-left">날짜</th>
              <th className="border border-gray-300 px-4 py-2 text-left">시간</th>
              <th className="border border-gray-300 px-4 py-2 text-left">위치</th>
              <th className="border border-gray-300 px-4 py-2 text-left">상태</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">{booking.customer}</td>
                <td className="border border-gray-300 px-4 py-2">{booking.service}</td>
                <td className="border border-gray-300 px-4 py-2">{booking.date}</td>
                <td className="border border-gray-300 px-4 py-2">{booking.time}</td>
                <td className="border border-gray-300 px-4 py-2">
                  {booking.address ? (
                    <button
                      onClick={() => handleShowMap(booking)}
                      className="text-blue-600 underline hover:text-blue-800 font-medium"
                    >
                      {expandedId === booking.id ? '✓ ' : ''}
                      {booking.address.substring(0, 20)}...
                    </button>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <button
                    onClick={() => handleStatusToggle(booking.id, booking.status)}
                    className={`px-3 py-1 rounded text-sm font-semibold cursor-pointer ${
                      booking.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {booking.status === 'pending' ? '대기' : '확정'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expandedId && mapData && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <div className="mb-2 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">
              {bookings.find((b) => b.id === expandedId)?.address}
            </h3>
            <button
              onClick={() => setExpandedId(null)}
              className="text-gray-500 hover:text-gray-700 text-lg"
            >
              ✕
            </button>
          </div>
          <MapView
            lat={mapData.lat}
            lon={mapData.lon}
            address={bookings.find((b) => b.id === expandedId)?.address || ''}
          />
        </div>
      )}
    </div>
  )
}
