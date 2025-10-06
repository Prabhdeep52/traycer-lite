export interface FileInfo {
    relativePath: string;
    content?: string;
}

export interface TechStack {
    framework?: string;
    language: string;
}

export interface CodebaseAnalysis {
    projectName: string;
    techStack: TechStack;
    allFiles: FileInfo[];
    relevantFiles: FileInfo[];
    fileTree: FileTreeNode;
}

export interface FileTreeNode {
    name: string;
    type: 'directory' | 'file';
    children?: FileTreeNode[];
}

export interface LLMRequest {
    task: string;
    context: {
        projectName: string;
        techStack: TechStack;
        fileTree: string;
        relevantFiles: Array<{ path: string; content: string }>;
    };
}

export interface Plan {
    id: string;
    task: string;
    timestamp: Date;
    analysis: CodebaseAnalysis;
    sections: PlanSection[];
    rawContent: string;
}

export interface PlanSection {
    title: string;
    content: string;
    items: string[];
}