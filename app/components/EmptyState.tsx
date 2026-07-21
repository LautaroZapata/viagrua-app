'use client'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  message: string
  icon?: React.ReactNode
}

export default function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="text-center py-12 sm:py-16">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        {icon || <Inbox className="w-8 h-8 text-muted-foreground" />}
      </div>
      <p className="text-muted-foreground text-sm sm:text-base">{message}</p>
    </div>
  )
}
