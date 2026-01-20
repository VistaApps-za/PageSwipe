/**
 * PageSwipe Database Service
 * Handles all Firestore operations for books, lists, clubs, and items
 */

import { db, storage } from './firebase-config.js';
import {
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    increment,
    writeBatch,
    arrayUnion
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js';

// ============================================
// PREMIUM FEATURE LIMITS (Matches iOS)
// From LibraryView.swift:26-28 and ClubsView.swift:19-21
// ============================================

/**
 * Premium limits - matches iOS exactly
 * Free users: 0 custom lists, cannot create clubs (can only join)
 * Pro users: Unlimited lists, unlimited clubs
 */
const PREMIUM_LIMITS = {
    FREE_CUSTOM_LISTS: 0,  // Free users get 0 custom lists
    FREE_CAN_CREATE_CLUBS: false  // Free users cannot create clubs
};

/**
 * Check if user has premium (Pro) status
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function checkIsPremium(userId) {
    if (!userId) return false;

    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return userDoc.data().isPro === true;
        }
        return false;
    } catch (error) {
        console.error('Check premium status error:', error);
        return false;
    }
}

/**
 * Check if user can create a new custom list
 * @param {string} userId - User ID
 * @returns {Promise<{allowed: boolean, reason?: string, isPro: boolean}>}
 */
export async function canCreateList(userId) {
    if (!userId) return { allowed: false, reason: 'Not authenticated', isPro: false };

    try {
        const isPro = await checkIsPremium(userId);

        // Pro users can create unlimited lists
        if (isPro) {
            return { allowed: true, isPro: true };
        }

        // Check current custom list count for free users
        const q = query(
            collection(db, 'lists'),
            where('ownerId', '==', userId),
            where('isDefault', '==', false)
        );
        const snapshot = await getDocs(q);
        const customListCount = snapshot.size;

        if (customListCount >= PREMIUM_LIMITS.FREE_CUSTOM_LISTS) {
            return {
                allowed: false,
                reason: 'Upgrade to Pro to create custom lists',
                isPro: false,
                currentCount: customListCount,
                limit: PREMIUM_LIMITS.FREE_CUSTOM_LISTS
            };
        }

        return { allowed: true, isPro: false };
    } catch (error) {
        console.error('Can create list error:', error);
        return { allowed: false, reason: error.message, isPro: false };
    }
}

/**
 * Check if user can create a new club
 * @param {string} userId - User ID
 * @returns {Promise<{allowed: boolean, reason?: string, isPro: boolean}>}
 */
export async function canCreateClub(userId) {
    if (!userId) return { allowed: false, reason: 'Not authenticated', isPro: false };

    try {
        const isPro = await checkIsPremium(userId);

        // Only Pro users can create clubs
        if (!isPro) {
            return {
                allowed: false,
                reason: 'Upgrade to Pro to create clubs',
                isPro: false
            };
        }

        return { allowed: true, isPro: true };
    } catch (error) {
        console.error('Can create club error:', error);
        return { allowed: false, reason: error.message, isPro: false };
    }
}

// ============================================
// LISTS
// ============================================

/**
 * Default list configurations - must match iOS app
 * Note: "Currently Reading" is NOT a default list - it's handled by the
 * getCurrentlyReading() function which queries items with status "reading"
 */
const DEFAULT_LISTS = [
    { name: 'Want to Read', listType: 'toRead', icon: '🔖' },
    { name: 'Finished', listType: 'completed', icon: '✓' }
];

/**
 * Ensure default lists exist for a user (creates them if missing)
 * @param {string} userId - User ID
 * @param {string} ownerName - Owner's display name
 */
export async function ensureDefaultLists(userId, ownerName) {
    try {
        // Get all existing lists for the user
        const q = query(
            collection(db, 'lists'),
            where('ownerId', '==', userId)
        );
        const snapshot = await getDocs(q);
        const existingLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Check which default lists are missing
        const existingTypes = new Set(existingLists.map(l => l.listType));
        const missingLists = DEFAULT_LISTS.filter(dl => !existingTypes.has(dl.listType));

        // Create missing default lists
        for (const listConfig of missingLists) {
            const listId = `${userId}_${listConfig.listType}`;
            const listRef = doc(db, 'lists', listId);

            await setDoc(listRef, {
                id: listId,
                name: listConfig.name,
                ownerId: userId,
                ownerName: ownerName,
                description: null,
                bannerImageUrl: null,
                isPublic: false,
                shareCode: generateShareCode(),
                listType: listConfig.listType,
                isDefault: true,
                itemCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log(`Created default list: ${listConfig.name}`);
        }

        return { success: true };
    } catch (error) {
        console.error('Ensure default lists error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all lists for a user (ensures default lists exist first)
 * @param {string} userId - User ID
 * @param {string} ownerName - Owner's display name (for creating missing lists)
 */
export async function getUserLists(userId, ownerName = 'User') {
    try {
        // First ensure default lists exist
        await ensureDefaultLists(userId, ownerName);

        // Now fetch all lists
        const q = query(
            collection(db, 'lists'),
            where('ownerId', '==', userId)
        );
        const snapshot = await getDocs(q);
        let lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort: default lists first (in specific order), then custom lists by date
        const listTypeOrder = { 'reading': 0, 'toRead': 1, 'completed': 2 };
        lists.sort((a, b) => {
            // Default lists come first
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;

            // Among default lists, sort by type order
            if (a.isDefault && b.isDefault) {
                return (listTypeOrder[a.listType] ?? 99) - (listTypeOrder[b.listType] ?? 99);
            }

            // Custom lists sorted by creation date (newest first)
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });

        return { success: true, data: lists };
    } catch (error) {
        console.error('Get user lists error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Subscribe to user's lists
 * @param {string} userId - User ID
 * @param {Function} callback - Called with lists array
 */
export function subscribeToLists(userId, callback) {
    // Query without orderBy to avoid composite index requirement
    const q = query(
        collection(db, 'lists'),
        where('ownerId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
        let lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort locally by createdAt descending
        lists.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
            const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
            return dateB - dateA;
        });
        callback(lists);
    });
}

/**
 * Create a new list (with premium gating)
 * @param {Object} listData - List data
 * @param {boolean} skipPremiumCheck - Skip premium check (for internal use only)
 */
export async function createList(listData, skipPremiumCheck = false) {
    try {
        // Check premium status before allowing custom list creation
        if (!skipPremiumCheck) {
            const premiumCheck = await canCreateList(listData.ownerId);
            if (!premiumCheck.allowed) {
                return {
                    success: false,
                    error: premiumCheck.reason,
                    requiresPremium: true
                };
            }
        }

        const listRef = doc(collection(db, 'lists'));
        const list = {
            id: listRef.id,
            name: listData.name,
            ownerId: listData.ownerId,
            ownerName: listData.ownerName,
            description: listData.description || null,
            bannerImageUrl: null,
            isPublic: false,
            shareCode: generateShareCode(),
            listType: 'custom',
            isDefault: false,
            itemCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(listRef, list);
        return { success: true, data: list };
    } catch (error) {
        console.error('Create list error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a list
 * @param {string} listId - List ID
 */
export async function deleteList(listId) {
    try {
        // First delete all items in the list
        const itemsQuery = query(collection(db, 'items'), where('listId', '==', listId));
        const itemsSnapshot = await getDocs(itemsQuery);

        const batch = writeBatch(db);
        itemsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        batch.delete(doc(db, 'lists', listId));

        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error('Delete list error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get list by share code
 * @param {string} shareCode - Share code
 */
export async function getListByShareCode(shareCode) {
    try {
        const q = query(collection(db, 'lists'), where('shareCode', '==', shareCode.toUpperCase()));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { success: false, error: 'List not found' };
        }

        const listDoc = snapshot.docs[0];
        return { success: true, data: { id: listDoc.id, ...listDoc.data() } };
    } catch (error) {
        console.error('Get list by share code error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// ITEMS (Books in Lists)
// ============================================

/**
 * Get items for a list
 * @param {string} listId - List ID
 */
export async function getListItems(listId) {
    try {
        // Query without orderBy to avoid composite index requirement (matches iOS behavior)
        const q = query(
            collection(db, 'items'),
            where('listId', '==', listId)
        );
        const snapshot = await getDocs(q);
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort locally by addedAt descending
        items.sort((a, b) => {
            const dateA = a.addedAt?.toDate?.() || a.addedAt || new Date(0);
            const dateB = b.addedAt?.toDate?.() || b.addedAt || new Date(0);
            return dateB - dateA;
        });

        return { success: true, data: items };
    } catch (error) {
        console.error('Get list items error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Subscribe to list items
 * @param {string} listId - List ID
 * @param {Function} callback - Called with items array
 */
export function subscribeToListItems(listId, callback) {
    // Query without orderBy to avoid composite index requirement
    const q = query(
        collection(db, 'items'),
        where('listId', '==', listId)
    );

    return onSnapshot(q, (snapshot) => {
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort locally by addedAt descending
        items.sort((a, b) => {
            const dateA = a.addedAt?.toDate?.() || a.addedAt || new Date(0);
            const dateB = b.addedAt?.toDate?.() || b.addedAt || new Date(0);
            return dateB - dateA;
        });
        callback(items);
    });
}

/**
 * Get currently reading items for a user
 * @param {string} userId - User ID
 */
export async function getCurrentlyReading(userId) {
    try {
        // Query without orderBy to avoid composite index requirement
        const q = query(
            collection(db, 'items'),
            where('userId', '==', userId),
            where('status', '==', 'reading')
        );
        const snapshot = await getDocs(q);
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort locally by addedAt descending
        items.sort((a, b) => {
            const dateA = a.addedAt?.toDate?.() || a.addedAt || new Date(0);
            const dateB = b.addedAt?.toDate?.() || b.addedAt || new Date(0);
            return dateB - dateA;
        });

        return { success: true, data: items };
    } catch (error) {
        console.error('Get currently reading error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get finished books count for a user
 * @param {string} userId - User ID
 */
export async function getFinishedBooksCount(userId) {
    try {
        const q = query(
            collection(db, 'items'),
            where('userId', '==', userId),
            where('status', '==', 'read')
        );
        const snapshot = await getDocs(q);
        return { success: true, data: snapshot.size };
    } catch (error) {
        console.error('Get finished books count error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Add a book to a list
 * @param {Object} bookData - Book data
 * @param {string} listId - List ID
 * @param {string} userId - User ID
 */
export async function addBookToList(bookData, listId, userId) {
    try {
        const itemRef = doc(collection(db, 'items'));
        const item = {
            id: itemRef.id,
            listId: listId,
            userId: userId,
            bookId: bookData.isbn || bookData.id,
            isbn: bookData.isbn || '',
            title: bookData.title,
            authors: bookData.authors || [],
            coverImageUrl: bookData.coverImageUrl || null,
            description: bookData.description || null,
            pageCount: bookData.pageCount || null,
            status: 'unread',
            liked: false,
            rating: null,
            notes: null,
            currentPage: null,
            startedReadingAt: null,
            finishedReadingAt: null,
            addedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(itemRef, item);

        // Update list item count
        await updateDoc(doc(db, 'lists', listId), {
            itemCount: increment(1),
            updatedAt: serverTimestamp()
        });

        // Cache book data
        await cacheBook(bookData);

        return { success: true, data: item };
    } catch (error) {
        console.error('Add book to list error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Remove a book from a list
 * @param {string} itemId - Item ID
 * @param {string} listId - List ID
 */
export async function removeBookFromList(itemId, listId) {
    try {
        await deleteDoc(doc(db, 'items', itemId));

        // Update list item count
        await updateDoc(doc(db, 'lists', listId), {
            itemCount: increment(-1),
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Remove book from list error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update book item status
 * @param {string} itemId - Item ID
 * @param {string} status - New status
 */
export async function updateItemStatus(itemId, status) {
    try {
        const updates = {
            status: status,
            updatedAt: serverTimestamp()
        };

        if (status === 'reading') {
            updates.startedReadingAt = serverTimestamp();
        } else if (status === 'read') {
            updates.finishedReadingAt = serverTimestamp();
        }

        await updateDoc(doc(db, 'items', itemId), updates);
        return { success: true };
    } catch (error) {
        console.error('Update item status error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update reading progress
 * @param {string} itemId - Item ID
 * @param {number} currentPage - Current page number
 */
export async function updateReadingProgress(itemId, currentPage) {
    try {
        await updateDoc(doc(db, 'items', itemId), {
            currentPage: currentPage,
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Update reading progress error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// BOOKS CACHE
// ============================================

/**
 * Cache book data in Firestore
 * @param {Object} bookData - Book data to cache
 */
export async function cacheBook(bookData) {
    try {
        const bookId = bookData.isbn || bookData.id;
        if (!bookId) return;

        const bookRef = doc(db, 'books', bookId);
        const existing = await getDoc(bookRef);

        if (!existing.exists()) {
            await setDoc(bookRef, {
                id: bookId,
                isbn: bookData.isbn || null,
                isbn13: bookData.isbn13 || null,
                title: bookData.title,
                authors: bookData.authors || [],
                coverImageUrl: bookData.coverImageUrl || null,
                description: bookData.description || null,
                genre: bookData.genre || null,
                categories: bookData.categories || [],
                pageCount: bookData.pageCount || null,
                publishDate: bookData.publishDate || null,
                publisher: bookData.publisher || null,
                language: bookData.language || 'en',
                apiSource: bookData.apiSource || 'googleBooks',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                totalReaders: 0,
                averageRating: null
            });
        }
    } catch (error) {
        console.error('Cache book error:', error);
    }
}

/**
 * Get cached book
 * @param {string} bookId - Book ID or ISBN
 */
export async function getCachedBook(bookId) {
    try {
        const bookDoc = await getDoc(doc(db, 'books', bookId));
        if (bookDoc.exists()) {
            return { success: true, data: bookDoc.data() };
        }
        return { success: false, error: 'Book not found' };
    } catch (error) {
        console.error('Get cached book error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get book description from cache by ISBN
 * @param {string} isbn - Book ISBN
 */
export async function getBookDescription(isbn) {
    try {
        if (!isbn) return null;

        // Try to get from books cache (stored with ISBN as document ID)
        const bookDoc = await getDoc(doc(db, 'books', isbn));
        if (bookDoc.exists()) {
            return bookDoc.data().description || null;
        }

        // Also try querying by isbn field in case ID is different
        const q = query(
            collection(db, 'books'),
            where('isbn', '==', isbn),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].data().description || null;
        }

        return null;
    } catch (error) {
        console.error('Get book description error:', error);
        return null;
    }
}

/**
 * Move an item to a different list
 * @param {string} itemId - Item document ID
 * @param {string} fromListId - Current list ID
 * @param {string} toListId - Target list ID
 */
export async function moveItemToList(itemId, fromListId, toListId) {
    try {
        // Update the item's listId
        await updateDoc(doc(db, 'items', itemId), {
            listId: toListId,
            updatedAt: serverTimestamp()
        });

        // Decrement old list count
        await updateDoc(doc(db, 'lists', fromListId), {
            itemCount: increment(-1),
            updatedAt: serverTimestamp()
        });

        // Increment new list count
        await updateDoc(doc(db, 'lists', toListId), {
            itemCount: increment(1),
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Move item to list error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// CLUBS
// ============================================

/**
 * Get user's clubs
 * @param {string} userId - User ID
 */
export async function getUserClubs(userId) {
    try {
        // Get clubs where user is owner (same as iOS)
        const ownedQuery = query(
            collection(db, 'clubs'),
            where('ownerId', '==', userId)
        );
        const ownedSnapshot = await getDocs(ownedQuery);
        const ownedClubs = ownedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'owner' }));
        const ownedClubIds = new Set(ownedClubs.map(c => c.id));

        // Get clubs where user is member using collectionGroup (same as iOS)
        const membersQuery = query(
            collectionGroup(db, 'members'),
            where('userId', '==', userId)
        );
        const membersSnapshot = await getDocs(membersQuery);

        // Extract club IDs from member document paths
        const joinedClubs = [];
        for (const memberDoc of membersSnapshot.docs) {
            // Path is: clubs/{clubId}/members/{memberId}
            const pathParts = memberDoc.ref.path.split('/');
            if (pathParts.length >= 2) {
                const clubId = pathParts[1];

                // Skip if this is an owned club (already in the list)
                if (ownedClubIds.has(clubId)) continue;

                // Fetch the club document
                const clubDoc = await getDoc(doc(db, 'clubs', clubId));
                if (clubDoc.exists()) {
                    joinedClubs.push({ id: clubDoc.id, ...clubDoc.data(), role: 'member' });
                }
            }
        }

        return { success: true, data: [...ownedClubs, ...joinedClubs] };
    } catch (error) {
        console.error('Get user clubs error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Create a new club (with premium gating)
 * @param {Object} clubData - Club data
 */
export async function createClub(clubData) {
    try {
        // Check premium status before allowing club creation
        const premiumCheck = await canCreateClub(clubData.ownerId);
        if (!premiumCheck.allowed) {
            return {
                success: false,
                error: premiumCheck.reason,
                requiresPremium: true
            };
        }

        const clubRef = doc(collection(db, 'clubs'));
        const joinCode = generateShareCode();

        const club = {
            id: clubRef.id,
            name: clubData.name,
            description: clubData.description || null,
            coverImageUrl: null,
            ownerId: clubData.ownerId,
            ownerName: clubData.ownerName,
            joinCode: joinCode,
            isPublic: false,
            currentBookId: null,
            currentBookTitle: null,
            currentBookCoverUrl: null,
            currentBookStartDate: null,
            memberCount: 1,
            booksCompleted: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(clubRef, club);

        // Add owner as member
        const memberRef = doc(db, 'clubs', clubRef.id, 'members', clubData.ownerId);
        await setDoc(memberRef, {
            id: clubData.ownerId,
            userId: clubData.ownerId,
            displayName: clubData.ownerName,
            photoURL: clubData.ownerPhotoURL || null,
            role: 'owner',
            joinedAt: serverTimestamp(),
            currentBookStatus: 'notStarted',
            currentBookProgress: null
        });

        // Add activity
        await addClubActivity(clubRef.id, {
            userId: clubData.ownerId,
            userName: clubData.ownerName,
            type: 'joined',
            message: 'created the club'
        });

        // Update user's joinedClubs
        const userRef = doc(db, 'users', clubData.ownerId);
        const userDoc = await getDoc(userRef);
        const joinedClubs = userDoc.exists() ? (userDoc.data().joinedClubs || []) : [];
        joinedClubs.push({
            clubId: clubRef.id,
            clubName: clubData.name,
            role: 'owner',
            joinedAt: new Date()
        });
        await updateDoc(userRef, { joinedClubs });

        return { success: true, data: { ...club, joinCode } };
    } catch (error) {
        console.error('Create club error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Join a club with code
 * @param {string} joinCode - Club join code
 * @param {Object} userData - User data
 */
export async function joinClub(joinCode, userData) {
    try {
        // Find club by join code
        const q = query(collection(db, 'clubs'), where('joinCode', '==', joinCode.toUpperCase()));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { success: false, error: 'Club not found. Check the code and try again.' };
        }

        const clubDoc = snapshot.docs[0];
        const clubId = clubDoc.id;
        const clubData = clubDoc.data();

        // Check if already a member
        const memberDoc = await getDoc(doc(db, 'clubs', clubId, 'members', userData.userId));
        if (memberDoc.exists()) {
            return { success: false, error: 'You are already a member of this club.' };
        }

        // Add as member
        await setDoc(doc(db, 'clubs', clubId, 'members', userData.userId), {
            id: userData.userId,
            userId: userData.userId,
            displayName: userData.displayName,
            photoURL: userData.photoURL || null,
            role: 'member',
            joinedAt: serverTimestamp(),
            currentBookStatus: 'notStarted',
            currentBookProgress: null,
            booksAdded: 0,
            booksInterested: 0
        });

        // Update member count (may fail for non-owners, that's ok)
        try {
            await updateDoc(doc(db, 'clubs', clubId), {
                memberCount: increment(1),
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.log('Could not update club memberCount (non-owner):', e.code);
        }

        // Add activity
        try {
            await addClubActivity(clubId, {
                userId: userData.userId,
                userName: userData.displayName,
                userPhotoUrl: userData.photoURL,
                type: 'joined',
                message: 'joined the club'
            });
        } catch (e) {
            console.log('Could not add join activity:', e.code);
        }

        // Update user's joinedClubs
        try {
            const userRef = doc(db, 'users', userData.userId);
            const userSnap = await getDoc(userRef);
            const joinedClubs = userSnap.exists() ? (userSnap.data().joinedClubs || []) : [];
            joinedClubs.push({
                clubId: clubId,
                clubName: clubData.name,
                role: 'member',
                joinedAt: new Date()
            });
            await updateDoc(userRef, { joinedClubs });
        } catch (e) {
            console.log('Could not update user joinedClubs:', e.code);
        }

        return { success: true, data: { id: clubId, ...clubData } };
    } catch (error) {
        console.error('Join club error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get club members
 * @param {string} clubId - Club ID
 */
export async function getClubMembers(clubId) {
    try {
        const membersSnapshot = await getDocs(collection(db, 'clubs', clubId, 'members'));
        const members = [];

        for (const memberDoc of membersSnapshot.docs) {
            const memberData = { id: memberDoc.id, ...memberDoc.data() };

            // Fetch actual user profile to get current displayName
            try {
                const userDoc = await getDoc(doc(db, 'users', memberData.userId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    memberData.displayName = userData.displayName || memberData.displayName;
                    memberData.photoURL = userData.photoURL || memberData.photoURL;
                }
            } catch (e) {
                // If we can't fetch user profile, keep the stored displayName
            }

            members.push(memberData);
        }

        return { success: true, data: members };
    } catch (error) {
        console.error('Get club members error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get books added and interested by a specific member in a club
 * @param {string} clubId - Club ID
 * @param {string} memberId - Member's user ID
 * @returns {Promise<{success: boolean, data?: {added: Array, interested: Array}}>}
 */
export async function getMemberBooksInClub(clubId, memberId) {
    try {
        const booksSnapshot = await getDocs(collection(db, 'clubs', clubId, 'books'));
        const addedBooks = [];
        const interestedBooks = [];

        booksSnapshot.docs.forEach(doc => {
            const book = { id: doc.id, ...doc.data() };

            // Check if member added this book
            if (book.addedBy?.userId === memberId) {
                addedBooks.push(book);
            }

            // Check if member is interested in this book
            if (book.interestedMembers?.some(m => m.userId === memberId)) {
                interestedBooks.push(book);
            }
        });

        return {
            success: true,
            data: { added: addedBooks, interested: interestedBooks }
        };
    } catch (error) {
        console.error('Get member books in club error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get club activity
 * @param {string} clubId - Club ID
 * @param {number} limitCount - Max number of activities
 */
export async function getClubActivity(clubId, limitCount = 20) {
    try {
        const q = query(
            collection(db, 'clubs', clubId, 'activity'),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, data: activities };
    } catch (error) {
        console.error('Get club activity error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Add club activity
 * @param {string} clubId - Club ID
 * @param {Object} activityData - Activity data
 */
export async function addClubActivity(clubId, activityData) {
    try {
        const activityRef = doc(collection(db, 'clubs', clubId, 'activity'));
        await setDoc(activityRef, {
            id: activityRef.id,
            userId: activityData.userId,
            userName: activityData.userName,
            userPhotoUrl: activityData.userPhotoUrl || null,
            type: activityData.type,
            bookId: activityData.bookId || null,
            bookTitle: activityData.bookTitle || null,
            bookCoverUrl: activityData.bookCoverUrl || null,
            message: activityData.message || null,
            rating: activityData.rating || null,
            createdAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Add club activity error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Set current book for club
 * @param {string} clubId - Club ID
 * @param {Object} bookData - Book data
 */
export async function setClubCurrentBook(clubId, bookData) {
    try {
        await updateDoc(doc(db, 'clubs', clubId), {
            currentBookId: bookData.id || bookData.isbn,
            currentBookTitle: bookData.title,
            currentBookCoverUrl: bookData.coverImageUrl || null,
            currentBookStartDate: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Reset all members' progress
        const membersSnapshot = await getDocs(collection(db, 'clubs', clubId, 'members'));
        const batch = writeBatch(db);
        membersSnapshot.docs.forEach(memberDoc => {
            batch.update(memberDoc.ref, {
                currentBookStatus: 'notStarted',
                currentBookProgress: null
            });
        });
        await batch.commit();

        return { success: true };
    } catch (error) {
        console.error('Set club current book error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Leave a club (for non-owners)
 * @param {string} clubId - Club ID
 * @param {string} userId - User ID
 */
export async function leaveClub(clubId, userId) {
    try {
        // Get club to check if user is owner
        const clubDoc = await getDoc(doc(db, 'clubs', clubId));
        if (!clubDoc.exists()) {
            return { success: false, error: 'Club not found' };
        }

        const clubData = clubDoc.data();
        if (clubData.ownerId === userId) {
            return { success: false, error: 'Owner cannot leave the club. Transfer ownership or delete the club.' };
        }

        // Remove member document
        await deleteDoc(doc(db, 'clubs', clubId, 'members', userId));

        // Decrement member count
        await updateDoc(doc(db, 'clubs', clubId), {
            memberCount: increment(-1),
            updatedAt: serverTimestamp()
        });

        // Update user's joinedClubs array
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const joinedClubs = (userDoc.data().joinedClubs || []).filter(c => c.clubId !== clubId);
            await updateDoc(userRef, { joinedClubs });
        }

        return { success: true };
    } catch (error) {
        console.error('Leave club error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a club (owner only)
 * @param {string} clubId - Club ID
 * @param {string} userId - User ID (must be owner)
 */
export async function deleteClub(clubId, userId) {
    try {
        // Get club to verify ownership
        const clubDoc = await getDoc(doc(db, 'clubs', clubId));
        if (!clubDoc.exists()) {
            // Club already deleted - treat as success
            return { success: true, alreadyDeleted: true };
        }

        const clubData = clubDoc.data();
        if (clubData.ownerId !== userId) {
            return { success: false, error: 'Only the owner can delete the club' };
        }

        // Delete all members
        const membersSnapshot = await getDocs(collection(db, 'clubs', clubId, 'members'));
        for (const memberDoc of membersSnapshot.docs) {
            // Remove from each member's joinedClubs array
            const memberId = memberDoc.id;
            const userRef = doc(db, 'users', memberId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const joinedClubs = (userDoc.data().joinedClubs || []).filter(c => c.clubId !== clubId);
                await updateDoc(userRef, { joinedClubs });
            }
            await deleteDoc(memberDoc.ref);
        }

        // Delete all books
        const booksSnapshot = await getDocs(collection(db, 'clubs', clubId, 'books'));
        for (const bookDoc of booksSnapshot.docs) {
            await deleteDoc(bookDoc.ref);
        }

        // Delete all activity
        const activitySnapshot = await getDocs(collection(db, 'clubs', clubId, 'activity'));
        for (const activityDoc of activitySnapshot.docs) {
            await deleteDoc(activityDoc.ref);
        }

        // Delete club
        await deleteDoc(doc(db, 'clubs', clubId));

        return { success: true };
    } catch (error) {
        console.error('Delete club error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get books in a club
 * @param {string} clubId - Club ID
 */
export async function getClubBooks(clubId) {
    try {
        const booksSnapshot = await getDocs(collection(db, 'clubs', clubId, 'books'));
        let books = booksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort by most recently added
        books.sort((a, b) => {
            const dateA = a.addedAt?.toDate?.() || new Date(0);
            const dateB = b.addedAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });

        return { success: true, data: books };
    } catch (error) {
        console.error('Get club books error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Add a book to a club
 * @param {string} clubId - Club ID
 * @param {Object} bookData - Book data (from user's library)
 * @param {Object} userData - User data (userId, displayName, photoURL)
 */
export async function addBookToClub(clubId, bookData, userData) {
    try {
        // Check if book already in club
        const existingQuery = query(
            collection(db, 'clubs', clubId, 'books'),
            where('isbn', '==', bookData.isbn),
            limit(1)
        );
        const existingSnapshot = await getDocs(existingQuery);

        if (!existingSnapshot.empty) {
            return { success: false, error: 'This book is already in the club' };
        }

        const addedBy = {
            userId: userData.userId,
            displayName: userData.displayName,
            photoURL: userData.photoURL || null
        };

        const clubBook = {
            clubId: clubId,
            isbn: bookData.isbn,
            title: bookData.title,
            authors: bookData.authors || [],
            coverImageUrl: bookData.coverImageUrl || null,
            pageCount: bookData.pageCount || null,
            description: bookData.description || null,
            addedBy: addedBy,
            addedAt: serverTimestamp(),
            interestedMembers: [],
            notInterestedCount: 0
        };

        await addDoc(collection(db, 'clubs', clubId, 'books'), clubBook);

        // Update club book count (may fail for non-owners, that's ok)
        try {
            await updateDoc(doc(db, 'clubs', clubId), {
                bookCount: increment(1),
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.log('Could not update club bookCount (non-owner):', e.code);
        }

        // Update member's booksAdded count
        try {
            await updateDoc(doc(db, 'clubs', clubId, 'members', userData.userId), {
                booksAdded: increment(1)
            });
        } catch (e) {
            console.log('Could not update member booksAdded:', e.code);
        }

        // Add activity
        try {
            await addClubActivity(clubId, {
                userId: userData.userId,
                userName: userData.displayName,
                userPhotoUrl: userData.photoURL,
                type: 'addedBook',
                bookId: bookData.isbn,
                bookTitle: bookData.title,
                bookCoverUrl: bookData.coverImageUrl
            });
        } catch (e) {
            console.log('Could not add activity:', e.code);
        }

        return { success: true };
    } catch (error) {
        console.error('Add book to club error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mark interested in a club book
 * @param {string} clubId - Club ID
 * @param {string} bookId - Club book document ID
 * @param {Object} userData - User data
 */
export async function markInterestedInClubBook(clubId, bookId, userData) {
    try {
        const bookRef = doc(db, 'clubs', clubId, 'books', bookId);
        const bookDoc = await getDoc(bookRef);

        if (!bookDoc.exists()) {
            return { success: false, error: 'Book not found' };
        }

        const bookData = bookDoc.data();

        // Check if already interested
        if (bookData.interestedMembers?.some(m => m.userId === userData.userId)) {
            return { success: false, error: 'Already marked as interested' };
        }

        const memberInfo = {
            userId: userData.userId,
            displayName: userData.displayName,
            photoURL: userData.photoURL || null
        };

        // Add to interestedMembers array
        await updateDoc(bookRef, {
            interestedMembers: arrayUnion(memberInfo)
        });

        // Update member's booksInterested count (may fail, that's ok)
        try {
            await updateDoc(doc(db, 'clubs', clubId, 'members', userData.userId), {
                booksInterested: increment(1)
            });
        } catch (e) {
            console.log('Could not update member booksInterested:', e.code);
        }

        // Add activity
        try {
            await addClubActivity(clubId, {
                userId: userData.userId,
                userName: userData.displayName,
                userPhotoUrl: userData.photoURL,
                type: 'interested',
                bookId: bookData.isbn,
                bookTitle: bookData.title,
                bookCoverUrl: bookData.coverImageUrl
            });
        } catch (e) {
            console.log('Could not add activity:', e.code);
        }

        return { success: true };
    } catch (error) {
        console.error('Mark interested error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mark not interested in a club book
 * Adds user to notInterestedMembers array (matches iOS implementation)
 * @param {string} clubId - Club ID
 * @param {string} bookId - Club book document ID
 * @param {Object} userData - User data { userId, displayName, photoURL }
 */
export async function markNotInterestedInClubBook(clubId, bookId, userData) {
    try {
        const bookRef = doc(db, 'clubs', clubId, 'books', bookId);
        const bookDoc = await getDoc(bookRef);

        if (!bookDoc.exists()) {
            return { success: false, error: 'Book not found' };
        }

        const bookData = bookDoc.data();

        // Check if already marked as not interested
        if (bookData.notInterestedMembers?.some(m => m.userId === userData.userId)) {
            return { success: true, data: 'Already marked' };
        }

        const memberInfo = {
            userId: userData.userId,
            displayName: userData.displayName,
            photoURL: userData.photoURL || null
        };

        // Add to notInterestedMembers array
        await updateDoc(bookRef, {
            notInterestedMembers: arrayUnion(memberInfo)
        });

        return { success: true };
    } catch (error) {
        console.error('Mark not interested error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Post activity to all clubs that have a specific book
 * Called when user starts/finishes reading or reviews a book
 * @param {string} isbn - Book ISBN
 * @param {string} title - Book title
 * @param {string} coverUrl - Book cover URL
 * @param {string} activityType - Activity type (startedBook, finishedBook, reviewedBook)
 * @param {Object} userData - User data
 * @param {number} rating - Optional rating for reviewedBook
 */
export async function postActivityToClubsWithBook(isbn, title, coverUrl, activityType, userData, rating = null) {
    try {
        if (!userData?.userId) return { success: false, error: 'User not authenticated' };

        // Get user's clubs
        const clubsResult = await getUserClubs(userData.userId);
        if (!clubsResult.success || !clubsResult.data.length) {
            return { success: true, data: { clubsNotified: 0 } };
        }

        let clubsNotified = 0;

        for (const club of clubsResult.data) {
            if (!club.id) continue;

            // Check if this club has the book
            const bookQuery = query(
                collection(db, 'clubs', club.id, 'books'),
                where('isbn', '==', isbn),
                limit(1)
            );
            const bookSnapshot = await getDocs(bookQuery);

            if (!bookSnapshot.empty) {
                await addClubActivity(club.id, {
                    userId: userData.userId,
                    userName: userData.displayName,
                    userPhotoUrl: userData.photoURL,
                    type: activityType,
                    bookId: isbn,
                    bookTitle: title,
                    bookCoverUrl: coverUrl,
                    rating: rating
                });
                clubsNotified++;
            }
        }

        return { success: true, data: { clubsNotified } };
    } catch (error) {
        console.error('Post activity to clubs error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get activity text helper
 * @param {Object} activity - Activity data
 */
export function getActivityText(activity) {
    const name = activity.userName || 'Someone';
    const book = activity.bookTitle || 'a book';

    switch (activity.type) {
        case 'joined':
            return `${name} joined the club`;
        case 'addedBook':
            return `${name} added '${book}'`;
        case 'interested':
            return `${name} is interested in '${book}'`;
        case 'addedToList':
            return `${name} added '${book}' to their list`;
        case 'startedBook':
            return `${name} started reading '${book}'`;
        case 'finishedBook':
            return `${name} finished reading '${book}'`;
        case 'reviewedBook':
            if (activity.rating) {
                return `${name} gave '${book}' ${activity.rating} ${activity.rating === 1 ? 'star' : 'stars'}`;
            }
            return `${name} reviewed '${book}'`;
        default:
            return `${name} did something`;
    }
}

// ============================================
// USER STATS
// ============================================

/**
 * Get user stats
 * @param {string} userId - User ID
 */
export async function getUserStats(userId) {
    try {
        // Get lists count
        const listsQuery = query(collection(db, 'lists'), where('ownerId', '==', userId));
        const listsSnapshot = await getDocs(listsQuery);
        const listsCount = listsSnapshot.size;

        // Get currently reading count
        const readingQuery = query(
            collection(db, 'items'),
            where('userId', '==', userId),
            where('status', '==', 'reading')
        );
        const readingSnapshot = await getDocs(readingQuery);
        const readingCount = readingSnapshot.size;

        // Get finished count
        const finishedQuery = query(
            collection(db, 'items'),
            where('userId', '==', userId),
            where('status', '==', 'read')
        );
        const finishedSnapshot = await getDocs(finishedQuery);
        const finishedCount = finishedSnapshot.size;

        // Get clubs count using collectionGroup (same as iOS)
        const ownedClubsQuery = query(collection(db, 'clubs'), where('ownerId', '==', userId));
        const ownedClubsSnapshot = await getDocs(ownedClubsQuery);
        const ownedClubsCount = ownedClubsSnapshot.size;

        const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', userId));
        const membersSnapshot = await getDocs(membersQuery);
        // Count unique clubs (excluding owned ones already counted)
        const ownedIds = new Set(ownedClubsSnapshot.docs.map(d => d.id));
        let joinedCount = 0;
        for (const memberDoc of membersSnapshot.docs) {
            const pathParts = memberDoc.ref.path.split('/');
            if (pathParts.length >= 2) {
                const clubId = pathParts[1];
                if (!ownedIds.has(clubId)) joinedCount++;
            }
        }
        const clubsCount = ownedClubsCount + joinedCount;

        return {
            success: true,
            data: {
                lists: listsCount,
                currentlyReading: readingCount,
                finished: finishedCount,
                clubs: clubsCount
            }
        };
    } catch (error) {
        console.error('Get user stats error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// USER PROFILE & SETTINGS
// ============================================

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data to update
 */
export async function updateUserProfile(userId, profileData) {
    try {
        const userRef = doc(db, 'users', userId);
        const updates = {
            ...profileData,
            updatedAt: serverTimestamp()
        };
        await updateDoc(userRef, updates);
        return { success: true };
    } catch (error) {
        console.error('Update user profile error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update user settings
 * @param {string} userId - User ID
 * @param {Object} settings - Settings data
 */
export async function updateUserSettings(userId, settings) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            settings: settings,
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Update user settings error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// PROFILE PHOTO
// ============================================

/**
 * Resize image to max dimensions while maintaining aspect ratio
 * @param {File} file - Original image file
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<Blob>}
 */
function resizeImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            let { width, height } = img;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                },
                'image/jpeg',
                quality
            );

            URL.revokeObjectURL(img.src);
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error('Failed to load image'));
        };
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Upload profile photo to Firebase Storage
 * Matches iOS path: profile_photos/{userId}.jpg
 * @param {string} userId - User ID
 * @param {File} imageFile - Image file from input
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function uploadProfilePhoto(userId, imageFile) {
    try {
        // Resize image to 500x500 max (matching iOS behavior)
        const resizedBlob = await resizeImage(imageFile, 500, 500, 0.8);

        // Upload to Firebase Storage at profile_photos/{userId}.jpg
        const storageRef = ref(storage, `profile_photos/${userId}.jpg`);
        await uploadBytes(storageRef, resizedBlob, {
            contentType: 'image/jpeg'
        });

        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);

        // Update user document with photoURL
        await updateUserProfile(userId, { photoURL: downloadURL });

        // Propagate to club memberships
        await updatePhotoInClubMemberships(userId, downloadURL);

        return { success: true, data: downloadURL };
    } catch (error) {
        console.error('Upload profile photo error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Remove profile photo from Firebase Storage and user document
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function removeProfilePhoto(userId) {
    try {
        // Delete from Firebase Storage
        const storageRef = ref(storage, `profile_photos/${userId}.jpg`);
        try {
            await deleteObject(storageRef);
        } catch (e) {
            // Ignore error if file doesn't exist
            console.log('Photo may not exist in storage:', e.code);
        }

        // Update user document to remove photoURL
        await updateUserProfile(userId, { photoURL: null });

        // Propagate to club memberships
        await updatePhotoInClubMemberships(userId, null);

        return { success: true };
    } catch (error) {
        console.error('Remove profile photo error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update photoURL in all club memberships (denormalization)
 * @param {string} userId - User ID
 * @param {string|null} photoURL - New photo URL or null
 */
async function updatePhotoInClubMemberships(userId, photoURL) {
    try {
        // Get all clubs where user is a member
        const membersQuery = query(
            collectionGroup(db, 'members'),
            where('userId', '==', userId)
        );
        const membersSnapshot = await getDocs(membersQuery);

        if (membersSnapshot.empty) return;

        // Update each membership document
        const batch = writeBatch(db);
        membersSnapshot.docs.forEach(memberDoc => {
            batch.update(memberDoc.ref, { photoURL: photoURL });
        });
        await batch.commit();
    } catch (error) {
        console.error('Update photo in club memberships error:', error);
        // Non-critical, don't throw
    }
}

/**
 * Get user settings
 * @param {string} userId - User ID
 */
export async function getUserSettings(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return { success: true, data: userDoc.data().settings || {} };
        }
        return { success: true, data: {} };
    } catch (error) {
        console.error('Get user settings error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// REVIEWS
// ============================================

/**
 * Add a book review
 * @param {Object} reviewData - Review data
 */
export async function addBookReview(reviewData) {
    try {
        const reviewRef = doc(collection(db, 'reviews'));
        const review = {
            id: reviewRef.id,
            userId: reviewData.userId,
            userName: reviewData.userName,
            userPhotoUrl: reviewData.userPhotoUrl || null,
            bookId: reviewData.bookId,
            bookTitle: reviewData.bookTitle,
            bookCoverUrl: reviewData.bookCoverUrl || null,
            rating: reviewData.rating,
            reviewText: reviewData.reviewText || null,
            recommend: reviewData.recommend || false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            likes: 0,
            helpful: 0
        };

        await setDoc(reviewRef, review);

        // Update book's average rating in books collection
        await updateBookRating(reviewData.bookId, reviewData.rating);

        // Update user's review count
        const userRef = doc(db, 'users', reviewData.userId);
        await updateDoc(userRef, {
            reviewCount: increment(1)
        });

        return { success: true, data: review };
    } catch (error) {
        console.error('Add book review error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get reviews for a book
 * @param {string} bookId - Book ID
 * @param {number} limitCount - Max reviews to return
 */
export async function getBookReviews(bookId, limitCount = 10) {
    try {
        const q = query(
            collection(db, 'reviews'),
            where('bookId', '==', bookId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, data: reviews };
    } catch (error) {
        console.error('Get book reviews error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get user's reviews
 * @param {string} userId - User ID
 */
export async function getUserReviews(userId) {
    try {
        const q = query(
            collection(db, 'reviews'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { success: true, data: reviews };
    } catch (error) {
        console.error('Get user reviews error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get reviews for a book from club members
 * @param {string} bookId - Book ID
 * @param {string} clubId - Club ID
 */
export async function getClubMemberReviews(bookId, clubId) {
    try {
        // First get club members
        const membersSnapshot = await getDocs(collection(db, 'clubs', clubId, 'members'));
        const memberIds = membersSnapshot.docs.map(doc => doc.id);

        if (memberIds.length === 0) {
            return { success: true, data: [] };
        }

        // Get reviews for this book from club members
        // Note: Firestore 'in' queries are limited to 30 items, so we may need to batch
        const reviews = [];
        const batchSize = 30;

        for (let i = 0; i < memberIds.length; i += batchSize) {
            const batchIds = memberIds.slice(i, i + batchSize);
            const q = query(
                collection(db, 'reviews'),
                where('bookId', '==', bookId),
                where('userId', 'in', batchIds),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            reviews.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }

        return { success: true, data: reviews };
    } catch (error) {
        console.error('Get club member reviews error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all reviews from club members (for any book)
 * @param {string} clubId - Club ID
 * @param {number} limitCount - Max reviews to return
 */
export async function getAllClubMemberReviews(clubId, limitCount = 20) {
    try {
        // First get club members
        const membersSnapshot = await getDocs(collection(db, 'clubs', clubId, 'members'));
        const memberIds = membersSnapshot.docs.map(doc => doc.id);

        if (memberIds.length === 0) {
            return { success: true, data: [] };
        }

        // Get recent reviews from club members
        const reviews = [];
        const batchSize = 30;

        for (let i = 0; i < memberIds.length && reviews.length < limitCount; i += batchSize) {
            const batchIds = memberIds.slice(i, i + batchSize);
            const q = query(
                collection(db, 'reviews'),
                where('userId', 'in', batchIds),
                orderBy('createdAt', 'desc'),
                limit(limitCount - reviews.length)
            );
            const snapshot = await getDocs(q);
            reviews.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }

        // Sort by date and limit
        reviews.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });

        return { success: true, data: reviews.slice(0, limitCount) };
    } catch (error) {
        console.error('Get all club member reviews error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update book's average rating
 * @param {string} bookId - Book ID
 * @param {number} newRating - New rating to factor in
 */
async function updateBookRating(bookId, newRating) {
    try {
        const bookRef = doc(db, 'books', bookId);
        const bookDoc = await getDoc(bookRef);

        if (bookDoc.exists()) {
            const bookData = bookDoc.data();
            const currentAvg = bookData.averageRating || 0;
            const currentCount = bookData.ratingCount || 0;

            // Calculate new average
            const newCount = currentCount + 1;
            const newAvg = ((currentAvg * currentCount) + newRating) / newCount;

            await updateDoc(bookRef, {
                averageRating: Math.round(newAvg * 10) / 10,
                ratingCount: newCount,
                updatedAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error('Update book rating error:', error);
    }
}

// ============================================
// FINISHED BOOKS & LIST MANAGEMENT
// ============================================

/**
 * Get or create the "Finished" list for a user
 * @param {string} userId - User ID
 * @param {string} userName - User's display name
 */
export async function getOrCreateFinishedList(userId, userName) {
    try {
        // The default finished list ID format is: userId_completed
        const expectedListId = `${userId}_completed`;
        const listRef = doc(db, 'lists', expectedListId);
        const listDoc = await getDoc(listRef);

        if (listDoc.exists()) {
            return { success: true, data: { id: listDoc.id, ...listDoc.data() } };
        }

        // If not found by ID, try querying (fallback for older accounts)
        const q = query(
            collection(db, 'lists'),
            where('ownerId', '==', userId),
            where('listType', '==', 'completed'),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const foundDoc = snapshot.docs[0];
            return { success: true, data: { id: foundDoc.id, ...foundDoc.data() } };
        }

        // Create the finished list with the expected ID format
        const list = {
            id: expectedListId,
            name: 'Finished',
            ownerId: userId,
            ownerName: userName,
            description: 'Books I\'ve completed reading',
            bannerImageUrl: null,
            isPublic: false,
            shareCode: generateShareCode(),
            listType: 'completed',
            isDefault: true,
            itemCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(listRef, list);
        return { success: true, data: list };
    } catch (error) {
        console.error('Get or create finished list error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Move a book to the finished list and update its status
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @param {string} userName - User's display name
 */
export async function finishBookAndMove(itemId, userId, userName) {
    console.log('finishBookAndMove called:', { itemId, userId, userName });
    try {
        // Get the book item first
        console.log('Getting item document...');
        const itemDoc = await getDoc(doc(db, 'items', itemId));
        if (!itemDoc.exists()) {
            console.log('Item not found:', itemId);
            return { success: false, error: 'Book not found' };
        }

        const itemData = itemDoc.data();
        const currentListId = itemData.listId;
        console.log('Item data:', itemData);
        console.log('Current list ID:', currentListId);

        // Get or create the finished list
        console.log('Getting or creating finished list...');
        const finishedListResult = await getOrCreateFinishedList(userId, userName);
        console.log('Finished list result:', finishedListResult);
        if (!finishedListResult.success) {
            return finishedListResult;
        }

        const finishedListId = finishedListResult.data.id;
        console.log('Finished list ID:', finishedListId);

        // If the book is already in the finished list, just update status
        if (currentListId === finishedListId) {
            console.log('Book already in finished list, updating status...');
            await updateDoc(doc(db, 'items', itemId), {
                status: 'read',
                currentPage: itemData.pageCount || null,
                finishedReadingAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { success: true, data: { moved: false, listId: finishedListId, bookData: itemData } };
        }

        // Update the item with new list and status
        console.log('Moving book to finished list...');
        const batch = writeBatch(db);

        // Update the item
        batch.update(doc(db, 'items', itemId), {
            listId: finishedListId,
            status: 'read',
            currentPage: itemData.pageCount || null,
            finishedReadingAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Decrement old list count
        batch.update(doc(db, 'lists', currentListId), {
            itemCount: increment(-1),
            updatedAt: serverTimestamp()
        });

        // Increment finished list count
        batch.update(doc(db, 'lists', finishedListId), {
            itemCount: increment(1),
            updatedAt: serverTimestamp()
        });

        console.log('Committing batch...');
        await batch.commit();
        console.log('Batch committed successfully');

        return { success: true, data: { moved: true, listId: finishedListId, bookData: itemData } };
    } catch (error) {
        console.error('Finish book and move error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get a book item by ID
 * @param {string} itemId - Item ID
 */
export async function getBookItem(itemId) {
    try {
        const itemDoc = await getDoc(doc(db, 'items', itemId));
        if (itemDoc.exists()) {
            return { success: true, data: { id: itemDoc.id, ...itemDoc.data() } };
        }
        return { success: false, error: 'Book not found' };
    } catch (error) {
        console.error('Get book item error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// HELPERS
// ============================================

/**
 * Generate a 6-character share code
 */
function generateShareCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
