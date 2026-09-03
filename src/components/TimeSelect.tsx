interface TimeSelectProps {
  /** 'HH:MM' 형식 */
  value: string
  onChange: (value: string) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

/**
 * 시·분을 각각 고르는 시간 입력.
 *
 * <input type="time"> 은 데스크톱 크롬에서 오전/오후·시·분 휠을 각각 굴린 뒤
 * 바깥을 눌러야 닫히기 때문에, 클릭 수가 많고 닫는 방법도 직관적이지 않다.
 * 드롭다운 두 개면 각각 한 번에 고르고 끝난다.
 */
export default function TimeSelect({ value, onChange }: TimeSelectProps) {
  const [rawHour = '', rawMinute = ''] = (value || '').split(':')
  const hour = rawHour.padStart(2, '0')
  const minute = rawMinute.padStart(2, '0')

  // 기존 데이터에 16:53 처럼 5분 단위가 아닌 값이 있을 수 있다.
  // 목록에 없으면 그 값을 그대로 한 줄 끼워 넣어, 열었다 닫아도 시간이 바뀌지 않게 한다.
  const minuteOptions = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES

  const selectClass =
    'flex-1 px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all cursor-pointer appearance-none text-center'

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="시"
        value={hour}
        onChange={(e) => onChange(`${e.target.value}:${minute || '00'}`)}
        className={selectClass}
      >
        <option value="" disabled>
          시
        </option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}시
          </option>
        ))}
      </select>

      <span className="font-black text-[#777777]">:</span>

      <select
        aria-label="분"
        value={minute}
        onChange={(e) => onChange(`${hour || '00'}:${e.target.value}`)}
        className={selectClass}
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
