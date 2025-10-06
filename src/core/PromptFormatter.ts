import { PlanRequest, PlanResult, PlanPhase } from '../types';

export class PromptFormatter {
    buildPlanPrompt(request: PlanRequest, contextSummary: string, relevantFiles: string[]): string {
        const intro = `You are Traycer, an expert software planning agent. Prepare a ${request.mode === 'phase' ? 'multi-phase' : 'single-phase'} implementation plan.`;
        const task = `Task: ${request.task}`;
        const hints = request.hints && request.hints.length > 0 ? `Hints: ${request.hints.join('\n')}` : '';
        const files = relevantFiles.length > 0 ? `Relevant files (max 20):\n${relevantFiles.map(f => `- ${f}`).join('\n')}` : 'Relevant files: insufficient scan results.';

        return [intro, task, hints, 'Workspace summary:', contextSummary, files, 'Respond in JSON matching PlanResult interface.'].filter(Boolean).join('\n\n');
    }

    toMarkdown(plan: PlanResult): string {
        const header = `# Traycer Plan\n\n- **Task:** ${plan.task}\n- **Mode:** ${plan.mode}\n- **Generated:** ${plan.generatedAt}\n- **Summary:** ${plan.summary}\n`;
        const phases = plan.phases.map(phase => this.renderPhase(phase)).join('\n\n');
        return `${header}\n${phases}`;
    }

    private renderPhase(phase: PlanPhase): string {
        const steps = phase.steps
            .map(step => `1. **${step.title}**\n   - Description: ${step.description}\n   - References: ${step.references.join(', ') || 'N/A'}${step.reasoning ? `\n   - Reasoning: ${step.reasoning}` : ''}${step.estimatedEffort ? `\n   - Effort: ${step.estimatedEffort}` : ''}`)
            .join('\n\n');
        return `## Phase ${phase.id}: ${phase.title}\n${phase.summary ? `${phase.summary}\n\n` : ''}${steps}`;
    }
}
