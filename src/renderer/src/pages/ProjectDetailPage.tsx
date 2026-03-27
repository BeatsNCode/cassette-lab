import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Upload, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useProjectStore } from '@/store/projectStore'
import { useSyncStore } from '@/store/syncStore'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const STATUS_COLORS: Record<string, string> = {
  synced: 'bg-green-500',
  pending: 'bg-yellow-500',
  error: 'bg-red-500',
  conflict: 'bg-orange-500'
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { projects, openInDAW } = useProjectStore()
  const { statuses, progress, fetchStatus, upload, download, resolveConflict } = useSyncStore()

  const project = projects.find((p) => p.id === id)
  const status = id ? statuses[id] : undefined
  const syncProgress = id ? progress[id] : undefined

  useEffect(() => {
    if (id) fetchStatus(id)
  }, [id, fetchStatus])

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    )
  }

  const isActive = syncProgress !== undefined

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground break-all">{project.path}</p>
        </div>
        <Badge variant="secondary">{project.daw_type}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Size</span>
            <span>{formatBytes(project.size_bytes)}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last modified</span>
            <span>{formatDate(project.last_modified)}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last synced</span>
            <span>{formatDate(project.synced_at)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status && (
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status.status] ?? 'bg-gray-400'}`} />
              <span className="capitalize">{status.status}</span>
              {status.error && <span className="text-destructive">— {status.error}</span>}
            </div>
          )}

          {isActive && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="capitalize">{syncProgress.stage}</span>
                <span>{syncProgress.percent}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all"
                  style={{ width: `${syncProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {status?.status === 'conflict' ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isActive}
                onClick={() => id && resolveConflict(id, 'local')}
              >
                Keep local
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isActive}
                onClick={() => id && resolveConflict(id, 'cloud')}
              >
                Keep cloud
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={isActive}
                onClick={() => id && upload(id)}
              >
                <Upload className="mr-2 h-4 w-4" /> Upload
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isActive || !project.cloud_id}
                onClick={() => id && download(id)}
              >
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => openInDAW(project.id)}>
        <ExternalLink className="mr-2 h-4 w-4" /> Open in DAW
      </Button>
    </div>
  )
}
