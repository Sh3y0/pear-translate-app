/**
 * Pear Translate Application
 *
 * A simple translation application that translates text between English, Spanish, and French
 * using mock data stored in a local JSON file.
 *
 * Built on the Pear framework.
 */

import Hyperswarm from "hyperswarm";
import Hyperdrive from "hyperdrive";
import Localdrive from "localdrive";
import Corestore from "corestore";
import debounce from "debounceify";
import b4a from "b4a";

// ============================================================================
// HYPERDRIVE LOGIC
// ============================================================================

// Global variables for Hyperdrive components
let store = null;
let swarm = null;
let drive = null;
let local = null;
let isConnected = false;

/**
 * Updates the connection status message in the UI
 * @param {string} message - Status message to display
 * @param {string} type - Message type: 'info', 'success', 'error'
 */
function updateConnectionStatus(message, type = 'info') {
  const statusElement = document.getElementById('connectionStatus');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `connection-status status-${type}`;
    statusElement.style.display = 'block'; // Make sure it's visible
  }
  console.log(message);
}

/**
 * Mirrors the remote Hyperdrive to local directory
 * @returns {Promise<number>} Number of files mirrored
 */
async function mirrorDrive() {
  updateConnectionStatus('Mirroring files from remote drive...', 'info');
  const mirror = drive.mirror(local);
  await mirror.done();
  console.log('Finished mirroring:', mirror.count, 'files');
  return mirror.count;
}

/**
 * Connects to a Hyperdrive using the provided key
 * @param {string} key - Hyperdrive public key (hex string)
 * @returns {Promise<void>}
 */
async function connectToHyperdrive(key) {
  try {
    // Validate key format (should be hex string)
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('Invalid key: Key cannot be empty');
    }

    const trimmedKey = key.trim();
    
    // Basic hex validation (should be even length and only hex characters)
    if (trimmedKey.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(trimmedKey)) {
      throw new Error('Invalid key format: Key must be a valid hex string');
    }

    updateConnectionStatus('Initializing Corestore...', 'info');
    
    // Create a Corestore instance
    store = new Corestore(Pear.config.storage);

    updateConnectionStatus('Setting up Hyperswarm...', 'info');
    
    // Create Hyperswarm for peer discovery
    swarm = new Hyperswarm();
    Pear.teardown(() => swarm.destroy());

    // Set up replication on connection with other peers
    swarm.on('connection', (conn) => store.replicate(conn));

    updateConnectionStatus('Creating local drive...', 'info');
    
    // Create a local copy of the remote drive
    local = new Localdrive('./lang-models-dir');

    updateConnectionStatus('Connecting to Hyperdrive...', 'info');
    
    // Create a hyperdrive using the provided public key
    drive = new Hyperdrive(store, b4a.from(trimmedKey, 'hex'));

    // Wait till all the properties of the drive are initialized
    await drive.ready();

    updateConnectionStatus('Joining swarm...', 'info');
    
    // Set up debounced mirror function
    const debouncedMirror = debounce(mirrorDrive);

    // Call the mirror function whenever content gets appended
    drive.core.on('append', debouncedMirror);

    const foundPeers = store.findingPeers();

    // Join the swarm topic
    swarm.join(drive.discoveryKey, { client: true, server: false });
    await swarm.flush();
    foundPeers();

    updateConnectionStatus('Retrieving files...', 'info');
    
    // Start the mirroring process
    const fileCount = await mirrorDrive();

    isConnected = true;
    updateConnectionStatus(`✅ Connected! Retrieved ${fileCount} file(s).`, 'success');
    
    return fileCount;
  } catch (error) {
    console.error('Error connecting to Hyperdrive:', error);
    throw error;
  }
}


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
 * Enables or disables the translation form
 * @param {boolean} enabled - Whether to enable the form
 */
function setTranslationFormEnabled(enabled) {
  const sourceLang = document.getElementById('sourceLang');
  const targetLang = document.getElementById('targetLang');
  const inputText = document.getElementById('inputText');
  const translateBtn = document.getElementById('translateBtn');
  
  sourceLang.disabled = !enabled;
  targetLang.disabled = !enabled;
  inputText.disabled = !enabled;
  translateBtn.disabled = !enabled;
  
  // Add visual indication
  const container = document.querySelector('.translation-container');
  if (container) {
    if (enabled) {
      container.classList.remove('disabled');
    } else {
      container.classList.add('disabled');
    }
  }
}

/**
 * Shows or hides the loading indicator
 * @param {boolean} show - Whether to show the loading indicator
 */
function setLoadingIndicator(show) {
  const loader = document.getElementById('loadingIndicator');
  if (loader) {
    loader.style.display = show ? 'block' : 'none';
  }
}

/**
 * Handles the connect button click event
 * Connects to Hyperdrive and retrieves translation files
 */
async function handleConnect() {
  const keyInput = document.getElementById('hyperdriveKey');
  const connectBtn = document.getElementById('connectBtn');
  const key = keyInput.value.trim();
  
  // Validate key input
  if (!key) {
    updateConnectionStatus('❌ Please enter a Hyperdrive key', 'error');
    return;
  }
  
  // Disable connect button and show loading
  connectBtn.disabled = true;
  setLoadingIndicator(true);
  updateConnectionStatus('Connecting...', 'info');
  
  try {
    // Connect to Hyperdrive and retrieve files
    await connectToHyperdrive(key);
    
    // Hide the connection section
    const connectionSection = document.getElementById('connectionSection');
    if (connectionSection) {
      connectionSection.style.display = 'none';
    }
    
    // Enable the translation form
    setTranslationFormEnabled(true);
    
    // Load translations from the retrieved files
    updateConnectionStatus('Loading translation data...', 'info');
    const translations = await loadTranslations();
    
    if (translations) {
      updateConnectionStatus('✅ Ready to translate!', 'success');
    } else {
      updateConnectionStatus('⚠️ Connected but translation file not found', 'error');
      alert('Translation file was not found in the retrieved data. Please check the Hyperdrive key.');
    }
    
  } catch (error) {
    console.error('Connection error:', error);
    updateConnectionStatus(`❌ Connection failed: ${error.message}`, 'error');
    alert(`Failed to connect to Hyperdrive:\n\n${error.message}\n\nPlease check the key and try again.`);
    
    // Re-enable connect button
    connectBtn.disabled = false;
  } finally {
    setLoadingIndicator(false);
  }
}

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
 * Sets up event listeners for connection and translation
 */
async function initializeApp() {
  console.log('Initializing Pear Translate Application...');

  // Disable translation form initially (will be enabled after Hyperdrive connection)
  setTranslationFormEnabled(false);

  // Set up connect button event listener
  const connectBtn = document.getElementById('connectBtn');
  if (connectBtn) {
    connectBtn.addEventListener('click', handleConnect);
  }

  // Set up translate button event listener
  const translateBtn = document.getElementById('translateBtn');
  if (translateBtn) {
    translateBtn.addEventListener('click', handleTranslate);
  }

  // Allow translation on Enter key press in textarea
  const inputText = document.getElementById('inputText');
  if (inputText) {
    inputText.addEventListener('keydown', (event) => {
      // Check for Ctrl+Enter or Cmd+Enter to trigger translation
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        handleTranslate();
      }
    });
  }

  // Allow Enter key to trigger connect
  const keyInput = document.getElementById('hyperdriveKey');
  if (keyInput) {
    keyInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleConnect();
      }
    });
  }

  console.log('Application initialized. Please enter a Hyperdrive key to connect.');
}

// Start the application when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already ready
  initializeApp();
}
