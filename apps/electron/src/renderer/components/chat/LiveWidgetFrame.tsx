import { useEffect, useId, useRef, useState } from 'react';
import type { MessageWidget } from '@deskhand/core';

interface LiveWidgetFrameProps {
  widget: MessageWidget;
}

const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 120;

function buildWidgetSrcDoc(widget: MessageWidget, frameId: string): string {
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
    </style>
    <script>
      (() => {
        const frameId = ${JSON.stringify(frameId)};
        const postHeight = () => {
          const root = document.documentElement;
          const body = document.body;
          const height = Math.max(
            root ? root.scrollHeight : 0,
            body ? body.scrollHeight : 0,
            root ? root.offsetHeight : 0,
            body ? body.offsetHeight : 0
          );

          window.parent.postMessage(
            { type: 'deskhand-widget-height', frameId, height },
            '*'
          );
        };

        let rafId = 0;
        const scheduleHeight = () => {
          if (rafId) return;
          rafId = window.requestAnimationFrame(() => {
            rafId = 0;
            postHeight();
          });
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

        window.addEventListener('load', () => {
          scheduleHeight();

          const observer = new ResizeObserver(() => {
            scheduleHeight();
          });

          observer.observe(document.documentElement);
          if (document.body) {
            observer.observe(document.body);
          }
        });
      })();
    </script>
  </head>
  <body>
    ${widget.code}
  </body>
</html>`;
}

export function LiveWidgetFrame({ widget }: LiveWidgetFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const reactId = useId();
  const frameId = reactId.replace(/:/g, '-');
  const srcDoc = buildWidgetSrcDoc(widget, frameId);

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

  return (
    <div className="overflow-hidden">
      <iframe
        ref={iframeRef}
        title={widget.title ?? 'Live widget'}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ height }}
        className="block w-full border-none bg-transparent"
      />
    </div>
  );
}
