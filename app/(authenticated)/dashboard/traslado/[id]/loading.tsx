import { Skeleton } from '@/components/ui/skeleton'

export default function TrasladoDetailLoading() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
                <div className="flex justify-between">
                    <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-32" /></div>
                    <Skeleton className="h-6 w-20" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
                </div>
            </div>
            <Skeleton className="h-32 rounded-xl" />
        </div>
    )
}
