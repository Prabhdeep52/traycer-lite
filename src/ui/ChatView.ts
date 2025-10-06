import * as vscode from 'vscode';
import { LLMService } from '../services/LLMService';

export class ChatView {
    public static currentPanel: ChatView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private readonly _llmService: LLMService;

    public static createOrShow(extensionUri: vscode.Uri, llmService: LLMService) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ChatView.currentPanel) {
            ChatView.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'chatView',
            'Traycer Lite Chat',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        ChatView.currentPanel = new ChatView(panel, extensionUri, llmService);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, llmService: LLMService) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._llmService = llmService;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview();

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'sendMessage':
                        this.addMessage(message.text, 'user');
                        const response = await this._llmService.sendMessage(message.text);
                        this.addMessage(response, 'ai');
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public addMessage(text: string, sender: 'user' | 'ai') {
        this._panel.webview.postMessage({ command: 'addMessage', text, sender });
    }

    public dispose() {
        ChatView.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview() {
        const scriptUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const stylesUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesUri}" rel="stylesheet">
                <title>Traycer Lite Chat</title>
            </head>
            <body>
                <div id="chat-container">
                    <div id="chat-history"></div>
                    <div id="chat-input">
                        <input type="text" id="prompt-input" placeholder="Ask a question or describe a task...">
                        <button id="send-button">Send</button>
                    </div>
                </div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}