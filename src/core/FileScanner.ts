import * as vscode from 'vscode';
import { ScannedFile } from '../types';

const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**', '**/.vscode/**'];

export class FileScanner {
    constructor(private readonly excludeGlobs: string[] = DEFAULT_EXCLUDE) {}

    async scanWorkspace(maxFiles = 500): Promise<ScannedFile[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const include = new vscode.RelativePattern(workspaceFolders[0], '**/*');
        const exclude = this.excludeGlobs.length > 0 ? `{${this.excludeGlobs.join(',')}}` : undefined;
        const uris = await vscode.workspace.findFiles(include, exclude, maxFiles);

        const files: ScannedFile[] = [];
        for (const uri of uris) {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type !== vscode.FileType.File) {
                continue;
            }

            files.push({
                path: vscode.workspace.asRelativePath(uri, false),
                language: this.detectLanguage(uri.fsPath),
                size: stat.size,
            });
        }

        return files;
    }

    private detectLanguage(filePath: string): string {
        const extension = filePath.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'ts':
            case 'tsx':
                return 'TypeScript';
            case 'js':
            case 'jsx':
                return 'JavaScript';
            case 'json':
                return 'JSON';
            case 'md':
                return 'Markdown';
            case 'py':
                return 'Python';
            case 'cs':
                return 'C#';
            case 'java':
                return 'Java';
            case 'go':
                return 'Go';
            case 'rs':
                return 'Rust';
            case 'cpp':
            case 'cc':
            case 'c':
                return 'C/C++';
            case 'yml':
            case 'yaml':
                return 'YAML';
            default:
                return 'unknown';
        }
    }
}
