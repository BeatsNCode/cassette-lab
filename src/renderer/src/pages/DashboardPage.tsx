import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderSearch, StopCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectStore } from '@/store/projectStore'
import type { Project } from '../../../preload/index.d'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate()
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate text-base">{project.name}</CardTitle>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {project.daw_type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="truncate text-xs text-muted-foreground">{project.path}</p>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatBytes(project.size_bytes)}</span>
          <span>{formatDate(project.last_modified)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { projects, loading, scanProgress, fetchAll, scan, stopScan, search } = useProjectStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleScan = async () => {
    const result = await window.electron.ipcRenderer.invoke('dialog:showOpenDialog', {
      properties: ['openDirectory']
    })
    if (!result.canceled && result.filePaths[0]) {
      await scan(result.filePaths[0])
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    search(q)
  }

  const isScanning = scanProgress !== null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button onClick={isScanning ? stopScan : handleScan} variant={isScanning ? 'destructive' : 'default'}>
          {isScanning ? (
            <>
              <StopCircle className="mr-2 h-4 w-4" />
              Stop ({scanProgress}%)
            </>
          ) : (
            <>
              <FolderSearch className="mr-2 h-4 w-4" />
              Scan directory
            </>
          )}
        </Button>
      </div>

      <Input
        placeholder="Search projects…"
        value={query}
        onChange={handleSearch}
        className="max-w-sm"
      />

      {loading && projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderSearch className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No projects found. Scan a directory to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  )
}
