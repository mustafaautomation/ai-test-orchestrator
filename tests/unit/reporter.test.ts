import { describe, it, expect, vi } from 'vitest';
import { printReport } from '../../src/reporters/console';
import { OrchestratorReport } from '../../src/pipeline/types';

describe('printReport', () => {
  it('should print report without errors', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const report: OrchestratorReport = {
      timestamp: '2026-04-05T10:00:00Z',
      requirements: 2,
      generated: 2,
      validated: 2,
      executed: 2,
      passed: 1,
      healed: 1,
      failed: 0,
      totalDuration: 500,
      cycles: [
        {
          requirement: {
            id: 'REQ-1',
            description: 'Test login',
            url: 'https://example.com',
            priority: 'high',
            acceptanceCriteria: ['Page loads'],
          },
          generation: { code: 'test code', duration: 100 },
          validation: { valid: true, errors: [], warnings: [] },
          execution: { passed: true, duration: 200, retries: 0 },
          finalStatus: 'passed',
          stages: {
            generate: 'passed',
            validate: 'passed',
            execute: 'passed',
            analyze: 'skipped',
            heal: 'skipped',
          },
        },
        {
          requirement: {
            id: 'REQ-2',
            description: 'Test checkout',
            url: 'https://example.com/checkout',
            priority: 'critical',
            acceptanceCriteria: ['Checkout works'],
          },
          generation: { code: 'test code 2', duration: 150 },
          validation: { valid: true, errors: [], warnings: [] },
          execution: { passed: false, duration: 100, retries: 0, error: 'Locator not found' },
          analysis: {
            rootCause: 'Element selector not found',
            category: 'selector',
            confidence: 0.85,
            suggestedFix: 'Use getByRole',
            isFlaky: false,
          },
          healing: {
            attempted: true,
            healed: true,
            originalError: 'Locator not found',
            fix: 'Use getByRole',
            newCode: 'fixed code',
          },
          finalStatus: 'healed',
          stages: {
            generate: 'passed',
            validate: 'passed',
            execute: 'failed',
            analyze: 'passed',
            heal: 'passed',
          },
        },
      ],
    };

    printReport(report);

    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('AI Test Orchestrator Report');
    expect(output).toContain('2 requirements');
    expect(output).toContain('1 passed');
    expect(output).toContain('1 healed');
    expect(output).toContain('Test login');
    expect(output).toContain('Test checkout');
    expect(output).toContain('Self-healed');

    spy.mockRestore();
  });

  it('should handle empty report', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const report: OrchestratorReport = {
      timestamp: '2026-04-05T10:00:00Z',
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

    printReport(report);
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('0 requirements');

    spy.mockRestore();
  });
});
