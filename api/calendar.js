// Vercel 서버리스 함수.
// 브라우저가 아니라 서버에서 돌기 때문에 CLIENT_SECRET / REFRESH_TOKEN 을 안전하게 쓴다.
//
// 중요: 이 경로는 인터넷에 열려 있다. 토큰을 확인하지 않으면
// 누구나 관리자 캘린더에 일정을 만들 수 있으므로 반드시 관리자인지 검사한다.
//
// 로컬에서는 `vercel dev` 로만 동작한다. `npm run dev`(vite) 로는 안 뜬다.

const TIME_ZONE = 'Asia/Seoul'
const ADMIN_EMAILS = ['kwangjin.owl@gmail.com']

/**
 * access token 을 함수 인스턴스에 잠깐 보관한다.
 *
 * 구글 access token 은 1시간 동안 쓸 수 있는데, 매 요청마다 새로 받아오면
 * 구글 왕복이 한 번 더 생겨 확정 버튼이 눈에 띄게 느려진다.
 * Vercel 함수 인스턴스는 잠시 재사용되므로 그동안은 이 값을 그대로 쓴다.
 * (인스턴스가 새로 뜨면 캐시도 비니 안전하다)
 */
let cachedToken = null
let cachedTokenExpiry = 0

async function getAccessToken() {
  // 만료 1분 전부터는 새로 받는다. 쓰는 도중에 만료되는 것을 막는다.
  if (cachedToken && Date.now() < cachedTokenExpiry - 60_000) {
    return cachedToken
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })

  const json = await res.json()
  if (!res.ok) {
    cachedToken = null
    cachedTokenExpiry = 0
    throw new Error(`토큰 발급 실패: ${json.error} ${json.error_description ?? ''}`)
  }

  cachedToken = json.access_token
  cachedTokenExpiry = Date.now() + (json.expires_in ?? 3600) * 1000
  return cachedToken
}

/** Supabase 에 access token 을 물어 로그인한 사람이 누구인지 확인한다. */
async function getUser(req) {
  const auth = req.headers.authorization ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return null

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (!res.ok) return null

  return res.json()
}

/** 'HH:MM' 에 분을 더해 'HH:MM' 으로 돌려준다. */
function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 만 받습니다' })
  }

  const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'].filter(
    (k) => !process.env[k],
  )
  if (missing.length > 0) {
    return res.status(500).json({ error: `환경변수 누락: ${missing.join(', ')}` })
  }

  try {
    // 관리자 확인과 토큰 준비를 동시에 진행해 왕복 한 번 분량을 줄인다.
    const [user, accessToken] = await Promise.all([getUser(req), getAccessToken()])

    if (!user) {
      return res.status(401).json({ error: '로그인이 필요합니다' })
    }
    if (!ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
      return res.status(403).json({ error: '관리자만 캘린더를 바꿀 수 있습니다' })
    }

    const { action, booking, eventId } = req.body ?? {}

    // ---------- 일정 삭제 ----------
    if (action === 'delete') {
      if (!eventId) {
        return res.status(400).json({ error: 'eventId 가 필요합니다' })
      }

      const delRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
      )

      // 404·410 은 이미 지워진 일정이다. 성공으로 본다.
      if (!delRes.ok && delRes.status !== 404 && delRes.status !== 410) {
        return res.status(delRes.status).json({ error: `캘린더 삭제 실패: HTTP ${delRes.status}` })
      }

      return res.status(200).json({ ok: true })
    }

    // ---------- 일정 생성 ----------
    const { customer, service, date, time, address } = booking ?? {}
    if (!customer || !service || !date || !time) {
      return res.status(400).json({ error: 'customer, service, date, time 은 필수입니다' })
    }

    const event = {
      summary: `${customer} - ${service}`,
      description: [
        `고객사: ${customer}`,
        `서비스: ${service}`,
        address ? `주소: ${address}` : null,
        '',
        '예약 관리 허브에서 확정됨',
      ]
        .filter(Boolean)
        .join('\n'),
      start: { dateTime: `${date}T${time}:00`, timeZone: TIME_ZONE },
      // 기본 1시간. 길이를 바꾸려면 60 을 고친다.
      end: { dateTime: `${date}T${addMinutes(time, 60)}:00`, timeZone: TIME_ZONE },
    }
    if (address) event.location = address

    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    )

    const calJson = await calRes.json()

    // 토큰이 서버에서 미리 만료됐다면 캐시를 버려 다음 요청에서 새로 받게 한다.
    if (calRes.status === 401) {
      cachedToken = null
      cachedTokenExpiry = 0
    }

    if (!calRes.ok) {
      const message = calJson.error?.message ?? `HTTP ${calRes.status}`
      return res.status(calRes.status).json({ error: `캘린더 등록 실패: ${message}` })
    }

    return res.status(200).json({ ok: true, eventId: calJson.id, htmlLink: calJson.htmlLink })
  } catch (err) {
    console.error('[api/calendar]', err)
    return res.status(500).json({ error: err.message ?? '알 수 없는 오류' })
  }
}