import { NavLink } from 'react-router-dom'
import { FolderOpen, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

export default function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <aside className="flex h-screen w-[220px] flex-col border-r bg-muted/40">
      <div className="px-4 py-5">
        <span className="text-lg font-semibold tracking-tight">cassette lab</span>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 px-2 py-4">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )
          }
        >
          <FolderOpen className="h-4 w-4" />
          Projects
        </NavLink>
      </nav>

      <Separator />

      <div className="px-4 py-4">
        <p className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</p>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
