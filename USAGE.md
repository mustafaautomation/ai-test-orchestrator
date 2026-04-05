# Real-World Use Cases

## 1. Sprint Regression — Generate Tests from Jira Tickets

Export sprint requirements as JSON, generate tests automatically:

```json
[
  {
    "id": "JIRA-1234",
    "description": "User can reset password via email link",
    "url": "https://staging.example.com/reset-password",
    "priority": "critical",
    "acceptanceCriteria": [
      "Reset form accepts valid email",
      "Confirmation message displayed",
      "Invalid email shows error"
    ]
  }
]
```

```bash
npx ato run sprint-requirements.json --mock
```

## 2. Self-Healing in Nightly Runs

When selectors change after a deploy:

```
Requirements → Generate → Validate → Execute → FAIL (selector not found)
                                                  ↓
                                            Analyze: "selector" category
                                                  ↓
                                            Self-Heal: LLM generates fix
                                                  ↓
                                            Re-execute → PASS (healed!)
```

The orchestrator automatically fixes broken selectors and re-runs.

## 3. Integration with Claude API

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Orchestrator } from 'ai-test-orchestrator';

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

const orchestrator = new Orchestrator(llm, myRunner, myValidator, 3);
const report = await orchestrator.runPipeline(requirements);
```

## 4. CI Pipeline Integration

```yaml
- name: AI Test Generation
  run: npx ato run requirements.json --mock
  # Exits 1 if any test is unrecoverable after self-heal attempts
```
