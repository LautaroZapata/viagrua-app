import { Skeleton } from '@/components/ui/skeleton'

export default function NuevoTrasladoLoading() {
    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
                    <Skeleton className="h-5 w-40" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-9 w-full" />
                        </div>
                    ))}
                </div>
                <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
                    <Skeleton className="h-5 w-32" />
                    <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
                    </div>
                </div>
            </div>
        </div>
    )
}
