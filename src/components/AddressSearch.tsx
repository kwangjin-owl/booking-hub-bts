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
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (!value || value.length < 2) {
      setResults([])
      setShowResults(false)
      setSelectedIndex(-1)
      return
    }

    setLoading(true)
    setSelectedIndex(-1)

    timeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=7&countrycodes=kr`
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
    }, 300)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [value])

  const handleSelect = (result: AddressResult) => {
    onChange(result.display_name)
    setShowResults(false)
    setResults([])
    onSelect?.(result)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowResults(false)
        break
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center border border-gray-300 rounded overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.length >= 2 && setShowResults(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 outline-none"
          placeholder="주소 입력 (예: 강남역, 서울 강남구 등)"
        />
        {loading && (
          <div className="px-3 py-2 text-gray-400">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-3 py-3 text-sm text-gray-500 text-center">
              검색 중...
            </div>
          )}

          {!loading && results.length === 0 && value.length >= 2 && (
            <div className="px-3 py-3 text-sm text-gray-500 text-center">
              검색 결과가 없습니다
            </div>
          )}

          {results.length > 0 && (
            <>
              {results.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(result)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 text-sm transition-colors ${
                    selectedIndex === idx
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium text-gray-800 flex items-center gap-2">
                    {selectedIndex === idx && (
                      <span className="text-blue-600">✓</span>
                    )}
                    {result.display_name.split(',')[0]}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {result.display_name}
                  </p>
                </button>
              ))}
              <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 border-t">
                화살표 키로 선택, Enter로 확인
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
