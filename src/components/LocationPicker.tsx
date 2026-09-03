import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import AddressSearch from './AddressSearch'

interface AddressResult {
  address: string
  lat: number
  lon: number
  display_name: string
}

interface LocationPickerProps {
  value: string
  onChange: (address: string) => void
}

/** 좌표를 못 찾았을 때 처음 보여줄 위치 (서울시청) */
const DEFAULT_CENTER: [number, number] = [37.5665, 126.978]

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [moved, setMoved] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [hint, setHint] = useState('')

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

    // 지도를 움직이면 가운데 좌표를 기억해 둔다. 확정은 버튼을 눌러야 된다.
    map.on('moveend', () => {
      const c = map.getCenter()
      setCenter([c.lat, c.lng])
      setMoved(true)
    })

    mapInstanceRef.current = map

    // 컨테이너 크기가 늦게 잡히는 경우가 있어 한 번 갱신해 준다.
    setTimeout(() => map.invalidateSize(), 200)

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  /** 검색 결과를 고르면 지도를 그 위치로 옮긴다. */
  const handleSelect = (result: AddressResult) => {
    onChange(result.display_name)
    setCenter([result.lat, result.lon])
    setMoved(false)
    setHint('')
    mapInstanceRef.current?.setView([result.lat, result.lon], 16)
  }

  /** 지도를 옮긴 뒤 그 자리를 주소로 바꾼다. (역지오코딩) */
  const applyMapCenter = async () => {
    setResolving(true)
    setHint('')

    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse')
      url.searchParams.append('lat', String(center[0]))
      url.searchParams.append('lon', String(center[1]))
      url.searchParams.append('format', 'json')
      url.searchParams.append('accept-language', 'ko')

      const res = await fetch(url.toString())
      const data = await res.json()

      if (data?.display_name) {
        onChange(data.display_name)
        setMoved(false)
        setHint('지도 위치로 주소를 설정했습니다.')
      } else {
        setHint('이 위치의 주소를 찾지 못했습니다. 조금 옮겨서 다시 시도해 보세요.')
      }
    } catch {
      setHint('주소 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setResolving(false)
    }
  }

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
          <span className="text-3xl -translate-y-3 drop-shadow">📍</span>
        </div>

        {/* 지도를 움직였을 때만 확정 버튼을 띄운다 */}
        {moved && (
          <button
            type="button"
            onClick={applyMapCenter}
            disabled={resolving}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[400] px-5 py-2.5 rounded-2xl bg-[#58cc02] text-white text-xs font-black uppercase tracking-wider shadow-[0_3px_0_#46a302] active:translate-y-[3px] active:shadow-none cursor-pointer disabled:bg-gray-400"
          >
            {resolving ? '주소 확인 중...' : '이 위치로 설정'}
          </button>
        )}
      </div>

      <p className="text-[11px] text-[#777777] font-bold">
        {hint || '주소를 검색하거나, 지도를 끌어 핀을 맞춘 뒤 «이 위치로 설정»을 누르세요.'}
      </p>
    </div>
  )
}
