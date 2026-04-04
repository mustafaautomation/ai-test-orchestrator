# AI Test Orchestrator

[![CI](https://github.com/mustafaautomation/ai-test-orchestrator/actions/workflows/ci.yml/badge.svg)](https://github.com/mustafaautomation/ai-test-orchestrator/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

End-to-end AI QA orchestration pipeline. Takes requirements in natural language, generates Playwright tests via LLM, validates syntax, executes tests, analyzes failures, and self-heals broken tests automatically.

---

## Pipeline

```
Requirements → Generate → Validate → Execute → Analyze → Self-Heal
   (JSON)       (LLM)    (syntax)  (Playwright) (classify)  (LLM fix)
                                        │
                                   ┌────┴────┐
                                 PASS      FAIL
                                   │         │
                                 Done    Analyze → Heal → Re-execute
                                                     │
                                               ┌─────┴─────┐
                                             HEALED    UNRECOVERABLE
```

### 5 Pipeline Stages

| Stage | What Happens | Output |
|-------|-------------|--------|
| **Generate** | LLM converts requirement + acceptance criteria to Playwright code | TypeScript test file |
| **Validate** | Syntax check for imports, structure, anti-patterns | pass/fail + warnings |
| **Execute** | Run test with Playwright | pass/fail + duration |
| **Analyze** | Classify failure root cause (selector/timing/assertion/env) | category + confidence |
| **Self-Heal** | LLM generates fix, re-validate, re-execute (up to N attempts) | healed or unrecoverable |

---

## Quick Start

```bash
git clone https://github.com/mustafaautomation/ai-test-orchestrator.git
cd ai-test-orchestrator
npm install

# Run with mock LLM (demo mode)
npx ato run examples/saucedemo-requirements.json --mock
```

---

## Requirement Format

```json
{
  "id": "REQ-001",
  "description": "User can log in with valid credentials",
  "url": "https://www.saucedemo.com",
  "priority": "critical",
  "acceptanceCriteria": [
    "Login form is visible",
    "standard_user can log in",
    "Redirected to inventory page"
  ]
}
```

---

## Failure Analysis

The analyzer classifies failures into 5 categories:

| Category | Pattern | Self-Healable? |
|----------|---------|----------------|
| `selector` | Element not found | Yes — use resilient selectors |
| `timing` | Timeout / waiting | Yes — add explicit waits |
| `assertion` | Expected vs actual mismatch | Yes — update assertion |
| `environment` | Network / connection refused | No — infra issue |
| `unknown` | Unrecognized error | Attempt heal, low confidence |

---

## Library API

```typescript
import { Orchestrator, LLMProvider, TestRunner, TestValidator } from 'ai-test-orchestrator';

const orchestrator = new Orchestrator(myLLM, myRunner, myValidator, 2);
const report = await orchestrator.runPipeline(requirements);
// report.passed, report.healed, report.failed
```

Pluggable interfaces:
- `LLMProvider` — `{ generate(prompt): Promise<string> }`
- `TestRunner` — `{ execute(filePath): Promise<ExecutionResult> }`
- `TestValidator` — `{ validate(code): ValidationResult }`

---

## Project Structure

```
ai-test-orchestrator/
├── src/
│   ├── pipeline/
│   │   ├── types.ts            # Full pipeline type system
│   │   └── orchestrator.ts     # 5-stage pipeline engine
│   ├── reporters/
│   │   └── console.ts          # Colored pipeline report
│   ├── cli.ts                  # ato CLI
│   └── index.ts
├── tests/unit/
│   └── orchestrator.test.ts    # 9 tests — pipeline + failure analysis
├── examples/
│   └── saucedemo-requirements.json
└── .github/workflows/ci.yml
```

---

## License

MIT

---

Built by [Quvantic](https://quvantic.com)
