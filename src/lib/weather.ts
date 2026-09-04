/**
 * 주소 + 날짜 -> 그 날 예보.
 *
 * WeatherCard 안에만 있던 것을 꺼냈다. 예약 목록에서도 같은 걸 쓰기 때문이다.
 *
 * 주의할 점 둘:
 * - Nominatim 은 초당 1회 제한이다. 목록에 20건이 있으면 동시에 부르면 전부 막힌다.
 *   그래서 요청을 한 줄로 세워 1.2초 간격으로 하나씩 보낸다.
 * - 같은 주소·같은 날을 여러 화면이 물어본다. 한 번 받은 것은 기억해 둔다.
 */

export interface Weather {
  code: number
  max: number
  min: number
  rainChance: number
}

/** 성공하면 Weather, 실패하면 사유 문자열 */
export type WeatherResult = Weather | string

/** WMO 날씨 코드를 아이콘과 한글 설명으로 */
export function describe(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: '맑음' }
  if (code <= 2) return { icon: '🌤️', label: '구름 조금' }
  if (code === 3) return { icon: '☁️', label: '흐림' }
  if (code <= 48) return { icon: '🌫️', label: '안개' }
  if (code <= 57) return { icon: '🌦️', label: '이슬비' }
  if (code <= 67) return { icon: '🌧️', label: '비' }
  if (code <= 77) return { icon: '🌨️', label: '눈' }
  if (code <= 82) return { icon: '🌧️', label: '소나기' }
  if (code <= 86) return { icon: '🌨️', label: '소낙눈' }
  return { icon: '⛈️', label: '뇌우' }
}

/** 비·눈이 오거나 강수 확률이 높으면 목록에서 눈에 띄게 한다. */
export function isWet(w: Weather): boolean {
  return w.rainChance >= 50 || (w.code >= 51 && w.code <= 99)
}

export interface Coords {
  lat: number
  lon: number
}

const geoCache = new Map<string, Coords | null>()
const weatherCache = new Map<string, WeatherResult>()

// Nominatim 초당 1회 제한. 앞 요청이 끝나고 조금 기다렸다 다음을 보낸다.
let queue: Promise<unknown> = Promise.resolve()
const GAP_MS = 1200

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work)
  // 실패해도 줄이 멈추면 안 된다.
  queue = run.then(
    () => new Promise((r) => setTimeout(r, GAP_MS)),
    () => new Promise((r) => setTimeout(r, GAP_MS)),
  )
  return run
}

/** 주소 -> 좌표. 한 번 찾은 주소는 다시 묻지 않는다. */
export async function geocode(address: string): Promise<Coords | null> {
  const key = address.trim()
  if (!key) return null
  const cached = geoCache.get(key)
  if (cached !== undefined) return cached

  const found = await enqueue(async () => {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.append('q', key)
    url.searchParams.append('format', 'json')
    url.searchParams.append('limit', '1')
    url.searchParams.append('countrycodes', 'kr')
    url.searchParams.append('accept-language', 'ko')

    const res = await fetch(url.toString())
    const json = await res.json()
    if (!json?.[0]) return null
    return { lat: Number(json[0].lat), lon: Number(json[0].lon) }
  })

  geoCache.set(key, found)
  return found
}

export interface CurrentWeather {
  code: number
  temp: number
  feels: number
  /** 지금 내리고 있는 양 (mm) */
  precip: number
}

/** 좌표 -> 지금 날씨. 예보와 달리 캐시하지 않는다 (지금 값이어야 의미가 있다). */
export async function fetchCurrent(c: Coords): Promise<CurrentWeather | string> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.append('latitude', String(c.lat))
    url.searchParams.append('longitude', String(c.lon))
    url.searchParams.append(
      'current',
      'temperature_2m,apparent_temperature,weather_code,precipitation',
    )
    url.searchParams.append('timezone', 'Asia/Seoul')

    const cur = (await (await fetch(url.toString())).json())?.current
    if (cur?.weather_code === undefined || cur.weather_code === null) return '지금 날씨를 못 받음'

    return {
      code: cur.weather_code,
      temp: Math.round(cur.temperature_2m),
      feels: Math.round(cur.apparent_temperature),
      precip: cur.precipitation ?? 0,
    }
  } catch {
    return '지금 날씨를 못 받음'
  }
}

/** 좌표 + 날짜 -> 그 날 예보. Open-Meteo 는 키가 필요 없고 제한도 넉넉하다. */
export async function fetchDaily(c: Coords, date: string): Promise<WeatherResult> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.append('latitude', String(c.lat))
  url.searchParams.append('longitude', String(c.lon))
  url.searchParams.append(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  )
  url.searchParams.append('timezone', 'Asia/Seoul')
  url.searchParams.append('start_date', date)
  url.searchParams.append('end_date', date)

  const daily = (await (await fetch(url.toString())).json())?.daily
  const code = daily?.weather_code?.[0]
  if (code === undefined || code === null) {
    // Open-Meteo 는 보통 16일치까지만 준다.
    return '예보 범위 밖'
  }

  return {
    code,
    max: Math.round(daily.temperature_2m_max[0]),
    min: Math.round(daily.temperature_2m_min[0]),
    rainChance: daily.precipitation_probability_max?.[0] ?? 0,
  }
}

/** 주소와 날짜로 예보 한 건. 실패 사유도 문자열로 돌려준다(화면에 그대로 보여준다). */
export async function getWeather(
  address: string | null | undefined,
  date: string,
): Promise<WeatherResult> {
  if (!address) return '주소 없음'
  if (!date) return '날짜 없음'

  const key = `${address}|${date}`
  const cached = weatherCache.get(key)
  if (cached !== undefined) return cached

  let result: WeatherResult
  try {
    const c = await geocode(address)
    result = c ? await fetchDaily(c, date) : '위치를 찾지 못함'
  } catch {
    result = '날씨를 불러오지 못함'
  }

  // 실패는 기억하지 않는다. 잠깐 끊긴 것일 수 있어 다음에 다시 시도한다.
  if (typeof result !== 'string') weatherCache.set(key, result)
  return result
}

/** 로컬 기준 오늘 'YYYY-MM-DD'. toISOString 은 UTC 라 하루가 밀린다. */
export function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 예보가 나오는 범위인지 (오늘부터 16일). 범위 밖이면 아예 부르지 않는다. */
export function inForecastRange(date: string): boolean {
  const today = todayString()
  if (date < today) return false
  const limit = new Date()
  limit.setDate(limit.getDate() + 15)
  const limitStr = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`
  return date <= limitStr
}
