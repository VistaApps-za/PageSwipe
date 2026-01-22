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
 * Validate Open Library cover image
 * Returns the cover URL if valid, null if 404 or placeholder
 */
async function validateOpenLibraryCover(isbn) {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) return null;

    // Check content-length - placeholder images are very small (<1KB)
    const size = response.headers.get("content-length");
    if (size && parseInt(size) < 1000) return null;

    return url;
  } catch (error) {
    console.log("Cover validation failed:", error.message);
    return null;
  }
}

/**
 * Normalize a title for comparison
 * Removes subtitles, common words, and normalizes whitespace
 */
function normalizeTitle(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/[:\-–—]/g, " ")  // Replace separators with spaces
    .replace(/\s+/g, " ")       // Normalize whitespace
    .replace(/\b(the|a|an)\b/g, "") // Remove common articles
    .trim();
}

/**
 * Calculate simple Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Check if two titles match (fuzzy comparison)
 */
function titlesMatch(titleA, titleB) {
  if (!titleA || !titleB) return false;

  const na = normalizeTitle(titleA);
  const nb = normalizeTitle(titleB);

  // Substring match
  if (na.includes(nb) || nb.includes(na)) return true;

  // Fuzzy match - allow up to 30% character difference
  const maxDistance = Math.min(na.length, nb.length) * 0.3;
  return levenshteinDistance(na, nb) <= maxDistance;
}

/**
 * Score a Google Books edition by metadata quality
 */
function scoreEdition(item, originalTitle) {
  const info = item.volumeInfo || {};
  let score = 0;

  // Title must match
  if (!titlesMatch(info.title, originalTitle)) {
    return { score: 0 };
  }

  // Score metadata completeness
  const hasCover = info.imageLinks?.thumbnail;
  const hasDescription = info.description && info.description.length > 50;
  const hasPageCount = info.pageCount && info.pageCount > 0;
  const hasRatings = info.ratingsCount && info.ratingsCount > 0;

  if (hasCover) score += 2;
  if (hasDescription) score += 2;
  if (hasPageCount) score += 1;
  if (hasRatings) score += 1;

  return {
    score,
    coverImageUrl: hasCover
      ? info.imageLinks.thumbnail.replace("http:", "https:")
      : null,
    description: hasDescription ? info.description : null,
    pageCount: info.pageCount || null,
    averageRating: info.averageRating || null,
    ratingsCount: info.ratingsCount || null
  };
}

/**
 * Enhance book data by searching for better editions with cover/description
 * Preserves the original ISBN while filling in missing metadata
 */
async function enhanceBookData(book, originalIsbn) {
  // Skip if we already have both cover and description
  if (book.coverImageUrl && book.description) {
    return book;
  }

  // Need a title to search
  if (!book.title) {
    return book;
  }

  console.log(`🔍 Enhancing book: "${book.title}" (missing: ${!book.coverImageUrl ? 'cover' : ''} ${!book.description ? 'description' : ''})`);

  try {
    // Build precise search query using intitle: and inauthor: modifiers
    let query = `intitle:${book.title}`;
    if (book.authors && book.authors.length > 0) {
      query += ` inauthor:${book.authors[0]}`;
    }

    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=10&printType=books`;

    const response = await fetch(url);
    if (!response.ok) {
      console.log("Enhancement search failed:", response.status);
      return book;
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      console.log("No enhancement candidates found");
      return book;
    }

    // Score and rank all candidates
    const candidates = data.items
      .map(item => scoreEdition(item, book.title))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      console.log("No matching editions found");
      return book;
    }

    // Find best cover and best description (may be from different editions)
    let bestCover = null;
    let bestDescription = null;

    for (const candidate of candidates) {
      if (!bestCover && candidate.coverImageUrl) {
        bestCover = candidate.coverImageUrl;
      }
      if (!bestDescription && candidate.description) {
        bestDescription = candidate.description;
      }
      // Stop once we have both
      if (bestCover && bestDescription) break;
    }

    // Merge enhanced data into original book
    const enhanced = {
      ...book,
      isbn: originalIsbn,  // Always preserve original ISBN
      coverImageUrl: book.coverImageUrl || bestCover,
      description: book.description || bestDescription
    };

    console.log(`✅ Enhanced: cover=${!!enhanced.coverImageUrl}, description=${!!enhanced.description}`);
    return enhanced;
  } catch (error) {
    console.error("Enhancement error:", error);
    return book;
  }
}

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
    let book = await fetchFromOpenLibrary(cleanIsbn);
    if (book) {
      // Enhance if missing cover or description
      book = await enhanceBookData(book, cleanIsbn);
      await cacheBook(book);
      return { success: true, book, source: "openLibrary" };
    }
  } catch (error) {
    console.log("Open Library lookup failed:", error.message);
  }

  // Fallback to Google Books API
  try {
    let book = await fetchFromGoogleBooks(cleanIsbn);
    if (book) {
      // Enhance if missing cover or description
      book = await enhanceBookData(book, cleanIsbn);
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

  // Validate cover image - Open Library may return 404 or placeholder
  const coverImageUrl = await validateOpenLibraryCover(isbn);

  return {
    isbn: isbn,
    isbn13: isbn.length === 13 ? isbn : null,
    title: data.title,
    authors: authors,
    coverImageUrl: coverImageUrl,
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

// =============================================================================
// PUBLIC SHARING FUNCTIONS
// =============================================================================

/**
 * Share code characters (excluding confusing chars: I, O, 0, 1)
 */
const SHARE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate a unique 6-character share ID
 */
async function generateUniqueShareId() {
  let shareId;
  let exists = true;

  while (exists) {
    shareId = '';
    for (let i = 0; i < 6; i++) {
      shareId += SHARE_CODE_CHARS.charAt(Math.floor(Math.random() * SHARE_CODE_CHARS.length));
    }

    // Check if this ID already exists
    const existingList = await db.collection("lists")
      .where("publicShareId", "==", shareId)
      .limit(1)
      .get();

    exists = !existingList.empty;
  }

  return shareId;
}

/**
 * Generate a public share link for a list
 */
exports.generateListShareLink = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to share a list");
  }

  const { listId } = request.data;
  const userId = request.auth.uid;

  if (!listId) {
    throw new HttpsError("invalid-argument", "listId is required");
  }

  try {
    const listRef = db.collection("lists").doc(listId);
    const listDoc = await listRef.get();

    if (!listDoc.exists) {
      throw new HttpsError("not-found", "List not found");
    }

    const listData = listDoc.data();

    if (listData.ownerId !== userId) {
      throw new HttpsError("permission-denied", "You can only share your own lists");
    }

    // Return existing share link if already has one
    if (listData.publicShareId) {
      return {
        success: true,
        shareId: listData.publicShareId,
        shareUrl: `https://pageswipe.tech/list/${listData.publicShareId}`
      };
    }

    // Generate unique share ID
    const publicShareId = await generateUniqueShareId();

    // Update the list
    await listRef.update({
      publicShareId: publicShareId,
      publicShareCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Generated share link for list ${listId}: ${publicShareId}`);

    return {
      success: true,
      shareId: publicShareId,
      shareUrl: `https://pageswipe.tech/list/${publicShareId}`
    };
  } catch (error) {
    console.error("Error generating share link:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to generate share link");
  }
});

/**
 * Revoke a public share link for a list
 */
exports.revokeListShareLink = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to revoke a share link");
  }

  const { listId } = request.data;
  const userId = request.auth.uid;

  if (!listId) {
    throw new HttpsError("invalid-argument", "listId is required");
  }

  try {
    const listRef = db.collection("lists").doc(listId);
    const listDoc = await listRef.get();

    if (!listDoc.exists) {
      throw new HttpsError("not-found", "List not found");
    }

    const listData = listDoc.data();

    if (listData.ownerId !== userId) {
      throw new HttpsError("permission-denied", "You can only revoke share links for your own lists");
    }

    await listRef.update({
      publicShareId: null,
      publicShareCreatedAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Revoked share link for list ${listId}`);

    return { success: true };
  } catch (error) {
    console.error("Error revoking share link:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to revoke share link");
  }
});

// =============================================================================
// PUBLIC PAGE RENDERING
// =============================================================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generate HTML for public list page
 */
function generatePublicListHtml(list, owner, books) {
  const listName = escapeHtml(list.name);
  const listDescription = escapeHtml(list.description || '');
  const ownerName = escapeHtml(owner?.displayName || 'A PageSwipe Reader');
  const bookCount = books.length;
  const ogImage = books.length > 0 && books[0].coverImageUrl
    ? books[0].coverImageUrl
    : 'https://pageswipe.tech/images/PageSwipeLogo.png';
  const ogDescription = listDescription || `A reading list with ${bookCount} book${bookCount !== 1 ? 's' : ''} curated by ${ownerName}`;

  const booksHtml = books.map((book, index) => `
    <div class="book-card" style="animation-delay: ${index * 0.05}s">
      <div class="book-cover-wrapper">
        <div class="book-cover">
          ${book.coverImageUrl
            ? `<img src="${escapeHtml(book.coverImageUrl)}" alt="${escapeHtml(book.title)}" loading="lazy">`
            : `<div class="no-cover"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>`
          }
        </div>
      </div>
      <div class="book-info">
        <h3>${escapeHtml(truncateText(book.title, 50))}</h3>
        <p>${escapeHtml(truncateText((book.authors || []).join(', '), 40)) || 'Unknown Author'}</p>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${listName} - PageSwipe</title>
  <meta name="description" content="${escapeHtml(ogDescription)}">
  <meta property="og:title" content="${listName} - Shared Reading List">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="PageSwipe">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${listName} - Shared Reading List">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <link rel="icon" type="image/png" href="https://pageswipe.tech/images/favicon-32.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: #1E3A5F;
      --primary-dark: #152d4a;
      --accent: #FF6B6B;
      --accent-light: #ff8a8a;
      --teal: #2DB3A0;
      --teal-light: #3dc4b0;
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-tertiary: #f1f5f9;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
      --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #0f172a;
        --bg-secondary: #1e293b;
        --bg-tertiary: #334155;
        --text-primary: #f1f5f9;
        --text-secondary: #cbd5e1;
        --text-muted: #94a3b8;
        --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
        --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3);
        --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.3);
        --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.4);
      }
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Hero Section */
    .hero {
      position: relative;
      padding: 4rem 1.5rem 5rem;
      text-align: center;
      overflow: hidden;
    }

    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, var(--primary) 0%, #2d4a6f 50%, var(--teal) 100%);
      z-index: 0;
    }

    .hero::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 20% 80%, rgba(255,107,107,0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(45,179,160,0.2) 0%, transparent 50%),
        radial-gradient(circle at 40% 40%, rgba(255,255,255,0.05) 0%, transparent 30%);
      z-index: 1;
      animation: subtlePulse 8s ease-in-out infinite;
    }

    @keyframes subtlePulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    /* Floating particles */
    .particles {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      pointer-events: none;
    }

    .particle {
      position: absolute;
      width: 4px;
      height: 4px;
      background: rgba(255,255,255,0.3);
      border-radius: 50%;
      animation: float 15s infinite ease-in-out;
    }

    .particle:nth-child(1) { left: 10%; top: 20%; animation-delay: 0s; animation-duration: 12s; }
    .particle:nth-child(2) { left: 20%; top: 60%; animation-delay: 2s; animation-duration: 14s; }
    .particle:nth-child(3) { left: 35%; top: 30%; animation-delay: 4s; animation-duration: 11s; }
    .particle:nth-child(4) { left: 50%; top: 70%; animation-delay: 1s; animation-duration: 13s; }
    .particle:nth-child(5) { left: 65%; top: 25%; animation-delay: 3s; animation-duration: 15s; }
    .particle:nth-child(6) { left: 80%; top: 55%; animation-delay: 5s; animation-duration: 10s; }
    .particle:nth-child(7) { left: 90%; top: 40%; animation-delay: 2.5s; animation-duration: 12s; }
    .particle:nth-child(8) { left: 15%; top: 80%; animation-delay: 1.5s; animation-duration: 14s; }

    @keyframes float {
      0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.3; }
      25% { transform: translateY(-20px) translateX(10px) scale(1.2); opacity: 0.5; }
      50% { transform: translateY(-10px) translateX(-5px) scale(0.8); opacity: 0.4; }
      75% { transform: translateY(-30px) translateX(15px) scale(1.1); opacity: 0.6; }
    }

    .hero-content {
      position: relative;
      z-index: 2;
      max-width: 600px;
      margin: 0 auto;
    }

    .shared-by {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 0.5rem 1rem;
      border-radius: 100px;
      font-size: 0.875rem;
      color: rgba(255,255,255,0.9);
      margin-bottom: 1.5rem;
      animation: fadeInDown 0.6s ease-out;
    }

    .shared-by svg {
      width: 16px;
      height: 16px;
      opacity: 0.8;
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .hero h1 {
      font-family: 'Nunito', sans-serif;
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      color: white;
      margin-bottom: 1rem;
      line-height: 1.2;
      animation: fadeInUp 0.6s ease-out 0.1s both;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .hero-description {
      font-size: 1.125rem;
      color: rgba(255,255,255,0.85);
      margin-bottom: 1.5rem;
      max-width: 450px;
      margin-left: auto;
      margin-right: auto;
      animation: fadeInUp 0.6s ease-out 0.2s both;
    }

    .book-count-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 0.625rem 1.25rem;
      border-radius: 100px;
      font-size: 0.9375rem;
      font-weight: 600;
      color: white;
      border: 1px solid rgba(255,255,255,0.2);
      animation: fadeInUp 0.6s ease-out 0.3s both;
    }

    .book-count-badge svg {
      width: 18px;
      height: 18px;
    }

    /* Books Section */
    .books-section {
      max-width: 1000px;
      margin: 0 auto;
      padding: 0 1.5rem;
      margin-top: -2rem;
      position: relative;
      z-index: 10;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      padding: 0 0.5rem;
    }

    .section-title {
      font-family: 'Nunito', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .books-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1.5rem;
    }

    @media (min-width: 640px) {
      .books-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 2rem;
      }
    }

    .book-card {
      animation: bookFadeIn 0.5s ease-out both;
      cursor: default;
    }

    @keyframes bookFadeIn {
      from { opacity: 0; transform: translateY(30px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .book-cover-wrapper {
      position: relative;
      perspective: 1000px;
      margin-bottom: 0.875rem;
    }

    .book-cover {
      aspect-ratio: 2/3;
      background: var(--bg-tertiary);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: var(--shadow-lg), 0 0 0 1px rgba(0,0,0,0.05);
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
      transform-style: preserve-3d;
    }

    .book-card:hover .book-cover {
      transform: translateY(-8px) rotateX(5deg) rotateY(-5deg);
      box-shadow: var(--shadow-xl), 0 25px 30px -15px rgba(0,0,0,0.2);
    }

    .book-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .book-card:hover .book-cover img {
      transform: scale(1.03);
    }

    .no-cover {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
      color: var(--text-muted);
    }

    .book-info h3 {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.4;
    }

    .book-info p {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Marketing CTA Section */
    .cta-section {
      max-width: 900px;
      margin: 4rem auto;
      padding: 0 1.5rem;
    }

    .cta-card {
      background: var(--bg-secondary);
      border-radius: 24px;
      padding: 3rem 2rem;
      text-align: center;
      box-shadow: var(--shadow-xl);
      position: relative;
      overflow: hidden;
    }

    .cta-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--accent), var(--teal), var(--primary));
    }

    .cta-card h2 {
      font-family: 'Nunito', sans-serif;
      font-size: clamp(1.5rem, 4vw, 2rem);
      font-weight: 800;
      color: var(--text-primary);
      margin-bottom: 0.75rem;
    }

    .cta-card > p {
      font-size: 1.0625rem;
      color: var(--text-secondary);
      margin-bottom: 2.5rem;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2.5rem;
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      text-align: left;
      padding: 1.25rem;
      background: var(--bg-tertiary);
      border-radius: 16px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .feature-item:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .feature-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .feature-icon.coral { background: linear-gradient(135deg, var(--accent), var(--accent-light)); }
    .feature-icon.teal { background: linear-gradient(135deg, var(--teal), var(--teal-light)); }
    .feature-icon.navy { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); }

    .feature-icon svg {
      width: 22px;
      height: 22px;
      color: white;
    }

    .feature-text h3 {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }

    .feature-text p {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .cta-buttons {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, var(--accent), #ff5252);
      color: white;
      padding: 1rem 2.5rem;
      border-radius: 14px;
      text-decoration: none;
      font-weight: 700;
      font-size: 1.0625rem;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 4px 14px rgba(255,107,107,0.4);
      border: none;
      cursor: pointer;
    }

    .btn-primary:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 8px 25px rgba(255,107,107,0.5);
    }

    .btn-primary svg {
      width: 20px;
      height: 20px;
    }

    .btn-secondary {
      color: var(--text-secondary);
      font-size: 0.9375rem;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .btn-secondary:hover {
      color: var(--accent);
    }

    .trust-badges {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    .trust-badge {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .trust-badge svg {
      width: 16px;
      height: 16px;
      color: var(--teal);
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 2rem 1.5rem 3rem;
      border-top: 1px solid var(--bg-tertiary);
    }

    .footer-logo {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 1rem;
      text-decoration: none;
      color: var(--text-primary);
    }

    .footer-logo img {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }

    .footer-logo span {
      font-family: 'Nunito', sans-serif;
      font-weight: 700;
      font-size: 1.125rem;
    }

    .footer-links {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .footer-links a {
      font-size: 0.875rem;
      color: var(--text-secondary);
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .footer-links a:hover {
      color: var(--accent);
    }

    .footer-tagline {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      background: var(--bg-secondary);
      border-radius: 16px;
      box-shadow: var(--shadow-md);
    }

    .empty-state svg {
      width: 64px;
      height: 64px;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      font-family: 'Nunito', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .empty-state p {
      color: var(--text-secondary);
      font-size: 0.9375rem;
    }
  </style>
</head>
<body>
  <!-- Hero Section -->
  <section class="hero">
    <div class="particles">
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
    </div>
    <div class="hero-content">
      <div class="shared-by">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        <span>${ownerName} shared a reading list</span>
      </div>
      <h1>${listName}</h1>
      ${listDescription ? `<p class="hero-description">${escapeHtml(listDescription)}</p>` : ''}
      <div class="book-count-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span>${bookCount} book${bookCount !== 1 ? 's' : ''} in this list</span>
      </div>
    </div>
  </section>

  <!-- Books Grid -->
  <section class="books-section">
    ${books.length > 0 ? `
      <div class="books-grid">${booksHtml}</div>
    ` : `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <h3>This list is empty</h3>
        <p>Books will appear here once they are added.</p>
      </div>
    `}
  </section>

  <!-- Marketing CTA Section -->
  <section class="cta-section">
    <div class="cta-card">
      <h2>Create Your Own Reading Lists</h2>
      <p>Join thousands of readers who organize their books, track their progress, and discover their next great read with PageSwipe.</p>

      <div class="features-grid">
        <div class="feature-item">
          <div class="feature-icon coral">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="feature-text">
            <h3>Organize Effortlessly</h3>
            <p>Create unlimited lists for any mood or goal</p>
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </div>
          <div class="feature-text">
            <h3>Share with Friends</h3>
            <p>Send lists to anyone with a single link</p>
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon navy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="feature-text">
            <h3>Join Book Clubs</h3>
            <p>Read together and discuss with others</p>
          </div>
        </div>
      </div>

      <div class="cta-buttons">
        <a href="https://pageswipe.tech/app.html" class="btn-primary">
          Get Started Free
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </a>
        <a href="https://pageswipe.tech/app.html#signin" class="btn-secondary">Already have an account? Sign in</a>
      </div>

      <div class="trust-badges">
        <div class="trust-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Free forever</span>
        </div>
        <div class="trust-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>No credit card required</span>
        </div>
        <div class="trust-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Available on iOS and Web</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <a href="https://pageswipe.tech" class="footer-logo">
      <img src="https://pageswipe.tech/images/WraptIcon.png" alt="PageSwipe">
      <span>PageSwipe</span>
    </a>
    <div class="footer-links">
      <a href="https://pageswipe.tech">Home</a>
      <a href="https://pageswipe.tech/app.html">Open App</a>
      <a href="https://apps.apple.com/app/pageswipe" target="_blank" rel="noopener">iOS App</a>
    </div>
    <p class="footer-tagline">Your personal reading companion</p>
  </footer>
</body>
</html>`;
}

/**
 * Generate HTML for public club page
 */
function generatePublicClubHtml(club) {
  const clubName = escapeHtml(club.name);
  const clubDescription = escapeHtml(club.description || '');
  const ownerName = escapeHtml(club.ownerName || 'A PageSwipe Reader');
  const memberCount = club.memberCount || 0;
  const booksCompleted = club.booksCompleted || 0;
  const currentBook = club.currentBookTitle ? escapeHtml(club.currentBookTitle) : null;
  const currentBookCover = club.currentBookCoverUrl ? escapeHtml(club.currentBookCoverUrl) : null;
  const ogImage = club.currentBookCoverUrl || club.coverImageUrl || 'https://pageswipe.tech/images/PageSwipeLogo.png';
  const ogDescription = clubDescription || `Join ${clubName} - a book club with ${memberCount} member${memberCount !== 1 ? 's' : ''} on PageSwipe`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to ${clubName} - PageSwipe</title>
  <meta name="description" content="${escapeHtml(ogDescription)}">
  <meta property="og:title" content="You're Invited to Join ${clubName}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="PageSwipe">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="You're Invited to Join ${clubName}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <link rel="icon" type="image/png" href="https://pageswipe.tech/images/favicon-32.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: #1E3A5F;
      --primary-dark: #152d4a;
      --accent: #FF6B6B;
      --accent-light: #ff8a8a;
      --teal: #2DB3A0;
      --teal-light: #3dc4b0;
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-tertiary: #f1f5f9;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
      --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
      --shadow-2xl: 0 25px 50px -12px rgba(0,0,0,0.25);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #0f172a;
        --bg-secondary: #1e293b;
        --bg-tertiary: #334155;
        --text-primary: #f1f5f9;
        --text-secondary: #cbd5e1;
        --text-muted: #94a3b8;
        --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
        --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3);
        --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.3);
        --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.4);
        --shadow-2xl: 0 25px 50px -12px rgba(0,0,0,0.6);
      }
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Hero Section */
    .hero {
      position: relative;
      min-height: 50vh;
      padding: 3rem 1.5rem 6rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, var(--teal) 0%, var(--primary) 50%, #2d1b4e 100%);
      z-index: 0;
    }

    .hero::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 30% 20%, rgba(255,107,107,0.2) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 80%, rgba(45,179,160,0.25) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 40%);
      z-index: 1;
      animation: gradientShift 10s ease-in-out infinite alternate;
    }

    @keyframes gradientShift {
      0% { opacity: 1; transform: scale(1); }
      100% { opacity: 0.8; transform: scale(1.05); }
    }

    /* Animated rings */
    .rings {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      pointer-events: none;
    }

    .ring {
      position: absolute;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 50%;
      animation: ringPulse 4s ease-in-out infinite;
    }

    .ring:nth-child(1) {
      width: 300px; height: 300px;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      animation-delay: 0s;
    }

    .ring:nth-child(2) {
      width: 500px; height: 500px;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      animation-delay: 0.5s;
    }

    .ring:nth-child(3) {
      width: 700px; height: 700px;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      animation-delay: 1s;
    }

    @keyframes ringPulse {
      0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 0.1; transform: translate(-50%, -50%) scale(1.1); }
    }

    .hero-content {
      position: relative;
      z-index: 2;
      max-width: 500px;
    }

    .invite-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 0.625rem 1.25rem;
      border-radius: 100px;
      font-size: 0.9375rem;
      font-weight: 600;
      color: white;
      margin-bottom: 1.5rem;
      border: 1px solid rgba(255,255,255,0.2);
      animation: bounceIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes bounceIn {
      0% { opacity: 0; transform: scale(0.8) translateY(-20px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }

    .invite-badge svg {
      width: 20px;
      height: 20px;
    }

    .hero h1 {
      font-family: 'Nunito', sans-serif;
      font-size: clamp(2rem, 6vw, 2.75rem);
      font-weight: 800;
      color: white;
      margin-bottom: 0.75rem;
      line-height: 1.15;
      animation: fadeInUp 0.6s ease-out 0.1s both;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(25px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .hero-subtitle {
      font-size: 1.0625rem;
      color: rgba(255,255,255,0.85);
      margin-bottom: 0.5rem;
      animation: fadeInUp 0.6s ease-out 0.2s both;
    }

    .hero-description {
      font-size: 1rem;
      color: rgba(255,255,255,0.7);
      max-width: 400px;
      margin: 0 auto;
      animation: fadeInUp 0.6s ease-out 0.3s both;
    }

    /* Main Card Section */
    .main-section {
      max-width: 520px;
      margin: -3rem auto 0;
      padding: 0 1.5rem;
      position: relative;
      z-index: 10;
    }

    .club-card {
      background: var(--bg-secondary);
      border-radius: 24px;
      padding: 2rem;
      box-shadow: var(--shadow-2xl);
      animation: cardSlideUp 0.6s ease-out 0.4s both;
    }

    @keyframes cardSlideUp {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Stats Row */
    .stats-row {
      display: flex;
      justify-content: center;
      gap: 2.5rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--bg-tertiary);
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-family: 'Nunito', sans-serif;
      font-size: 2rem;
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1;
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      font-weight: 500;
    }

    /* Current Book Section */
    .current-book {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--bg-tertiary);
      border-radius: 16px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .current-book-cover {
      width: 60px;
      height: 90px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      box-shadow: var(--shadow-md);
      background: var(--bg-secondary);
    }

    .current-book-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .current-book-cover .placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
    }

    .current-book-info {
      flex: 1;
      min-width: 0;
      text-align: left;
    }

    .current-book-label {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--teal);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.375rem;
    }

    .current-book-label svg {
      width: 14px;
      height: 14px;
    }

    .current-book-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Join Code Section */
    .join-code-section {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .join-code-label {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
    }

    .join-code-box {
      background: linear-gradient(135deg, var(--primary) 0%, var(--teal) 100%);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      position: relative;
      overflow: hidden;
    }

    .join-code-box::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
      animation: shimmer 3s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .join-code-value {
      font-family: 'Nunito', monospace;
      font-size: clamp(1.75rem, 6vw, 2.25rem);
      font-weight: 900;
      color: white;
      letter-spacing: 0.25em;
      position: relative;
      z-index: 1;
    }

    .join-code-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      margin-top: 0.75rem;
      font-size: 0.8125rem;
      color: rgba(255,255,255,0.8);
      position: relative;
      z-index: 1;
    }

    .join-code-hint svg {
      width: 14px;
      height: 14px;
    }

    /* CTA Buttons */
    .cta-buttons {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, var(--accent), #ff5252);
      color: white;
      padding: 1rem 2rem;
      border-radius: 14px;
      text-decoration: none;
      font-weight: 700;
      font-size: 1.0625rem;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 4px 14px rgba(255,107,107,0.4);
      border: none;
      cursor: pointer;
    }

    .btn-primary:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 8px 25px rgba(255,107,107,0.5);
    }

    .btn-primary svg {
      width: 20px;
      height: 20px;
    }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: var(--bg-tertiary);
      color: var(--text-primary);
      padding: 0.875rem 1.5rem;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9375rem;
      transition: all 0.2s ease;
    }

    .btn-secondary:hover {
      background: var(--primary);
      color: white;
    }

    /* Marketing Section */
    .marketing-section {
      max-width: 700px;
      margin: 3rem auto;
      padding: 0 1.5rem;
    }

    .marketing-card {
      background: var(--bg-secondary);
      border-radius: 24px;
      padding: 2.5rem 2rem;
      text-align: center;
      box-shadow: var(--shadow-lg);
    }

    .marketing-card h2 {
      font-family: 'Nunito', sans-serif;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .marketing-card > p {
      color: var(--text-secondary);
      margin-bottom: 2rem;
    }

    .features-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-align: left;
      padding: 1rem;
      background: var(--bg-tertiary);
      border-radius: 12px;
    }

    .feature-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .feature-icon.coral { background: linear-gradient(135deg, var(--accent), var(--accent-light)); }
    .feature-icon.teal { background: linear-gradient(135deg, var(--teal), var(--teal-light)); }
    .feature-icon.navy { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); }

    .feature-icon svg {
      width: 20px;
      height: 20px;
      color: white;
    }

    .feature-text {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text-primary);
    }

    .signup-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s ease;
    }

    .signup-link:hover {
      color: var(--accent-light);
      text-decoration: underline;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 2rem 1.5rem 3rem;
      border-top: 1px solid var(--bg-tertiary);
    }

    .footer-logo {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 1rem;
      text-decoration: none;
      color: var(--text-primary);
    }

    .footer-logo img {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }

    .footer-logo span {
      font-family: 'Nunito', sans-serif;
      font-weight: 700;
      font-size: 1.125rem;
    }

    .footer-links {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .footer-links a {
      font-size: 0.875rem;
      color: var(--text-secondary);
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .footer-links a:hover {
      color: var(--accent);
    }

    .footer-tagline {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <!-- Hero Section -->
  <section class="hero">
    <div class="rings">
      <div class="ring"></div>
      <div class="ring"></div>
      <div class="ring"></div>
    </div>
    <div class="hero-content">
      <div class="invite-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span>You're Invited!</span>
      </div>
      <h1>${clubName}</h1>
      <p class="hero-subtitle">A book club by ${ownerName}</p>
      ${clubDescription ? `<p class="hero-description">${escapeHtml(clubDescription)}</p>` : ''}
    </div>
  </section>

  <!-- Main Club Card -->
  <section class="main-section">
    <div class="club-card">
      <!-- Stats -->
      <div class="stats-row">
        <div class="stat">
          <div class="stat-value">${memberCount}</div>
          <div class="stat-label">Member${memberCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="stat">
          <div class="stat-value">${booksCompleted}</div>
          <div class="stat-label">Books Read</div>
        </div>
      </div>

      ${currentBook ? `
        <!-- Currently Reading -->
        <div class="current-book">
          <div class="current-book-cover">
            ${currentBookCover
              ? `<img src="${currentBookCover}" alt="${currentBook}">`
              : `<div class="placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>`
            }
          </div>
          <div class="current-book-info">
            <div class="current-book-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Currently Reading
            </div>
            <div class="current-book-title">${currentBook}</div>
          </div>
        </div>
      ` : ''}

      <!-- Join Code -->
      <div class="join-code-section">
        <div class="join-code-label">Use this code to join the club</div>
        <div class="join-code-box">
          <div class="join-code-value">${escapeHtml(club.joinCode)}</div>
          <div class="join-code-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Enter this code in the PageSwipe app
          </div>
        </div>
      </div>

      <!-- CTA Buttons -->
      <div class="cta-buttons">
        <a href="https://pageswipe.tech/app.html" class="btn-primary">
          Join on PageSwipe
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </a>
        <a href="https://pageswipe.tech/app.html" class="btn-secondary">
          New here? Sign up free
        </a>
      </div>
    </div>
  </section>

  <!-- Marketing Section -->
  <section class="marketing-section">
    <div class="marketing-card">
      <h2>Join the Conversation</h2>
      <p>Book clubs on PageSwipe bring readers together to share ideas and discover great books.</p>

      <div class="features-list">
        <div class="feature-item">
          <div class="feature-icon coral">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <span class="feature-text">Discuss books together</span>
        </div>

        <div class="feature-item">
          <div class="feature-icon teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
          </div>
          <span class="feature-text">Vote on what to read next</span>
        </div>

        <div class="feature-item">
          <div class="feature-icon navy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <span class="feature-text">Track progress together</span>
        </div>
      </div>

      <p>New to PageSwipe? <a href="https://pageswipe.tech/app.html" class="signup-link">Create your free account</a> and start reading with friends.</p>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <a href="https://pageswipe.tech" class="footer-logo">
      <img src="https://pageswipe.tech/images/WraptIcon.png" alt="PageSwipe">
      <span>PageSwipe</span>
    </a>
    <div class="footer-links">
      <a href="https://pageswipe.tech">Home</a>
      <a href="https://pageswipe.tech/app.html">Open App</a>
      <a href="https://apps.apple.com/app/pageswipe" target="_blank" rel="noopener">iOS App</a>
    </div>
    <p class="footer-tagline">Your personal reading companion</p>
  </footer>
</body>
</html>`;
}

/**
 * Generate 404 page
 */
function generateNotFoundHtml(type) {
  const title = type === 'list' ? 'List Not Found' : type === 'club' ? 'Club Not Found' : 'Page Not Found';
  const message = type === 'list'
    ? 'This reading list may have been deleted or made private.'
    : type === 'club'
    ? 'This book club may have been deleted or the invite has expired.'
    : 'The page you are looking for does not exist.';
  const suggestion = type === 'list'
    ? 'Ask the owner to share a new link with you.'
    : type === 'club'
    ? 'Ask for a new invite code from the club owner.'
    : 'Double-check the URL or head back to the homepage.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - PageSwipe</title>
  <meta name="robots" content="noindex">
  <link rel="icon" type="image/png" href="https://pageswipe.tech/images/favicon-32.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: #1E3A5F;
      --primary-dark: #152d4a;
      --accent: #FF6B6B;
      --accent-light: #ff8a8a;
      --teal: #2DB3A0;
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-tertiary: #f1f5f9;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
      --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #0f172a;
        --bg-secondary: #1e293b;
        --bg-tertiary: #334155;
        --text-primary: #f1f5f9;
        --text-secondary: #cbd5e1;
        --text-muted: #94a3b8;
        --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.3);
        --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.4);
      }
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Main content */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.5rem;
      text-align: center;
    }

    /* Animated illustration */
    .illustration {
      position: relative;
      width: 200px;
      height: 200px;
      margin-bottom: 2rem;
    }

    .book-stack {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
    }

    .book {
      width: 80px;
      height: 12px;
      border-radius: 2px;
      margin-bottom: 4px;
      animation: bookFloat 3s ease-in-out infinite;
    }

    .book:nth-child(1) {
      background: linear-gradient(90deg, var(--accent), var(--accent-light));
      width: 70px;
      animation-delay: 0s;
    }

    .book:nth-child(2) {
      background: linear-gradient(90deg, var(--teal), #4fd1c5);
      width: 85px;
      animation-delay: 0.2s;
    }

    .book:nth-child(3) {
      background: linear-gradient(90deg, var(--primary), #2a4a6f);
      width: 75px;
      animation-delay: 0.4s;
    }

    @keyframes bookFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }

    .magnifier {
      position: absolute;
      top: 30px;
      right: 30px;
      width: 70px;
      height: 70px;
      animation: magnifierBob 2s ease-in-out infinite;
    }

    @keyframes magnifierBob {
      0%, 100% { transform: translateY(0) rotate(-15deg); }
      50% { transform: translateY(-10px) rotate(-10deg); }
    }

    .magnifier-glass {
      width: 50px;
      height: 50px;
      border: 5px solid var(--text-muted);
      border-radius: 50%;
      position: absolute;
      top: 0;
      left: 0;
    }

    .magnifier-handle {
      width: 6px;
      height: 25px;
      background: var(--text-muted);
      border-radius: 3px;
      position: absolute;
      bottom: -5px;
      right: 5px;
      transform: rotate(-45deg);
    }

    .question-mark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: 'Nunito', sans-serif;
      font-size: 28px;
      font-weight: 900;
      color: var(--accent);
      animation: questionPulse 2s ease-in-out infinite;
    }

    @keyframes questionPulse {
      0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.1); }
    }

    /* Content */
    .content {
      max-width: 420px;
    }

    .error-code {
      font-family: 'Nunito', sans-serif;
      font-size: 4rem;
      font-weight: 900;
      background: linear-gradient(135deg, var(--accent), var(--teal));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
      margin-bottom: 0.5rem;
      animation: fadeInUp 0.5s ease-out;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    h1 {
      font-family: 'Nunito', sans-serif;
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-primary);
      margin-bottom: 0.75rem;
      animation: fadeInUp 0.5s ease-out 0.1s both;
    }

    .message {
      font-size: 1rem;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
      animation: fadeInUp 0.5s ease-out 0.2s both;
    }

    .suggestion {
      font-size: 0.9375rem;
      color: var(--text-muted);
      margin-bottom: 2rem;
      animation: fadeInUp 0.5s ease-out 0.3s both;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, var(--accent), #ff5252);
      color: white;
      padding: 0.9rem 2rem;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
      font-size: 1rem;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 4px 14px rgba(255,107,107,0.4);
      border: none;
      cursor: pointer;
      animation: fadeInUp 0.5s ease-out 0.4s both;
    }

    .btn-primary:hover {
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 8px 25px rgba(255,107,107,0.5);
    }

    .btn-primary svg {
      width: 18px;
      height: 18px;
    }

    /* Pitch section */
    .pitch-section {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid var(--bg-tertiary);
      animation: fadeInUp 0.5s ease-out 0.5s both;
    }

    .pitch-section h2 {
      font-family: 'Nunito', sans-serif;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .pitch-section p {
      font-size: 0.9375rem;
      color: var(--text-secondary);
      margin-bottom: 1rem;
    }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      color: var(--teal);
      font-size: 0.9375rem;
      font-weight: 600;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .btn-secondary:hover {
      color: var(--accent);
    }

    .btn-secondary svg {
      width: 16px;
      height: 16px;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 1.5rem;
      border-top: 1px solid var(--bg-tertiary);
    }

    .footer-logo {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: var(--text-secondary);
      font-size: 0.875rem;
      transition: color 0.2s ease;
    }

    .footer-logo:hover {
      color: var(--text-primary);
    }

    .footer-logo img {
      width: 28px;
      height: 28px;
      border-radius: 8px;
    }

    .footer-logo span {
      font-family: 'Nunito', sans-serif;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main class="main">
    <!-- Animated Illustration -->
    <div class="illustration">
      <div class="magnifier">
        <div class="magnifier-glass"></div>
        <div class="magnifier-handle"></div>
        <span class="question-mark">?</span>
      </div>
      <div class="book-stack">
        <div class="book"></div>
        <div class="book"></div>
        <div class="book"></div>
      </div>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="error-code">404</div>
      <h1>${title}</h1>
      <p class="message">${message}</p>
      <p class="suggestion">${suggestion}</p>

      <a href="https://pageswipe.tech" class="btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        Go to Homepage
      </a>

      <!-- Pitch for PageSwipe -->
      <div class="pitch-section">
        <h2>While you're here...</h2>
        <p>PageSwipe helps you organize your reading, discover new books, and connect with book clubs.</p>
        <a href="https://pageswipe.tech/app.html" class="btn-secondary">
          Try PageSwipe free
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </a>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="footer">
    <a href="https://pageswipe.tech" class="footer-logo">
      <img src="https://pageswipe.tech/images/WraptIcon.png" alt="PageSwipe">
      <span>PageSwipe</span>
    </a>
  </footer>
</body>
</html>`;
}

/**
 * HTTP endpoint for viewing a public list
 * Route: /list/:shareId
 */
exports.getPublicList = onRequest(async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    // Extract shareId from path (format: /list/ABC123)
    const pathParts = req.path.split('/').filter(p => p);
    if (pathParts.length < 2 || pathParts[0] !== 'list') {
      res.status(400).send("Invalid path format. Expected: /list/{shareId}");
      return;
    }
    const shareId = pathParts[1].toUpperCase();

    if (!shareId || shareId.length !== 6) {
      res.status(400).send("Invalid share ID format");
      return;
    }

    console.log(`[getPublicList] Looking up list with shareId: ${shareId}`);

    // Find the list by publicShareId
    const listsSnapshot = await db.collection("lists")
      .where("publicShareId", "==", shareId)
      .limit(1)
      .get();

    if (listsSnapshot.empty) {
      console.log(`[getPublicList] List not found for shareId: ${shareId}`);
      res.status(404).send(generateNotFoundHtml('list'));
      return;
    }

    const listDoc = listsSnapshot.docs[0];
    const list = { id: listDoc.id, ...listDoc.data() };

    // Get owner info
    let owner = null;
    if (list.ownerId) {
      const ownerDoc = await db.collection("users").doc(list.ownerId).get();
      if (ownerDoc.exists) {
        owner = ownerDoc.data();
      }
    }

    // Get books in this list
    const itemsSnapshot = await db.collection("items")
      .where("listId", "==", listDoc.id)
      .orderBy("addedAt", "desc")
      .limit(100)
      .get();

    const books = itemsSnapshot.docs.map(doc => doc.data());

    console.log(`[getPublicList] Found list "${list.name}" with ${books.length} books`);

    // Generate and send HTML
    const html = generatePublicListHtml(list, owner, books);
    res.status(200).set('Content-Type', 'text/html').send(html);

  } catch (error) {
    console.error("[getPublicList] Error:", error);
    res.status(500).send("Internal server error");
  }
});

/**
 * HTTP endpoint for viewing a public club
 * Route: /club/:joinCode
 */
exports.getPublicClub = onRequest(async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    // Extract joinCode from path (format: /club/ABC123)
    const pathParts = req.path.split('/').filter(p => p);
    if (pathParts.length < 2 || pathParts[0] !== 'club') {
      res.status(400).send("Invalid path format. Expected: /club/{joinCode}");
      return;
    }
    const joinCode = pathParts[1].toUpperCase();

    if (!joinCode || joinCode.length !== 6) {
      res.status(400).send("Invalid join code format");
      return;
    }

    console.log(`[getPublicClub] Looking up club with joinCode: ${joinCode}`);

    // Find the club by joinCode
    const clubsSnapshot = await db.collection("clubs")
      .where("joinCode", "==", joinCode)
      .limit(1)
      .get();

    if (clubsSnapshot.empty) {
      console.log(`[getPublicClub] Club not found for joinCode: ${joinCode}`);
      res.status(404).send(generateNotFoundHtml('club'));
      return;
    }

    const clubDoc = clubsSnapshot.docs[0];
    const club = { id: clubDoc.id, ...clubDoc.data() };

    console.log(`[getPublicClub] Found club "${club.name}" with ${club.memberCount} members`);

    // Generate and send HTML
    const html = generatePublicClubHtml(club);
    res.status(200).set('Content-Type', 'text/html').send(html);

  } catch (error) {
    console.error("[getPublicClub] Error:", error);
    res.status(500).send("Internal server error");
  }
});

// =============================================================================
// ADMIN ANALYTICS DASHBOARD
// =============================================================================

/**
 * Get aggregate analytics for the admin dashboard
 * Returns: users, books, reviews, clubs counts and growth data
 *
 * Access: Only users with isAdmin: true in their Firestore user document
 */
exports.getAnalytics = onCall(async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to view analytics");
  }

  const userId = request.auth.uid;

  // Check if user has admin privileges in Firestore
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists || userDoc.data().isAdmin !== true) {
    throw new HttpsError("permission-denied", "Admin access required");
  }

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch all counts in parallel
    const [
      usersSnapshot,
      itemsSnapshot,
      reviewsSnapshot,
      clubsSnapshot,
      listsSnapshot,
      recentUsersSnapshot,
      recentItemsSnapshot,
      recentReviewsSnapshot,
      recentClubsSnapshot,
      proUsersSnapshot
    ] = await Promise.all([
      // Total counts
      db.collection("users").get(),
      db.collection("items").get(),
      db.collection("reviews").get(),
      db.collection("clubs").get(),
      db.collection("lists").get(),
      // Recent activity (last 30 days)
      db.collection("users").where("createdAt", ">=", thirtyDaysAgo).get(),
      db.collection("items").where("addedAt", ">=", thirtyDaysAgo).get(),
      db.collection("reviews").where("createdAt", ">=", thirtyDaysAgo).get(),
      db.collection("clubs").where("createdAt", ">=", thirtyDaysAgo).get(),
      // Pro users
      db.collection("users").where("isPro", "==", true).get()
    ]);

    // Calculate totals
    const totalUsers = usersSnapshot.size;
    const totalBooks = itemsSnapshot.size;
    const totalReviews = reviewsSnapshot.size;
    const totalClubs = clubsSnapshot.size;
    const totalLists = listsSnapshot.size;
    const proUsers = proUsersSnapshot.size;

    // Recent counts (last 30 days)
    const newUsersLast30Days = recentUsersSnapshot.size;
    const newBooksLast30Days = recentItemsSnapshot.size;
    const newReviewsLast30Days = recentReviewsSnapshot.size;
    const newClubsLast30Days = recentClubsSnapshot.size;

    // Calculate books by status
    let booksReading = 0;
    let booksRead = 0;
    let booksToRead = 0;
    itemsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === "reading") booksReading++;
      else if (data.status === "read") booksRead++;
      else if (data.status === "unread") booksToRead++;
    });

    // Calculate average rating from reviews
    let totalRating = 0;
    let ratingCount = 0;
    reviewsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.rating) {
        totalRating += data.rating;
        ratingCount++;
      }
    });
    const averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(2) : 0;

    // Build daily activity for last 30 days
    const dailyActivity = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      dailyActivity[dateKey] = { users: 0, books: 0, reviews: 0, clubs: 0 };
    }

    // Count users per day
    recentUsersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt) {
        const date = data.createdAt.toDate();
        const dateKey = date.toISOString().split('T')[0];
        if (dailyActivity[dateKey]) {
          dailyActivity[dateKey].users++;
        }
      }
    });

    // Count books per day
    recentItemsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.addedAt) {
        const date = data.addedAt.toDate();
        const dateKey = date.toISOString().split('T')[0];
        if (dailyActivity[dateKey]) {
          dailyActivity[dateKey].books++;
        }
      }
    });

    // Count reviews per day
    recentReviewsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt) {
        const date = data.createdAt.toDate();
        const dateKey = date.toISOString().split('T')[0];
        if (dailyActivity[dateKey]) {
          dailyActivity[dateKey].reviews++;
        }
      }
    });

    // Count clubs per day
    recentClubsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt) {
        const date = data.createdAt.toDate();
        const dateKey = date.toISOString().split('T')[0];
        if (dailyActivity[dateKey]) {
          dailyActivity[dateKey].clubs++;
        }
      }
    });

    // Convert to sorted array
    const dailyActivityArray = Object.entries(dailyActivity)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate week-over-week growth
    const last7DaysUsers = recentUsersSnapshot.docs.filter(doc => {
      const date = doc.data().createdAt?.toDate();
      return date && date >= sevenDaysAgo;
    }).length;

    const last7DaysBooks = recentItemsSnapshot.docs.filter(doc => {
      const date = doc.data().addedAt?.toDate();
      return date && date >= sevenDaysAgo;
    }).length;

    console.log(`[getAnalytics] Returning analytics: ${totalUsers} users, ${totalBooks} books, ${totalReviews} reviews, ${totalClubs} clubs`);

    return {
      totals: {
        users: totalUsers,
        books: totalBooks,
        reviews: totalReviews,
        clubs: totalClubs,
        lists: totalLists,
        proUsers: proUsers
      },
      booksByStatus: {
        reading: booksReading,
        read: booksRead,
        toRead: booksToRead
      },
      averageRating: parseFloat(averageRating),
      last30Days: {
        users: newUsersLast30Days,
        books: newBooksLast30Days,
        reviews: newReviewsLast30Days,
        clubs: newClubsLast30Days
      },
      last7Days: {
        users: last7DaysUsers,
        books: last7DaysBooks
      },
      dailyActivity: dailyActivityArray,
      generatedAt: now.toISOString()
    };
  } catch (error) {
    console.error("[getAnalytics] Error:", error);
    throw new HttpsError("internal", "Failed to fetch analytics");
  }
});
