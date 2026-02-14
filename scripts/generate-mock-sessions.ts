/**
 * Generate mock session data for testing the Insight Pipeline.
 *
 * Creates sessions with repeated patterns:
 * - 3x "写周报" sessions (weekly report pattern)
 * - 2x "做落地页" sessions (landing page pattern)
 * - 1x random session (no pattern)
 *
 * Usage: bun run scripts/generate-mock-sessions.ts
 * Cleanup: bun run scripts/generate-mock-sessions.ts --clean
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

const SESSIONS_DIR = path.join(homedir(), '.deskhand', 'sessions');
const MOCK_PREFIX = 'mock-';

// Clean up mock sessions
if (process.argv.includes('--clean')) {
  const dirs = fs.readdirSync(SESSIONS_DIR);
  for (const dir of dirs) {
    if (dir.startsWith(MOCK_PREFIX)) {
      fs.rmSync(path.join(SESSIONS_DIR, dir), { recursive: true });
      console.log(`Deleted: ${dir}`);
    }
  }
  console.log('Done cleaning mock sessions.');
  process.exit(0);
}

interface MockSession {
  id: string;
  name: string;
  messages: Array<{ type: 'user' | 'assistant'; content: string }>;
}

const mockSessions: MockSession[] = [
  // --- Pattern 1: 写周报 (3 sessions) ---
  {
    id: `${MOCK_PREFIX}report-1`,
    name: '写周报',
    messages: [
      { type: 'user', content: '帮我写这周的周报，格式跟上次一样：标题、本周亮点、遇到的问题、下周计划' },
      { type: 'assistant', content: '好的，我来帮你整理周报。请告诉我这周的主要工作内容？' },
      { type: 'user', content: '这周主要完成了用户认证模块的开发，还修了3个线上bug' },
      { type: 'assistant', content: '# 周报 2026-02-07\n\n## 本周亮点\n- 完成用户认证模块开发\n- 修复3个线上bug\n\n## 遇到的问题\n- 暂无\n\n## 下周计划\n- 待补充' },
      { type: 'user', content: '下周计划是做支付集成，问题那里加上"认证模块和第三方OAuth对接有延迟"' },
      { type: 'assistant', content: '已更新。这是最终版本：\n\n# 周报 2026-02-07\n\n## 本周亮点\n- 完成用户认证模块开发\n- 修复3个线上bug\n\n## 遇到的问题\n- 认证模块和第三方OAuth对接有延迟\n\n## 下周计划\n- 支付集成模块开发' },
    ],
  },
  {
    id: `${MOCK_PREFIX}report-2`,
    name: '周报',
    messages: [
      { type: 'user', content: '写周报，老格式：标题、本周亮点、问题、下周计划' },
      { type: 'assistant', content: '好的，这周做了什么？' },
      { type: 'user', content: '支付集成做了一半，对接了Stripe API，还做了单元测试' },
      { type: 'assistant', content: '# 周报 2026-02-14\n\n## 本周亮点\n- Stripe API对接完成\n- 支付模块单元测试编写\n\n## 遇到的问题\n- 暂无\n\n## 下周计划\n- 待补充' },
      { type: 'user', content: '问题是Stripe webhook在测试环境不稳定，下周继续支付集成+做退款功能' },
      { type: 'assistant', content: '更新完成。' },
    ],
  },
  {
    id: `${MOCK_PREFIX}report-3`,
    name: '帮我写周报',
    messages: [
      { type: 'user', content: '又到周五了，帮我写周报吧。标题、亮点、问题、下周计划，你知道的' },
      { type: 'assistant', content: '来吧，这周的情况？' },
      { type: 'user', content: '退款功能上线了，还优化了支付流程的错误处理' },
      { type: 'assistant', content: '# 周报 2026-02-21\n\n## 本周亮点\n- 退款功能上线\n- 支付流程错误处理优化\n\n## 遇到的问题\n- 暂无\n\n## 下周计划\n- 待补充' },
    ],
  },

  // --- Pattern 2: 做落地页 (2 sessions) ---
  {
    id: `${MOCK_PREFIX}landing-1`,
    name: '做个产品落地页',
    messages: [
      { type: 'user', content: '帮我做一个SaaS产品的落地页，要响应式的，深色主题，有hero section和pricing' },
      { type: 'assistant', content: '好的，我来帮你设计。产品名称和主要卖点是什么？' },
      { type: 'user', content: '产品叫DataFlow，是一个数据管道工具，卖点是零代码配置、实时监控、自动扩缩容' },
      { type: 'assistant', content: '这是落地页的HTML代码...\n\n包含：\n- Hero section with gradient background\n- Feature cards (3 columns)\n- Pricing table (3 tiers)\n- Footer with links\n\n全部响应式，深色主题。' },
      { type: 'user', content: '不错，但hero的标题字太小了，pricing那里加个"最受欢迎"标签在Pro方案上' },
      { type: 'assistant', content: '已调整，标题改为4xl，Pro方案加了"Most Popular"badge。' },
    ],
  },
  {
    id: `${MOCK_PREFIX}landing-2`,
    name: '落地页设计',
    messages: [
      { type: 'user', content: '再帮我做一个落地页，这次是给我的个人项目用的，也是深色主题+响应式' },
      { type: 'assistant', content: '好的，什么项目？需要哪些section？' },
      { type: 'user', content: '一个开源CLI工具叫quickdeploy，需要hero、features、getting started代码示例、GitHub star按钮' },
      { type: 'assistant', content: '落地页做好了，包含：\n- Hero with terminal animation\n- Feature grid\n- Code snippet with syntax highlighting\n- GitHub CTA button\n\n深色主题，完全响应式。' },
    ],
  },

  // --- No pattern: random session ---
  {
    id: `${MOCK_PREFIX}random-1`,
    name: '翻译一段话',
    messages: [
      { type: 'user', content: '帮我把这段中文翻译成英文：我们的产品致力于让每个人都能轻松使用AI' },
      { type: 'assistant', content: 'Our product is dedicated to making AI accessible and easy to use for everyone.' },
    ],
  },
];

// Generate JSONL files
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

for (const session of mockSessions) {
  const sessionDir = path.join(SESSIONS_DIR, session.id);
  fs.mkdirSync(sessionDir, { recursive: true });

  const now = Date.now();
  let content = '';

  // Header
  content += JSON.stringify({
    _type: 'session',
    id: session.id,
    name: session.name,
    createdAt: now - 86400000, // 1 day ago
    lastMessageAt: now,
    preview: session.messages[0].content.slice(0, 50),
    messageCount: session.messages.length,
  }) + '\n';

  // Messages
  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i];
    content += JSON.stringify({
      _type: 'message',
      id: `msg-mock-${session.id}-${i}`,
      type: msg.type,
      content: msg.content,
      timestamp: now - (session.messages.length - i) * 60000,
    }) + '\n';
  }

  fs.writeFileSync(path.join(sessionDir, 'session.jsonl'), content);
  console.log(`Created: ${session.id} (${session.messages.length} messages)`);
}

console.log(`\nDone! Created ${mockSessions.length} mock sessions.`);
console.log('Run insight: window.electronAPI.triggerInsight()');
console.log('Clean up:    bun run scripts/generate-mock-sessions.ts --clean');
