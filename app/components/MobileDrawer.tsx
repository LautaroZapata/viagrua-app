'use client'

interface DrawerItem {
  label: string
  icon?: string
  onClick: () => void
  isActive?: boolean
  isDanger?: boolean
  isLink?: boolean
  href?: string
}

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: DrawerItem[]
  userName?: string
}

export default function MobileDrawer({ isOpen, onClose, items, userName }: MobileDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex md:hidden">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-64 max-w-[80vw] h-full shadow-xl animate-slideInLeft px-6 pb-6 drawer-safe-top flex flex-col">
        <div className="flex items-center mb-8">
          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-2">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <span className="font-bold text-lg text-orange-600">ViaGrua</span>
        </div>
        <nav className="flex flex-col gap-2">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => { item.onClick(); onClose(); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                item.isDanger
                  ? 'text-red-600 hover:bg-red-50'
                  : item.isActive
                  ? 'bg-orange-50 text-orange-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.icon && <span>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </nav>
        {userName && (
          <div className="mt-8 text-xs text-gray-400">
            <span className="font-semibold">{userName}</span>
          </div>
        )}
      </div>
    </div>
  )
}
