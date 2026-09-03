interface TimeSelectProps {
  /** 'HH:MM' 24시간 형식으로 주고받는다. 화면에만 오전/오후로 보여준다. */
  value: string
  onChange: (value: string) => void
}

const MERIDIEMS = [
  { value: 'AM', label: '오전' },
  { value: 'PM', label: '오후' },
]
const HOURS12 = Array.from({ length: 12 }, (_, i) => i + 1) // 1~12
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

/** 'HH:MM'(24h) -> { meridiem, hour12, minute } */
function parse(value: string) {
  const [h = '', m = ''] = (value || '').split(':')
  if (h === '') return { meridiem: '', hour12: '', minute: '' }

  const hour24 = Number(h)
  const meridiem = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

  return { meridiem, hour12: String(hour12), minute: m.padStart(2, '0') }
}

/** { meridiem, hour12, minute } -> 'HH:MM'(24h) */
function build(meridiem: string, hour12: string, minute: string) {
  const h12 = Number(hour12 || 12)
  let hour24 = h12 % 12
  if (meridiem === 'PM') hour24 += 12
  return `${String(hour24).padStart(2, '0')}:${minute || '00'}`
}

/**
 * 오전/오후 · 시 · 분을 각각 고르는 시간 입력.
 *
 * <input type="time"> 은 데스크톱 크롬에서 휠 세 개를 굴린 뒤 바깥을 눌러야 닫힌다.
 * 드롭다운이면 각각 한 번에 고르고 끝나고, 24시간 목록처럼 길어지지도 않는다.
 */
export default function TimeSelect({ value, onChange }: TimeSelectProps) {
  const { meridiem, hour12, minute } = parse(value)

  // 기존 데이터에 16:53 처럼 5분 단위가 아닌 값이 있을 수 있다.
  // 목록에 없으면 그 값을 끼워 넣어, 열었다 닫아도 시간이 바뀌지 않게 한다.
  const minuteOptions = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES

  const selectClass =
    'px-3 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all cursor-pointer appearance-none text-center'

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="오전 오후"
        value={meridiem}
        onChange={(e) => onChange(build(e.target.value, hour12 || '9', minute))}
        className={`${selectClass} flex-1`}
      >
        <option value="" disabled>
          --
        </option>
        {MERIDIEMS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <select
        aria-label="시"
        value={hour12}
        onChange={(e) => onChange(build(meridiem || 'AM', e.target.value, minute))}
        className={`${selectClass} flex-1`}
      >
        <option value="" disabled>
          시
        </option>
        {HOURS12.map((h) => (
          <option key={h} value={h}>
            {h}시
          </option>
        ))}
      </select>

      <select
        aria-label="분"
        value={minute}
        onChange={(e) => onChange(build(meridiem || 'AM', hour12 || '9', e.target.value))}
        className={`${selectClass} flex-1`}
      >
        <option value="" disabled>
          분
        </option>
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {m}분
          </option>
        ))}
      </select>
    </div>
  )
}
