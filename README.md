# Pear Translate

A simple Pear application that simulates text translation between English, Spanish, and French using mock data stored in Hyperdrive.

## Features

- 🌐 Translate text between English, Spanish, and French
- 📦 Uses Hyperdrive for peer-to-peer data storage
- 🎨 Clean, modern UI with gradient design
- 💾 Mock translation data stored in shared Hyperdrive filesystem

## Prerequisites

- Node.js installed
- Pear CLI installed (`npm install -g @pear/cli`)

## Installation

1. Install dependencies:

```bash
npm install
```

## Running the Application

To run the application in development mode:

```bash
npm start
```

Or directly with Pear:

```bash
pear run -d .
```

## How It Works

1. **Hyperdrive Integration**: The application attempts to use Hyperdrive to store and retrieve translation data in a peer-to-peer filesystem. Due to native module compatibility with the Pear runtime, it may fall back to using the local file.
2. **Mock Translation Data**: Translations are stored in `translations.json` and loaded into Hyperdrive on initialization (if available), otherwise used directly from the local file
3. **Translation Logic**: The app performs word-by-word translation using the mock data dictionary
4. **UI**: Simple interface with language selectors, text input, and translation output
5. **Fallback Mechanism**: If Hyperdrive modules fail to load, the app gracefully falls back to using the local `translations.json` file, ensuring the app remains functional

## Project Structure

```
pear-translate/
├── index.html          # Main HTML interface
├── index.js            # Application logic with Hyperdrive integration
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

## Usage

1. Select the source language (From)
2. Select the target language (To)
3. Enter text in the text area
4. Click "Translate" or press Ctrl/Cmd + Enter
5. View the translated text in the output area

## Technologies

- **Pear**: Framework for building peer-to-peer applications
- **Hyperdrive**: Peer-to-peer filesystem for data storage
- **Corestore**: Efficient storage and replication of Hypercores
- **Bare Ecosystem**: Runtime environment for Pear applications

## Notes

- This is a mock translation app using predefined word mappings
- Translation works best with single words or common phrases
- Words not in the dictionary will remain untranslated
- **Hyperdrive Compatibility**: Hyperdrive modules may fail to load in some Pear runtime environments due to native dependency compatibility. The app handles this gracefully by falling back to the local `translations.json` file. The UI will indicate the data source being used.
