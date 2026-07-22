import { Skeleton } from '@/components/ui/skeleton'

export default function ChoferTrasladoLoading() {
    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-24 rounded-xl" />
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
                <div className="flex justify-between"><Skeleton className="h-6 w-40" /><Skeleton className="h-6 w-20" /></div>
                <div className="grid grid-cols-2 gap-3"><Skeleton className="h-20 rounded-lg" /><Skeleton className="h-20 rounded-lg" /></div>
            </div>
            <Skeleton className="h-32 rounded-xl" />
        </div>
    )
}
