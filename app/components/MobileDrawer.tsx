'use client'
import { useTheme } from 'next-themes'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Sun, Moon, Truck } from 'lucide-react'

interface DrawerItem {
  label: string
  icon?: string
  onClick: () => void
  isActive?: boolean
  isDanger?: boolean
}

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: DrawerItem[]
  userName?: string
}

export default function MobileDrawer({ isOpen, onClose, items, userName }: MobileDrawerProps) {
  const { theme, setTheme } = useTheme()

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-64 max-w-[80vw] p-0 border-border">
        <div className="flex flex-col h-full px-6 pb-6 drawer-safe-top">
          <div className="flex items-center mb-8">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mr-2">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-lg text-primary">ViaGrua</span>
          </div>
          <nav className="flex flex-col gap-2">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => { item.onClick(); onClose(); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  item.isDanger
                    ? 'text-destructive hover:bg-destructive/10'
                    : item.isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent'
                }`}
              >
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </button>
            ))}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </button>
          </nav>
          {userName && (
            <div className="mt-auto pt-8 text-xs text-muted-foreground">
              <span className="font-semibold">{userName}</span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
