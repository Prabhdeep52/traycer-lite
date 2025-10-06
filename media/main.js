
(function() {
    const vscode = acquireVsCodeApi();

    const chatHistory = document.getElementById('chat-history');
    const promptInput = document.getElementById('prompt-input');
    const sendButton = document.getElementById('send-button');

    sendButton.addEventListener('click', () => {
        const prompt = promptInput.value;
        if (prompt) {
            vscode.postMessage({
                command: 'sendMessage',
                text: prompt
            });
            promptInput.value = '';
        }
    });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'addMessage':
                addMessage(message.text, message.sender);
                break;
        }
    });

    function addMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(sender === 'user' ? 'user-message' : 'ai-message');
        messageElement.textContent = text;
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}());
