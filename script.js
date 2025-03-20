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
    
        // Apply inline formatting
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\/\/(.*?)\/\//g, '<em>$1</em>');
        formattedText = formattedText.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
    
        // Convert text to lines for processing
        const lines = formattedText.split('\n');
        const processedChunks = [];
        let currentTextChunk = [];
        let currentTableLines = [];
        let inTable = false;
    
        // Process line by line to properly identify tables
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Check if line is part of a table
            if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
                if (!inTable) {
                    // Starting a new table - push accumulated text first
                    if (currentTextChunk.length > 0) {
                        processedChunks.push({
                            type: 'text',
                            content: currentTextChunk.join('\n')
                        });
                        currentTextChunk = [];
                    }
                    inTable = true;
                }
                // Add to current table
                currentTableLines.push(line);
            } else {
                if (inTable) {
                    // End of table - process and add the table
                    if (currentTableLines.length > 0) {
                        processedChunks.push({
                            type: 'table',
                            content: currentTableLines
                        });
                        currentTableLines = [];
                    }
                    inTable = false;
                }
                // Add to text chunk
                currentTextChunk.push(line);
            }
        }
    
        // Handle any remaining content
        if (inTable && currentTableLines.length > 0) {
            processedChunks.push({
                type: 'table',
                content: currentTableLines
            });
        } else if (currentTextChunk.length > 0) {
            processedChunks.push({
                type: 'text',
                content: currentTextChunk.join('\n')
            });
        }
    
        // Process each chunk
        let result = '';
        for (const chunk of processedChunks) {
            if (chunk.type === 'text') {
                // Process lists in text chunks
                let textContent = processLists(chunk.content);
                result += textContent;
            } else if (chunk.type === 'table') {
                // Process table chunk
                result += processTable(chunk.content);
            }
        }
    
        // Convert remaining newlines to <br> tags
        return result.replace(/\n/g, '<br>');
    }
    
    // Process unordered lists
    function processLists(text) {
        if (!text.includes('* ')) return text;
        
        const lines = text.split('\n');
        let processedLines = [];
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
            } else {
                if (inList) {
                    processedLines.push(`<ul>${listItems.join('')}</ul>`);
                    listItems = [];
                    inList = false;
                }
                processedLines.push(lines[i]);
            }
        }
        
        if (listItems.length) {
            processedLines.push(`<ul>${listItems.join('')}</ul>`);
        }
        
        return processedLines.join('\n');
    }
    
    // Process Markdown tables into HTML tables
    function processTable(tableLines) {
        if (!Array.isArray(tableLines) || tableLines.length === 0) return '';
    
        // Create a table with proper class for styling
        let tableHTML = '<table class="styled-table">';
        
        let headerProcessed = false;
        
        for (let i = 0; i < tableLines.length; i++) {
            const line = tableLines[i];
            
            // Skip separator line (contains only | and -)
            if (line.replace(/\|/g, '').trim().replace(/-/g, '').replace(/:/g, '').trim() === '') {
                headerProcessed = true;
                continue;
            }
            
            const cells = line.split('|');
            // Filter out empty cells at beginning and end (from | at edges)
            const filteredCells = [];
            for (let j = 0; j < cells.length; j++) {
                if (j === 0 || j === cells.length - 1) {
                    if (cells[j].trim() !== '') {
                        filteredCells.push(cells[j]);
                    }
                } else {
                    filteredCells.push(cells[j]);
                }
            }
            
            // Determine if this is a header row
            const isHeader = !headerProcessed && (i === 0 || 
                (i === 1 && tableLines[1] && tableLines[1].replace(/\|/g, '').trim().replace(/-/g, '').replace(/:/g, '').trim() === ''));
            
            tableHTML += '<tr>';
            filteredCells.forEach(cell => {
                const tag = isHeader ? 'th' : 'td';
                tableHTML += `<${tag}>${cell.trim()}</${tag}>`;
            });
            tableHTML += '</tr>';
        }
        
        tableHTML += '</table>';
        return tableHTML;
    }
    
    // When DOM content is loaded, process all code blocks to add copy buttons
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize code copy functionality
        initCodeCopy();
        
        // For dynamic messages, you'll need to call this after adding new messages
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    enhanceCodeBlocks();
                }
            });
        });
        
        // Start observing the chat container for added messages
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            observer.observe(chatContainer, { childList: true, subtree: true });
        }
    });
    
    

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        // Check if it's Ctrl+Enter (or Cmd+Enter for Mac)
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            // Insert a newline character at the cursor position
            const cursorPosition = messageInput.selectionStart;
            const currentValue = messageInput.value;
            
            // Insert newline at cursor position
            messageInput.value = 
                currentValue.substring(0, cursorPosition) + 
                '\n' + 
                currentValue.substring(cursorPosition);
            
            // Set cursor position after the inserted newline
            messageInput.selectionStart = cursorPosition + 1;
            messageInput.selectionEnd = cursorPosition + 1;
            
            // Auto-resize if it's a textarea
            if (messageInput.tagName.toLowerCase() === 'textarea') {
                autoResizeTextarea(messageInput);
            }
            
            // Prevent default behavior
            e.preventDefault();
        } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            // Regular Enter key without modifiers sends the message
            sendMessage();
            e.preventDefault();
        }
    });
});