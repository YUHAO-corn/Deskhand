import type { Message } from '@deskhand/shared/sessions'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isError = message.role === 'error'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div
          className="max-w-[70%] px-4 py-3 rounded-2xl rounded-br-sm text-white text-sm whitespace-pre-wrap"
          style={{
            background: 'linear-gradient(135deg, #5EACAB 0%, #4A9190 100%)',
            boxShadow: '0 2px 8px rgba(94, 172, 171, 0.2)',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  if (isAssistant) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[70%] px-4 py-3 rounded-2xl rounded-bl-sm text-foreground text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[70%] px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {message.content}
        </div>
      </div>
    )
  }

  // Tool messages or other types
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[70%] px-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-mono text-xs">
        <div className="text-muted-foreground mb-1">Tool: {message.toolName}</div>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  )
}
