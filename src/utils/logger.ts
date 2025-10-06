import * as vscode from 'vscode';

export class Logger {
    private readonly channel: vscode.OutputChannel;

    constructor(private readonly name = 'Traycer Lite') {
        this.channel = vscode.window.createOutputChannel(this.name);
    }

    info(message: string): void {
        this.write('INFO', message);
    }

    warn(message: string): void {
        this.write('WARN', message);
        vscode.window.setStatusBarMessage(`$(alert) ${message}`, 5000);
    }

    error(message: string, error?: unknown): void {
        const details = error instanceof Error ? `\n${error.stack ?? error.message}` : '';
        this.write('ERROR', `${message}${details}`);
        vscode.window.showErrorMessage(message);
    }

    dispose(): void {
        this.channel.dispose();
    }

    private write(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
        const timestamp = new Date().toISOString();
        this.channel.appendLine(`[${timestamp}] [${level}] ${message}`);
    }
}



