import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface LogEntry {
  id: number
  customer: string
  decision: string
  reason: string
  trace: string
  timestamp: number
}

export default function DecisionLog() {
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    const channel = supabase
      .channel('bookings-log')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
        },
        (payload) => {
          const booking = payload.new
          if (booking.decision && booking.customer) {
            setLogs((prev) => [
              {
                id: booking.id,
                customer: booking.customer,
                decision: booking.decision,
                reason: booking.reason || '',
                trace: booking.trace || '',
                timestamp: Date.now(),
              },
              ...prev.slice(0, 11),
            ])
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

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
      rejected: '기각',
      asking: '요청 불완전',
    }
    return labels[decision] || decision
  }

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] text-center font-['Pretendard',sans-serif]">
        <p className="text-[#777777] font-bold text-sm">판정 기록이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] overflow-hidden font-['Pretendard',sans-serif]">
      <div className="px-6 py-4 border-b-2 border-[#e5e5e5] bg-[#f7f7f7]">
        <h3 className="text-sm font-black text-[#042c60]">최근 판정 (12건)</h3>
      </div>

      <div className="divide-y-2 divide-[#e5e5e5]">
        {logs.map((log) => (
          <div key={`${log.id}-${log.timestamp}`} className="px-6 py-3 hover:bg-[#f7f7f7]/50 transition-all">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-[#042c60] text-sm">{log.customer}</span>
                  <span className={`text-xs font-black px-2 py-1 rounded-full ${getBadgeColor(log.decision)}`}>
                    {getDecisionLabel(log.decision)}
                  </span>
                </div>
                <p className="text-xs text-[#777777] font-bold">{log.reason}</p>
              </div>
              <span className="text-xs text-[#999999] font-bold whitespace-nowrap">
                {formatTime(log.timestamp)}
              </span>
            </div>

            {log.trace && (
              <div className="text-xs text-[#555555] font-bold mt-2 pl-3 border-l-2 border-[#e5e5e5]">
                {log.trace.split('\n').slice(0, 2).map((line, idx) => (
                  <div key={idx} className="text-[#777777]">
                    {line}
                  </div>
                ))}
                {log.trace.split('\n').length > 2 && (
                  <div className="text-[#999999] italic">⋯</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
