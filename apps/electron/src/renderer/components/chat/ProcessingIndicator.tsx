import { useState, useEffect } from 'react';

const PROCESSING_MESSAGES = [
  'Thinking...',
  'Pondering...',
  'Contemplating...',
  'Reasoning...',
  'Processing...',
  'Computing...',
  'Considering...',
  'Reflecting...',
  'Deliberating...',
  'Cogitating...',
  'Working on it...',
  'On it...',
  'Crunching...',
  'Brewing...',
  'Connecting dots...',
  'Deep in thought...',
  'Hmm...',
  'Let me see...',
  'One moment...',
  'Hold on...',
  'Bear with me...',
  'Just a sec...',
  'Hang tight...',
  'Getting there...',
  'Working...',
  'Busy busy...',
  'Whirring...',
  'Churning...',
  'Percolating...',
  'Simmering...',
  'Cooking...',
  'Spinning up...',
  'Warming up...',
  'Buzzing...',
  'Humming...',
];

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

interface ProcessingIndicatorProps {
  startTime?: number;
  statusMessage?: string;
}

export function ProcessingIndicator({ startTime, statusMessage }: ProcessingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * PROCESSING_MESSAGES.length)
  );
  const [isMessageFading, setIsMessageFading] = useState(false);

  useEffect(() => {
    const start = startTime || Date.now();
    setElapsed(Math.floor((Date.now() - start) / 1000));

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    if (statusMessage) return;

    const interval = setInterval(() => {
      setIsMessageFading(true);

      setTimeout(() => {
        setMessageIndex((prev) => {
          let next = Math.floor(Math.random() * PROCESSING_MESSAGES.length);
          while (next === prev && PROCESSING_MESSAGES.length > 1) {
            next = Math.floor(Math.random() * PROCESSING_MESSAGES.length);
          }
          return next;
        });
        setIsMessageFading(false);
      }, 300);
    }, 10000);

    return () => clearInterval(interval);
  }, [statusMessage]);

  const displayMessage = statusMessage || PROCESSING_MESSAGES[messageIndex];

  return (
    <div className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-line-soft)] bg-[var(--color-surface-panel)] px-2.5 py-1.5 text-[var(--color-text-muted)]">
      <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />

      <span
        className={[
          'text-[var(--font-size-sm)] transition-opacity duration-300',
          isMessageFading ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
      >
        {displayMessage}
      </span>

      {elapsed >= 1 && (
        <span className="text-[var(--font-size-sm)] tabular-nums text-[var(--color-text-muted)] opacity-70">
          {formatElapsed(elapsed)}
        </span>
      )}
    </div>
  );
}
