import { DECISION_LABELS, DECISION_NODE } from '../lib/decisionMeta'
import type { Decision } from '../lib/types'

export type GraphNode = 'intake' | 'judge' | Decision

interface WorkflowGraphProps {
  counts: Record<GraphNode, number>
  /** 굵게 그릴 화살표 id 들 ("from>to"). 다음 판정까지 유지된다. */
  activeEdges: string[]
  /** 값이 바뀌면 굵어지는 애니메이션이 처음부터 다시 돈다 */
  pulseKey: number
}

const R = 28
const W = 760
const H = 420

/** 노드 위치. 왼쪽 세 개는 한 줄, 결과 다섯 개는 오른쪽 세로 한 줄. */
const POS: Record<GraphNode, { x: number; y: number }> = {
  intake: { x: 70, y: 200 },
  pending: { x: 220, y: 200 },
  judge: { x: 370, y: 200 },
  confirmed_auto: { x: 560, y: 40 },
  confirmed_human: { x: 560, y: 120 },
  review: { x: 560, y: 200 },
  rejected: { x: 560, y: 280 },
  asking: { x: 560, y: 360 },
}

const LABEL: Record<GraphNode, string> = {
  intake: '접수',
  judge: '판정',
  ...DECISION_LABELS,
}

const STYLE: Record<GraphNode, { fill: string; stroke: string; text: string }> = {
  intake: { fill: '#3c3c3c', stroke: '#3c3c3c', text: '#ffffff' },
  judge: { fill: '#ffffff', stroke: '#000000', text: '#000000' },
  ...DECISION_NODE,
}

interface Edge {
  id: string
  d: string
  /** 되돌아가는 화살표는 점선 */
  dashed?: boolean
  /** 화살표 옆 작은 설명 */
  note?: { x: number; y: number; text: string }
}

/** 두 원 사이의 직선. 원 테두리에서 시작해 원 테두리에서 끝나야 화살촉이 보인다. */
function straight(from: GraphNode, to: GraphNode): string {
  const a = POS[from]
  const b = POS[to]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  return `M ${a.x + ux * R} ${a.y + uy * R} L ${b.x - ux * R} ${b.y - uy * R}`
}

const EDGES: Edge[] = [
  { id: 'intake>pending', d: straight('intake', 'pending') },
  { id: 'pending>judge', d: straight('pending', 'judge') },
  { id: 'judge>confirmed_auto', d: straight('judge', 'confirmed_auto') },
  { id: 'judge>confirmed_human', d: straight('judge', 'confirmed_human') },
  { id: 'judge>review', d: straight('judge', 'review') },
  { id: 'judge>rejected', d: straight('judge', 'rejected') },
  { id: 'judge>asking', d: straight('judge', 'asking') },
  // 자동 off 면 판정이 후보만 잡고 대기로 돌려보낸다. 아래로 살짝 돌아가는 곡선.
  {
    id: 'judge>pending',
    d: `M ${POS.judge.x - 14} ${POS.judge.y + R - 4} Q 295 275 ${POS.pending.x + 14} ${POS.pending.y + R - 4}`,
    dashed: true,
    note: { x: 295, y: 262, text: '자동 off: 후보만' },
  },
  // 검토 -> 확정-수동 (사람이 고름). 오른쪽으로 돌아 올라간다.
  {
    id: 'review>confirmed_human',
    d: `M ${POS.review.x + R} ${POS.review.y} Q 640 160 ${POS.confirmed_human.x + R} ${POS.confirmed_human.y}`,
    note: { x: 648, y: 164, text: '사람이 고름' },
  },
  // 질문 -> 대기 (답이 오면). 아래로 크게 돌아간다.
  {
    id: 'asking>pending',
    d: `M ${POS.asking.x - 20} ${POS.asking.y + 20} Q 330 420 ${POS.pending.x} ${POS.pending.y + R}`,
    dashed: true,
    note: { x: 380, y: 372, text: '답이 오면' },
  },
  // 확정-수동 -> 대기 (사람이 되돌림). 위로 크게 돌아간다.
  {
    id: 'confirmed_human>pending',
    d: `M ${POS.confirmed_human.x - 20} ${POS.confirmed_human.y - 20} Q 330 10 ${POS.pending.x} ${POS.pending.y - R}`,
    dashed: true,
    note: { x: 330, y: 36, text: '사람이 되돌림' },
  },
]

const ORDER: GraphNode[] = [
  'intake',
  'pending',
  'judge',
  'confirmed_auto',
  'confirmed_human',
  'review',
  'rejected',
  'asking',
]

/**
 * 상태를 노드로, 전이를 화살표로 그린 LangGraph 식 흐름도. 라이브러리 없이 SVG 다.
 * 원 안의 숫자는 지금 그 상태인 예약 수. 마지막 판정이 지나간 화살표는 굵게 남는다.
 */
export default function WorkflowGraph({ counts, activeEdges, pulseKey }: WorkflowGraphProps) {
  const active = new Set(activeEdges)

  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-[#e5e5e5] shadow-[0_4px_0_#e5e5e5]">
      <div className="mb-3">
        <h3 className="text-lg font-black text-[#042c60]">판정 흐름도</h3>
        <p className="text-xs text-[#777777] font-bold mt-1">
          원 안은 지금 그 상태인 예약 수 · 굵은 화살표는 마지막 판정이 지나간 길
        </p>
      </div>

      <style>{`
        @keyframes wf-pulse {
          0%   { stroke-width: 7; }
          70%  { stroke-width: 7; }
          100% { stroke-width: 3.5; }
        }
        .wf-active { animation: wf-pulse 2s ease-out forwards; }
      `}</style>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="판정 흐름도">
        <defs>
          <marker id="wf-arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L8,4 L0,8 z" fill="#afafaf" />
          </marker>
          <marker id="wf-arrow-active" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L10,5 L0,10 z" fill="#042c60" />
          </marker>
        </defs>

        {EDGES.map((e) => {
          const on = active.has(e.id)
          return (
            <g key={e.id}>
              <path
                key={on ? `${e.id}-${pulseKey}` : e.id}
                d={e.d}
                fill="none"
                stroke={on ? '#042c60' : '#c8c8c8'}
                strokeWidth={on ? 3.5 : 2}
                strokeDasharray={e.dashed && !on ? '6 5' : undefined}
                strokeLinecap="round"
                markerEnd={on ? 'url(#wf-arrow-active)' : 'url(#wf-arrow)'}
                className={on ? 'wf-active' : undefined}
              />
              {e.note && (
                <text
                  x={e.note.x}
                  y={e.note.y}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill={on ? '#042c60' : '#9a9a9a'}
                >
                  {e.note.text}
                </text>
              )}
            </g>
          )
        })}

        {ORDER.map((id) => {
          const { x, y } = POS[id]
          const s = STYLE[id]
          const n = id === 'judge' ? null : counts[id]
          return (
            <g key={id}>
              <circle cx={x} cy={y} r={R} fill={s.fill} stroke={s.stroke} strokeWidth={3} />
              <text
                x={x}
                y={y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={n === null ? 14 : 18}
                fontWeight="900"
                fill={s.text}
              >
                {n === null ? '?' : n}
              </text>
              <text
                x={x}
                y={y + R + 15}
                textAnchor="middle"
                fontSize="11"
                fontWeight="800"
                fill="#3c3c3c"
              >
                {LABEL[id]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
