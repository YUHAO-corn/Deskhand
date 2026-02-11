/**
 * Markdown 渲染组件
 *
 * 使用 react-markdown + remark-gfm 渲染 Markdown 内容
 * 支持 GFM（GitHub Flavored Markdown）语法
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isValidElement, Children } from 'react';
import type { Components } from 'react-markdown';

interface MarkdownProps {
  content: string;
  className?: string;
}

// 自定义组件映射
const components: Components = {
  // 代码块
  code({ inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    if (inline) {
      return (
        <code
          className="
            px-1.5 py-0.5 rounded
            bg-[var(--bg-tertiary)] text-[var(--text-primary)]
            text-[0.875em] font-mono
          "
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <div className="my-3 rounded-lg overflow-hidden border border-[var(--border-light)]">
        {language && (
          <div className="
            px-3 py-1.5
            bg-[var(--bg-tertiary)]
            text-xs text-[var(--text-muted)]
            border-b border-[var(--border-light)]
          ">
            {language}
          </div>
        )}
        <pre className="
          p-3 overflow-x-auto
          bg-[var(--bg-secondary)]
          text-sm
        ">
          <code className="font-mono" {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  },

  // 段落 — 如果子元素包含块级元素（如代码块的 div），用 div 代替 p 避免 DOM 嵌套警告
  p({ children }) {
    const hasBlockChild = Children.toArray(children).some(
      (child) => isValidElement(child) && typeof child.type === 'string' && ['div', 'pre'].includes(child.type)
    );
    if (hasBlockChild) {
      return <div className="mb-3 last:mb-0">{children}</div>;
    }
    return <p className="mb-3 last:mb-0">{children}</p>;
  },

  // 标题
  h1({ children }) {
    return <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h3>;
  },

  // 列表
  ul({ children }) {
    return <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>;
  },
  li({ children }) {
    return <li className="">{children}</li>;
  },

  // 链接
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="
          text-[var(--accent-color)]
          hover:underline
        "
      >
        {children}
      </a>
    );
  },

  // 引用块
  blockquote({ children }) {
    return (
      <blockquote className="
        pl-4 border-l-2 border-[var(--border-medium)]
        text-[var(--text-secondary)] italic
        my-3
      ">
        {children}
      </blockquote>
    );
  },

  // 水平线
  hr() {
    return <hr className="my-4 border-[var(--border-light)]" />;
  },

  // 强调
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic">{children}</em>;
  },

  // 表格
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto">
        <table className="min-w-full border border-[var(--border-light)] text-sm">
          {children}
        </table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-[var(--bg-secondary)]">{children}</thead>;
  },
  th({ children }) {
    return (
      <th className="px-3 py-2 text-left font-semibold border-b border-[var(--border-light)]">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="px-3 py-2 border-b border-[var(--border-light)]">
        {children}
      </td>
    );
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
