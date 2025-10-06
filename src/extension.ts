import * as vscode from 'vscode';
import { InputHandler } from './ui/InputHandler';
import { Logger } from './utils/logger';
import { FileScanner } from './core/FileScanner';
import { CodebaseAnalyzer } from './core/CodebaseAnalyzer';
import { LLMService } from './services/LLMService';
import { PlanGenerator } from './core/PlanGenerator';
import { PlanView } from './ui/PlanView';
import { ChatView } from './ui/ChatView';
import { SidebarProvider } from './ui/SidebarProvider';
import { getLLMConfig, onConfigurationChange } from './utils/config';

export function activate(context: vscode.ExtensionContext) {
	const logger = new Logger();
	const inputHandler = new InputHandler();
	const fileScanner = new FileScanner();
	const analyzer = new CodebaseAnalyzer(fileScanner, logger);
	const llmService = new LLMService(getLLMConfig(), logger);
	const planGenerator = new PlanGenerator(llmService, logger);

	// Register sidebar view provider
	const sidebarProvider = new SidebarProvider(
		context.extensionUri,
		llmService,
		planGenerator,
		analyzer,
		logger
	);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			SidebarProvider.viewType,
			sidebarProvider
		)
	);

	const planCommand = vscode.commands.registerCommand('traycer-lite.generatePlan', async () => {
		try {
			const taskDescription = await inputHandler.getTaskDescription();
			if (!taskDescription) {
				logger.info('Task input cancelled by user.');
				return;
			}

			const mode = await inputHandler.getPlanMode();
			if (!mode) {
				logger.info('No planning mode selected.');
				return;
			}

			const progressOptions: vscode.ProgressOptions = {
				location: vscode.ProgressLocation.Notification,
				title: 'Traycer is generating a plan...',
				cancellable: false,
			};

			const plan = await vscode.window.withProgress(progressOptions, async () => {
				const contextData = await analyzer.analyzeWorkspace();
				return planGenerator.generatePlan({ task: taskDescription, mode }, contextData);
			});

			// Plan will always have rawPlan since we set it in PlanGenerator
			if (plan.rawPlan) {
				await vscode.env.clipboard.writeText(plan.rawPlan);

				const openView = await inputHandler.confirmPlanDisplay();
				if (openView) {
					const view = PlanView.createOrShow(context.extensionUri);
					view.setPlan(plan, plan.rawPlan);
				} else {
					vscode.window.showInformationMessage('Plan copied to clipboard.');
				}
			} else {
				vscode.window.showInformationMessage('Plan copied to clipboard.');
			}
		} catch (error) {
			logger.error('Failed to generate plan', error);
		}
	});

	const chatCommand = vscode.commands.registerCommand('traycer-lite.startChat', () => {
		ChatView.createOrShow(context.extensionUri, llmService);
	});

	const configListener = onConfigurationChange(() => {
		logger.info('Configuration updated. Refreshing LLM client.');
		llmService.updateConfig(getLLMConfig());
	});

	context.subscriptions.push(planCommand, chatCommand, configListener, logger);
}

export function deactivate() {}
