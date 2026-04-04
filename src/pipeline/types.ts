export type PipelineStage = 'generate' | 'validate' | 'execute' | 'analyze' | 'heal';
export type StageStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface Requirement {
  id: string;
  description: string;
  url: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  acceptanceCriteria: string[];
}

export interface GeneratedTest {
  requirementId: string;
  code: string;
  framework: string;
  filePath: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExecutionResult {
  passed: boolean;
  duration: number;
  error?: string;
  stdout?: string;
  retries: number;
}

export interface FailureAnalysis {
  rootCause: string;
  category: 'selector' | 'timing' | 'assertion' | 'environment' | 'bug' | 'unknown';
  confidence: number;
  suggestedFix: string;
  isFlaky: boolean;
}

export interface HealResult {
  attempted: boolean;
  healed: boolean;
  originalError: string;
  fix: string;
  newCode?: string;
}

export interface TestCycleResult {
  requirement: Requirement;
  generation: { code: string; duration: number };
  validation: ValidationResult;
  execution?: ExecutionResult;
  analysis?: FailureAnalysis;
  healing?: HealResult;
  finalStatus: 'passed' | 'failed' | 'healed' | 'unrecoverable';
  stages: Record<PipelineStage, StageStatus>;
}

export interface OrchestratorReport {
  timestamp: string;
  requirements: number;
  generated: number;
  validated: number;
  executed: number;
  passed: number;
  healed: number;
  failed: number;
  totalDuration: number;
  cycles: TestCycleResult[];
}
