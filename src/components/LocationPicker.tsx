import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import AddressSearch from './AddressSearch'
import { formatKoreanAddress } from '../lib/address'

interface AddressResult {
  address: string
  lat: number
  lon: number
  display_name: string
  korean: string
}

interface LocationPickerProps {
  value: string
  onChange: (address: string) => void
  /** 동·호수·층처럼 지도가 모르는 부분. 검색 결과에는 절대 안 나온다. */
  detail?: string
  onDetailChange?: (detail: string) => void
}

/** 좌표를 모를 때 처음 보여줄 위치 (서울시청) */
const DEFAULT_CENTER: [number, number] = [37.5665, 126.978]

export default function LocationPicker({
  value,
  onChange,
  detail,
  onDetailChange,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 검색으로 지도를 옮겼을 때는 역지오코딩을 건너뛴다.
  const skipNextMoveRef = useRef(false)

  const [preview, setPreview] = useState('')
  const [resolving, setResolving] = useState(false)

  /** 지도 중심 좌표를 주소로 바꿔 미리보기에 채운다. */
  const resolveCenter = async (lat: number, lon: number) => {
    setResolving(true)
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse')
      url.searchParams.append('lat', String(lat))
      url.searchParams.append('lon', String(lon))
      url.searchParams.append('format', 'json')
      url.searchParams.append('accept-language', 'ko')
      url.searchParams.append('addressdetails', '1')

      const res = await fetch(url.toString())
      const data = await res.json()

      if (data?.display_name) {
        const korean = formatKoreanAddress(data.address, data.display_name)
        setPreview(korean)
        // 지도를 움직인 그 자리가 곧 선택한 주소가 된다. 따로 버튼을 누를 필요가 없다.
        onChange(korean)
      } else {
        setPreview('이 위치의 주소를 찾지 못했습니다')
      }
    } catch {
      setPreview('주소를 불러오지 못했습니다')
    } finally {
      setResolving(false)
    }
  }

  // 지도는 한 번만 만들고 계속 유지한다.
  // 검색할 때마다 지우고 다시 그리면 화면이 튀어서 정신없다.
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 15)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    map.on('movestart', () => {
      if (!skipNextMoveRef.current) setPreview('')
    })

    map.on('moveend', () => {
      if (skipNextMoveRef.current) {
        skipNextMoveRef.current = false
        return
      }
      // Nominatim 은 초당 1회 제한이 있어 조금 기다렸다 부른다.
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const c = map.getCenter()
      debounceRef.current = setTimeout(() => resolveCenter(c.lat, c.lng), 600)
    })

    mapInstanceRef.current = map

    // 컨테이너 크기가 늦게 잡히는 경우가 있어 한 번 갱신해 준다.
    setTimeout(() => map.invalidateSize(), 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      map.remove()
      mapInstanceRef.current = null
    }
    // 최초 1회만 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 검색 결과를 고르면 지도를 그 위치로 옮긴다. */
  const handleSelect = (result: AddressResult) => {
    const korean = result.korean || result.display_name
    onChange(korean)
    setPreview(korean)
    skipNextMoveRef.current = true
    mapInstanceRef.current?.setView([result.lat, result.lon], 16)
  }

  const shown = preview || value

  return (
    <div className="space-y-3">
      {/* 검색창. 드롭다운은 지도 위에 겹쳐 뜬다 */}
      <div className="relative z-[500]">
        <AddressSearch value={value} onChange={onChange} onSelect={handleSelect} />
      </div>

      {/* 지도는 항상 같은 자리에 있다 */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-[#e5e5e5] z-0">
        <div ref={mapRef} className="w-full h-64" />

        {/* 가운데 고정 핀. 지도를 끌면 이 지점이 선택 위치가 된다 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[400]">
          <span className="text-3xl -translate-y-3 drop-shadow-lg">📍</span>
        </div>

        {/* 핀이 가리키는 곳의 주소를 지도 위에 바로 띄운다 */}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[400]">
          <div className="bg-white/95 border-2 border-[#e5e5e5] rounded-2xl px-4 py-2.5 shadow-[0_3px_0_#e5e5e5]">
            {resolving ? (
              <p className="text-xs font-black text-[#777777]">주소 확인 중...</p>
            ) : shown ? (
              <p className="text-xs font-bold text-[#3c3c3c] line-clamp-2 leading-snug">{shown}</p>
            ) : (
              <p className="text-xs font-black text-[#afafaf]">지도를 끌어 위치를 맞추세요</p>
            )}
          </div>
        </div>
      </div>

      {/* 지도는 건물까지만 안다. 층·호수는 직접 적어야 한다. */}
      {onDetailChange && (
        <input
          type="text"
          value={detail ?? ''}
          onChange={(e) => onDetailChange(e.target.value)}
          placeholder="상세주소 (예: 5층 회의실 A, 302호)"
          className="w-full px-4 py-3 bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl font-bold text-[#3c3c3c] focus:outline-none focus:border-[#1cb0f6] focus:bg-white transition-all"
        />
      )}

      <p className="text-[11px] text-[#777777] font-bold">
        주소를 검색하거나, 지도를 끌어 핀을 맞추면 그 위치가 주소로 저장됩니다.
      </p>
    </div>
  )
}
