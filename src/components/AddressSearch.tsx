import { useState, useRef, useEffect } from 'react'

interface AddressResult {
  address: string
  lat: number
  lon: number
  display_name: string
}

interface AddressSearchProps {
  value: string
  onChange: (address: string) => void
  onSelect?: (result: AddressResult) => void
}

export default function AddressSearch({
  value,
  onChange,
  onSelect,
}: AddressSearchProps) {
  const [results, setResults] = useState<AddressResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (!value || value.length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    setLoading(true)

    timeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=5&countrycodes=kr`
        )
        const data = await response.json()

        const formatted: AddressResult[] = data.map((item: any) => ({
          address: item.address,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          display_name: item.display_name,
        }))

        setResults(formatted)
        setShowResults(true)
      } catch (error) {
        console.error('주소 검색 실패:', error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [value])

  const handleSelect = (result: AddressResult) => {
    onChange(result.display_name)
    setShowResults(false)
    onSelect?.(result)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.length >= 2 && setShowResults(true)}
        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
        placeholder="주소 입력 (예: 강남역, 서울역 등)"
      />

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 max-h-64 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-sm text-gray-500">
              검색 중...
            </div>
          )}

          {!loading && results.length === 0 && value.length >= 2 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              검색 결과가 없습니다
            </div>
          )}

          {results.map((result, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(result)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-200 last:border-b-0 text-sm"
            >
              <p className="font-medium text-gray-800">
                {result.display_name.split(',')[0]}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {result.display_name}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
