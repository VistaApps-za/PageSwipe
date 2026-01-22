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
  const ownerName = escapeHtml(owner?.displayName || 'PageSwipe User');
  const bookCount = books.length;
  const ogImage = books.length > 0 && books[0].coverImageUrl
    ? books[0].coverImageUrl
    : 'https://pageswipe.tech/images/PageSwipeLogo.png';
  const ogDescription = listDescription || `A reading list with ${bookCount} book${bookCount !== 1 ? 's' : ''} curated by ${ownerName}`;

  const booksHtml = books.map(book => `
    <div class="book-card">
      <div class="book-cover">
        ${book.coverImageUrl
          ? `<img src="${escapeHtml(book.coverImageUrl)}" alt="${escapeHtml(book.title)}" loading="lazy">`
          : `<div class="no-cover"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>`
        }
      </div>
      <div class="book-info">
        <h3>${escapeHtml(truncateText(book.title, 50))}</h3>
        <p>${escapeHtml(truncateText((book.authors || []).join(', '), 40))}</p>
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
  <meta property="og:title" content="${listName} - PageSwipe">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" href="https://pageswipe.tech/images/favicon-32.png">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e3a5f; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
    .header { text-align: center; margin-bottom: 2rem; }
    .logo { width: 48px; height: 48px; border-radius: 12px; margin-bottom: 1rem; }
    h1 { font-family: 'Nunito', sans-serif; font-size: 1.75rem; margin-bottom: 0.5rem; }
    .owner { color: #64748b; font-size: 0.875rem; margin-bottom: 0.5rem; }
    .description { color: #64748b; font-size: 0.9rem; max-width: 500px; margin: 0 auto 1rem; }
    .count { background: linear-gradient(135deg, #2DB3A0, #1E3A5F); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: inline-block; }
    .books-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
    .book-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: transform 0.2s; }
    .book-card:hover { transform: translateY(-4px); }
    .book-cover { aspect-ratio: 2/3; background: #e2e8f0; display: flex; align-items: center; justify-content: center; }
    .book-cover img { width: 100%; height: 100%; object-fit: cover; }
    .no-cover { color: #94a3b8; }
    .book-info { padding: 0.75rem; }
    .book-info h3 { font-size: 0.8125rem; font-weight: 600; margin-bottom: 0.25rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .book-info p { font-size: 0.75rem; color: #64748b; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
    .cta { text-align: center; margin-top: 3rem; padding: 2rem; background: white; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .cta h2 { font-family: 'Nunito', sans-serif; font-size: 1.25rem; margin-bottom: 0.5rem; }
    .cta p { color: #64748b; font-size: 0.875rem; margin-bottom: 1rem; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1E3A5F, #162d4a); color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.875rem; }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(30,58,95,0.3); }
    @media (prefers-color-scheme: dark) {
      body { background: #0f172a; color: #f1f5f9; }
      .book-card { background: #1e293b; }
      .book-cover { background: #334155; }
      .cta { background: #1e293b; }
      .owner, .description, .book-info p, .cta p { color: #94a3b8; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://pageswipe.tech/images/WraptIcon.png" alt="PageSwipe" class="logo">
      <h1>${listName}</h1>
      <p class="owner">by ${ownerName}</p>
      ${listDescription ? `<p class="description">${escapeHtml(listDescription)}</p>` : ''}
      <span class="count">${bookCount} book${bookCount !== 1 ? 's' : ''}</span>
    </div>
    <div class="books-grid">${booksHtml}</div>
    <div class="cta">
      <h2>Start your reading journey</h2>
      <p>Discover books, track your reading, and join book clubs.</p>
      <a href="https://pageswipe.tech/app.html" class="btn">Open PageSwipe</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML for public club page
 */
function generatePublicClubHtml(club) {
  const clubName = escapeHtml(club.name);
  const clubDescription = escapeHtml(club.description || '');
  const ownerName = escapeHtml(club.ownerName || 'PageSwipe User');
  const memberCount = club.memberCount || 0;
  const currentBook = club.currentBookTitle ? escapeHtml(club.currentBookTitle) : null;
  const ogImage = club.currentBookCoverUrl || club.coverImageUrl || 'https://pageswipe.tech/images/PageSwipeLogo.png';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${clubName} - PageSwipe Book Club</title>
  <meta name="description" content="${clubDescription || `A book club with ${memberCount} member${memberCount !== 1 ? 's' : ''}`}">
  <meta property="og:title" content="${clubName} - PageSwipe Book Club">
  <meta property="og:description" content="${clubDescription || `Join this book club on PageSwipe`}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" href="https://pageswipe.tech/images/favicon-32.png">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e3a5f; line-height: 1.5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { max-width: 500px; margin: 0 auto; padding: 2rem 1rem; text-align: center; }
    .logo { width: 48px; height: 48px; border-radius: 12px; margin-bottom: 1.5rem; }
    .club-card { background: white; border-radius: 20px; padding: 2rem; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { font-family: 'Nunito', sans-serif; font-size: 1.5rem; margin-bottom: 0.5rem; }
    .owner { color: #64748b; font-size: 0.875rem; margin-bottom: 1rem; }
    .description { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .stats { display: flex; justify-content: center; gap: 2rem; margin-bottom: 1.5rem; }
    .stat { text-align: center; }
    .stat-value { font-family: 'Nunito', sans-serif; font-size: 1.5rem; font-weight: 700; color: #1E3A5F; }
    .stat-label { font-size: 0.75rem; color: #64748b; }
    .current-book { background: #f1f5f9; border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; }
    .current-book-label { font-size: 0.75rem; color: #64748b; margin-bottom: 0.25rem; }
    .current-book-title { font-weight: 600; }
    .join-code { background: linear-gradient(135deg, #2DB3A0, #1E3A5F); color: white; padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; }
    .join-code-label { font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.25rem; }
    .join-code-value { font-family: 'Nunito', sans-serif; font-size: 1.75rem; font-weight: 800; letter-spacing: 0.2em; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1E3A5F, #162d4a); color: white; padding: 0.875rem 2rem; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(30,58,95,0.3); }
    @media (prefers-color-scheme: dark) {
      body { background: #0f172a; color: #f1f5f9; }
      .club-card { background: #1e293b; }
      .current-book { background: #334155; }
      .owner, .description, .stat-label, .current-book-label { color: #94a3b8; }
      .stat-value { color: #f1f5f9; }
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="https://pageswipe.tech/images/WraptIcon.png" alt="PageSwipe" class="logo">
    <div class="club-card">
      <h1>${clubName}</h1>
      <p class="owner">Created by ${ownerName}</p>
      ${clubDescription ? `<p class="description">${escapeHtml(clubDescription)}</p>` : ''}
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${memberCount}</div>
          <div class="stat-label">Member${memberCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="stat">
          <div class="stat-value">${club.booksCompleted || 0}</div>
          <div class="stat-label">Books Read</div>
        </div>
      </div>
      ${currentBook ? `
        <div class="current-book">
          <div class="current-book-label">Currently Reading</div>
          <div class="current-book-title">${currentBook}</div>
        </div>
      ` : ''}
      <div class="join-code">
        <div class="join-code-label">Join Code</div>
        <div class="join-code-value">${escapeHtml(club.joinCode)}</div>
      </div>
      <a href="https://pageswipe.tech/app.html" class="btn">Join on PageSwipe</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate 404 page
 */
function generateNotFoundHtml(type) {
  const title = type === 'list' ? 'List Not Found' : 'Club Not Found';
  const message = type === 'list'
    ? 'This reading list may have been deleted or the link is invalid.'
    : 'This book club may have been deleted or the link is invalid.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - PageSwipe</title>
  <link rel="icon" type="image/png" href="https://pageswipe.tech/images/favicon-32.png">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e3a5f; min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem; }
    .container { max-width: 400px; }
    .logo { width: 64px; height: 64px; border-radius: 16px; margin-bottom: 1.5rem; }
    h1 { font-family: 'Nunito', sans-serif; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #64748b; margin-bottom: 1.5rem; }
    .btn { display: inline-block; background: linear-gradient(135deg, #1E3A5F, #162d4a); color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; }
    @media (prefers-color-scheme: dark) { body { background: #0f172a; color: #f1f5f9; } p { color: #94a3b8; } }
  </style>
</head>
<body>
  <div class="container">
    <img src="https://pageswipe.tech/images/WraptIcon.png" alt="PageSwipe" class="logo">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://pageswipe.tech" class="btn">Go to PageSwipe</a>
  </div>
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
