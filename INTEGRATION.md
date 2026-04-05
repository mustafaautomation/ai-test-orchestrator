# Integration Guide — AI Testing Pipeline

## End-to-End AI QA Workflow

```
Requirements (Jira/PRD)
    ↓
ai-requirements-analyzer      → Extract test specs from PRDs
    ↓
ai-test-orchestrator           → Generate + validate + execute + self-heal  ← YOU ARE HERE
    ↓
playwright-enterprise-framework → Execute generated Playwright tests
    ↓
test-observability-platform    → Aggregate results, compute readiness
    ↓
ai-code-reviewer               → AI reviews any code changes
    ↓
n8n-enterprise-workflows       → Notify Slack, create Jira tickets
```

## Integration with ai-requirements-analyzer

```bash
# 1. Extract requirements
npx req-analyze analyze prd.md --json > requirements.json

# 2. Feed to orchestrator
npx ato run requirements.json
```

## Integration with Playwright

```typescript
import { Orchestrator } from 'ai-test-orchestrator';

// Use Playwright as the test runner
const playwrightRunner = {
  async execute(filePath: string) {
    const result = execSync(`npx playwright test "${filePath}" --reporter=json`);
    return { passed: result.status === 0, duration: 5000, retries: 0 };
  },
};

const orchestrator = new Orchestrator(claudeClient, playwrightRunner, validator);
```

## Integration with Claude API

```typescript
import Anthropic from '@anthropic-ai/sdk';

const llm = {
  async generate(prompt: string) {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.content[0].type === 'text' ? res.content[0].text : '';
  },
};
```

## Full CI Pipeline

```yaml
- name: Generate tests from requirements
  run: npx ato run requirements.json --mock

- name: Run generated tests
  run: npx playwright test .atr/generated/

- name: Analyze results
  run: npx testobs ingest test-results/*.json
```
