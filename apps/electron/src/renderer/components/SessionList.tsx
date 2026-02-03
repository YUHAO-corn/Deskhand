import { useEffect, useState } from 'react'
import type { Session } from '@deskhand/shared/sessions'
import { SessionCard } from './SessionCard'

interface SessionListProps {
  selectedSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onSessionCreate: () => void
}

export function SessionList({
  selectedSessionId,
  onSessionSelect,
  onSessionCreate,
}: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load sessions on mount
  useEffect(() => {
    async function loadSessions() {
      try {
        const result = await window.electronAPI.listSessions()
        if (result.success && result.data) {
          setSessions(result.data)
        }
      } catch (error) {
        console.error('Failed to load sessions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSessions()
  }, [])

  // Refresh sessions list
  const refreshSessions = async () => {
    try {
      const result = await window.electronAPI.listSessions()
      if (result.success && result.data) {
        setSessions(result.data)
      }
    } catch (error) {
      console.error('Failed to refresh sessions:', error)
    }
  }

  const handleCreate = async () => {
    onSessionCreate()
    // Refresh list after creation
    setTimeout(refreshSessions, 100)
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-3">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden">
      <button
        onClick={handleCreate}
        className="w-full px-3 py-2 text-sm text-left rounded-lg hover:bg-accent mb-2"
      >
        + New Chat
      </button>

      <div className="flex-1 overflow-y-auto space-y-1">
        {sessions.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No chats yet
          </div>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isSelected={session.id === selectedSessionId}
              onClick={() => onSessionSelect(session.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
