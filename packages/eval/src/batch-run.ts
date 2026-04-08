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

  // 读取所有 scenario 文件
  const scenariosDir = path.resolve(process.cwd(), 'scenarios');
  const files = await fs.readdir(scenariosDir);
  const scenarioFiles = files.filter(f => f.endsWith('.json')).sort();

  console.log(`📋 找到 ${scenarioFiles.length} 个场景\n`);

  const results: EvalResult[] = [];
  const runner = new EvalRunner(apiKey);
  const judge = new Judge(apiKey);
  const reporter = new Reporter();

  for (const file of scenarioFiles) {
    const scenarioPath = path.join(scenariosDir, file);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 场景: ${file}`);
    console.log('='.repeat(60));

    try {
      // 读取 scenario
      const scenarioContent = await fs.readFile(scenarioPath, 'utf-8');
      const scenario: Scenario = JSON.parse(scenarioContent);

      console.log(`🎯 ${scenario.name}`);
      console.log(`💬 用户输入: ${scenario.input}\n`);

      // 执行
      console.log('🤖 启动 Agent...');
      const runResult = await runner.run(scenario);
      console.log(`✅ Agent 执行完成 (消息: ${runResult.transcript.messages.length}, 工具: ${runResult.transcript.tool_calls.length})`);

      // 评分
      console.log('⚖️  启动 Judge...');
      const judgeResult = await judge.score(scenario, runResult);
      console.log(`✅ 评分完成: ${judgeResult.overall_score.toFixed(1)}/10 ${judgeResult.passed ? '✅ PASSED' : '❌ FAILED'}`);

      // 生成报告
      const evalResult: EvalResult = {
        scenario_id: scenario.id,
        scenario_name: scenario.name,
        timestamp: new Date().toISOString(),
        scenario,
        transcript: runResult.transcript,
        ...judgeResult,
      };

      await reporter.generate(evalResult);
      results.push(evalResult);

    } catch (error) {
      console.error(`❌ 场景执行失败: ${error}`);
    }
  }

  // 汇总报告
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📊 批量运行汇总');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const avgScore = results.reduce((sum, r) => sum + r.overall_score, 0) / results.length;

  console.log(`\n总场景数: ${results.length}`);
  console.log(`✅ 通过: ${passed} (${(passed / results.length * 100).toFixed(1)}%)`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📈 平均分: ${avgScore.toFixed(1)}/10\n`);

  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${r.scenario_name}: ${r.overall_score.toFixed(1)}/10`);
  });

  console.log('\n🎉 批量评估完成!\n');
}

main().catch((error) => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});
