/**
 * 예약 하나를 구글 캘린더에 등록한다.
 *
 * 캘린더 등록이 실패해도 예약 자체는 이미 저장된 상태이므로,
 * 여기서는 예외를 던지지 않고 실패 사유만 돌려준다.
 */
export interface CalendarBooking {
  customer: string
  service: string
  date: string
  time: string
  address?: string | null
}

export interface CalendarResult {
  ok: boolean
  htmlLink?: string
  error?: string
}

export async function addBookingToCalendar(
  booking: CalendarBooking,
): Promise<CalendarResult> {
  try {
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    })

    // vite dev 서버에는 /api 가 없어서 index.html 이 돌아온다.
    // 그때 res.json() 이 터지므로 먼저 형식을 본다.
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        error: '캘린더 서버가 응답하지 않습니다 (로컬이면 vercel dev 로 실행하세요)',
      }
    }

    const json = await res.json()

    if (!res.ok) {
      return { ok: false, error: json.error ?? `HTTP ${res.status}` }
    }

    return { ok: true, htmlLink: json.htmlLink }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : '캘린더 연동 중 오류',
    }
  }
}
