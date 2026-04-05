import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('CLI integration', () => {
  it('should show help without errors', () => {
    const output = execSync('node dist/cli.js --help', {
      cwd: path.resolve(__dirname, '../..'),
    }).toString();
    expect(output).toContain('AI Test Orchestrator CLI');
    expect(output).toContain('run');
  });

  it('should show version', () => {
    const output = execSync('node dist/cli.js --version', {
      cwd: path.resolve(__dirname, '../..'),
    }).toString();
    expect(output.trim()).toBe('1.0.0');
  });

  it('should run pipeline with example requirements', () => {
    const examplesPath = path.resolve(__dirname, '../../examples/saucedemo-requirements.json');
    expect(fs.existsSync(examplesPath)).toBe(true);

    // Run in mock mode — should succeed
    const output = execSync(`node dist/cli.js run ${examplesPath}`, {
      cwd: path.resolve(__dirname, '../..'),
    }).toString();
    expect(output).toContain('AI Test Orchestrator Report');
    expect(output).toContain('passed');
  });

  it('should fail gracefully for non-existent file', () => {
    try {
      execSync('node dist/cli.js run non-existent.json', {
        cwd: path.resolve(__dirname, '../..'),
        stdio: 'pipe',
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (e) {
      // Expected to fail
      expect(e).toBeDefined();
    }
  });
});
