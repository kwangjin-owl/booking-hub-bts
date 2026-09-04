import { useState } from 'react'
import { decisionBadge, decisionLabel } from '../lib/decisionMeta'
import { humanizeSlotText } from '../lib/slots'
import type { Decision } from '../lib/types'

export interface LogEntry {
  key: string
  at: number
  customer: string
  decision: Decision
  reason: string
  traceLines: string[]
}

interface DecisionLogProps {
  entries: LogEntry[]
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** realtime 으로 들어온 판정을 위에서부터 쌓는다. 항목은 Dashboard 가 만든다. */
export default function DecisionLog({ entries }: DecisionLogProps) {
  // 과정은 한 건에 예닐곱 줄이라 다 펴두면 12건에 스크롤이 끝없다. 눌렀을 때만 편다.
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5] overflow-hidden flex flex-col max-h-[520px]">
      <div className="px-6 py-4 border-b-2 border-[#e5e5e5] bg-[#f7f7f7] flex items-center justify-between">
        <h3 className="text-sm font-black text-[#042c60]">판정 로그</h3>
        <span className="text-[11px] font-bold text-[#777777]">최근 12건 · 실시간</span>
      </div>

      {entries.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm font-bold text-[#afafaf]">
          아직 판정이 없습니다. 예약을 추가하거나 '전부 판정' 을 누르면 여기 쌓입니다.
        </p>
      ) : (
        <div className="divide-y-2 divide-[#f0f0f0] overflow-y-auto">
          {entries.map((e) => (
            <div key={e.key} className="px-6 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#999999] tabular-nums">{formatTime(e.at)}</span>
                <span className="font-black text-[#042c60] text-sm">{e.customer}</span>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${decisionBadge(e.decision)}`}>
                  {decisionLabel(e.decision)}
                </span>
                <span className="text-xs font-bold text-[#777777]">{humanizeSlotText(e.reason)}</span>
              </div>
              {e.traceLines.length > 0 && (
                <>
                  <button
                    onClick={() => toggle(e.key)}
                    className="mt-1 text-[11px] font-bold text-[#1cb0f6] hover:underline cursor-pointer"
                  >
                    {open.has(e.key) ? '▼ 과정 닫기' : `▶ 과정 ${e.traceLines.length}단계`}
                  </button>
                  {open.has(e.key) && (
                    <ol className="mt-1 ml-4 text-[11px] font-bold text-[#666666] space-y-0.5">
                      {e.traceLines.map((line, i) => (
                        <li key={i} className="before:content-['·'] before:mr-1.5 before:text-[#afafaf]">
                          {humanizeSlotText(line)}
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
