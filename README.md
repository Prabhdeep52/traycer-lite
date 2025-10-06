# Traycer Lite

Traycer Lite is an AI-powered VS Code extension that transforms natural language descriptions into structured implementation plans. By analyzing your workspace and understanding your technology stack, it generates actionable, phase-based development roadmaps that you can execute directly or hand off to AI coding assistants.

## Overview

Traycer Lite acts as your personal planning assistant, bridging the gap between high-level requirements and implementation details. Instead of manually breaking down complex features into steps, you describe what you want to build in plain English, and Traycer generates a comprehensive plan complete with file references, reasoning, and effort estimates.

## Core Features

### Conversational Chat Interface

Interact with Traycer through a natural chat interface embedded in VS Code's Activity Bar. The conversation maintains full context throughout your session, allowing for iterative refinement and follow-up questions without losing track of previous discussions.

The chat interface provides:

- Real-time message exchange with the AI assistant
- User messages appear on the right (chat bubble style)
- AI responses appear on the left with detailed plan visualizations
- Typing indicators during plan generation
- Persistent conversation history within each session
- Clear chat option to start fresh

### Intelligent Intent Recognition

Traycer automatically detects whether you want to create a new plan, modify an existing one, or ask general questions about your implementation strategy. It distinguishes between:

**Plan Generation Requests**: "Create a REST API for user management" or "Build a login page with React"

- Triggers full workspace analysis
- Generates new implementation plan
- Provides structured phases and steps

**Modification Requests**: "Add more detail to the validation phase" or "Reduce the number of steps"

- Uses existing plan as context
- Regenerates with requested changes
- Maintains conversation continuity

**Informational Queries**: "Which files should I start with?" or "Explain the authentication flow"

- Provides conversational responses
- References current plan if available
- Offers guidance and clarifications

### Workspace-Aware Planning

Before generating plans, Traycer scans your current workspace to understand:

**Project Structure**: Discovers files, folders, and organization patterns in your codebase

**Technology Stack**: Identifies frameworks, libraries, and tools based on configuration files (package.json, requirements.txt, etc.)

**Programming Languages**: Detects languages used and adjusts recommendations accordingly

**Existing Dependencies**: Reviews installed packages to suggest compatible solutions

This contextual awareness ensures that generated plans align with your actual codebase and reference real files from your project.

### Dual Planning Modes

Choose between two planning approaches using the dropdown selector in the input area:

**Detailed Mode (Multi-Phase)**:

- Generates separate phases for Analysis, Implementation, and Validation
- Provides comprehensive step-by-step guidance
- Includes reasoning and context for each step
- Best for complex features spanning multiple files
- Typical structure: 3-5 phases with 8-15 total steps

**Quick Mode (Single Phase)**:

- Produces streamlined, consolidated plans
- Focuses on immediate implementation tasks
- Faster generation time
- Ideal for bug fixes, small features, or straightforward changes
- Typical structure: 1-2 phases with 4-8 steps

The mode selector is accessible directly in the chat input area, allowing you to switch strategies for each request.

### Interactive Plan Visualization

Generated plans are rendered with rich formatting within the chat messages:

**Phase Organization**: Plans are divided into logical phases (Analysis, Implementation, Validation) with clear headers and summaries

**Step Details**: Each step includes:

- Numbered title describing the action
- Detailed description of what to do
- File references showing which files to modify
- Reasoning explaining why this step is necessary
- Effort estimates (Low/Medium/High) for time planning

**Clickable File Links**: File paths are rendered as clickable elements that open files directly in your editor when clicked

**Copy Functionality**: Each plan includes a copy button to export the full plan as formatted markdown text for sharing or archiving

### Iterative Refinement

Unlike traditional planning tools that require complete regeneration, Traycer supports incremental modifications:

**Add Details**: "Add security considerations to each phase" or "Include error handling steps"

**Simplify**: "Reduce this to 2 phases instead of 3" or "Combine the validation steps"

**Adjust Scope**: "Remove the testing phase" or "Add deployment and monitoring steps"

**Clarify**: "Explain the database migration process" or "What libraries should I use?"

Each modification builds on the existing plan while preserving the conversation history, creating a natural planning workflow similar to discussing with a colleague.

### File Navigation Integration

When plans reference specific files in your codebase, those references become interactive:

- File paths are displayed as styled, clickable links
- Hover effects indicate they are interactive
- Clicking opens the file immediately in VS Code
- Works with both existing files and new files to create
- Supports relative paths from workspace root

This tight integration eliminates context switching between reading the plan and starting implementation.

## How It Works

### Application Flow

**Step 1: User Opens Chat**

- Click Traycer icon in Activity Bar
- Sidebar panel opens with welcome message
- Chat interface ready for input

**Step 2: User Describes Task**

- Type task description in natural language
- Select planning mode (Detailed or Quick)
- Press Enter or click send button

**Step 3: Workspace Analysis**

- FileScanner recursively walks project directory
- CodebaseAnalyzer identifies languages and frameworks
- ProjectContext built with file list and tech stack
- Analysis cached for subsequent requests in session

**Step 4: Intent Detection**

- System analyzes message for keywords
- Determines if new plan, modification, or question
- Routes to appropriate handler

**Step 5: Plan Generation**

- PlanGenerator formats prompt with context
- LLMService sends request to configured AI provider
- Response parsed and validated
- Plan structure created with phases and steps

**Step 6: Display Results**

- Plan rendered in chat message
- Files made clickable
- Copy button added
- User can continue conversation

### Architecture Components

**Extension Entry Point (extension.ts)**

- Initializes all services and providers
- Registers commands and views
- Sets up configuration listeners
- Manages extension lifecycle

**Sidebar Provider (SidebarProvider.ts)**

- Implements WebviewViewProvider interface
- Manages chat UI and message passing
- Handles user input and file operations
- Maintains conversation history and state
- Routes messages to appropriate handlers

**LLM Service (LLMService.ts)**

- Handles communication with AI providers
- Supports Gemini, OpenAI, and Anthropic (planned)
- Provides two methods:
  - sendMessage(): For JSON plan generation
  - sendConversationalMessage(): For text responses
- Implements safety settings and error handling
- Manages API keys and configuration

**Plan Generator (PlanGenerator.ts)**

- Orchestrates plan creation process
- Formats prompts with workspace context
- Parses and validates LLM responses
- Creates fallback plans if LLM fails
- Structures phases and steps

**Codebase Analyzer (CodebaseAnalyzer.ts)**

- Scans workspace for relevant files
- Detects technology stack from config files
- Generates project summary
- Filters out non-relevant files (node_modules, .git, etc.)

**File Scanner (FileScanner.ts)**

- Recursively walks directory tree
- Collects file metadata (path, size, language)
- Applies exclusion patterns
- Provides file listing for analysis

### Message Flow

**User to Extension**:

```
User types message → Webview captures input →
postMessage to extension → SidebarProvider receives →
handleChatMessage processes
```

**Extension to User**:

```
Extension generates response →
postMessage to webview →
JavaScript renders in chat →
User sees formatted output
```

**File Click Flow**:

```
User clicks file link →
JavaScript captures click →
postMessage with file path →
Extension opens file →
Editor displays file
```

## Configuration

Traycer Lite requires configuration to connect to an AI provider. Access settings via:

- File > Preferences > Settings (or Code > Settings on Mac)
- Search for "Traycer Lite"
- Configure the following options:

### Required Settings

**traycer-lite.llm.provider**

- Type: String (dropdown)
- Options: mock, openai, anthropic, gemini
- Default: mock
- Description: Which AI service to use for plan generation

**traycer-lite.llm.apiKey**

- Type: String (password)
- Default: (empty)
- Description: API key for your chosen provider
- Alternative: Set TRAYCER_LITE_API_KEY environment variable

### Optional Settings

**traycer-lite.llm.model**

- Type: String
- Default: Provider-specific (gemini-2.5-flash, gpt-4, etc.)
- Description: Specific model to use for generation

**traycer-lite.llm.temperature**

- Type: Number (0-1)
- Default: 0.2
- Description: Controls randomness in responses (0 = deterministic, 1 = creative)

**traycer-lite.llm.maxTokens**

- Type: Number
- Default: 8192
- Description: Maximum length of generated responses

**traycer-lite.llm.baseUrl**

- Type: String
- Default: (empty)
- Description: Custom API endpoint for self-hosted or proxy services

### Example Configuration

```json
{
  "traycer-lite.llm.provider": "gemini",
  "traycer-lite.llm.apiKey": "your-api-key-here",
  "traycer-lite.llm.model": "gemini-2.5-flash",
  "traycer-lite.llm.temperature": 0.2,
  "traycer-lite.llm.maxTokens": 8192
}
```

## Getting Started

### First Use

1. Open a project folder in VS Code
2. Click the Traycer Lite icon in the Activity Bar (clipboard icon)
3. The sidebar chat interface opens
4. Type your first request: "Create a user authentication system"
5. Press Enter
6. Wait for the plan to generate
7. Review the phases and steps
8. Click file references to open files
9. Continue the conversation to refine the plan

### Example Conversations

**Creating a New Feature**:

```
User: Create a REST API for managing blog posts with CRUD operations
Assistant: [Generates 3-phase plan with 12 steps]
User: Add authentication middleware to protect the endpoints
Assistant: [Updates plan with authentication steps]
User: Which file should I create first?
Assistant: Start with src/middleware/auth.ts to set up the authentication...
```

**Refactoring Existing Code**:

```
User: Refactor the database queries to use Prisma ORM
Assistant: [Generates migration plan with 8 steps]
User: Make it more detailed, include schema examples
Assistant: [Regenerates with expanded steps and code snippets]
User: Show me the validation phase steps
Assistant: The validation phase includes: 1. Test existing queries...
```

## Development

For contributors and developers working on Traycer Lite itself:

### Setup

```bash
git clone https://github.com/your-repo/traycer-lite.git
cd traycer-lite
npm install
```

### Commands

**npm run compile** - Compiles TypeScript to JavaScript
**npm run watch** - Watches for changes and recompiles automatically
**npm test** - Runs the test suite
**npm run lint** - Checks code style and potential errors

### Project Structure

```
traycer-lite/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── core/                 # Core business logic
│   │   ├── CodebaseAnalyzer.ts
│   │   ├── FileScanner.ts
│   │   ├── PlanGenerator.ts
│   │   └── PromptFormatter.ts
│   ├── services/             # External service integrations
│   │   └── LLMService.ts
│   ├── ui/                   # User interface components
│   │   ├── ChatView.ts
│   │   ├── InputHandler.ts
│   │   ├── PlanView.ts
│   │   └── SidebarProvider.ts
│   ├── utils/                # Utility functions
│   │   ├── config.ts
│   │   └── logger.ts
│   └── types/                # TypeScript type definitions
│       ├── index.ts
│       └── plan.ts
├── media/                    # Webview assets
│   ├── sidebar.css
│   ├── sidebar.js
│   └── icon.svg
├── package.json              # Extension manifest
└── tsconfig.json             # TypeScript configuration
```

### Testing the Extension

1. Open the project in VS Code
2. Press F5 to launch Extension Development Host
3. A new VS Code window opens with the extension loaded
4. Test functionality in this window
5. View logs in Debug Console

## Troubleshooting

### Send Button Not Working

If the send button or Enter key doesn't respond:

- Check browser console for JavaScript errors (Help > Toggle Developer Tools)
- Verify message input field has focus
- Reload the webview (Close and reopen the sidebar)

### Empty or Error Responses

If you receive errors or empty plans:

- Verify API key is correctly configured
- Check internet connection
- Review Output panel (View > Output, select "Traycer Lite")
- Ensure you have API credits/quota remaining

### Plans Missing File References

If generated plans don't reference your files:

- Ensure workspace folder is open (not just files)
- Check that workspace contains recognizable config files
- Try with Quick mode for simpler responses

### Conversation History Issues

If context is lost between messages:

- Use the Clear Chat button to reset
- Reload VS Code window
- Check that extension hasn't crashed (look for errors in Output panel)

## Release Notes

### Version 0.0.1 - Initial Release

- Conversational chat interface for plan generation
- Support for Gemini AI provider
- Workspace analysis and context awareness
- Dual planning modes (Detailed and Quick)
- Interactive file reference links
- Plan modification and iterative refinement
- Copy to clipboard functionality
- Comprehensive error handling and logging

## Roadmap

Future enhancements under consideration:

- OpenAI and Anthropic provider support
- Plan templates and saved favorites
- Export plans to markdown files
- Multi-workspace support
- Code snippet generation
- Integration with GitHub Issues
- Collaborative planning features
- Voice input support

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[Include your license here]

## Support

For bug reports, feature requests, or questions:

- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section above

---

Built with TypeScript, VS Code Extension API, and Google Generative AI.
