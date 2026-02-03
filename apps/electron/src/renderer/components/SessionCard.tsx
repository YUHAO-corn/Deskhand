import type { Session } from '@deskhand/shared/sessions'

interface SessionCardProps {
  session: Session
  isSelected: boolean
  onClick: () => void
}

export function SessionCard({ session, isSelected, onClick }: SessionCardProps) {
  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        // TODO: Show context menu with rename/delete options
      }}
      className={`
        px-3 py-2 rounded-lg cursor-pointer transition-colors
        ${isSelected
          ? 'bg-blue-50 border-l-[3px] border-l-blue-500 pl-[9px]'
          : 'hover:bg-accent'
        }
      `}
    >
      <div className="text-sm font-medium text-foreground truncate">
        {session.name}
      </div>
      <div className="text-xs text-muted-foreground truncate mt-0.5">
        {new Date(session.updatedAt).toLocaleDateString()}
      </div>
    </div>
  )
}
