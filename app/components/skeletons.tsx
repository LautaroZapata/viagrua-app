import { Skeleton } from '@/components/ui/skeleton'

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-4 sm:p-6">
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-4 text-center">
          <Skeleton className="h-2 w-16 mx-auto mb-2" />
          <Skeleton className="h-7 w-24 mx-auto mb-1" />
          <Skeleton className="h-2 w-20 mx-auto" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card p-4 sm:p-6">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
            <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2 w-1/3" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="page-bg min-h-screen pb-12">
      <div className="navbar sticky top-0 z-50">
        <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg bg-white/20" />
            <Skeleton className="w-32 h-4 rounded bg-white/20" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg bg-white/20" />
            <Skeleton className="w-16 h-8 rounded-lg bg-white/20" />
          </div>
        </div>
      </div>
      <div className="w-full px-3 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-3xl mx-auto space-y-5">
        <StatsSkeleton />
        <CardSkeleton lines={4} />
        <TableSkeleton rows={3} />
      </div>
    </div>
  )
}
