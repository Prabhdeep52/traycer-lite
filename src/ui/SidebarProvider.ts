import * as vscode from 'vscode';
import { LLMService } from '../services/LLMService';
import { PlanGenerator } from '../core/PlanGenerator';
import { CodebaseAnalyzer } from '../core/CodebaseAnalyzer';
import { Logger } from '../utils/logger';
import { PlanResult, ProjectContext } from '../types';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    plan?: PlanResult;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'traycer-lite.sidebarView';
    private _view?: vscode.WebviewView;
    private _conversationHistory: ChatMessage[] = [];
    private _currentPlan?: PlanResult;
    private _projectContext?: ProjectContext;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _llmService: LLMService,
        private readonly _planGenerator: PlanGenerator,
        private readonly _analyzer: CodebaseAnalyzer,
        private readonly _logger: Logger
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'sendMessage': {
                    await this.handleChatMessage(data.message, data.mode);
                    break;
                }
                case 'copyPlan': {
                    if (data.content) {
                        await vscode.env.clipboard.writeText(data.content);
                        vscode.window.showInformationMessage('Plan copied to clipboard!');
                    }
                    break;
                }
                case 'clearChat': {
                    this._conversationHistory = [];
                    this._currentPlan = undefined;
                    this._projectContext = undefined;
                    this._view?.webview.postMessage({ type: 'chatCleared' });
                    break;
                }
                case 'openFile': {
                    if (data.filePath) {
                        await this.openFile(data.filePath);
                    }
                    break;
                }
            }
        });
    }

    private async openFile(relativePath: string) {
        try {
            // Get workspace folders
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showWarningMessage('No workspace folder open');
                return;
            }

            // Try to resolve the file in the workspace
            const workspaceRoot = workspaceFolders[0].uri;
            const fileUri = vscode.Uri.joinPath(workspaceRoot, relativePath);

            // Open the file
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            this._logger.error(`Failed to open file: ${relativePath}`, error);
            vscode.window.showErrorMessage(`Could not open file: ${relativePath}`);
        }
    }

    private async handleChatMessage(userMessage: string, mode?: 'plan' | 'phase') {
        if (!userMessage || userMessage.trim().length === 0) {
            return;
        }

        // Store mode preference if provided
        const planMode = mode || 'phase';

        // Add user message to conversation
        const userChatMessage: ChatMessage = {
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        };
        this._conversationHistory.push(userChatMessage);

        // Echo user message to UI
        this._view?.webview.postMessage({
            type: 'addMessage',
            message: userChatMessage
        });

        // Show typing indicator
        this._view?.webview.postMessage({
            type: 'typing',
            isTyping: true
        });

        try {
            this._logger.info(`Processing chat message: ${userMessage}`);

            // Analyze workspace context if not already done
            if (!this._projectContext) {
                this._projectContext = await this._analyzer.analyzeWorkspace();
            }

            // Determine intent and generate response
            const response = await this.generateResponse(userMessage, planMode);

            // Add assistant message to conversation
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response.text,
                timestamp: new Date().toISOString(),
                plan: response.plan
            };
            this._conversationHistory.push(assistantMessage);

            // Send response to UI
            this._view?.webview.postMessage({
                type: 'addMessage',
                message: assistantMessage
            });

        } catch (error) {
            this._logger.error('Failed to process chat message', error);
            
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to process your request'}`,
                timestamp: new Date().toISOString()
            };
            this._conversationHistory.push(errorMessage);

            this._view?.webview.postMessage({
                type: 'addMessage',
                message: errorMessage
            });
        } finally {
            this._view?.webview.postMessage({
                type: 'typing',
                isTyping: false
            });
        }
    }

    private async generateResponse(userMessage: string, preferredMode: 'plan' | 'phase'): Promise<{ text: string, plan?: PlanResult }> {
        const lowerMessage = userMessage.toLowerCase();

        // Check if it's a modification request
        const isModification = /\b(modify|change|update|edit|revise|refine|adjust|improve|add|remove|reduce|increase|expand|simplify)\b/i.test(lowerMessage) && 
                              /\b(plan|phase|step|detail)\b/i.test(lowerMessage);
        
        const isNewPlan = /\b(create|generate|make|new|build|implement|develop)\b/i.test(lowerMessage) || !this._currentPlan;

        if (isModification && this._currentPlan) {
            // Modify existing plan
            return await this.modifyPlan(userMessage);
        } else if (isNewPlan) {
            // Generate new plan
            return await this.generateNewPlan(userMessage, preferredMode);
        } else {
            // General conversation with context
            return await this.handleGeneralQuery(userMessage);
        }
    }

    private async generateNewPlan(userMessage: string, preferredMode: 'plan' | 'phase'): Promise<{ text: string, plan: PlanResult }> {
        this._logger.info('Generating new plan');

        // Use message keywords to override, otherwise use preferred mode
        const mode: 'plan' | 'phase' = /\b(detailed|multi[-\s]?phase|phases)\b/i.test(userMessage) ? 'phase' : 
                                       /\b(quick|simple|fast)\b/i.test(userMessage) ? 'plan' : 
                                       preferredMode;

        // Generate plan
        const plan = await this._planGenerator.generatePlan(
            { task: userMessage, mode },
            this._projectContext!
        );

        this._currentPlan = plan;

        const responseText = `I've created ${mode === 'phase' ? 'a detailed multi-phase' : 'a'} implementation plan for your request. The plan includes:\n\n` +
            `📋 **${plan.phases.length} Phase${plan.phases.length > 1 ? 's' : ''}**: ${plan.phases.map(p => p.title).join(', ')}\n` +
            `📝 **${plan.phases.reduce((acc, p) => acc + p.steps.length, 0)} Steps** across all phases\n\n` +
            `${plan.summary}\n\n` +
            `You can ask me to modify specific parts, add more details, or regenerate the plan with different requirements.`;

        return { text: responseText, plan };
    }

    private async modifyPlan(userMessage: string): Promise<{ text: string, plan: PlanResult }> {
        this._logger.info('Modifying existing plan');

        // Build context about the current plan
        const conversationContext = this._conversationHistory
            .slice(-6) // Last 3 exchanges
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n\n');

        const modificationPrompt = `You are modifying an existing implementation plan based on user feedback.

Current Plan Summary:
${this._currentPlan!.summary}

Current Phases:
${this._currentPlan!.phases.map((p, i) => `${i + 1}. ${p.title}: ${p.summary}`).join('\n')}

Conversation History:
${conversationContext}

User's Modification Request:
${userMessage}

Generate an UPDATED plan in JSON format that incorporates the user's requested changes while maintaining the structure of the previous plan. Make sure to address their specific modification request.

Return ONLY valid JSON matching the PlanResult structure.`;

        const llmResponse = await this._llmService.sendMessage(modificationPrompt);
        const updatedPlan = JSON.parse(llmResponse) as PlanResult;

        this._currentPlan = updatedPlan;

        const responseText = `I've updated the plan based on your feedback. Here's what changed:\n\n` +
            `📋 **${updatedPlan.phases.length} Phase${updatedPlan.phases.length > 1 ? 's' : ''}**: ${updatedPlan.phases.map(p => p.title).join(', ')}\n` +
            `📝 **${updatedPlan.phases.reduce((acc, p) => acc + p.steps.length, 0)} Steps** total\n\n` +
            `${updatedPlan.summary}\n\n` +
            `Let me know if you need any other adjustments!`;

        return { text: responseText, plan: updatedPlan };
    }

    private async handleGeneralQuery(userMessage: string): Promise<{ text: string }> {
        this._logger.info('Handling general query');

        const conversationContext = this._conversationHistory
            .slice(-6)
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n\n');

        const prompt = `You are Traycer, an AI planning assistant for software development. Help the user with their question about implementation planning.

${this._currentPlan ? `Current Plan Context:\nTask: ${this._currentPlan.task}\nSummary: ${this._currentPlan.summary}\n\n` : ''}

Conversation History:
${conversationContext}

User Question:
${userMessage}

Provide a helpful, concise response (plain text, not JSON). If they're asking about creating a plan, encourage them to describe their task. If they're asking about the current plan, reference specific phases or steps. Keep your response conversational and under 300 words.`;

        const responseText = await this._llmService.sendConversationalMessage(prompt);

        return { text: responseText };
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.js')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Traycer Lite</title>
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-header">
                    <div class="header-content">
                        <h2>🎯 Traycer Lite</h2>
                        <p class="subtitle">AI Planning Assistant</p>
                    </div>
                    <button id="clear-btn" class="icon-button" title="Clear conversation">
                        🗑️
                    </button>
                </div>

                <div id="chat-messages" class="chat-messages">
                    <div class="welcome-message">
                        <p>👋 Hi! I'm your AI planning assistant.</p>
                        <p>Tell me what you'd like to implement, and I'll create a detailed plan for you.</p>
                        <p class="hint">Try: "Create a REST API for user authentication"</p>
                    </div>
                </div>

                <div id="typing-indicator" class="typing-indicator hidden">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </div>

                <div class="chat-input-container">
                    <textarea 
                        id="message-input" 
                        class="chat-input"
                        placeholder="Describe your task or ask a question..."
                        rows="2"
                    ></textarea>
                    <button id="send-btn" class="send-button" title="Send message">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M2 10L18 2L10 18L8 11L2 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>

            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
