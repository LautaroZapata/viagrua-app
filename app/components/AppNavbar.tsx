'use client'

import { useRouter } from 'next/navigation'

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
              className="md:hidden mr-2 p-2 rounded-lg hover:bg-white/10 focus:outline-none" 
              onClick={onHamburgerClick} 
              aria-label="Abrir menú"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <h1 className="text-white font-bold text-lg sm:text-xl tracking-tight">{title}</h1>
          {subtitle && (
            <span className="ml-2 text-xs text-white/80 font-semibold bg-white/10 px-2 py-0.5 rounded-lg max-w-[120px] truncate" title={subtitle}>
              {subtitle}
            </span>
          )}
        </div>
        
        <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick || (() => action.href && router.push(action.href))}
              className={`text-sm font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition flex items-center gap-1.5 ${
                action.variant === 'danger' 
                  ? 'text-white bg-white/15 hover:bg-white/25' 
                  : 'text-white/90 hover:text-white'
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
