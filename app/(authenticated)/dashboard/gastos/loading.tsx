import { Skeleton } from '@/components/ui/skeleton'

export default function GastosLoading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-xl border border-border bg-card p-4 text-center space-y-2">
                        <Skeleton className="h-3 w-20 mx-auto" />
                        <Skeleton className="h-7 w-28 mx-auto" />
                        <Skeleton className="h-3 w-16 mx-auto" />
                    </div>
                ))}
            </div>
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
        </div>
    )
}
