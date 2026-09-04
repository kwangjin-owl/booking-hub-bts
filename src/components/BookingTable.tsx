import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { addBookingToCalendar, removeBookingFromCalendar } from '../lib/calendar'
import BookingEditModal, { type EditDraft } from './BookingEditModal'
import MapView from './MapView'
import { joinSlotsForDisplay, parseSlots, timeFromSlots } from '../lib/slots'
import { decisionLabel } from '../lib/decisionMeta'

interface Booking {
  id: number
  customer: string
  service: string
  date: string
  time: string
  status: string
  decision?: string | null
  slot_assigned?: string | null
  slots_wanted?: string | null
  address?: string | null
  detail_address?: string | null
  calendar_event_id?: string | null
  created_at?: string
}

interface BookingTableProps {
  refreshKey?: number
  isAdmin?: boolean
  /** 방금 등록한 예약. 목록에서 잠시 강조해 어디 있는지 알려준다. */
  highlightId?: number | null
  /** 대시보드 카드에서 넘어올 때 걸어둘 상태 필터 */
  initialFilter?: StatusFilter
  /** 같은 카드를 다시 눌렀을 때도 필터를 다시 걸기 위한 신호 */
  filterNonce?: number
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'past'
type SortKey = 'date' | 'created'

/** 로컬 기준 오늘 'YYYY-MM-DD'. toISOString 은 UTC 라 하루가 밀릴 수 있다. */
function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** '2026-09-03T07:44:38Z' -> '9/3' */
function shortDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 시간 칸 대신 슬롯을 보여준다.
 * 배정된 칸이 있으면 그것을, 없으면 희망 순서를, 둘 다 없으면(옛 예약) 시간을 그대로.
 */
function slotCell(b: Booking): { text: string; muted: boolean } {
  const assigned = parseSlots(b.slot_assigned)
  if (assigned.length) return { text: joinSlotsForDisplay(assigned), muted: false }
  const wanted = parseSlots(b.slots_wanted)
  if (wanted.length) return { text: `희망 ${wanted.join(' > ')}`, muted: true }
  return { text: b.time || '-', muted: true }
}

export default function BookingTable({
  refreshKey = 0,
  isAdmin = false,
  highlightId = null,
  initialFilter = 'all',
  filterNonce = 0,
}: BookingTableProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [mapData, setMapData] = useState<{ lat: number; lon: number } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [editing, setEditing] = useState<Booking | null>(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter)
  const [sortKey, setSortKey] = useState<SortKey>('date')

  // 알림은 잠시 뒤 스스로 사라진다. 계속 남아 있으면 방금 일인지 아까 일인지 헷갈린다.
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), message.kind === 'ok' ? 4000 : 8000)
    return () => clearTimeout(t)
  }, [message])

  // 대시보드에서 카드를 누를 때마다 필터를 갈아 끼운다.
  // initialFilter 만 보면 같은 카드를 두 번 누를 때 값이 그대로라 반응하지 않는다.
  useEffect(() => {
    setStatusFilter(initialFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilter, filterNonce])

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true)
      // RLS 가 알아서 걸러준다. 관리자는 전체, 그 외에는 자기 것만 돌아온다.
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, customer, service, date, time, status, decision, slot_assigned, slots_wanted, address, detail_address, calendar_event_id, created_at',
        )

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

  /** 검색어와 상태 필터를 함께 적용한다. */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()

    const today = todayString()

    const filtered = bookings.filter((b) => {
      const isPast = b.date < today

      if (statusFilter === 'past') {
        // 지난 예약만
        if (!isPast) return false
      } else if (statusFilter === 'all') {
        // 전체는 말 그대로 전부 보여준다. 지난 것은 흐리게 표시된다.
      } else {
        // 대기·확정은 앞으로 처리할 대상이므로 지난 것은 뺀다.
        if (isPast) return false
        if (b.status !== statusFilter) return false
      }

      if (!q) return true

      return [b.customer, b.service, b.address ?? '', b.detail_address ?? '', b.date]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })

    return [...filtered].sort((a, b) => {
      if (sortKey === 'created') {
        // 최근에 등록한 것부터
        return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      }
      // 예약일이 가까운 것부터. 같은 날이면 이른 시간부터
      const byDate = a.date.localeCompare(b.date)
      return byDate !== 0 ? byDate : a.time.localeCompare(b.time)
    })
  }, [bookings, query, statusFilter, sortKey])

  const counts = useMemo(() => {
    const today = todayString()
    const upcoming = bookings.filter((b) => b.date >= today)

    return {
      all: bookings.length,
      pending: upcoming.filter((b) => b.status === 'pending').length,
      confirmed: upcoming.filter((b) => b.status === 'confirmed').length,
      past: bookings.filter((b) => b.date < today).length,
    }
  }, [bookings])

  /** 대기 <-> 확정 전환. 확정할 때 캘린더에 넣고, 되돌리면 지운다. */
  const handleStatusToggle = async (booking: Booking) => {
    if (!isAdmin) return

    // 이미 지난 날짜를 확정하면 과거에 캘린더 일정이 생긴다. 실수인 경우가 많아 한 번 묻는다.
    if (
      booking.status === 'pending' &&
      booking.date < todayString() &&
      !window.confirm(`${booking.date}은 이미 지난 날짜입니다. 그래도 확정할까요?`)
    ) {
      return
    }

    setBusyId(booking.id)
    setMessage(null)

    const goingToConfirm = booking.status === 'pending'
    const newStatus = goingToConfirm ? 'confirmed' : 'pending'
    let eventId: string | null = booking.calendar_event_id ?? null

    if (goingToConfirm) {
      // 시간 칸을 없앴으므로 배정된 슬롯의 시작 시각으로 캘린더 일정을 만든다.
      const time = timeFromSlots(booking.slot_assigned, booking.time)
      if (!time) {
        setMessage({ kind: 'err', text: '배정된 슬롯이 없어 캘린더 시각을 정할 수 없습니다. 먼저 판정하세요.' })
        setBusyId(null)
        return
      }
      const result = await addBookingToCalendar({
        customer: booking.customer,
        service: booking.service,
        date: booking.date,
        time,
        address: [booking.address, booking.detail_address].filter(Boolean).join(' '),
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

  const handleDecisionRevert = async (booking: Booking) => {
    if (!isAdmin) return

    setBusyId(booking.id)
    setMessage(null)

    const { error } = await supabase
      .from('bookings')
      .update({ decision: 'pending' })
      .eq('id', booking.id)

    if (error) {
      setMessage({ kind: 'err', text: `상태 변경 실패: ${error.message}` })
      setBusyId(null)
      return
    }

    setBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? { ...b, decision: 'pending' } : b)),
    )
    setMessage({ kind: 'ok', text: '대기 상태로 되돌렸습니다.' })
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

    // 이미 확정돼 캘린더에 올라간 예약이면 일정을 다시 만든다.
    let eventId = booking.calendar_event_id ?? null
    if (booking.status === 'confirmed') {
      if (eventId) await removeBookingFromCalendar(eventId)
      const result = await addBookingToCalendar({
        customer: draft.customer,
        service: draft.service,
        date: draft.date,
        time: timeFromSlots(booking.slot_assigned, draft.time),
        address: [draft.address, draft.detailAddress].filter(Boolean).join(' '),
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

  const filters: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'all', label: '전체', count: counts.all },
    { id: 'pending', label: '대기 중', count: counts.pending },
    { id: 'confirmed', label: '확정 완료', count: counts.confirmed },
    { id: 'past', label: '지난 예약', count: counts.past },
  ]

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

      {/* 검색 + 상태 필터 */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#afafaf]">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="고객사, 서비스, 주소, 날짜로 검색"
            className="w-full pl-11 pr-10 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="검색어 지우기"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-[#777777] font-black hover:bg-[#e5e5e5] cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex gap-2 p-1.5 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl w-fit">
          {(
            [
              { id: 'date', label: '예약일순' },
              { id: 'created', label: '등록순' },
            ] as { id: SortKey; label: string }[]
          ).map((s) => {
            const isActive = sortKey === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSortKey(s.id)}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-[#1cb0f6] border-2 border-[#1cb0f6] shadow-[0_2px_0_#0d99dc]'
                    : 'bg-transparent text-[#777777] border-2 border-transparent hover:text-[#3c3c3c]'
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 p-1.5 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl w-fit">
          {filters.map((f) => {
            const isActive = statusFilter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-[#58cc02] border-2 border-[#58cc02] shadow-[0_2px_0_#46a302]'
                    : 'bg-transparent text-[#777777] border-2 border-transparent hover:text-[#3c3c3c]'
                }`}
              >
                {f.label} {f.count}
              </button>
            )
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border-2 border-[#e5e5e5] text-center">
          <div className="text-4xl mb-3">{bookings.length === 0 ? '📭' : '🔍'}</div>
          <p className="text-[#777777] font-bold">
            {bookings.length === 0
              ? isAdmin
                ? '등록된 예약이 없습니다'
                : '아직 등록한 예약이 없습니다'
              : statusFilter === 'past'
                ? '지난 예약이 없습니다'
                : '조건에 맞는 예약이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_8px_0_#e5e5e5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed min-w-[900px]">
              {/* 컬럼 폭을 고정해 헤더와 본문 정렬을 맞춘다 */}
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
                <col className="w-[31%]" />
                <col className="w-[12%]" />
                {isAdmin && <col className="w-[12%]" />}
              </colgroup>
              <thead>
                <tr className="bg-[#f7f7f7] border-b-2 border-[#e5e5e5] text-[#777777] text-xs font-black uppercase tracking-wider">
                  <th className="px-4 py-4 text-left">고객사</th>
                  <th className="px-4 py-4 text-left">서비스</th>
                  <th className="px-4 py-4 text-left">날짜</th>
                  <th className="px-4 py-4 text-left">슬롯</th>
                  <th className="px-4 py-4 text-left">위치</th>
                  <th className="px-4 py-4 text-center">상태</th>
                  {isAdmin && <th className="px-4 py-4 text-center">관리</th>}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#e5e5e5]">
                {visible.map((booking) => {
                  const isBusy = busyId === booking.id

                  const isNew = highlightId === booking.id
                  const isPast = booking.date < todayString()

                  return (
                    <tr
                      key={booking.id}
                      className={`transition-colors align-middle ${
                        isNew ? 'bg-[#d7ffb8]/50' : 'hover:bg-[#f7f7f7]/50'
                      } ${isPast ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-4 font-black text-[#042c60] break-words">
                        {booking.customer}
                        {isNew && (
                          <span className="ml-1.5 align-middle text-[10px] font-black text-[#58a700] bg-[#d7ffb8] px-1.5 py-0.5 rounded-full">
                            NEW
                          </span>
                        )}
                      </td>
                      {/* 메모가 통째로 들어와 길어질 수 있다. 두 줄까지만 보여주고 나머지는 툴팁으로. */}
                      <td className="px-4 py-4 font-bold text-[#3c3c3c] break-words">
                        <span className="line-clamp-2" title={booking.service}>
                          {booking.service}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-bold text-[#777777]">{booking.date}</span>
                        {isPast && (
                          <span className="ml-1.5 text-[10px] font-black text-[#afafaf]">지남</span>
                        )}
                        {booking.created_at && (
                          <span className="block text-[10px] font-bold text-[#afafaf]">
                            등록 {shortDate(booking.created_at)}
                          </span>
                        )}
                      </td>
                      {/* 칸이 셋 다 잡히면 '오전+오후-1+오후-2' 라 길다.
                          nowrap 이면 옆 열 위로 넘쳐 흐른다. 줄바꿈을 허용한다. */}
                      <td className="px-4 py-4 font-bold align-middle">
                        {(() => {
                          const c = slotCell(booking)
                          return (
                            <span
                              className={`text-xs leading-snug break-keep ${
                                c.muted ? 'text-[#afafaf]' : 'text-[#58a700]'
                              }`}
                            >
                              {c.text}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-4 font-medium">
                        {booking.address ? (
                          <button
                            onClick={() => handleShowMap(booking)}
                            title={booking.address}
                            className="text-left cursor-pointer group"
                          >
                            <span className="text-[#1cb0f6] font-bold underline group-hover:text-[#0d99dc] leading-snug">
                              {booking.address}
                            </span>
                            {booking.detail_address && (
                              <span className="block text-[11px] text-[#777777] font-bold mt-0.5">
                                {booking.detail_address}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-[#afafaf]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="space-y-2">
                          <button
                            onClick={() => handleStatusToggle(booking)}
                            disabled={!isAdmin || isBusy}
                            title={
                              isAdmin ? '클릭해서 상태를 바꿉니다' : '관리자만 변경할 수 있습니다'
                            }
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
                            {isBusy
                              ? '처리 중'
                              : booking.status === 'pending'
                                ? '대기 중'
                                : '확정 완료'}
                          </button>
                          {booking.decision && (
                            <div className="text-xs font-bold text-[#555555]">
                              판정: {decisionLabel(booking.decision)}
                            </div>
                          )}
                          {booking.decision && ['confirmed_auto', 'confirmed_human', 'rejected', 'asking'].includes(booking.decision) && isAdmin && (
                            <button
                              onClick={() => handleDecisionRevert(booking)}
                              disabled={isBusy}
                              className="w-full py-1 px-2 rounded-lg text-xs font-black text-[#ff4b4b] border-2 border-[#ff4b4b] hover:bg-[#ff4b4b]/10 transition-all cursor-pointer disabled:opacity-50"
                            >
                              판정 취소
                            </button>
                          )}
                        </div>
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
      )}

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
