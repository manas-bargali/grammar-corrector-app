// DOM Elements
const imageUpload = document.getElementById('image-upload');
const textInput = document.getElementById('text-input');
const correctButton = document.getElementById('correct-button');
const resultsSection = document.getElementById('results-section');
const originalTextElem = document.getElementById('original-text');
const correctedText = document.getElementById('corrected-text');
const suggestionsList = document.getElementById('suggestions-list');
const styleInsights = document.getElementById('style-insights');
const pronounceButton = document.getElementById('pronounce-button');
const copyButton = document.getElementById('copy-button');
const errorMessage = document.getElementById('error-message');
const infoMessage = document.getElementById('info-message');

// Config: Using public API for immediate functionality
const apiUrl = 'https://api.languagetool.org/v2/check'; // Public API
// const apiUrl = 'http://localhost:8081/v2/check'; // Local server (alternative) - start with: java -jar languagetool-server.jar --port 8081 --allow-origin "*"

// Step 1: Get Text from Input (Image or Text)
async function getTextFromInput() {
    console.log('Step 1: Getting text from input...');
    errorMessage.textContent = '';
    infoMessage.textContent = '';
    
    let text = textInput.value.trim();
    
    if (imageUpload.files.length > 0) {
        const file = imageUpload.files[0];
        console.log('Image uploaded:', file.name);
        
        if (!file.type.startsWith('image/')) {
            throw new Error('Please upload a valid image file (PNG/JPG).');
        }
        
        try {
            console.log('Starting OCR with Tesseract...');
            if (typeof Tesseract === 'undefined') {
                throw new Error('Tesseract library failed to load.');
            }
            const { createWorker } = Tesseract;
            const worker = await createWorker('eng');
            const { data: { text: ocrText } } = await worker.recognize(file);
            await worker.terminate();
            text = ocrText.trim();
            console.log('OCR extracted text:', text);
        } catch (err) {
            console.error('OCR error:', err);
            throw new Error('OCR failed: ' + err.message);
        }
    } else {
        console.log('Using text input:', text);
    }
    
    if (!text) {
        throw new Error('Please enter text or upload an image.');
    }
    
    return text;
}

// Step 3: Correct Grammar via LanguageTool API
async function correctGrammar(originalText) {
    console.log('Step 3: Starting correction for:', originalText);
    
    const params = new URLSearchParams({
        text: originalText,
        language: 'en-US',
    });
    
    try {
        console.log('Fetching from API:', apiUrl);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        
        console.log('API response status:', response.status);
        if (!response.ok) {
            throw new Error(`API Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('API response data:', data);
        
        if (!data.matches) {
            throw new Error('Invalid API response');
        }
        
        console.log('Matches found:', data.matches.length);
        let corrected = originalText;
        let offsetAdjustment = 0;
        
        // Sort matches by offset to apply corrections left to right
        const sortedMatches = [...data.matches].sort((a, b) => a.offset - b.offset);
        
        sortedMatches.forEach(match => {
            const suggestion = match.replacements[0]?.value || '';
            if (suggestion) {
                const start = match.offset + offsetAdjustment;
                const end = start + match.length;
                corrected = corrected.slice(0, start) + suggestion + corrected.slice(end);
                offsetAdjustment += suggestion.length - match.length;
            }
        });
        
        console.log('Final corrected:', corrected);
        
        if (corrected === originalText) {
            infoMessage.textContent = 'Text is already correct!';
        }
        
        return { corrected, matches: data.matches };
    } catch (err) {
        console.error('Correction error:', err);
        throw err;
    }
}

// Step 4: Display Results
function displayResults(original, { corrected, matches }) {
    console.log('Step 4: Displaying results...', { original, corrected, matches });
    
    // Display original text with error highlights
    let highlightedOriginal = original;
    let offsetAdj = 0;
    
    matches.forEach(match => {
        const start = match.offset + offsetAdj;
        const end = start + match.length;
        const errorText = highlightedOriginal.slice(start, end);
        const highlighted = `<span class="error-highlight">${errorText}</span>`;
        highlightedOriginal = highlightedOriginal.slice(0, start) + highlighted + highlightedOriginal.slice(end);
        offsetAdj += highlighted.length - errorText.length;
    });
    
    originalTextElem.innerHTML = highlightedOriginal;
    correctedText.textContent = corrected;
    
    // Display suggestions
    suggestionsList.innerHTML = '';
    if (matches.length === 0) {
        suggestionsList.innerHTML = '<li>No grammar issues found!</li>';
    } else {
        matches.forEach(match => {
            const li = document.createElement('li');
            const errorWord = original.substring(match.offset, match.offset + match.length);
            const suggestion = match.replacements[0]?.value || 'No suggestion';
            li.textContent = `${match.message}: "${errorWord}" → "${suggestion}"`;
            suggestionsList.appendChild(li);
        });
    }
    
    // Display style insights
    const wordCount = corrected.split(/\s+/).filter(w => w.length > 0).length;
    const sentenceCount = (corrected.match(/[.!?]+/g) || []).length || 1;
    const avgWordsPerSentence = Math.round(wordCount / sentenceCount);
    styleInsights.textContent = `Word count: ${wordCount}. Sentences: ${sentenceCount}. Avg words per sentence: ${avgWordsPerSentence}. ${avgWordsPerSentence > 20 ? 'Consider breaking into shorter sentences.' : 'Good sentence structure!'}`;
    
    resultsSection.style.display = 'block';
}

// Step 5: Pronounce Corrected Text
function pronounceText(text) {
    console.log('Pronouncing:', text);
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    } else {
        errorMessage.textContent = 'Text-to-speech not supported.';
    }
}

// Copy to Clipboard
function copyText() {
    navigator.clipboard.writeText(correctedText.textContent).then(() => {
        infoMessage.textContent = 'Copied!';
    }).catch(() => {
        errorMessage.textContent = 'Copy failed.';
    });
}

// Event Listeners
correctButton.addEventListener('click', async () => {
    console.log('Button clicked! Starting process...');
    try {
        const original = await getTextFromInput();
        const result = await correctGrammar(original);
        displayResults(original, result);
    } catch (err) {
        console.error('Overall error:', err);
        errorMessage.textContent = err.message;
    }
});

pronounceButton.addEventListener('click', () => pronounceText(correctedText.textContent));

copyButton.addEventListener('click', () => copyText());