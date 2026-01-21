# PageSwipe Roadmap

**Last Updated:** 2026-01-20

This document tracks planned features for the PageSwipe ecosystem. When features are completed, they are moved to [CHANGELOG.md](./CHANGELOG.md).

---

## Planned Features

### My Library (Physical Book Collection)

**Priority:** High
**Status:** COMPLETED
**Started:** 2026-01-21
**Completed:** 2026-01-21
**Actual Effort:** ~1 hour with AI team

#### Overview

Allow users to catalog their physical book collection. Primary use case: checking what books you already own while browsing bookstores.

#### User Value

- Catalog entire home library via barcode scanning (30 mins vs weeks of manual entry)
- Search owned books by author/title at bookstores
- Quick "Do I own this?" check via barcode scan
- Track which books are lent out and to whom
- See reading stats from owned collection

#### User Experience

**Location in App:**
- Library tab → Segment control: `[My Books]` `[Reading Lists]`
- "My Books" = physically owned books
- "Reading Lists" = existing Want to Read, Finished, Custom lists

**Key Screens:**
1. **My Books Grid** - All owned books with search, filters (All/Read/Unread/Lent Out)
2. **Rapid Scan Mode** - Fast barcode scanning for bulk cataloging
3. **Ownership Check** - Scan any book → "You own this" / "Not in library"
4. **Book Detail** - Shows ownership info, lending status, read dates

**Search & Filter:**
- Search by author (e.g., "Wilbur Smith" → all owned Wilbur Smith books)
- Search by title
- Filter by read status
- Filter by lent out status

#### Technical Approach (Recommended)

**Data Model:** Extend existing `BookItem` rather than creating parallel collection

```
BookItem (existing) + NEW fields:
├── isOwned: boolean
├── ownedFormat: 'physical' | 'ebook' | 'audiobook' | null
├── ownedAt: Timestamp (when added to library)
├── location: String (optional - "Living room shelf")
└── lending: {
      lentTo: String
      lentDate: Timestamp
      expectedReturn: Timestamp?
      notes: String?
      isReturned: boolean
    }
```

**Why This Approach:**
- Single source of truth (no sync issues)
- "My Books" is a filtered view, not separate collection
- Existing `ReadingStatus.read` = book is read (no duplicate tracking)
- Simpler queries, fewer bugs

**Firestore Structure:**
```
items/{itemId}
  ├── ... existing fields ...
  ├── isOwned: true
  ├── ownedFormat: "physical"
  ├── ownedAt: Timestamp
  └── lending: { ... }
```

#### Freemium Model

| Feature | Free | Pro |
|---------|------|-----|
| Books in library | 50 | Unlimited |
| Lending tracking | 3 active | Unlimited |
| Reading stats | This year | Full history |
| Export data | No | Yes |

#### Implementation Phases

**Phase 1: Core Ownership (Week 1-2)**
- [ ] Add `isOwned`, `ownedFormat`, `ownedAt` fields to BookItem model
- [ ] iOS: Add "I own this" toggle on book detail screens
- [ ] iOS: Create "My Books" section in Library tab with segment control
- [ ] iOS: Implement search within My Books (author, title)
- [ ] iOS: Implement filters (All/Read/Unread)
- [ ] Web: Add ownership fields to db-service.js
- [ ] Web: Create My Books view in Library section
- [ ] Web: Implement search and filters
- [ ] Cloud Function: Update any relevant queries

**Phase 2: Rapid Scanning (Week 2)**
- [ ] iOS: Create rapid-fire scan mode for bulk cataloging
- [ ] iOS: "You own this" / "Not in library" result screen after scan
- [ ] iOS: Option to add scanned book directly to My Books
- [ ] Web: Barcode scanning via camera (mobile web)
- [ ] Handle duplicate detection (already owned)

**Phase 3: Freemium Gating (Week 2-3)**
- [ ] Implement 50 book limit for free users
- [ ] iOS: Soft warning at 40 books
- [ ] iOS: Paywall when limit reached
- [ ] Web: Same gating logic
- [ ] Add `unlimitedLibrary` to premium features

**Phase 4: Lending Tracker (Week 3-4)**
- [ ] Add `lending` field to BookItem model
- [ ] iOS: "Lend this book" sheet (borrower name, date, expected return)
- [ ] iOS: "Lent Out" filter in My Books
- [ ] iOS: Visual badge on lent books
- [ ] iOS: "Mark as returned" action
- [ ] Web: Lending management panel
- [ ] Web: Lending status indicators

**Phase 5: Stats & Polish (Week 4)**
- [ ] iOS: Reading stats card (books read per year from owned collection)
- [ ] Web: Stats dashboard
- [ ] iOS: Empty state design for new users
- [ ] Web: Empty state design
- [ ] Performance optimization for large libraries
- [ ] Offline support for ownership checks

#### Files to Modify

**iOS:**
- `Models.swift` - Add ownership fields to BookItem
- `DataManager.swift` - Add ownership CRUD methods
- `MainTabView.swift` - Library tab segment control
- `LibraryView.swift` - Add "My Books" section
- New: `MyBooksView.swift` - Grid view of owned books
- New: `RapidScanView.swift` - Bulk scanning mode
- New: `LendingSheet.swift` - Lending form
- `BookDetailView.swift` - Add ownership toggle, lending info
- `PaywallView.swift` - Add new premium features

**Web:**
- `db-service.js` - Add ownership fields and queries
- `app.html` - My Books view
- `app.js` - My Books logic, search, filters
- `book-lookup.js` - Ownership check after scan

**Firebase:**
- `firestore.rules` - Rules for ownership fields
- `functions/index.js` - Any needed queries (optional)

#### Success Metrics

- Users adding 10+ books to library within first week
- Daily active usage of "My Books" section
- Conversion rate on library limit paywall
- User retention improvement

#### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Barcode lookup fails | Fallback to manual search, enhanced lookup (already improved) |
| Edition mismatch (scan paperback, own hardcover) | Title-based duplicate warning, future: edition grouping |
| Large library performance | Pagination, lazy loading, local caching |
| Offline usage at bookstores | Cache owned ISBNs locally for offline checks |

#### Design Assets Needed

- [ ] Empty state illustration (bookshelf)
- [ ] "Lent out" badge icon
- [ ] Rapid scan mode UI
- [ ] Paywall copy for library limit

---

### Public Sharing (Lists & Clubs)

**Priority:** High
**Status:** Planned
**Estimated Effort:** 1-2 hours with AI team

#### Overview

Allow users to share lists and clubs via URL. Viewers can see content without creating an account. Drives viral growth and signups.

#### User Value

- Share a reading list with anyone (no account required to view)
- Invite people to clubs via shareable link
- "Does mom need to see my book recommendations?" → Just send a link
- Viral marketing: every shared link is a signup opportunity

#### User Experience

**Sharing a List:**
1. User goes to their list → taps "Share"
2. System generates URL: `pageswipe.app/list/Rk9Xm2pL4`
3. User sends URL to anyone
4. Recipient opens URL → sees public page with all books
5. Tapping a book shows full details popup (description, author, etc.)
6. CTA at bottom: "Create your own list on PageSwipe"

**Public List Page Shows:**
- List name
- Owner's name and photo (they chose to share, so identity is okay)
- Book grid with covers
- Tap book → full details popup (same as in-app experience)
- CTA: "Create your own list" / "Sign Up Free"

**Sharing a Club:**
1. User goes to their club → taps "Share"
2. System generates URL: `pageswipe.app/club/ABC123` (URL contains join code)
3. User sends URL to anyone
4. Recipient opens URL → sees club landing page
5. CTA: "Join this club" (requires signup)

**Club Landing Page Shows:**
- Club name and description
- Member count only (not photos - privacy for members who didn't consent)
- Current book (if any)
- CTA: "Join Now - Sign Up Free"

**Revoking a Share:**
- List owner can tap "Revoke Link" → generates new shareId
- Old URL stops working immediately

#### Technical Approach

**Data Model Changes:**

```
BookList (add fields):
├── publicShareId: string | null    // 10-char alphanumeric, null if not shared
└── publicShareCreatedAt: Timestamp | null
```

Clubs already have `joinCode` - URL is just `pageswipe.app/club/{joinCode}`

**URL Structure:**
```
Lists: pageswipe.app/list/{publicShareId}
Clubs: pageswipe.app/club/{joinCode}
```

**Share ID Format:** 10-character alphanumeric (1 trillion+ combinations)

**Security:**
- Lists private by default (no URL until user clicks Share)
- Firebase App Check for rate limiting
- Long share IDs prevent guessing

**Firestore Rules Update:**
```javascript
// Allow reading items from public lists without auth
match /items/{itemId} {
  allow read: if request.auth != null ||
              get(/databases/$(database)/documents/lists/$(resource.data.listId)).data.publicShareId != null;
}
```

**Public Pages (Cloud Function rendered):**
- Server-rendered HTML for proper social media previews
- `og:title`, `og:image` meta tags for link previews
- Minimal JS, fast load
- Mobile responsive

#### Implementation Phases

**Phase 1: List Sharing**
- [ ] Add `publicShareId`, `publicShareCreatedAt` fields to BookList model
- [ ] Create Cloud Function to generate/revoke share links
- [ ] Create Cloud Function to render public list page
- [ ] iOS: Add "Share List" button with share sheet
- [ ] iOS: Add "Revoke Link" option
- [ ] Web: Add "Share List" button
- [ ] Public page: Book grid with tap-for-details popup
- [ ] Update Firestore rules for public item access
- [ ] Social media preview meta tags

**Phase 2: Club Invite Pages**
- [ ] Create Cloud Function to render club landing page
- [ ] iOS: Update club share to use URL (contains join code)
- [ ] Web: Update club share to use URL
- [ ] Landing page with signup CTA

#### Files to Modify

**Firebase:**
- `firestore.rules` - Public item access
- `functions/index.js` - Cloud Functions for rendering public pages

**iOS:**
- `Models.swift` - Add publicShareId to BookList
- `DataManager.swift` - Generate/revoke share link methods
- `ListDetailView.swift` - Share button
- Universal Links configuration for deep linking

**Web:**
- `db-service.js` - Share link methods
- New: Public page templates (list, club)
- `app.js` - Share button in list view

#### Design Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| View counts | Skip | Not valuable for use case |
| Owner identity | Show name + photo | They chose to share |
| Club members | Count only | Privacy for non-consenting members |
| Share codes | URL contains code | Two-in-one solution |
| Book details | Tap for popup | Matches existing app UX |
| SEO | noindex default | Privacy first |

---

## Future Considerations

*Features that may be added later based on user feedback:*

- **Reading Challenges/Goals** - Set yearly reading goals
- **Friends System** - Follow friends, see what they're reading
- **Goodreads Import** - Import existing library from Goodreads
- **Browser Extension** - Quick add from Amazon/bookstore websites
- **AI Recommendations** - Personalized suggestions based on library
- **Audiobook Support** - Track audiobook library
- **Book Condition Tracking** - Note condition of physical books
- **Purchase History** - Where/when books were acquired
- **Multiple Locations** - Track books across home, office, etc.

---

## Completed Features

*See [CHANGELOG.md](./CHANGELOG.md) for released features.*

---

## How to Use This Document

1. **Adding a Feature:** Create a new section under "Planned Features" with overview, user value, technical approach, and implementation phases
2. **Starting Work:** Move feature to "In Progress" status, check off tasks as completed
3. **Completing a Feature:** Move summary to CHANGELOG.md, remove from this document
4. **Deprioritizing:** Move to "Future Considerations" with brief note on why

---

*This roadmap is maintained by the PageSwipe development team.*
