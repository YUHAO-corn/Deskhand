import type { Session } from '@deskhand/shared/sessions'

interface SessionCardProps {
  session: Session
  isSelected: boolean
  previewText?: string
  onClick: () => void
}

export function SessionCard({ session, isSelected, previewText, onClick }: SessionCardProps) {
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
          ? 'bg-[#DBEAFE] border-l-[3px] border-l-[#3B82F6] pl-[9px]'
          : 'bg-transparent hover:bg-accent'
        }
      `}
    >
      <div className="text-sm font-medium text-foreground truncate">
        {session.name}
      </div>
      {previewText && (
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {previewText}
        </div>
      )}
    </div>
  )
}
