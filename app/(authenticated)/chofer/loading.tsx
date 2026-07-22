import { Skeleton } from '@/components/ui/skeleton'

export default function ChoferDashboardLoading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-16 rounded-xl" />
            <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-32" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            ))}
        </div>
    )
}
