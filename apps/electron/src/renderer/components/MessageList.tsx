import { useRef, useEffect } from 'react'
import type { Message } from '@deskhand/shared/sessions'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
  streamingText?: string
  isProcessing?: boolean
}

export function MessageList({
  messages,
  streamingText = '',
  isProcessing = false,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  if (messages.length === 0 && !streamingText) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Start a conversation
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Streaming assistant message */}
        {streamingText && (
          <div className="flex justify-start mb-4">
            <div className="max-w-[70%] px-4 py-3 rounded-2xl rounded-bl-sm text-foreground text-sm whitespace-pre-wrap">
              {streamingText}
              <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {/* Processing indicator without streaming text */}
        {isProcessing && !streamingText && (
          <div className="flex justify-start mb-4">
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
