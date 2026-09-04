import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface Booking {
  id: number
  customer: string
  kind: string
  form: string
  date: string
  slots_wanted: string
  decision: string
  slot_assigned?: string
  reason?: string
  options?: string
  trace?: string
  created_at?: string
}

interface PendingReviewProps {
  refreshKey?: number
}

export default function PendingReview({ refreshKey = 0 }: PendingReviewProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [expandedTrace, setExpandedTrace] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .in('decision', ['pending', 'review', 'rejected', 'asking'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('조회 실패:', error)
        setBookings([])
      } else {
        setBookings((data as Booking[]) || [])
      }
      setLoading(false)
    }

    fetchBookings()
  }, [refreshKey])

  const handleConfirm = async (booking: Booking) => {
    if (!booking.slot_assigned) return

    const { error } = await supabase
      .from('bookings')
      .update({ decision: 'confirmed_human' })
      .eq('id', booking.id)

    if (error) {
      console.error('확정 실패:', error)
      return
    }

    setBookings(bookings.filter((b) => b.id !== booking.id))
  }

  const handleReviewDecision = async (booking: Booking, winner: string) => {
    const loser = booking.options?.split(',').find((o) => o.trim() !== winner)

    const { error: winnerError } = await supabase
      .from('bookings')
      .update({ decision: 'confirmed_human' })
      .eq('customer', winner)

    const { error: loserError } = await supabase
      .from('bookings')
      .update({ decision: 'pending' })
      .eq('customer', loser)

    if (!winnerError && !loserError) {
      setBookings(bookings.filter((b) => b.id !== booking.id))
    }
  }


  const getBadgeColor = (decision: string) => {
    switch (decision) {
      case 'pending':
        return 'bg-gray-300 text-gray-700'
      case 'confirmed_auto':
        return 'bg-[#58cc02] text-white'
      case 'confirmed_human':
        return 'bg-white border-2 border-[#58cc02] text-[#58cc02]'
      case 'review':
        return 'bg-[#ffc800] text-[#042c60]'
      case 'rejected':
        return 'bg-[#ff4b4b] text-white'
      case 'asking':
        return 'bg-[#1cb0f6] text-white'
      default:
        return 'bg-gray-200 text-gray-700'
    }
  }

  const getDecisionLabel = (decision: string) => {
    const labels: Record<string, string> = {
      pending: '대기',
      confirmed_auto: '자동 확정',
      confirmed_human: '수동 확정',
      review: '동점',
      rejected: '거절',
      asking: '요청 불완전',
    }
    return labels[decision] || decision
  }

  if (loading) {
    return <div className="text-center py-12 text-[#777777] font-bold">로딩 중...</div>
  }

  if (bookings.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl border-2 border-[#e5e5e5] text-center font-['Pretendard',sans-serif]">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-[#777777] font-bold">미확정 예약이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 font-['Pretendard',sans-serif]">
      {bookings.map((booking) => (
        <div key={booking.id} className="bg-white p-4 rounded-2xl border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5]">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-black text-[#042c60] text-lg">{booking.customer}</h3>
                <span className={`text-xs font-black px-3 py-1 rounded-full ${getBadgeColor(booking.decision)}`}>
                  {getDecisionLabel(booking.decision)}
                </span>
              </div>
              <p className="text-sm font-bold text-[#3c3c3c] mb-1">
                {booking.date} · {booking.kind} · {booking.form}
              </p>
              <p className="text-sm font-bold text-[#777777]">{booking.reason}</p>
              {booking.slot_assigned && (
                <p className="text-sm font-black text-[#58cc02]">✓ 확정 칸: {booking.slot_assigned}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {booking.decision === 'pending' && booking.slot_assigned && (
                <button
                  onClick={() => handleConfirm(booking)}
                  className="bg-[#58cc02] hover:bg-[#46a302] text-white font-black px-4 py-2 rounded-xl text-xs transition-all shadow-[0_2px_0_#46a302] active:translate-y-[2px] active:shadow-none cursor-pointer"
                >
                  확정
                </button>
              )}

              {booking.decision === 'review' && booking.options && (
                <div className="space-y-2">
                  {booking.options.split(',').map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleReviewDecision(booking, option.trim())}
                      className="bg-white border-2 border-[#ffc800] text-[#ffc800] hover:bg-[#ffc800]/10 font-black px-3 py-1 rounded-lg text-xs transition-all cursor-pointer"
                    >
                      {option.trim()} 이 쪽으로
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 과정 보기 */}
          <div className="border-t-2 border-[#e5e5e5] pt-3 mt-3">
            <button
              onClick={() => setExpandedTrace(expandedTrace === booking.id ? null : booking.id)}
              className="text-xs font-bold text-[#1cb0f6] hover:underline cursor-pointer"
            >
              {expandedTrace === booking.id ? '▼ 과정 닫기' : '▶ 과정 보기'}
            </button>

            {expandedTrace === booking.id && booking.trace && (
              <ol className="text-xs font-bold text-[#777777] mt-2 ml-4 space-y-1 list-decimal">
                {booking.trace.split('\n').map((line, idx) => (
                  <li key={idx} className="text-[#555555]">
                    {line}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
