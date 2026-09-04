/**
 * 예약 추가 폼의 입력 검사. 빈 칸이 있으면 'ask' - 버튼을 잠근다.
 * (판정은 decide.ts 다. 여기는 "보낼 수 있는가" 만 본다)
 */
export interface JudgeResult {
  route: 'ask' | 'book'
  message: string
  badgeColor: 'blue' | 'green'
}

export interface JudgeInput {
  customer: string
  kind: string
  form: string
  memo: string
  address: string
  date: string
  slotsWanted: string[]
}

export function judge(data: JudgeInput): JudgeResult {
  const missing: string[] = []

  if (!data.customer.trim()) missing.push('고객사')
  if (!data.kind) missing.push('종류')
  if (!data.form) missing.push('형태')
  if (!data.date) missing.push('날짜')
  if (data.slotsWanted.length === 0) missing.push('희망 슬롯')
  // 온라인이면 위치가 없어도 된다
  if (data.form === '외근' && !data.address.trim()) missing.push('위치')

  if (missing.length > 0) {
    return { route: 'ask', message: `빈 칸: ${missing.join(', ')}`, badgeColor: 'blue' }
  }
  return { route: 'book', message: '예약 가능', badgeColor: 'green' }
}
