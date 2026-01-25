/**
 * PageSwipe Book Lookup Service
 * Handles book searches using Cloud Functions and fallback APIs
 */

import { getCachedBook, getWorkByIsbn, searchWorksByTitle } from './db-service.js';
import { db, functions } from './firebase-config.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js';
import {
    doc,
    getDoc,
    setDoc,
    getDocs,
    deleteDoc,
    collection,
    query,
    where,
    serverTimestamp,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// Cloud function references
const discoverBooksFunction = httpsCallable(functions, 'discoverBooks');
const lookupBookFunction = httpsCallable(functions, 'lookupBook');

// API endpoints (fallback)
const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_API = 'https://openlibrary.org';
const OPEN_LIBRARY_COVERS = 'https://covers.openlibrary.org/b/isbn';

// Discovery genres - must match cloud function
export const DISCOVERY_GENRES = [
    { id: "random", label: "Random" },
    { id: "romance", label: "Romance" },
    { id: "thriller", label: "Thriller" },
    { id: "mystery", label: "Mystery" },
    { id: "fantasy", label: "Fantasy" },
    { id: "scifi", label: "Sci-Fi" },
    { id: "horror", label: "Horror" },
    { id: "literary", label: "Literary Fiction" },
    { id: "historical", label: "Historical Fiction" },
    { id: "contemporary", label: "Contemporary" },
    { id: "youngadult", label: "Young Adult" },
    { id: "selfhelp", label: "Self-Help" },
    { id: "biography", label: "Biography" },
    { id: "business", label: "Business" },
    { id: "psychology", label: "Psychology" },
    { id: "truecrime", label: "True Crime" }
];

/**
 * Search for books by query (title, author, or ISBN)
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum results to return
 * @returns {Promise<Object>} - Search results
 */
export async function searchBooks(query, maxResults = 20) {
    try {
        // Check if query looks like an ISBN
        const cleanQuery = query.replace(/[-\s]/g, '');
        if (/^\d{10,13}$/.test(cleanQuery)) {
            return await lookupByISBN(cleanQuery);
        }

        // First, check works cache for matching titles (non-blocking - always fall through to API if cache fails)
        try {
            console.log(`searchBooks: Checking works cache for "${query}"`);
            const worksResult = await searchWorksByTitle(query, maxResults);
            if (worksResult.success && worksResult.data && worksResult.data.length > 0) {
                console.log(`searchBooks: Found ${worksResult.data.length} results in works cache`);
                return { success: true, data: worksResult.data };
            }
            console.log(`searchBooks: No cache results, searching Google Books API`);
        } catch (cacheError) {
            console.warn('Works cache search failed, falling back to API:', cacheError);
        }

        // No cache results - search using Google Books
        const response = await fetch(
            `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(query)}&maxResults=${maxResults}&orderBy=relevance&printType=books&langRestrict=en&key=AIzaSyCD47NvRYDd1tOBg8y_qkaCT2N9slSp43I`
        );

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return { success: true, data: [] };
        }

        const books = data.items
            .map(item => parseGoogleBooksResult(item))
            .filter(book => book.title); // Filter out items without titles

        // Note: Cloud Functions handle caching - clients are read-only
        return { success: true, data: books };
    } catch (error) {
        console.error('Search books error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Lookup book by ISBN
 * Uses works cache first, then Cloud Function, then direct API
 * @param {string} isbn - ISBN (10 or 13 digits)
 * @returns {Promise<Object>} - Book data
 */
export async function lookupByISBN(isbn) {
    try {
        // First check works cache (new architecture) - non-blocking on failure
        try {
            console.log(`lookupByISBN: Checking works cache for ISBN ${isbn}`);
            const workResult = await getWorkByIsbn(isbn);
            if (workResult.success) {
                console.log(`lookupByISBN: Found in works cache - "${workResult.data.title}"`);
                return { success: true, data: [workResult.data] };
            }
        } catch (cacheError) {
            console.warn('lookupByISBN: Works cache check failed:', cacheError);
        }

        // Fall back to legacy cache check - non-blocking on failure
        try {
            console.log(`lookupByISBN: Checking legacy cache for ISBN ${isbn}`);
            const cached = await getCachedBook(isbn);
            if (cached.success) {
                console.log(`lookupByISBN: Found in legacy cache`);
                return { success: true, data: [cached.data] };
            }
        } catch (legacyCacheError) {
            console.warn('lookupByISBN: Legacy cache check failed:', legacyCacheError);
        }

        // Use Cloud Function (handles enhancement and caching automatically)
        try {
            console.log('lookupByISBN: Calling Cloud Function for ISBN:', isbn);
            const result = await lookupBookFunction({ isbn });
            console.log('lookupByISBN: Cloud Function result:', result.data);
            if (result.data?.success && result.data?.book) {
                const book = result.data.book;
                // Note: Cloud Function handles caching - clients are read-only
                return { success: true, data: [book] };
            }
        } catch (cloudError) {
            console.error('lookupByISBN: Cloud Function lookup failed:', cloudError);
        }

        // Fallback to direct Google Books API with client-side enhancement
        console.log('lookupByISBN: Falling back to direct Google Books API');
        const googleResult = await fetchFromGoogleBooks(isbn);
        if (googleResult.success) {
            const book = googleResult.data;

            // If missing cover or description, try to find a better version by title+author
            if (!book.coverImageUrl || !book.description) {
                const enhancedBook = await enhanceBookData(book, isbn);
                // Note: Cloud Functions handle caching - clients are read-only
                return { success: true, data: [enhancedBook] };
            }

            // Note: Cloud Functions handle caching - clients are read-only
            return { success: true, data: [book] };
        }

        return { success: false, error: 'Book not found' };
    } catch (error) {
        console.error('ISBN lookup error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Enhance book data by searching for a better version with cover/description
 * @param {Object} originalBook - The original book from ISBN lookup
 * @param {string} originalIsbn - The original ISBN to preserve
 */
async function enhanceBookData(originalBook, originalIsbn) {
    try {
        if (!originalBook.title) return originalBook;

        // Search by title and author
        const searchQuery = originalBook.authors?.length > 0
            ? `${originalBook.title} ${originalBook.authors[0]}`
            : originalBook.title;

        const encodedQuery = encodeURIComponent(searchQuery);
        const response = await fetch(`${GOOGLE_BOOKS_API}?q=${encodedQuery}&maxResults=5&key=AIzaSyCD47NvRYDd1tOBg8y_qkaCT2N9slSp43I`);

        if (!response.ok) return originalBook;

        const data = await response.json();
        if (!data.items || data.items.length === 0) return originalBook;

        // Find the best match with cover and description
        for (const item of data.items) {
            const volumeInfo = item.volumeInfo || {};

            // Check if this is the same book (title match)
            const titleMatch = volumeInfo.title?.toLowerCase().includes(originalBook.title.toLowerCase()) ||
                originalBook.title.toLowerCase().includes(volumeInfo.title?.toLowerCase() || '');

            if (!titleMatch) continue;

            const hasGoodCover = volumeInfo.imageLinks?.thumbnail;
            const hasDescription = volumeInfo.description;

            // If this version has what we're missing, use it to fill gaps
            if (hasGoodCover || hasDescription) {
                const enhanced = { ...originalBook };
                enhanced.isbn = originalIsbn; // Keep original ISBN

                if (!enhanced.coverImageUrl && hasGoodCover) {
                    enhanced.coverImageUrl = volumeInfo.imageLinks.thumbnail
                        .replace('http:', 'https:')
                        .replace('zoom=1', 'zoom=2');
                }

                if (!enhanced.description && hasDescription) {
                    enhanced.description = volumeInfo.description;
                }

                // If we now have both, we're done
                // Note: Cloud Functions handle caching - clients are read-only
                if (enhanced.coverImageUrl && enhanced.description) {
                    return enhanced;
                }
            }
        }

        // Return whatever we have (original or partially enhanced)
        return originalBook;
    } catch (error) {
        console.error('Error enhancing book data:', error);
        return originalBook;
    }
}

/**
 * Fetch book from Open Library
 * @param {string} isbn - ISBN
 */
async function fetchFromOpenLibrary(isbn) {
    try {
        const response = await fetch(`${OPEN_LIBRARY_API}/isbn/${isbn}.json`);

        if (!response.ok) {
            return { success: false, error: 'Book not found' };
        }

        const data = await response.json();

        // Get author names (requires additional API calls)
        let authors = [];
        if (data.authors && data.authors.length > 0) {
            const authorPromises = data.authors.slice(0, 3).map(async (author) => {
                try {
                    const authorResponse = await fetch(`${OPEN_LIBRARY_API}${author.key}.json`);
                    if (authorResponse.ok) {
                        const authorData = await authorResponse.json();
                        return authorData.name;
                    }
                    return null;
                } catch {
                    return null;
                }
            });
            authors = (await Promise.all(authorPromises)).filter(name => name);
        }

        // Parse description
        let description = null;
        if (data.description) {
            description = typeof data.description === 'string'
                ? data.description
                : data.description.value;
        }

        const book = {
            id: isbn,
            isbn: isbn,
            isbn13: isbn.length === 13 ? isbn : null,
            title: data.title,
            authors: authors,
            coverImageUrl: `${OPEN_LIBRARY_COVERS}/${isbn}-L.jpg`,
            description: description,
            pageCount: data.number_of_pages || null,
            publishDate: data.publish_date || null,
            publisher: data.publishers ? data.publishers[0] : null,
            genre: null,
            categories: data.subjects ? data.subjects.slice(0, 3) : [],
            language: 'en',
            apiSource: 'openLibrary'
        };

        // Note: Cloud Functions handle caching - clients are read-only
        return { success: true, data: book };
    } catch (error) {
        console.error('Open Library fetch error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetch book from Google Books
 * @param {string} isbn - ISBN
 */
async function fetchFromGoogleBooks(isbn) {
    try {
        const response = await fetch(`${GOOGLE_BOOKS_API}?q=isbn:${isbn}&key=AIzaSyCD47NvRYDd1tOBg8y_qkaCT2N9slSp43I`);

        if (!response.ok) {
            return { success: false, error: 'Book not found' };
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return { success: false, error: 'Book not found' };
        }

        const book = parseGoogleBooksResult(data.items[0]);
        book.isbn = isbn;

        // Cache the book
        await cacheBook(book);

        return { success: true, data: book };
    } catch (error) {
        console.error('Google Books fetch error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Parse Google Books API result
 * @param {Object} item - API response item
 */
function parseGoogleBooksResult(item) {
    const volumeInfo = item.volumeInfo || {};
    const identifiers = volumeInfo.industryIdentifiers || [];

    // Find ISBN-13 or ISBN-10
    const isbn13 = identifiers.find(i => i.type === 'ISBN_13');
    const isbn10 = identifiers.find(i => i.type === 'ISBN_10');
    const isbn = isbn13?.identifier || isbn10?.identifier || item.id;

    // Get cover image (use larger size, convert to HTTPS)
    let coverUrl = null;
    if (volumeInfo.imageLinks) {
        coverUrl = volumeInfo.imageLinks.thumbnail ||
            volumeInfo.imageLinks.smallThumbnail;
        if (coverUrl) {
            coverUrl = coverUrl.replace('http:', 'https:');
            // Try to get larger image
            coverUrl = coverUrl.replace('zoom=1', 'zoom=2');
        }
    }

    return {
        id: item.id,
        isbn: isbn,
        isbn13: isbn13?.identifier || null,
        title: volumeInfo.title || 'Unknown Title',
        authors: volumeInfo.authors || [],
        coverImageUrl: coverUrl,
        description: volumeInfo.description || null,
        pageCount: volumeInfo.pageCount || null,
        publishDate: volumeInfo.publishedDate || null,
        publisher: volumeInfo.publisher || null,
        genre: volumeInfo.categories ? volumeInfo.categories[0] : null,
        categories: volumeInfo.categories || [],
        language: volumeInfo.language || 'en',
        averageRating: volumeInfo.averageRating || null,
        ratingsCount: volumeInfo.ratingsCount || null,
        apiSource: 'googleBooks'
    };
}

/**
 * Discover books using cloud function
 * @param {string} genre - Genre ID (default: 'random')
 * @param {string[]} excludeISBNs - ISBNs to exclude from results
 * @param {number} limit - Maximum results (default: 20)
 * @param {Object} userPreferences - Optional user preferences for personalization
 */
export async function discoverBooks(genre = 'random', excludeISBNs = [], limit = 20, userPreferences = null) {
    try {
        const params = {
            genre,
            excludeISBNs,
            limit
        };

        if (userPreferences) {
            params.userPreferences = userPreferences;
        }

        const result = await discoverBooksFunction(params);

        if (result.data && result.data.success && Array.isArray(result.data.books)) {
            // Validate and filter books to ensure they have required fields
            const validBooks = result.data.books.filter(book =>
                book &&
                typeof book.title === 'string' &&
                book.title.length > 0 &&
                book.title !== genre // Ensure title isn't accidentally the genre
            );

            // Return even if 0 books - this is valid when all books have been seen
            return { success: true, data: validBooks, genre: result.data.genre };
        }

        // If cloud function returns invalid structure, use fallback
        console.warn('Cloud function returned invalid data structure, using fallback');
        return await getDiscoveryBooksFallback(genre, limit, excludeISBNs);
    } catch (error) {
        console.error('Discover books cloud function error:', error);
        // Fallback to local API if cloud function fails
        return await getDiscoveryBooksFallback(genre, limit, excludeISBNs);
    }
}

/**
 * Get book recommendations based on genre (uses cloud function)
 * @param {string} genre - Genre ID to search for
 * @param {number} maxResults - Maximum results
 * @param {string[]} excludeISBNs - ISBNs to exclude
 */
export async function getRecommendationsByGenre(genre, maxResults = 10, excludeISBNs = []) {
    return await discoverBooks(genre, excludeISBNs, maxResults);
}

/**
 * Get popular/trending books for discovery (uses cloud function)
 * @param {number} maxResults - Maximum results
 * @param {string[]} excludeISBNs - ISBNs to exclude
 */
export async function getDiscoveryBooks(maxResults = 20, excludeISBNs = []) {
    return await discoverBooks('random', excludeISBNs, maxResults);
}

/**
 * Fallback discovery using direct API calls (when cloud function is unavailable)
 * @param {string} genre - Genre to search for
 * @param {number} maxResults - Maximum results
 * @param {string[]} excludeISBNs - ISBNs to exclude from results
 */
async function getDiscoveryBooksFallback(genre, maxResults = 20, excludeISBNs = []) {
    try {
        let searchQuery;

        if (genre === 'random' || !genre) {
            const discoveryQueries = [
                'bestseller fiction 2024',
                'popular books 2024',
                'New York Times bestseller',
                'BookTok recommendations',
                'award winning fiction'
            ];
            searchQuery = discoveryQueries[Math.floor(Math.random() * discoveryQueries.length)];
        } else {
            const queries = getGenreSearchQueries(genre);
            searchQuery = queries[Math.floor(Math.random() * queries.length)];
        }

        const response = await fetch(
            `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(searchQuery)}&maxResults=${maxResults}&orderBy=relevance&printType=books&langRestrict=en&key=AIzaSyCD47NvRYDd1tOBg8y_qkaCT2N9slSp43I`
        );

        if (!response.ok) {
            throw new Error('Fetch failed');
        }

        const data = await response.json();

        if (!data.items) {
            return { success: true, data: [] };
        }

        const books = data.items
            .map(item => parseGoogleBooksResult(item))
            .filter(book =>
                book.title &&
                book.coverImageUrl &&
                book.description &&
                book.description.length > 50 &&
                // Exclude already seen ISBNs
                (!book.isbn || !excludeISBNs.includes(book.isbn))
            );

        const shuffled = books.sort(() => Math.random() - 0.5);

        return { success: true, data: shuffled };
    } catch (error) {
        console.error('Get discovery books fallback error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get genre-specific search queries
 * @param {string} genre - Genre ID (matches dropdown values)
 */
function getGenreSearchQueries(genre) {
    // Map genre IDs to search queries (must match dropdown values)
    const genreQueries = {
        'random': ['bestseller fiction 2024', 'BookTok recommendations', 'popular books 2024'],
        'romance': ['Colleen Hoover romance', 'Emily Henry romance', 'romance novel bestseller'],
        'thriller': ['Freida McFadden thriller', 'psychological thriller bestseller', 'The Housemaid'],
        'mystery': ['mystery thriller', 'detective fiction', 'crime novel bestseller'],
        'fantasy': ['Sarah J Maas fantasy', 'Fourth Wing', 'romantasy bestseller'],
        'scifi': ['Project Hail Mary', 'science fiction bestseller', 'Blake Crouch novel'],
        'horror': ['Stephen King horror', 'horror fiction bestseller', 'supernatural horror'],
        'literary': ['Booker Prize winner', 'literary fiction bestseller', 'book club fiction'],
        'historical': ['Kristin Hannah historical', 'historical fiction bestseller', 'World War II novel'],
        'contemporary': ['contemporary fiction bestseller', 'Reese Book Club pick', 'women fiction'],
        'youngadult': ['YA fantasy bestseller', 'young adult romance', 'YA fiction bestseller'],
        'selfhelp': ['Atomic Habits', 'self improvement bestseller', 'Brene Brown book'],
        'biography': ['biography bestseller', 'memoir bestseller', 'celebrity memoir'],
        'business': ['business bestseller book', 'startup book', 'leadership book'],
        'psychology': ['psychology bestseller book', 'Thinking Fast and Slow', 'behavioral psychology'],
        'truecrime': ['true crime bestseller', 'true crime book', 'murder investigation book']
    };

    const queries = genreQueries[genre.toLowerCase()];
    if (queries) {
        return queries;
    }

    // Fallback for unknown genres
    return [`${genre} bestseller`, `${genre} fiction`, `popular ${genre}`];
}

/**
 * Validate if cover image URL is valid
 * @param {string} url - Image URL
 */
export async function validateCoverImage(url) {
    if (!url) return false;

    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok && response.headers.get('content-type')?.startsWith('image/');
    } catch {
        return false;
    }
}

// ============================================
// USER PREFERENCES (Matching iOS DataManager)
// ============================================

/**
 * Interaction types with scoring - matches iOS InteractionType enum
 */
export const INTERACTION_TYPES = {
    swipeRight: { genrePoints: 1, authorPoints: 0 },
    swipeLeft: { genrePoints: -1, authorPoints: 0 },
    addToList: { genrePoints: 2, authorPoints: 0 },
    startReading: { genrePoints: 3, authorPoints: 1 },
    finishBook: { genrePoints: 5, authorPoints: 3 },
    rateHighly: { genrePoints: 3, authorPoints: 2 },
    ratePoorly: { genrePoints: -2, authorPoints: -1 },
    abandonBook: { genrePoints: -2, authorPoints: 0 }
};

/**
 * Load user preferences from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User preferences object
 */
export async function loadUserPreferences(userId) {
    if (!userId) return createDefaultPreferences(userId);

    try {
        const prefsDoc = await getDoc(doc(db, 'userPreferences', userId));
        if (prefsDoc.exists()) {
            return prefsDoc.data();
        }
        return createDefaultPreferences(userId);
    } catch (error) {
        console.error('Load user preferences error:', error);
        return createDefaultPreferences(userId);
    }
}

/**
 * Create default preferences object - matches iOS UserPreferences struct
 * @param {string} userId - User ID
 */
function createDefaultPreferences(userId) {
    return {
        userId: userId || '',
        genreScores: {},
        authorScores: {},
        avgPageCount: null,
        preferredPageRange: null,
        totalInteractions: 0,
        positiveInteractions: 0,
        negativeInteractions: 0,
        skippedTitles: [],
        lastUpdated: null
    };
}

/**
 * Save user preferences to Firestore
 * @param {string} userId - User ID
 * @param {Object} preferences - Preferences object
 */
export async function saveUserPreferences(userId, preferences) {
    if (!userId) return;

    try {
        await setDoc(doc(db, 'userPreferences', userId), {
            ...preferences,
            lastUpdated: serverTimestamp()
        });
    } catch (error) {
        console.error('Save user preferences error:', error);
    }
}

/**
 * Extract genres from a book - matches iOS extractGenres function
 * @param {Object} book - Book object
 * @returns {string[]} - Array of genre strings
 */
function extractGenres(book) {
    const genres = [];

    if (book.genre) {
        genres.push(book.genre.toLowerCase());
    }

    if (book.categories && Array.isArray(book.categories)) {
        book.categories.forEach(category => {
            if (category && typeof category === 'string') {
                genres.push(category.toLowerCase());
            }
        });
    }

    // Deduplicate
    return [...new Set(genres)];
}

/**
 * Track a book interaction and update user preferences - matches iOS trackInteraction
 * @param {string} userId - User ID
 * @param {Object} book - Book object with genres/categories and authors
 * @param {string} interactionType - One of INTERACTION_TYPES keys
 * @param {Object} currentPreferences - Current preferences (optional, will load if not provided)
 * @returns {Promise<Object>} - Updated preferences
 */
export async function trackBookInteraction(userId, book, interactionType, currentPreferences = null) {
    if (!userId || !book) return currentPreferences;

    const interaction = INTERACTION_TYPES[interactionType];
    if (!interaction) {
        console.warn('Unknown interaction type:', interactionType);
        return currentPreferences;
    }

    // Load current preferences if not provided
    let prefs = currentPreferences || await loadUserPreferences(userId);

    const genres = extractGenres(book);
    const authors = book.authors || [];

    // Update genre scores
    for (const genre of genres) {
        const currentScore = prefs.genreScores[genre] || 0;
        prefs.genreScores[genre] = currentScore + interaction.genrePoints;
    }

    // Update author scores (only if interaction affects authors)
    if (interaction.authorPoints !== 0) {
        for (const author of authors) {
            const currentScore = prefs.authorScores[author] || 0;
            prefs.authorScores[author] = currentScore + interaction.authorPoints;
        }
    }

    // Update interaction counts
    prefs.totalInteractions += 1;
    if (interaction.genrePoints > 0) {
        prefs.positiveInteractions += 1;
    } else if (interaction.genrePoints < 0) {
        prefs.negativeInteractions += 1;
    }

    // Update page count average if book has page count
    if (book.pageCount && book.pageCount > 0 && interaction.genrePoints > 0) {
        if (prefs.avgPageCount && prefs.avgPageCount > 0) {
            const total = Math.max(1, prefs.positiveInteractions);
            const previousTotal = Math.max(0, total - 1);
            const newAvg = ((prefs.avgPageCount * previousTotal) + book.pageCount) / total;
            prefs.avgPageCount = Math.max(1, Math.round(newAvg));
        } else {
            prefs.avgPageCount = book.pageCount;
        }
    }

    // Save to Firestore
    await saveUserPreferences(userId, prefs);

    return prefs;
}

/**
 * Normalize a book title for comparison - matches iOS normalizeBookTitle
 * @param {string} title - Book title
 * @returns {string} - Normalized title
 */
function normalizeBookTitle(title) {
    if (!title) return '';

    let normalized = title.toLowerCase();

    // Remove content after common separators (subtitles, edition info)
    const separators = [':', ' - ', ' – ', ' — ', '(', '['];
    for (const separator of separators) {
        const index = normalized.indexOf(separator);
        if (index > 0) {
            normalized = normalized.substring(0, index);
        }
    }

    // Remove common words and trim
    normalized = normalized
        .replace(/\bthe\b/g, '')
        .replace(/\ba\b/g, '')
        .replace(/\ban\b/g, '')
        .trim();

    return normalized;
}

/**
 * Add a skipped title to user preferences - matches iOS addSkippedTitle
 * @param {string} userId - User ID
 * @param {string} title - Book title to skip
 * @param {Object} currentPreferences - Current preferences (optional)
 */
export async function addSkippedTitle(userId, title, currentPreferences = null) {
    if (!userId || !title) return;

    const normalizedTitle = normalizeBookTitle(title);
    let prefs = currentPreferences || await loadUserPreferences(userId);

    // Don't add duplicates
    if (prefs.skippedTitles.includes(normalizedTitle)) return;

    prefs.skippedTitles.push(normalizedTitle);
    console.log(`📚 Added '${normalizedTitle}' to skipped titles`);

    await saveUserPreferences(userId, prefs);
}

/**
 * Check if a book title should be skipped - matches iOS shouldSkipTitle
 * @param {string} title - Book title
 * @param {Object} preferences - User preferences
 * @returns {boolean}
 */
export function shouldSkipTitle(title, preferences) {
    if (!preferences || !preferences.skippedTitles) return false;
    const normalizedTitle = normalizeBookTitle(title);
    return preferences.skippedTitles.includes(normalizedTitle);
}

/**
 * Get top genres from preferences - matches iOS topGenres
 * @param {Object} preferences - User preferences
 * @param {number} limit - Max genres to return
 * @returns {string[]}
 */
export function getTopGenres(preferences, limit = 5) {
    if (!preferences || !preferences.genreScores) return [];

    return Object.entries(preferences.genreScores)
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([genre, _]) => genre);
}

/**
 * Get top authors from preferences - matches iOS topAuthors
 * @param {Object} preferences - User preferences
 * @param {number} limit - Max authors to return
 * @returns {string[]}
 */
export function getTopAuthors(preferences, limit = 3) {
    if (!preferences || !preferences.authorScores) return [];

    return Object.entries(preferences.authorScores)
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([author, _]) => author);
}

/**
 * Check if preferences have enough data for personalization
 * @param {Object} preferences - User preferences
 * @returns {boolean}
 */
export function hasEnoughPreferenceData(preferences) {
    if (!preferences) return false;
    return preferences.totalInteractions >= 5 && Object.keys(preferences.genreScores).length > 0;
}

// ============================================
// BOOK INTERACTIONS (Not Interested tracking)
// ============================================

/**
 * Record a "not interested" interaction - stores in bookInteractions collection
 * Matches iOS implementation in DataManager
 * @param {string} userId - User ID
 * @param {string} isbn - Book ISBN
 * @param {string} interactionType - Type of interaction (e.g., 'notInterested')
 */
export async function recordBookInteraction(userId, isbn, interactionType = 'notInterested') {
    if (!userId || !isbn) return;

    try {
        const interactionRef = doc(db, 'bookInteractions', isbn, 'users', userId);
        await setDoc(interactionRef, {
            interactionType: interactionType,
            timestamp: serverTimestamp(),
            userId: userId
        });
        console.log(`📕 Recorded ${interactionType} for ISBN: ${isbn}`);
    } catch (error) {
        console.error('Record book interaction error:', error);
    }
}

/**
 * Check if user has a specific interaction with a book
 * @param {string} userId - User ID
 * @param {string} isbn - Book ISBN
 * @returns {Promise<Object|null>} - Interaction data or null
 */
export async function getBookInteraction(userId, isbn) {
    if (!userId || !isbn) return null;

    try {
        const interactionRef = doc(db, 'bookInteractions', isbn, 'users', userId);
        const interactionDoc = await getDoc(interactionRef);

        if (interactionDoc.exists()) {
            return interactionDoc.data();
        }
        return null;
    } catch (error) {
        console.error('Get book interaction error:', error);
        return null;
    }
}

/**
 * Get all ISBNs user has marked as "not interested"
 * @param {string} userId - User ID
 * @returns {Promise<Set<string>>} - Set of ISBNs
 */
export async function getNotInterestedISBNs(userId) {
    if (!userId) return new Set();

    try {
        // Query all bookInteractions where this user has an entry
        // Note: This requires querying each isbn subcollection, which is expensive
        // For efficiency, we'll track this locally during the session
        // and only query when needed for filtering
        return new Set();
    } catch (error) {
        console.error('Get not interested ISBNs error:', error);
        return new Set();
    }
}

// ============================================
// DISCOVERY HISTORY (Prevent re-showing books)
// ============================================

const DISCOVERY_HISTORY_DAYS = 30;

/**
 * Load discovery history for a user - matches iOS
 * @param {string} userId - User ID
 * @returns {Promise<Map<string, Date>>} - Map of ISBN -> shownAt date
 */
export async function loadDiscoveryHistory(userId) {
    if (!userId) return new Map();

    try {
        const historyRef = collection(db, 'users', userId, 'discoveryHistory');
        const snapshot = await getDocs(historyRef);

        const history = new Map();
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (DISCOVERY_HISTORY_DAYS * 24 * 60 * 60 * 1000));

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const shownAt = data.shownAt?.toDate?.() || new Date(data.shownAt);

            // Only include entries within the last 30 days
            if (shownAt > cutoffDate) {
                history.set(doc.id, shownAt);
            }
        });

        return history;
    } catch (error) {
        console.error('Load discovery history error:', error);
        return new Map();
    }
}

/**
 * Save a book to discovery history
 * @param {string} userId - User ID
 * @param {string} isbn - Book ISBN
 */
export async function saveToDiscoveryHistory(userId, isbn) {
    if (!userId || !isbn) return;

    try {
        const historyRef = doc(db, 'users', userId, 'discoveryHistory', isbn);
        await setDoc(historyRef, {
            shownAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Save to discovery history error:', error);
    }
}

/**
 * Save multiple books to discovery history at once
 * @param {string} userId - User ID
 * @param {string[]} isbns - Array of ISBNs
 */
export async function saveMultipleToDiscoveryHistory(userId, isbns) {
    if (!userId || !isbns || isbns.length === 0) return;

    try {
        // Save each ISBN (could be optimized with batch writes if needed)
        await Promise.all(isbns.map(isbn => saveToDiscoveryHistory(userId, isbn)));
    } catch (error) {
        console.error('Save multiple to discovery history error:', error);
    }
}

/**
 * Clean up old discovery history entries (older than 30 days)
 * @param {string} userId - User ID
 */
export async function cleanupDiscoveryHistory(userId) {
    if (!userId) return;

    try {
        const historyRef = collection(db, 'users', userId, 'discoveryHistory');
        const snapshot = await getDocs(historyRef);

        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (DISCOVERY_HISTORY_DAYS * 24 * 60 * 60 * 1000));

        let deletedCount = 0;
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const shownAt = data.shownAt?.toDate?.() || new Date(data.shownAt);

            if (shownAt < cutoffDate) {
                await deleteDoc(docSnap.ref);
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            console.log(`🧹 Cleaned up ${deletedCount} old discovery history entries`);
        }
    } catch (error) {
        console.error('Cleanup discovery history error:', error);
    }
}

/**
 * Filter books by discovery history - removes recently shown books
 * @param {Object[]} books - Array of book objects
 * @param {Map<string, Date>} history - Discovery history map
 * @returns {Object[]} - Filtered books
 */
export function filterByDiscoveryHistory(books, history) {
    if (!history || history.size === 0) return books;

    return books.filter(book => {
        const isbn = book.isbn || book.id;
        return !history.has(isbn);
    });
}
