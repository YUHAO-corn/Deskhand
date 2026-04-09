/**
 * analyze-traces.ts — 从 ~/.deskhand/traces/*.jsonl 分析 agent 失败模式
 *
 * 用法：bun scripts/analyze-traces.ts [--days 14] [--out failure_report.json]
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TraceEvent {
  sessionId: string;
  timestamp: string;
  type: 'session_start' | 'session_end' | 'tool_call' | 'tool_error' | 'subagent_start' | 'subagent_end';
  durationMs?: number;
  turnCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  success?: boolean;
  errorMessage?: string;
  toolName?: string;
  toolUseId?: string;
  toolSuccess?: boolean;
  parentToolUseId?: string;
}

interface SessionSummary {
  sessionId: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
  turnCount: number;
  toolCalls: string[];         // toolNames
  toolErrors: { name: string; error: string }[];
  hasSubagent: boolean;
}

interface FailureType {
  rank: number;
  type: string;
  label: string;
  count: number;
  sessionImpact: 'high' | 'medium' | 'low';
  examples: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Failure classification
// ─────────────────────────────────────────────────────────────────────────────

function classifyFailure(session: SessionSummary): string {
  const err = (session.errorMessage ?? '').toLowerCase();

  // abort
  if (err === 'aborted') return 'user_abort';

  // tool retry loop: 3+ errors from same tool
  const toolErrorCounts: Record<string, number> = {};
  for (const e of session.toolErrors) {
    toolErrorCounts[e.name] = (toolErrorCounts[e.name] ?? 0) + 1;
  }
  if (Object.values(toolErrorCounts).some(c => c >= 3)) return 'tool_retry_loop';

  // context limit
  if (err.includes('context') || err.includes('token') || err.includes('limit') || err.includes('length')) {
    return 'context_limit_abort';
  }

  // tool timeout
  if (err.includes('timeout') || err.includes('timed out')) return 'tool_timeout';

  // API error (rate limit / server error)
  if (err.includes('rate limit') || err.includes('429')) return 'api_rate_limit';
  if (err.includes('500') || err.includes('502') || err.includes('503') || err.includes('overloaded')) {
    return 'api_server_error';
  }

  // has tool errors but not loop
  if (session.toolErrors.length > 0) return 'tool_single_error';

  // other
  return 'other';
}

const FAILURE_LABELS: Record<string, string> = {
  tool_retry_loop:     'Tool 失败陷入恢复循环',
  context_limit_abort: '长任务 context 接近上限仓促结束',
  tool_timeout:        'Tool 执行超时',
  api_rate_limit:      'API 频率限制',
  api_server_error:    'API 服务端错误',
  tool_single_error:   'Tool 单次失败',
  user_abort:          '用户主动中断',
  other:               '其他错误',
};

const FAILURE_IMPACT: Record<string, 'high' | 'medium' | 'low'> = {
  tool_retry_loop:     'high',
  context_limit_abort: 'high',
  tool_timeout:        'medium',
  api_rate_limit:      'medium',
  api_server_error:    'medium',
  tool_single_error:   'low',
  user_abort:          'low',
  other:               'low',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function loadEvents(traceDir: string, days: number): TraceEvent[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const events: TraceEvent[] = [];

  if (!fs.existsSync(traceDir)) {
    console.warn(`Trace dir not found: ${traceDir}`);
    return events;
  }

  for (const file of fs.readdirSync(traceDir)) {
    if (!file.endsWith('.jsonl')) continue;
    // file name: YYYY-MM-DD.jsonl
    const dateStr = file.replace('.jsonl', '');
    if (new Date(dateStr) < cutoff) continue;

    const lines = fs.readFileSync(path.join(traceDir, file), 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        events.push(JSON.parse(line) as TraceEvent);
      } catch {
        // skip malformed lines
      }
    }
  }

  return events;
}

function buildSessions(events: TraceEvent[]): SessionSummary[] {
  const sessions = new Map<string, SessionSummary>();

  for (const e of events) {
    if (e.type === 'session_start') {
      sessions.set(e.sessionId, {
        sessionId: e.sessionId,
        startTime: e.timestamp,
        success: true,   // default, overwritten by session_end
        turnCount: 0,
        toolCalls: [],
        toolErrors: [],
        hasSubagent: false,
      });
    }

    const s = sessions.get(e.sessionId);
    if (!s) continue;

    if (e.type === 'session_end') {
      s.endTime = e.timestamp;
      s.durationMs = e.durationMs;
      s.success = e.success ?? true;
      s.errorMessage = e.errorMessage;
      s.turnCount = e.turnCount ?? s.turnCount;
    }

    if (e.type === 'tool_call' && e.toolName) {
      s.toolCalls.push(e.toolName);
    }

    if (e.type === 'tool_error' && e.toolName) {
      s.toolErrors.push({ name: e.toolName, error: e.errorMessage ?? '' });
    }

    if (e.type === 'subagent_start') {
      s.hasSubagent = true;
    }
  }

  return Array.from(sessions.values());
}

function analyze(sessions: SessionSummary[]) {
  const total = sessions.length;
  const failed = sessions.filter(s => !s.success);
  const failureRate = total > 0 ? (failed.length / total) : 0;

  // Count by failure type
  const typeCounts: Record<string, { count: number; examples: string[] }> = {};
  for (const s of failed) {
    const type = classifyFailure(s);
    if (!typeCounts[type]) typeCounts[type] = { count: 0, examples: [] };
    typeCounts[type].count++;
    if (typeCounts[type].examples.length < 2 && s.errorMessage) {
      typeCounts[type].examples.push(s.errorMessage.slice(0, 120));
    }
  }

  // Sort by count desc, then by impact
  const impactOrder = { high: 0, medium: 1, low: 2 };
  const sorted = Object.entries(typeCounts).sort(([at, a], [bt, b]) => {
    if (b.count !== a.count) return b.count - a.count;
    return impactOrder[FAILURE_IMPACT[at] ?? 'low'] - impactOrder[FAILURE_IMPACT[bt] ?? 'low'];
  });

  const topFailures: FailureType[] = sorted.slice(0, 7).map(([type, data], i) => ({
    rank: i + 1,
    type,
    label: FAILURE_LABELS[type] ?? type,
    count: data.count,
    sessionImpact: FAILURE_IMPACT[type] ?? 'low',
    examples: data.examples,
  }));

  return {
    period: (() => {
      const dates = sessions.map(s => s.startTime).sort();
      return dates.length > 0 ? `${dates[0]!.slice(0, 10)} ~ ${dates[dates.length - 1]!.slice(0, 10)}` : 'N/A';
    })(),
    totalSessions: total,
    failedSessions: failed.length,
    failureRate: `${(failureRate * 100).toFixed(1)}%`,
    topFailures,
    stats: {
      avgTurnCount: sessions.length > 0
        ? (sessions.reduce((s, x) => s + x.turnCount, 0) / sessions.length).toFixed(1)
        : '0',
      avgDurationMs: sessions.filter(s => s.durationMs).length > 0
        ? Math.round(sessions.reduce((s, x) => s + (x.durationMs ?? 0), 0) / sessions.filter(s => s.durationMs).length)
        : 0,
      sessionsWithSubagent: sessions.filter(s => s.hasSubagent).length,
    },
  };
}

// ─── CLI ───

const args = process.argv.slice(2);
const daysIdx = args.indexOf('--days');
const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1] ?? '14', 10) : 14;
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? args[outIdx + 1] : undefined;

const traceDir = path.join(os.homedir(), '.deskhand', 'traces');
const events = loadEvents(traceDir, days);
const sessions = buildSessions(events);
const report = analyze(sessions);

const json = JSON.stringify(report, null, 2);

if (outFile) {
  fs.writeFileSync(outFile, json, 'utf8');
  console.log(`Report written to ${outFile}`);
} else {
  console.log(json);
}
