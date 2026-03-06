import type { Message } from '@deskhand/core';

interface UserMessageBubbleProps {
  message: Message;
}

export function UserMessageBubble({ message }: UserMessageBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] rounded-[var(--radius-card)] rounded-br-[12px] border border-[var(--color-line-soft)] bg-[var(--color-accent-soft)] px-4 py-3 shadow-[var(--elevation-1)]">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent-strong)]">You</p>
        <p className="whitespace-pre-wrap break-words text-[var(--font-size-base)] leading-relaxed text-[var(--color-text-primary)]">
          {message.content}
        </p>
      </div>
    </div>
  );
}
