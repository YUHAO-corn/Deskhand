/**
 * generate-report.ts — 读取 trace JSONL，调用 AI 生成解读，输出 report.json
 *
 * 用法：bun scripts/generate-report.ts [--days 14] [--out scripts/report.json]
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// ─────────────────────────────────────────────────────────────────────────────
// Types (复用 analyze-traces 的逻辑，内联进来避免依赖)
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
  toolCalls: string[];
  toolErrors: { name: string; error: string }[];
  hasSubagent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load + parse
// ─────────────────────────────────────────────────────────────────────────────

function loadEvents(traceDir: string, days: number): TraceEvent[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const events: TraceEvent[] = [];

  if (!fs.existsSync(traceDir)) return events;

  for (const file of fs.readdirSync(traceDir).sort()) {
    if (!file.endsWith('.jsonl')) continue;
    const dateStr = file.replace('.jsonl', '');
    if (new Date(dateStr) < cutoff) continue;
    const lines = fs.readFileSync(path.join(traceDir, file), 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try { events.push(JSON.parse(line) as TraceEvent); } catch {}
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
        success: true,
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
    if (e.type === 'tool_call' && e.toolName) s.toolCalls.push(e.toolName);
    if (e.type === 'tool_error' && e.toolName) s.toolErrors.push({ name: e.toolName, error: e.errorMessage ?? '' });
    if (e.type === 'subagent_start') s.hasSubagent = true;
  }

  return Array.from(sessions.values());
}

function computeStats(sessions: SessionSummary[]) {
  const total = sessions.length;
  const failed = sessions.filter(s => !s.success);
  const failureRate = total > 0 ? failed.length / total : 0;

  // Tool usage frequency
  const toolFreq: Record<string, number> = {};
  const toolErrorFreq: Record<string, number> = {};
  for (const s of sessions) {
    for (const t of s.toolCalls) toolFreq[t] = (toolFreq[t] ?? 0) + 1;
    for (const e of s.toolErrors) toolErrorFreq[e.name] = (toolErrorFreq[e.name] ?? 0) + 1;
  }

  // Error messages grouped
  const errorGroups: Record<string, number> = {};
  for (const s of failed) {
    const key = s.errorMessage?.slice(0, 80) ?? 'unknown';
    errorGroups[key] = (errorGroups[key] ?? 0) + 1;
  }

  // Retry loops: sessions with 2+ errors on same tool
  const retryLoops = sessions.filter(s => {
    const counts: Record<string, number> = {};
    for (const e of s.toolErrors) counts[e.name] = (counts[e.name] ?? 0) + 1;
    return Object.values(counts).some(c => c >= 2);
  }).length;

  return {
    total,
    failed: failed.length,
    failureRate: parseFloat((failureRate * 100).toFixed(1)),
    retryLoops,
    avgTurnCount: total > 0
      ? parseFloat((sessions.reduce((a, s) => a + s.turnCount, 0) / total).toFixed(1))
      : 0,
    avgDurationMs: sessions.filter(s => s.durationMs).length > 0
      ? Math.round(sessions.filter(s => s.durationMs).reduce((a, s) => a + (s.durationMs ?? 0), 0) / sessions.filter(s => s.durationMs).length)
      : 0,
    sessionsWithSubagent: sessions.filter(s => s.hasSubagent).length,
    topTools: Object.entries(toolFreq).sort((a, b) => b[1] - a[1]).slice(0, 8),
    topToolErrors: Object.entries(toolErrorFreq).sort((a, b) => b[1] - a[1]).slice(0, 5),
    topErrors: Object.entries(errorGroups).sort((a, b) => b[1] - a[1]).slice(0, 7),
    period: sessions.length > 0
      ? `${sessions[0]!.startTime.slice(0, 10)} ~ ${sessions[sessions.length - 1]!.startTime.slice(0, 10)}`
      : 'N/A',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI analysis
// ─────────────────────────────────────────────────────────────────────────────

async function getAiInsight(stats: ReturnType<typeof computeStats>): Promise<{
  summary: string;
  failureAnalysis: string;
  topIssues: { title: string; description: string; severity: 'high' | 'medium' | 'low' }[];
  recommendations: { title: string; description: string }[];
}> {
  const prompt = `你是一个 AI agent 可靠性工程师，正在分析 agent 的运行日志。
请根据以下统计数据，给出清晰的中文诊断报告。

## 运行统计（${stats.period}）

- 总 session 数：${stats.total}
- 失败 session 数：${stats.failed}（异常率 ${stats.failureRate}%）
- 触发 tool 重试循环的 session：${stats.retryLoops}
- 平均对话轮次：${stats.avgTurnCount}
- 平均耗时：${stats.avgDurationMs}ms
- 含子 agent 的 session：${stats.sessionsWithSubagent}

## 最常用工具（调用次数）
${stats.topTools.map(([t, n]) => `- ${t}: ${n} 次`).join('\n')}

## 最常出错的工具
${stats.topToolErrors.map(([t, n]) => `- ${t}: ${n} 次错误`).join('\n') || '暂无'}

## 高频错误信息（Top 7）
${stats.topErrors.map(([e, n]) => `- [${n}次] ${e}`).join('\n') || '暂无'}

---

请以 JSON 格式返回分析结果（不要加 markdown 代码块，直接输出 JSON）：
{
  "summary": "一句话总结当前 agent 的健康状况（50字以内）",
  "failureAnalysis": "失败原因深度分析，2-4句话，指出根因",
  "topIssues": [
    {
      "title": "问题标题",
      "description": "具体描述，包括影响范围",
      "severity": "high|medium|low"
    }
  ],
  "recommendations": [
    {
      "title": "建议标题",
      "description": "具体的修复或优化建议"
    }
  ]
}

topIssues 最多 3 条，recommendations 最多 3 条，聚焦最重要的问题。`;

  try {
    // Use claude CLI (which has access to the authenticated channel)
    const escaped = prompt.replace(/'/g, "'\"'\"'");
    const result = execSync(`echo '${escaped}' | claude --print --output-format json`, {
      encoding: 'utf8',
      timeout: 60000,
    });
    const parsed = JSON.parse(result.trim());
    const text: string = parsed.result ?? '{}';
    return JSON.parse(text);
  } catch (e) {
    return {
      summary: `AI 解读不可用：${String(e).slice(0, 80)}`,
      failureAnalysis: '',
      topIssues: [],
      recommendations: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const daysIdx = args.indexOf('--days');
const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1] ?? '14', 10) : 14;
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? (args[outIdx + 1] ?? 'scripts/report.json') : 'scripts/report.json';

console.log(`📊 读取最近 ${days} 天的 trace 数据...`);
const traceDir = path.join(os.homedir(), '.deskhand', 'traces');
const events = loadEvents(traceDir, days);
const sessions = buildSessions(events);
const stats = computeStats(sessions);

console.log(`✅ 共 ${stats.total} 个 session，失败率 ${stats.failureRate}%`);
console.log(`🤖 正在调用 AI 生成解读...`);

const aiInsight = await getAiInsight(stats);

const report = {
  generatedAt: new Date().toISOString(),
  days,
  stats,
  aiInsight,
  // raw session list for detail view
  sessions: sessions.map(s => ({
    sessionId: s.sessionId,
    startTime: s.startTime,
    durationMs: s.durationMs,
    success: s.success,
    errorMessage: s.errorMessage,
    turnCount: s.turnCount,
    toolCallCount: s.toolCalls.length,
    toolErrorCount: s.toolErrors.length,
    hasSubagent: s.hasSubagent,
    topTools: [...new Set(s.toolCalls)],
  })),
};

fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
console.log(`✅ 报告已写入 ${outFile}`);
