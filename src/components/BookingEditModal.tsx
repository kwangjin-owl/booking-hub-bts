import { useCallback, useEffect, useState } from 'react'
import LocationPicker from './LocationPicker'
import TimeSelect from './TimeSelect'

export interface EditableBooking {
  id: number
  customer: string
  service: string
  date: string
  time: string
  address?: string | null
  detail_address?: string | null
  status: string
}

export interface EditDraft {
  customer: string
  service: string
  date: string
  time: string
  address: string
  detailAddress: string
}

interface BookingEditModalProps {
  booking: EditableBooking
  saving: boolean
  onCancel: () => void
  onSave: (draft: EditDraft) => void
}

export default function BookingEditModal({
  booking,
  saving,
  onCancel,
  onSave,
}: BookingEditModalProps) {
  const initial: EditDraft = {
    customer: booking.customer,
    service: booking.service,
    date: booking.date,
    time: booking.time,
    address: booking.address ?? '',
    detailAddress: booking.detail_address ?? '',
  }

  const [draft, setDraft] = useState<EditDraft>(initial)
  const [error, setError] = useState('')

  const isDirty = (Object.keys(initial) as (keyof EditDraft)[]).some(
    (k) => draft[k] !== initial[k],
  )

  /** 고친 내용이 있으면 실수로 닫는 것을 한 번 막는다. */
  const requestClose = useCallback(() => {
    if (saving) return
    if (isDirty && !window.confirm('수정한 내용이 저장되지 않았습니다. 닫을까요?')) return
    onCancel()
  }, [isDirty, saving, onCancel])

  // Esc 로 닫고, 열려 있는 동안 뒷배경 스크롤을 막는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [requestClose])

  const handleSave = () => {
    if (!draft.customer || !draft.service || !draft.date || !draft.time) {
      setError('고객사, 서비스, 날짜, 시간은 비울 수 없습니다.')
      return
    }
    setError('')
    onSave(draft)
  }

  const inputClass =
    'w-full px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all'
  const labelClass = 'block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-['Pretendard',sans-serif]">
      {/* 뒷배경. 클릭하면 닫힌다 */}
      <div className="fixed inset-0 bg-black/40" onClick={requestClose} aria-hidden="true" />

      {/* 화면보다 길어지지 않게 높이를 묶고, 본문만 스크롤시킨다.
          저장·취소 버튼은 항상 아래에 붙어 있다. */}
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_10px_0_#d0d0d0]">
        {/* 머리말 */}
        <div className="flex items-start justify-between gap-4 p-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1cb0f6] flex items-center justify-center text-white text-xl font-black shadow-[0_3px_0_#0d99dc] flex-shrink-0">
              ✏️
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#042c60]">예약 수정</h2>
              <p className="text-xs text-[#777777] font-bold">
                {booking.status === 'confirmed'
                  ? '확정된 예약입니다. 저장하면 구글 캘린더 일정도 함께 갱신됩니다.'
                  : '대기 중인 예약입니다. 캘린더에는 아직 등록되지 않았습니다.'}
              </p>
            </div>
          </div>
          <button
            onClick={requestClose}
            aria-label="닫기"
            className="w-9 h-9 rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] text-[#777777] font-black hover:bg-[#ff4b4b] hover:text-white hover:border-[#ff4b4b] transition-colors flex items-center justify-center cursor-pointer flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-8">
          {error && (
            <div className="mb-6 p-4 bg-[#ff4b4b]/10 border-2 border-[#ff4b4b] rounded-2xl text-[#ff4b4b] text-xs font-black">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>고객사 *</label>
              <input
                className={inputClass}
                value={draft.customer}
                onChange={(e) => setDraft({ ...draft, customer: e.target.value })}
              />
            </div>

            <div>
              <label className={labelClass}>서비스 *</label>
              <input
                className={inputClass}
                value={draft.service}
                onChange={(e) => setDraft({ ...draft, service: e.target.value })}
              />
            </div>

            <div>
              <label className={labelClass}>날짜 *</label>
              <input
                type="date"
                className={inputClass}
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>

            <div>
              <label className={labelClass}>시간 *</label>
              <TimeSelect
                value={draft.time}
                onChange={(time) => setDraft({ ...draft, time })}
              />
            </div>

            {/* 예약추가 폼과 같은 주소 선택기를 쓴다 */}
            <div className="md:col-span-2">
              <label className={labelClass}>주소</label>
              <LocationPicker
                value={draft.address}
                onChange={(address) => setDraft({ ...draft, address })}
                detail={draft.detailAddress}
                onDetailChange={(detailAddress) => setDraft({ ...draft, detailAddress })}
              />
            </div>
          </div>
        </div>

        {/* 꼬리말 */}
        <div className="flex gap-3 p-8 pt-4 border-t-2 border-[#e5e5e5] mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] bg-[#58cc02] hover:bg-[#46a302] disabled:bg-gray-300 text-white font-black py-4 px-6 rounded-2xl transition-all uppercase tracking-wider text-sm shadow-[0_4px_0_#46a302] active:translate-y-[4px] active:shadow-none cursor-pointer"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={requestClose}
            disabled={saving}
            className="flex-1 bg-white text-[#777777] border-2 border-[#e5e5e5] hover:border-[#afafaf] font-black py-4 rounded-2xl transition-all uppercase tracking-wider text-sm shadow-[0_4px_0_#e5e5e5] active:translate-y-[4px] active:shadow-none cursor-pointer"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
