# Bayaan - Quran Audio App

[![Expo Version](https://img.shields.io/badge/Expo-^52.0.0-blue.svg)](https://expo.dev/)
[![React Native Version](https://img.shields.io/badge/React%20Native-0.76.9-blue.svg)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-^5.3.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-UNLICENSED-lightgrey.svg)](./LICENSE) <!-- Update if license changes -->

Bayaan is a cross-platform mobile application built with React Native and Expo, designed to provide users with an accessible and feature-rich experience for listening to Quranic recitations.

## ✨ Features

*   Browse and listen to various Quran reciters.
*   Audio playback controls with background audio support (`react-native-track-player`).
*   Dark/Light mode support (`userInterfaceStyle: automatic`).
*   Smooth animations and gestures (`react-native-reanimated`, `moti`).
*   Intuitive navigation using Expo Router.
*   State management with Zustand.
*   Internationalization support (`i18next`).
*   Fuzzy search capabilities (`fuse.js`).
*   Customizable UI elements (`@rneui/themed`, `expo-linear-gradient`, `expo-blur`).

## 🚀 Tech Stack

*   **Framework:** React Native / Expo SDK 52
*   **Language:** TypeScript
*   **Navigation:** Expo Router v4
*   **State Management:** Zustand
*   **Audio Player:** `react-native-track-player`
*   **UI Components:** `@rneui/themed`, `react-native-gesture-handler`, `react-native-reanimated`, `moti`
*   **Styling:** StyleSheet, possibly custom themes
*   **Internationalization:** `i18next`, `react-i18next`
*   **Linting/Formatting:** ESLint, Prettier
*   **Testing:** Jest / `jest-expo`
*   **Build/Deployment:** Expo Application Services (EAS)

## 
 prerequisites

*   Node.js (LTS version recommended)
*   Yarn (preferred package manager) and npm (both are used in this project)
*   Expo CLI: `npm install -g expo-cli`
*   Watchman (for macOS): `brew install watchman`
*   Development Environment Setup: Follow the [React Native Environment Setup](https://reactnative.dev/docs/environment-setup) guide for your specific OS. For Expo development, you might primarily need Node.js, Yarn, and the Expo Go app on your device/simulator.

## 📦 Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd Bayaan
    ```
2.  **Install dependencies:** (Yarn is preferred, but both lockfiles exist)
    ```bash
    # Using Yarn (preferred)
    yarn install 
    
    # Or using npm
    npm install 
    ```
3.  **Set up environment variables:**
    Create a `.env` file in the root directory and add any necessary environment variables (e.g., API keys). Refer to `.env.example` if available or required configuration steps.

## ▶️ Running the App

1.  **Start the Metro bundler:**
    ```bash
    # Using Yarn
    yarn start
    
    # Using npm
    npm start 
    # or
    # npx expo start
    ```
    This will start the Expo development server.
2.  **Run on a device or simulator:**
    *   **iOS:** Press `i` in the terminal or scan the QR code with the Expo Go app on your iOS device.
    *   **Android:** Press `a` in the terminal or scan the QR code with the Expo Go app on your Android device.
    *   **Web:** Press `w` in the terminal (experimental support).

## 🛠️ Available Scripts

You can run the following scripts using either `yarn <script_name>` or `npm run <script_name>`:

*   `start`: Starts the Expo development server.
*   `android`: Builds the app and runs it on an Android emulator/device (requires native build setup).
*   `ios`: Builds the app and runs it on an iOS simulator/device (requires native build setup, macOS only).
*   `web`: Starts the Expo development server for web.
*   `test`: Runs tests using Jest in watch mode.
*   `lint`: Lints the codebase using ESLint.
*   `lint:fix`: Lints the codebase and automatically fixes issues.
*   `format`: Formats the code using Prettier.
*   `generate-reciter-images`: Custom script to generate reciter images.
*   `fetch-reciters`: Custom script to fetch reciter data.
*   `version:patch|minor|major`: Bumps the app version using a custom script.

## 📁 Folder Structure (Overview)

```
Bayaan/
├── app/               # Expo Router screens and layouts
│   ├── (auth)/        # Authentication screens
│   ├── (tabs)/        # Main tab-based screens
│   ├── services/      # Route-specific services
│   └── _layout.tsx    # Root layout component
├── assets/            # Static assets (images, fonts)
├── components/        # Reusable UI components
├── constants/         # Constant values used across the app
├── contexts/          # React Context providers (if any beyond Zustand)
├── data/              # Static data files
├── hooks/             # Custom React hooks
├── services/          # Global API services/utilities
├── store/             # Zustand state management stores
├── styles/            # Global styles or themes
├── theme/             # Theme configuration
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── scripts/           # Helper scripts for development tasks
├── app.json           # Expo configuration file
├── babel.config.js    # Babel configuration
├── eas.json           # EAS Build configuration
├── package.json       # Project dependencies and scripts
└── tsconfig.json      # TypeScript configuration
```

## 🤝 Contributing

Contributions are welcome! Please follow the standard fork, branch, and pull request workflow. Ensure your code adheres to the project's linting and formatting rules.

## 📄 License

This project is currently unlicensed. <!-- Update if a license file (e.g., LICENSE.md) exists or is added -->
