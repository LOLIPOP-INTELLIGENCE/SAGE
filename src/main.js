import { BrowserAI } from '@browserai/browserai';
import './style.css';

// Initialize BrowserAI with configuration
const browserAI = new BrowserAI({
    debug: true
});

let currentQuestion = null;
let selectedSubject = null;
let conversationHistory = [];
let modelReady = false;

// Create the UI
document.querySelector('#app').innerHTML = `
  <div class="container">
    <header>
      <h1>SAGE</h1>
      <nav class="subject-nav">
        <button id="mathBtn" class="subject-btn" disabled>Math</button>
        <button id="englishBtn" class="subject-btn" disabled>English</button>
      </nav>
    </header>

    <main>
      <div class="question-container hidden">
        <div id="question"></div>
        <div id="options"></div>
      </div>
      <div class="response-container hidden">
        <div id="feedback"></div>
      </div>
      <div class="input-area hidden">
        <textarea id="answerInput" placeholder="Share your thoughts here..." rows="4"></textarea>
        <button id="submitBtn" class="submit-btn">Submit Answer</button>
      </div>
      <div id="loading" class="loading">Loading model from cache...</div>
    </main>
  </div>
`;

// Enable interface elements when model is ready
function enableInterface() {
    document.getElementById('mathBtn').disabled = false;
    document.getElementById('englishBtn').disabled = false;
}

// Load questions from JSON files
async function loadQuestions(subject) {
    const response = await fetch(`/qna/${subject}/test1.json`);
    return await response.json();
}

// Get a random question
function getRandomQuestion(questions) {
    const randomIndex = Math.floor(Math.random() * questions.length);
    return questions[randomIndex];
}

// Display a question
function displayQuestion(questionObj) {
    console.log('Question object:', questionObj);
    
    // Extract just the letter from the answer (e.g. "A) theory" -> "A")
    const correctLetter = questionObj.Answer.split(')')[0];
    console.log('Correct letter:', correctLetter);
    
    currentQuestion = questionObj;
    conversationHistory = [];
    
    const questionArea = document.querySelector('.question-container');
    const questionElement = document.getElementById('question');
    const optionsElement = document.getElementById('options');

    questionElement.innerHTML = `<p>${questionObj.Question}</p>`;
    
    // Create options with click handlers
    optionsElement.innerHTML = questionObj.Options.map((option, index) => {
        const letter = String.fromCharCode(65 + index); // Convert 0 to 'A', 1 to 'B', etc.
        console.log(`Creating option ${letter}:`, option);
        return `<div class="option" data-letter="${letter}">${option}</div>`;
    }).join('');
    
    // Add click handlers to options
    const options = optionsElement.querySelectorAll('.option');
    options.forEach(option => {
        option.addEventListener('click', () => handleOptionClick(option, correctLetter));
    });

    questionArea.classList.remove('hidden');
    document.querySelector('.response-container').classList.remove('hidden');
    document.querySelector('.input-area').classList.remove('hidden');
}

// Handle option click
function handleOptionClick(optionElement, correctLetter) {
    const selectedLetter = optionElement.dataset.letter;
    const isCorrect = selectedLetter === correctLetter;
    
    // Remove previous feedback classes from all options
    const options = document.querySelectorAll('.option');
    options.forEach(opt => {
        opt.classList.remove('correct', 'incorrect');
        opt.style.pointerEvents = 'none'; // Disable further clicks
    });
    
    // Add feedback class to selected option only
    optionElement.classList.add(isCorrect ? 'correct' : 'incorrect');
    
    // After 1.5 seconds, remove the feedback classes and enable clicks
    setTimeout(() => {
        options.forEach(opt => {
            opt.classList.remove('correct', 'incorrect');
            opt.style.pointerEvents = 'auto';
        });
    }, 1500);
}

// Add message to conversation
function addToConversation(message, isAI = false) {
    const conversationElement = document.getElementById('feedback');
    if (isAI) {
        // Convert markdown-style formatting to HTML
        message = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>')              // Italic
            .replace(/\n\n/g, '</p><p>')                       // Paragraphs
            .replace(/\n/g, '<br>');                           // Line breaks
        
        message = `<p>${message}</p>`;
    } else {
        message = `<p class="user-response">${message}</p>`;
    }
    conversationElement.innerHTML = message;
    conversationHistory.push({ role: isAI ? 'assistant' : 'user', content: message });
}

// Update thinking process display
function updateThinkingProcess(text) {
    // Keep this function but make it do nothing
    return;
}

// Initialize the AI model
function initializeAI(callback) {
    try {
        document.getElementById('loading').classList.remove('hidden');
        console.log('Starting model initialization...');
        
        // Add timeout detection
        let loadingTimeout = setTimeout(() => {
            console.log('Loading timeout - checking state...');
            if (!modelReady) {
                console.log('Model still not ready after timeout');
                document.getElementById('loading').textContent = 'Loading seems stuck. Please refresh the page.';
            }
        }, 30000); // 30 second timeout
        
        browserAI.loadModel('deepseek-r1-distill-llama-8b', {
            quantization: 'q4f16_1',
            onProgress: (progress) => {
                console.log('Progress update:', progress);
                
                const loadingText = progress.text || '';
                let statusMessage = '';
                
                if (loadingText.includes('Loading model from cache')) {
                    statusMessage = 'Loading model from cache...';
                } else if (loadingText.includes('Loading GPU shader modules')) {
                    const match = loadingText.match(/\[(\d+)\/(\d+)\]/);
                    if (match) {
                        const [current, total] = match;
                        const percentage = Math.round((parseInt(current) / parseInt(total)) * 100);
                        statusMessage = `Loading GPU shaders: ${percentage}%`;
                    } else {
                        statusMessage = 'Loading GPU shaders...';
                    }
                } else if (loadingText.includes('Finish loading')) {
                    statusMessage = 'WebGPU initialization complete...';
                    console.log('Detected finish loading message');
                    
                    // If we get the finish message but onComplete hasn't fired,
                    // wait a bit and force completion
                    setTimeout(() => {
                        if (!modelReady) {
                            console.log('Forcing completion after finish message');
                            clearTimeout(loadingTimeout);
                            modelReady = true;
                            document.getElementById('loading').classList.add('hidden');
                            enableInterface();
                            callback();
                        }
                    }, 2000); // Wait 2 seconds before forcing completion
                } else {
                    statusMessage = `Loading: ${loadingText}`;
                }
                
                document.getElementById('loading').textContent = statusMessage;
            },
            onComplete: () => {
                console.log('Model loading complete callback fired!');
                clearTimeout(loadingTimeout);
                modelReady = true;
                document.getElementById('loading').classList.add('hidden');
                enableInterface();
                callback();
            },
            onError: (error) => {
                console.error('BrowserAI error:', error);
                console.error('Error type:', typeof error);
                console.error('Error keys:', Object.keys(error));
                clearTimeout(loadingTimeout);
                document.getElementById('loading').textContent = `Error: ${error.message}`;
            }
        });
        
        console.log('Load model call completed');
    } catch (error) {
        console.error('Error in initializeAI:', error);
        document.getElementById('loading').textContent = 'Error loading AI model. Please make sure you are using Chrome Canary or Edge Canary with WebGPU enabled.';
    }
}

// Generate next tutor response
async function generateTutorResponse(userInput) {
    if (!modelReady) {
        addToConversation("Please wait for the AI model to finish loading...", true);
        return;
    }

    const prompt = `You are a supportive Socratic tutor helping a student learn. Your goal is to guide them to understanding while acknowledging their progress.

Question for the student: ${currentQuestion.Question}

Reference answer (DO NOT REVEAL DIRECTLY): ${currentQuestion.Answer}
Reference reasoning (DO NOT REVEAL DIRECTLY): ${currentQuestion.Reasoning}

Previous conversation:
${conversationHistory.map(msg => `${msg.role === 'assistant' ? 'Tutor' : 'Student'}: ${msg.content}`).join('\n')}

Student just said: "${userInput}"

RESPONSE STRUCTURE:
1. First, acknowledge what the student understands correctly
2. Then, if they're not fully correct:
   - Ask a specific question to guide their thinking
   - Or point out what they might want to reconsider
3. If they are correct:
   - Confirm their understanding
   - Ask them to explain their reasoning to solidify learning

EXAMPLES OF GOOD RESPONSES:

When student is correct:
"You're absolutely right that this is a theory! Can you explain why predictions and calculations would make this a theory rather than just an experiment?"

When partially correct:
"Good observation about X. However, let's think about Y - how might that affect your conclusion?"

When stuck:
"I see you're unsure about X. Let's break this down - what do we know about [specific aspect] from the passage?"

When on wrong track:
"I understand your thinking about X. However, let's look at this another way - what does the passage say about [key detail they missed]?"

BAD RESPONSES TO AVOID:
- Just asking questions without acknowledging understanding
- Explaining the answer directly
- Ignoring what the student has already figured out
- Being vague ("What do you think?")

Based on the student's response "${userInput}", craft a response that:
1. Validates what they understand
2. Guides them toward any missing pieces
3. Uses specific details from their response and the question

Remember: If they're correct, confirm it and deepen their understanding. Don't just keep questioning if they've got it!`;

    try {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('loading').textContent = 'Thinking...';
        
        console.log('Starting generation with prompt:', prompt);
        
        const response = await browserAI.generateText(prompt, {
            temperature: 0.2,
            max_tokens: 2048,
            stream: true
        });

        let fullResponse = '';
        const feedbackElement = document.createElement('div');
        feedbackElement.className = 'ai-message typing';
        document.getElementById('feedback').appendChild(feedbackElement);

        let thinkingContent = '';
        let finalResponse = '';
        let lastLoggedLength = 0;

        console.log('\nStarting response stream...\n---');
        
        for await (const chunk of response) {
            const newContent = chunk.choices[0]?.delta.content || '';
            fullResponse += newContent;
            
            // Only log when we've accumulated some new content
            if (fullResponse.length >= lastLoggedLength + 10) {
                console.log('Current response:', fullResponse);
                lastLoggedLength = fullResponse.length;
            }
            
            // Separate thinking process from final response
            if (fullResponse.includes('<think>')) {
                const parts = fullResponse.split('</think>');
                if (parts.length > 1) {
                    thinkingContent = parts[0].replace('<think>', '').trim();
                    finalResponse = parts[1].trim();
                    
                    console.log('\nThinking complete:', thinkingContent);
                    console.log('\nStarting response:', finalResponse);
                    
                    updateThinkingProcess(thinkingContent);
                    feedbackElement.textContent = finalResponse;
                } else {
                    // Still in thinking section
                    updateThinkingProcess(fullResponse.replace('<think>', '').trim());
                }
            } else {
                feedbackElement.textContent = fullResponse;
            }
        }

        console.log('\nFinal response:', fullResponse);
        console.log('---\nGeneration complete\n');

        feedbackElement.classList.remove('typing');
        document.getElementById('loading').classList.add('hidden');
        
        // Only add the final response to conversation history
        conversationHistory.push({ role: 'assistant', content: finalResponse || fullResponse });
    } catch (error) {
        console.error('Error generating response:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        document.getElementById('loading').classList.add('hidden');
        addToConversation("I apologize, but I'm having trouble generating a response. Could you please rephrase your thoughts?", true);
    }
}

// Event Listeners
document.getElementById('mathBtn').addEventListener('click', async () => {
    selectedSubject = 'math';
    const questions = await loadQuestions('math');
    console.log('Loaded math questions:', questions);
    displayQuestion(getRandomQuestion(questions));
});

document.getElementById('englishBtn').addEventListener('click', async () => {
    selectedSubject = 'english';
    const questions = await loadQuestions('english');
    console.log('Loaded english questions:', questions);
    displayQuestion(getRandomQuestion(questions));
});

document.getElementById('submitBtn').addEventListener('click', async () => {
    const userInput = document.getElementById('answerInput').value.trim();
    if (userInput) {
        addToConversation(userInput, false);
        document.getElementById('answerInput').value = '';
        await generateTutorResponse(userInput);
    }
});

// Initialize the AI when the page loads
initializeAI(() => {
    console.log('Model loaded and interface enabled');
});
