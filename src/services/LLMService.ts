import { PlanRequest, PlanResult, ProjectContext, LLMConfig, PlanMode } from '../types';
import { Logger } from '../utils/logger';
import { GoogleGenerativeAI, GenerativeModel, ChatSession, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

/**
 * LLMService handles all communication with supported LLM providers.
 * Currently supports Gemini; OpenAI/Anthropic placeholders are included for future support.
 */
export class LLMService {
    private genAI?: GoogleGenerativeAI;
    private model?: GenerativeModel;
    private _chatSession?: ChatSession;

    constructor(private config: LLMConfig, private readonly logger: Logger) {
        if (config.provider === 'gemini') {
            this.initializeGemini();
        }
    }

    private initializeGemini() {
        if (!this.config.apiKey) {
            this.logger.warn('No API key provided for Gemini');
            return;
        }

        try {
            this.logger.info('Initializing Gemini client');
            this.genAI = new GoogleGenerativeAI(this.config.apiKey);

            let modelName = this.config.model ?? 'gemini-1.5-flash';
            modelName = modelName.replace(/^models\//, '');

            if (!modelName) {
                throw new Error('Model name cannot be empty');
            }

            this.logger.info(`Using Gemini model: ${modelName}`);
            this.model = this.genAI.getGenerativeModel({ model: modelName });

            this._chatSession = this.model.startChat({
                generationConfig: {
                    temperature: this.config.temperature ?? 0.2,
                    maxOutputTokens: this.config.maxTokens ?? 8192,
                    topK: 40,
                    topP: 0.8
                },
                history: []
            });

            this.logger.info('Gemini client initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Gemini client:', error);
            this.genAI = undefined;
            this.model = undefined;
            throw new Error('Failed to initialize Gemini client');
        }
    }

    updateConfig(config: LLMConfig): void {
        this.config = config;
        if (config.provider === 'gemini') {
            this.initializeGemini();
        } else {
            this.genAI = undefined;
            this.model = undefined;
            this._chatSession = undefined;
        }
    }

 public async sendMessage(prompt: string): Promise<string> {
    if (!this._chatSession || !this.model) {
        this.logger.error('Gemini chat session not initialized');
        throw new Error('Gemini chat session not initialized. Check API key and provider configuration.');
    }

    try {
        this.logger.info('Sending request to Gemini');

        const result = await this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: this.config.temperature ?? 0.2,
                maxOutputTokens: this.config.maxTokens ?? 8192,
                topK: 40,
                topP: 0.8,
            },
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ],
        });

        const response = await result.response;

        // Check if response was blocked by safety filters
        if (!response || !response.candidates || response.candidates.length === 0) {
            this.logger.error('Gemini returned no candidates. Possible safety filter block.');
            this.logger.error('Response details:', JSON.stringify(response, null, 2));
            throw new Error('Gemini response blocked or missing candidates');
        }

        // Check for block reasons
        const candidate = response.candidates[0];
        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
            this.logger.error(`Gemini candidate blocked. Finish reason: ${candidate.finishReason}`);
            if (candidate.safetyRatings) {
                this.logger.error('Safety ratings:', JSON.stringify(candidate.safetyRatings, null, 2));
            }
            throw new Error(`Gemini response blocked: ${candidate.finishReason}`);
        }

        let text = '';
        try {
            text = response.text().trim();
        } catch (textError) {
            this.logger.error('Failed to extract text from response:', textError);
            this.logger.error('Response structure:', JSON.stringify(response, null, 2));
            throw new Error('Failed to extract text from Gemini response');
        }

        if (!text) {
            this.logger.error('Gemini returned empty response text');
            this.logger.error('Response details:', JSON.stringify(response, null, 2));
            throw new Error('Gemini response missing content');
        }

        this.logger.info(`Gemini response text length: ${text.length} characters`);
        
        // Remove Markdown fences like ```json ... ```
        if (text.includes('```json')) {
            this.logger.info('Removing ```json markdown fences');
            text = text.split('```json')[1].split('```')[0].trim();
        } else if (text.includes('```')) {
            this.logger.info('Removing ``` markdown fences');
            text = text.split('```')[1].trim();
        }

        this.logger.info('Attempting JSON parse...');
        this.logger.info(`First 200 chars of response: ${text.substring(0, 200)}`);

        // Try direct parse
        try {
            JSON.parse(text);
            return text;
        } catch (firstError) {
            // Try extracting first {...} JSON block if model wrapped it with prose
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    JSON.parse(match[0]);
                    this.logger.info('Recovered valid JSON from Gemini response');
                    return match[0];
                } catch (innerErr) {
                    this.logger.error('Failed to parse recovered JSON', innerErr);
                    throw new Error('Gemini response contains malformed JSON');
                }
            }

            this.logger.error('Gemini response is not valid JSON', firstError);
            throw new Error('Gemini response is not valid JSON');
        }
    } catch (error) {
        this.logger.error('Error in Gemini request:', error);
        throw new Error('Failed to generate content with Gemini');
    }
}

    public async sendConversationalMessage(prompt: string): Promise<string> {
        if (!this._chatSession || !this.model) {
            this.logger.error('Gemini chat session not initialized');
            throw new Error('Gemini chat session not initialized. Check API key and provider configuration.');
        }

        try {
            this.logger.info('Sending conversational request to Gemini');

            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: this.config.temperature ?? 0.3,
                    maxOutputTokens: this.config.maxTokens ?? 2048,
                    topK: 40,
                    topP: 0.9,
                },
                safetySettings: [
                    {
                        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                        threshold: HarmBlockThreshold.BLOCK_NONE,
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                        threshold: HarmBlockThreshold.BLOCK_NONE,
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                        threshold: HarmBlockThreshold.BLOCK_NONE,
                    },
                    {
                        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                        threshold: HarmBlockThreshold.BLOCK_NONE,
                    },
                ],
            });

            const response = await result.response;

            // Check if response was blocked
            if (!response || !response.candidates || response.candidates.length === 0) {
                this.logger.error('Gemini returned no candidates for conversation');
                throw new Error('Gemini response blocked or missing candidates');
            }

            const candidate = response.candidates[0];
            if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                this.logger.error(`Gemini candidate blocked. Finish reason: ${candidate.finishReason}`);
                throw new Error(`Gemini response blocked: ${candidate.finishReason}`);
            }

            let text = '';
            try {
                text = response.text().trim();
            } catch (textError) {
                this.logger.error('Failed to extract text from conversational response:', textError);
                throw new Error('Failed to extract text from Gemini response');
            }

            if (!text) {
                this.logger.error('Gemini returned empty conversational response');
                throw new Error('Gemini response missing content');
            }

            this.logger.info(`Gemini conversational response: ${text.substring(0, 100)}...`);
            
            // Return plain text - no JSON parsing needed
            return text;

        } catch (error) {
            this.logger.error('Error in Gemini conversational request:', error);
            throw new Error('Failed to generate conversational response with Gemini');
        }
    }


    async generatePlan(request: PlanRequest, context: ProjectContext, prompt: string): Promise<PlanResult | string> {
        const { apiKey, provider } = this.config;

        if (!apiKey || provider === 'mock') {
            this.logger.warn('LLM provider not configured. Using heuristic planner.');
            return this.heuristicPlan(request, context);
        }

        try {
            switch (provider) {
                case 'openai':
                    return await this.invokeOpenAI(prompt);
                case 'anthropic':
                    return await this.invokeAnthropic(prompt);
                case 'gemini':
                    return await this.sendMessage(prompt);
                default:
                    this.logger.warn(`Unsupported provider ${provider}, using heuristic plan.`);
                    return this.heuristicPlan(request, context);
            }
        } catch (error) {
            this.logger.error('LLM request failed. Falling back to heuristic plan.', error);
            return this.heuristicPlan(request, context);
        }
    }

    private cleanJson(text: string): string {
        const trimmed = text.trim();
        if (trimmed.startsWith('```json')) {
            return trimmed.substring(7, trimmed.length - 3);
        }
        return trimmed;
    }

    private async invokeOpenAI(prompt: string): Promise<string> {
        this.logger.info('OpenAI invocation placeholder');
        return JSON.stringify({ message: "OpenAI not yet implemented" });
    }

    private async invokeAnthropic(prompt: string): Promise<string> {
        this.logger.info('Anthropic invocation placeholder');
        return JSON.stringify({ message: "Anthropic not yet implemented" });
    }

private heuristicPlan(request: PlanRequest, context: ProjectContext): PlanResult {
    this.logger.warn('Using fallback heuristic plan');

    const now = new Date().toISOString();

    return {
        task: request.task,
        mode: request.mode,
        summary: `Heuristic plan for "${request.task}" (provider not configured or LLM failed).`,
        generatedAt: now,
        phases: [
            {
                id: "fallback-phase",
                title: "Fallback Plan",
                summary: "This is a heuristic plan generated without LLM assistance.",
                steps: [
                    {
                        id: "step-1",
                        title: "Analyze project context",
                        description: `Review project files under ${context.rootPath}.`,
                        references: context.techStack,
                        reasoning: "This plan was generated heuristically to provide minimal guidance.",
                        estimatedEffort: "Low"
                    },
                    {
                        id: "step-2",
                        title: "Refine requirements",
                        description: "Manually define objectives and constraints for the next planning attempt.",
                        references: [],
                        estimatedEffort: "Medium"
                    }
                ]
            }
        ],
        rawPlan: JSON.stringify({
            note: "Fallback plan generated due to missing or failed LLM response",
            mode: request.mode,
            contextSummary: context.summary
        }, null, 2)
    };
}
}