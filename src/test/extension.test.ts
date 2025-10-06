import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Traycer Lite Extension', () => {
    test('registers generatePlan command', async () => {
        const extension = vscode.extensions.getExtension('traycer.traycer-lite');
        assert.ok(extension, 'Extension not found');
        await extension.activate();

        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('traycer-lite.generatePlan'));
    });
});
