/**
 * Word 预览组件
 *
 * 用 mammoth.js 解析 .docx 文件，输出语义化 HTML，在 iframe 中渲染。
 * MVP：标题、段落、列表、表格、图片。不做精细样式还原。
 */

import { useState, useEffect } from 'react';
import mammoth from 'mammoth';

interface WordPreviewProps {
  base64: string;
}

export function WordPreview({ base64 }: WordPreviewProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
        if (!cancelled) {
          setHtml(result.value);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [base64]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-[var(--font-size-sm)]">
        Failed to parse Word file
      </div>
    );
  }

  if (!html) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-[var(--font-size-sm)]">
        Loading...
      </div>
    );
  }

  // Wrap the converted HTML with basic document styling
  const srcDoc = `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #1a1a1a;
    padding: 24px;
    margin: 0;
    font-size: 14px;
  }
  h1 { font-size: 1.8em; margin: 0.8em 0 0.4em; }
  h2 { font-size: 1.4em; margin: 0.8em 0 0.4em; }
  h3 { font-size: 1.2em; margin: 0.8em 0 0.4em; }
  p { margin: 0.5em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  img { max-width: 100%; height: auto; }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.2em 0; }
</style>
</head>
<body>${html}</body>
</html>`;

  return (
    <iframe
      sandbox=""
      srcDoc={srcDoc}
      className="w-full h-full border-none bg-white"
      title="Word document preview"
    />
  );
}