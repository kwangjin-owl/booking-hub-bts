import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapViewProps {
  lat: number
  lon: number
  address: string
}

// 커스텀 마커 아이콘 (CSS 기반)
const createCustomIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      ">📍</div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40], // 아이콘의 하단 중심이 좌표에 맞도록
    popupAnchor: [0, -40], // 팝업이 아이콘 위에 나타나도록
    className: 'custom-marker',
  })
}

export default function MapView({ lat, lon, address }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || !lat || !lon) return

    // 지도 초기화
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
    }

    const map = L.map(mapRef.current).setView([lat, lon], 15)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    // 커스텀 마커 추가
    L.marker([lat, lon], { icon: createCustomIcon() })
      .addTo(map)
      .bindPopup(`<div style="font-size: 12px; padding: 4px;">${address || '위치'}</div>`)
      .openPopup()

    mapInstanceRef.current = map

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [lat, lon, address])

  return (
    <div className="space-y-2 relative z-0">
      <p className="text-sm font-medium text-gray-700">{address}</p>
      <div
        ref={mapRef}
        className="w-full h-64 rounded-lg border border-gray-300 shadow-sm"
      />
    </div>
  )
}
