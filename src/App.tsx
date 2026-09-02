import { useState } from 'react'
import BookingTable from './components/BookingTable'
import BookingForm from './components/BookingForm'
import StatCards from './components/StatCards'

type TabType = '대시보드' | '예약목록' | '예약추가' | '상태관리' | '위치확인'

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('대시보드')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleFormSuccess = () => {
    setRefreshKey((prev) => prev + 1)
    setActiveTab('예약목록')
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: '대시보드', label: '대시보드' },
    { id: '예약목록', label: '예약목록' },
    { id: '예약추가', label: '예약추가' },
    { id: '상태관리', label: '상태관리' },
    { id: '위치확인', label: '위치확인' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto p-6">
          <h1 className="text-4xl font-bold">예약 관리 허브</h1>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-6xl mx-auto p-6">
        {/* 대시보드 탭 */}
        {activeTab === '대시보드' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">대시보드</h2>
            <StatCards refreshKey={refreshKey} />
          </div>
        )}

        {/* 예약목록 탭 */}
        {activeTab === '예약목록' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">예약 목록</h2>
            <BookingTable refreshKey={refreshKey} />
          </div>
        )}

        {/* 예약추가 탭 */}
        {activeTab === '예약추가' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">새로운 예약</h2>
            <BookingForm onSuccess={handleFormSuccess} />
          </div>
        )}

        {/* 상태관리 탭 */}
        {activeTab === '상태관리' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">상태 관리</h2>
            <p className="text-gray-600 mb-4">예약의 상태를 변경할 수 있습니다. 배지를 클릭하면 pending(대기)과 confirmed(확정)이 토글됩니다.</p>
            <BookingTable refreshKey={refreshKey} />
          </div>
        )}

        {/* 위치확인 탭 */}
        {activeTab === '위치확인' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">위치 확인</h2>
            <p className="text-gray-600 mb-4">주소를 클릭하면 Google Maps에서 해당 위치를 확인할 수 있습니다.</p>
            <BookingTable refreshKey={refreshKey} />
          </div>
        )}
      </div>

      {/* 하단 탭 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-6xl mx-auto flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 px-3 text-center font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
