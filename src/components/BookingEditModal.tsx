import { useEffect, useState } from 'react'
import AddressSearch from './AddressSearch'
import MapView from './MapView'

export interface EditableBooking {
  id: number
  customer: string
  service: string
  date: string
  time: string
  address?: string | null
  status: string
}

export interface EditDraft {
  customer: string
  service: string
  date: string
  time: string
  address: string
}

interface AddressResult {
  address: string
  lat: number
  lon: number
  display_name: string
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
  const [draft, setDraft] = useState<EditDraft>({
    customer: booking.customer,
    service: booking.service,
    date: booking.date,
    time: booking.time,
    address: booking.address ?? '',
  })
  const [location, setLocation] = useState<AddressResult | null>(null)
  const [error, setError] = useState('')

  // Esc 로 닫고, 열려 있는 동안 뒷배경 스크롤을 막는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onCancel])

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
  const labelClass =
    'block text-xs font-black uppercase text-[#3c3c3c] mb-2 tracking-wider'

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 py-10 font-['Pretendard',sans-serif]">
      {/* 뒷배경. 클릭하면 닫힌다 */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl border-2 border-[#e5e5e5] shadow-[0_10px_0_#d0d0d0] p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1cb0f6] flex items-center justify-center text-white text-xl font-black shadow-[0_3px_0_#0d99dc]">
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
            onClick={onCancel}
            aria-label="닫기"
            className="w-9 h-9 rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] text-[#777777] font-black hover:bg-[#ff4b4b] hover:text-white hover:border-[#ff4b4b] transition-colors flex items-center justify-center cursor-pointer flex-shrink-0"
          >
            ✕
          </button>
        </div>

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
            <input
              type="time"
              className={inputClass}
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
            />
          </div>

          {/* 예약추가 폼과 같은 주소 검색을 쓴다 */}
          <div className="md:col-span-2 relative z-20">
            <label className={labelClass}>주소</label>
            <AddressSearch
              value={draft.address}
              onChange={(address) => setDraft({ ...draft, address })}
              onSelect={setLocation}
            />
          </div>
        </div>

        {location && (
          <div className="mb-6 p-4 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl">
            <MapView lat={location.lat} lon={location.lon} address={location.display_name} />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#58cc02] hover:bg-[#46a302] disabled:bg-gray-300 text-white font-black py-4 px-6 rounded-2xl transition-all uppercase tracking-wider text-sm shadow-[0_4px_0_#46a302] active:translate-y-[4px] active:shadow-none cursor-pointer"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-8 bg-white text-[#777777] border-2 border-[#e5e5e5] hover:border-[#afafaf] font-black py-4 rounded-2xl transition-all uppercase tracking-wider text-sm shadow-[0_4px_0_#e5e5e5] active:translate-y-[4px] active:shadow-none cursor-pointer"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
