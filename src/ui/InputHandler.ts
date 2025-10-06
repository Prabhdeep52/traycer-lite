import * as vscode from 'vscode';
import { PlanMode } from '../types';

export class InputHandler {
    async getTaskDescription(): Promise<string | undefined> {
        return vscode.window.showInputBox({
            title: 'What would you like Traycer to plan?',
            placeHolder: 'Describe the task or feature you need a plan for',
            validateInput: value => (value.trim().length === 0 ? 'Task description is required.' : undefined),
        });
    }

    async getPlanMode(): Promise<PlanMode | undefined> {
        const pick = await vscode.window.showQuickPick([
            {
                label: 'Plan Mode',
                description: 'Generate a detailed plan of steps within a single phase.',
                detail: 'Best for focused tasks or single tickets.',
                value: 'plan' as PlanMode,
            },
            {
                label: 'Phase Mode',
                description: 'Break the work into phases with detailed steps per phase.',
                detail: 'Best for complex or multi-stage efforts.',
                value: 'phase' as PlanMode,
            },
        ], {
            title: 'Select planning mode',
            canPickMany: false,
        });

        return pick?.value;
    }

    async confirmPlanDisplay(): Promise<boolean> {
        const selection = await vscode.window.showInformationMessage('Plan generated. Would you like to preview it in the Plan View?', 'Open Plan View', 'Copy to clipboard only');
        return selection === 'Open Plan View';
    }
}
