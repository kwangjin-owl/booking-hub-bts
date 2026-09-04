/** bookings 표 한 줄. 화면 여러 곳이 같은 모양을 쓰므로 한 곳에 둔다. */

export type Decision =
  | 'pending'
  | 'confirmed_auto'
  | 'confirmed_human'
  | 'review'
  | 'rejected'
  | 'asking'

export interface BookingRow {
  id: number
  customer: string
  service: string
  date: string
  time: string
  address: string | null
  detail_address: string | null
  status: string
  via: string
  created_at: string
  user_id: string | null
  calendar_event_id: string | null

  // 슬롯 모델 (db/05_slots.sql)
  kind: string | null
  form: string | null
  memo: string | null
  slots_wanted: string | null
  decision: Decision | null
  reason: string | null
  options: string | null
  candidate: string | null
  slot_assigned: string | null
  trace: string | null
}
