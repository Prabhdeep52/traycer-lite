import { randomUUID } from 'crypto';
import { PlanRequest, PlanResult, ProjectContext, PlanPhase, PlanMode, ScannedFile } from '../types';
import { LLMService } from '../services/LLMService';
import { Logger } from '../utils/logger';

export class PlanGenerator {
    constructor(
        private readonly llmService: LLMService,
        private readonly logger: Logger,
    ) {}

    async generatePlan(request: PlanRequest, context: ProjectContext): Promise<PlanResult> {
        const relevantFiles = context.files.slice(0, 10);
        const prompt = this.buildPlanPrompt(request, context, relevantFiles);

        this.logger.info('Requesting plan generation from LLM service...');
        const llmResponse = await this.llmService.generatePlan(request, context, prompt);
        const plan = this.normalisePlan(llmResponse, request, context);
        plan.rawPlan = plan.rawPlan ?? this.toMarkdown(plan);
        return plan;
    }

    private buildPlanPrompt(request: PlanRequest, context: ProjectContext, files: ScannedFile[]): string {
        // Escape double quotes in the task string for JSON
        const escapedTask = request.task.replace(/"/g, '\\"');
        
        return `You are Traycer, an expert software planning assistant. Generate a detailed implementation plan for the following task.

Task: ${request.task}

Project Context:
${context.summary}

Technology Stack:
${context.techStack.join(', ')}

Relevant Files:
${files.map(f => `- ${f.path} (${f.language})`).join('\n')}

CRITICAL: You must respond with ONLY valid JSON. No explanations, no markdown, no code blocks.

Generate a plan using this exact JSON structure:
{
    "task": "${escapedTask}",
    "mode": "${request.mode}",
    "summary": "Brief overview of the approach (2-3 sentences)",
    "generatedAt": "${new Date().toISOString()}",
    "phases": [
        {
            "id": "phase-analysis",
            "title": "Analysis Phase",
            "summary": "What will be analyzed and why",
            "steps": [
                {
                    "id": "step-1",
                    "title": "Step Title",
                    "description": "Detailed step description",
                    "references": ["file/paths/involved"],
                    "reasoning": "Why this step is necessary",
                    "estimatedEffort": "Low"
                }
            ]
        }
    ]
}

Requirements:
1. Include at least 3 phases: Analysis, Implementation, and Validation
2. Each phase should have 2-4 steps
3. Reference actual files from the workspace in the "references" array
4. Provide clear reasoning for each step
5. Use proper JSON string escaping (escape quotes and newlines)
6. estimatedEffort must be one of: "Low", "Medium", "High"
7. keep each point small. Do not write large paragraphs.

IMPORTANT: Return ONLY the JSON object. Do not wrap it in markdown code blocks or include any other text.`;
    }

    private toMarkdown(plan: PlanResult): string {
        let md = `# Implementation Plan: ${plan.task}\n\n`;
        
        if (plan.summary) {
            md += `## Overview\n${plan.summary}\n\n`;
        }

        for (const phase of plan.phases) {
            md += `## ${phase.title}\n${phase.summary}\n\n`;
            
            if (phase.steps.length > 0) {
                for (const step of phase.steps) {
                    md += `### ${step.title}\n`;
                    md += `${step.description}\n\n`;
                    
                    if (step.references.length > 0) {
                        md += `References:\n${step.references.map(ref => `- ${ref}`).join('\n')}\n\n`;
                    }
                    
                    if (step.reasoning) {
                        md += `Reasoning: ${step.reasoning}\n\n`;
                    }
                }
            }
        }

        return md;
    }

    private normalisePlan(response: PlanResult | string, request: PlanRequest, context: ProjectContext): PlanResult {
        let plan: PlanResult | undefined;
        if (typeof response === 'string') {
            plan = this.tryParsePlan(response);
        } else {
            plan = response;
        }

        if (!plan) {
            this.logger.warn('LLM response could not be parsed. Falling back to heuristic plan.');
            return this.createFallbackPlan(request, context);
        }

        if (!plan.phases || plan.phases.length === 0) {
            this.logger.warn('LLM response missing phases. Augmenting with fallback structure.');
            plan.phases = this.createFallbackPlan(request, context).phases;
        }

        return {
            task: plan.task || request.task,
            mode: (plan.mode as PlanMode) || request.mode,
            summary: plan.summary || context.summary,
            generatedAt: plan.generatedAt || new Date().toISOString(),
            phases: plan.phases.map(this.ensurePhaseStructure),
            rawPlan: plan.rawPlan,
        };
    }

    private tryParsePlan(raw: string): PlanResult | undefined {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.phases)) {
                return parsed as PlanResult;
            }
        } catch (error) {
            this.logger.warn(`Failed to parse plan JSON: ${(error as Error).message}`);
        }
        return undefined;
    }

    private ensurePhaseStructure(phase: PlanPhase): PlanPhase {
        return {
            id: phase.id ?? randomUUID(),
            title: phase.title ?? 'Untitled Phase',
            summary: phase.summary ?? '',
            steps: (phase.steps ?? []).map(step => ({
                id: step.id ?? randomUUID(),
                title: step.title ?? 'Untitled Step',
                description: step.description ?? '',
                references: step.references ?? [],
                reasoning: step.reasoning,
                estimatedEffort: step.estimatedEffort,
            })),
        };
    }

    private createFallbackPlan(request: PlanRequest, context: ProjectContext): PlanResult {
        const files = context.files.slice(0, 10);
        const phases = request.mode === 'phase' ? this.createPhasedPlan(files) : [this.createSinglePhase(files)];
        return {
            task: request.task,
            mode: request.mode,
            summary: context.summary,
            generatedAt: new Date().toISOString(),
            phases,
        };
    }

    private createSinglePhase(files: ProjectContext['files']): PlanPhase {
        return {
            id: 'phase-1',
            title: 'Implementation',
            summary: 'Execute the task with focused steps covering analysis, implementation, and validation.',
            steps: files.map((file, index) => ({
                id: `step-${index + 1}`,
                title: `Review ${file.path}`,
                description: `Inspect ${file.path} (${file.language}) for necessary updates related to the task.`,
                references: [file.path],
                reasoning: 'Prioritise high-signal files derived from workspace scan.',
            })).concat({
                id: 'step-testing',
                title: 'Validate changes',
                description: 'Run existing tests and linting to ensure the implementation is stable.',
                references: ['package.json'],
                reasoning: 'Guarantees the task outcome meets project quality standards.',
            }),
        };
    }

    private createPhasedPlan(files: ProjectContext['files']): PlanPhase[] {
        const analysisFiles = files.slice(0, Math.max(2, Math.ceil(files.length / 3)));
        const implementationFiles = files.slice(analysisFiles.length, analysisFiles.length * 2);
        const verificationFiles = files.slice(analysisFiles.length * 2);

        return [
            {
                id: 'phase-analysis',
                title: 'Analysis & Discovery',
                summary: 'Understand current implementation details and dependencies.',
                steps: analysisFiles.map((file, index) => ({
                    id: `analysis-${index + 1}`,
                    title: `Investigate ${file.path}`,
                    description: `Document the responsibilities of ${file.path} and capture edge-cases relevant to the task.`,
                    references: [file.path],
                    reasoning: 'Identify scope before editing to avoid regression.',
                })),
            },
            {
                id: 'phase-implementation',
                title: 'Implementation',
                summary: 'Apply code changes guided by findings from the analysis phase.',
                steps: implementationFiles.map((file, index) => ({
                    id: `implementation-${index + 1}`,
                    title: `Update ${file.path}`,
                    description: `Perform necessary modifications in ${file.path} to address the task requirements.`,
                    references: [file.path],
                    reasoning: 'Implement solution incrementally across impacted files.',
                })).concat({
                    id: 'implementation-cross-cutting',
                    title: 'Share learnings across modules',
                    description: 'Propagate shared updates (types, utilities) discovered during implementation.',
                    references: [],
                    reasoning: 'Capture shared follow-up tasks uncovered during implementation.',
                }),
            },
            {
                id: 'phase-validation',
                title: 'Validation & Verification',
                summary: 'Ensure the solution meets requirements and quality gates.',
                steps: [
                    ...verificationFiles.map((file, index) => ({
                        id: `validation-${index + 1}`,
                        title: `Review ${file.path}`,
                        description: `Cross-check ${file.path} for alignment with the new implementation plan.`,
                        references: [file.path],
                        reasoning: 'Ensure downstream consumers align with the updated behaviour.',
                    })),
                    {
                        id: 'validation-testing',
                        title: 'Execute test & lint suite',
                        description: 'Run automated tests, linting, and manual smoke tests as applicable.',
                        references: ['package.json'],
                        reasoning: 'Maintain quality gates to catch regressions early.',
                    },
                ],
            },
        ];
    }
}
