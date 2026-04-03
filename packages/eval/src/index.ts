#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { EvalRunner } from './runner';
import { Judge } from './judge';
import { Reporter } from './reporter';
import type { Scenario, EvalResult } from './types';

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ 错误: 未设置 ANTHROPIC_API_KEY 环境变量');
    process.exit(1);
  }

  // 读取 scenario
  const scenarioPath = process.argv[2] || 'scenarios/001-create-react-component.json';
  const scenarioFullPath = path.resolve(process.cwd(), scenarioPath);

  console.log(`📋 加载场景: ${scenarioFullPath}`);
  const scenarioContent = await fs.readFile(scenarioFullPath, 'utf-8');
  const scenario: Scenario = JSON.parse(scenarioContent);

  console.log(`\n🎯 场景: ${scenario.name}`);
  console.log(`📝 描述: ${scenario.description}`);
  console.log(`\n💬 用户输入: ${scenario.input}\n`);

  // 执行 scenario
  console.log('🤖 启动 Agent...');
  const runner = new EvalRunner(apiKey);
  const runResult = await runner.run(scenario);

  console.log('✅ Agent 执行完成');
  console.log(`   - 消息数: ${runResult.transcript.messages.length}`);
  console.log(`   - 工具调用数: ${runResult.transcript.tool_calls.length}`);

  // 评分
  console.log('\n⚖️  启动 Judge...');
  const judge = new Judge(apiKey);
  const judgeResult = await judge.score(scenario, runResult);

  console.log('✅ 评分完成');
  console.log(`   - 总分: ${judgeResult.overall_score.toFixed(1)}/10`);
  console.log(`   - 结果: ${judgeResult.passed ? '✅ PASSED' : '❌ FAILED'}`);

  // 生成报告
  const evalResult: EvalResult = {
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    timestamp: new Date().toISOString(),
    scenario, // 包含完整的 scenario 信息
    transcript: runResult.transcript,
    ...judgeResult,
  };

  const reporter = new Reporter();
  await reporter.generate(evalResult);

  console.log('\n🎉 评估完成!\n');
}

main().catch((error) => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});
