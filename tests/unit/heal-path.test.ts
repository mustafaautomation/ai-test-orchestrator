import { describe, it, expect } from 'vitest';
import {
  Orchestrator,
  LLMProvider,
  TestRunner,
  TestValidator,
} from '../../src/pipeline/orchestrator';
import { Requirement, ValidationResult, ExecutionResult } from '../../src/pipeline/types';

const validCode = `import { test, expect } from '@playwright/test';\ntest.describe('T', () => { test('t', async ({ page }) => { await page.goto('https://example.com'); }); });`;

const req: Requirement = {
  id: 'REQ-1',
  description: 'Test page',
  url: 'https://example.com',
  priority: 'high',
  acceptanceCriteria: ['Page loads'],
};

const goodValidator: TestValidator = {
  validate(): ValidationResult {
    return { valid: true, errors: [], warnings: [] };
  },
};

describe('Orchestrator — self-heal success path', () => {
  it('should successfully self-heal on second execution', async () => {
    let callCount = 0;
    const healableRunner: TestRunner = {
      async execute(): Promise<ExecutionResult> {
        callCount++;
        // First call fails (original code), second call passes (healed code)
        if (callCount <= 1) {
          return { passed: false, duration: 50, retries: 0, error: 'Locator not found: #old' };
        }
        return { passed: true, duration: 100, retries: 0 };
      },
    };

    const mockLLM: LLMProvider = {
      async generate() {
        return validCode;
      },
    };

    const orch = new Orchestrator(mockLLM, healableRunner, goodValidator, 2);
    const report = await orch.runPipeline([req]);

    expect(report.healed).toBe(1);
    expect(report.failed).toBe(0);
    expect(report.cycles[0].finalStatus).toBe('healed');
    expect(report.cycles[0].healing?.healed).toBe(true);
    expect(report.cycles[0].healing?.newCode).toBeDefined();
  });

  it('should not attempt heal for environment errors', async () => {
    const envFailRunner: TestRunner = {
      async execute(): Promise<ExecutionResult> {
        return { passed: false, duration: 50, retries: 0, error: 'ECONNREFUSED 127.0.0.1:3000' };
      },
    };

    const mockLLM: LLMProvider = {
      async generate() {
        return validCode;
      },
    };

    const orch = new Orchestrator(mockLLM, envFailRunner, goodValidator, 2);
    const report = await orch.runPipeline([req]);

    expect(report.cycles[0].finalStatus).toBe('unrecoverable');
    expect(report.cycles[0].healing?.attempted).toBe(false);
    expect(report.cycles[0].analysis?.category).toBe('environment');
  });

  it('should exhaust heal attempts and mark unrecoverable', async () => {
    const alwaysFailRunner: TestRunner = {
      async execute(): Promise<ExecutionResult> {
        return { passed: false, duration: 50, retries: 0, error: 'expect(received).toBeTruthy()' };
      },
    };

    const mockLLM: LLMProvider = {
      async generate() {
        return validCode;
      },
    };

    const orch = new Orchestrator(mockLLM, alwaysFailRunner, goodValidator, 3);
    const report = await orch.runPipeline([req]);

    expect(report.cycles[0].finalStatus).toBe('unrecoverable');
    expect(report.cycles[0].healing?.attempted).toBe(true);
    expect(report.cycles[0].healing?.healed).toBe(false);
  });

  it('should handle mixed results across multiple requirements', async () => {
    let reqIndex = 0;
    const mixedRunner: TestRunner = {
      async execute(): Promise<ExecutionResult> {
        reqIndex++;
        if (reqIndex === 1) return { passed: true, duration: 100, retries: 0 };
        return { passed: false, duration: 50, retries: 0, error: 'Network error' };
      },
    };

    const mockLLM: LLMProvider = {
      async generate() {
        return validCode;
      },
    };

    const orch = new Orchestrator(mockLLM, mixedRunner, goodValidator, 1);
    const report = await orch.runPipeline([
      req,
      { ...req, id: 'REQ-2', description: 'Test checkout' },
    ]);

    expect(report.passed).toBe(1);
    expect(report.cycles[0].finalStatus).toBe('passed');
    // Second one fails with environment error, can't heal
    expect(report.cycles[1].finalStatus).not.toBe('passed');
  });
});

describe('Orchestrator — generation prompt', () => {
  it('should include requirement details in LLM prompt', async () => {
    let capturedPrompt = '';
    const captureLLM: LLMProvider = {
      async generate(prompt: string) {
        capturedPrompt = prompt;
        return validCode;
      },
    };

    const passingRunner: TestRunner = {
      async execute(): Promise<ExecutionResult> {
        return { passed: true, duration: 100, retries: 0 };
      },
    };

    const orch = new Orchestrator(captureLLM, passingRunner, goodValidator);
    await orch.runPipeline([req]);

    expect(capturedPrompt).toContain('https://example.com');
    expect(capturedPrompt).toContain('Test page');
    expect(capturedPrompt).toContain('high');
    expect(capturedPrompt).toContain('Page loads');
    expect(capturedPrompt).toContain('@playwright/test');
  });
});
