'use client'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface BreadcrumbEntry {
    label: string
    href?: string
}

interface AppHeaderProps {
    breadcrumbs?: BreadcrumbEntry[]
    actions?: React.ReactNode
}

export default function AppHeader({ breadcrumbs = [], actions }: AppHeaderProps) {
    return (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <Breadcrumb className="flex-1">
                <BreadcrumbList>
                    {breadcrumbs.map((crumb, i) => {
                        const isLast = i === breadcrumbs.length - 1
                        return (
                            <span key={i} className="contents">
                                <BreadcrumbItem>
                                    {isLast ? (
                                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink href={crumb.href || '#'}>
                                            {crumb.label}
                                        </BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                                {!isLast && <BreadcrumbSeparator />}
                            </span>
                        )
                    })}
                </BreadcrumbList>
            </Breadcrumb>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
    )
}
