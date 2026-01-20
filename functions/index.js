/**
 * PageSwipe Cloud Functions
 *
 * Functions:
 * - lookupBook: ISBN/EAN to book data lookup
 * - discoverBooks: Centralized book discovery/recommendations
 * - revenueCatWebhook: Subscription status updates
 * - updateUserStats: Auto-sync booksRead/currentlyReading on item changes
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// =============================================================================
// DISCOVERY CONFIGURATION (Single source of truth for iOS + Web)
// =============================================================================

const DISCOVERY_CONFIG = {
  // Genres available in the discovery filter
  // Using specific author names and book titles for more accurate results
  genres: [
    { id: "random", label: "Random", queries: null, isFiction: true },
    {
      id: "romance",
      label: "Romance",
      queries: [
        "Colleen Hoover romance", "Emily Henry romance", "Ali Hazelwood romance",
        "Tessa Bailey romance", "Christina Lauren romance", "Helen Hoang romance",
        "Beach Read Emily Henry", "Love Hypothesis", "It Ends With Us",
        "romance novel bestseller 2024", "contemporary romance fiction"
      ],
      isFiction: true
    },
    {
      id: "thriller",
      label: "Thriller",
      queries: [
        "Freida McFadden thriller", "Riley Sager thriller", "Lisa Jewell thriller",
        "The Housemaid", "Gone Girl Gillian Flynn", "The Silent Patient",
        "psychological thriller bestseller", "domestic thriller novel",
        "Ruth Ware thriller", "Karin Slaughter thriller"
      ],
      isFiction: true
    },
    {
      id: "mystery",
      label: "Mystery",
      queries: [
        "Agatha Christie mystery", "cozy mystery bestseller", "detective novel fiction",
        "murder mystery novel", "Louise Penny mystery", "Tana French mystery",
        "whodunit novel", "crime fiction bestseller"
      ],
      isFiction: true
    },
    {
      id: "fantasy",
      label: "Fantasy",
      queries: [
        "Sarah J Maas fantasy", "Fourth Wing Rebecca Yarros", "Leigh Bardugo fantasy",
        "Holly Black faerie", "A Court of Thorns and Roses", "romantasy bestseller",
        "Brandon Sanderson fantasy", "epic fantasy novel", "Crescent City",
        "fantasy romance novel"
      ],
      isFiction: true
    },
    {
      id: "scifi",
      label: "Sci-Fi",
      queries: [
        "Project Hail Mary Andy Weir", "Dune Frank Herbert", "The Martian",
        "Blake Crouch science fiction", "Dark Matter novel", "Recursion novel",
        "space opera novel", "Becky Chambers science fiction",
        "science fiction bestseller novel", "dystopian fiction novel"
      ],
      isFiction: true
    },
    {
      id: "horror",
      label: "Horror",
      queries: [
        "Stephen King horror novel", "horror fiction bestseller", "Paul Tremblay horror",
        "gothic horror novel", "Grady Hendrix horror", "haunted house novel",
        "supernatural horror fiction", "It Stephen King"
      ],
      isFiction: true
    },
    {
      id: "literary",
      label: "Literary Fiction",
      queries: [
        "Booker Prize winner", "literary fiction bestseller", "Pulitzer fiction winner",
        "book club fiction pick", "National Book Award fiction",
        "literary novel 2024", "literary fiction award winner"
      ],
      isFiction: true
    },
    {
      id: "historical",
      label: "Historical Fiction",
      queries: [
        "Kristin Hannah historical", "historical fiction bestseller", "World War II novel fiction",
        "The Nightingale novel", "All the Light We Cannot See",
        "Kate Quinn historical", "historical romance novel"
      ],
      isFiction: true
    },
    {
      id: "contemporary",
      label: "Contemporary",
      queries: [
        "contemporary fiction bestseller", "Reese's Book Club pick", "BookTok fiction",
        "women's fiction novel", "book club pick 2024", "literary fiction bestseller"
      ],
      isFiction: true
    },
    {
      id: "youngadult",
      label: "Young Adult",
      queries: [
        "YA fantasy bestseller", "young adult romance", "YA dystopian novel",
        "Adam Silvera YA", "Cassandra Clare YA", "Sarah J Maas YA",
        "young adult fiction bestseller"
      ],
      isFiction: true
    },
    {
      id: "selfhelp",
      label: "Self-Help",
      queries: [
        "Atomic Habits James Clear", "Brene Brown book", "The Subtle Art of Not Giving",
        "self improvement bestseller", "You Are a Badass", "The Power of Now",
        "Mark Manson book", "personal development bestseller"
      ],
      isFiction: false
    },
    {
      id: "biography",
      label: "Biography",
      queries: [
        "biography bestseller", "memoir bestseller", "celebrity memoir",
        "autobiography bestseller", "Becoming Michelle Obama", "inspirational memoir"
      ],
      isFiction: false
    },
    {
      id: "business",
      label: "Business",
      queries: [
        "business bestseller book", "startup book", "leadership book bestseller",
        "entrepreneurship book", "Think and Grow Rich", "business strategy book"
      ],
      isFiction: false
    },
    {
      id: "psychology",
      label: "Psychology",
      queries: [
        "psychology bestseller book", "Thinking Fast and Slow", "mindset book",
        "behavioral psychology book", "popular psychology book"
      ],
      isFiction: false
    },
    {
      id: "truecrime",
      label: "True Crime",
      queries: [
        "true crime bestseller", "true crime book", "crime documentary book",
        "murder investigation book", "criminal case book"
      ],
      isFiction: false
    }
  ],

  // Blacklisted categories - books with these categories are filtered out
  blacklistedCategories: [
    "textbook", "education", "study guide", "workbook", "academic",
    "reference", "dictionary", "encyclopedia", "manual", "handbook",
    "for dummies", "complete idiot", "programming", "coding", "computer science",
    "mathematics", "engineering", "medical", "nursing", "health & fitness",
    "law", "legal", "accounting", "statistics", "economics",
    "test prep", "exam", "certification", "teaching", "curriculum",
    "juvenile", "children's", "kids", "picture book", "board book",
    "social science", "political science", "research", "scholarly",
    "history", "american history", "world history", "antiques", "crafts",
    "cooking", "gardening", "travel guide", "nature", "science",
    "religion", "philosophy", "games", "sports", "pets"
  ],

  // Blacklisted title words - books with these words in title are filtered out
  blacklistedTitleWords: [
    "dummies", "idiots", "fundamentals", "handbook", "guide to",
    "textbook", "workbook", "tutorial", "manual", "reference",
    "exam", "test prep", "certification", "101", "study guide",
    "volume", "vol.", "edition", "research methods", "analysis of",
    "theory of", "principles of", "concepts of", "studies in",
    "research", "ethics in", "ethics of", "methodology",
    "introduction to", "foundations of", "handbook of",
    "journal", "proceedings", "symposium", "dissertation",
    "encyclopedia", "dictionary", "almanac", "atlas",
    "through history", "in history", "history of", "american history",
    "complete guide", "ultimate guide", "beginner's guide",
    "how to", "learn to", "teach yourself", "for beginners",
    // Summary/condensed books
    "summary of", "summary:", "in 30 minutes", "in 15 minutes",
    "in 20 minutes", "key takeaways", "book summary", "quick read",
    "condensed", "cliff notes", "cliffnotes", "sparknotes", "study notes",
    "analysis:", "a]nalysis of", "review of", "discussion of"
  ],

  // Educational phrases in description that indicate textbook content
  educationalPhrases: [
    "learn how to", "this textbook", "study guide", "exam prep",
    "course", "curriculum", "students will", "exercises and",
    "step-by-step instructions", "comprehensive guide to",
    "learn the basics", "master the art of", "teaches you"
  ],

  // Categories that indicate the book is actually fiction (for fiction genres)
  fictionCategories: [
    "fiction", "novel", "romance", "thriller", "mystery", "fantasy",
    "science fiction", "horror", "literary", "contemporary", "historical fiction",
    "young adult", "women's fiction", "suspense", "crime fiction"
  ],

  // Popular novel queries for "Random" genre (diverse mix)
  popularNovelQueries: [
    // Romance
    "Colleen Hoover novel", "Emily Henry romance", "Taylor Jenkins Reid novel",
    "Ali Hazelwood romance", "Tessa Bailey romance", "Christina Lauren novel",
    // Thriller/Mystery
    "Freida McFadden thriller", "Riley Sager thriller", "Lisa Jewell thriller",
    "Ruth Ware mystery", "The Housemaid novel", "Gone Girl",
    // Fantasy
    "Sarah J Maas fantasy", "Fourth Wing", "Leigh Bardugo fantasy",
    "Holly Black faerie", "romantasy bestseller",
    // Sci-Fi
    "Project Hail Mary", "Andy Weir novel", "Blake Crouch novel",
    // Literary/Book Club
    "Reese's Book Club pick", "BookTok bestseller", "book club fiction",
    // Popular titles
    "It Ends With Us", "Where the Crawdads Sing", "The Seven Husbands", "Verity",
    // Historical
    "Kristin Hannah novel", "historical fiction bestseller",
    // Horror
    "Stephen King novel", "horror fiction bestseller",
    // Self-Help
    "Atomic Habits", "Brene Brown book", "self improvement bestseller"
  ]
};

// =============================================================================
// DISCOVERY FUNCTIONS
// =============================================================================

/**
 * Get available genres for discovery filter
 * Returns the list of genres that can be selected in the UI
 */
exports.getDiscoveryGenres = onCall(async (request) => {
  return {
    success: true,
    genres: DISCOVERY_CONFIG.genres.map(g => ({ id: g.id, label: g.label }))
  };
});

/**
 * Discover books based on genre and user preferences
 * Centralized recommendation engine for iOS + Web
 *
 * @param {string} genre - Genre ID from DISCOVERY_CONFIG.genres (default: "random")
 * @param {string[]} excludeISBNs - ISBNs to exclude (already seen/owned)
 * @param {number} limit - Max number of books to return (default: 20)
 * @param {object} userPreferences - Optional user preference scores for personalization
 */
exports.discoverBooks = onCall(async (request) => {
  const {
    genre = "random",
    excludeISBNs = [],
    limit = 20,
    userPreferences = null
  } = request.data;

  console.log(`📚 Discovery request: genre=${genre}, excludeCount=${excludeISBNs.length}, limit=${limit}`);

  try {
    let allBooks = [];

    // Get the genre configuration
    const genreConfig = DISCOVERY_CONFIG.genres.find(g => g.id === genre);
    if (!genreConfig) {
      throw new HttpsError("invalid-argument", `Invalid genre: ${genre}`);
    }

    // Build search queries based on genre
    let searchQueries = [];

    if (genre === "random") {
      // For random, use a diverse mix of popular queries
      const shuffled = [...DISCOVERY_CONFIG.popularNovelQueries].sort(() => Math.random() - 0.5);
      searchQueries = shuffled.slice(0, 8);
    } else {
      // For specific genre, use the predefined queries array
      // Shuffle and pick a subset for variety
      const shuffled = [...genreConfig.queries].sort(() => Math.random() - 0.5);
      searchQueries = shuffled.slice(0, 5);
    }

    // Fetch books from Google Books API for each query
    for (const query of searchQueries) {
      try {
        const books = await searchGoogleBooks(query, 12);
        allBooks.push(...books);
        console.log(`📚 Fetched ${books.length} books for: "${query}"`);
      } catch (error) {
        console.log(`⚠️ Error fetching "${query}": ${error.message}`);
      }
    }

    // Apply filtering and processing
    let processedBooks = allBooks
      // Filter out books with empty ISBNs
      .filter(book => book.isbn && book.isbn.length > 0)
      // Filter out books without cover images (required for good UX)
      .filter(book => book.coverImageUrl && book.coverImageUrl.length > 0)
      // Filter out books without descriptions (required for good UX)
      .filter(book => book.description && book.description.length > 20)
      // Filter out blacklisted books
      .filter(book => !isBlacklisted(book))
      // For fiction genres, require at least one fiction-related category
      .filter(book => {
        if (genreConfig.isFiction) {
          return hasFictionCategory(book);
        }
        return true; // Non-fiction genres don't need this check
      })
      // Filter out excluded ISBNs
      .filter(book => !excludeISBNs.includes(book.isbn));

    // Deduplicate by ISBN
    const seenISBNs = new Set();
    processedBooks = processedBooks.filter(book => {
      if (seenISBNs.has(book.isbn)) return false;
      seenISBNs.add(book.isbn);
      return true;
    });

    // Shuffle for variety
    processedBooks.sort(() => Math.random() - 0.5);

    // Apply user preferences for personalized ordering (if provided)
    if (userPreferences && userPreferences.genreScores) {
      processedBooks = applyPreferenceScoring(processedBooks, userPreferences);
    }

    // Limit results
    const results = processedBooks.slice(0, limit);

    console.log(`📚 Returning ${results.length} books`);

    return {
      success: true,
      books: results,
      totalFound: processedBooks.length,
      genre: genre
    };
  } catch (error) {
    console.error("Discovery error:", error);
    throw new HttpsError("internal", "Failed to discover books");
  }
});

/**
 * Search Google Books API
 */
async function searchGoogleBooks(query, maxResults = 10) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=${maxResults}&printType=books&langRestrict=en`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Books API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    return [];
  }

  return data.items.map(item => {
    const info = item.volumeInfo;
    const identifiers = info.industryIdentifiers || [];

    // Prefer ISBN-13, fallback to ISBN-10
    let isbn = "";
    const isbn13 = identifiers.find(id => id.type === "ISBN_13");
    const isbn10 = identifiers.find(id => id.type === "ISBN_10");
    if (isbn13) isbn = isbn13.identifier;
    else if (isbn10) isbn = isbn10.identifier;

    return {
      isbn: isbn,
      isbn13: isbn13?.identifier || null,
      title: info.title || "",
      authors: info.authors || [],
      coverImageUrl: info.imageLinks?.thumbnail?.replace("http:", "https:") || null,
      description: info.description || null,
      genre: info.categories?.[0] || null,
      categories: info.categories || [],
      pageCount: info.pageCount || null,
      publishDate: info.publishedDate || null,
      publisher: info.publisher || null,
      language: info.language || "en",
      averageRating: info.averageRating || null,
      ratingsCount: info.ratingsCount || null
    };
  });
}

/**
 * Check if a book is blacklisted (educational, academic, etc.)
 */
function isBlacklisted(book) {
  const titleLower = (book.title || "").toLowerCase();
  const categoriesLower = (book.categories || []).join(" ").toLowerCase();
  const descriptionLower = (book.description || "").toLowerCase();

  // Check title for blacklisted words
  for (const word of DISCOVERY_CONFIG.blacklistedTitleWords) {
    if (titleLower.includes(word)) {
      return true;
    }
  }

  // Check categories for blacklisted content
  for (const category of DISCOVERY_CONFIG.blacklistedCategories) {
    if (categoriesLower.includes(category)) {
      return true;
    }
  }

  // Check description for educational phrases
  for (const phrase of DISCOVERY_CONFIG.educationalPhrases) {
    if (descriptionLower.includes(phrase)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a book has at least one fiction-related category
 * Used to filter out non-fiction results from fiction genre searches
 */
function hasFictionCategory(book) {
  const categoriesLower = (book.categories || []).join(" ").toLowerCase();
  const titleLower = (book.title || "").toLowerCase();

  // Check if any fiction category matches
  for (const fictionCat of DISCOVERY_CONFIG.fictionCategories) {
    if (categoriesLower.includes(fictionCat)) {
      return true;
    }
  }

  // Also check title for "novel" or "fiction" as fallback
  if (titleLower.includes("novel") || titleLower.includes("fiction")) {
    return true;
  }

  // If no categories at all, give benefit of doubt for books from fiction searches
  if (!book.categories || book.categories.length === 0) {
    return true;
  }

  return false;
}

/**
 * Apply user preference scoring to personalize book order
 */
function applyPreferenceScoring(books, preferences) {
  const { genreScores = {}, authorScores = {} } = preferences;

  // Score each book based on user preferences
  const scoredBooks = books.map(book => {
    let score = 0;

    // Score based on genres/categories
    const bookCategories = (book.categories || []).map(c => c.toLowerCase());
    for (const category of bookCategories) {
      for (const [genre, genreScore] of Object.entries(genreScores)) {
        if (category.includes(genre.toLowerCase())) {
          score += genreScore;
        }
      }
    }

    // Score based on authors
    for (const author of (book.authors || [])) {
      const authorScore = authorScores[author];
      if (authorScore) {
        score += authorScore;
      }
    }

    return { ...book, _preferenceScore: score };
  });

  // Sort by preference score (higher first), then randomize within same score
  scoredBooks.sort((a, b) => {
    if (b._preferenceScore !== a._preferenceScore) {
      return b._preferenceScore - a._preferenceScore;
    }
    return Math.random() - 0.5;
  });

  // Remove internal score property before returning
  return scoredBooks.map(({ _preferenceScore, ...book }) => book);
}

// =============================================================================
// BOOK LOOKUP FUNCTIONS
// =============================================================================

/**
 * Look up book by ISBN using Open Library and Google Books APIs
 * Caches results in Firestore for faster subsequent lookups
 */
exports.lookupBook = onCall(async (request) => {
  const { isbn } = request.data;

  if (!isbn) {
    throw new HttpsError("invalid-argument", "ISBN is required");
  }

  // Clean ISBN (remove dashes, spaces)
  const cleanIsbn = isbn.replace(/[-\s]/g, "");

  // Check Firestore cache first
  const cacheQuery = await db.collection("books")
    .where("isbn", "==", cleanIsbn)
    .limit(1)
    .get();

  if (!cacheQuery.empty) {
    return {
      success: true,
      book: cacheQuery.docs[0].data(),
      source: "cache"
    };
  }

  // Try Open Library API (free, no key required)
  try {
    const book = await fetchFromOpenLibrary(cleanIsbn);
    if (book) {
      await cacheBook(book);
      return { success: true, book, source: "openLibrary" };
    }
  } catch (error) {
    console.log("Open Library lookup failed:", error.message);
  }

  // Fallback to Google Books API
  try {
    const book = await fetchFromGoogleBooks(cleanIsbn);
    if (book) {
      await cacheBook(book);
      return { success: true, book, source: "googleBooks" };
    }
  } catch (error) {
    console.log("Google Books lookup failed:", error.message);
  }

  throw new HttpsError("not-found", "Book not found");
});

/**
 * Fetch book data from Open Library API
 */
async function fetchFromOpenLibrary(isbn) {
  const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  // Get author names (requires additional API call)
  let authors = [];
  if (data.authors && data.authors.length > 0) {
    const authorPromises = data.authors.map(async (author) => {
      try {
        const authorResponse = await fetch(`https://openlibrary.org${author.key}.json`);
        if (authorResponse.ok) {
          const authorData = await authorResponse.json();
          return authorData.name;
        }
      } catch (e) {
        return null;
      }
      return null;
    });
    authors = (await Promise.all(authorPromises)).filter(Boolean);
  }

  return {
    isbn: isbn,
    isbn13: isbn.length === 13 ? isbn : null,
    title: data.title,
    authors: authors,
    coverImageUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
    description: typeof data.description === "string"
      ? data.description
      : data.description?.value || null,
    pageCount: data.number_of_pages || null,
    publishDate: data.publish_date || null,
    publisher: data.publishers?.[0] || null,
    language: data.languages?.[0]?.key?.replace("/languages/", "") || "en",
    apiSource: "openLibrary",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

/**
 * Fetch book data from Google Books API
 */
async function fetchFromGoogleBooks(isbn) {
  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return null;
  }

  const volumeInfo = data.items[0].volumeInfo;

  return {
    isbn: isbn,
    isbn13: isbn.length === 13 ? isbn : null,
    title: volumeInfo.title,
    authors: volumeInfo.authors || [],
    coverImageUrl: volumeInfo.imageLinks?.thumbnail?.replace("http:", "https:") || null,
    description: volumeInfo.description || null,
    genre: volumeInfo.categories?.[0] || null,
    categories: volumeInfo.categories || [],
    pageCount: volumeInfo.pageCount || null,
    publishDate: volumeInfo.publishedDate || null,
    publisher: volumeInfo.publisher || null,
    language: volumeInfo.language || "en",
    apiSource: "googleBooks",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

/**
 * Cache book data to Firestore
 */
async function cacheBook(book) {
  await db.collection("books").add(book);
}

/**
 * RevenueCat webhook handler for subscription events
 */
exports.revenueCatWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const event = req.body;
    const { app_user_id, type } = event;

    if (!app_user_id) {
      res.status(400).send("Missing app_user_id");
      return;
    }

    // Update user's premium status based on event type
    const isPro = [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "UNCANCELLATION",
      "NON_RENEWING_PURCHASE"
    ].includes(type);

    const isNotPro = [
      "CANCELLATION",
      "EXPIRATION",
      "BILLING_ISSUE"
    ].includes(type);

    if (isPro || isNotPro) {
      await db.collection("users").doc(app_user_id).update({
        isPro: isPro,
        subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Updated user ${app_user_id} isPro=${isPro} for event ${type}`);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("RevenueCat webhook error:", error);
    res.status(500).send("Internal error");
  }
});

// =============================================================================
// AUTO-STATS FUNCTION - Automatically update user reading stats
// Triggers on item status changes to keep booksRead/currentlyReading in sync
// =============================================================================

/**
 * Firestore trigger: Update user stats when item status changes
 * - When status changes to 'read': increment booksRead
 * - When status changes to 'reading': update currentlyReading count
 * - When status changes from 'reading': decrement currentlyReading count
 */
exports.updateUserStats = onDocumentWritten("items/{itemId}", async (event) => {
  const beforeData = event.data.before.exists ? event.data.before.data() : null;
  const afterData = event.data.after.exists ? event.data.after.data() : null;

  // Skip if no data (shouldn't happen but safety check)
  if (!afterData && !beforeData) return;

  // Get userId from the document
  const userId = afterData?.userId || beforeData?.userId;
  if (!userId) {
    console.log("No userId found in item document");
    return;
  }

  const beforeStatus = beforeData?.status;
  const afterStatus = afterData?.status;

  // Skip if status hasn't changed
  if (beforeStatus === afterStatus) return;

  console.log(`Status change for user ${userId}: ${beforeStatus} -> ${afterStatus}`);

  const userRef = db.collection("users").doc(userId);

  try {
    // Handle transition TO 'read' status (book finished)
    if (afterStatus === "read" && beforeStatus !== "read") {
      await userRef.update({
        booksRead: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Incremented booksRead for user ${userId}`);
    }

    // Handle transition FROM 'read' status (book unmarked as finished)
    if (beforeStatus === "read" && afterStatus !== "read") {
      await userRef.update({
        booksRead: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Decremented booksRead for user ${userId}`);
    }

    // Handle transition TO 'reading' status (book started)
    if (afterStatus === "reading" && beforeStatus !== "reading") {
      await userRef.update({
        currentlyReading: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Incremented currentlyReading for user ${userId}`);
    }

    // Handle transition FROM 'reading' status (book finished or abandoned)
    if (beforeStatus === "reading" && afterStatus !== "reading") {
      await userRef.update({
        currentlyReading: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Decremented currentlyReading for user ${userId}`);
    }

    // Handle item deletion - decrement counts appropriately
    if (!afterData && beforeData) {
      const updates = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (beforeStatus === "read") {
        updates.booksRead = admin.firestore.FieldValue.increment(-1);
      }
      if (beforeStatus === "reading") {
        updates.currentlyReading = admin.firestore.FieldValue.increment(-1);
      }

      if (Object.keys(updates).length > 1) {
        await userRef.update(updates);
        console.log(`Decremented stats for deleted item, user ${userId}`);
      }
    }
  } catch (error) {
    console.error(`Error updating stats for user ${userId}:`, error);
  }
});
