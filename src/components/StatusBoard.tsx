import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface Booking {
  id: number
  customer: string
  date: string
  kind: string
  form: string
  memo: string
  decision: string
  slot_assigned?: string
  reason?: string
  options?: string
}

export default function StatusBoard() {
  const [bookings, setBookings] = useState<Record<string, Booking[]>>({
    pending: [],
    confirmed_auto: [],
    confirmed_human: [],
    review: [],
    rejected: [],
    asking: [],
  })

  useEffect(() => {
    const fetchBookings = async () => {
      const { data } = await supabase.from('bookings').select('*')

      if (data) {
        const grouped: Record<string, Booking[]> = {
          pending: [],
          confirmed_auto: [],
          confirmed_human: [],
          review: [],
          rejected: [],
          asking: [],
        }

        data.forEach((b) => {
          if (grouped[b.decision]) {
            grouped[b.decision].push(b)
          }
        })

        setBookings(grouped)
      }
    }

    fetchBookings()

    const channel = supabase
      .channel('bookings-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          fetchBookings()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const columns = [
    { key: 'pending', label: '대기', color: 'bg-gray-100', borderColor: 'border-gray-300' },
    { key: 'confirmed_auto', label: '확정-자동', color: 'bg-[#d7ffb8]', borderColor: 'border-[#58cc02]' },
    { key: 'confirmed_human', label: '확정-수동', color: 'bg-[#d7ffb8]', borderColor: 'border-[#58cc02]' },
    { key: 'review', label: '검토', color: 'bg-[#fff8e6]', borderColor: 'border-[#ffc800]' },
    { key: 'rejected', label: '기각', color: 'bg-[#ffebeb]', borderColor: 'border-[#ff4b4b]' },
    { key: 'asking', label: '질문', color: 'bg-[#e6f4ff]', borderColor: 'border-[#1cb0f6]' },
  ]

  return (
    <div className="font-['Pretendard',sans-serif]">
      <div className="mb-4">
        <h3 className="text-lg font-black text-[#042c60]">상태 보드</h3>
        <p className="text-xs text-[#777777] font-bold mt-1">예약 상태별 현황</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        {columns.map((col) => {
          const items = bookings[col.key as keyof typeof bookings] || []

          return (
            <div
              key={col.key}
              className={`${col.color} border-2 ${col.borderColor} rounded-2xl p-4 min-h-[400px] flex flex-col`}
            >
              <div className="mb-4 pb-4 border-b-2 border-current/10">
                <h4 className="font-black text-sm text-[#042c60]">{col.label}</h4>
                <p className="text-xs font-bold text-[#777777] mt-1">{items.length}건</p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-xs text-[#999999] font-bold text-center py-8">예약이 없습니다</p>
                ) : (
                  items.map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-white rounded-xl p-3 border-2 border-current/20 hover:border-current/40 transition-all"
                    >
                      <div className="mb-2">
                        <p className="font-black text-sm text-[#042c60]">{booking.customer}</p>
                        <p className="text-xs text-[#777777] font-bold mt-0.5">
                          {booking.date} · {booking.kind}
                        </p>
                      </div>

                      <p className="text-xs font-bold text-[#555555] mb-2">
                        {booking.form} · {booking.memo}
                      </p>

                      {booking.slot_assigned && (
                        <p className="text-xs font-black text-[#58cc02] bg-[#d7ffb8]/30 px-2 py-1 rounded-lg">
                          ✓ {booking.slot_assigned}
                        </p>
                      )}

                      {booking.reason && !booking.slot_assigned && (
                        <p className="text-xs text-[#777777] font-bold line-clamp-2">
                          {booking.reason}
                        </p>
                      )}

                      {booking.options && col.key === 'review' && (
                        <p className="text-xs text-[#666666] font-bold mt-1">
                          옵션: {booking.options.split(',').join(' vs ')}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
