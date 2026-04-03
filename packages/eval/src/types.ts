/**
 * 测试场景定义
 */
export interface Scenario {
  id: string;
  name: string;
  description: string;
  input: string;
  expected_behavior: string;
  success_criteria: string[];
}

/**
 * 评分维度
 */
export interface ScoreDimension {
  name: string;
  score: number; // 0-10
  reasoning: string;
}

/**
 * 评估结果
 */
export interface EvalResult {
  scenario_id: string;
  scenario_name: string;
  timestamp: string;

  // 场景完整信息（用于报告展示）
  scenario: Scenario;

  // Agent 执行记录
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

  // 评分
  scores: ScoreDimension[];
  overall_score: number; // 0-10
  passed: boolean;

  // Judge 的总体评价
  judge_comment: string;
}
