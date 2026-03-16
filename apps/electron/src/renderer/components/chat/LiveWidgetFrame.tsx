import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MessageWidget } from '@deskhand/core';

interface LiveWidgetFrameProps {
  widget: MessageWidget;
}

const DEFAULT_HEIGHT = 120;
const MIN_HEIGHT = 48;

function buildWidgetSrcDoc(frameId: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        background: transparent;
      }

      body {
        overflow: hidden;
      }

      #widget-root {
        width: 100%;
      }
    </style>
    <script>
      (() => {
        const frameId = ${JSON.stringify(frameId)};
        const svgNs = 'http://www.w3.org/2000/svg';
        const htmlVoidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
        const root = document.createElement('div');
        root.id = 'widget-root';
        document.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(root);
        });

        let stack = [root];
        let pending = '';
        let rafId = 0;

        const postHeight = () => {
          const html = document.documentElement;
          const body = document.body;
          const height = Math.max(
            html ? html.scrollHeight : 0,
            body ? body.scrollHeight : 0,
            html ? html.offsetHeight : 0,
            body ? body.offsetHeight : 0
          );

          window.parent.postMessage(
            { type: 'deskhand-widget-height', frameId, height },
            '*'
          );
        };

        const scheduleHeight = () => {
          if (rafId) return;
          rafId = window.requestAnimationFrame(() => {
            rafId = 0;
            postHeight();
          });
        };

        const parseAttributes = (source) => {
          const attributes = [];
          const regex = /([^\\s=/>]+)(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+)))?/g;
          let match;

          while ((match = regex.exec(source)) !== null) {
            const name = match[1];
            const value = match[2] ?? match[3] ?? match[4] ?? '';
            attributes.push([name, value]);
          }

          return attributes;
        };

        const readTagToken = () => {
          if (!pending.startsWith('<')) {
            return null;
          }

          if (pending.startsWith('<!--')) {
            const commentEnd = pending.indexOf('-->');
            if (commentEnd === -1) return null;
            const raw = pending.slice(0, commentEnd + 3);
            pending = pending.slice(commentEnd + 3);
            return { type: 'comment', raw };
          }

          let quote = '';
          for (let i = 1; i < pending.length; i += 1) {
            const char = pending[i];

            if (quote) {
              if (char === quote) {
                quote = '';
              }
              continue;
            }

            if (char === '"' || char === "'") {
              quote = char;
              continue;
            }

            if (char === '>') {
              const rawTag = pending.slice(0, i + 1);
              pending = pending.slice(i + 1);

              if (/^<!DOCTYPE/i.test(rawTag) || /^<\\?/.test(rawTag)) {
                return { type: 'ignore' };
              }

              if (/^<\\//.test(rawTag)) {
                const tagName = rawTag.slice(2, -1).trim().toLowerCase();
                return { type: 'end', tagName };
              }

              let inner = rawTag.slice(1, -1).trim();
              let selfClosing = false;
              if (inner.endsWith('/')) {
                inner = inner.slice(0, -1).trim();
                selfClosing = true;
              }

              const nameMatch = inner.match(/^([^\\s/>]+)/);
              if (!nameMatch) {
                return { type: 'ignore' };
              }

              const tagName = nameMatch[1].toLowerCase();
              const attrSource = inner.slice(nameMatch[0].length);
              return {
                type: 'start',
                tagName,
                selfClosing: selfClosing || htmlVoidTags.has(tagName),
                attributes: parseAttributes(attrSource),
              };
            }
          }

          return null;
        };

        const readNextToken = () => {
          if (!pending) return null;

          if (!pending.startsWith('<')) {
            const nextTagIndex = pending.indexOf('<');
            if (nextTagIndex === -1) {
              const text = pending;
              pending = '';
              return { type: 'text', text };
            }

            const text = pending.slice(0, nextTagIndex);
            pending = pending.slice(nextTagIndex);
            return { type: 'text', text };
          }

          return readTagToken();
        };

        const currentParent = () => stack[stack.length - 1] || root;

        const createNode = (tagName, attributes) => {
          const parent = currentParent();
          const useSvgNs = tagName === 'svg' || parent.namespaceURI === svgNs;
          const node = useSvgNs
            ? document.createElementNS(svgNs, tagName)
            : document.createElement(tagName);

          for (const [name, value] of attributes) {
            node.setAttribute(name, value);
          }

          return node;
        };

        const applyToken = (token) => {
          if (!token || token.type === 'ignore' || token.type === 'comment') {
            return;
          }

          if (token.type === 'text') {
            if (!token.text) return;
            currentParent().appendChild(document.createTextNode(token.text));
            return;
          }

          if (token.type === 'start') {
            const node = createNode(token.tagName, token.attributes);
            currentParent().appendChild(node);

            if (!token.selfClosing) {
              stack.push(node);
            }

            return;
          }

          if (token.type === 'end') {
            for (let i = stack.length - 1; i > 0; i -= 1) {
              const node = stack[i];
              if (node && node.tagName && node.tagName.toLowerCase() === token.tagName) {
                stack = stack.slice(0, i);
                break;
              }
            }
          }
        };

        const processPending = () => {
          while (true) {
            const token = readNextToken();
            if (!token) break;
            applyToken(token);
          }
          scheduleHeight();
        };

        const reset = () => {
          pending = '';
          stack = [root];
          root.replaceChildren();
          scheduleHeight();
        };

        window.sendPrompt = (text, options = {}) => {
          window.parent.postMessage(
            {
              type: 'deskhand-widget-prompt',
              frameId,
              text,
              options,
            },
            '*'
          );
        };

        window.addEventListener('message', (event) => {
          if (event.source !== window.parent) return;

          const data = event.data;
          if (!data || typeof data !== 'object' || data.frameId !== frameId) return;

          if (data.type === 'deskhand-widget-reset') {
            reset();
            return;
          }

          if (data.type === 'deskhand-widget-append' && typeof data.chunk === 'string') {
            pending += data.chunk;
            processPending();
            return;
          }

          if (data.type === 'deskhand-widget-complete') {
            processPending();
            scheduleHeight();
          }
        });

        window.addEventListener('load', () => {
          const observer = new ResizeObserver(() => {
            scheduleHeight();
          });

          observer.observe(document.documentElement);
          if (document.body) {
            observer.observe(document.body);
          }

          scheduleHeight();
        });
      })();
    </script>
  </head>
  <body></body>
</html>`;
}

export function LiveWidgetFrame({ widget }: LiveWidgetFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isReady, setIsReady] = useState(false);
  const reactId = useId();
  const frameId = reactId.replace(/:/g, '-');
  const srcDoc = useMemo(() => buildWidgetSrcDoc(frameId), [frameId]);
  const previousCodeRef = useRef('');
  const previousStreamingRef = useRef(widget.isStreaming);

  useEffect(() => {
    setIsReady(false);
    previousCodeRef.current = '';
    previousStreamingRef.current = widget.isStreaming;
    setHeight(DEFAULT_HEIGHT);
  }, [frameId, widget.mimeType]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'deskhand-widget-height' && data.frameId === frameId) {
        const nextHeight = typeof data.height === 'number' ? Math.max(MIN_HEIGHT, Math.ceil(data.height)) : DEFAULT_HEIGHT;
        setHeight(nextHeight);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [frameId]);

  useEffect(() => {
    if (!isReady) return;

    const target = iframeRef.current?.contentWindow;
    if (!target) return;

    const previousCode = previousCodeRef.current;
    const nextCode = widget.code;

    if (!nextCode.startsWith(previousCode)) {
      target.postMessage({ type: 'deskhand-widget-reset', frameId }, '*');
      target.postMessage({ type: 'deskhand-widget-append', frameId, chunk: nextCode }, '*');
    } else {
      const chunk = nextCode.slice(previousCode.length);
      if (chunk) {
        target.postMessage({ type: 'deskhand-widget-append', frameId, chunk }, '*');
      }
    }

    previousCodeRef.current = nextCode;

    if (!widget.isStreaming && previousStreamingRef.current) {
      target.postMessage({ type: 'deskhand-widget-complete', frameId }, '*');
    }

    if (!widget.isStreaming && !previousStreamingRef.current && !nextCode) {
      target.postMessage({ type: 'deskhand-widget-complete', frameId }, '*');
    }

    previousStreamingRef.current = widget.isStreaming;
  }, [frameId, isReady, widget.code, widget.isStreaming]);

  return (
    <div className="overflow-hidden">
      <iframe
        ref={iframeRef}
        title={widget.title ?? 'Live widget'}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ height }}
        className="block w-full border-none bg-transparent"
        onLoad={() => setIsReady(true)}
      />
    </div>
  );
}
