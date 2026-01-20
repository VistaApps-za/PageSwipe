# PageSwipe Ecosystem Specification

> **The North Star Document**
> Single source of truth for iOS, Web, and Firebase implementations.
> All platforms MUST adhere to these specifications.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Firestore Collections](#firestore-collections)
3. [Data Models](#data-models)
4. [Enums & Constants](#enums--constants)
5. [Cloud Functions](#cloud-functions)
6. [User Preferences System](#user-preferences-system)
7. [Premium & Subscription](#premium--subscription)
8. [Discovery System](#discovery-system)
9. [Authentication](#authentication)
10. [Security Rules](#security-rules)
11. [Naming Conventions](#naming-conventions)

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐
│    iOS App      │     │    Web App      │
│    (Swift)      │     │  (JavaScript)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   Firebase Backend    │
         │  ┌─────────────────┐  │
         │  │   Firestore     │  │
         │  │   (Database)    │  │
         │  └─────────────────┘  │
         │  ┌─────────────────┐  │
         │  │ Cloud Functions │  │
         │  │  (API Layer)    │  │
         │  └─────────────────┘  │
         │  ┌─────────────────┐  │
         │  │    Storage      │  │
         │  │ (Profile Photos)│  │
         │  └─────────────────┘  │
         └───────────────────────┘
                     │
         ┌───────────▼───────────┐
         │     RevenueCat        │
         │  (Subscriptions)      │
         └───────────────────────┘
```

---

## Firestore Collections

### Top-Level Collections

| Collection | Description | Document ID |
|------------|-------------|-------------|
| `users` | User profiles and settings | Firebase Auth UID |
| `userPreferences` | Personalization data (genre/author scores) | Firebase Auth UID |
| `books` | Global book catalog cache | ISBN or Google Books ID |
| `lists` | User's book lists | Auto-generated or `{userId}_{listType}` |
| `items` | Books within lists | Auto-generated |
| `clubs` | Book clubs | Auto-generated |
| `reviews` | Book reviews | Auto-generated |
| `bookInteractions` | Tracks "not interested" swipes | ISBN |

### Subcollections

| Path | Description |
|------|-------------|
| `users/{userId}/discoveryHistory/{isbn}` | Books shown to user (30-day TTL) |
| `clubs/{clubId}/members/{userId}` | Club membership data |
| `clubs/{clubId}/books/{bookId}` | Books added to club |
| `clubs/{clubId}/activity/{activityId}` | Club activity feed |
| `clubs/{clubId}/bookSelections/{selectionId}` | Book selection history |
| `bookInteractions/{isbn}/users/{userId}` | User's interaction with specific book |

---

## Data Models

### User

```typescript
interface User {
  id: string;                    // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL: string | null;
  authProvider: AuthProvider;    // 'email' | 'apple' | 'google'
  isPro: boolean;                // Premium subscription status
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Stats (auto-updated by Cloud Function)
  booksRead: number;             // Count of books with status 'read'
  currentlyReading: number;      // Count of books with status 'reading'

  // Onboarding
  hasCompletedOnboarding: boolean;

  // Club memberships (denormalized)
  joinedClubs: JoinedClub[];

  // Optional
  settings?: UserSettings;
  reviewCount?: number;
  subscriptionUpdatedAt?: Timestamp;
}

interface JoinedClub {
  clubId: string;
  clubName: string;
  role: 'owner' | 'member';
  joinedAt: Timestamp;
}

interface UserSettings {
  // App-specific settings
}
```

### UserPreferences

```typescript
interface UserPreferences {
  userId: string;
  genreScores: Record<string, number>;    // genre -> score
  authorScores: Record<string, number>;   // author -> score
  avgPageCount: number | null;
  preferredPageRange: PageRange | null;
  totalInteractions: number;
  positiveInteractions: number;
  negativeInteractions: number;
  skippedTitles: string[];                // Normalized titles to filter out
  lastUpdated: Timestamp | null;
}

type PageRange = 'short' | 'medium' | 'long' | 'epic';
// short: < 200 pages
// medium: 200-400 pages
// long: 400-600 pages
// epic: 600+ pages
```

### Book

```typescript
interface Book {
  id: string;                    // ISBN or API ID
  isbn: string | null;
  isbn13: string | null;
  ean: string | null;
  title: string;
  authors: string[];
  coverImageUrl: string | null;
  description: string | null;
  genre: string | null;
  categories: string[];
  pageCount: number | null;
  publishDate: string | null;
  publisher: string | null;
  language: string;              // Default: 'en'
  apiSource: string | null;      // 'googleBooks' | 'openLibrary'
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;

  // Aggregated data
  totalReaders: number | null;
  averageRating: number | null;
  ratingsCount: number | null;
}
```

### BookList

```typescript
interface BookList {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  description: string | null;
  bannerImageUrl: string | null;
  isPublic: boolean;
  shareCode: string;             // 6-character uppercase alphanumeric
  listType: ListType;
  isDefault: boolean;
  itemCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type ListType = 'toRead' | 'completed' | 'custom';
// NOTE: 'reading' and 'favorites' were removed - do not use
// "Currently Reading" is handled dynamically via ReadingStatus, not as a list
```

### BookItem

```typescript
interface BookItem {
  id: string;
  listId: string;
  userId: string;
  bookId: string;                // ISBN or book ID
  isbn: string;
  title: string;
  authors: string[];
  coverImageUrl: string | null;
  description: string | null;
  pageCount: number | null;
  status: ReadingStatus;
  liked: boolean;
  rating: number | null;         // 1-5
  notes: string | null;
  currentPage: number | null;
  startedReadingAt: Timestamp | null;
  finishedReadingAt: Timestamp | null;
  addedAt: Timestamp;
  updatedAt: Timestamp;
}

type ReadingStatus = 'unread' | 'reading' | 'read' | 'notInterested';
```

### Club

```typescript
interface Club {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  ownerId: string;
  ownerName: string;
  joinCode: string;              // 6-character uppercase alphanumeric
  isPublic: boolean;
  currentBookId: string | null;
  currentBookTitle: string | null;
  currentBookCoverUrl: string | null;
  currentBookStartDate: Timestamp | null;
  memberCount: number;
  booksCompleted: number;
  bookCount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### ClubMember

```typescript
interface ClubMember {
  id: string;                    // Same as userId
  userId: string;
  displayName: string;
  photoURL: string | null;
  role: 'owner' | 'member';
  joinedAt: Timestamp;
  currentBookStatus: BookStatus;
  currentBookProgress: number | null;

  // Stats
  booksAdded: number;            // Books this member has added
  booksInterested: number;       // Books this member showed interest in
}

type BookStatus = 'notStarted' | 'reading' | 'finished';
```

### ClubBook

```typescript
interface ClubBook {
  id: string;
  clubId: string;
  isbn: string;
  title: string;
  authors: string[];
  coverImageUrl: string | null;
  pageCount: number | null;
  description: string | null;
  addedBy: MemberInfo;
  addedAt: Timestamp;
  interestedMembers: MemberInfo[];
  notInterestedMembers?: MemberInfo[];
  notInterestedCount: number;
}

interface MemberInfo {
  userId: string;
  displayName: string;
  photoURL: string | null;
}
```

### ClubActivity

```typescript
interface ClubActivity {
  id: string;
  userId: string;
  userName: string;
  userPhotoUrl: string | null;
  type: ActivityType;
  bookId: string | null;
  bookTitle: string | null;
  bookCoverUrl: string | null;
  message: string | null;
  rating: number | null;
  createdAt: Timestamp;
}

type ActivityType =
  | 'joined'
  | 'addedBook'
  | 'interested'
  | 'addedToList'
  | 'startedBook'
  | 'finishedBook'
  | 'reviewedBook';
```

### BookReview

```typescript
interface BookReview {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL: string | null;
  bookId: string;
  isbn: string;
  bookTitle: string;
  bookCoverUrl: string | null;
  rating: number;                // 1-5
  reviewText: string | null;
  wouldRecommend: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  likes?: number;
  helpful?: number;
}
```

### BookInteraction

```typescript
// Document at: bookInteractions/{isbn}/users/{userId}
interface BookInteraction {
  interactionType: string;       // 'notInterested'
  timestamp: Timestamp;
  userId: string;
}
```

### DiscoveryHistory

```typescript
// Document at: users/{userId}/discoveryHistory/{isbn}
interface DiscoveryHistoryEntry {
  shownAt: Timestamp;
}
// Entries older than 30 days should be cleaned up
```

---

## Enums & Constants

### AuthProvider
```typescript
type AuthProvider = 'email' | 'apple' | 'google';
```

### ListType
```typescript
type ListType = 'toRead' | 'completed' | 'custom';
// NOTE: 'reading' removed - "Currently Reading" is handled via ReadingStatus
```

### ReadingStatus
```typescript
type ReadingStatus = 'unread' | 'reading' | 'read' | 'notInterested';
```

### InteractionType (for preference scoring)
```typescript
const INTERACTION_TYPES = {
  swipeRight:   { genrePoints:  1, authorPoints: 0 },
  swipeLeft:    { genrePoints: -1, authorPoints: 0 },
  addToList:    { genrePoints:  2, authorPoints: 0 },
  startReading: { genrePoints:  3, authorPoints: 1 },
  finishBook:   { genrePoints:  5, authorPoints: 3 },
  rateHighly:   { genrePoints:  3, authorPoints: 2 },  // 4-5 stars
  ratePoorly:   { genrePoints: -2, authorPoints: -1 }, // 1-2 stars
  abandonBook:  { genrePoints: -2, authorPoints: 0 }
};
```

### Discovery Genres
```typescript
const DISCOVERY_GENRES = [
  { id: 'random', label: 'Random' },
  { id: 'romance', label: 'Romance' },
  { id: 'thriller', label: 'Thriller' },
  { id: 'mystery', label: 'Mystery' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'scifi', label: 'Sci-Fi' },
  { id: 'horror', label: 'Horror' },
  { id: 'literary', label: 'Literary Fiction' },
  { id: 'historical', label: 'Historical Fiction' },
  { id: 'contemporary', label: 'Contemporary' },
  { id: 'youngadult', label: 'Young Adult' },
  { id: 'selfhelp', label: 'Self-Help' },
  { id: 'biography', label: 'Biography' },
  { id: 'business', label: 'Business' },
  { id: 'psychology', label: 'Psychology' },
  { id: 'truecrime', label: 'True Crime' }
];
```

### Default Lists
```typescript
const DEFAULT_LISTS = [
  { name: 'Want to Read', listType: 'toRead', isDefault: true },
  { name: 'Finished', listType: 'completed', isDefault: true }
];

// Default list IDs follow pattern: {userId}_{listType}
// Example: "abc123_toRead", "abc123_completed"

// NOTE: "Currently Reading" is NOT a default list.
// It is handled dynamically by querying BookItems with status: 'reading'
// via getCurrentlyReading() function. This shows reading progress per book.
```

### Share Code Format
```typescript
// 6 characters, uppercase alphanumeric (excluding confusing chars)
const SHARE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Excluded: I, O, 0, 1 (to avoid confusion)
```

---

## Cloud Functions

### `discoverBooks`

Callable function for book discovery.

**Request:**
```typescript
{
  genre: string;                 // Genre ID from DISCOVERY_GENRES
  excludeISBNs?: string[];       // ISBNs to exclude from results
  limit?: number;                // Default: 20
  userPreferences?: {
    genreScores: Record<string, number>;
    authorScores: Record<string, number>;
  };
}
```

**Response:**
```typescript
{
  success: boolean;
  books: Book[];
  genre: string;
}
```

### `lookupBook`

Callable function for ISBN/EAN lookup.

**Request:**
```typescript
{
  isbn: string;                  // ISBN-10, ISBN-13, or EAN
}
```

**Response:**
```typescript
{
  success: boolean;
  book: Book;
}
```

### `getDiscoveryGenres`

Callable function to get available genres.

**Response:**
```typescript
{
  success: boolean;
  genres: Array<{ id: string; label: string }>;
}
```

### `revenueCatWebhook`

HTTP endpoint for RevenueCat subscription events.

**Handled Events:**
- `INITIAL_PURCHASE` → `isPro = true`
- `RENEWAL` → `isPro = true`
- `UNCANCELLATION` → `isPro = true`
- `NON_RENEWING_PURCHASE` → `isPro = true`
- `CANCELLATION` → `isPro = false`
- `EXPIRATION` → `isPro = false`
- `BILLING_ISSUE` → `isPro = false`

### `updateUserStats`

Firestore trigger on `items/{itemId}` writes.

**Behavior:**
- Status → `read`: Increment `booksRead`
- Status → `reading`: Increment `currentlyReading`
- Status from `read`: Decrement `booksRead`
- Status from `reading`: Decrement `currentlyReading`
- Item deleted: Decrement appropriate counters

---

## User Preferences System

### How It Works

1. **Tracking**: Every book interaction updates genre and author scores
2. **Storage**: Preferences stored in `userPreferences/{userId}`
3. **Personalization**: Passed to `discoverBooks` for better recommendations
4. **Title Filtering**: Normalized titles stored to filter duplicate editions

### Scoring Rules

| Action | Genre Points | Author Points |
|--------|-------------|---------------|
| Swipe Right (interested) | +1 | 0 |
| Swipe Left (not interested) | -1 | 0 |
| Add to List | +2 | 0 |
| Start Reading | +3 | +1 |
| Finish Book | +5 | +3 |
| Rate 4-5 Stars | +3 | +2 |
| Rate 1-2 Stars | -2 | -1 |
| Abandon Book | -2 | 0 |

### Title Normalization

For filtering duplicate editions:
1. Convert to lowercase
2. Remove content after: `:`, ` - `, ` – `, ` — `, `(`, `[`
3. Remove articles: "the", "a", "an"
4. Trim whitespace

### Minimum Data for Personalization

```typescript
hasEnoughData = totalInteractions >= 5 && Object.keys(genreScores).length > 0
```

---

## Premium & Subscription

### Premium Limits

| Feature | Free | Pro |
|---------|------|-----|
| Default Lists | 2 (toRead, completed) | 2 |
| Custom Lists | 0 | Unlimited |
| Create Clubs | No | Yes |
| Join Clubs | Yes | Yes |
| Discovery | Yes | Yes |
| All other features | Yes | Yes |

> **Note:** "Currently Reading" is not a list - it's a dynamic view of books with `status: 'reading'`

### Checking Premium Status

```typescript
// User document field
isPro: boolean  // true = premium subscriber

// Always check this field before allowing:
// - Creating custom lists (listType: 'custom')
// - Creating clubs
```

### Premium Check Functions

**iOS:**
```swift
// LibraryView.swift
var canCreateList: Bool {
    let isPro = authManager.userProfile?.isPro ?? false
    return isPro || customListCount < 1  // Note: limit is 0, so only Pro can create
}

// ClubsView.swift
var canCreateClub: Bool {
    authManager.userProfile?.isPro ?? false
}
```

**Web:**
```javascript
// db-service.js
async function canCreateList(userId) { ... }
async function canCreateClub(userId) { ... }
```

---

## Discovery System

### Flow

1. User selects genre (or 'random')
2. Load discovery history (last 30 days)
3. Load user preferences
4. Call `discoverBooks` Cloud Function with:
   - Selected genre
   - Excluded ISBNs (from history + library)
   - User preferences (for personalization)
5. Filter results by:
   - Discovery history
   - Skipped titles (from preferences)
   - Books already in user's lists
6. Display results
7. On swipe:
   - Track interaction (update preferences)
   - Save to discovery history
   - If "not interested": record in `bookInteractions`

### Discovery History

- Stored in: `users/{userId}/discoveryHistory/{isbn}`
- TTL: 30 days
- Purpose: Prevent re-showing recently seen books
- Cleanup: On app launch or periodically

### Background Preloading

Both iOS and Web implement background preloading for instant discovery experience.

#### iOS Preloading

**Trigger:** `DataManager.configure()` called on user login

**Process:**
1. `preloadDiscoveryBooks()` runs silently in background (no loading indicator)
2. Fetches "random" genre books via Cloud Function
3. Precaches all cover images for instant display

**When user opens Discover tab:**
- If preloaded books available (for "random" genre): Used instantly, no loading
- If preload hasn't finished or different genre selected: Normal loading with indicator

**Key Features:**
- Silent loading - no overlay shown during preload
- Cover images precached for instant rendering
- Only "random" genre preloaded (most common first view)
- Graceful fallback to normal loading if preload incomplete

#### Web Preloading

**Trigger:** User login/authentication complete

**Process:**
1. Discovery books preloaded silently after login
2. Card components pre-rendered before user clicks Discover
3. Books cached and ready for instant display

**When user clicks Discover:**
- If preload complete: Books appear immediately
- If preload in progress: Normal loading with indicator

**Key Features:**
- Silent loading - no loading overlay during preload
- Pre-rendered cards - UI components built ahead of time
- Instant access - zero perceived latency when preload complete
- Fallback - normal loading if preload hasn't finished

#### Implementation Notes

| Aspect | iOS | Web |
|--------|-----|-----|
| Trigger | `DataManager.configure()` | Auth state change |
| Genre Preloaded | "random" only | "random" only |
| Image Caching | Native image cache | Browser cache |
| Card Pre-rendering | No | Yes |
| Loading Indicator | Hidden during preload | Hidden during preload |

**Why only "random" genre?**
- Most users start with random discovery
- Preloading all 16 genres would be wasteful
- Other genres load on-demand when selected

---

## Authentication

### Supported Providers

1. **Email/Password** (`authProvider: 'email'`)
2. **Sign in with Apple** (`authProvider: 'apple'`)
3. **Google Sign-In** (`authProvider: 'google'`)

### User Creation Flow

1. Firebase Auth creates authentication record
2. App creates Firestore user document with:
   - Basic profile info
   - `isPro: false`
   - `booksRead: 0`
   - `currentlyReading: 0`
   - `hasCompletedOnboarding: false`
3. App creates default lists (toRead, completed)

---

## Security Rules

### Summary

| Collection | Read | Write |
|------------|------|-------|
| `users/{userId}` | Owner only | Owner only |
| `users/{userId}/discoveryHistory/*` | Owner only | Owner only |
| `userPreferences/{userId}` | Owner only | Owner only |
| `books/*` | Anyone | Cloud Functions only |
| `lists/*` | Owner or if public | Owner only |
| `items/*` | Authenticated | Owner only |
| `clubs/*` | Anyone | Owner only |
| `clubs/*/members/*` | Anyone | Member or Owner |
| `clubs/*/activity/*` | Anyone | Authenticated (create only) |
| `clubs/*/books/*` | Anyone | Authenticated |
| `bookInteractions/*/users/{userId}` | Anyone | Owner only |
| `reviews/*` | Anyone | Owner only |

---

## Naming Conventions

### Field Names

- Use **camelCase** for all field names
- Use **past tense** for timestamps: `createdAt`, `updatedAt`, `addedAt`, `joinedAt`
- Use **present tense** for status: `isPublic`, `isPro`, `isDefault`
- Prefix booleans with `is`, `has`, `can`: `isPro`, `hasCompletedOnboarding`

### Collection Names

- Use **lowercase plural**: `users`, `books`, `lists`, `items`, `clubs`, `reviews`
- Subcollections use **camelCase**: `discoveryHistory`, `bookInteractions`

### ID Formats

| Entity | ID Format |
|--------|-----------|
| User | Firebase Auth UID |
| Default List | `{userId}_{listType}` |
| Custom List | Auto-generated |
| Book (cache) | ISBN or API ID |
| Item | Auto-generated |
| Club | Auto-generated |
| Club Member | User ID |
| Review | Auto-generated |

### Share Codes

- 6 characters
- Uppercase alphanumeric
- Excluding: I, O, 0, 1
- Example: `A3K9WZ`

---

## File Locations

### iOS
```
PageSwipe/
├── Models/
│   └── Models.swift              # All data models and enums
├── Services/
│   ├── AuthenticationManager.swift
│   ├── DataManager.swift         # Firestore operations
│   ├── DiscoveryService.swift    # Book discovery
│   └── BookLookupService.swift   # ISBN lookup
└── Views/
    ├── Library/
    │   └── LibraryView.swift     # Lists management
    ├── Clubs/
    │   └── ClubsView.swift       # Clubs management
    └── Profile/
        └── PaywallView.swift     # Premium upgrade
```

### Web
```
PageSwipe Web/
└── js/
    ├── firebase-config.js        # Firebase initialization
    ├── auth-service.js           # Authentication
    ├── db-service.js             # Firestore operations + premium checks
    └── book-lookup.js            # Discovery, preferences, interactions
```

### Firebase
```
functions/
└── index.js                      # All Cloud Functions

firestore.rules                   # Security rules
```

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-20 | 1.0.0 | Initial ecosystem specification |
| 2026-01-20 | 1.1.0 | Added background preloading documentation for iOS and Web |
| 2026-01-20 | 1.2.0 | Removed "Currently Reading" as default list - now handled via ReadingStatus |

---

## Checklist for New Features

When adding new features, ensure:

- [ ] Field names match across iOS and Web
- [ ] Firestore security rules updated
- [ ] Cloud Functions added if needed
- [ ] Premium gating applied if feature is Pro-only
- [ ] This document updated with new models/enums
- [ ] Both platforms tested with same test data
