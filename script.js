document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const modelSelector = document.getElementById('model-selector');
    const typingIndicator = document.getElementById('typing-indicator');
    const statusIndicator = document.getElementById('status-indicator');
    const profilePic = document.getElementById('profile-pic');
    const MAX_MESSAGES = 50; // Limit number of messages in chat

    // Profile picture upload
    profilePic.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    profilePic.src = event.target.result;
                    localStorage.setItem('profilePicture', event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    });

    const savedProfilePic = localStorage.getItem('profilePicture');
    if (savedProfilePic) profilePic.src = savedProfilePic;

    // Check Ollama status
    checkOllamaStatus();
    setInterval(checkOllamaStatus, 30000);

    function checkOllamaStatus() {
        fetch('http://localhost:11434/api/tags')
            .then(response => {
                if (response.ok) {
                    statusIndicator.innerHTML = '<span class="status-online">Connected</span>';
                    statusIndicator.classList.add('show');
                    setTimeout(() => statusIndicator.classList.remove('show'), 3000);
                    return response.json();
                }
                throw new Error('Ollama server is not responding');
            })
            .then(data => {
                if (data?.models) {
                    modelSelector.innerHTML = '';
                    data.models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.name;
                        option.textContent = model.name;
                        modelSelector.appendChild(option);
                    });
                }
            })
            .catch(error => {
                console.error('Error checking Ollama status:', error);
                statusIndicator.innerHTML = '<span class="status-offline">Ollama not running</span>';
                statusIndicator.classList.add('show');
                setTimeout(() => statusIndicator.classList.remove('show'), 5000);
            });
    }

    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        addMessage(message, 'user');
        messageInput.value = '';
        typingIndicator.style.display = 'block';
        chatContainer.scrollTop = chatContainer.scrollHeight;

        const selectedModel = modelSelector.value;
        sendToOllama(message, selectedModel);
    }

    async function sendToOllama(message, model) {
        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, prompt: message, stream: true })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const botMessageDiv = document.createElement('div');
            botMessageDiv.className = 'message bot-message';
            chatContainer.appendChild(botMessageDiv);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let responseText = '';

            typingIndicator.style.display = 'none';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    botMessageDiv.innerHTML = formatMessage(responseText); // Final render
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const parsedLine = JSON.parse(line);
                        if (parsedLine.response) {
                            responseText += parsedLine.response;
                            // Update only every few chunks to reduce DOM thrashing
                            if (responseText.length % 10 === 0) {
                                botMessageDiv.innerHTML = formatMessage(responseText);
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e, line);
                    }
                }
            }

            // Cleanup old messages
            while (chatContainer.children.length > MAX_MESSAGES) {
                chatContainer.removeChild(chatContainer.firstChild);
            }
            chatContainer.scrollTop = chatContainer.scrollHeight;

        } catch (error) {
            console.error('Error calling Ollama API:', error);
            typingIndicator.style.display = 'none';
            addMessage('Error: Could not connect to Ollama service.', 'bot');
        }
    }

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.innerHTML = formatMessage(text);
        chatContainer.appendChild(messageDiv);

        // Cleanup old messages
        while (chatContainer.children.length > MAX_MESSAGES) {
            chatContainer.removeChild(chatContainer.firstChild);
        }
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function formatMessage(text) {
        let formattedText = text
            .replace(/</g, '&lt;') // Basic sanitization
            .replace(/>/g, '&gt;');

        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\/\/(.*?)\/\//g, '<em>$1</em>');
        formattedText = formattedText.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');

        if (formattedText.includes('* ')) {
            const lines = formattedText.split('\n');
            let listItems = [];
            let inList = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('* ')) {
                    const content = line.substring(2).trim();
                    if (content && content !== ':') {
                        listItems.push(content.includes(':') 
                            ? `<li><code>${content.split(':')[0].trim()}</code> — ${content.split(':')[1].trim()}</li>`
                            : `<li>${content}</li>`);
                        inList = true;
                    }
                } else if (inList) {
                    formattedText = formattedText.replace(
                        lines.slice(i - listItems.length, i).join('\n'),
                        `<ul>${listItems.join('')}</ul>` // Use <ul> for bullets
                    );
                    listItems = [];
                    inList = false;
                }
            }

            if (listItems.length) {
                formattedText = formattedText.replace(
                    lines.slice(-listItems.length).join('\n'),
                    `<ul>${listItems.join('')}</ul>`
                );
            }
        }

        return formattedText.replace(/\n/g, '<br>');
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});