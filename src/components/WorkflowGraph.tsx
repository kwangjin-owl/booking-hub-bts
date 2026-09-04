import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

interface WorkflowGraphProps {
  refreshKey?: number
}

interface NodeCounts {
  접수: number
  pending: number
  판정: number
  confirmed_auto: number
  confirmed_human: number
  review: number
  rejected: number
  asking: number
}

interface LastPath {
  from: string
  to: string
  expireAt: number
}

const DECISION_ORDER = ['접수', 'pending', '판정', 'confirmed_auto', 'confirmed_human', 'review', 'rejected', 'asking']

const NODE_LABELS: Record<string, string> = {
  접수: '접수',
  pending: '대기',
  판정: '판정',
  confirmed_auto: '확정-자동',
  confirmed_human: '확정-수동',
  review: '검토',
  rejected: '기각',
  asking: '질문',
}

const NODE_COLORS: Record<string, string> = {
  접수: '#3c3c3c',
  pending: '#999999',
  판정: '#ffffff',
  confirmed_auto: '#58cc02',
  confirmed_human: '#ffffff',
  review: '#ffc800',
  rejected: '#ff4b4b',
  asking: '#1cb0f6',
}

const NODE_TEXT: Record<string, string> = {
  접수: '#ffffff',
  pending: '#ffffff',
  판정: '#000000',
  confirmed_auto: '#ffffff',
  confirmed_human: '#000000',
  review: '#042c60',
  rejected: '#ffffff',
  asking: '#ffffff',
}

const NODE_BORDER: Record<string, string> = {
  접수: '#3c3c3c',
  pending: '#777777',
  판정: '#000000',
  confirmed_auto: '#46a302',
  confirmed_human: '#58cc02',
  review: '#b39300',
  rejected: '#c63030',
  asking: '#0a88cc',
}

export default function WorkflowGraph({ refreshKey = 0 }: WorkflowGraphProps) {
  const [counts, setCounts] = useState<NodeCounts>({
    접수: 0,
    pending: 0,
    판정: 0,
    confirmed_auto: 0,
    confirmed_human: 0,
    review: 0,
    rejected: 0,
    asking: 0,
  })
  const [lastPath, setLastPath] = useState<LastPath | null>(null)

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase.from('bookings').select('decision')

      const bookings = (data as { decision: string }[] | null) ?? []
      const newCounts: NodeCounts = {
        접수: bookings.length,
        pending: bookings.filter(b => b.decision === 'pending').length,
        판정: 0,
        confirmed_auto: bookings.filter(b => b.decision === 'confirmed_auto').length,
        confirmed_human: bookings.filter(b => b.decision === 'confirmed_human').length,
        review: bookings.filter(b => b.decision === 'review').length,
        rejected: bookings.filter(b => b.decision === 'rejected').length,
        asking: bookings.filter(b => b.decision === 'asking').length,
      }

      setCounts(newCounts)
    }

    fetchCounts()

    const channel = supabase
      .channel('bookings-workflow')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        (payload) => {
          const oldDecision = (payload.old as { decision?: string } | null)?.decision
          const newDecision = (payload.new as { decision?: string } | null)?.decision

          if (oldDecision !== newDecision) {
            setLastPath({
              from: oldDecision || '접수',
              to: newDecision || 'pending',
              expireAt: Date.now() + 2000,
            })
          }

          fetchCounts()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [refreshKey])

  // 마지막 경로가 2초 후 사라지도록
  useEffect(() => {
    if (!lastPath) return
    const timer = setTimeout(() => setLastPath(null), 2000)
    return () => clearTimeout(timer)
  }, [lastPath])

  const SVG_W = 1200
  const SVG_H = 300

  // 노드 위치 - 4열 2행
  const positions: Record<string, [number, number]> = {
    접수: [60, 150],
    pending: [180, 150],
    판정: [300, 150],
    confirmed_auto: [420, 80],
    confirmed_human: [420, 220],
    review: [540, 150],
    rejected: [660, 80],
    asking: [660, 220],
  }

  const nodeRadius = 30

  const shouldHighlightArrow = (from: string, to: string): boolean => {
    if (!lastPath) return false
    return lastPath.from === from && lastPath.to === to
  }

  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5] font-['Pretendard',sans-serif]">
      <div className="mb-4">
        <h3 className="text-lg font-black text-[#042c60]">판정 흐름도</h3>
        <p className="text-xs text-[#777777] font-bold mt-1">예약의 상태 전이 과정</p>
      </div>

      <svg
        width="100%"
        height="300"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="border-2 border-[#e5e5e5] rounded-xl bg-[#f7f7f7]"
      >
        {/* 화살표 정의 */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#999999" />
          </marker>
          <marker id="arrowhead-bold" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#ff4b4b" />
          </marker>
        </defs>

        {/* 화살표들 */}
        {[
          ['접수', 'pending'],
          ['pending', '판정'],
          ['판정', 'confirmed_auto'],
          ['판정', 'confirmed_human'],
          ['판정', 'review'],
          ['판정', 'rejected'],
          ['판정', 'asking'],
          ['review', 'confirmed_human'],
          ['asking', 'pending'],
          ['confirmed_human', 'pending'],
        ].map(([from, to]) => {
          const [x1, y1] = positions[from]
          const [x2, y2] = positions[to]
          const isBold = shouldHighlightArrow(from, to)

          return (
            <line
              key={`${from}-${to}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isBold ? '#ff4b4b' : '#cccccc'}
              strokeWidth={isBold ? 3 : 2}
              markerEnd={isBold ? 'url(#arrowhead-bold)' : 'url(#arrowhead)'}
            />
          )
        })}

        {/* 노드들 */}
        {DECISION_ORDER.map((nodeId) => {
          const [x, y] = positions[nodeId]
          const count = counts[nodeId as keyof NodeCounts]
          const bgColor = NODE_COLORS[nodeId]
          const textColor = NODE_TEXT[nodeId]
          const borderColor = NODE_BORDER[nodeId]

          return (
            <g key={nodeId}>
              <circle
                cx={x}
                cy={y}
                r={nodeRadius}
                fill={bgColor}
                stroke={borderColor}
                strokeWidth={2}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="20"
                fontWeight="900"
                fill={textColor}
              >
                {count}
              </text>
              <text
                x={x}
                y={y + nodeRadius + 20}
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="#555555"
              >
                {NODE_LABELS[nodeId]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
