# Changelog

All notable changes to the PageSwipe project are documented in this file.

Format: Each entry includes the change description and affected files.

---

## [2026-01-20]

### Added

- **Git awareness for session persistence** - PM can now reconstruct project context across session boundaries
  - Added reconstruction checklist using Git commands
  - Added branch strategy documentation
  - (files: `.claude/agents/project-manager.md`, `.claude/templates/AGENT-SYSTEM-SETUP.md`)

- **Product Designer agent** - Elite strategic advisor for feature planning
  - Advises on product decisions, UX architecture, best practices
  - Works with stakeholder and PM during planning BEFORE implementation
  - Does NOT write code - strategic guidance only
  - (files: `.claude/agents/product-designer.md`, `.claude/agents/project-manager.md`)

- **Frontend-designer integration for platform agents** - Platform developers now explicitly defer UI work to frontend-designer
  - ios-developer: Added "UI Work Goes to Frontend Designer" section, clarified scope to business logic only
  - web-developer: Added "UI Work Goes to Frontend Designer" section, clarified scope to business logic only
  - (files: `.claude/agents/ios-developer.md`, `.claude/agents/web-developer.md`, `.claude/agents/firebase-developer.md`)

- **Multi-agent project management system** - Hierarchical agent architecture for coordinated development
  - `project-manager.md` - Orchestrator agent (delegates, validates, documents)
  - `frontend-designer.md` - Elite UI/UX specialist for iOS + Web
  - `ios-developer.md` - iOS/Swift business logic specialist
  - `web-developer.md` - Web/JavaScript business logic specialist
  - `firebase-developer.md` - Backend/Cloud Functions specialist
  - (files: `.claude/agents/`)

- **ISBN metadata enhancement for iOS** - When barcode scan returns sparse data, system now searches by title+author to find better cover/description
  - Added `enhanceBookData(book:originalIsbn:)` method
  - Integrated into `lookupBook(isbn:)` and `lookupDirectly(isbn:)`
  - Matches existing Web implementation
  - (files: `PageSwipe/PageSwipe/Services/BookLookupService.swift`)

- **Premium feature gating on Web** - Free users now blocked from creating custom lists and clubs at UI level
  - Added `canCreateList()` and `canCreateClub()` functions
  - Added `handleOpenCreateListModal()` and `handleOpenCreateClubModal()` wrappers
  - Shows upgrade prompt instead of opening modal for free users
  - (files: `PageSwipe Web/js/db-service.js`, `PageSwipe Web/js/app.js`)

- **User preferences tracking on Web** - Matching iOS implementation for personalized discovery
  - Added `loadUserPreferences()`, `saveUserPreferences()`, `trackBookInteraction()`
  - Added interaction scoring system matching iOS
  - (files: `PageSwipe Web/js/book-lookup.js`)

- **Book interaction recording on Web** - Tracks "not interested" swipes
  - Added `recordBookInteraction()`, `getBookInteraction()`
  - (files: `PageSwipe Web/js/book-lookup.js`)

- **Discovery history on Web** - Prevents re-showing recently viewed books
  - Added `loadDiscoveryHistory()`, `saveToDiscoveryHistory()`, `cleanupDiscoveryHistory()`
  - 30-day TTL matching iOS
  - (files: `PageSwipe Web/js/book-lookup.js`)

- **Auto-stats Cloud Function** - Automatically updates user's booksRead/currentlyReading counts
  - Triggers on item status changes
  - (files: `functions/index.js`)

- **Firestore security rules for userPreferences** - Users can read/write their own preferences
  - (files: `firestore.rules`)

- **Background preloading documentation** - Documented iOS and Web preloading behavior
  - (files: `ECOSYSTEM.md`)

### Changed

- **Removed "Currently Reading" as default list** - Now handled dynamically via ReadingStatus
  - Removed from `DEFAULT_LISTS` constant
  - Removed `ListType.reading` enum case
  - Updated all switch statements
  - (files: `PageSwipe Web/js/db-service.js`, `PageSwipe Web/js/auth-service.js`, `PageSwipe/PageSwipe/Services/AuthenticationManager.swift`, `PageSwipe/PageSwipe/Models/Models.swift`, `PageSwipe/PageSwipe/Views/Library/LibraryView.swift`)

- **Removed unused `favorites` ListType** - Was never implemented on either platform
  - (files: `PageSwipe/PageSwipe/Models/Models.swift`, `PageSwipe/PageSwipe/Views/Library/LibraryView.swift`)

### Fixed

- **Web premium gating** - UI now checks premium status BEFORE opening create list/club modals
  - Previously allowed free users to open modal, only blocked on submit
  - (files: `PageSwipe Web/js/app.js`)

---

## [Unreleased]

### Added

### Changed

### Fixed

### Removed
