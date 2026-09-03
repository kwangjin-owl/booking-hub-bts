import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { addBookingToCalendar, removeBookingFromCalendar } from '../lib/calendar'
import BookingEditModal, { type EditDraft } from './BookingEditModal'
import MapView from './MapView'

interface Booking {
  id: number
  customer: string
  service: string
  date: string
  time: string
  status: string
  address?: string | null
  detail_address?: string | null
  calendar_event_id?: string | null
}

interface CalendarViewProps {
  refreshKey?: number
  isAdmin?: boolean
}

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 캘린더 일정에는 상세주소까지 합쳐서 넣는다. */
function fullAddress(address?: string | null, detail?: string | null) {
  return [address, detail].filter(Boolean).join(' ')
}

export default function CalendarView({ refreshKey = 0, isAdmin = false }: CalendarViewProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDateStr, setSelectedDateStr] = useState('')
  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null)
  const [mapData, setMapData] = useState<{ lat: number; lon: number } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [editing, setEditing] = useState<Booking | null>(null)

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, customer, service, date, time, status, address, detail_address, calendar_event_id',
        )
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

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startDayOfWeek = firstDayOfMonth.getDay()

  const calendarDays: ({ day: number; dateStr: string } | null)[] = []
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    calendarDays.push({ day: d, dateStr })
  }

  // 선택한 날짜의 예약은 목록 원본에서 그때그때 뽑는다.
  // 따로 복사해 두면 상태를 바꿨을 때 두 곳을 모두 갱신해야 해 어긋나기 쉽다.
  const selectedDayBookings = bookings.filter((b) => b.date === selectedDateStr)

  const closeDay = () => {
    setSelectedDateStr('')
    setExpandedBookingId(null)
    setMapData(null)
  }

  // 모달이 열려 있는 동안 Esc 로 닫고, 뒷배경 스크롤을 막는다.
  useEffect(() => {
    if (!selectedDateStr || editing) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDay()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [selectedDateStr, editing])

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    closeDay()
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    closeDay()
  }

  /** 대기 <-> 확정 전환. 목록 화면과 같은 규칙을 쓴다. */
  const handleStatusToggle = async (booking: Booking) => {
    if (!isAdmin) return

    setBusyId(booking.id)
    setMessage(null)

    const goingToConfirm = booking.status === 'pending'
    const newStatus = goingToConfirm ? 'confirmed' : 'pending'
    let eventId: string | null = booking.calendar_event_id ?? null

    if (goingToConfirm) {
      const result = await addBookingToCalendar({
        customer: booking.customer,
        service: booking.service,
        date: booking.date,
        time: booking.time,
        address: fullAddress(booking.address, booking.detail_address),
      })

      if (!result.ok) {
        setMessage({ kind: 'err', text: `캘린더 등록 실패: ${result.error}` })
        setBusyId(null)
        return
      }
      eventId = result.eventId ?? null
    } else if (eventId) {
      const result = await removeBookingFromCalendar(eventId)
      if (!result.ok) {
        setMessage({ kind: 'err', text: `캘린더 일정 삭제 실패: ${result.error}` })
      }
      eventId = null
    }

    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus, calendar_event_id: eventId })
      .eq('id', booking.id)

    if (error) {
      setMessage({ kind: 'err', text: `상태 변경 실패: ${error.message}` })
      setBusyId(null)
      return
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id ? { ...b, status: newStatus, calendar_event_id: eventId } : b,
      ),
    )
    setMessage({
      kind: 'ok',
      text: goingToConfirm
        ? '확정했습니다. 구글 캘린더에 일정이 등록됐습니다.'
        : '대기 상태로 되돌렸습니다. 캘린더 일정도 삭제했습니다.',
    })
    setBusyId(null)
  }

  const handleSaveEdit = async (draft: EditDraft) => {
    if (!editing) return
    const booking = editing

    setBusyId(booking.id)
    setMessage(null)

    const { error } = await supabase
      .from('bookings')
      .update({
        customer: draft.customer,
        service: draft.service,
        date: draft.date,
        time: draft.time,
        address: draft.address || null,
        detail_address: draft.detailAddress || null,
      })
      .eq('id', booking.id)

    if (error) {
      setMessage({ kind: 'err', text: `수정 실패: ${error.message}` })
      setBusyId(null)
      return
    }

    let eventId = booking.calendar_event_id ?? null
    if (booking.status === 'confirmed') {
      if (eventId) await removeBookingFromCalendar(eventId)
      const result = await addBookingToCalendar({
        customer: draft.customer,
        service: draft.service,
        date: draft.date,
        time: draft.time,
        address: fullAddress(draft.address, draft.detailAddress),
      })
      eventId = result.ok ? (result.eventId ?? null) : null
      await supabase.from('bookings').update({ calendar_event_id: eventId }).eq('id', booking.id)
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              customer: draft.customer,
              service: draft.service,
              date: draft.date,
              time: draft.time,
              address: draft.address || null,
              detail_address: draft.detailAddress || null,
              calendar_event_id: eventId,
            }
          : b,
      ),
    )

    // 날짜를 옮겼으면 선택한 날짜도 따라간다.
    if (draft.date !== booking.date) setSelectedDateStr(draft.date)

    setMessage({ kind: 'ok', text: '예약을 수정했습니다.' })
    setBusyId(null)
    setEditing(null)
  }

  const handleDelete = async (booking: Booking) => {
    if (!isAdmin) return
    if (!window.confirm(`'${booking.customer}' 예약을 삭제할까요? 되돌릴 수 없습니다.`)) return

    setBusyId(booking.id)
    setMessage(null)

    if (booking.calendar_event_id) {
      await removeBookingFromCalendar(booking.calendar_event_id)
    }

    const { error } = await supabase.from('bookings').delete().eq('id', booking.id)

    if (error) {
      setMessage({ kind: 'err', text: `삭제 실패: ${error.message}` })
      setBusyId(null)
      return
    }

    setBookings((prev) => prev.filter((b) => b.id !== booking.id))
    setMessage({ kind: 'ok', text: '예약을 삭제했습니다.' })
    setBusyId(null)
  }

  const handleShowMap = async (booking: Booking) => {
    if (!booking.address) return

    setExpandedBookingId(expandedBookingId === booking.id ? null : booking.id)

    if (expandedBookingId !== booking.id) {
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
          setMapData({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
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
  const today = todayString()

  return (
    <div className="space-y-6 font-['Pretendard',sans-serif]">
      {message && (
        <div
          className={`p-4 rounded-2xl border-2 text-xs font-black ${
            message.kind === 'ok'
              ? 'bg-[#d7ffb8]/40 border-[#a5ed6e] text-[#58a700]'
              : 'bg-[#ff4b4b]/10 border-[#ff4b4b] text-[#ff4b4b]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 월 이동 */}
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
        <div className="grid grid-cols-7 gap-2 mb-4 text-center font-black text-sm">
          {weekNames.map((name, idx) => (
            <div
              key={idx}
              className={`py-2 ${
                idx === 0 ? 'text-[#ff4b4b]' : idx === 6 ? 'text-[#1cb0f6]' : 'text-[#777777]'
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((item, idx) => {
            if (!item) {
              return (
                <div
                  key={idx}
                  className="h-24 bg-[#f7f7f7]/30 rounded-xl border-2 border-transparent"
                />
              )
            }

            const dayBookings = bookings.filter((b) => b.date === item.dateStr)
            const isSelected = selectedDateStr === item.dateStr
            const isToday = item.dateStr === today
            const isPast = item.dateStr < today

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedDateStr(item.dateStr)
                  setExpandedBookingId(null)
                  setMapData(null)
                }}
                className={`h-24 p-2 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between overflow-hidden text-left ${
                  isSelected
                    ? 'border-[#58cc02] bg-[#d7ffb8]/30 shadow-[0_4px_0_#58cc02]'
                    : isToday
                      ? 'border-[#1cb0f6] bg-[#1cb0f6]/5'
                      : 'border-[#e5e5e5] bg-white hover:border-[#777777]'
                } ${isPast && !isSelected ? 'opacity-60' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                      isToday ? 'bg-[#1cb0f6] text-white' : 'text-[#3c3c3c]'
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
              </button>
            )
          })}
        </div>
      </div>

      {/* 선택한 날짜의 예약.
          예전에는 달력 아래에 붙였는데, 달력이 화면을 채워 스크롤 밖으로 밀리는 바람에
          날짜를 눌러도 아무 일도 안 일어난 것처럼 보였다. 그래서 모달로 옮겼다. */}
      {selectedDateStr && !editing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={closeDay} aria-hidden="true" />

          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_10px_0_#d0d0d0] p-6">
          <div className="flex justify-between items-center mb-6 gap-4">
            <h4 className="text-xl font-black text-[#042c60]">
              {selectedDateStr} · {selectedDayBookings.length}건
            </h4>
            <button
              onClick={closeDay}
              aria-label="닫기"
              className="w-8 h-8 flex-shrink-0 rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] text-[#777777] font-black hover:bg-[#ff4b4b] hover:text-white hover:border-[#ff4b4b] transition-colors flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
          {selectedDayBookings.length === 0 ? (
            <p className="text-[#777777] font-bold text-center py-8">
              해당 날짜에 등록된 예약이 없습니다.
            </p>
          ) : (
            <div className="space-y-4">
              {selectedDayBookings.map((booking) => {
                const isBusy = busyId === booking.id

                return (
                  <div
                    key={booking.id}
                    className="bg-[#f7f7f7] border-2 border-[#e5e5e5] p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-[#042c60]">{booking.customer}</span>
                        <span className="text-xs font-bold text-[#777777] bg-white px-2 py-0.5 rounded-lg border border-[#e5e5e5]">
                          {booking.time}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#3c3c3c]">서비스: {booking.service}</p>
                      {booking.address && (
                        <button
                          onClick={() => handleShowMap(booking)}
                          className="text-xs text-[#1cb0f6] font-bold underline hover:text-[#0d99dc] cursor-pointer text-left block"
                        >
                          📍 {booking.address}
                          {booking.detail_address && ` ${booking.detail_address}`}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleStatusToggle(booking)}
                        disabled={!isAdmin || isBusy}
                        title={isAdmin ? '클릭해서 상태를 바꿉니다' : '관리자만 변경할 수 있습니다'}
                        className={`w-24 py-2 rounded-xl text-xs font-black tracking-wider transition-all shadow-[0_2px_0_rgba(0,0,0,0.12)] ${
                          isAdmin && !isBusy
                            ? 'cursor-pointer active:translate-y-[2px] active:shadow-none'
                            : 'cursor-default opacity-70'
                        } ${
                          booking.status === 'pending'
                            ? 'bg-[#ffc800] text-[#042c60]'
                            : 'bg-[#58cc02] text-white'
                        }`}
                      >
                        {isBusy ? '처리 중' : booking.status === 'pending' ? '대기 중' : '확정 완료'}
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setEditing(booking)}
                            disabled={isBusy}
                            title="수정"
                            aria-label="수정"
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-sm bg-white border-2 border-[#e5e5e5] hover:border-[#1cb0f6] cursor-pointer disabled:opacity-50"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(booking)}
                            disabled={isBusy}
                            title="삭제"
                            aria-label="삭제"
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-sm bg-white border-2 border-[#e5e5e5] hover:border-[#ff4b4b] cursor-pointer disabled:opacity-50"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {expandedBookingId && mapData && (
                <div className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] mt-4">
                  <div className="mb-3 flex justify-between items-center gap-4">
                    <h5 className="font-black text-[#042c60] break-words">
                      📍 {selectedDayBookings.find((b) => b.id === expandedBookingId)?.address}
                    </h5>
                    <button
                      onClick={() => setExpandedBookingId(null)}
                      aria-label="닫기"
                      className="w-8 h-8 flex-shrink-0 rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] text-[#777777] font-black hover:bg-[#ff4b4b] hover:text-white hover:border-[#ff4b4b] transition-colors flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <MapView
                    lat={mapData.lat}
                    lon={mapData.lon}
                    address={
                      selectedDayBookings.find((b) => b.id === expandedBookingId)?.address || ''
                    }
                  />
                </div>
              )}
            </div>
          )}
          </div>
          </div>
        </div>
      )}

      {editing && (
        <BookingEditModal
          booking={editing}
          saving={busyId === editing.id}
          onCancel={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  )
}