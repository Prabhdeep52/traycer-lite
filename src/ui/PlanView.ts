import * as vscode from 'vscode';
import { PlanResult } from '../types';

export class PlanView {
    private static instance: PlanView | undefined;
    private currentMarkdown = '';

    static createOrShow(extensionUri: vscode.Uri): PlanView {
        if (PlanView.instance) {
            PlanView.instance.panel.reveal();
            return PlanView.instance;
        }

        const panel = vscode.window.createWebviewPanel(
            'traycerPlanView',
            'Traycer Plan',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            },
        );

        PlanView.instance = new PlanView(panel, extensionUri);
        return PlanView.instance;
    }

    private constructor(private readonly panel: vscode.WebviewPanel, private readonly extensionUri: vscode.Uri) {
        this.panel.onDidDispose(() => {
            if (PlanView.instance === this) {
                PlanView.instance = undefined;
            }
        });

        this.panel.webview.onDidReceiveMessage(async message => {
            if (message?.type === 'copy') {
                await vscode.env.clipboard.writeText(this.currentMarkdown);
                vscode.window.showInformationMessage('Plan copied to clipboard.');
            }
        });
    }

    setPlan(plan: PlanResult, markdown: string): void {
        this.panel.title = `Traycer Plan – ${plan.task}`;
        this.currentMarkdown = markdown;
        this.panel.webview.html = this.render(plan, markdown);
    }

    private render(plan: PlanResult, markdown: string): string {
        const webview = this.panel.webview;
        const nonce = this.getNonce();
        const phases = plan.phases
            .map(phase => `
                <section class="phase">
                    <h2>${phase.title}</h2>
                    <p class="summary">${phase.summary || 'No summary provided.'}</p>
                    <ol>
                        ${phase.steps
                            .map(
                                step => `
                                    <li>
                                        <h3>${step.title}</h3>
                                        <p>${step.description}</p>
                                        ${step.reasoning ? `<p class="reasoning"><strong>Reasoning:</strong> ${step.reasoning}</p>` : ''}
                                        ${step.references.length > 0 ? `<p class="references"><strong>References:</strong> ${step.references.join(', ')}</p>` : ''}
                                    </li>
                                `,
                            )
                            .join('')}
                    </ol>
                </section>
            `)
            .join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root { color-scheme: var(--vscode-color-scheme, dark); }
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background: var(--vscode-editor-background);
            margin: 0;
            padding: 1.5rem;
        }
        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
        }
        h1 {
            font-size: 1.4rem;
            margin: 0;
        }
        button {
            padding: 0.4rem 0.8rem;
            border-radius: 4px;
            border: 1px solid var(--vscode-button-border, transparent);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .meta {
            margin-bottom: 1rem;
            font-size: 0.9rem;
        }
        .phase {
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 1rem;
            margin-bottom: 1rem;
            background: rgba(99, 99, 99, 0.05);
        }
        .phase h2 {
            margin-top: 0;
        }
        .phase ol {
            padding-left: 1.2rem;
        }
        .phase li {
            margin-bottom: 0.8rem;
        }
        .reasoning, .references {
            font-size: 0.85rem;
            color: var(--vscode-descriptionForeground);
        }
        pre {
            background: rgba(0, 0, 0, 0.3);
            padding: 1rem;
            border-radius: 4px;
            white-space: pre-wrap;
            word-break: break-word;
        }
        details {
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <header>
        <div>
            <h1>Traycer Plan</h1>
            <p class="meta">
                <span><strong>Task:</strong> ${plan.task}</span><br>
                <span><strong>Mode:</strong> ${plan.mode}</span><br>
                <span><strong>Generated:</strong> ${plan.generatedAt}</span>
            </p>
        </div>
        <button id="copy">Copy Markdown</button>
    </header>
    <section>
        <p>${plan.summary}</p>
    </section>
    ${phases}
    <details>
        <summary>View raw markdown</summary>
        <pre>${this.escapeHtml(markdown)}</pre>
    </details>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.getElementById('copy')?.addEventListener('click', () => {
            vscode.postMessage({ type: 'copy' });
        });
    </script>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text.replace(/[&<>"']/g, char => {
            switch (char) {
                case '&':
                    return '&amp;';
                case '<':
                    return '&lt;';
                case '>':
                    return '&gt;';
                case '"':
                    return '&quot;';
                case '\'':
                    return '&#39;';
                default:
                    return char;
            }
        });
    }

    private getNonce(): string {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length: 16 }, () => possible.charAt(Math.floor(Math.random() * possible.length))).join('');
    }
}
