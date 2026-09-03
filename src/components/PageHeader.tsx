interface PageHeaderProps {
  title: string
  description?: string
  /** 제목 오른쪽에 놓을 것 (상태 배지, 보기 전환 등) */
  aside?: React.ReactNode
}

/**
 * 모든 탭이 같은 머리말 구조를 쓴다.
 * 탭마다 배너·배지 모양이 달라 화면이 옮겨 다닐 때마다 다른 앱처럼 보이던 문제를 없앤다.
 */
export default function PageHeader({ title, description, aside }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4">
      <div>
        <h2 className="text-3xl font-black text-[#042c60]">{title}</h2>
        {description && <p className="text-[#777777] mt-1 font-medium">{description}</p>}
      </div>
      {aside}
    </div>
  )
}
