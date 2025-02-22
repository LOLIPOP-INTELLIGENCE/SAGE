import { BrowserAI } from '@browserai/browserai';

// Initialize BrowserAI with configuration
const browserAI = new BrowserAI({
    debug: true // Enable debug logging
});
 
// Load a model and generate text
async function quickStart() {
    try {
        // Check if WebGPU is supported
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported. Please use Chrome Canary or Edge Canary with WebGPU enabled');
        }

        console.log('Loading model...');
        // Load a small, efficient model
        await browserAI.loadModel('llama-3.2-1b-instruct');
        
        console.log('Generating response...');
        // Generate your first AI response!
        const response = await browserAI.generateText('Hello, BrowserAI!');
        console.log('Response:', response);
        
        // Update the UI
        document.getElementById('output').textContent = response;
    } catch (error) {
        console.error('Error:', error.message);
        document.getElementById('output').textContent = 'Error: ' + error.message;
    }
}
 
// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', quickStart);