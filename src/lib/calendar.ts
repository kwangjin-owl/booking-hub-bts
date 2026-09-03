import { supabase } from '../supabaseClient'

export interface CalendarBooking {
  customer: string
  service: string
  date: string
  time: string
  address?: string | null
}

export interface CalendarResult {
  ok: boolean
  eventId?: string
  error?: string
}

/** 서버 함수는 로그인한 관리자만 받아준다. 그래서 access token 을 같이 보낸다. */
async function authHeaders(): Promise<Record<string, string> | null> {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) return null
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function callCalendar(body: unknown): Promise<CalendarResult> {
  try {
    const headers = await authHeaders()
    if (!headers) {
      return { ok: false, error: '로그인이 필요합니다' }
    }

    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    // vite dev 서버에는 /api 가 없어서 index.html 이 돌아온다.
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

    return { ok: true, eventId: json.eventId }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : '캘린더 연동 중 오류',
    }
  }
}

/** 예약을 확정할 때 구글 캘린더에 일정을 만든다. */
export function addBookingToCalendar(booking: CalendarBooking) {
  return callCalendar({ action: 'create', booking })
}

/** 확정을 되돌리거나 예약을 지울 때 캘린더 일정도 지운다. */
export function removeBookingFromCalendar(eventId: string) {
  return callCalendar({ action: 'delete', eventId })
}
