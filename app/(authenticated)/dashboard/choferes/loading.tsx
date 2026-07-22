import { Skeleton } from '@/components/ui/skeleton'

export default function ChoferesLoading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
                <Skeleton className="h-6 w-48" />
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                    </div>
                ))}
            </div>
        </div>
    )
}
