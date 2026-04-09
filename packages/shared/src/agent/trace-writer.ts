/**
 * TraceWriter — 把 agent 运行事件写到本地 JSONL 文件
 *
 * 存储路径：~/.deskhand/traces/YYYY-MM-DD.jsonl
 * 格式：每行一个 JSON 对象，append-only
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TraceEventType =
  | 'session_start'
  | 'session_end'
  | 'tool_call'
  | 'tool_error'
  | 'subagent_start'
  | 'subagent_end';

export interface TraceEvent {
  sessionId: string;
  timestamp: string;        // ISO 8601
  type: TraceEventType;
  // session_start / session_end
  durationMs?: number;
  turnCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  success?: boolean;
  errorMessage?: string;
  // tool_call / tool_error
  toolName?: string;
  toolUseId?: string;
  toolSuccess?: boolean;
  // subagent_start / subagent_end
  parentToolUseId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TraceWriter
// ─────────────────────────────────────────────────────────────────────────────

export class TraceWriter {
  private traceDir: string;
  private sessionId: string;
  private sessionStartTime: number;
  private toolCallCount = 0;
  private toolErrorCount = 0;

  constructor(sessionId: string) {
    this.traceDir = path.join(os.homedir(), '.deskhand', 'traces');
    this.sessionId = sessionId;
    this.sessionStartTime = Date.now();
    this.ensureDir();
  }

  private ensureDir(): void {
    fs.mkdirSync(this.traceDir, { recursive: true });
  }

  private getFilePath(): string {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return path.join(this.traceDir, `${date}.jsonl`);
  }

  private write(event: TraceEvent): void {
    try {
      const line = JSON.stringify(event) + '\n';
      fs.appendFileSync(this.getFilePath(), line, 'utf8');
    } catch {
      // trace 写入失败不影响主流程
    }
  }

  // ─── Public API ───

  sessionStart(): void {
    this.write({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      type: 'session_start',
    });
  }

  sessionEnd(opts: { success: boolean; errorMessage?: string; turnCount?: number; inputTokens?: number; outputTokens?: number }): void {
    this.write({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      type: 'session_end',
      durationMs: Date.now() - this.sessionStartTime,
      success: opts.success,
      errorMessage: opts.errorMessage,
      turnCount: opts.turnCount,
      inputTokens: opts.inputTokens,
      outputTokens: opts.outputTokens,
    });
  }

  toolCall(toolName: string, toolUseId: string): void {
    this.toolCallCount++;
    this.write({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      type: 'tool_call',
      toolName,
      toolUseId,
      toolSuccess: true,
    });
  }

  toolError(toolName: string, toolUseId: string, errorMessage: string): void {
    this.toolErrorCount++;
    this.write({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      type: 'tool_error',
      toolName,
      toolUseId,
      toolSuccess: false,
      errorMessage,
    });
  }

  subagentStart(parentToolUseId: string): void {
    this.write({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      type: 'subagent_start',
      parentToolUseId,
    });
  }

  subagentEnd(parentToolUseId: string): void {
    this.write({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      type: 'subagent_end',
      parentToolUseId,
    });
  }

  getStats(): { toolCallCount: number; toolErrorCount: number } {
    return { toolCallCount: this.toolCallCount, toolErrorCount: this.toolErrorCount };
  }
}
