import { describe, it, expect } from 'vitest';
import {
  Requirement,
  ValidationResult,
  ExecutionResult,
  FailureAnalysis,
  HealResult,
  TestCycleResult,
  OrchestratorReport,
} from '../../src/pipeline/types';

describe('Type validation', () => {
  it('should create valid Requirement', () => {
    const req: Requirement = {
      id: 'REQ-1',
      description: 'Test login flow',
      url: 'https://example.com',
      priority: 'critical',
      acceptanceCriteria: ['User can login', 'Error shown for invalid creds'],
    };
    expect(req.id).toBe('REQ-1');
    expect(req.priority).toBe('critical');
    expect(req.acceptanceCriteria).toHaveLength(2);
  });

  it('should create valid ValidationResult', () => {
    const valid: ValidationResult = { valid: true, errors: [], warnings: ['unused import'] };
    expect(valid.valid).toBe(true);
    expect(valid.warnings).toHaveLength(1);

    const invalid: ValidationResult = {
      valid: false,
      errors: ['Missing import', 'Syntax error'],
      warnings: [],
    };
    expect(invalid.errors).toHaveLength(2);
  });

  it('should create valid ExecutionResult', () => {
    const passed: ExecutionResult = { passed: true, duration: 150, retries: 0 };
    expect(passed.error).toBeUndefined();

    const failed: ExecutionResult = {
      passed: false,
      duration: 50,
      retries: 2,
      error: 'Locator not found',
      stdout: 'Test output...',
    };
    expect(failed.retries).toBe(2);
    expect(failed.stdout).toBeDefined();
  });

  it('should support all failure categories', () => {
    const categories: FailureAnalysis['category'][] = [
      'selector',
      'timing',
      'assertion',
      'environment',
      'bug',
      'unknown',
    ];
    for (const cat of categories) {
      const analysis: FailureAnalysis = {
        rootCause: `Test ${cat} failure`,
        category: cat,
        confidence: 0.8,
        suggestedFix: 'Fix it',
        isFlaky: cat === 'timing',
      };
      expect(analysis.category).toBe(cat);
    }
  });

  it('should support all final statuses', () => {
    const statuses: TestCycleResult['finalStatus'][] = [
      'passed',
      'failed',
      'healed',
      'unrecoverable',
    ];
    expect(statuses).toHaveLength(4);
  });

  it('should create valid OrchestratorReport', () => {
    const report: OrchestratorReport = {
      timestamp: new Date().toISOString(),
      requirements: 0,
      generated: 0,
      validated: 0,
      executed: 0,
      passed: 0,
      healed: 0,
      failed: 0,
      totalDuration: 0,
      cycles: [],
    };
    expect(report.timestamp).toMatch(/^\d{4}-/);
    expect(report.cycles).toHaveLength(0);
  });
});
