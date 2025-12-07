/**
 * Pear Translate Application
 *
 * This application simulates text translation between English, Spanish, and French
 * using mock data stored in a Hyperdrive filesystem.
 *
 * Built on the Bare ecosystem with Pear framework.
 *
 * Note: Hyperdrive integration is attempted but may fail due to native module
 * compatibility issues with the Pear runtime. The app gracefully falls back to
 * using the local translations.json file, ensuring functionality is maintained.
 */

// Note: We use dynamic imports for Hyperdrive and Corestore to avoid
// initialization errors during module loading in the Pear environment.
// If Hyperdrive modules fail to load (due to native dependency issues),
// the app will use the local translations.json file as a fallback.

// ============================================================================
// HYPERDRIVE INITIALIZATION
// ============================================================================

// Variables for lazy initialization of Corestore and Hyperdrive
let store = null;
let drive = null;
let hyperdriveInitialized = false;
let Hyperdrive = null;
let Corestore = null;
let b4a = null;

// Flag to track if translations data has been loaded into Hyperdrive
let translationsLoaded = false;

/**
 * Dynamically imports Hyperdrive, Corestore, and b4a modules
 * This is done lazily to avoid initialization errors during module loading
 *
 * @returns {Promise<boolean>} Returns true if modules were successfully imported
 */
async function loadHyperdriveModules() {
  // If already loaded, return early
  if (Hyperdrive && Corestore && b4a) {
    return true;
  }

  // If we've already tried and failed, don't try again
  if (hyperdriveInitialized && !Hyperdrive) {
    return false;
  }

  try {
    // Use dynamic imports to load modules only when needed
    // Wrap in a try-catch to handle any initialization errors
    let hyperdriveError = null;
    let corestoreError = null;
    let b4aError = null;

    const [HyperdriveModule, CorestoreModule, b4aModule] = await Promise.all([
      import("hyperdrive").catch((err) => {
        hyperdriveError = err;
        console.warn("Failed to import hyperdrive:", err.message || err);
        return null;
      }),
      import("corestore").catch((err) => {
        corestoreError = err;
        console.warn("Failed to import corestore:", err.message || err);
        return null;
      }),
      import("b4a").catch((err) => {
        b4aError = err;
        console.warn("Failed to import b4a:", err.message || err);
        return null;
      }),
    ]);

    // Check which modules failed and log details
    const failedModules = [];
    if (!HyperdriveModule) failedModules.push("hyperdrive");
    if (!CorestoreModule) failedModules.push("corestore");
    if (!b4aModule) failedModules.push("b4a");

    if (failedModules.length > 0) {
      console.warn(
        `Hyperdrive modules failed to load: ${failedModules.join(
          ", "
        )}. Will use local file fallback.`
      );
      console.info(
        "Note: This is expected in some Pear runtime environments due to native module compatibility."
      );
      console.info(
        "The app will continue to function using local translations.json file."
      );
      return false;
    }

    // Extract default exports
    Hyperdrive = HyperdriveModule.default || HyperdriveModule;
    Corestore = CorestoreModule.default || CorestoreModule;
    b4a = b4aModule.default || b4aModule;

    console.log("Hyperdrive modules loaded successfully");
    return true;
  } catch (error) {
    console.error("Error loading Hyperdrive modules:", error);
    return false;
  }
}

/**
 * Initializes Corestore and Hyperdrive lazily
 * This function is called when we need to use Hyperdrive for the first time
 * It safely handles cases where Pear.config.storage might not be available
 *
 * @returns {Promise<boolean>} Returns true if Hyperdrive was successfully initialized, false otherwise
 */
async function initializeHyperdrive() {
  // If already initialized, return early
  if (hyperdriveInitialized) {
    return drive !== null;
  }

  try {
    // First, load the modules dynamically
    const modulesLoaded = await loadHyperdriveModules();
    if (!modulesLoaded) {
      console.warn(
        "Could not load Hyperdrive modules, will use local file fallback"
      );
      hyperdriveInitialized = true;
      return false;
    }

    // Check if Pear.config and storage are available
    // Try multiple ways to access Pear storage
    let storagePath = null;

    if (typeof Pear !== "undefined") {
      // Try Pear.config.storage first (standard way)
      if (Pear.config && Pear.config.storage) {
        storagePath = Pear.config.storage;
        console.log("Using Pear.config.storage:", storagePath);
      }
      // Try alternative storage access methods
      else if (Pear.storage) {
        storagePath = Pear.storage;
        console.log("Using Pear.storage:", storagePath);
      }
      // Try accessing storage through Pear API
      else if (typeof Pear.getStorage === "function") {
        try {
          storagePath = await Pear.getStorage();
          console.log("Using Pear.getStorage():", storagePath);
        } catch (err) {
          console.warn("Pear.getStorage() failed:", err);
        }
      }
    }

    if (storagePath) {
      try {
        // Initialize Corestore with Pear's storage
        store = new Corestore(storagePath);

        // Initialize Hyperdrive for peer-to-peer file system operations
        // Using a unique name for this drive
        drive = new Hyperdrive(store, "translations-drive");

        // Wait for Hyperdrive to be ready
        await drive.ready();

        // Get the drive key for reference
        const driveKey = drive.key.toString("hex");
        console.log("Hyperdrive initialized successfully");
        console.log("Drive key:", driveKey);
        console.log("You can share this drive using: hyper://" + driveKey);

        hyperdriveInitialized = true;
        return true;
      } catch (initError) {
        console.error("Error initializing Hyperdrive with storage:", initError);
        hyperdriveInitialized = true;
        return false;
      }
    } else {
      console.warn(
        "Pear storage not available. Tried: Pear.config.storage, Pear.storage, Pear.getStorage()"
      );
      console.warn("Will use local file fallback");
      hyperdriveInitialized = true; // Mark as initialized to prevent retries
      return false;
    }
  } catch (error) {
    console.error("Error initializing Hyperdrive:", error);
    hyperdriveInitialized = true; // Mark as initialized to prevent retries
    return false;
  }
}

// ============================================================================
// DATA MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Loads the translations.json file into Hyperdrive
 *
 * This function demonstrates the Hyperdrive upload workflow:
 * 1. Reads the local translations.json file
 * 2. Converts it to a buffer
 * 3. Uploads it to Hyperdrive using drive.put()
 * 4. The file is now stored in the peer-to-peer filesystem and can be shared
 *
 * Once uploaded, the file can be retrieved by other peers using the drive key
 * or accessed locally using drive.get()
 *
 * @returns {Promise<void>}
 */
async function loadTranslationsIntoDrive() {
  // Only load if not already loaded
  if (translationsLoaded) {
    return;
  }

  // Try to initialize Hyperdrive
  const hyperdriveAvailable = await initializeHyperdrive();

  // If Hyperdrive is not available, skip loading into it
  if (!hyperdriveAvailable || !drive) {
    console.log("Skipping Hyperdrive load, will use local file");
    translationsLoaded = true; // Mark as loaded to prevent retries
    return;
  }

  try {
    // Ensure Hyperdrive is ready
    await drive.ready();

    // Read the local translations.json file
    // In a real Pear app, this would be bundled or available at runtime
    const response = await fetch("./translations.json");
    const translationsData = await response.json();

    // Ensure b4a is loaded
    if (!b4a) {
      await loadHyperdriveModules();
    }

    // Convert JSON to string and then to buffer for Hyperdrive
    const translationsString = JSON.stringify(translationsData, null, 2);
    const translationsBuffer = b4a.from(translationsString, "utf-8");

    // Write the translations data to Hyperdrive
    // This uploads the JSON file to the Hyperdrive filesystem
    await drive.put("translations.json", translationsBuffer);

    // Wait for the write to complete
    await drive.flush();

    translationsLoaded = true;
    console.log("✅ Translations successfully uploaded to Hyperdrive!");
    console.log("File path in Hyperdrive: translations.json");

    // Get the drive key for sharing
    if (drive.key) {
      const driveKey = drive.key.toString("hex");
      console.log("Drive key:", driveKey);
      console.log("Share URL: hyper://" + driveKey + "/translations.json");
    }
  } catch (error) {
    console.error("Error loading translations into Hyperdrive:", error);
    // Fallback: we'll use the local file directly if Hyperdrive fails
    translationsLoaded = true; // Mark as loaded to prevent retries
  }
}

/**
 * Retrieves translation data from Hyperdrive or falls back to local file
 *
 * This function demonstrates the Hyperdrive retrieval workflow:
 * 1. First attempts to read from Hyperdrive using drive.get()
 * 2. If the file exists in Hyperdrive, it's retrieved and parsed
 * 3. If Hyperdrive is unavailable or file not found, falls back to local file
 *
 * The Hyperdrive approach allows the data to be:
 * - Stored in a peer-to-peer filesystem
 * - Shared with other peers using the drive key
 * - Retrieved from the distributed network
 *
 * @returns {Promise<Object>} The translations object containing language mappings
 */
async function getTranslationsFromDrive() {
  // Try to initialize Hyperdrive
  const hyperdriveAvailable = await initializeHyperdrive();

  // If Hyperdrive is available, try to read from it
  if (hyperdriveAvailable && drive) {
    try {
      // Ensure Hyperdrive is ready
      await drive.ready();

      // Read the translations.json file from Hyperdrive
      // This retrieves the JSON file from the Hyperdrive filesystem
      const translationsBuffer = await drive.get("translations.json");

      if (translationsBuffer) {
        // Ensure b4a is loaded
        if (!b4a) {
          await loadHyperdriveModules();
        }

        // Convert buffer to string and parse JSON
        const translationsString = b4a.toString(translationsBuffer, "utf-8");
        const translations = JSON.parse(translationsString);
        console.log("✅ Translations successfully retrieved from Hyperdrive!");
        console.log("File retrieved from: translations.json in Hyperdrive");
        updateDataSource("Data source: Hyperdrive (P2P)");
        return translations;
      } else {
        console.warn("File not found in Hyperdrive, will try local fallback");
      }
    } catch (error) {
      console.warn(
        "Error reading from Hyperdrive, falling back to local file:",
        error
      );
    }
  }

  // Fallback: load from local file directly
  try {
    const response = await fetch("./translations.json");
    const translations = await response.json();
    console.log("Translations loaded from local file");
    updateDataSource("Data source: Local file (fallback)");
    return translations;
  } catch (fallbackError) {
    console.error("Error loading local translations file:", fallbackError);
    updateDataSource("Data source: Error loading data");
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
    return "Translation data not available";
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

  return translatedWords.join(" ");
}

/**
 * Enhanced translation function that handles the full translation workflow
 * This function coordinates loading data from Hyperdrive and performing translation
 *
 * @param {string} text - The text to translate
 * @param {string} fromLang - Source language code
 * @param {string} toLang - Target language code
 * @returns {Promise<string>} The translated text
 */
async function performTranslation(text, fromLang, toLang) {
  // Validate input
  if (!text || text.trim().length === 0) {
    return "Please enter some text to translate";
  }

  // Load translations from Hyperdrive
  const translations = await getTranslationsFromDrive();

  if (!translations) {
    return "Error: Could not load translation data";
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
function updateOutput(text, className = "") {
  const outputElement = document.getElementById("outputText");
  outputElement.textContent = text;
  outputElement.className = className;
}

/**
 * Updates the data source indicator to show where translations are loaded from
 *
 * @param {string} source - The data source description
 */
function updateDataSource(source) {
  const dataSourceElement = document.getElementById("dataSource");
  if (dataSourceElement) {
    dataSourceElement.textContent = source;
  }
}

/**
 * Handles the translate button click event
 * This is the main entry point for the translation functionality
 */
async function handleTranslate() {
  // Get UI element values
  const sourceLang = document.getElementById("sourceLang").value;
  const targetLang = document.getElementById("targetLang").value;
  const inputText = document.getElementById("inputText").value;
  const translateBtn = document.getElementById("translateBtn");

  // Validate that languages are different
  if (sourceLang === targetLang) {
    updateOutput(
      "Please select different source and target languages",
      "error"
    );
    return;
  }

  // Validate that input text is provided
  if (!inputText || inputText.trim().length === 0) {
    updateOutput("Please enter some text to translate", "error");
    return;
  }

  // Disable button and show loading state
  translateBtn.disabled = true;
  updateOutput("Translating...", "loading");

  try {
    // Perform the translation
    const translatedText = await performTranslation(
      inputText,
      sourceLang,
      targetLang
    );

    // Display the result
    updateOutput(translatedText || "Translation not available");
  } catch (error) {
    console.error("Translation error:", error);
    updateOutput(
      "An error occurred during translation. Please try again.",
      "error"
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
 * Sets up event listeners and loads translation data into Hyperdrive
 */
async function initializeApp() {
  console.log("Initializing Pear Translate Application...");

  // Load translations into Hyperdrive
  await loadTranslationsIntoDrive();

  // Set up translate button event listener
  const translateBtn = document.getElementById("translateBtn");
  translateBtn.addEventListener("click", handleTranslate);

  // Allow translation on Enter key press in textarea
  const inputText = document.getElementById("inputText");
  inputText.addEventListener("keydown", (event) => {
    // Check for Ctrl+Enter or Cmd+Enter to trigger translation
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleTranslate();
    }
  });

  console.log("Application initialized successfully");
}

// Start the application when the DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  // DOM is already ready
  initializeApp();
}
