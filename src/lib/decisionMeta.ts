import type { Decision } from './types'

/** decision 값의 한글 이름과 배지 색. 보드·로그·흐름도가 전부 같은 색을 써야 한다. */
export const DECISION_LABELS: Record<Decision, string> = {
  pending: '대기',
  confirmed_auto: '확정-자동',
  confirmed_human: '확정-수동',
  review: '검토',
  rejected: '기각',
  asking: '질문',
}

export const DECISION_BADGE: Record<Decision, string> = {
  pending: 'bg-[#e5e5e5] text-[#3c3c3c]',
  confirmed_auto: 'bg-[#58cc02] text-white',
  confirmed_human: 'bg-white border-2 border-[#58cc02] text-[#58a700]',
  review: 'bg-[#ffc800] text-[#042c60]',
  rejected: 'bg-[#ff4b4b] text-white',
  asking: 'bg-[#1cb0f6] text-white',
}

/** SVG 흐름도에서 쓰는 원 색 */
export const DECISION_NODE: Record<Decision, { fill: string; stroke: string; text: string }> = {
  pending: { fill: '#e5e5e5', stroke: '#afafaf', text: '#3c3c3c' },
  confirmed_auto: { fill: '#58cc02', stroke: '#46a302', text: '#ffffff' },
  confirmed_human: { fill: '#ffffff', stroke: '#58cc02', text: '#58a700' },
  review: { fill: '#ffc800', stroke: '#e0b000', text: '#042c60' },
  rejected: { fill: '#ff4b4b', stroke: '#d33', text: '#ffffff' },
  asking: { fill: '#1cb0f6', stroke: '#0d99dc', text: '#ffffff' },
}

export function isDecision(v: unknown): v is Decision {
  return typeof v === 'string' && v in DECISION_LABELS
}

export function decisionLabel(v: string | null | undefined): string {
  return isDecision(v) ? DECISION_LABELS[v] : (v ?? '-')
}

export function decisionBadge(v: string | null | undefined): string {
  return isDecision(v) ? DECISION_BADGE[v] : 'bg-[#e5e5e5] text-[#777777]'
}
