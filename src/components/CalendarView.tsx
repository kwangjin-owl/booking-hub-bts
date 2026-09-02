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

interface CalendarViewProps {
  refreshKey?: number
}

export default function CalendarView({ refreshKey = 0 }: CalendarViewProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDayBookings, setSelectedDayBookings] = useState<Booking[]>([])
  const [selectedDateStr, setSelectedDateStr] = useState('')
  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null)
  const [mapData, setMapData] = useState<{ lat: number; lon: number } | null>(null)

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('bookings')
        .select('id, customer, service, date, time, status, address')
        .order('date', { ascending: true })

      if (error) {
        console.error('달력 예약 조회 실패:', error)
        setBookings([])
      } else {
        setBookings(data || [])
      }
      setLoading(false)
    }

    fetchBookings()
  }, [refreshKey])

  // 현재 월의 연도와 월
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // 이번 달 첫 날과 마지막 날 계산
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  const daysInMonth = lastDayOfMonth.getDate()
  const startDayOfWeek = firstDayOfMonth.getDay() // 0: 일요일

  // 달력 그리드 배열 생성
  const calendarDays = []
  // 빈 칸 (이전 달 여백)
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null)
  }
  // 실제 날짜
  for (let d = 1; d <= daysInMonth; d++) {
    const monthStr = String(month + 1).padStart(2, '0')
    const dayStr = String(d).padStart(2, '0')
    const dateStr = `${year}-${monthStr}-${dayStr}`
    calendarDays.push({ day: d, dateStr })
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDayBookings([])
    setSelectedDateStr('')
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDayBookings([])
    setSelectedDateStr('')
  }

  const handleDayClick = (dateStr: string, dayBookings: Booking[]) => {
    setSelectedDateStr(dateStr)
    setSelectedDayBookings(dayBookings)
    setExpandedBookingId(null)
    setMapData(null)
  }

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

    // 상태 업데이트 반영
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
    )
    setSelectedDayBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
    )
  }

  const handleShowMap = async (booking: Booking) => {
    if (!booking.address) return

    setExpandedBookingId(expandedBookingId === booking.id ? null : booking.id)

    if (expandedBookingId !== booking.id) {
      try {
        const searchUrl = new URL('https://nominatim.openstreetmap.org/search')
        searchUrl.searchParams.append('q', booking.address.replace(/\s+/g, ''))
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
    return (
      <div className="min-h-[720px] flex items-center justify-center text-[#777777] font-bold">
        달력 로딩 중...
      </div>
    )
  }

  const weekNames = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="space-y-8 font-['Pretendard',sans-serif]">
      {/* 캘린더 상단 헤더 (월 이동) */}
      <div className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className="bg-[#f7f7f7] hover:bg-[#e5e5e5] text-[#042c60] border-2 border-[#e5e5e5] px-4 py-2 rounded-xl font-black transition-all cursor-pointer shadow-[0_3px_0_#e5e5e5] active:translate-y-[3px] active:shadow-none"
        >
          ◀ 이전 달
        </button>
        <h3 className="text-2xl font-black text-[#042c60]">
          {year}년 {month + 1}월
        </h3>
        <button
          onClick={handleNextMonth}
          className="bg-[#f7f7f7] hover:bg-[#e5e5e5] text-[#042c60] border-2 border-[#e5e5e5] px-4 py-2 rounded-xl font-black transition-all cursor-pointer shadow-[0_3px_0_#e5e5e5] active:translate-y-[3px] active:shadow-none"
        >
          다음 달 ▶
        </button>
      </div>

      {/* 달력 그리드 */}
      <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] p-6 overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-2 mb-4 text-center font-black text-sm">
          {weekNames.map((name, idx) => (
            <div
              key={idx}
              className={`py-2 ${
                idx === 0
                  ? 'text-[#ff4b4b]'
                  : idx === 6
                  ? 'text-[#1cb0f6]'
                  : 'text-[#777777]'
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* 날짜 칸들 */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((item, idx) => {
            if (!item) {
              return <div key={idx} className="h-24 bg-[#f7f7f7]/30 rounded-xl border-2 border-transparent"></div>
            }

            const dayBookings = bookings.filter((b) => b.date === item.dateStr)
            const isSelected = selectedDateStr === item.dateStr
            const isToday =
              item.dateStr === new Date().toISOString().split('T')[0]

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(item.dateStr, dayBookings)}
                className={`h-24 p-2 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                  isSelected
                    ? 'border-[#58cc02] bg-[#d7ffb8]/30 shadow-[0_4px_0_#58cc02]'
                    : isToday
                    ? 'border-[#1cb0f6] bg-[#1cb0f6]/5'
                    : 'border-[#e5e5e5] bg-white hover:border-[#777777]'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                      isToday
                        ? 'bg-[#1cb0f6] text-white'
                        : 'text-[#3c3c3c]'
                    }`}
                  >
                    {item.day}
                  </span>
                  {dayBookings.length > 0 && (
                    <span className="bg-[#58cc02] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                      {dayBookings.length}건
                    </span>
                  )}
                </div>

                <div className="space-y-1 overflow-y-auto max-h-12 scrollbar-none">
                  {dayBookings.map((b) => (
                    <div
                      key={b.id}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate ${
                        b.status === 'confirmed'
                          ? 'bg-[#58cc02]/20 text-[#46a302]'
                          : 'bg-[#ffc800]/20 text-[#b38600]'
                      }`}
                    >
                      {b.time} {b.customer}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 선택한 날짜의 예약 상세 목록 */}
      {selectedDateStr && (
        <div className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-xl font-black text-[#042c60]">
              📅 {selectedDateStr} 예약 상세 ({selectedDayBookings.length}건)
            </h4>
            <button
              onClick={() => setSelectedDateStr('')}
              className="text-[#777777] font-black hover:text-[#ff4b4b] cursor-pointer"
            >
              닫기 ✕
            </button>
          </div>

          {selectedDayBookings.length === 0 ? (
            <p className="text-[#777777] font-bold text-center py-8">해당 날짜에 등록된 예약이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {selectedDayBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-[#f7f7f7] border-2 border-[#e5e5e5] p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-[#042c60]">{booking.customer}</span>
                      <span className="text-xs font-bold text-[#777777] bg-white px-2 py-0.5 rounded-lg border border-[#e5e5e5]">
                        {booking.time}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#3c3c3c]">서비스: {booking.service}</p>
                    {booking.address && (
                      <button
                        onClick={() => handleShowMap(booking)}
                        className="text-xs text-[#1cb0f6] font-black underline hover:text-[#0d99dc] cursor-pointer text-left"
                      >
                        📍 {booking.address}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStatusToggle(booking.id, booking.status)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-[0_2px_0_rgba(0,0,0,0.1)] active:translate-y-[2px] active:shadow-none ${
                        booking.status === 'pending'
                          ? 'bg-[#ffc800] text-[#042c60]'
                          : 'bg-[#58cc02] text-white'
                      }`}
                    >
                      {booking.status === 'pending' ? '대기 중' : '확정 완료'}
                    </button>
                  </div>
                </div>
              ))}

              {/* 지도 표시 영역 */}
              {expandedBookingId && mapData && (
                <div className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] mt-4">
                  <div className="mb-3 flex justify-between items-center">
                    <h5 className="font-black text-[#042c60]">
                      📍 {selectedDayBookings.find((b) => b.id === expandedBookingId)?.address}
                    </h5>
                    <button
                      onClick={() => setExpandedBookingId(null)}
                      className="text-[#777777] font-black hover:text-[#ff4b4b]"
                    >
                      ✕
                    </button>
                  </div>
                  <MapView
                    lat={mapData.lat}
                    lon={mapData.lon}
                    address={selectedDayBookings.find((b) => b.id === expandedBookingId)?.address || ''}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
