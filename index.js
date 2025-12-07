/**
 * Pear Translate Application
 *
 * A simple translation application that translates text between English, Spanish, and French
 * using mock data stored in a local JSON file.
 *
 * Built on the Pear framework.
 */

// ============================================================================
// TRANSLATION DATA
// ============================================================================

let translationsData = null;

/**
 * Loads translation data from the local JSON file
 *
 * @returns {Promise<Object>} The translations object containing language mappings
 */
async function loadTranslations() {
  if (translationsData) {
    return translationsData;
  }

  try {
    const response = await fetch('./lang-models-dir/translations.json');
    if (!response.ok) {
      throw new Error(`Failed to load translations: ${response.status} ${response.statusText}`);
    }
    translationsData = await response.json();
    console.log('✅ Translations loaded successfully from local file');
    return translationsData;
  } catch (error) {
    console.error('Error loading translations:', error);
    return null;
  }
}

// ============================================================================
// TRANSLATION LOGIC
// ============================================================================

/**
 * Translates a word or phrase from one language to another
 * Uses the mock translation data to find matching translations
 *
 * The translation dictionary structure assumes that each language has the same keys,
 * but different values. For example:
 * - en: { "hello": "hello" }
 * - es: { "hello": "hola" }
 * - fr: { "hello": "bonjour" }
 *
 * @param {Object} translations - The translations object containing all language mappings
 * @param {string} text - The text to translate
 * @param {string} fromLang - Source language code (en, es, fr)
 * @param {string} toLang - Target language code (en, es, fr)
 * @returns {string} The translated text
 */
function translateText(translations, text, fromLang, toLang) {
  // If source and target languages are the same, return original text
  if (fromLang === toLang) {
    return text;
  }

  // If translations data is not available, return error message
  if (!translations || !translations[fromLang] || !translations[toLang]) {
    return 'Translation data not available';
  }

  // Normalize input: convert to lowercase and trim whitespace
  const normalizedText = text.toLowerCase().trim();

  // Get source and target language dictionaries
  const sourceDict = translations[fromLang];
  const targetDict = translations[toLang];

  // Check for exact phrase match first (handles multi-word phrases like "good morning")
  if (sourceDict[normalizedText] && targetDict[normalizedText]) {
    return targetDict[normalizedText];
  }

  // If no exact phrase match, try word-by-word translation
  const words = normalizedText.split(/\s+/);
  const translatedWords = words.map((word) => {
    // Check if the word exists as a key in both dictionaries
    // Since our mock data uses the same keys across languages,
    // we can directly look up the translation
    if (sourceDict[word] && targetDict[word]) {
      return targetDict[word];
    }

    // If word not found in dictionary, try to find it by value
    // This handles cases where the input might be in the target language format
    for (const [key, value] of Object.entries(sourceDict)) {
      if (value === word && targetDict[key]) {
        return targetDict[key];
      }
    }

    // If no translation found, return original word (preserves unknown words)
    return word;
  });

  return translatedWords.join(' ');
}

/**
 * Performs the translation workflow
 *
 * @param {string} text - The text to translate
 * @param {string} fromLang - Source language code
 * @param {string} toLang - Target language code
 * @returns {Promise<string>} The translated text
 */
async function performTranslation(text, fromLang, toLang) {
  // Validate input
  if (!text || text.trim().length === 0) {
    return 'Please enter some text to translate';
  }

  // Load translations from local file
  const translations = await loadTranslations();

  if (!translations) {
    return 'Error: Could not load translation data';
  }

  // Perform the translation
  const translatedText = translateText(translations, text, fromLang, toLang);

  return translatedText;
}

// ============================================================================
// UI EVENT HANDLERS
// ============================================================================

/**
 * Updates the output display with the given text and optional CSS class
 *
 * @param {string} text - The text to display
 * @param {string} className - Optional CSS class for styling (e.g., 'loading', 'error')
 */
function updateOutput(text, className = '') {
  const outputElement = document.getElementById('outputText');
  outputElement.textContent = text;
  outputElement.className = className;
}

/**
 * Handles the translate button click event
 * This is the main entry point for the translation functionality
 */
async function handleTranslate() {
  // Get UI element values
  const sourceLang = document.getElementById('sourceLang').value;
  const targetLang = document.getElementById('targetLang').value;
  const inputText = document.getElementById('inputText').value;
  const translateBtn = document.getElementById('translateBtn');

  // Validate that languages are different
  if (sourceLang === targetLang) {
    updateOutput(
      'Please select different source and target languages',
      'error'
    );
    return;
  }

  // Validate that input text is provided
  if (!inputText || inputText.trim().length === 0) {
    updateOutput('Please enter some text to translate', 'error');
    return;
  }

  // Disable button and show loading state
  translateBtn.disabled = true;
  updateOutput('Translating...', 'loading');

  try {
    // Perform the translation
    const translatedText = await performTranslation(
      inputText,
      sourceLang,
      targetLang
    );

    // Check if translation data failed to load
    if (translatedText === 'Error: Could not load translation data') {
      alert('⚠️ Failed to load translation data. Please ensure translations.json exists in the lang-models-dir folder.');
      updateOutput(translatedText, 'error');
    } else {
      // Display the result
      updateOutput(translatedText || 'Translation not available');
    }
  } catch (error) {
    console.error('Translation error:', error);
    updateOutput(
      'An error occurred during translation. Please try again.',
      'error'
    );
  } finally {
    // Re-enable the button
    translateBtn.disabled = false;
  }
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

/**
 * Initializes the application
 * Sets up event listeners and preloads translation data
 */
async function initializeApp() {
  console.log('Initializing Pear Translate Application...');

  // Preload translations
  await loadTranslations();

  // Set up translate button event listener
  const translateBtn = document.getElementById('translateBtn');
  translateBtn.addEventListener('click', handleTranslate);

  // Allow translation on Enter key press in textarea
  const inputText = document.getElementById('inputText');
  inputText.addEventListener('keydown', (event) => {
    // Check for Ctrl+Enter or Cmd+Enter to trigger translation
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleTranslate();
    }
  });

  console.log('Application initialized successfully');
}

// Start the application when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already ready
  initializeApp();
}
