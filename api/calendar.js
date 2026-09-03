// Vercel 서버리스 함수. 브라우저가 아니라 서버에서 돌기 때문에
// GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN 을 안전하게 쓸 수 있다.
//
// 로컬에서는 `vercel dev` 로만 동작한다. `npm run dev`(vite) 로는 이 경로가 안 뜬다.

const TIME_ZONE = 'Asia/Seoul'

/** refresh token 으로 1시간짜리 access token 을 받아온다. */
async function getAccessToken() {
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
    throw new Error(`토큰 발급 실패: ${json.error} ${json.error_description ?? ''}`)
  }
  return json.access_token
}

/** 'HH:MM' 에 duration 분을 더해 'HH:MM' 으로 돌려준다. */
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

  // 환경변수가 하나라도 비면 원인을 바로 알려준다.
  const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'].filter(
    (k) => !process.env[k],
  )
  if (missing.length > 0) {
    return res.status(500).json({ error: `환경변수 누락: ${missing.join(', ')}` })
  }

  try {
    const { customer, service, date, time, address } = req.body ?? {}

    if (!customer || !service || !date || !time) {
      return res.status(400).json({ error: 'customer, service, date, time 은 필수입니다' })
    }

    const accessToken = await getAccessToken()

    const event = {
      summary: `${customer} - ${service}`,
      description: [
        `고객사: ${customer}`,
        `서비스: ${service}`,
        address ? `주소: ${address}` : null,
        '',
        '예약 관리 허브에서 자동 등록됨',
      ]
        .filter(Boolean)
        .join('\n'),
      start: { dateTime: `${date}T${time}:00`, timeZone: TIME_ZONE },
      // 기본 1시간짜리로 잡는다. 길이를 바꾸려면 60 을 고친다.
      end: { dateTime: `${date}T${addMinutes(time, 60)}:00`, timeZone: TIME_ZONE },
    }

    if (address) {
      event.location = address
    }

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

    if (!calRes.ok) {
      const message = calJson.error?.message ?? `HTTP ${calRes.status}`
      return res.status(calRes.status).json({ error: `캘린더 등록 실패: ${message}` })
    }

    return res.status(200).json({
      ok: true,
      eventId: calJson.id,
      htmlLink: calJson.htmlLink,
    })
  } catch (err) {
    console.error('[api/calendar]', err)
    return res.status(500).json({ error: err.message ?? '알 수 없는 오류' })
  }
}
