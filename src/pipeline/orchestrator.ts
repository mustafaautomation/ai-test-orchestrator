import {
  Requirement,
  TestCycleResult,
  OrchestratorReport,
  StageStatus,
  PipelineStage,
  ValidationResult,
  ExecutionResult,
  FailureAnalysis,
  HealResult,
} from './types';

export interface LLMProvider {
  generate(prompt: string): Promise<string>;
}

export interface TestRunner {
  execute(filePath: string): Promise<ExecutionResult>;
}

export interface TestValidator {
  validate(code: string): ValidationResult;
}

export class Orchestrator {
  private llm: LLMProvider;
  private runner: TestRunner;
  private validator: TestValidator;
  private maxHealAttempts: number;

  constructor(llm: LLMProvider, runner: TestRunner, validator: TestValidator, maxHealAttempts = 2) {
    this.llm = llm;
    this.runner = runner;
    this.validator = validator;
    this.maxHealAttempts = maxHealAttempts;
  }

  async runPipeline(requirements: Requirement[]): Promise<OrchestratorReport> {
    const start = Date.now();
    const cycles: TestCycleResult[] = [];

    for (const req of requirements) {
      const cycle = await this.runCycle(req);
      cycles.push(cycle);
    }

    return {
      timestamp: new Date().toISOString(),
      requirements: requirements.length,
      generated: cycles.length,
      validated: cycles.filter((c) => c.validation.valid).length,
      executed: cycles.filter((c) => c.execution).length,
      passed: cycles.filter((c) => c.finalStatus === 'passed').length,
      healed: cycles.filter((c) => c.finalStatus === 'healed').length,
      failed: cycles.filter((c) => c.finalStatus === 'failed' || c.finalStatus === 'unrecoverable')
        .length,
      totalDuration: Date.now() - start,
      cycles,
    };
  }

  async runCycle(requirement: Requirement): Promise<TestCycleResult> {
    const stages: Record<PipelineStage, StageStatus> = {
      generate: 'pending',
      validate: 'pending',
      execute: 'pending',
      analyze: 'pending',
      heal: 'pending',
    };

    // Stage 1: Generate
    stages.generate = 'running';
    const genStart = Date.now();
    const prompt = this.buildGenerationPrompt(requirement);
    const code = await this.llm.generate(prompt);
    const genDuration = Date.now() - genStart;
    stages.generate = 'passed';

    // Stage 2: Validate
    stages.validate = 'running';
    const validation = this.validator.validate(code);
    stages.validate = validation.valid ? 'passed' : 'failed';

    if (!validation.valid) {
      return {
        requirement,
        generation: { code, duration: genDuration },
        validation,
        finalStatus: 'failed',
        stages,
      };
    }

    // Stage 3: Execute
    stages.execute = 'running';
    const execution = await this.runner.execute(`test-${requirement.id}.spec.ts`);
    stages.execute = execution.passed ? 'passed' : 'failed';

    if (execution.passed) {
      stages.analyze = 'skipped';
      stages.heal = 'skipped';
      return {
        requirement,
        generation: { code, duration: genDuration },
        validation,
        execution,
        finalStatus: 'passed',
        stages,
      };
    }

    // Stage 4: Analyze failure
    stages.analyze = 'running';
    const analysis = this.analyzeFailure(execution.error || 'Unknown error');
    stages.analyze = 'passed';

    // Stage 5: Self-heal
    stages.heal = 'running';
    const healing = await this.attemptHeal(code, analysis, requirement);
    stages.heal = healing.healed ? 'passed' : 'failed';

    return {
      requirement,
      generation: { code, duration: genDuration },
      validation,
      execution,
      analysis,
      healing,
      finalStatus: healing.healed ? 'healed' : 'unrecoverable',
      stages,
    };
  }

  analyzeFailure(error: string): FailureAnalysis {
    const lowerError = error.toLowerCase();

    if (
      lowerError.includes('locator') ||
      lowerError.includes('selector') ||
      lowerError.includes('not found')
    ) {
      return {
        rootCause: 'Element selector not found',
        category: 'selector',
        confidence: 0.85,
        suggestedFix: 'Use more resilient selectors (getByRole, getByText)',
        isFlaky: false,
      };
    }
    if (lowerError.includes('timeout') || lowerError.includes('waiting')) {
      return {
        rootCause: 'Element or navigation timeout',
        category: 'timing',
        confidence: 0.8,
        suggestedFix: 'Add explicit waits or increase timeout',
        isFlaky: true,
      };
    }
    if (
      lowerError.includes('expect') ||
      lowerError.includes('assert') ||
      lowerError.includes('tobetruthy')
    ) {
      return {
        rootCause: 'Assertion mismatch',
        category: 'assertion',
        confidence: 0.9,
        suggestedFix: 'Update expected value or use more flexible matcher',
        isFlaky: false,
      };
    }
    if (lowerError.includes('econnrefused') || lowerError.includes('network')) {
      return {
        rootCause: 'Network/environment issue',
        category: 'environment',
        confidence: 0.7,
        suggestedFix: 'Check if target URL is accessible',
        isFlaky: true,
      };
    }

    return {
      rootCause: 'Unknown failure',
      category: 'unknown',
      confidence: 0.3,
      suggestedFix: 'Manual investigation required',
      isFlaky: false,
    };
  }

  private async attemptHeal(
    originalCode: string,
    analysis: FailureAnalysis,
    requirement: Requirement,
  ): Promise<HealResult> {
    if (analysis.category === 'environment') {
      return {
        attempted: false,
        healed: false,
        originalError: analysis.rootCause,
        fix: 'Environment issue — cannot self-heal',
      };
    }

    for (let attempt = 0; attempt < this.maxHealAttempts; attempt++) {
      const healPrompt = `Fix this test code. Error: ${analysis.rootCause}. Suggestion: ${analysis.suggestedFix}\n\nOriginal:\n${originalCode}\n\nRequirement: ${requirement.description}\n\nReturn ONLY the fixed code.`;
      const newCode = await this.llm.generate(healPrompt);
      const validation = this.validator.validate(newCode);

      if (validation.valid) {
        const execution = await this.runner.execute(`heal-${requirement.id}-${attempt}.spec.ts`);
        if (execution.passed) {
          return {
            attempted: true,
            healed: true,
            originalError: analysis.rootCause,
            fix: analysis.suggestedFix,
            newCode,
          };
        }
      }
    }

    return {
      attempted: true,
      healed: false,
      originalError: analysis.rootCause,
      fix: 'Self-heal attempts exhausted',
    };
  }

  private buildGenerationPrompt(requirement: Requirement): string {
    const criteria = requirement.acceptanceCriteria.map((c) => `- ${c}`).join('\n');
    return `Generate a Playwright test for:\n\nURL: ${requirement.url}\nDescription: ${requirement.description}\nPriority: ${requirement.priority}\n\nAcceptance Criteria:\n${criteria}\n\nReturn ONLY TypeScript code using @playwright/test.`;
  }
}
