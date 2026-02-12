# Bayaan Documentation

Welcome to the Bayaan Quran Audio App documentation. This directory contains comprehensive guides, architecture documentation, and development resources.

## 📚 Table of Contents

### Getting Started
- [Main README](../README.md) - Project overview and quick start
- [App Initialization](development/app-initialization.md) - App startup process and lifecycle

### Development

#### Workflow & Guidelines
- [Claude AI Instructions](development/claude.md) - AI coding assistant guidelines
- [Git Workflow](development/git-workflow.md) - Branching, commits, and collaboration

#### Features
- [Downloads](features/downloads.md) - Offline download functionality and performance optimizations
- [Player](features/player.md) - Audio player architecture and usage
- [Queue Management](features/queue.md) - Queue system and track management
- [Reciter Profiles](features/reciter-profile.md) - Reciter profile components
- [Digital Khatt](features/digital-khatt/README.md) - Full Uthmani Mushaf rendering implementation and debugging guide

### Architecture

- [Playback Migration](architecture/playback-migration.md) - Player system migration guide
- [Authentication Removal](architecture/auth-removal.md) - Auth system removal documentation

### Deployment

- [Deployment Guide](deployment/deployment.md) - EAS Build and deployment procedures
- [Version Management](deployment/version-management.md) - App versioning and build numbers

### Testing

- [Download Testing](testing/download-testing.md) - Comprehensive download feature testing guide

## 🔍 Quick Links

### Most Common Tasks

**Development:**
- Setting up the development environment → [Main README](../README.md)
- Understanding app initialization → [App Initialization](development/app-initialization.md)
- Following git workflow → [Git Workflow](development/git-workflow.md)

**Features:**
- Implementing downloads → [Downloads Documentation](features/downloads.md)
- Working with the player → [Player Documentation](features/player.md)
- Managing playback queue → [Queue Documentation](features/queue.md)

**Deployment:**
- Building for production → [Deployment Guide](deployment/deployment.md)
- Managing versions → [Version Management](deployment/version-management.md)

**Testing:**
- Testing downloads → [Download Testing Guide](testing/download-testing.md)

## 📁 Documentation Structure

```
docs/
├── README.md                           # This file - Documentation index
│
├── development/                        # Development guides
│   ├── app-initialization.md          # App startup and lifecycle
│   ├── claude.md                       # AI assistant guidelines
│   └── git-workflow.md                 # Git best practices
│
├── features/                           # Feature documentation
│   ├── downloads.md                    # Download system (comprehensive)
│   ├── digital-khatt/                  # Digital Khatt implementation docs
│   │   ├── README.md                   # Hub and reading order
│   │   ├── architecture.md             # Ownership and lifecycle
│   │   ├── data-pipeline.md            # SQLite to in-memory flow
│   │   ├── rendering-pipeline.md       # React -> Skia rendering path
│   │   ├── justification-engine.md     # Kashida/feature internals
│   │   ├── debugging-playbook.md       # Symptom-based debugging
│   │   ├── development-guide.md        # Safe change workflow
│   │   └── glossary.md                 # Terminology
│   ├── player.md                       # Audio player
│   ├── queue.md                        # Queue management
│   └── reciter-profile.md              # Reciter profiles
│
├── architecture/                       # Architecture docs
│   ├── playback-migration.md           # Player migration
│   └── auth-removal.md                 # Auth removal history
│
├── deployment/                         # Deployment guides
│   ├── deployment.md                   # Build & deploy
│   └── version-management.md           # Versioning
│
└── testing/                            # Testing guides
    └── download-testing.md             # Download feature tests
```

## 🎯 Documentation by Role

### For New Developers

1. Start with [Main README](../README.md) for project setup
2. Read [App Initialization](development/app-initialization.md) to understand startup
3. Review [Git Workflow](development/git-workflow.md) for collaboration
4. Explore feature docs based on your work area

### For Feature Development

**Downloads:**
- [Downloads Documentation](features/downloads.md) - Complete guide with API reference
- [Download Testing](testing/download-testing.md) - Testing procedures

**Player:**
- [Player Documentation](features/player.md) - Player architecture
- [Queue Documentation](features/queue.md) - Queue management
- [Playback Migration](architecture/playback-migration.md) - Migration history

**Mushaf (Uthmani / Digital Khatt):**
- [Digital Khatt Hub](features/digital-khatt/README.md) - Full architecture and implementation map
- [Debugging Playbook](features/digital-khatt/debugging-playbook.md) - Fast troubleshooting workflow

**UI Components:**
- [Reciter Profiles](features/reciter-profile.md) - Profile components

### For DevOps/Release Management

1. [Deployment Guide](deployment/deployment.md) - Complete deployment procedures
2. [Version Management](deployment/version-management.md) - Versioning system
3. [Git Workflow](development/git-workflow.md) - Release branching

### For QA/Testing

1. [Download Testing](testing/download-testing.md) - Download feature test cases
2. Feature documentation for understanding functionality
3. [App Initialization](development/app-initialization.md) - App lifecycle

## 🔧 Tech Stack Quick Reference

### Core Technologies
- **Framework:** React Native (0.76.9) with Expo (52.0.25)
- **Navigation:** Expo Router (4.0.20)
- **State Management:** Zustand (4.5.5)
- **Audio:** React Native Track Player (4.1.1)
- **Storage:** AsyncStorage, Expo SQLite
- **Styling:** StyleSheet, React Native Size Matters

### Key Libraries
- **UI:** @gorhom/bottom-sheet, react-native-reanimated
- **Gestures:** react-native-gesture-handler
- **Images:** react-native-fast-image
- **i18n:** react-i18next

For complete dependencies, see [package.json](../package.json)

## 📖 Documentation Standards

### Writing Documentation

When adding or updating documentation:

1. **Use Clear Headers:** Organize with H2, H3 hierarchy
2. **Code Examples:** Provide working TypeScript examples
3. **Cross-References:** Link to related documentation
4. **Keep Updated:** Update docs when code changes
5. **Test Examples:** Ensure code examples are tested and work

### File Naming

- Use lowercase with hyphens: `feature-name.md`
- Be descriptive: `download-testing.md` not `test.md`
- Group by category in subdirectories

### Markdown Style

```markdown
# Page Title (H1 - only one per file)

## Main Section (H2)

Brief description of the section.

### Subsection (H3)

Content with examples:

\`\`\`typescript
// Clear, working code examples
const example = 'value';
\`\`\`

**Important notes** in bold.

- Bullet points for lists
- Keep them concise
```

## 🤝 Contributing to Documentation

1. Create documentation for new features
2. Update existing docs when refactoring
3. Add examples and use cases
4. Keep API references current
5. Test code examples before committing

## 🔗 External Resources

### Expo Documentation
- [Expo Docs](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)

### React Native
- [React Native Docs](https://reactnative.dev/)
- [React Native Track Player](https://react-native-track-player.js.org/)

### State Management
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)

## 📝 Need Help?

- Check the relevant documentation section above
- Search for keywords in documentation files
- Review code examples in feature docs
- Check the [Main README](../README.md) for setup issues

## 🔄 Recent Updates

- **2024-11:** Download performance optimization and testing documentation
- **2024-11:** Documentation reorganization and structure
- **2024-10:** Version management system documentation
- **2024-09:** Playback migration documentation

---

**Note:** This documentation is actively maintained. If you find errors or areas for improvement, please update the relevant files and commit your changes.

