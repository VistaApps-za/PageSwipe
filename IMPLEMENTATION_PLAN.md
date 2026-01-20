# PageSwipe - Master Implementation Plan

> **Status**: Planning Phase
> **Last Updated**: January 2026
> **App Name**: PageSwipe
> **Bundle ID**: `com.vista.pageswipe` (MUST be consistent everywhere)
> **Domain**: pageswipe.tech
> **Reference App**: My Gift Box (`/Users/westhomson/Desktop/My Gift Box`)

---

## Table of Contents
1. [Overview](#overview)
2. [App Name Research](#app-name-research)
3. [Tech Stack](#tech-stack)
4. [Architecture Overview](#architecture-overview)
5. [Data Model](#data-model)
6. [Core Features](#core-features)
7. [API Integrations](#api-integrations)
8. [File Structure](#file-structure)
9. [Implementation Phases](#implementation-phases)
10. [Reference Files from My Gift Box](#reference-files-from-my-gift-box)
11. [Future Considerations](#future-considerations)

---

## Overview

A book sharing and book club app for iOS and Web, allowing users to:
- Create and manage book lists
- Discover books via Tinder-style swipe gestures
- Add books by scanning barcodes (EAN/ISBN) with auto-populated data
- Create and join book clubs
- Share lists with friends and see who else has read/liked books
- Track reading progress and stats

**Target Users**: Book lovers, book clubs, couples/friends who want to share reading recommendations.

**Monetization**: Freemium model
- **Free**: 1 book list, join existing clubs
- **Premium**: Unlimited lists, create clubs, advanced reading stats

---

## App Name ✓ COMPLETE

**PageSwipe** - CONFIRMED (January 2026)

| Check | Status |
|-------|--------|
| App Store | ✓ Clear - no conflicts |
| Domain | ✓ pageswipe.tech available |
| Social Media | TBD - secure handles |

**Why PageSwipe**:
- Describes the swipe-to-discover feature perfectly
- "Page" = books/reading
- "Swipe" = the Tinder-style interaction
- Easy to spell, memorable, unique

---

## Tech Stack

### Platforms
| Platform | Technology | Notes |
|----------|------------|-------|
| iOS | SwiftUI (iOS 16+) | Primary platform, matches My Gift Box |
| Web | HTML/CSS/JavaScript | Vanilla JS with Firebase SDK |
| Backend | Firebase | Auth, Firestore, Storage, Functions |

### Services
| Service | Purpose | Cost |
|---------|---------|------|
| Firebase Auth | User authentication | Free tier sufficient |
| Firestore | Database | Free tier: 50K reads, 20K writes/day |
| Firebase Storage | Images (covers, profiles) | Free tier: 5GB |
| Cloud Functions | Book lookup, webhooks | Free tier: 2M invocations/month |
| RevenueCat | Subscription management | Free up to $2.5K MTR |
| Open Library API | Book data lookup | Free, no key required |
| Google Books API | Fallback book lookup | Free tier: 1000 req/day |

### Auth Providers
- Email/Password
- Apple Sign-In (required for iOS App Store)
- Google Sign-In

### Critical Identifiers (MUST be consistent everywhere)
| Identifier | Value |
|------------|-------|
| **Bundle ID** | `com.vista.pageswipe` |
| **App Group** | `group.com.vista.pageswipe` |
| **Keychain Group** | `com.vista.pageswipe` |
| **Firebase Project ID** | `pageswipe` |
| **Firebase Auth Domain** | `pageswipe.firebaseapp.com` |
| **Firebase Storage** | `pageswipe.firebasestorage.app` |
| **RevenueCat App ID** | TBD |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTS                              │
├─────────────────────────┬───────────────────────────────────┤
│      iOS App            │           Web App                  │
│      (SwiftUI)          │       (HTML/CSS/JS)                │
└───────────┬─────────────┴─────────────┬─────────────────────┘
            │                           │
            └───────────┬───────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    FIREBASE SERVICES                         │
├─────────────────────────────────────────────────────────────┤
│  Authentication          Firestore           Storage         │
│  - Email/Password        - users             - Profile pics  │
│  - Apple Sign-In         - books (cache)     - Book covers   │
│  - Google OAuth          - lists             - Club banners  │
│                          - items                             │
│                          - clubs                             │
│                          - bookInteractions                  │
├─────────────────────────────────────────────────────────────┤
│                    CLOUD FUNCTIONS                           │
│  - lookupBook (ISBN → book data)                            │
│  - joinClub (validation + member add)                       │
│  - revenueCatWebhook (subscription status)                  │
└───────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                   EXTERNAL APIS                              │
├─────────────────────────────────────────────────────────────┤
│  Open Library API (Primary)    Google Books API (Fallback)  │
│  - Free, no auth required      - Free tier with API key     │
│  - ISBN lookup                 - ISBN lookup                 │
│  - Cover images                - Cover images                │
│  - Author, description         - Full metadata               │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Firestore Collections

#### `users/{userId}`
User profiles and preferences.

```javascript
{
  email: string,
  displayName: string,
  photoURL: string | null,
  authProvider: "email" | "apple" | "google",
  isPro: boolean,                    // Premium subscriber
  createdAt: timestamp,
  updatedAt: timestamp,

  // Denormalized for quick access
  savedSharedLists: [{
    id: string,
    name: string,
    ownerName: string,
    savedAt: timestamp
  }],
  joinedClubs: [{
    clubId: string,
    clubName: string,
    role: "owner" | "admin" | "member",
    joinedAt: timestamp
  }],

  // Stats
  booksRead: number,
  currentlyReading: number
}
```

#### `books/{bookId}`
Global book catalog (cached from APIs to reduce API calls).

```javascript
{
  isbn: string,                      // Primary identifier
  isbn13: string | null,
  ean: string | null,
  title: string,
  authors: [string],
  coverImageUrl: string | null,
  description: string | null,
  genre: string | null,
  categories: [string],
  pageCount: number | null,
  publishDate: string | null,
  publisher: string | null,
  language: string,

  // Metadata
  apiSource: "openLibrary" | "googleBooks" | "manual",
  createdAt: timestamp,
  updatedAt: timestamp,

  // Aggregated stats (updated periodically)
  totalReaders: number,
  averageRating: number
}
```

#### `lists/{listId}`
Book lists/collections created by users.

```javascript
{
  name: string,
  ownerId: string,
  ownerName: string,
  description: string | null,
  bannerImageUrl: string | null,

  // Sharing
  isPublic: boolean,
  shareCode: string,                 // 6-char alphanumeric (e.g., "ABC123")

  // Type
  listType: "reading" | "favorites" | "toRead" | "completed" | "custom",
  isDefault: boolean,                // System-created default list

  // Counts
  itemCount: number,

  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `items/{itemId}`
Individual books within lists.

```javascript
{
  // References
  listId: string,
  userId: string,
  bookId: string,                    // Reference to books collection

  // Denormalized book data (for offline/quick access)
  isbn: string,
  title: string,
  authors: [string],
  coverImageUrl: string | null,
  pageCount: number | null,

  // User-specific data
  status: "unread" | "reading" | "read" | "notInterested",
  liked: boolean,
  rating: number | null,             // 1-5
  notes: string | null,              // Personal notes

  // Reading progress
  currentPage: number | null,
  startedReadingAt: timestamp | null,
  finishedReadingAt: timestamp | null,

  // Metadata
  addedAt: timestamp,
  updatedAt: timestamp
}
```

#### `clubs/{clubId}`
Book clubs.

```javascript
{
  name: string,
  description: string | null,
  coverImageUrl: string | null,

  // Ownership
  ownerId: string,
  ownerName: string,

  // Joining
  joinCode: string,                  // 6-char alphanumeric
  isPublic: boolean,                 // Discoverable in search

  // Current book
  currentBookId: string | null,
  currentBookTitle: string | null,
  currentBookCoverUrl: string | null,
  currentBookStartDate: timestamp | null,

  // Stats
  memberCount: number,
  booksCompleted: number,

  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `clubs/{clubId}/members/{userId}`
Club membership.

```javascript
{
  userId: string,
  displayName: string,
  photoURL: string | null,
  role: "owner" | "admin" | "member",
  joinedAt: timestamp,

  // Current book progress
  currentBookStatus: "notStarted" | "reading" | "finished",
  currentBookProgress: number | null  // Page number
}
```

#### `clubs/{clubId}/bookSelections/{selectionId}`
History of books the club has read.

```javascript
{
  bookId: string,
  isbn: string,
  title: string,
  coverImageUrl: string | null,

  addedBy: string,
  addedByName: string,

  status: "current" | "completed" | "upcoming",
  startDate: timestamp | null,
  endDate: timestamp | null,

  // Discussion
  discussionDate: timestamp | null,

  createdAt: timestamp
}
```

#### `clubs/{clubId}/activity/{activityId}`
Club activity feed.

```javascript
{
  userId: string,
  userName: string,
  userPhotoUrl: string | null,

  type: "joined" | "finished" | "started" | "addedBook" | "comment" | "rated",

  // Optional context
  bookId: string | null,
  bookTitle: string | null,
  message: string | null,
  rating: number | null,

  createdAt: timestamp
}
```

#### `bookInteractions/{isbn}/users/{userId}`
Tracks who has read/liked each book (for social features).

```javascript
{
  userId: string,
  displayName: string,
  photoURL: string | null,

  status: "read" | "reading" | "liked" | "notInterested",
  rating: number | null,

  interactedAt: timestamp
}
```

### Firestore Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "items",
      "fields": [
        { "fieldPath": "listId", "order": "ASCENDING" },
        { "fieldPath": "addedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "items",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "addedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "members",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "activity",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users - only owner can read/write
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Books - anyone can read (public catalog), only functions can write
    match /books/{bookId} {
      allow read: if true;
      allow write: if false; // Only Cloud Functions
    }

    // Lists - owner can write, public lists readable by anyone
    match /lists/{listId} {
      allow read: if resource.data.isPublic == true ||
                    (request.auth != null && resource.data.ownerId == request.auth.uid);
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null &&
                              resource.data.ownerId == request.auth.uid;
    }

    // Items - owner can CRUD
    match /items/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
                     request.resource.data.userId == request.auth.uid;
    }

    // Clubs - public readable, owner/admin can write
    match /clubs/{clubId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
                      resource.data.ownerId == request.auth.uid;

      match /members/{memberId} {
        allow read: if true;
        allow write: if request.auth != null;
      }

      match /activity/{activityId} {
        allow read: if true;
        allow create: if request.auth != null;
      }

      match /bookSelections/{selectionId} {
        allow read: if true;
        allow write: if request.auth != null;
      }
    }

    // Book interactions - anyone authenticated can read/write their own
    match /bookInteractions/{isbn}/users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Core Features

### 1. Book Lists & Library

**User Stories**:
- As a user, I can create multiple book lists (Reading, Favorites, To Read, etc.)
- As a user, I can add books by scanning a barcode or searching
- As a user, I can see all my books organized by list
- As a user, I can move books between lists
- As a user, I can share a list via a shareable link

**Default Lists** (created on signup):
- "Currently Reading"
- "Want to Read"
- "Finished"

**Free Tier Limit**: 1 custom list (plus default lists)

### 2. Book Discovery (Swipe Interface)

**User Stories**:
- As a user, I see a stack of book cards I can swipe through
- Swipe LEFT = "Not interested" (skip, don't show again)
- Swipe RIGHT = "Add to reading list"
- As a user, I can tap a card to see more details before swiping
- As a user, I see visual feedback (icons/colors) while swiping

**Discovery Sources**:
- Popular books (aggregated from all users)
- Books from genres I've read
- Books friends have liked
- New releases (via API)

**SwiftUI Implementation**:
```swift
// Gesture handling
.gesture(
    DragGesture()
        .onChanged { value in
            offset = value.translation
            rotation = Double(value.translation.width / 20)
        }
        .onEnded { value in
            if value.translation.width < -threshold {
                // Swipe left - not interested
                markAsNotInterested()
            } else if value.translation.width > threshold {
                // Swipe right - add to list
                addToReadingList()
            } else {
                // Return to center
                withAnimation { offset = .zero }
            }
        }
)
```

### 3. Barcode Scanner (EAN/ISBN Lookup)

**User Stories**:
- As a user, I can scan a book's barcode with my camera
- The app automatically fetches book details (title, cover, author, etc.)
- As a user, I can manually enter an ISBN if scanning fails
- As a user, I can search by title/author as fallback

**Implementation**:
```swift
import AVFoundation

// Supported barcode types for books
metadataOutput.metadataObjectTypes = [.ean8, .ean13, .upce]

// Flow:
// 1. Camera captures barcode
// 2. Extract ISBN/EAN number
// 3. Call BookLookupService
// 4. Display book for confirmation
// 5. Add to selected list
```

### 4. Book Clubs

**User Stories**:
- As a user, I can create a book club with a name and description
- As a user, I get a 6-character join code to share
- As a user, I can join a club by entering a code
- As a club owner, I can set the "current book" everyone should read
- As a member, I can see other members and their progress
- As a member, I can see an activity feed (who finished, who joined, etc.)

**Free Tier Limit**: Can join clubs, cannot create clubs

**Join Code Generation**:
```javascript
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

### 5. Social Features

**User Stories**:
- As a user, I can see who else has read a book
- As a user, I can see if friends liked/disliked a book
- As a user, I can share my reading list publicly
- As a user, I can save someone else's shared list

**"Who Read This" Display**:
- Show avatars of users who read this book
- Show aggregate stats (X people read, Y% liked)
- If friends read it, highlight them

### 6. Reading Progress & Stats

**User Stories**:
- As a user, I can update my current page while reading
- As a user, I can mark a book as "finished"
- As a user, I can see my reading stats (books this year, pages read, etc.)

**Stats to Track**:
- Books read (all time, this year, this month)
- Pages read
- Average books per month
- Favorite genres
- Longest streak

---

## API Integrations

### Open Library API (Primary)

**Base URL**: `https://openlibrary.org`

**ISBN Lookup**:
```
GET https://openlibrary.org/isbn/{isbn}.json
```

**Response**:
```json
{
  "title": "The Great Gatsby",
  "authors": [{ "key": "/authors/OL27349A" }],
  "number_of_pages": 180,
  "publish_date": "1925",
  "publishers": ["Scribner"],
  "description": { "value": "A story of the fabulously wealthy..." }
}
```

**Cover Image**:
```
https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg
```
Sizes: S (small), M (medium), L (large)

**Author Lookup** (for author names):
```
GET https://openlibrary.org/authors/{authorKey}.json
```

### Google Books API (Fallback)

**Base URL**: `https://www.googleapis.com/books/v1`

**ISBN Lookup**:
```
GET https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}
```

**Response**:
```json
{
  "items": [{
    "volumeInfo": {
      "title": "The Great Gatsby",
      "authors": ["F. Scott Fitzgerald"],
      "description": "A story of...",
      "pageCount": 180,
      "categories": ["Fiction"],
      "imageLinks": {
        "thumbnail": "https://..."
      },
      "publishedDate": "1925",
      "publisher": "Scribner"
    }
  }]
}
```

**Rate Limits**: 1000 requests/day (free tier)

### Cloud Function: `lookupBook`

Centralizes book lookup with caching:

```javascript
exports.lookupBook = functions.https.onCall(async (data, context) => {
  const { isbn } = data;

  // 1. Check Firestore cache
  const cached = await db.collection('books')
    .where('isbn', '==', isbn)
    .limit(1)
    .get();

  if (!cached.empty) {
    return { success: true, book: cached.docs[0].data(), source: 'cache' };
  }

  // 2. Try Open Library
  try {
    const book = await fetchFromOpenLibrary(isbn);
    await cacheBook(book);
    return { success: true, book, source: 'openLibrary' };
  } catch (e) {
    // Continue to fallback
  }

  // 3. Try Google Books
  try {
    const book = await fetchFromGoogleBooks(isbn);
    await cacheBook(book);
    return { success: true, book, source: 'googleBooks' };
  } catch (e) {
    return { success: false, error: 'Book not found' };
  }
});
```

---

## File Structure

### iOS App

**Bundle ID**: `com.vista.pageswipe`

```
PageSwipe/
├── PageSwipe.xcodeproj/
├── PageSwipe/
│   ├── PageSwipeApp.swift               # @main entry point
│   ├── ContentView.swift                # Root view with auth routing
│   ├── GoogleService-Info.plist         # Firebase config (Bundle ID: com.vista.pageswipe)
│   ├── Info.plist
│   ├── PageSwipe.entitlements           # Capabilities (App Groups: group.com.vista.pageswipe)
│   │
│   ├── Assets.xcassets/
│   │   ├── AppIcon.appiconset/
│   │   ├── Colors/                      # Brand colors
│   │   └── Images/                      # Static images
│   │
│   ├── Extensions/
│   │   ├── Colors.swift                 # Color definitions
│   │   ├── Fonts.swift                  # Typography
│   │   └── View+Extensions.swift        # View modifiers
│   │
│   ├── Models/
│   │   ├── Models.swift                 # Book, BookList, User, Club
│   │   ├── APIModels.swift              # OpenLibrary, GoogleBooks responses
│   │   └── Enums.swift                  # ReadingStatus, ListType, etc.
│   │
│   ├── Services/
│   │   ├── AuthenticationManager.swift  # Firebase Auth
│   │   ├── DataManager.swift            # Central data coordinator
│   │   ├── FirestoreManager.swift       # Firestore CRUD
│   │   ├── BookLookupService.swift      # ISBN → Book data
│   │   ├── BookClubManager.swift        # Club operations
│   │   ├── SocialService.swift          # Book interactions
│   │   ├── StorageService.swift         # Firebase Storage
│   │   └── SubscriptionManager.swift    # RevenueCat
│   │
│   └── Views/
│       ├── Auth/
│       │   ├── SignInView.swift
│       │   ├── SignUpView.swift
│       │   └── ProfileCompletionView.swift
│       │
│       ├── Home/
│       │   └── HomeView.swift           # Dashboard
│       │
│       ├── Discover/
│       │   ├── DiscoverView.swift       # Swipe stack
│       │   └── SwipeableBookCard.swift  # Draggable card
│       │
│       ├── Add/
│       │   ├── AddBookView.swift        # Entry point
│       │   ├── BarcodeScannerView.swift # Camera scanner
│       │   └── BookSearchView.swift     # Title/author search
│       │
│       ├── Library/
│       │   ├── LibraryView.swift        # All lists
│       │   ├── BookListView.swift       # Single list
│       │   └── BookDetailView.swift     # Book details
│       │
│       ├── Clubs/
│       │   ├── ClubsView.swift          # My clubs
│       │   ├── ClubDetailView.swift     # Single club
│       │   ├── CreateClubView.swift
│       │   └── JoinClubView.swift
│       │
│       ├── Profile/
│       │   ├── ProfileView.swift
│       │   ├── ReadingStatsView.swift
│       │   └── SettingsView.swift
│       │
│       ├── Shared/
│       │   ├── BookCard.swift           # Reusable book card
│       │   ├── BookRow.swift            # List row
│       │   ├── LoadingView.swift
│       │   └── EmptyStateView.swift
│       │
│       └── Premium/
│           └── PaywallView.swift
│
├── PageSwipeTests/
└── PageSwipeUITests/
```

### Web App

```
PageSwipe Web/
├── index.html                   # Landing page
├── app.html                     # Main app (after auth)
├── dashboard.html               # User dashboard
├── list.html                    # View/manage lists
├── shared-list.html             # Public shared list view
├── book.html                    # Book detail page
├── clubs.html                   # Clubs listing
├── club.html                    # Single club view
├── profile.html                 # User profile
├── premium.html                 # Subscription page
│
├── css/
│   ├── styles.css               # Main styles
│   └── components.css           # Reusable components
│
├── js/
│   ├── app.js                   # Main app logic
│   ├── firebase-config.js       # Firebase init
│   ├── db-service.js            # Firestore wrapper
│   ├── auth-service.js          # Auth functions
│   ├── book-lookup.js           # ISBN lookup
│   └── utils.js                 # Helpers
│
└── images/
    └── (static assets)
```

### Cloud Functions

```
functions/
├── index.js                     # All function exports
├── package.json
├── .eslintrc.js
│
├── src/
│   ├── lookupBook.js            # ISBN → book data
│   ├── joinClub.js              # Club join with validation
│   ├── webhooks/
│   │   └── revenueCat.js        # Subscription webhooks
│   └── utils/
│       ├── openLibrary.js       # Open Library API
│       └── googleBooks.js       # Google Books API
│
└── test/
    └── lookupBook.test.js
```

### Project Root

```
PageSwipe/
├── IMPLEMENTATION_PLAN.md       # This document
├── CHANGELOG.md                 # Version history (create when shipping)
├── README.md                    # Project overview (create later)
│
├── PageSwipe/                   # iOS app (Xcode project)
├── PageSwipe Web/               # Web app
├── functions/                   # Cloud Functions
│
├── firebase.json                # Firebase deployment config
├── firestore.rules              # Security rules
├── firestore.indexes.json       # Database indexes
├── storage.rules                # Storage security rules
└── .firebaserc                  # Firebase project binding
```

---

## Implementation Phases

### Phase 0: Setup & Name Research ✓ COMPLETE
**Goal**: Establish project foundation

- [x] Research app names (App Store + domain availability)
- [x] Finalize app name → **PageSwipe**
- [ ] Purchase domain (pageswipe.tech)
- [x] Create Firebase project → `pageswipe`
- [x] Enable Firestore Database
- [x] Enable Firebase Storage
- [x] Enable Authentication (Email, Google, Apple)
- [x] Register iOS app (com.vista.pageswipe)
- [x] Register Web app
- [x] Download GoogleService-Info.plist to project
- [ ] Set up RevenueCat account (later)
- [x] Create Xcode project with folder structure
- [x] Add Firebase SDK (SPM)
- [x] Configure Firebase initialization
- [x] Create web project structure
- [ ] Initialize Git repository

**Deliverable**: ✓ Project builds and runs with Firebase connected

---

### Phase 1: Authentication
**Goal**: Users can sign up/in across platforms

**iOS Tasks**:
- [ ] Port `AuthenticationManager` from My Gift Box
- [ ] Implement email/password auth
- [ ] Add Apple Sign-In
- [ ] Add Google Sign-In
- [ ] Create auth UI (SignIn, SignUp views)
- [ ] Implement auth state routing in ContentView

**Web Tasks**:
- [ ] Set up Firebase SDK
- [ ] Port auth logic from My Gift Box Web
- [ ] Create login/signup pages
- [ ] Implement auth state persistence

**Reference Files**:
- `/My Gift Box/MyGiftBox/Services/AuthenticationManager_Production.swift`
- `/My Gift Box/MyGiftBox Web/app.js` (auth sections)

**Deliverable**: Users can create accounts and log in on both platforms

---

### Phase 2: Data Models & Firestore
**Goal**: Core data layer working

**Tasks**:
- [ ] Define Swift models (Book, BookList, Item, User, Club)
- [ ] Port `FirestoreManager` from My Gift Box
- [ ] Implement `DataManager` for sync coordination
- [ ] Set up real-time listeners
- [ ] Write Firestore security rules
- [ ] Create indexes
- [ ] Port `db-service.js` for web

**Reference Files**:
- `/My Gift Box/MyGiftBox/Models/Models.swift`
- `/My Gift Box/MyGiftBox/FirestoreManager.swift`
- `/My Gift Box/MyGiftBox/Services/DataManager.swift`
- `/My Gift Box/MyGiftBox Web/db-service.js`

**Deliverable**: Can read/write all data types to Firestore

---

### Phase 3: Book Lookup Service
**Goal**: Add books via ISBN/barcode

**iOS Tasks**:
- [ ] Implement `BookLookupService`
- [ ] Add Open Library API integration
- [ ] Add Google Books API fallback
- [ ] Build `BarcodeScannerView` (AVFoundation)
- [ ] Create `AddBookView` UI
- [ ] Implement book search by title/author

**Cloud Functions**:
- [ ] Create `lookupBook` function
- [ ] Implement caching to Firestore
- [ ] Add rate limiting

**Web Tasks**:
- [ ] Implement book lookup in JS
- [ ] Create add book UI (manual ISBN entry)

**Deliverable**: Users can scan/enter ISBN and add books to their library

---

### Phase 4: Book Lists & Library
**Goal**: Users can organize books into lists

**iOS Tasks**:
- [ ] Create default lists on signup
- [ ] Build `LibraryView` (all lists)
- [ ] Build `BookListView` (single list)
- [ ] Build `BookDetailView`
- [ ] Implement add/remove/move book functions
- [ ] Add share code generation
- [ ] Implement shared list viewing

**Web Tasks**:
- [ ] Build library page
- [ ] Build list detail page
- [ ] Implement shared list page

**Deliverable**: Full list management on both platforms

---

### Phase 5: Swipe Discovery
**Goal**: Tinder-style book discovery

**iOS Tasks**:
- [ ] Build `SwipeableBookCard` with gesture handling
- [ ] Create `DiscoverView` with card stack
- [ ] Implement swipe left (not interested)
- [ ] Implement swipe right (add to list)
- [ ] Add visual feedback (icons, colors)
- [ ] Add haptic feedback
- [ ] Implement discovery algorithm (popular, genre-based)

**Deliverable**: Working swipe interface on iOS

---

### Phase 6: Book Clubs
**Goal**: Users can create and join clubs

**iOS Tasks**:
- [ ] Implement `BookClubManager`
- [ ] Build `ClubsView` (my clubs list)
- [ ] Build `ClubDetailView`
- [ ] Build `CreateClubView`
- [ ] Build `JoinClubView`
- [ ] Implement join code system
- [ ] Add "current book" selection
- [ ] Build activity feed

**Cloud Functions**:
- [ ] Create `joinClub` function with validation

**Web Tasks**:
- [ ] Build clubs listing page
- [ ] Build club detail page
- [ ] Implement join flow

**Deliverable**: Full club functionality on both platforms

---

### Phase 7: Social Features
**Goal**: See who else has read/liked books

**Tasks**:
- [ ] Implement `SocialService` / `bookInteractions` tracking
- [ ] Add "Who read this" to BookDetailView
- [ ] Show reading stats on books
- [ ] Implement "friends who read" (if adding friends feature)

**Deliverable**: Social reading visibility

---

### Phase 8: Subscriptions
**Goal**: Freemium monetization

**iOS Tasks**:
- [ ] Set up RevenueCat SDK
- [ ] Port `SubscriptionManager` from My Gift Box
- [ ] Build `PaywallView`
- [ ] Implement free tier limits
- [ ] Add premium feature gates

**Cloud Functions**:
- [ ] Set up RevenueCat webhook
- [ ] Update user `isPro` flag on subscription changes

**Web Tasks**:
- [ ] Build premium page
- [ ] Implement Stripe checkout (via RevenueCat web)

**Reference Files**:
- `/My Gift Box/MyGiftBox/Services/SubscriptionManager.swift`
- `/My Gift Box/functions/index.js` (revenueCatWebhook)

**Deliverable**: Working subscription flow

---

### Phase 9: Polish & Launch Prep
**Goal**: Production-ready app

**Tasks**:
- [ ] Add pull-to-refresh everywhere
- [ ] Implement empty states
- [ ] Add loading states
- [ ] Error handling and user feedback
- [ ] Offline support (Firestore caching)
- [ ] Performance optimization
- [ ] App Store screenshots
- [ ] App Store description
- [ ] Privacy policy
- [ ] Terms of service
- [ ] TestFlight beta testing

**Deliverable**: App ready for App Store submission

---

## Reference Files from My Gift Box

Quick reference to port code from:

| Component | My Gift Box File |
|-----------|------------------|
| Auth (iOS) | `MyGiftBox/Services/AuthenticationManager_Production.swift` |
| Data sync | `MyGiftBox/Services/DataManager.swift` |
| Firestore ops | `MyGiftBox/FirestoreManager.swift` |
| Models | `MyGiftBox/Models/Models.swift` |
| Colors/fonts | `MyGiftBox/Extensions/Colors.swift` |
| Storage | `MyGiftBox/Services/StorageService.swift` |
| Subscriptions | `MyGiftBox/Services/SubscriptionManager.swift` |
| Web DB | `MyGiftBox Web/db-service.js` |
| Web app | `MyGiftBox Web/app.js` |
| Cloud Functions | `functions/index.js` |
| Firestore rules | `firestore.rules` |

---

## Future Considerations

Features to potentially add later:

### Reading Challenges
- Set yearly reading goals
- Monthly challenges
- Achievements/badges

### Friends System
- Add friends by username/email
- See friends' reading activity
- Friend recommendations

### Book Reviews
- Write reviews for books
- See reviews from club members
- Aggregate ratings

### Reading Reminders
- Daily reading reminders
- Reading streaks
- Goal progress notifications

### Audiobook Support
- Track audiobooks separately
- Different progress tracking (time vs pages)

### Goodreads Import
- Import existing Goodreads library
- Sync reading status

### Browser Extension
- Add books from Amazon, bookstores
- Similar to My Gift Box Chrome extension

### AI Features
- Book recommendations based on reading history
- "Books like X" suggestions
- Reading pace predictions

---

## Notes & Decisions Log

Use this section to track key decisions made during development:

| Date | Decision | Rationale |
|------|----------|-----------|
| Jan 2026 | App name: **PageSwipe** | Clear on App Store, pageswipe.tech available, describes swipe feature |
| Jan 2026 | Bundle ID: `com.vista.pageswipe` | Must be consistent across iOS, Firebase, RevenueCat |
| Jan 2026 | Use Open Library as primary API | Free, no rate limits, good coverage |
| Jan 2026 | Freemium model (1 list free) | Matches My Gift Box monetization |
| Jan 2026 | iOS + Web from start | User requirement |
| | | |

---

*This is a living document. Update as the project evolves.*
