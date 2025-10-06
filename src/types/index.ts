export type PlanMode = 'plan' | 'phase';

export interface PlanRequest {
    task: string;
    mode: PlanMode;
    hints?: string[];
}

export interface PlanStep {
    id: string;
    title: string;
    description: string;
    references: string[];
    reasoning?: string;
    estimatedEffort?: string;
}

export interface PlanPhase {
    id: string;
    title: string;
    summary: string;
    steps: PlanStep[];
}

export interface PlanResult {
    task: string;
    mode: PlanMode;
    summary: string;
    generatedAt: string;
    phases: PlanPhase[];
    rawPlan?: string;
}

export interface ScannedFile {
    path: string;
    language: string;
    size: number;
}

export interface ProjectContext {
    rootPath: string;
    files: ScannedFile[];
    techStack: string[];
    summary: string;
}

export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'mock';

export interface LLMConfig {
    provider: LLMProvider;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}
