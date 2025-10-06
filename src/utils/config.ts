import * as vscode from 'vscode';
import { LLMConfig } from '../types';

const SECTION = 'traycer-lite';

export const getExtensionConfiguration = () => vscode.workspace.getConfiguration(SECTION);

export function getLLMConfig(): LLMConfig {
    const config = getExtensionConfiguration();
    const provider = (config.get<string>('llm.provider') ?? 'mock') as LLMConfig['provider'];
    let defaultModel = 'gpt-4.1-mini';
    if (provider === 'anthropic') {
        defaultModel = 'claude-3-5-sonnet-20240620';
    } else if (provider === 'gemini') {
        defaultModel = 'gemini-2.5-flash';
    }
    const rawBaseUrl = (config.get<string>('llm.baseUrl') ?? '').trim();
    const model = config.get<string>('llm.model');
    return {
        provider,
        apiKey: config.get<string>('llm.apiKey') ?? process.env.TRAYCER_LITE_API_KEY,
        baseUrl: rawBaseUrl.length > 0 ? rawBaseUrl : undefined,
        model: model || defaultModel,
        temperature: config.get<number>('llm.temperature') ?? 0.2,
        maxTokens: config.get<number>('llm.maxTokens') ?? 8192,
    };
}

export function onConfigurationChange(listener: (e: vscode.ConfigurationChangeEvent) => unknown): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(SECTION)) {
            listener(event);
        }
    });
}
