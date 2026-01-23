/**
 * PageSwipe Authentication Service
 * Handles user authentication with Firebase Auth
 */

import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    updateProfile,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// Auth providers
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

/**
 * Auth state change listener
 * @param {Function} callback - Called with user object or null
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 * @returns {Object|null} Current user or null
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Sign up with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - Display name
 */
export async function signUpWithEmail(email, password, displayName) {
    try {
        // Create auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update display name
        await updateProfile(user, { displayName });

        // Create user document
        await createUserDocument(user, 'email', displayName);

        return { success: true, user };
    } catch (error) {
        console.error('Sign up error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 */
export async function signInWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Check if new user
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            await createUserDocument(user, 'google');
        }

        return { success: true, user };
    } catch (error) {
        console.error('Google sign in error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

/**
 * Sign in with Apple
 */
export async function signInWithApple() {
    try {
        const result = await signInWithPopup(auth, appleProvider);
        const user = result.user;

        // Check if new user
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            await createUserDocument(user, 'apple');
        }

        return { success: true, user };
    } catch (error) {
        console.error('Apple sign in error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

/**
 * Sign out current user
 */
export async function signOutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send password reset email
 * @param {string} email - User email address
 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        console.error('Password reset error:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

/**
 * Create user document in Firestore
 * @param {Object} user - Firebase auth user
 * @param {string} authProvider - Auth provider used
 * @param {string} displayName - Optional display name override
 */
async function createUserDocument(user, authProvider, displayName = null) {
    const userRef = doc(db, 'users', user.uid);

    const userData = {
        id: user.uid,
        email: user.email,
        displayName: displayName || user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL || null,
        authProvider: authProvider,
        isPro: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        booksRead: 0,
        currentlyReading: 0,
        hasCompletedOnboarding: false,
        savedSharedLists: [],
        joinedClubs: []
    };

    await setDoc(userRef, userData);

    // Create default lists
    await createDefaultLists(user.uid, userData.displayName);

    return userData;
}

/**
 * Create default book lists for new user
 * @param {string} userId - User ID
 * @param {string} ownerName - Owner display name
 */
async function createDefaultLists(userId, ownerName) {
    // Note: "Currently Reading" is NOT a default list - it's handled dynamically
    // by querying items with status "reading" via getCurrentlyReading()
    const defaultLists = [
        {
            name: 'Want to Read',
            listType: 'toRead',
            icon: '🔖'
        },
        {
            name: 'Finished',
            listType: 'completed',
            icon: '✓'
        }
    ];

    for (const list of defaultLists) {
        const listId = `${userId}_${list.listType}`;
        const listRef = doc(db, 'lists', listId);

        await setDoc(listRef, {
            id: listId,
            name: list.name,
            ownerId: userId,
            ownerName: ownerName,
            description: null,
            bannerImageUrl: null,
            isPublic: false,
            shareCode: generateShareCode(),
            listType: list.listType,
            isDefault: true,
            itemCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }
}

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

/**
 * Get user-friendly error message
 * @param {string} errorCode - Firebase error code
 */
function getErrorMessage(errorCode) {
    const errorMessages = {
        // Email/Password errors
        'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/operation-not-allowed': 'Email/password sign-in is not enabled. Please contact support.',
        'auth/weak-password': 'Password must be at least 6 characters long.',
        'auth/user-disabled': 'This account has been disabled. Please contact support.',
        'auth/user-not-found': 'No account found with this email address.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-credential': 'Invalid email or password. Please check and try again.',
        'auth/invalid-login-credentials': 'Invalid email or password. Please check and try again.',

        // Rate limiting
        'auth/too-many-requests': 'Too many failed attempts. Please wait a few minutes and try again.',

        // Popup/OAuth errors
        'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
        'auth/popup-blocked': 'Pop-up was blocked by your browser. Please allow pop-ups and try again.',
        'auth/cancelled-popup-request': 'Sign-in was cancelled. Please try again.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',

        // Network errors
        'auth/network-request-failed': 'Network error. Please check your internet connection.',
        'auth/internal-error': 'An internal error occurred. Please try again later.',
        'auth/timeout': 'The request timed out. Please try again.',

        // Configuration errors
        'auth/unauthorized-domain': 'This domain is not authorized. Please contact support.',
        'auth/invalid-api-key': 'Configuration error. Please contact support.',
        'auth/app-deleted': 'The app has been deleted. Please refresh the page.',

        // Password reset
        'auth/expired-action-code': 'This link has expired. Please request a new one.',
        'auth/invalid-action-code': 'This link is invalid. Please request a new one.',

        // General
        'auth/requires-recent-login': 'Please sign in again to complete this action.',
        'auth/missing-email': 'Please enter your email address.',
        'auth/missing-password': 'Please enter your password.'
    };

    return errorMessages[errorCode] || `An error occurred (${errorCode || 'unknown'}). Please try again.`;
}

/**
 * Get user profile from Firestore
 * @param {string} userId - User ID
 */
export async function getUserProfile(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return { success: true, data: userDoc.data() };
        }
        return { success: false, error: 'User not found' };
    } catch (error) {
        console.error('Get user profile error:', error);
        return { success: false, error: error.message };
    }
}
