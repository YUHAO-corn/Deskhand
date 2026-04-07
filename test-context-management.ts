/**
 * 测试：验证 Claude Agent SDK 是否支持 context_management 参数
 *
 * 目的：确认 SDK 能否传递 context_management 给底层 Claude API
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

async function testContextManagement() {
  console.log('=== 测试 1: 尝试在 Options 中传递 context_management ===\n');

  try {
    // 尝试传递 context_management（即使类型不支持）
    const q = query({
      prompt: 'Hello, this is a test',
      options: {
        model: 'claude-opus-4-6',
        maxTurns: 1,
        // @ts-expect-error - 测试是否能传递未定义的参数
        context_management: {
          edits: [{
            type: 'compact_20260112',
            trigger: { type: 'input_tokens', value: 140000 }
          }]
        }
      }
    });

    for await (const message of q) {
      if (message.type === 'result') {
        console.log('✅ 请求成功（但不确定 context_management 是否生效）');
        console.log('Result:', message);
        break;
      }
    }
  } catch (error) {
    console.error('❌ 请求失败:', error);
  }

  console.log('\n=== 测试 2: 检查 SDK 是否有其他压缩相关配置 ===\n');

  // 检查 Settings 中的 autoCompactWindow
  try {
    const q2 = query({
      prompt: 'Hello again',
      options: {
        model: 'claude-opus-4-6',
        maxTurns: 1,
        settings: {
          // @ts-expect-error - 测试 Settings 中的 autoCompactWindow
          autoCompactWindow: 140000
        }
      }
    });

    for await (const message of q2) {
      if (message.type === 'result') {
        console.log('✅ Settings.autoCompactWindow 请求成功');
        break;
      }
    }
  } catch (error) {
    console.error('❌ Settings.autoCompactWindow 失败:', error);
  }

  console.log('\n=== 测试 3: 检查 PreCompact Hook ===\n');

  try {
    const q3 = query({
      prompt: 'Test with PreCompact hook',
      options: {
        model: 'claude-opus-4-6',
        maxTurns: 1,
        hooks: {
          PreCompact: [async (input) => {
            console.log('🎯 PreCompact Hook 被触发！');
            console.log('Trigger:', input.trigger);
            console.log('Custom instructions:', input.custom_instructions);
            return {
              additionalContext: '测试：保留任务上下文'
            };
          }]
        }
      }
    });

    for await (const message of q3) {
      if (message.type === 'result') {
        console.log('✅ PreCompact Hook 配置成功');
        break;
      }
    }
  } catch (error) {
    console.error('❌ PreCompact Hook 失败:', error);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  testContextManagement().catch(console.error);
}

export { testContextManagement };
