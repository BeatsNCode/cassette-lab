import { Outlet } from 'react-router-dom'
import { ScrollArea } from '@/components/ui/scroll-area'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <ScrollArea className="flex-1">
        <main className="p-6">
          <Outlet />
        </main>
      </ScrollArea>
    </div>
  )
}
