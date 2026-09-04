interface AutoJudgeControlProps {
  autoOn: boolean
  onToggle: (on: boolean) => void
  onJudgeAll: () => void
  judging: boolean
}

/** 자동 판정 토글 + 전부 판정 버튼. 상태는 Dashboard 가 들고 있다. */
export default function AutoJudgeControl({ autoOn, onToggle, onJudgeAll, judging }: AutoJudgeControlProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white border-2 border-[#e5e5e5] rounded-2xl shadow-[0_4px_0_#e5e5e5] flex-wrap">
      <button
        type="button"
        role="switch"
        aria-checked={autoOn}
        onClick={() => onToggle(!autoOn)}
        disabled={judging}
        className={`relative w-14 h-8 rounded-full border-2 transition-all cursor-pointer disabled:opacity-50 ${
          autoOn ? 'bg-[#58cc02] border-[#46a302]' : 'bg-[#e5e5e5] border-[#cfcfcf]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
            autoOn ? 'left-[26px]' : 'left-0.5'
          }`}
        />
      </button>

      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-black text-[#3c3c3c]">자동 판정 {autoOn ? 'ON' : 'OFF'}</p>
        <p className="text-xs text-[#777777] font-bold">
          {autoOn
            ? '빈 칸이 있으면 바로 확정-자동으로 배정합니다'
            : '후보만 잡아두고 미확정 관리에서 확정 버튼을 기다립니다'}
        </p>
      </div>

      <button
        onClick={onJudgeAll}
        disabled={judging}
        className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all whitespace-nowrap ${
          judging
            ? 'bg-[#e5e5e5] text-[#afafaf] cursor-not-allowed'
            : 'bg-[#58cc02] hover:bg-[#46a302] text-white shadow-[0_3px_0_#46a302] active:translate-y-[3px] active:shadow-none cursor-pointer'
        }`}
      >
        {judging ? '판정 중...' : '전부 판정'}
      </button>
    </div>
  )
}
