"use client"

export function ChartSkeleton() {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8 animate-pulse">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-6 bg-slate-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-32"></div>
        </div>
      </div>
      <div className="h-64 bg-slate-200 rounded-lg"></div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
      </div>
      <div className="space-y-1">
        <div className="h-4 bg-slate-200 rounded w-16 mb-2"></div>
        <div className="h-8 bg-slate-200 rounded w-24"></div>
        <div className="h-3 bg-slate-200 rounded w-8"></div>
      </div>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-8 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 bg-slate-200 rounded"></div>
        <div className="h-6 bg-slate-200 rounded w-64"></div>
        <div className="h-6 bg-slate-200 rounded w-20"></div>
      </div>

      <div className="space-y-4">
        {/* Table header */}
        <div className="flex gap-4 pb-4 border-b border-slate-200">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 bg-slate-200 rounded flex-1"></div>
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-2">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-4 bg-slate-200 rounded flex-1"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function RegionFilterSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Search box */}
      <div className="h-10 bg-slate-200 rounded-xl"></div>

      {/* Region buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-200 rounded-xl"></div>
        ))}
      </div>
    </div>
  )
}