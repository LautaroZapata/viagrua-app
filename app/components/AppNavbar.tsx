'use client'

import { useRouter } from 'next/navigation'
import { Truck, Menu } from 'lucide-react'

interface NavAction {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  href?: string
  variant?: 'default' | 'danger'
}

interface AppNavbarProps {
  title: string
  subtitle?: string
  showHamburger?: boolean
  onHamburgerClick?: () => void
  actions?: NavAction[]
  rightSlot?: React.ReactNode
}

export default function AppNavbar({
  title,
  subtitle,
  showHamburger = false,
  onHamburgerClick,
  actions = [],
  rightSlot
}: AppNavbarProps) {
  const router = useRouter()

  return (
    <nav className="navbar sticky top-0 z-50">
      <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          {showHamburger && (
            <button
              className="md:hidden mr-1 p-2 rounded-lg hover:bg-white/10 focus:outline-none transition"
              onClick={onHamburgerClick}
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
            <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <h1 className="text-white font-bold text-lg sm:text-xl tracking-tight">{title}</h1>
          {subtitle && (
            <span className="hidden sm:inline ml-2 text-xs text-white/80 font-semibold bg-white/10 px-2.5 py-1 rounded-lg max-w-[140px] truncate" title={subtitle}>
              {subtitle}
            </span>
          )}
        </div>

        <div className="hidden md:flex items-center gap-1.5">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick || (() => action.href && router.push(action.href))}
              className={`text-sm font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition flex items-center gap-1.5 ${
                action.variant === 'danger'
                  ? 'text-white bg-white/15 hover:bg-white/25'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
          {rightSlot}
        </div>
      </div>
    </nav>
  )
}
