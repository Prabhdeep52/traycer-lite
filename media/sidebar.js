(function() {
    const vscode = acquireVsCodeApi();

    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const modeSelect = document.getElementById('mode-select');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-btn');
    const typingIndicator = document.getElementById('typing-indicator');

    let currentPlan = null;

    console.log('Sidebar script loaded');
    console.log('Elements found:', {
        chatMessages: !!chatMessages,
        messageInput: !!messageInput,
        modeSelect: !!modeSelect,
        sendBtn: !!sendBtn,
        clearBtn: !!clearBtn,
        typingIndicator: !!typingIndicator
    });

    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            console.log('Send button clicked');
            sendMessage();
        });
    }

    clearBtn.addEventListener('click', () => {
        if (confirm('Clear conversation history?')) {
            vscode.postMessage({ type: 'clearChat' });
        }
    });

    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            console.log('Key pressed:', e.key, 'Shift:', e.shiftKey);
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                console.log('Enter key pressed, sending message');
                sendMessage();
            }
        });
    }

    if (messageInput) {
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        });
    }

    chatMessages.addEventListener('click', (e) => {
        if (e.target.classList.contains('file-link')) {
            const filePath = e.target.getAttribute('data-file');
            if (filePath) {
                vscode.postMessage({
                    type: 'openFile',
                    filePath: filePath
                });
            }
        }
    });

    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'addMessage':
                addMessageToChat(message.message);
                break;
            case 'typing':
                setTyping(message.isTyping);
                break;
            case 'chatCleared':
                clearChat();
                break;
        }
    });

    function sendMessage() {
        console.log('sendMessage called');
        
        if (!messageInput) {
            console.error('messageInput not found');
            return;
        }

        const message = messageInput.value.trim();
        console.log('Message value:', message);
        
        if (!message) {
            console.log('Message is empty, not sending');
            return;
        }

        const mode = modeSelect ? modeSelect.value : 'phase';
        console.log('Mode:', mode);

        console.log('Posting message to extension:', { type: 'sendMessage', message, mode });
        vscode.postMessage({
            type: 'sendMessage',
            message: message,
            mode: mode
        });

        messageInput.value = '';
        messageInput.style.height = 'auto';
        if (sendBtn) {
            sendBtn.disabled = true;
        }
    }

    function addMessageToChat(message) {
        console.log('addMessageToChat called with:', message);
        
        const welcomeMsg = document.querySelector('.welcome-message');
        if (welcomeMsg && message.role === 'user') {
            welcomeMsg.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (message.plan) {
            // Store current plan
            currentPlan = message.plan;
            
            contentDiv.innerHTML = formatMessageContent(message.content);
            
            const planDiv = createPlanVisualization(message.plan);
            contentDiv.appendChild(planDiv);
        } else {
            contentDiv.innerHTML = formatMessageContent(message.content);
        }

        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'message-timestamp';
        timestampDiv.textContent = formatTimestamp(message.timestamp);

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timestampDiv);

        chatMessages.appendChild(messageDiv);
        scrollToBottom();

        sendBtn.disabled = false;
    }

    function createPlanVisualization(plan) {
        const container = document.createElement('div');
        container.className = 'plan-container';

        const header = document.createElement('div');
        header.className = 'plan-header';

        const title = document.createElement('h4');
        title.className = 'plan-title';
        title.textContent = '📋 Implementation Plan';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-plan-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.onclick = () => {
            const planText = formatPlanAsText(plan);
            vscode.postMessage({
                type: 'copyPlan',
                content: planText
            });
        };

        header.appendChild(title);
        header.appendChild(copyBtn);
        container.appendChild(header);

        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = renderPlan(plan);
        container.appendChild(contentDiv);

        return container;
    }

    function renderPlan(plan) {
        currentPlan = plan;
        
        let html = '';

        if (plan.summary) {
            html += `
                <div class="plan-summary">
                    <p><strong>📋 Summary:</strong> ${escapeHtml(plan.summary)}</p>
                </div>
            `;
        }

        if (plan.phases && plan.phases.length > 0) {
            plan.phases.forEach((phase, phaseIndex) => {
                html += `<div class="phase">
                    <div class="phase-header">
                        <h5 class="phase-title">${escapeHtml(phase.title)}</h5>
                        ${phase.summary ? `<p class="phase-summary">${escapeHtml(phase.summary)}</p>` : ''}
                    </div>`;

                if (phase.steps && phase.steps.length > 0) {
                    phase.steps.forEach((step, stepIndex) => {
                        html += `<div class="step">
                            <h6 class="step-title">${stepIndex + 1}. ${escapeHtml(step.title)}</h6>
                            <p class="step-description">${escapeHtml(step.description)}</p>
                            <div class="step-meta">`;

                        if (step.references && step.references.length > 0) {
                            html += `<div class="step-references">
                                <strong>📁 Files:</strong> ${step.references.map(ref => 
                                    `<span class="file-link" data-file="${escapeHtml(ref)}">${escapeHtml(ref)}</span>`
                                ).join(', ')}
                            </div>`;
                        }

                        if (step.reasoning) {
                            html += `<div style="margin-top: 4px;">
                                <strong>💡 Reasoning:</strong> ${escapeHtml(step.reasoning)}
                            </div>`;
                        }

                        if (step.estimatedEffort) {
                            html += `<span class="step-effort">⚡ ${escapeHtml(step.estimatedEffort)} Effort</span>`;
                        }

                        html += `</div></div>`;
                    });
                }

                html += `</div>`;
            });
        }

        return html;
    }

    function formatMessageContent(content) {
        let formatted = escapeHtml(content);
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }

    function setTyping(isTyping) {
        if (isTyping) {
            typingIndicator.classList.remove('hidden');
            scrollToBottom();
        } else {
            typingIndicator.classList.add('hidden');
        }
    }

    function clearChat() {
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <p>👋 Chat cleared! Ready for a new task.</p>
                <p class="hint">What would you like to build?</p>
            </div>
        `;
        currentPlan = null;
    }

    function formatTimestamp(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function formatPlanAsText(plan) {
        let text = `# Implementation Plan: ${plan.task}\n\n`;
        
        if (plan.summary) {
            text += `## Summary\n${plan.summary}\n\n`;
        }

        text += `**Generated:** ${new Date(plan.generatedAt).toLocaleString()}\n`;
        text += `**Mode:** ${plan.mode}\n\n`;

        if (plan.phases && plan.phases.length > 0) {
            plan.phases.forEach((phase, phaseIndex) => {
                text += `## Phase ${phaseIndex + 1}: ${phase.title}\n`;
                if (phase.summary) {
                    text += `${phase.summary}\n`;
                }
                text += '\n';

                if (phase.steps && phase.steps.length > 0) {
                    phase.steps.forEach((step, stepIndex) => {
                        text += `### ${stepIndex + 1}. ${step.title}\n`;
                        text += `${step.description}\n\n`;
                        
                        if (step.references && step.references.length > 0) {
                            text += `**Files:** ${step.references.join(', ')}\n`;
                        }
                        
                        if (step.reasoning) {
                            text += `**Reasoning:** ${step.reasoning}\n`;
                        }
                        
                        if (step.estimatedEffort) {
                            text += `**Effort:** ${step.estimatedEffort}\n`;
                        }
                        
                        text += '\n';
                    });
                }
            });
        }

        return text;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
})();
