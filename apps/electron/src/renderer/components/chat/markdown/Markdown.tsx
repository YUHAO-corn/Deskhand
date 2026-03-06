import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isValidElement, Children } from 'react';
import type { Components } from 'react-markdown';

interface MarkdownProps {
  content: string;
  className?: string;
}

const components: Components = {
  code({ inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    if (inline) {
      return (
        <code
          className="rounded-[var(--radius-control)] border border-[var(--color-line-soft)] bg-[var(--color-surface-soft)] px-1.5 py-0.5 font-mono text-[0.875em] text-[var(--color-text-primary)]"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <div className="my-4 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line-soft)] shadow-[var(--elevation-1)]">
        {language && (
          <div className="border-b border-[var(--color-line-soft)] bg-[var(--color-surface-panel)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            {language}
          </div>
        )}
        <pre className="overflow-x-auto bg-[var(--color-surface-elevated)] p-3 text-[var(--font-size-sm)]">
          <code className="font-mono text-[var(--color-text-primary)]" {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  },

  p({ children }) {
    const hasBlockChild = Children.toArray(children).some(
      (child) => isValidElement(child) && typeof child.type === 'string' && ['div', 'pre'].includes(child.type)
    );
    if (hasBlockChild) {
      return <div className="mb-3 last:mb-0 text-[var(--color-text-primary)]">{children}</div>;
    }
    return <p className="mb-3 last:mb-0 text-[var(--font-size-base)] text-[var(--color-text-primary)]">{children}</p>;
  },

  h1({ children }) {
    return <h1 className="font-display mb-3 mt-7 text-[28px] text-[var(--color-text-primary)] first:mt-0">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="font-display mb-2 mt-6 text-[22px] text-[var(--color-text-primary)] first:mt-0">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="mb-2 mt-5 text-[16px] font-semibold text-[var(--color-text-primary)] first:mt-0">{children}</h3>;
  },

  ul({ children }) {
    return <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-[var(--font-size-base)] text-[var(--color-text-primary)]">{children}</li>;
  },

  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--color-accent)] hover:underline"
      >
        {children}
      </a>
    );
  },

  blockquote({ children }) {
    return (
      <blockquote className="my-4 rounded-r-[var(--radius-control)] border-l-[3px] border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3 py-2 text-[var(--color-text-secondary)] italic">
        {children}
      </blockquote>
    );
  },

  hr() {
    return <hr className="my-6 border-[var(--color-line-soft)]" />;
  },

  strong({ children }) {
    return <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic text-[var(--color-text-secondary)]">{children}</em>;
  },

  table({ children }) {
    return (
      <div className="my-4 overflow-x-auto rounded-[var(--radius-control)] border border-[var(--color-line-soft)]">
        <table className="min-w-full text-[var(--font-size-sm)]">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-[var(--color-surface-soft)]">{children}</thead>;
  },
  th({ children }) {
    return <th className="border-b border-[var(--color-line-soft)] px-3 py-2 text-left font-semibold text-[var(--color-text-primary)]">{children}</th>;
  },
  td({ children }) {
    return <td className="border-b border-[var(--color-line-soft)] px-3 py-2 text-[var(--color-text-secondary)]">{children}</td>;
  },
};

export function Markdown({ content, className = '' }: MarkdownProps) {
  return (
    <div className={`prose-container ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
