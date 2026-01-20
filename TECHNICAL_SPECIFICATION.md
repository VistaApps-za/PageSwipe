# PageSwipe - Technical Specification Document

## Overview

**PageSwipe** is a social book club and reading tracking iOS application. Users can discover books, create and manage reading lists, join book clubs with friends and family, and track their reading progress. The app learns user preferences over time to provide personalized book recommendations.

**Tagline:** "Create book clubs with friends & family"

---

## Tech Stack

### iOS App
- **Language:** Swift 5.0
- **UI Framework:** SwiftUI
- **Minimum iOS:** iOS 17+
- **Architecture:** MVVM with ObservableObject pattern

### Backend (Firebase)
- **Authentication:** Firebase Auth (Email, Apple Sign-In, Google Sign-In)
- **Database:** Cloud Firestore
- **Storage:** Firebase Storage (for future image uploads)
- **Functions:** Cloud Functions (for book lookups)

### External APIs
- **Google Books API** - Primary book data source
- **Open Library API** - Fallback book data source

---

## Firebase Configuration

```
Project ID: pageswipe
Bundle ID: com.vista.pageswipe
Storage Bucket: pageswipe.firebasestorage.app
```

### Firebase Services Used
1. **Authentication** - User sign-up/sign-in
2. **Firestore** - All data storage
3. **Cloud Functions** - ISBN lookup (optional, can fallback to direct API calls)

---

## Firestore Data Structure

### Collections

#### 1. `users/{userId}`
Stores user profile and stats.

```typescript
interface User {
  id: string;                    // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL?: string;
  authProvider: "email" | "apple" | "google";
  isPro: boolean;                // Premium subscription status
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Stats
  booksRead: number;
  currentlyReading: number;

  // Preferences
  hasCompletedOnboarding: boolean;
  genrePreferences?: string[];

  // Denormalized data
  savedSharedLists?: SavedList[];
  joinedClubs?: JoinedClub[];
}

interface SavedList {
  id: string;
  name: string;
  ownerName: string;
  savedAt: Timestamp;
}

interface JoinedClub {
  clubId: string;
  clubName: string;
  role: "owner" | "admin" | "member";
  joinedAt: Timestamp;
}
```

#### 2. `lists/{listId}`
Stores book lists/collections.

```typescript
interface BookList {
  id: string;
  name: string;
  ownerId: string;               // User ID who owns this list
  ownerName?: string;
  description?: string;
  bannerImageUrl?: string;
  isPublic: boolean;
  shareCode: string;             // 6-character code (e.g., "ABC123")
  listType: "reading" | "favorites" | "toRead" | "completed" | "custom";
  isDefault: boolean;            // System-created lists can't be deleted
  itemCount: number;             // Denormalized count
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Default Lists Created on Sign-up:**
1. "Currently Reading" (type: `reading`, isDefault: true)
2. "Want to Read" (type: `toRead`, isDefault: true)
3. "Finished" (type: `completed`, isDefault: true)

**Share Code Generation:**
```javascript
function generateShareCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 to avoid confusion
  return Array(6).fill(null).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
}
```

#### 3. `items/{itemId}`
Stores books added to lists (with user-specific data).

```typescript
interface BookItem {
  id: string;
  listId: string;                // Reference to parent list
  userId: string;                // User who added this item
  bookId: string;                // Reference to books collection or ISBN

  // Denormalized book data (for fast display)
  isbn: string;
  title: string;
  authors: string[];
  coverImageUrl?: string;
  description?: string;
  pageCount?: number;

  // User-specific data
  status: "unread" | "reading" | "read" | "notInterested";
  liked: boolean;
  rating?: number;               // 1-5 stars
  notes?: string;

  // Reading progress
  currentPage?: number;
  startedReadingAt?: Timestamp;
  finishedReadingAt?: Timestamp;

  addedAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 4. `books/{bookId}`
Global book catalog (cached from APIs).

```typescript
interface Book {
  id: string;
  isbn: string;
  isbn13?: string;
  ean?: string;
  title: string;
  authors: string[];
  coverImageUrl?: string;
  description?: string;
  genre?: string;
  categories?: string[];
  pageCount?: number;
  publishDate?: string;
  publisher?: string;
  language?: string;
  apiSource: "openLibrary" | "googleBooks" | "manual";
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Aggregated stats
  totalReaders?: number;
  averageRating?: number;
  ratingsCount?: number;
}
```

#### 5. `clubs/{clubId}`
Stores book clubs.

```typescript
interface Club {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  ownerId: string;
  ownerName: string;
  joinCode: string;              // 6-character code for joining
  isPublic: boolean;
  memberCount: number;           // Denormalized
  booksCompleted: number;

  // Current book being read
  currentBookId?: string;
  currentBookTitle?: string;
  currentBookCoverUrl?: string;
  currentBookStartDate?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 6. `clubs/{clubId}/members/{userId}`
Subcollection storing club members.

```typescript
interface ClubMember {
  id: string;                    // Same as userId
  userId: string;
  displayName: string;
  photoURL?: string;
  role: "owner" | "admin" | "member";
  joinedAt: Timestamp;

  // Current book progress
  currentBookStatus?: "notStarted" | "reading" | "finished";
  currentBookProgress?: number;  // Page number
}
```

#### 7. `clubs/{clubId}/activity/{activityId}`
Subcollection storing club activity feed.

```typescript
interface ClubActivity {
  id: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  type: "joined" | "finished" | "started" | "addedBook" | "comment" | "rated";
  bookId?: string;
  bookTitle?: string;
  message?: string;
  rating?: number;
  createdAt: Timestamp;
}
```

#### 8. `bookInteractions/{isbn}/users/{userId}`
Tracks who has read/interacted with each book (for social features).

```typescript
interface BookInteraction {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  status: "unread" | "reading" | "read" | "notInterested";
  rating?: number;
  interactedAt: Timestamp;
}
```

#### 9. `userPreferences/{userId}`
Stores learned preferences for recommendations.

```typescript
interface UserPreferences {
  userId: string;
  genreScores: Record<string, number>;    // Genre name -> score
  authorScores: Record<string, number>;   // Author name -> score
  avgPageCount?: number;
  preferredPageRange?: "short" | "medium" | "long" | "epic";
  totalInteractions: number;
  positiveInteractions: number;
  negativeInteractions: number;
  lastUpdated: Timestamp;
}
```

**Scoring System:**
```javascript
const interactionScores = {
  swipeRight:   { genre: +1, author: 0 },
  swipeLeft:    { genre: -1, author: 0 },
  addToList:    { genre: +2, author: 0 },
  startReading: { genre: +3, author: +1 },
  finishBook:   { genre: +5, author: +3 },
  rateHighly:   { genre: +3, author: +2 },  // 4-5 stars
  ratePoorly:   { genre: -2, author: -1 },  // 1-2 stars
  abandonBook:  { genre: -2, author: 0 }
};
```

---

## Authentication Flows

### Email/Password Sign-Up
1. User enters email, password, display name
2. `Auth.createUser(email, password)` creates Firebase Auth account
3. Create user document in `users/{uid}`
4. Create 3 default lists in `lists/` collection
5. Redirect to main app

### Email/Password Sign-In
1. User enters email, password
2. `Auth.signIn(email, password)`
3. Fetch user profile from `users/{uid}`
4. Configure DataManager with userId
5. Set up Firestore listeners

### Apple Sign-In
1. Generate nonce and SHA256 hash
2. Present Apple Sign-In sheet
3. Get Apple ID credential with identity token
4. Create Firebase credential: `OAuthProvider.appleCredential(idToken, rawNonce, fullName)`
5. `Auth.signIn(credential)`
6. If new user, create profile in `users/` and default lists
7. Note: Apple only provides name on first sign-in, store it immediately

### Google Sign-In
1. Use Google Sign-In SDK to get idToken and accessToken
2. Create Firebase credential: `GoogleAuthProvider.credential(idToken, accessToken)`
3. `Auth.signIn(credential)`
4. If new user, create profile and default lists

### Sign-Out
1. `Auth.signOut()`
2. Clear DataManager state
3. Remove Firestore listeners
4. Redirect to auth screen

---

## Features & User Flows

### 1. Home Screen (Dashboard)

**Purpose:** Overview of user's reading activity

**Components:**
- Greeting header with time-based message ("Good morning/afternoon/evening")
- Profile avatar linking to Profile screen
- Currently Reading section (books with status "reading")
- Quick Stats (Books Read, This Year)
- Your Clubs section (first 3 clubs)

**Data Sources:**
- `currentlyReadingItems` - Items where `status == "reading"` and `userId == currentUser`
- `completedBooksCount` - Count of items where `status == "read"`
- `clubs` - User's joined clubs

### 2. Discover Screen (Swipe Interface)

**Purpose:** Tinder-style book discovery

**UI Elements:**
- Stack of swipeable book cards
- Skip button (left swipe action)
- Like/Add button (right swipe action)
- Bookmark button (add to specific list)
- Refresh button

**Card Display:**
- Book cover (portrait, left side ~42% width)
- Title, Author, Page count
- Genre tag
- Description (up to 8 lines)
- Swipe indicators (heart/X icons) appear during swipe

**Swipe Actions:**
- **Swipe Left:** Mark as not interested, track negative interaction, remove card
- **Swipe Right:** Show list picker to add book, track positive interaction
- **Tap Bookmark:** Show list picker, add to selected list

**Recommendation Algorithm:**
1. Check if user has 5+ interactions
2. If yes: Fetch based on preferences
   - Get top 4 genres (weighted by score)
   - Get top 2 authors
   - Get genres to avoid (score < -3)
   - Fetch books matching preferences
   - Filter out avoided genres
   - Add 20% discovery/random books
3. If no: Fetch diverse mix from popular authors/bestsellers

**Book Search Queries (for new users):**
- Popular contemporary authors: "Colleen Hoover", "Taylor Jenkins Reid", "Emily Henry"
- Trending: "BookTok popular fiction", "Goodreads Choice Awards"
- Bestsellers: "New York Times bestseller fiction 2024"

**Book Quality Filters:**
- Must have cover image
- Must have description
- Prefer books from 2015+
- Sort by (averageRating * ratingsCount)

### 3. Library Screen

**Purpose:** Manage book lists and items

**Views:**
1. **List Overview** - Grid/list of all user's book lists
2. **List Detail** - Books in selected list
3. **Book Detail** - Single book with actions

**List Card Display:**
- Icon based on list type
- List name
- Item count
- Chevron indicator

**List Types & Icons:**
- reading: `book.fill`
- favorites: `heart.fill`
- toRead: `bookmark.fill`
- completed: `checkmark.circle.fill`
- custom: `folder.fill`

**List Actions:**
- Create new list (name only required)
- Delete list (non-default only)
- Share list via code

**Book Item Card Display:**
- Cover image (60x90)
- Title, Author
- Status indicator (colored dot + text)
- Progress (if reading): "50/350"
- Heart icon if liked

**Book Detail Screen:**
- Large cover (120x180)
- Title, Author, Page count
- Status badge
- Progress bar (if has page count)
- Page stepper (+/-) if currently reading
- Action buttons based on status:
  - Unread: "Start Reading"
  - Reading: "Update Progress", "Mark as Finished"
  - Read: "Finished Reading" (completed state)

### 4. Add Book Flow

**Methods:**
1. **Barcode Scanner** - Scan ISBN/EAN
2. **Manual Search** - Search by title/author

**Scanner Flow:**
1. Open camera
2. Detect barcode (AVMetadataObject types: .ean8, .ean13, .upce)
3. Extract ISBN/EAN
4. Call book lookup API
5. Display found book
6. Select list to add

**Search Flow:**
1. Enter query (title or author)
2. Call Google Books API
3. Display results
4. Tap book to select
5. Select list to add

**Book Lookup Priority:**
1. Check Firestore cache (`books` collection)
2. Try Cloud Function (if available)
3. Direct Open Library API call
4. Fallback to Google Books API

**API Endpoints:**
```
Open Library: https://openlibrary.org/isbn/{isbn}.json
Google Books: https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}
Google Books Search: https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=40&orderBy=relevance&printType=books&langRestrict=en
```

### 5. Clubs Screen

**Purpose:** Social book clubs

**Views:**
1. **Clubs List** - All joined clubs
2. **Club Detail** - Single club view
3. **Create Club** - New club form
4. **Join Club** - Enter join code

**Club Card Display:**
- Club avatar (first letter on gradient circle)
- Club name
- Current book (if set) or member count
- Chevron

**Create Club Flow:**
1. Enter club name (required)
2. Enter description (optional)
3. Submit
4. Auto-generate join code
5. Add creator as owner in members subcollection

**Join Club Flow:**
1. Enter 6-character code (auto-uppercase)
2. Query: `clubs where joinCode == code`
3. Check if already member
4. Add to members subcollection
5. Increment memberCount

**Club Detail Features:**
- Club info header
- Current book display
- Member list with progress
- Activity feed
- Set current book (owner/admin only)
- Share join code

### 6. Profile Screen

**Components:**
- Profile card (avatar, name, email)
- Reading stats (Read, Reading, Lists counts)
- Subscription card (Free/Pro status, upgrade button)
- Sign out button
- Settings sheet

**Settings:**
- Edit Profile
- Notifications
- Version info
- Privacy Policy
- Terms of Service

---

## Reading Progress Tracking

### Start Reading
1. User taps "Start Reading" on unread book
2. Update item: `status = "reading"`, `startedReadingAt = now`
3. Track interaction: `+3 genre`, `+1 author`
4. Refresh currently reading list

### Update Progress
1. User adjusts page number with +/- stepper
2. Update item: `currentPage = newPage`
3. Auto-complete if `currentPage >= pageCount`

### Finish Book
1. User taps "Mark as Finished"
2. Confirm dialog
3. Update item: `status = "read"`, `finishedReadingAt = now`
4. Track interaction: `+5 genre`, `+3 author`
5. Refresh stats (increment booksRead)

---

## Design System

### Colors (Hex)

```css
/* Brand Colors */
--page-primary: #2DB3A0;     /* Teal */
--page-secondary: #F2786D;   /* Coral */
--page-accent: #E85A4F;      /* Orange-red */
--page-dark: #1E3A5F;        /* Dark blue */

/* Status Colors */
--success: #10B981;          /* Green */
--warning: #F59E0B;          /* Amber */
--error: #EF4444;            /* Red */

/* Swipe Colors */
--swipe-right: #10B981;      /* Green - Like/Add */
--swipe-left: #EF4444;       /* Red - Skip */

/* Backgrounds (use system colors for dark mode support) */
--background-primary: systemBackground
--background-secondary: secondarySystemBackground
--background-tertiary: tertiarySystemBackground

/* Text (use system colors for dark mode support) */
--text-primary: label
--text-secondary: secondaryLabel
--text-tertiary: tertiaryLabel
```

### Typography

```css
/* Use SF Rounded for headlines */
--brand-headline: system font, 20px, bold, rounded
--brand-title: system font, 28px, bold, rounded
--brand-body: system font, 16px, regular
--brand-caption: system font, 12px, medium
```

### Component Styling

**Cards:**
- Background: secondarySystemBackground
- Corner radius: 14-16px (continuous)
- Shadow: black 12% opacity, 24px blur, y-offset 10px

**Buttons (Primary):**
- Background: pagePrimary or gradient
- Text: white, 17px semibold
- Height: 52px
- Corner radius: 14px
- Full width with horizontal padding

**Buttons (Secondary):**
- Background: transparent or light tint
- Text: pagePrimary, 16px medium
- Height: 44px

**Input Fields:**
- Background: secondarySystemBackground
- Height: 54px
- Corner radius: 12px
- Icon on left (16x16)
- Placeholder: tertiaryLabel color

**Status Badges:**
- Dot (10px) + text in capsule
- Background: status color at 10% opacity

---

## Navigation Structure

```
TabView
├── Home (NavigationStack)
│   └── ProfileView
│
├── Discover (NavigationStack)
│   └── ListPickerSheet
│
├── Library (NavigationStack)
│   ├── BookListDetailView
│   │   └── BookItemDetailView
│   ├── CreateListView (sheet)
│   └── AddBookView (sheet)
│       └── BarcodeScannerView
│
├── Clubs (NavigationStack)
│   ├── ClubDetailView
│   ├── CreateClubView (sheet)
│   └── JoinClubView (sheet)
│
└── Profile (NavigationStack)
    └── SettingsView (sheet)
```

---

## API Integration

### Google Books API

**Search Endpoint:**
```
GET https://www.googleapis.com/books/v1/volumes
  ?q={query}
  &maxResults=40
  &orderBy=relevance
  &printType=books
  &langRestrict=en
```

**Response Mapping:**
```javascript
{
  id: item.id,
  isbn: volumeInfo.industryIdentifiers?.find(i => i.type === "ISBN_13")?.identifier
        || volumeInfo.industryIdentifiers?.[0]?.identifier,
  title: volumeInfo.title,
  authors: volumeInfo.authors || [],
  coverImageUrl: volumeInfo.imageLinks?.thumbnail?.replace("http:", "https:"),
  description: volumeInfo.description,
  genre: volumeInfo.categories?.[0],
  pageCount: volumeInfo.pageCount,
  publishDate: volumeInfo.publishedDate,
  publisher: volumeInfo.publisher,
  averageRating: volumeInfo.averageRating,
  ratingsCount: volumeInfo.ratingsCount
}
```

### Open Library API

**ISBN Lookup:**
```
GET https://openlibrary.org/isbn/{isbn}.json
```

**Author Lookup:**
```
GET https://openlibrary.org{authorKey}.json
```

**Cover Image:**
```
https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg
```

---

## Firestore Security Rules (Recommended)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Lists belong to owner
    match /lists/{listId} {
      allow read: if request.auth != null &&
        (resource.data.ownerId == request.auth.uid || resource.data.isPublic == true);
      allow create: if request.auth != null &&
        request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;
    }

    // Items belong to user
    match /items/{itemId} {
      allow read, write: if request.auth != null &&
        (resource.data.userId == request.auth.uid ||
         request.resource.data.userId == request.auth.uid);
    }

    // Books cache is readable by all authenticated users
    match /books/{bookId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }

    // Clubs
    match /clubs/{clubId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;

      // Members subcollection
      match /members/{memberId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null;
      }

      // Activity subcollection
      match /activity/{activityId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
      }
    }

    // User preferences
    match /userPreferences/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Book interactions
    match /bookInteractions/{isbn}/users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Required Permissions

### iOS
- **Camera:** NSCameraUsageDescription - "PageSwipe needs camera access to scan book barcodes and add books to your library."

### Web
- No special permissions required (camera access via browser prompt if implementing barcode scanner)

---

## Indexes Required

### Firestore Composite Indexes

1. **lists** - `ownerId` ASC, `createdAt` DESC
2. **items** - `listId` ASC, `addedAt` DESC
3. **items** - `userId` ASC, `status` ASC
4. **clubs** - `joinCode` ASC

### Collection Group Indexes

1. **members** - `userId` ASC (for finding user's clubs)

---

## Free vs Premium Features

### Free Tier
- 3 default lists only (no custom lists)
- Join clubs (cannot create)
- Unlimited book discovery
- Basic reading tracking

### Premium Tier
- Unlimited custom lists
- Create book clubs
- Advanced reading stats
- Export reading history

---

## Error Handling

### Error Types
```typescript
enum DataError {
  notAuthenticated = "Not authenticated",
  invalidData = "Invalid data",
  clubNotFound = "Club not found",
  alreadyMember = "Already a member of this club",
  cannotDeleteDefault = "Cannot delete default list"
}

enum AuthError {
  invalidCredential = "Invalid credentials",
  userNotFound = "User not found",
  networkError = "Network error"
}

enum BookLookupError {
  notFound = "Book not found",
  networkError = "Network error",
  invalidResponse = "Invalid response"
}
```

---

## State Management

### Global State (EnvironmentObject)

**AuthenticationManager:**
- `user: FirebaseAuth.User?`
- `userProfile: User?`
- `isAuthenticated: Bool`
- `isLoading: Bool`
- `errorMessage: String?`

**DataManager:**
- `bookLists: [BookList]`
- `currentItems: [BookItem]`
- `clubs: [Club]`
- `currentlyReadingItems: [BookItem]`
- `completedBooksCount: Int`
- `completedThisYearCount: Int`
- `userPreferences: UserPreferences?`
- `isLoading: Bool`
- `errorMessage: String?`

### Firestore Listeners

Set up on user authentication:
1. Listen to `lists` where `ownerId == userId`
2. Listen to `clubs` where `ownerId == userId`
3. Listen to `clubs/*/members` where `userId == userId` (collection group)

---

## Summary for Web Implementation

To recreate this app as a web version:

1. **Use same Firebase project** - Connect to `pageswipe` Firebase project
2. **Implement same data models** - Use exact Firestore structure
3. **Replicate all screens** - Home, Discover, Library, Clubs, Profile
4. **Maintain same UX flows** - Swipe discovery, reading tracking, club joining
5. **Use same color palette** - Brand colors and status colors
6. **Implement responsive design** - Card-based UI works well on web
7. **Handle auth the same way** - Email, Google, Apple (Apple Sign-In requires extra setup on web)
8. **Use same API integrations** - Google Books, Open Library
9. **Implement recommendation system** - Same scoring algorithm

The web app should feel like a natural extension of the iOS app with identical functionality and visual consistency.
