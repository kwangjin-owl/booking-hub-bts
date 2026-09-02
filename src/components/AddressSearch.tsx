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
  const containerRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

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
        // 1. 일반 검색어
        const originalQuery = value.trim().replace(/\s+/g, ' ')
        // 2. 공백 제거 검색어 (예: "천중로 42길" -> "천중로42길")
        const noSpaceQuery = originalQuery.replace(/\s+/g, '')

        // Nominatim 한글 주소 검색 (두 쿼리를 모두 시도하거나 공백 제거 검색어 활용)
        const searchUrl = new URL('https://nominatim.openstreetmap.org/search')
        searchUrl.searchParams.append('q', noSpaceQuery)
        searchUrl.searchParams.append('format', 'json')
        searchUrl.searchParams.append('limit', '15')
        searchUrl.searchParams.append('countrycodes', 'kr')
        searchUrl.searchParams.append('accept-language', 'ko')
        searchUrl.searchParams.append('viewbox', '124.5,33.0,131.9,43.0') // 한반도 범위

        const response = await fetch(searchUrl.toString())
        let data = await response.json()

        // 결과가 없거나 적으면 공백이 포함된 원래 검색어로도 재시도
        if ((!data || data.length === 0) && originalQuery !== noSpaceQuery) {
          const retryUrl = new URL('https://nominatim.openstreetmap.org/search')
          retryUrl.searchParams.append('q', originalQuery)
          retryUrl.searchParams.append('format', 'json')
          retryUrl.searchParams.append('limit', '15')
          retryUrl.searchParams.append('countrycodes', 'kr')
          retryUrl.searchParams.append('accept-language', 'ko')
          retryUrl.searchParams.append('viewbox', '124.5,33.0,131.9,43.0')
          
          const retryResponse = await fetch(retryUrl.toString())
          const retryData = await retryResponse.json()
          if (retryData && retryData.length > 0) {
            data = retryData
          }
        }

        console.log('검색 응답:', data) // 디버깅

        // 결과 정렬 (더 관련성 높은 것부터)
        const formatted: AddressResult[] = data
          .filter((item: any) => item.display_name) // 유효한 결과만
          .map((item: any) => ({
            address: item.address || '',
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            display_name: item.display_name,
          }))

        console.log('포맷된 결과:', formatted) // 디버깅

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
    <div className="relative w-full" ref={containerRef}>
      <div className="flex items-center bg-[#f7f7f7] border-2 border-[#e5e5e5] rounded-2xl overflow-hidden focus-within:border-[#1cb0f6] focus-within:bg-white transition-all">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.length >= 2 && setShowResults(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-4 py-3 outline-none font-bold text-[#3c3c3c] bg-transparent"
          placeholder="주소 입력 (예: 강남역, 천중로 42길 등)"
        />
        {loading && (
          <div className="px-4 py-3 text-[#777777]">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-[#e5e5e5] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-[9999] max-h-72 overflow-y-auto w-full">
          {loading && (
            <div className="px-4 py-3 text-sm text-[#777777] text-center font-bold">
              검색 중...
            </div>
          )}

          {!loading && results.length === 0 && value.length >= 2 && (
            <div className="px-4 py-3 text-sm text-[#777777] text-center font-bold">
              검색 결과가 없습니다
            </div>
          )}

          {results.length > 0 && (
            <>
              {results.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className={`w-full text-left px-4 py-3 border-b-2 border-[#e5e5e5] last:border-b-0 text-sm transition-colors cursor-pointer ${
                    selectedIndex === idx
                      ? 'bg-[#d7ffb8]/50 text-[#042c60]'
                      : 'hover:bg-[#f7f7f7]'
                  }`}
                >
                  <p className="font-black text-[#042c60] flex items-center gap-2">
                    {selectedIndex === idx && (
                      <span className="text-[#58cc02]">✓</span>
                    )}
                    {result.display_name.split(',')[0]}
                  </p>
                  <p className="text-xs text-[#777777] truncate mt-0.5 font-medium">
                    {result.display_name}
                  </p>
                </button>
              ))}
              <div className="px-4 py-2 bg-[#f7f7f7] text-xs text-[#777777] border-t-2 border-[#e5e5e5] font-bold text-center">
                화살표 키로 선택, Enter로 확인 또는 바깥쪽을 클릭해 닫기
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
