/**
 * 用户消息气泡
 *
 * 显示用户发送的消息，支持附件显示。
 */

import type { Message } from '@deskhand/core';

interface UserMessageBubbleProps {
  message: Message;
}

export function UserMessageBubble({ message }: UserMessageBubbleProps) {
  return (
    <div className="flex justify-end">
      <div
        className="
          max-w-[85%] px-4 py-3
          bg-[#d9e4e4] text-[var(--text-primary)]
          rounded-[16px] rounded-br-[4px]
          text-[var(--font-size-base)] leading-relaxed
          whitespace-pre-wrap break-words
        "
      >
        {message.content}
      </div>
    </div>
  );
}
