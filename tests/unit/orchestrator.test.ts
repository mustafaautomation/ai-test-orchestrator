import { describe, it, expect } from 'vitest';
import { Orchestrator, LLMProvider, TestRunner, TestValidator } from '../../src/pipeline/orchestrator';
import { Requirement, ValidationResult, ExecutionResult } from '../../src/pipeline/types';

const validCode = `import { test, expect } from '@playwright/test';\ntest.describe('T', () => { test('t', async ({ page }) => { await page.goto('https://example.com'); }); });`;

const mockLLM: LLMProvider = { async generate() { return validCode; } };
const passingRunner: TestRunner = { async execute(): Promise<ExecutionResult> { return { passed: true, duration: 100, retries: 0 }; } };
const failingRunner: TestRunner = { async execute(): Promise<ExecutionResult> { return { passed: false, duration: 50, retries: 0, error: 'Locator not found: #missing' }; } };
const goodValidator: TestValidator = { validate(): ValidationResult { return { valid: true, errors: [], warnings: [] }; } };
const badValidator: TestValidator = { validate(): ValidationResult { return { valid: false, errors: ['Missing import'], warnings: [] }; } };

const req: Requirement = {
  id: 'REQ-1', description: 'Homepage loads', url: 'https://example.com',
  priority: 'high', acceptanceCriteria: ['Page loads', 'Title visible'],
};

describe('Orchestrator', () => {
  it('should complete pipeline when all stages pass', async () => {
    const orch = new Orchestrator(mockLLM, passingRunner, goodValidator);
    const report = await orch.runPipeline([req]);

    expect(report.requirements).toBe(1);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(0);
    expect(report.cycles[0].finalStatus).toBe('passed');
    expect(report.cycles[0].stages.generate).toBe('passed');
    expect(report.cycles[0].stages.execute).toBe('passed');
  });

  it('should fail at validation stage', async () => {
    const orch = new Orchestrator(mockLLM, passingRunner, badValidator);
    const report = await orch.runPipeline([req]);

    expect(report.passed).toBe(0);
    expect(report.failed).toBe(1);
    expect(report.cycles[0].finalStatus).toBe('failed');
    expect(report.cycles[0].stages.validate).toBe('failed');
    expect(report.cycles[0].stages.execute).toBe('pending');
  });

  it('should attempt self-heal on execution failure', async () => {
    const orch = new Orchestrator(mockLLM, failingRunner, goodValidator, 1);
    const report = await orch.runPipeline([req]);

    expect(report.cycles[0].analysis).toBeDefined();
    expect(report.cycles[0].analysis?.category).toBe('selector');
    expect(report.cycles[0].healing?.attempted).toBe(true);
  });

  it('should handle multiple requirements', async () => {
    const orch = new Orchestrator(mockLLM, passingRunner, goodValidator);
    const report = await orch.runPipeline([req, { ...req, id: 'REQ-2', description: 'Login works' }]);

    expect(report.requirements).toBe(2);
    expect(report.passed).toBe(2);
  });
});

describe('analyzeFailure', () => {
  const orch = new Orchestrator(mockLLM, passingRunner, goodValidator);

  it('should detect selector issues', () => {
    const analysis = orch.analyzeFailure('Locator not found: #missing-element');
    expect(analysis.category).toBe('selector');
  });

  it('should detect timing issues', () => {
    const analysis = orch.analyzeFailure('Timeout 30000ms waiting for element');
    expect(analysis.category).toBe('timing');
    expect(analysis.isFlaky).toBe(true);
  });

  it('should detect assertion failures', () => {
    const analysis = orch.analyzeFailure('expect(received).toBeTruthy()');
    expect(analysis.category).toBe('assertion');
  });

  it('should detect environment issues', () => {
    const analysis = orch.analyzeFailure('ECONNREFUSED 127.0.0.1:3000');
    expect(analysis.category).toBe('environment');
  });

  it('should handle unknown errors', () => {
    const analysis = orch.analyzeFailure('Segmentation fault in native module');
    expect(analysis.category).toBe('unknown');
    expect(analysis.confidence).toBeLessThan(0.5);
  });
});
