/**
 * 판정 결과에 맞춰 구글 캘린더를 따라오게 한다.
 *
 *   확정-자동 / 확정-수동  -> 일정 생성 (없을 때만)
 *   그 밖의 상태            -> 일정 삭제
 *
 * 전에는 판정과 캘린더가 따로 놀아서, 대시보드에 '확정-자동' 이 떠도
 * 예약 관리 탭에서 버튼을 한 번 더 눌러야 일정이 생겼다. 그 두 단계를 없앤다.
 *
 * 규칙 하나: 캘린더가 실패해도 판정 자체는 되돌리지 않는다.
 * 일정은 나중에 다시 올리면 되지만, 판정이 사라지면 배정이 꼬인다.
 */
import { supabase } from '../supabaseClient'
import { addBookingToCalendar, removeBookingFromCalendar } from './calendar'
import { slotSpan } from './slots'
import type { BookingRow } from './types'

export interface SyncResult {
  /** 실제로 뭔가 했는지 */
  changed: boolean
  /** 사람에게 보여줄 한 줄. 실패했을 때만 채운다. */
  error?: string
  /** 화면에서 들고 있는 행을 갱신할 값 */
  patch?: Partial<BookingRow>
}

function isConfirmed(decision: string | null | undefined): boolean {
  return decision === 'confirmed_auto' || decision === 'confirmed_human'
}

/**
 * 예약 한 건의 캘린더 상태를 판정 결과에 맞춘다.
 *
 * DB 갱신(calendar_event_id, status)까지 여기서 한다.
 * status 도 같이 맞춰야 예약 관리 탭의 상태 배지가 판정과 어긋나지 않는다.
 */
export async function syncCalendar(booking: BookingRow): Promise<SyncResult> {
  const confirmed = isConfirmed(booking.decision)
  const eventId = booking.calendar_event_id

  // 1) 확정인데 아직 일정이 없다 -> 만든다
  if (confirmed && !eventId) {
    const span = slotSpan(booking.slot_assigned)
    // 옛 예약은 슬롯 대신 시각을 들고 있다
    const start = span?.start ?? booking.time
    if (!start) {
      return { changed: false, error: `${booking.customer}: 배정된 칸이 없어 캘린더에 올리지 못했습니다` }
    }

    const result = await addBookingToCalendar({
      customer: booking.customer,
      service: booking.service || booking.memo || '예약',
      date: booking.date,
      time: start,
      endTime: span?.end,
      address: [booking.address, booking.detail_address].filter(Boolean).join(' '),
    })

    if (!result.ok) {
      return { changed: false, error: `${booking.customer}: 캘린더 등록 실패 - ${result.error}` }
    }

    const patch = { calendar_event_id: result.eventId ?? null, status: 'confirmed' }
    const { error } = await supabase.from('bookings').update(patch).eq('id', booking.id)
    if (error) {
      return { changed: true, error: `캘린더에는 올렸지만 저장에 실패했습니다: ${error.message}` }
    }
    return { changed: true, patch }
  }

  // 2) 확정이 아닌데 일정이 남아 있다 -> 지운다
  if (!confirmed && eventId) {
    const result = await removeBookingFromCalendar(eventId)

    // 지우지 못해도 id 는 비운다. 남겨두면 다시 확정할 때 새로 못 만든다.
    // 캘린더에 남은 일정은 직접 지우면 된다.
    const patch = { calendar_event_id: null, status: 'pending' }
    await supabase.from('bookings').update(patch).eq('id', booking.id)

    if (!result.ok) {
      return {
        changed: true,
        patch,
        error: `${booking.customer}: 캘린더 일정 삭제 실패 - ${result.error} (구글 캘린더에서 직접 지워주세요)`,
      }
    }
    return { changed: true, patch }
  }

  // 3) 확정인데 이미 일정이 있고, status 만 어긋난 경우를 맞춰 둔다
  const wantStatus = confirmed ? 'confirmed' : 'pending'
  if (booking.status !== wantStatus) {
    const patch = { status: wantStatus }
    await supabase.from('bookings').update(patch).eq('id', booking.id)
    return { changed: true, patch }
  }

  return { changed: false }
}
