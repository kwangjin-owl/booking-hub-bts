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
  calendar_event_id?: string | null
}

interface BookingTableProps {
  refreshKey?: number
  isAdmin?: boolean
}

export default function BookingTable({ refreshKey = 0, isAdmin = false }: BookingTableProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [mapData, setMapData] = useState<{ lat: number; lon: number } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [editing, setEditing] = useState<Booking | null>(null)

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true)
      // RLS 가 알아서 걸러준다. 관리자는 전체, 그 외에는 자기 것만 돌아온다.
      const { data, error } = await supabase
        .from('bookings')
        .select('id, customer, service, date, time, status, address, calendar_event_id, created_at')
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

  /** 대기 <-> 확정 전환. 확정할 때 캘린더에 넣고, 되돌리면 지운다. */
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
        address: booking.address,
      })

      if (!result.ok) {
        setMessage({ kind: 'err', text: `캘린더 등록 실패: ${result.error}` })
        setBusyId(null)
        return
      }
      eventId = result.eventId ?? null
    } else if (eventId) {
      // 일정 삭제가 실패해도 상태는 되돌린다. 캘린더에 남은 건 직접 지우면 된다.
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
      })
      .eq('id', booking.id)

    if (error) {
      setMessage({ kind: 'err', text: `수정 실패: ${error.message}` })
      setBusyId(null)
      return
    }

    // 이미 확정돼 캘린더에 올라간 예약이면 일정을 다시 만든다.
    let eventId = booking.calendar_event_id ?? null
    if (booking.status === 'confirmed') {
      if (eventId) await removeBookingFromCalendar(eventId)
      const result = await addBookingToCalendar({ ...draft })
      eventId = result.ok ? (result.eventId ?? null) : null
      await supabase.from('bookings').update({ calendar_event_id: eventId }).eq('id', booking.id)
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? { ...b, ...draft, address: draft.address || null, calendar_event_id: eventId }
          : b,
      ),
    )
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

    setExpandedId(expandedId === booking.id ? null : booking.id)

    if (expandedId !== booking.id) {
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
    return <div className="text-center py-12 text-[#777777] font-bold">로딩 중...</div>
  }

  if (bookings.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl border-2 border-[#e5e5e5] text-center font-['Pretendard',sans-serif]">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-[#777777] font-bold">
          {isAdmin ? '등록된 예약이 없습니다' : '아직 등록한 예약이 없습니다'}
        </p>
      </div>
    )
  }

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

      <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[900px]">
            {/* 컬럼 폭을 고정해 헤더와 본문 정렬을 맞춘다 */}
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[26%]" />
              <col className="w-[12%]" />
              {isAdmin && <col className="w-[12%]" />}
            </colgroup>
            <thead>
              <tr className="bg-[#f7f7f7] border-b-2 border-[#e5e5e5] text-[#777777] text-xs font-black uppercase tracking-wider">
                <th className="px-4 py-4 text-left">고객사</th>
                <th className="px-4 py-4 text-left">서비스</th>
                <th className="px-4 py-4 text-left">날짜</th>
                <th className="px-4 py-4 text-left">시간</th>
                <th className="px-4 py-4 text-left">위치</th>
                <th className="px-4 py-4 text-center">상태</th>
                {isAdmin && <th className="px-4 py-4 text-center">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#e5e5e5]">
              {bookings.map((booking) => {
                const isBusy = busyId === booking.id

                return (
                  <tr
                    key={booking.id}
                    className="hover:bg-[#f7f7f7]/50 transition-colors align-middle"
                  >
                    <td className="px-4 py-4 font-black text-[#042c60] break-words">
                      {booking.customer}
                    </td>
                    <td className="px-4 py-4 font-bold text-[#3c3c3c] break-words">
                      {booking.service}
                    </td>
                    <td className="px-4 py-4 font-bold text-[#777777] whitespace-nowrap">
                      {booking.date}
                    </td>
                    <td className="px-4 py-4 font-bold text-[#777777] whitespace-nowrap">
                      {booking.time}
                    </td>
                    <td className="px-4 py-4 font-medium">
                      {booking.address ? (
                        <button
                          onClick={() => handleShowMap(booking)}
                          title={booking.address}
                          /* 두 줄까지 보여주고 그 뒤로만 말줄임한다 */
                          className="text-left text-[#1cb0f6] font-bold underline hover:text-[#0d99dc] cursor-pointer line-clamp-2 leading-snug"
                        >
                          {booking.address}
                        </button>
                      ) : (
                        <span className="text-[#afafaf]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleStatusToggle(booking)}
                        disabled={!isAdmin || isBusy}
                        title={isAdmin ? '클릭해서 상태를 바꿉니다' : '관리자만 변경할 수 있습니다'}
                        /* w-24 로 폭을 고정해 대기 중·확정 완료 크기를 맞춘다 */
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
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-4">
                        <div className="flex gap-1.5 justify-center">
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
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {expandedId && mapData && (
        <div className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] animate-fade-in">
          <div className="mb-4 flex justify-between items-center gap-4">
            <h3 className="font-black text-[#042c60] text-lg break-words">
              📍 {bookings.find((b) => b.id === expandedId)?.address}
            </h3>
            <button
              onClick={() => setExpandedId(null)}
              aria-label="닫기"
              className="w-8 h-8 flex-shrink-0 rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] text-[#777777] font-black hover:bg-[#ff4b4b] hover:text-white hover:border-[#ff4b4b] transition-colors flex items-center justify-center cursor-pointer"
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