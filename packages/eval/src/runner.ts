import { DeskhandAgent } from '@deskhand/shared/agent';
import type { AgentEvent } from '@deskhand/core';
import type { Scenario } from './types';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface RunResult {
  transcript: {
    user_input: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
    tool_calls: Array<{
      tool: string;
      input: any;
      output?: any;
    }>;
  };
}

/**
 * EvalRunner - 调用 DeskhandAgent 执行 scenario 并收集 transcript
 */
export class EvalRunner {
  private agent: DeskhandAgent;
  private workingDirectory: string;

  constructor(apiKey: string, workingDirectory?: string) {
    // 如果没有指定工作目录，创建临时目录
    if (!workingDirectory) {
      this.workingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'deskhand-eval-'));
    } else {
      this.workingDirectory = workingDirectory;
    }

    this.agent = new DeskhandAgent({
      apiKey,
      model: 'claude-opus-4-6',
      workingDirectory: this.workingDirectory,
    });
  }

  /**
   * 执行一个 scenario
   */
  async run(scenario: Scenario): Promise<RunResult> {
    const messages: RunResult['transcript']['messages'] = [];
    const tool_calls: RunResult['transcript']['tool_calls'] = [];

    // 添加用户输入
    messages.push({
      role: 'user',
      content: scenario.input,
    });

    let assistantMessage = '';
    const toolCallsMap = new Map<string, { tool: string; input: any; output?: any }>();

    // 收集事件
    const events: AgentEvent[] = [];

    // 调用 DeskhandAgent.chat() 并监听事件
    await this.agent.chat(scenario.input, {
      permissionMode: 'allow-all', // Eval 模式下自动允许所有操作
      onEvent: (event: AgentEvent) => {
        events.push(event);

        switch (event.type) {
          case 'text':
            // 收集 assistant 的文本输出（流式）
            assistantMessage += event.text;
            break;

          case 'text_complete':
            // 收集 assistant 的文本输出（完整）
            assistantMessage += event.text;
            break;

          case 'tool_start':
            // 记录工具调用开始
            if (event.toolUseId) {
              toolCallsMap.set(event.toolUseId, {
                tool: event.toolName,
                input: event.input,
              });
            }
            break;

          case 'tool_result':
            // 更新工具调用的输出
            if (event.toolUseId) {
              const toolCall = toolCallsMap.get(event.toolUseId);
              if (toolCall) {
                toolCall.output = event.content;
              }
            }
            break;

          case 'error':
            // 记录错误
            assistantMessage += `\n[ERROR: ${event.error}]`;
            break;
        }
      },
    });

    // 添加 assistant 的完整回复
    if (assistantMessage) {
      messages.push({
        role: 'assistant',
        content: assistantMessage,
      });
    }

    // 转换 toolCallsMap 为数组
    tool_calls.push(...Array.from(toolCallsMap.values()));

    return {
      transcript: {
        user_input: scenario.input,
        messages,
        tool_calls,
      },
    };
  }
}
