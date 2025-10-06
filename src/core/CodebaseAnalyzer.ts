import * as vscode from 'vscode';
import { ProjectContext, ScannedFile } from '../types';
import { FileScanner } from './FileScanner';
import { Logger } from '../utils/logger';

export class CodebaseAnalyzer {
    constructor(private readonly scanner: FileScanner, private readonly logger: Logger) {}

    async analyzeWorkspace(): Promise<ProjectContext> {
        const root = this.getWorkspaceRoot();
        if (!root) {
            throw new Error('Workspace not found. Open a folder or workspace before generating a plan.');
        }

        this.logger.info('Scanning workspace for files and tech stack...');
        const files = await this.scanner.scanWorkspace();
        const techStack = this.detectTechStack(files);
        const summary = this.buildSummary(files, techStack);

        this.logger.info(`Scan complete: ${files.length} files discovered.`);

        return {
            rootPath: root.fsPath,
            files,
            techStack,
            summary,
        };
    }

    private getWorkspaceRoot(): vscode.Uri | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        return workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri : undefined;
    }

    private detectTechStack(files: ScannedFile[]): string[] {
        const languages = new Map<string, number>();
        for (const file of files) {
            if (file.language === 'unknown') {
                continue;
            }
            languages.set(file.language, (languages.get(file.language) ?? 0) + 1);
        }
        return Array.from(languages.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([language]) => language);
    }

    private buildSummary(files: ScannedFile[], techStack: string[]): string {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const averageFileSize = files.length > 0 ? Math.round(totalSize / files.length) : 0;
        const languages = techStack.length > 0 ? techStack.join(', ') : 'unknown';

        return `Located ${files.length} tracked files (avg ${averageFileSize} bytes) across ${languages}.`;
    }
}
