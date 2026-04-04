#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import { Orchestrator, LLMProvider, TestRunner, TestValidator } from './pipeline/orchestrator';
import { Requirement, ValidationResult, ExecutionResult } from './pipeline/types';
import { printReport } from './reporters/console';

const mockLLM: LLMProvider = {
  async generate(_prompt: string) {
    return `import { test, expect } from '@playwright/test';\ntest.describe('Generated', () => {\n  test('check page', async ({ page }) => {\n    await page.goto('https://example.com');\n    await expect(page).toHaveURL(/example/);\n  });\n});`;
  },
};

const mockRunner: TestRunner = {
  async execute(_filePath: string): Promise<ExecutionResult> {
    return { passed: true, duration: 150, retries: 0 };
  },
};

const mockValidator: TestValidator = {
  validate(code: string): ValidationResult {
    const hasImport = code.includes('@playwright/test');
    const hasTest = code.includes('test(') || code.includes('test.describe');
    return {
      valid: hasImport && hasTest,
      errors: hasImport ? [] : ['Missing @playwright/test import'],
      warnings: [],
    };
  },
};

const program = new Command();
program.name('ato').description('AI Test Orchestrator CLI').version('1.0.0');

program
  .command('run')
  .description('Run the full AI test pipeline from requirements')
  .argument('<requirements>', 'JSON file with requirements')
  .option('--mock', 'Use mock LLM and runner (demo mode)')
  .action(async (file: string, _options) => {
    const reqs: Requirement[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const orchestrator = new Orchestrator(mockLLM, mockRunner, mockValidator);
    const report = await orchestrator.runPipeline(reqs);
    printReport(report);
    if (report.failed > 0) process.exit(1);
  });

program.parse();
