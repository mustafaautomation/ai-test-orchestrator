import { OrchestratorReport } from '../pipeline/types';

const R = '\x1b[0m', B = '\x1b[1m', D = '\x1b[2m', RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', CYN = '\x1b[36m', MAG = '\x1b[35m';

const STATUS_ICONS: Record<string, string> = {
  passed: `${GRN}✓`, failed: `${RED}✗`, healed: `${MAG}⟳`, unrecoverable: `${RED}✗✗`,
};

export function printReport(report: OrchestratorReport): void {
  console.log();
  console.log(`${B}${CYN}AI Test Orchestrator Report${R}`);
  console.log(`${D}${report.timestamp}${R}`);
  console.log();
  console.log(`  ${B}Pipeline:${R} ${report.requirements} requirements → ${report.generated} generated → ${report.validated} valid → ${report.executed} executed`);
  console.log(`  ${B}Results:${R}  ${GRN}${report.passed} passed${R}  ${MAG}${report.healed} healed${R}  ${RED}${report.failed} failed${R}  ${D}${report.totalDuration}ms${R}`);
  console.log();

  for (const cycle of report.cycles) {
    const icon = STATUS_ICONS[cycle.finalStatus] || `${D}?`;
    console.log(`  ${icon}${R} ${B}${cycle.requirement.description}${R} ${D}[${cycle.requirement.priority}]${R}`);

    const stageStr = Object.entries(cycle.stages)
      .map(([name, status]) => {
        const c = status === 'passed' ? GRN : status === 'failed' ? RED : status === 'skipped' ? D : YEL;
        return `${c}${name}${R}`;
      })
      .join(' → ');
    console.log(`    ${stageStr}`);

    if (cycle.analysis) {
      console.log(`    ${D}Root cause: ${cycle.analysis.rootCause} (${cycle.analysis.category}, ${Math.round(cycle.analysis.confidence * 100)}% confidence)${R}`);
    }
    if (cycle.healing?.healed) {
      console.log(`    ${MAG}Self-healed: ${cycle.healing.fix}${R}`);
    }
  }
  console.log();
}
