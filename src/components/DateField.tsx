import { useRef } from 'react'

interface DateFieldProps {
  value: string
  onChange: (date: string) => void
  className?: string
  min?: string
}

/**
 * 날짜 입력.
 *
 * 기본 <input type="date"> 는 오른쪽 끝 작은 달력 아이콘을 정확히 눌러야만 달력이 열린다.
 * 칸 아무 데나 눌러도 열리도록 showPicker() 를 직접 부른다.
 * (showPicker 가 없는 브라우저에서는 원래대로 아이콘을 누르면 된다)
 */
export default function DateField({ value, onChange, className = '', min }: DateFieldProps) {
  const ref = useRef<HTMLInputElement>(null)

  const openPicker = () => {
    const el = ref.current
    if (!el) return
    try {
      el.showPicker?.()
    } catch {
      // 사용자 제스처 없이 부르면 브라우저가 막는다. 그때는 그냥 포커스만 준다.
      el.focus()
    }
  }

  return (
    <input
      ref={ref}
      type="date"
      value={value}
      min={min}
      onChange={(e) => onChange(e.target.value)}
      onClick={openPicker}
      onFocus={openPicker}
      className={`cursor-pointer ${className}`}
    />
  )
}
