# Changelog

All notable changes to the PageSwipe project are documented in this file.

Format: Each entry includes the change description and affected files.

**For planned features, see [ROADMAP.md](./ROADMAP.md)**

---

## [2026-01-22]

### Added

- **Premium Public Share Pages** - Redesigned shared list and club invite pages for marketing conversion
  - Shared list page: Immersive gradient hero, animated floating particles, 3D book card hover effects
  - Club invite page: "You're invited!" hero, animated rings, shimmer effect on join code
  - 404 page: Animated floating books illustration with marketing pitch
  - Feature highlights and trust badges to encourage sign-ups
  - Staggered fade-in animations on book grids
  - Full dark mode support
  - Mobile-first responsive design
  - (files: `functions/index.js`)

- **Rapid Barcode Scanning (Web)** - Restored and enhanced barcode scanning functionality to match iOS
  - Full-screen immersive scanner view on mobile
  - Continuous scanning mode (camera doesn't stop between scans)
  - 3-second debouncing per ISBN to prevent duplicate scans
  - "Recently Scanned" horizontal scrollable list showing last 10 books
  - Session count badge ("X books added this session")
  - Auto-adds books to library as owned (no confirmation modal)
  - Toast notifications for success/already owned/not found/library full
  - Flash toggle button for device torch
  - Exit confirmation showing books scanned count
  - (files: `PageSwipe Web/app.html`, `PageSwipe Web/js/app.js`, `PageSwipe Web/css/app.css`)

- **Premium Profile Page Redesign (Web)** - Complete redesign of the profile view
  - Immersive gradient header with animated pattern background
  - Premium avatar with animated gradient ring and glow effect
  - Beautiful stat cards with icons and hover animations
  - Reading Journey achievement teaser card
  - Stunning Pro upgrade card with floating orbs and shine animation
  - Full dark mode support
  - Mobile-responsive design
  - (files: `PageSwipe Web/app.html`, `PageSwipe Web/css/app.css`, `PageSwipe Web/js/app.js`)

- **Premium "How it Works" Redesign (Landing Page)** - Complete redesign of the landing page section
  - 3D perspective sign-in card mockup for Step 1
  - Stacked swipe card interface for Step 2
  - Book club card with member avatars for Step 3
  - Floating animated notification badges
  - Alternating left/right layout
  - Full responsive and dark mode support
  - (files: `PageSwipe Web/index.html`)

- **Upgrade Button Navigation** - All upgrade buttons now navigate to premium.html
  - Profile upgrade button
  - Library limit upgrade buttons
  - Premium upgrade prompts
  - (files: `PageSwipe Web/app.html`, `PageSwipe Web/js/app.js`)

- **Footer Navigation Links** - Fixed placeholder links in landing page footer
  - Pricing → premium.html
  - FAQ → faq.html
  - Privacy Policy → privacy.html
  - Terms of Service → terms.html
  - (files: `PageSwipe Web/index.html`)

- **Library Genre Filter (iOS + Web)** - Filter books in My Books view by genre
  - Horizontal scrollable genre filter pills below the read/unread status filters
  - Dynamically extracts genres from user's owned books (only shows genres that exist)
  - Normalizes messy API genres (e.g., "Fiction / Thrillers" → "Thrillers")
  - Works alongside existing search and read/unread filters
  - Purple gradient styling to visually distinguish from coral status filters
  - Shows book count badge for each genre
  - "All Genres" option to clear filter
  - (files: `PageSwipe/Views/Library/MyBooksView.swift`, `PageSwipe Web/js/app.js`, `PageSwipe Web/app.html`, `PageSwipe Web/css/app.css`)

- **Genre/Categories fields on BookItem** - Extended BookItem model for genre filtering
  - Added `genre: String?` - Primary genre from Google Books API
  - Added `categories: [String]?` - All categories from Google Books API
  - Updated CodingKeys, initializers, and Firestore decoder
  - DataManager now populates genre data when adding books to library
  - (files: `PageSwipe/Models/Models.swift`, `PageSwipe/Services/DataManager.swift`, `ECOSYSTEM.md`)

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

- **ISBN metadata enhancement (Cloud Function)** - Centralized book metadata enhancement for better cover images and descriptions
  - Added `enhanceBookData()` to Cloud Function - searches Google Books by title+author when initial lookup returns sparse data
  - Added `validateOpenLibraryCover()` - validates cover images, detects 404s and placeholders
  - Added `titlesMatch()` with fuzzy matching (Levenshtein distance) for better edition matching
  - Added `scoreEdition()` - ranks editions by metadata completeness (+2 cover, +2 description, +1 pageCount, +1 ratings)
  - iOS and Web now rely on Cloud Function for enhancement (client-side kept as fallback)
  - (files: `functions/index.js`, `PageSwipe/PageSwipe/Services/BookLookupService.swift`, `PageSwipe Web/js/book-lookup.js`)

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
