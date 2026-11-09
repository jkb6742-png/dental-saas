// 메뉴를 누르면 서버 응답을 기다리는 동안 바로 보이는 화면.
export default function DashboardLoading() {
  const bar = "rounded-[3px] bg-[#ecece9] animate-pulse"
  return (
    <div className="space-y-3" aria-busy="true" aria-label="불러오는 중">
      <div className={`${bar} h-6 w-48`} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${bar} h-[84px]`} />
        ))}
      </div>
      <div className={`${bar} h-[220px]`} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className={`${bar} h-[180px]`} />
        <div className={`${bar} h-[180px]`} />
      </div>
    </div>
  )
}
