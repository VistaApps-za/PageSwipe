/**
 * PageSwipe Main Application
 * Handles UI interactions, state management, and view routing
 */

import {
    onAuthChange,
    getCurrentUser,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signInWithApple,
    signOutUser,
    getUserProfile
} from './auth-service.js';

import {
    getUserLists,
    subscribeToLists,
    createList,
    deleteList,
    getListItems,
    getCurrentlyReading,
    getFinishedBooksCount,
    addBookToList,
    removeBookFromList,
    updateItemStatus,
    updateReadingProgress,
    moveItemToList,
    getBookDescription,
    getUserClubs,
    createClub,
    joinClub,
    leaveClub,
    deleteClub,
    getClubMembers,
    getMemberBooksInClub,
    getClubActivity,
    getClubBooks,
    addBookToClub,
    markInterestedInClubBook,
    markNotInterestedInClubBook,
    getActivityText,
    postActivityToClubsWithBook,
    getUserStats,
    updateUserProfile,
    updateUserSettings,
    getUserSettings,
    addBookReview,
    getBookReviews,
    finishBookAndMove,
    getBookItem,
    getClubMemberReviews,
    getAllClubMemberReviews,
    uploadProfilePhoto,
    removeProfilePhoto,
    canCreateList,
    canCreateClub,
    getOwnedBooks,
    markAsOwned,
    removeOwnership,
    getOwnedBooksCount,
    canAddToLibrary,
    getLibraryLimitInfo,
    refetchBookCover,
    updateBookCover,
    getUserReviewForBook,
    checkIfOwned
} from './db-service.js';

import {
    searchBooks,
    lookupByISBN,
    getDiscoveryBooks,
    getRecommendationsByGenre,
    discoverBooks,
    DISCOVERY_GENRES
} from './book-lookup.js';

import { functions } from './firebase-config.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js';

// ============================================
// APP STATE
// ============================================

const state = {
    user: null,
    userProfile: null,
    userSettings: null,
    lists: [],
    clubs: [],
    currentView: 'home',
    currentList: null,
    currentClub: null,
    currentClubBooks: [],
    currentClubMembers: [],
    currentClubActivity: [],
    selectedClubBook: null,
    selectedBookForClub: null,  // Book being added to a club (for club picker)
    clubTab: 'books',
    discoveryBooks: [],
    discoveryIndex: 0,
    selectedBook: null,
    isLoading: false,
    finishingBook: null,  // Book being finished (for review flow)
    currentRating: 0,     // Current star rating selection
    selectedGenre: 'random',  // Selected genre for discovery (uses cloud function IDs)
    seenISBNs: [],         // Track seen ISBNs to avoid duplicates
    // My Books state
    ownedBooks: [],
    ownedBooksFilter: 'all',  // 'all', 'read', 'unread'
    ownedBooksGenre: 'all',   // 'all' or specific genre name
    ownedBooksSearch: '',
    libraryTab: 'my-books',   // 'my-books' or 'reading-lists'
    // Library limit state (freemium)
    libraryLimitInfo: {
        currentCount: 0,
        limit: 50,
        isPro: false,
        showWarning: false,
        remaining: 50
    }
};

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    authView: document.getElementById('auth-view'),
    mainApp: document.getElementById('main-app'),
    loadingOverlay: document.getElementById('loading-overlay'),
    toastContainer: document.getElementById('toast-container'),

    // Auth forms
    signinForm: document.getElementById('signin-form'),
    signupForm: document.getElementById('signup-form'),
    signinEmailForm: document.getElementById('signin-email-form'),
    signupEmailForm: document.getElementById('signup-email-form'),
    authError: document.getElementById('auth-error'),

    // Views
    homeView: document.getElementById('home-view'),
    discoverView: document.getElementById('discover-view'),
    libraryView: document.getElementById('library-view'),
    listDetailView: document.getElementById('list-detail-view'),
    clubsView: document.getElementById('clubs-view'),
    clubDetailView: document.getElementById('club-detail-view'),
    profileView: document.getElementById('profile-view'),

    // Home elements
    greetingText: document.getElementById('greeting-text'),
    greetingName: document.getElementById('greeting-name'),
    statReading: document.getElementById('stat-reading'),
    statFinished: document.getElementById('stat-finished'),
    statLists: document.getElementById('stat-lists'),
    statClubs: document.getElementById('stat-clubs'),
    currentlyReading: document.getElementById('currently-reading'),
    clubsPreview: document.getElementById('clubs-preview'),

    // Sidebar
    sidebarAvatar: document.getElementById('sidebar-avatar'),
    sidebarUsername: document.getElementById('sidebar-username'),

    // Discover
    swipeCards: document.getElementById('swipe-cards'),
    swipeEmpty: document.getElementById('swipe-empty'),

    // Library
    listsGrid: document.getElementById('lists-grid'),
    listDetailTitle: document.getElementById('list-detail-title'),
    listDetailCount: document.getElementById('list-detail-count'),
    listBooks: document.getElementById('list-books'),

    // My Books
    myBooksGrid: document.getElementById('my-books-grid'),
    myBooksCount: document.getElementById('my-books-count'),
    myBooksSearch: document.getElementById('my-books-search'),
    myBooksEmpty: document.getElementById('my-books-empty'),
    myBooksTab: document.getElementById('my-books-tab'),
    readingListsTab: document.getElementById('reading-lists-tab'),

    // Clubs
    clubsGrid: document.getElementById('clubs-grid'),
    clubsEmpty: document.getElementById('clubs-empty'),
    clubDetailName: document.getElementById('club-detail-name'),
    clubDetailMembers: document.getElementById('club-detail-members'),
    clubCurrentBook: document.getElementById('club-current-book'),
    clubMembers: document.getElementById('club-members'),
    clubActivity: document.getElementById('club-activity'),

    // Profile
    profileAvatar: document.getElementById('profile-avatar'),
    profileAvatarInitials: document.getElementById('profile-avatar-initials'),
    profileName: document.getElementById('profile-name'),
    profileEmail: document.getElementById('profile-email'),
    profileBadge: document.getElementById('profile-badge'),
    profileBooksCount: document.getElementById('profile-books-count'),
    profileYearCount: document.getElementById('profile-year-count'),
    profileClubsCount: document.getElementById('profile-clubs-count'),
    upgradeCard: document.getElementById('upgrade-card'),

    // Modals
    addBookModal: document.getElementById('add-book-modal'),
    createListModal: document.getElementById('create-list-modal'),
    createClubModal: document.getElementById('create-club-modal'),
    joinClubModal: document.getElementById('join-club-modal'),
    listPickerModal: document.getElementById('list-picker-modal'),
    clubPickerModal: document.getElementById('club-picker-modal'),
    bookDetailModal: document.getElementById('book-detail-modal'),
    editProfileModal: document.getElementById('edit-profile-modal'),
    settingsModal: document.getElementById('settings-modal'),
    reviewModal: document.getElementById('review-modal'),
    celebrationModal: document.getElementById('celebration-modal'),

    // Modal forms and elements
    bookSearchInput: document.getElementById('book-search-input'),
    bookSearchResults: document.getElementById('book-search-results'),
    createListForm: document.getElementById('create-list-form'),
    createClubForm: document.getElementById('create-club-form'),
    joinClubForm: document.getElementById('join-club-form'),
    listPicker: document.getElementById('list-picker'),
    clubPicker: document.getElementById('club-picker'),
    libraryBookContent: document.getElementById('library-book-content'),
    editProfileForm: document.getElementById('edit-profile-form'),
    reviewForm: document.getElementById('review-form'),
    starRating: document.getElementById('star-rating'),
    reviewBookInfo: document.getElementById('review-book-info')
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initEventListeners();
    initRapidScannerListeners();
});

// Refresh data when tab becomes visible again
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.user) {
        // Refresh current view data
        if (state.currentView === 'clubs') {
            loadClubsData();
        } else if (state.currentView === 'library') {
            loadLibraryData();
        } else if (state.currentView === 'dashboard') {
            loadDashboardData();
        }
    }
});

function initAuth() {
    onAuthChange(async (user) => {
        if (user) {
            state.user = user;
            const profileResult = await getUserProfile(user.uid);
            if (profileResult.success) {
                state.userProfile = profileResult.data;
            }
            showMainApp();
            loadUserData();
        } else {
            state.user = null;
            state.userProfile = null;
            showAuthView();
        }
    });
}

function initEventListeners() {
    // Auth form toggles
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        elements.signinForm.style.display = 'none';
        elements.signupForm.style.display = 'block';
        hideAuthError();
    });

    document.getElementById('show-signin').addEventListener('click', (e) => {
        e.preventDefault();
        elements.signupForm.style.display = 'none';
        elements.signinForm.style.display = 'block';
        hideAuthError();
    });

    // Auth form submissions
    elements.signinEmailForm.addEventListener('submit', handleSignIn);
    elements.signupEmailForm.addEventListener('submit', handleSignUp);

    // Social auth
    document.getElementById('google-signin').addEventListener('click', handleGoogleAuth);
    document.getElementById('google-signup').addEventListener('click', handleGoogleAuth);
    document.getElementById('apple-signin').addEventListener('click', handleAppleAuth);
    document.getElementById('apple-signup').addEventListener('click', handleAppleAuth);

    // Navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.view);
            closeMobileSidebar();
        });
    });

    document.querySelectorAll('[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.classList.contains('nav-item')) return;
            e.preventDefault();
            navigateTo(item.dataset.view);
        });
    });

    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            if (sidebar && sidebarOverlay) {
                sidebar.classList.add('open');
                sidebarOverlay.classList.add('show');
                document.body.style.overflow = 'hidden';
            }
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    // Bottom navigation (mobile)
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.view);
        });
    });

    // Back buttons
    document.getElementById('back-to-library').addEventListener('click', () => navigateTo('library'));
    document.getElementById('back-to-clubs').addEventListener('click', () => navigateTo('clubs'));

    // Sign out
    document.getElementById('signout-btn').addEventListener('click', handleSignOut);

    // Add book button
    document.getElementById('add-book-btn').addEventListener('click', () => openModal('add-book-modal'));

    // Create list button (with premium check)
    document.getElementById('create-list-btn').addEventListener('click', handleOpenCreateListModal);

    // Club buttons (with premium check for create)
    document.getElementById('create-club-btn').addEventListener('click', handleOpenCreateClubModal);
    document.getElementById('join-club-btn').addEventListener('click', () => openModal('join-club-modal'));
    document.getElementById('create-club-empty').addEventListener('click', handleOpenCreateClubModal);
    document.getElementById('join-club-empty').addEventListener('click', () => openModal('join-club-modal'));
    document.getElementById('join-club-home').addEventListener('click', () => openModal('join-club-modal'));

    // Quick action buttons (with premium checks)
    document.getElementById('quick-add-book')?.addEventListener('click', () => openModal('add-book-modal'));
    document.getElementById('quick-create-list')?.addEventListener('click', handleOpenCreateListModal);
    document.getElementById('quick-create-club')?.addEventListener('click', handleOpenCreateClubModal);

    // Club detail buttons
    document.getElementById('club-settings-btn').addEventListener('click', () => {
        if (state.currentClub) {
            document.getElementById('club-join-code-display').textContent = state.currentClub.joinCode || 'N/A';
            // Show/hide delete button based on ownership
            const deleteBtn = document.getElementById('delete-club-btn');
            const leaveBtn = document.getElementById('leave-club-btn');
            if (state.currentClub.ownerId === state.user?.uid) {
                deleteBtn.style.display = 'flex';
                leaveBtn.style.display = 'none';
            } else {
                deleteBtn.style.display = 'none';
                leaveBtn.style.display = 'flex';
            }
            openModal('club-settings-modal');
        }
    });

    document.getElementById('copy-join-code').addEventListener('click', async () => {
        const code = document.getElementById('club-join-code-display').textContent;
        try {
            await navigator.clipboard.writeText(code);
            showToast('Join code copied!', 'success');
        } catch (err) {
            showToast('Failed to copy code', 'error');
        }
    });

    document.getElementById('leave-club-btn').addEventListener('click', handleLeaveClub);
    document.getElementById('delete-club-btn').addEventListener('click', handleDeleteClub);
    document.getElementById('club-share-btn')?.addEventListener('click', shareClub);
    document.getElementById('list-share-btn')?.addEventListener('click', shareList);
    document.getElementById('list-revoke-share-btn')?.addEventListener('click', revokeListShare);

    // Club tabs
    document.querySelectorAll('.club-tab, .club-tab-new').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchClubTab(tabName);
        });
    });

    // Add book to club
    document.getElementById('add-book-to-club').addEventListener('click', () => loadUserBooksForClub());
    document.getElementById('add-first-book')?.addEventListener('click', () => loadUserBooksForClub());

    // Club book interest buttons
    document.getElementById('mark-interested-btn').addEventListener('click', handleMarkInterested);
    document.getElementById('mark-not-interested-btn').addEventListener('click', handleMarkNotInterested);

    // Club book description Read More toggle
    document.getElementById('club-book-readmore').addEventListener('click', () => {
        const descEl = document.getElementById('club-book-description');
        const readMoreBtn = document.getElementById('club-book-readmore');
        const isExpanded = descEl.classList.toggle('expanded');
        readMoreBtn.textContent = isExpanded ? 'Read Less' : 'Read More';
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-close-float, .modal-backdrop').forEach(el => {
        el.addEventListener('click', closeAllModals);
    });

    // Stop propagation on modal content
    document.querySelectorAll('.modal-content').forEach(el => {
        el.addEventListener('click', (e) => e.stopPropagation());
    });

    // Book search
    document.getElementById('book-search-btn').addEventListener('click', handleBookSearch);
    elements.bookSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleBookSearch();
    });

    // Barcode scanner (rapid scan mode)
    document.getElementById('barcode-scan-btn')?.addEventListener('click', openBarcodeScanner);

    // Form submissions
    elements.createListForm.addEventListener('submit', handleCreateList);
    elements.createClubForm.addEventListener('submit', handleCreateClub);
    elements.joinClubForm.addEventListener('submit', handleJoinClub);

    // Discover actions
    document.getElementById('reload-cards').addEventListener('click', loadDiscoveryBooks);
    document.getElementById('refresh-discover').addEventListener('click', loadDiscoveryBooks);
    document.getElementById('swipe-add-to-list-btn').addEventListener('click', addCurrentBookToSelectedList);

    // Keyboard navigation for discovery swipe cards
    document.addEventListener('keydown', (e) => {
        // Only handle keys when on discover view and no modal is open
        if (state.currentView !== 'discover') return;
        if (document.querySelector('.modal.active')) return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                handleSwipe('left');
                break;
            case 'ArrowRight':
                e.preventDefault();
                handleSwipe('right');
                break;
            case 'ArrowUp':
            case 's':
            case 'S':
                e.preventDefault();
                handleBookmark();
                break;
        }
    });

    // Genre selection for discovery
    document.getElementById('genre-select').addEventListener('change', (e) => {
        state.selectedGenre = e.target.value || 'random';
        loadDiscoveryBooks(true); // Clear seen ISBNs when changing genre
    });

    // Profile & Settings
    document.getElementById('settings-btn').addEventListener('click', () => openModal('settings-modal'));
    document.getElementById('edit-profile-btn').addEventListener('click', () => {
        populateEditProfileForm();
        openModal('edit-profile-modal');
    });
    document.getElementById('settings-edit-profile').addEventListener('click', () => {
        closeAllModals();
        populateEditProfileForm();
        openModal('edit-profile-modal');
    });
    document.getElementById('save-settings-btn').addEventListener('click', handleSaveSettings);
    elements.editProfileForm.addEventListener('submit', handleEditProfile);

    // Profile photo handlers
    document.getElementById('profile-photo-input')?.addEventListener('change', handlePhotoSelect);
    document.getElementById('remove-photo-btn')?.addEventListener('click', handlePhotoRemove);

    // Review & Celebration
    elements.reviewForm.addEventListener('submit', handleSubmitReview);
    document.getElementById('skip-review-btn').addEventListener('click', () => {
        closeAllModals();
        state.finishingBook = null;
    });
    document.getElementById('celebration-skip').addEventListener('click', () => {
        closeAllModals();
        state.finishingBook = null;
    });
    document.getElementById('celebration-review').addEventListener('click', () => {
        closeAllModals();
        if (state.finishingBook) {
            showReviewModal(state.finishingBook);
        }
    });

    // Star rating interaction
    elements.starRating.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            setStarRating(rating);
        });
        star.addEventListener('mouseenter', () => {
            highlightStars(parseInt(star.dataset.rating));
        });
    });
    elements.starRating.addEventListener('mouseleave', () => {
        highlightStars(state.currentRating);
    });

    // My Books - Library Tabs
    document.querySelectorAll('.library-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchLibraryTab(tabName);
        });
    });

    // My Books - Filter Chips
    document.querySelectorAll('.my-books-filters .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const filter = chip.dataset.filter;
            setMyBooksFilter(filter);
        });
    });

    // My Books - Search
    if (elements.myBooksSearch) {
        elements.myBooksSearch.addEventListener('input', (e) => {
            state.ownedBooksSearch = e.target.value.toLowerCase();
            renderMyBooks();
        });
    }

    // My Books - Header action buttons
    document.getElementById('my-books-scan-btn')?.addEventListener('click', openBarcodeScanner);
    document.getElementById('my-books-add-btn')?.addEventListener('click', () => {
        openModal('add-book-modal');
    });

    // My Books - Empty state buttons
    document.getElementById('scan-first-book-btn')?.addEventListener('click', openBarcodeScanner);
    document.getElementById('add-first-book-btn')?.addEventListener('click', () => {
        openModal('add-book-modal');
    });

    // Library Limit Warning - Upgrade link
    document.getElementById('library-limit-upgrade-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'premium.html';
    });

    // Library Limit Modal - Buttons
    document.getElementById('library-limit-upgrade-btn')?.addEventListener('click', () => {
        closeAllModals();
        window.location.href = 'premium.html';
    });
    document.getElementById('library-limit-dismiss-btn')?.addEventListener('click', () => {
        closeAllModals();
    });

    // Book Detail Modal - Add to Library button
    document.getElementById('add-to-library-btn')?.addEventListener('click', () => {
        const formatPicker = document.getElementById('ownership-format-picker');
        if (formatPicker) {
            formatPicker.classList.add('active');
        }
    });

    // Book Detail Modal - Confirm Add to Library
    document.getElementById('confirm-add-to-library')?.addEventListener('click', () => {
        const selectedFormat = document.querySelector('.format-option.selected')?.dataset.format || 'physical';
        window.confirmAddToLibrary(selectedFormat);
    });
}

// ============================================
// AUTH HANDLERS
// ============================================

async function handleSignIn(e) {
    e.preventDefault();
    hideAuthError();
    clearFieldErrors();

    const emailInput = document.getElementById('signin-email');
    const passwordInput = document.getElementById('signin-password');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Client-side validation
    let hasError = false;

    if (!email) {
        showFieldError(emailInput, 'Please enter your email address');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showFieldError(emailInput, 'Please enter a valid email address');
        hasError = true;
    }

    if (!password) {
        showFieldError(passwordInput, 'Please enter your password');
        hasError = true;
    }

    if (hasError) {
        showAuthError('Please fix the errors above');
        return;
    }

    // Show loading state
    setButtonLoading(submitBtn, true);

    try {
        const result = await signInWithEmail(email, password);

        if (!result.success) {
            showAuthError(result.error);

            // Highlight specific field if applicable
            if (result.error.toLowerCase().includes('email')) {
                emailInput.classList.add('error');
            }
            if (result.error.toLowerCase().includes('password')) {
                passwordInput.classList.add('error');
            }
        }
    } catch (error) {
        console.error('Sign in error:', error);
        showAuthError('An unexpected error occurred. Please try again.');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

async function handleSignUp(e) {
    e.preventDefault();
    hideAuthError();
    clearFieldErrors();

    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Client-side validation
    let hasError = false;

    if (!name) {
        showFieldError(nameInput, 'Please enter your name');
        hasError = true;
    } else if (name.length < 2) {
        showFieldError(nameInput, 'Name must be at least 2 characters');
        hasError = true;
    }

    if (!email) {
        showFieldError(emailInput, 'Please enter your email address');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showFieldError(emailInput, 'Please enter a valid email address');
        hasError = true;
    }

    if (!password) {
        showFieldError(passwordInput, 'Please enter a password');
        hasError = true;
    } else if (password.length < 6) {
        showFieldError(passwordInput, 'Password must be at least 6 characters');
        hasError = true;
    }

    if (hasError) {
        showAuthError('Please fix the errors above');
        return;
    }

    // Show loading state
    setButtonLoading(submitBtn, true);

    try {
        const result = await signUpWithEmail(email, password, name);

        if (!result.success) {
            showAuthError(result.error);

            // Highlight specific field if applicable
            if (result.error.toLowerCase().includes('email')) {
                emailInput.classList.add('error');
            }
            if (result.error.toLowerCase().includes('password')) {
                passwordInput.classList.add('error');
            }
        }
    } catch (error) {
        console.error('Sign up error:', error);
        showAuthError('An unexpected error occurred. Please try again.');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

async function handleGoogleAuth(e) {
    hideAuthError();
    const btn = e.target.closest('button');
    setButtonLoading(btn, true);

    try {
        const result = await signInWithGoogle();

        if (!result.success) {
            showAuthError(result.error);
        }
    } catch (error) {
        console.error('Google auth error:', error);
        showAuthError('Failed to sign in with Google. Please try again.');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleAppleAuth(e) {
    hideAuthError();
    const btn = e.target.closest('button');
    setButtonLoading(btn, true);

    try {
        const result = await signInWithApple();

        if (!result.success) {
            showAuthError(result.error);
        }
    } catch (error) {
        console.error('Apple auth error:', error);
        showAuthError('Failed to sign in with Apple. Please try again.');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function handleSignOut() {
    showLoading();
    try {
        await signOutUser();
        // Redirect to homepage after logout
        window.location.href = '/';
    } catch (error) {
        console.error('Sign out error:', error);
        showToast('Failed to sign out. Please try again.', 'error');
        hideLoading();
    }
}

// Validation helpers
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showFieldError(input, message) {
    input.classList.add('error');

    // Check if error element already exists
    let errorEl = input.parentNode.querySelector('.field-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        input.parentNode.appendChild(errorEl);
    }

    errorEl.textContent = message;
    errorEl.classList.add('show');
}

function clearFieldErrors() {
    document.querySelectorAll('.form-group input.error').forEach(input => {
        input.classList.remove('error');
    });
    document.querySelectorAll('.field-error').forEach(el => {
        el.classList.remove('show');
    });
}

function setButtonLoading(btn, loading) {
    if (!btn) return;

    if (loading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// ============================================
// VIEW MANAGEMENT
// ============================================

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
}

function showAuthView() {
    hideLoadingScreen();
    elements.authView.style.display = 'flex';
    elements.mainApp.style.display = 'none';
}

function showMainApp() {
    hideLoadingScreen();
    elements.authView.style.display = 'none';
    elements.mainApp.style.display = 'grid';
    updateUserUI();
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    document.body.style.overflow = '';
}

function navigateTo(viewName) {
    // Update sidebar nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Update bottom nav items (mobile)
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Show target view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
        state.currentView = viewName;

        // Load view-specific data
        switch (viewName) {
            case 'home':
                loadHomeData();
                break;
            case 'discover':
                if (state.discoveryBooks.length === 0) {
                    loadDiscoveryBooks();
                }
                checkDiscoverTutorial();
                break;
            case 'library':
                loadLibraryData();
                break;
            case 'clubs':
                loadClubsData();
                break;
            case 'profile':
                loadProfileData();
                break;
        }
    }
}

// ============================================
// DATA LOADING
// ============================================

async function loadUserData() {
    loadHomeData();
    loadLibraryData();
    loadClubsData();
    loadUserSettings();

    // Preload discovery books in background for instant access
    preloadDiscoveryBooks();
}

async function loadHomeData() {
    if (!state.user) return;

    // Update greeting
    updateGreeting();

    // Load stats
    const statsResult = await getUserStats(state.user.uid);
    if (statsResult.success) {
        elements.statReading.textContent = statsResult.data.currentlyReading;
        elements.statFinished.textContent = statsResult.data.finished;
        elements.statLists.textContent = statsResult.data.lists;
        elements.statClubs.textContent = statsResult.data.clubs;
    }

    // Load currently reading
    const readingResult = await getCurrentlyReading(state.user.uid);
    if (readingResult.success && readingResult.data.length > 0) {
        elements.currentlyReading.innerHTML = `
            <div class="reading-books-list">
                ${readingResult.data.slice(0, 3).map(item => createReadingCardCompact(item)).join('')}
            </div>
        `;
        // Add click handlers for reading cards
        elements.currentlyReading.querySelectorAll('.reading-card-compact').forEach(card => {
            card.addEventListener('click', () => {
                const itemId = card.dataset.itemId;
                openBookDetail(itemId, readingResult.data);
            });
        });
    } else {
        elements.currentlyReading.innerHTML = `
            <div class="empty-state-inline">
                <p>No books in progress</p>
                <button class="btn btn-accent btn-sm" data-view="discover">Discover Books</button>
            </div>
        `;
    }

    // Load clubs preview
    const clubsResult = await getUserClubs(state.user.uid);
    if (clubsResult.success && clubsResult.data.length > 0) {
        state.clubs = clubsResult.data;
        elements.clubsPreview.innerHTML = `
            <div class="clubs-list-compact">
                ${clubsResult.data.slice(0, 3).map(club => createClubCardCompact(club)).join('')}
            </div>
        `;
        // Add click handlers for club cards
        elements.clubsPreview.querySelectorAll('.club-card-compact').forEach(card => {
            card.addEventListener('click', () => {
                const clubId = card.dataset.clubId;
                switchView('clubs');
                loadClubDetail(clubId);
            });
        });
    } else {
        elements.clubsPreview.innerHTML = `
            <div class="empty-state-inline">
                <p>Join a club to read with friends</p>
                <button class="btn btn-accent btn-sm" id="join-club-home-empty">Join a Club</button>
            </div>
        `;
        document.getElementById('join-club-home-empty')?.addEventListener('click', () => openModal('join-club-modal'));
    }
}

async function loadLibraryData() {
    if (!state.user) return;

    // Load reading lists
    const ownerName = state.userProfile?.displayName || state.user.displayName || state.user.email;
    const result = await getUserLists(state.user.uid, ownerName);
    if (result.success) {
        state.lists = result.data;
        renderLists();
        populateSwipeListDropdown();
    }

    // Load owned books
    await loadMyBooks();
}

async function loadMyBooks() {
    if (!state.user) return;

    // Load owned books
    const result = await getOwnedBooks(state.user.uid);
    if (result.success) {
        state.ownedBooks = result.data;
    }

    // Load library limit info for freemium
    const limitInfo = await getLibraryLimitInfo(state.user.uid);
    state.libraryLimitInfo = limitInfo;

    renderMyBooks();
}

async function loadClubsData() {
    if (!state.user) return;

    const result = await getUserClubs(state.user.uid);
    if (result.success) {
        state.clubs = result.data;
        renderClubs();
    }
}

async function loadProfileData() {
    if (!state.user || !state.userProfile) return;

    const name = state.userProfile.displayName || state.user.displayName || state.user.email;
    const photoURL = state.userProfile.photoURL;

    // Update profile avatar with photo support
    updateAvatarElement(elements.profileAvatar, photoURL, name);

    // Also update the initials element directly if it exists (new redesigned profile)
    if (elements.profileAvatarInitials) {
        elements.profileAvatarInitials.textContent = getInitials(name);
    }

    elements.profileName.textContent = state.userProfile.displayName || 'User';
    elements.profileEmail.textContent = state.user.email;

    // Update badge - handle both old (text only) and new (with .profile-badge-text) structure
    const badgeTextEl = elements.profileBadge.querySelector('.profile-badge-text');
    if (state.userProfile.isPro) {
        if (badgeTextEl) {
            badgeTextEl.textContent = 'Pro';
        } else {
            elements.profileBadge.textContent = 'Pro';
        }
        elements.profileBadge.classList.add('pro');
        elements.upgradeCard.style.display = 'none';
    } else {
        if (badgeTextEl) {
            badgeTextEl.textContent = 'Free';
        } else {
            elements.profileBadge.textContent = 'Free';
        }
        elements.profileBadge.classList.remove('pro');
        elements.upgradeCard.style.display = 'block';
    }

    // Load stats
    const statsResult = await getUserStats(state.user.uid);
    if (statsResult.success) {
        elements.profileBooksCount.textContent = statsResult.data.finished;
        elements.profileYearCount.textContent = statsResult.data.finished; // TODO: Filter by year
        elements.profileClubsCount.textContent = statsResult.data.clubs;
    }
}

async function loadDiscoveryBooks(clearSeenISBNs = false) {
    showLoading();

    // Optionally clear seen ISBNs when changing genres
    if (clearSeenISBNs) {
        state.seenISBNs = [];
    }

    try {
        // Use the centralized cloud function for discovery
        const result = await discoverBooks(
            state.selectedGenre || 'random',
            state.seenISBNs,
            15
        );

        hideLoading();

        if (result.success && result.data.length > 0) {
            state.discoveryBooks = result.data;
            state.discoveryIndex = 0;

            // Track seen ISBNs to avoid showing duplicates
            const newISBNs = result.data.map(book => book.isbn).filter(isbn => isbn);
            state.seenISBNs = [...state.seenISBNs, ...newISBNs];

            renderDiscoveryCards();
        } else {
            elements.swipeCards.innerHTML = '';
            elements.swipeEmpty.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading discovery books:', error);
        hideLoading();
        elements.swipeCards.innerHTML = '';
        elements.swipeEmpty.style.display = 'block';
    }
}

// Preload discovery books in background (no loading overlay)
async function preloadDiscoveryBooks() {
    // Don't preload if already loaded
    if (state.discoveryBooks.length > 0) return;

    try {
        const result = await discoverBooks('random', [], 15);

        if (result.success && result.data.length > 0) {
            state.discoveryBooks = result.data;
            state.discoveryIndex = 0;

            // Track seen ISBNs
            const newISBNs = result.data.map(book => book.isbn).filter(isbn => isbn);
            state.seenISBNs = [...state.seenISBNs, ...newISBNs];

            // Pre-render cards if discover view exists (but not visible)
            if (elements.swipeCards) {
                renderDiscoveryCards();
            }
        }
    } catch (error) {
        console.error('Preload discovery books error:', error);
        // Silent fail - will load normally when user visits discover
    }
}

async function loadListDetail(listId) {
    const list = state.lists.find(l => l.id === listId);
    if (!list) return;

    state.currentList = list;
    elements.listDetailTitle.textContent = list.name;

    // Update revoke share button visibility
    updateRevokeShareButton();

    const result = await getListItems(listId);
    if (result.success) {
        elements.listDetailCount.textContent = pluralize(result.data.length, 'book');

        if (result.data.length > 0) {
            elements.listBooks.innerHTML = result.data.map(item => createBookCard(item)).join('');

            // Add click handlers
            elements.listBooks.querySelectorAll('.book-card').forEach(card => {
                card.addEventListener('click', () => openBookDetail(card.dataset.id, result.data));
            });
        } else {
            elements.listBooks.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📚</span>
                    <p>No books in this list yet</p>
                    <button class="btn btn-secondary" onclick="openModal('add-book-modal')">Add a Book</button>
                </div>
            `;
        }
    }

    navigateTo('list-detail');
}

async function loadClubDetail(clubId) {
    const club = state.clubs.find(c => c.id === clubId);
    if (!club) return;

    state.currentClub = club;
    state.clubTab = 'books';
    elements.clubDetailName.textContent = club.name;

    // Show description in info bar (hide separator if no description)
    const descriptionEl = document.getElementById('club-detail-description');
    const separatorEl = document.querySelector('.club-info-separator');
    if (descriptionEl && separatorEl) {
        if (club.description) {
            descriptionEl.textContent = club.description;
            separatorEl.style.display = '';
        } else {
            descriptionEl.textContent = '';
            separatorEl.style.display = 'none';
        }
    }

    // Load all club data
    await Promise.all([
        loadClubBooks(clubId),
        loadClubMembersData(clubId),
        loadClubActivityData(clubId)
    ]);

    // Re-render members with accurate stats (now that books are loaded)
    renderClubMembers();

    // Update member count with proper grammar
    elements.clubDetailMembers.textContent = pluralize(state.currentClubMembers.length, 'member');

    // Reset to books tab
    switchClubTab('books');

    navigateTo('club-detail');
}

async function loadClubBooks(clubId) {
    const result = await getClubBooks(clubId);
    if (result.success) {
        state.currentClubBooks = result.data;
        renderClubBooks();
    }
}

function renderClubBooks() {
    const container = document.getElementById('club-books');
    const emptyState = document.getElementById('club-books-empty');
    const userId = state.user?.uid;

    // Filter books: visible = not marked as not interested, hidden = marked as not interested
    const visibleBooks = state.currentClubBooks.filter(book =>
        !book.notInterestedMembers?.some(m => m.userId === userId)
    );
    const hiddenBooks = state.currentClubBooks.filter(book =>
        book.notInterestedMembers?.some(m => m.userId === userId)
    );

    if (state.currentClubBooks.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';

        // Render visible books
        let html = visibleBooks.map(book => createClubBookCard(book)).join('');

        // Show empty state for visible books if all are hidden
        if (visibleBooks.length === 0 && hiddenBooks.length > 0) {
            html = `
                <div class="club-books-all-hidden">
                    <p>You've hidden all books in this club.</p>
                    <p class="text-muted">Expand the Hidden section below to see them.</p>
                </div>
            `;
        }

        // Render hidden section if any hidden books
        if (hiddenBooks.length > 0) {
            html += `
                <div class="hidden-books-section">
                    <button class="hidden-books-toggle" id="hidden-books-toggle">
                        <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        <span>Hidden</span>
                        <span class="hidden-count">(${hiddenBooks.length})</span>
                    </button>
                    <div class="hidden-books-list" id="hidden-books-list">
                        ${hiddenBooks.map(book => createClubBookCard(book, true)).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Add click handlers for visible books
        container.querySelectorAll('.club-book-card-new:not(.hidden-book)').forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.id;
                const book = state.currentClubBooks.find(b => b.id === bookId);
                if (book) openClubBookDetail(book);
            });
        });

        // Add click handlers for hidden books
        container.querySelectorAll('.club-book-card-new.hidden-book').forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.id;
                const book = state.currentClubBooks.find(b => b.id === bookId);
                if (book) openClubBookDetail(book);
            });
        });

        // Add toggle handler for hidden section
        const toggleBtn = document.getElementById('hidden-books-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleHiddenBooks);
        }
    }
}

function toggleHiddenBooks() {
    const toggle = document.getElementById('hidden-books-toggle');
    const list = document.getElementById('hidden-books-list');
    if (toggle && list) {
        toggle.classList.toggle('expanded');
        list.classList.toggle('expanded');
    }
}

function createClubBookCard(book, isHidden = false) {
    const authors = book.authors?.join(', ') || 'Unknown Author';
    const addedBy = book.addedBy?.displayName || 'Someone';
    const interestedMembers = book.interestedMembers || [];
    const hiddenClass = isHidden ? ' hidden-book' : '';

    // Create interested members HTML with stacking avatars
    let interestedHTML = '';
    if (interestedMembers.length > 0) {
        const maxDisplay = 4;
        const displayMembers = interestedMembers.slice(0, maxDisplay);
        const extraCount = interestedMembers.length - maxDisplay;

        const avatarsHTML = displayMembers.map((member, index) => `
            <div class="interested-stack-avatar" style="z-index: ${maxDisplay - index};" title="${member.displayName}">
                ${member.photoURL
                    ? `<img src="${member.photoURL}" alt="${member.displayName}">`
                    : `<span class="avatar-initials">${getInitials(member.displayName)}</span>`
                }
            </div>
        `).join('');

        const extraHTML = extraCount > 0 ? `<span class="interested-stack-extra">+${extraCount}</span>` : '';

        interestedHTML = `
            <div class="book-interested-row">
                <div class="interested-stack">
                    ${avatarsHTML}
                    ${extraHTML}
                </div>
                <span class="interested-label">${interestedMembers.length} interested</span>
            </div>
        `;
    }

    return `
        <div class="club-book-card-new${hiddenClass}" data-id="${book.id}">
            <div class="book-cover">
                ${book.coverImageUrl ? `<img src="${book.coverImageUrl}" alt="${book.title}">` : ''}
            </div>
            <div class="book-info">
                <h4 class="book-title">${book.title}</h4>
                <p class="book-author">${authors}</p>
                <div class="book-added-by">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Added by ${addedBy}
                </div>
                ${interestedHTML}
            </div>
        </div>
    `;
}

function openClubBookDetail(book) {
    state.selectedClubBook = book;

    document.getElementById('club-book-title').textContent = book.title;
    document.getElementById('club-book-author').textContent = book.authors?.join(', ') || 'Unknown Author';
    document.getElementById('club-book-added-by').textContent = `Added by ${book.addedBy?.displayName || 'Someone'}`;

    // Set description with Read More functionality
    const descEl = document.getElementById('club-book-description');
    const readMoreBtn = document.getElementById('club-book-readmore');
    const description = book.description || 'No description available.';

    descEl.textContent = description;
    descEl.classList.remove('expanded');
    readMoreBtn.textContent = 'Read More';

    // Show Read More button only if description is long enough (more than ~150 chars)
    if (description.length > 150) {
        readMoreBtn.classList.remove('hidden');
    } else {
        readMoreBtn.classList.add('hidden');
    }

    const coverEl = document.getElementById('club-book-cover');
    coverEl.innerHTML = book.coverImageUrl ? `<img src="${book.coverImageUrl}" alt="${book.title}">` : '';

    // Show interested members
    const interestedMembers = book.interestedMembers || [];
    document.getElementById('interested-count').textContent = interestedMembers.length;

    const interestedList = document.getElementById('interested-members-list');
    if (interestedMembers.length > 0) {
        interestedList.innerHTML = interestedMembers.map(member => `
            <div class="interested-member">
                <div class="interested-member-avatar">
                    ${member.photoURL ? `<img src="${member.photoURL}" alt="${member.displayName}">` : getInitials(member.displayName)}
                </div>
                <span>${member.displayName}</span>
            </div>
        `).join('');
    } else {
        interestedList.innerHTML = '<p class="text-muted">No one yet</p>';
    }

    // Check if current user is already interested
    const isInterested = interestedMembers.some(m => m.userId === state.user?.uid);
    const interestedBtn = document.getElementById('mark-interested-btn');
    if (isInterested) {
        interestedBtn.disabled = true;
        interestedBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Interested';
    } else {
        interestedBtn.disabled = false;
        interestedBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> I\'m Interested';
    }

    // Check if current user has already hidden this book
    const notInterestedMembers = book.notInterestedMembers || [];
    const isHidden = notInterestedMembers.some(m => m.userId === state.user?.uid);
    const notInterestedBtn = document.getElementById('mark-not-interested-btn');
    if (isHidden) {
        notInterestedBtn.disabled = true;
        notInterestedBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Hidden';
    } else {
        notInterestedBtn.disabled = false;
        notInterestedBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Hide Book';
    }

    openModal('club-book-modal');
}

async function loadClubMembersData(clubId) {
    const result = await getClubMembers(clubId);
    if (result.success) {
        state.currentClubMembers = result.data;
        renderClubMembers();
    }
}

function renderClubMembers() {
    const container = document.getElementById('club-members');

    // Compute actual stats from books data for each member
    const membersWithStats = state.currentClubMembers.map(member => {
        let booksAdded = 0;
        let booksInterested = 0;

        // Count from actual books data
        state.currentClubBooks.forEach(book => {
            if (book.addedBy?.userId === member.userId) {
                booksAdded++;
            }
            if (book.interestedMembers?.some(m => m.userId === member.userId)) {
                booksInterested++;
            }
        });

        return {
            ...member,
            booksAdded,
            booksInterested
        };
    });

    container.innerHTML = membersWithStats.map(member => createMemberItem(member)).join('');
}

window.openMemberProfile = async function(memberId) {
    const member = state.currentClubMembers.find(m => m.userId === memberId);
    if (!member || !state.currentClub) return;

    // Populate basic info
    const avatarContainer = document.getElementById('member-profile-avatar');
    updateAvatarElement(avatarContainer, member.photoURL, member.displayName);

    document.getElementById('member-profile-name').textContent = member.displayName;

    const badge = document.getElementById('member-profile-badge');
    if (member.role === 'owner') {
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }

    // Format join date
    const joinedDate = member.joinedAt?.toDate?.() || member.joinedAt;
    if (joinedDate) {
        const options = { month: 'short', year: 'numeric' };
        document.getElementById('member-profile-joined').textContent =
            `Joined ${new Date(joinedDate).toLocaleDateString('en-US', options)}`;
    } else {
        document.getElementById('member-profile-joined').textContent = 'Member';
    }

    // Stats - show loading initially
    document.getElementById('member-profile-books-added').textContent = '...';
    document.getElementById('member-profile-books-interested').textContent = '...';

    // Reset sections
    document.getElementById('member-books-added-section').style.display = 'none';
    document.getElementById('member-books-interested-section').style.display = 'none';
    document.getElementById('member-profile-empty').style.display = 'none';
    document.getElementById('member-books-added').innerHTML = '';
    document.getElementById('member-books-interested').innerHTML = '';

    // Open modal
    openModal('member-profile-modal');

    // Fetch books - use actual counts from data, not potentially stale counters
    const result = await getMemberBooksInClub(state.currentClub.id, memberId);
    if (result.success) {
        const { added, interested } = result.data;

        // Update stats with actual counts
        document.getElementById('member-profile-books-added').textContent = added.length;
        document.getElementById('member-profile-books-interested').textContent = interested.length;

        if (added.length === 0 && interested.length === 0) {
            document.getElementById('member-profile-empty').style.display = 'flex';
        } else {
            if (added.length > 0) {
                document.getElementById('member-books-added-section').style.display = 'block';
                document.getElementById('member-books-added').innerHTML = added.map(book => `
                    <div class="member-book-card">
                        <img src="${book.coverImageUrl || ''}" alt="${book.title}" onerror="this.style.display='none'">
                        <div class="member-book-title">${book.title}</div>
                    </div>
                `).join('');
            }

            if (interested.length > 0) {
                document.getElementById('member-books-interested-section').style.display = 'block';
                document.getElementById('member-books-interested').innerHTML = interested.map(book => `
                    <div class="member-book-card">
                        <img src="${book.coverImageUrl || ''}" alt="${book.title}" onerror="this.style.display='none'">
                        <div class="member-book-title">${book.title}</div>
                    </div>
                `).join('');
            }
        }
    } else {
        // On error, show 0s
        document.getElementById('member-profile-books-added').textContent = '0';
        document.getElementById('member-profile-books-interested').textContent = '0';
        document.getElementById('member-profile-empty').style.display = 'flex';
    }
};

async function loadClubActivityData(clubId) {
    const result = await getClubActivity(clubId);
    if (result.success) {
        state.currentClubActivity = result.data;
        renderClubActivity();
    }
}

function renderClubActivity() {
    const container = document.getElementById('club-activity');
    const emptyState = document.getElementById('club-activity-empty');

    if (state.currentClubActivity.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        container.innerHTML = state.currentClubActivity.map(activity => createActivityItem(activity)).join('');
    }
}

function switchClubTab(tabName) {
    state.clubTab = tabName;

    // Update tab buttons (support both old and new classes)
    document.querySelectorAll('.club-tab, .club-tab-new').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.club-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `club-${tabName}-tab`);
    });
}

async function loadUserBooksForClub() {
    const container = document.getElementById('user-books-for-club');
    const emptyState = document.getElementById('user-books-empty');

    container.innerHTML = '<p>Loading your books...</p>';
    openModal('add-book-club-modal');

    // Get all user's book items
    const listsResult = await getUserLists(state.user.uid);
    if (!listsResult.success) {
        container.innerHTML = '<p>Failed to load books</p>';
        return;
    }

    let allBooks = [];
    for (const list of listsResult.data) {
        const itemsResult = await getListItems(list.id);
        if (itemsResult.success) {
            allBooks = [...allBooks, ...itemsResult.data];
        }
    }

    // Remove duplicates by ISBN
    const uniqueBooks = [];
    const seenISBNs = new Set();
    for (const book of allBooks) {
        if (!seenISBNs.has(book.isbn)) {
            seenISBNs.add(book.isbn);
            uniqueBooks.push(book);
        }
    }

    if (uniqueBooks.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        container.innerHTML = uniqueBooks.map(book => `
            <div class="user-book-item" data-isbn="${book.isbn}" data-title="${book.title}">
                <div class="user-book-item-cover">
                    ${book.coverImageUrl ? `<img src="${book.coverImageUrl}" alt="${book.title}">` : ''}
                </div>
                <span class="user-book-item-title">${book.title}</span>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.user-book-item').forEach(item => {
            item.addEventListener('click', (e) => handleAddBookToClub(item.dataset, item));
        });
    }
}

async function handleAddBookToClub(bookData, clickedElement) {
    if (!state.currentClub?.id || !state.user?.uid) return;

    // Show loading state immediately
    if (clickedElement) {
        clickedElement.classList.add('loading');
        clickedElement.style.pointerEvents = 'none';
    }
    showToast('Adding book...', 'info');

    // Find the full book data
    const listsResult = await getUserLists(state.user.uid);
    let fullBook = null;

    for (const list of listsResult.data) {
        const itemsResult = await getListItems(list.id);
        if (itemsResult.success) {
            fullBook = itemsResult.data.find(b => b.isbn === bookData.isbn);
            if (fullBook) break;
        }
    }

    if (!fullBook) {
        if (clickedElement) {
            clickedElement.classList.remove('loading');
            clickedElement.style.pointerEvents = '';
        }
        showToast('Book not found', 'error');
        return;
    }

    const userData = {
        userId: state.user.uid,
        displayName: state.userProfile?.displayName || state.user.displayName || state.user.email,
        photoURL: state.userProfile?.photoURL
    };

    const result = await addBookToClub(state.currentClub.id, fullBook, userData);

    if (result.success) {
        showToast('Book added to club!', 'success');
        closeAllModals();
        await loadClubBooks(state.currentClub.id);
    } else {
        if (clickedElement) {
            clickedElement.classList.remove('loading');
            clickedElement.style.pointerEvents = '';
        }
        showToast(result.error || 'Failed to add book', 'error');
    }
}

async function handleMarkInterested() {
    if (!state.currentClub?.id || !state.selectedClubBook?.id || !state.user?.uid) return;

    const userData = {
        userId: state.user.uid,
        displayName: state.userProfile?.displayName || state.user.displayName || state.user.email,
        photoURL: state.userProfile?.photoURL
    };

    const result = await markInterestedInClubBook(state.currentClub.id, state.selectedClubBook.id, userData);

    if (result.success) {
        showToast('Marked as interested!', 'success');
        closeAllModals();
        await loadClubBooks(state.currentClub.id);
    } else {
        showToast(result.error || 'Failed to mark interested', 'error');
    }
}

async function handleMarkNotInterested() {
    if (!state.currentClub?.id || !state.selectedClubBook?.id || !state.user?.uid) return;

    const userData = {
        userId: state.user.uid,
        displayName: state.userProfile?.displayName || state.user.displayName || state.user.email,
        photoURL: state.userProfile?.photoURL || null
    };

    const result = await markNotInterestedInClubBook(state.currentClub.id, state.selectedClubBook.id, userData);

    if (result.success) {
        showToast('Book hidden', 'success');
        closeAllModals();
        await loadClubBooks(state.currentClub.id);
    } else {
        showToast(result.error || 'Failed to hide book', 'error');
    }
}

async function handleLeaveClub() {
    if (!state.currentClub?.id || !state.user?.uid) return;

    if (!confirm('Are you sure you want to leave this club?')) return;

    const result = await leaveClub(state.currentClub.id, state.user.uid);

    if (result.success) {
        showToast('You left the club', 'success');
        closeAllModals();
        await loadClubsData();
        navigateTo('clubs');
    } else {
        showToast(result.error || 'Failed to leave club', 'error');
    }
}

async function handleDeleteClub() {
    if (!state.currentClub?.id || !state.user?.uid) return;

    if (!confirm('Are you sure you want to delete this club? This cannot be undone.')) return;

    const result = await deleteClub(state.currentClub.id, state.user.uid);

    if (result.success) {
        showToast('Club deleted', 'success');
        closeAllModals();
        await loadClubsData();
        navigateTo('clubs');
    } else {
        showToast(result.error || 'Failed to delete club', 'error');
    }
}

async function shareClub() {
    if (!state.currentClub) return;

    const userName = state.userProfile?.displayName || state.user?.displayName || 'Someone';
    const shareUrl = `https://pageswipe.tech/club/${state.currentClub.joinCode}`;
    const shareText = `${userName} has invited you to join their book club "${state.currentClub.name}" on PageSwipe!`;

    // Try native share API first (mobile)
    if (navigator.share) {
        try {
            await navigator.share({
                title: state.currentClub.name,
                text: shareText,
                url: shareUrl
            });
            return;
        } catch (err) {
            // User cancelled or share failed, fall back to clipboard
        }
    }

    // Fallback: copy to clipboard
    try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Club link copied to clipboard!', 'success');
    } catch (err) {
        // Final fallback: show the URL
        showToast(`Share: ${shareUrl}`, 'info', 5000);
    }
}

async function shareList() {
    if (!state.currentList) return;

    let publicShareId = state.currentList.publicShareId;

    // If list doesn't have a publicShareId, generate one via Cloud Function
    if (!publicShareId) {
        showToast('Generating share link...', 'info');
        try {
            const generateShareLink = httpsCallable(functions, 'generateListShareLink');
            const result = await generateShareLink({ listId: state.currentList.id });

            if (result.data.success) {
                publicShareId = result.data.shareId;
                // Update local state
                state.currentList.publicShareId = publicShareId;
                state.currentList.isPublic = true;
                // Update the list in the lists array
                const listIndex = state.lists.findIndex(l => l.id === state.currentList.id);
                if (listIndex >= 0) {
                    state.lists[listIndex].publicShareId = publicShareId;
                    state.lists[listIndex].isPublic = true;
                }
                updateRevokeShareButton();
            } else {
                showToast('Failed to generate share link', 'error');
                return;
            }
        } catch (err) {
            console.error('Error generating share link:', err);
            showToast('Failed to generate share link', 'error');
            return;
        }
    }

    const userName = state.userProfile?.displayName || state.user?.displayName || 'Someone';
    const shareUrl = `https://pageswipe.tech/list/${publicShareId}`;
    const shareText = `${userName} is sharing their reading list "${state.currentList.name}" with you on PageSwipe!`;

    // Try native share API first
    if (navigator.share) {
        try {
            await navigator.share({
                title: state.currentList.name,
                text: shareText,
                url: shareUrl
            });
            return;
        } catch (err) {
            // Fall back to clipboard
        }
    }

    // Fallback: copy to clipboard
    try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('List link copied to clipboard!', 'success');
    } catch (err) {
        showToast(`Share: ${shareUrl}`, 'info', 5000);
    }
}

async function revokeListShare() {
    if (!state.currentList || !state.currentList.publicShareId) {
        showToast('This list is not currently shared', 'info');
        return;
    }

    // Confirm with user
    if (!confirm('Are you sure you want to revoke the share link? Anyone with the current link will no longer be able to view this list.')) {
        return;
    }

    try {
        const revokeShareLink = httpsCallable(functions, 'revokeListShareLink');
        const result = await revokeShareLink({ listId: state.currentList.id });

        if (result.data.success) {
            // Update local state
            state.currentList.publicShareId = null;
            state.currentList.isPublic = false;
            // Update the list in the lists array
            const listIndex = state.lists.findIndex(l => l.id === state.currentList.id);
            if (listIndex >= 0) {
                state.lists[listIndex].publicShareId = null;
                state.lists[listIndex].isPublic = false;
            }
            updateRevokeShareButton();
            showToast('Share link revoked', 'success');
        } else {
            showToast('Failed to revoke share link', 'error');
        }
    } catch (err) {
        console.error('Error revoking share link:', err);
        showToast('Failed to revoke share link', 'error');
    }
}

function updateRevokeShareButton() {
    const revokeBtn = document.getElementById('list-revoke-share-btn');
    if (revokeBtn && state.currentList) {
        if (state.currentList.publicShareId) {
            revokeBtn.style.display = 'inline-flex';
            revokeBtn.title = 'Revoke share link';
        } else {
            revokeBtn.style.display = 'none';
        }
    }
}

async function loadClubMemberReviews(clubId, bookId) {
    const reviewsSection = document.getElementById('club-reviews-section');
    const reviewsContainer = document.getElementById('club-reviews');

    if (!bookId) {
        reviewsSection.style.display = 'none';
        return;
    }

    const result = await getClubMemberReviews(bookId, clubId);

    if (result.success && result.data.length > 0) {
        reviewsSection.style.display = 'block';
        reviewsContainer.innerHTML = result.data.map(review => createClubReviewCard(review)).join('');
    } else {
        // Show empty state encouraging reviews
        reviewsSection.style.display = 'block';
        reviewsContainer.innerHTML = `
            <div class="empty-state small">
                <p>No reviews yet from club members</p>
                <p class="text-muted">Be the first to share your thoughts!</p>
            </div>
        `;
    }
}

async function loadAllClubMemberReviews(clubId) {
    const reviewsSection = document.getElementById('club-reviews-section');
    const reviewsContainer = document.getElementById('club-reviews');

    const result = await getAllClubMemberReviews(clubId, 10);

    if (result.success && result.data.length > 0) {
        reviewsSection.style.display = 'block';
        // Update section title for all reviews
        reviewsSection.querySelector('h3').textContent = 'Recent Member Reviews';
        reviewsContainer.innerHTML = result.data.map(review => createClubReviewCard(review, true)).join('');
    } else {
        reviewsSection.style.display = 'none';
    }
}

function createClubReviewCard(review, showBookTitle = false) {
    const initials = getInitials(review.userName);
    const timeAgo = getTimeAgo(review.createdAt?.toDate?.());
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

    return `
        <div class="club-review-card">
            <div class="club-review-header">
                <div class="club-review-avatar">${initials}</div>
                <div class="club-review-meta">
                    <div class="club-review-author">${review.userName}</div>
                    <div class="club-review-time">${timeAgo}</div>
                </div>
                <div class="club-review-rating">${stars}</div>
            </div>
            ${showBookTitle ? `<div class="club-review-book">${review.bookTitle}</div>` : ''}
            ${review.reviewText ? `<p class="club-review-text">${review.reviewText}</p>` : ''}
            ${review.recommend ? `<div class="club-review-recommend"><span class="recommend-badge">Recommends this book</span></div>` : ''}
        </div>
    `;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderLists() {
    if (state.lists.length === 0) {
        elements.listsGrid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📚</span>
                <p>No lists yet</p>
                <button class="btn btn-secondary" onclick="window.handleOpenCreateListModal()">Create a List</button>
            </div>
        `;
        return;
    }

    elements.listsGrid.innerHTML = state.lists.map(list => createListCard(list)).join('');

    // Add click handlers
    elements.listsGrid.querySelectorAll('.list-card').forEach(card => {
        card.addEventListener('click', () => loadListDetail(card.dataset.id));
    });
}

// ============================================
// MY BOOKS FUNCTIONS
// ============================================

function switchLibraryTab(tabName) {
    state.libraryTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.library-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.library-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tabName === 'my-books') {
        elements.myBooksTab?.classList.add('active');
    } else {
        elements.readingListsTab?.classList.add('active');
    }
}

function setMyBooksFilter(filter) {
    state.ownedBooksFilter = filter;

    // Update filter buttons
    document.querySelectorAll('.my-books-filters .filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.filter === filter);
    });

    renderMyBooks();
}

function getFilteredOwnedBooks() {
    let books = [...state.ownedBooks];

    // Apply search filter
    if (state.ownedBooksSearch) {
        const search = state.ownedBooksSearch.toLowerCase();
        books = books.filter(book =>
            book.title?.toLowerCase().includes(search) ||
            book.authors?.some(a => a.toLowerCase().includes(search))
        );
    }

    // Apply read/unread filter based on status field
    if (state.ownedBooksFilter === 'read') {
        books = books.filter(book => book.status === 'read' || book.status === 'finished');
    } else if (state.ownedBooksFilter === 'unread') {
        books = books.filter(book => book.status !== 'read' && book.status !== 'finished');
    }

    // Apply genre filter
    if (state.ownedBooksGenre && state.ownedBooksGenre !== 'all') {
        books = books.filter(book => {
            const normalizedGenre = normalizeGenreForDisplay(book.genre);
            const normalizedCategories = (book.categories || []).map(normalizeGenreForDisplay);
            return normalizedGenre === state.ownedBooksGenre ||
                   normalizedCategories.includes(state.ownedBooksGenre);
        });
    }

    return books;
}

// Normalize genre string for display (handles messy API data like "Fiction / Thrillers" -> "Thrillers")
function normalizeGenreForDisplay(genre) {
    if (!genre || typeof genre !== 'string') return null;
    const trimmed = genre.trim();
    if (!trimmed) return null;
    const parts = trimmed.split('/');
    return parts[parts.length - 1].trim();
}

// Get unique genres from owned books
function getUniqueGenresFromOwnedBooks() {
    const genreSet = new Set();
    for (const book of state.ownedBooks) {
        const normalizedGenre = normalizeGenreForDisplay(book.genre);
        if (normalizedGenre) genreSet.add(normalizedGenre);
        if (book.categories && Array.isArray(book.categories)) {
            for (const cat of book.categories) {
                const normalizedCat = normalizeGenreForDisplay(cat);
                if (normalizedCat) genreSet.add(normalizedCat);
            }
        }
    }
    return Array.from(genreSet).sort();
}

// Count books for a specific genre
function countBooksForGenre(genre) {
    if (genre === 'all') return state.ownedBooks.length;
    return state.ownedBooks.filter(book => {
        const normalizedGenre = normalizeGenreForDisplay(book.genre);
        const normalizedCategories = (book.categories || []).map(normalizeGenreForDisplay);
        return normalizedGenre === genre || normalizedCategories.includes(genre);
    }).length;
}

// Set genre filter (global for inline onclick handlers)
window.setMyBooksGenreFilter = function(genre) {
    state.ownedBooksGenre = genre;
    renderMyBooks();
};

// Render genre filter pills
function renderGenreFilters() {
    const container = document.getElementById('my-books-genre-filters');
    if (!container) return;
    const genres = getUniqueGenresFromOwnedBooks();
    if (genres.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';
    const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
    const escapeAttr = (str) => str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    let html = `
        <button class="genre-chip ${state.ownedBooksGenre === 'all' ? 'active' : ''}" onclick="setMyBooksGenreFilter('all')">
            All Genres <span class="genre-chip-count">${state.ownedBooks.length}</span>
        </button>
        <div class="genre-divider"></div>
    `;
    for (const genre of genres) {
        const count = countBooksForGenre(genre);
        const isActive = state.ownedBooksGenre === genre;
        html += `
            <button class="genre-chip ${isActive ? 'active' : ''}" onclick="setMyBooksGenreFilter('${escapeAttr(genre)}')">
                ${escapeHtml(genre)} <span class="genre-chip-count">${count}</span>
            </button>
        `;
    }
    container.innerHTML = html;
}

function renderMyBooks() {
    const filteredBooks = getFilteredOwnedBooks();

    // Update count
    if (elements.myBooksCount) {
        elements.myBooksCount.textContent = pluralize(state.ownedBooks.length, 'book');
    }

    // Show/hide library limit warning banner
    updateLibraryLimitWarning();

    // Render genre filter pills
    renderGenreFilters();

    // Check if empty
    if (state.ownedBooks.length === 0) {
        if (elements.myBooksGrid) elements.myBooksGrid.innerHTML = '';
        if (elements.myBooksEmpty) elements.myBooksEmpty.style.display = 'block';
        return;
    }

    // Hide empty state
    if (elements.myBooksEmpty) elements.myBooksEmpty.style.display = 'none';

    // Render filtered books
    if (filteredBooks.length === 0) {
        if (elements.myBooksGrid) {
            elements.myBooksGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <p>No books match your search</p>
                </div>
            `;
        }
        return;
    }

    if (elements.myBooksGrid) {
        elements.myBooksGrid.innerHTML = filteredBooks.map(book => createMyBookCard(book)).join('');

        // Add click handlers
        elements.myBooksGrid.querySelectorAll('.my-book-card').forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.id;
                openOwnedBookDetail(bookId);
            });
        });
    }
}

/**
 * Update the library limit warning banner visibility and text
 */
function updateLibraryLimitWarning() {
    const warningEl = document.getElementById('library-limit-warning');
    const countEl = document.getElementById('library-limit-warning-count');

    if (!warningEl) return;

    const { currentCount, limit, isPro, showWarning } = state.libraryLimitInfo;

    // Hide for Pro users or if under warning threshold
    if (isPro || !showWarning) {
        warningEl.style.display = 'none';
        return;
    }

    // Show warning and update text
    warningEl.style.display = 'flex';
    if (countEl) {
        countEl.textContent = `You have ${currentCount} of ${limit} free books.`;
    }
}

/**
 * Show the library limit reached modal
 */
function showLibraryLimitModal() {
    openModal('library-limit-modal');
}

/**
 * Check if user can add to library and show modal if at limit
 * @returns {Promise<boolean>} true if can add, false if at limit
 */
async function checkLibraryLimitBeforeAdd() {
    if (!state.user) return false;

    const limitCheck = await canAddToLibrary(state.user.uid);

    if (!limitCheck.canAdd) {
        showLibraryLimitModal();
        return false;
    }

    return true;
}

function createMyBookCard(book) {
    // Determine status badge based on reading status
    let statusClass = 'unread';
    let statusLabel = 'Unread';
    if (book.status === 'read' || book.status === 'finished') {
        statusClass = 'read';
        statusLabel = 'Read';
    } else if (book.status === 'reading') {
        statusClass = 'reading';
        statusLabel = 'Reading';
    }

    // Get format icon - use ownedFormat from db
    const format = book.ownedFormat || 'physical';
    const formatIcon = getFormatIcon(format);

    return `
        <div class="my-book-card" data-id="${book.id}">
            <div class="my-book-card-cover">
                ${book.coverImageUrl
                    ? `<img src="${book.coverImageUrl}" alt="${book.title}">`
                    : `<div class="my-book-card-cover-text">${book.title}</div>`}
                <span class="my-book-status-badge ${statusClass}">${statusLabel}</span>
                <div class="my-book-format-badge">${formatIcon}</div>
            </div>
            <div class="my-book-card-info">
                <h4 class="my-book-card-title">${book.title}</h4>
                <p class="my-book-card-author">${book.authors?.join(', ') || 'Unknown Author'}</p>
            </div>
        </div>
    `;
}

function getFormatIcon(format) {
    switch (format) {
        case 'ebook':
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>`;
        case 'audiobook':
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`;
        case 'physical':
        default:
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
    }
}

async function openOwnedBookDetail(bookId) {
    const book = state.ownedBooks.find(b => b.id === bookId);
    if (!book) return;

    // Format the date nicely - use ownedAt field
    const addedDate = book.ownedAt?.toDate ? book.ownedAt.toDate() : (book.createdAt?.toDate ? book.createdAt.toDate() : new Date());
    const dateStr = addedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Get format display name - use ownedFormat field
    const formatNames = {
        physical: 'Physical Book',
        ebook: 'E-Book',
        audiobook: 'Audiobook'
    };
    const formatName = formatNames[book.ownedFormat] || 'Physical Book';

    // Determine if book is read
    const isRead = book.status === 'read' || book.status === 'finished';

    elements.libraryBookContent.innerHTML = `
        <div class="book-detail-grid">
            <div class="book-detail-cover">
                ${book.coverImageUrl
                    ? `<img src="${book.coverImageUrl}" alt="${book.title}">`
                    : `<div class="book-cover-placeholder">${book.title}</div>`}
            </div>
            <div class="book-detail-info">
                <h2 class="book-detail-title">${book.title}</h2>
                <p class="book-detail-author">by ${book.authors?.join(', ') || 'Unknown Author'}</p>
                ${book.genre ? `<span class="book-detail-genre">${book.genre}</span>` : ''}
                <div class="book-detail-meta">
                    ${book.pageCount ? `<span>Pages: ${book.pageCount}</span>` : ''}
                    ${book.isbn ? `<span>ISBN: ${book.isbn}</span>` : ''}
                </div>
                ${book.description ? `<p class="book-detail-desc">${book.description}</p>` : ''}

                <!-- Ownership Section -->
                <div class="book-ownership-section">
                    <div class="ownership-status">
                        <div class="ownership-badge">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            In Your Library
                        </div>
                        <div class="ownership-info">
                            <div class="ownership-info-format">${formatName}</div>
                            <div class="ownership-info-date">Added ${dateStr}</div>
                        </div>
                        <button class="ownership-remove-btn" onclick="removeFromLibrary('${book.id}')">Remove</button>
                    </div>
                </div>

                <div class="book-detail-actions" style="margin-top: 1rem;">
                    ${!isRead && book.status !== 'reading' ? `
                        <button class="btn btn-primary" onclick="startReadingOwnedBook('${book.id}')">Start Reading</button>
                    ` : ''}
                    ${book.status === 'reading' ? `
                        <button class="btn btn-secondary" onclick="finishOwnedBook('${book.id}')">Mark as Finished</button>
                    ` : ''}
                    <button class="btn btn-secondary" onclick="toggleReadStatus('${book.id}', ${isRead ? 'false' : 'true'})">
                        ${isRead ? 'Mark as Unread' : 'Mark as Read'}
                    </button>
                    <button class="btn btn-secondary" onclick="addOwnedBookToList('${book.id}')">Add to List</button>
                    <button class="btn btn-secondary" onclick="addOwnedBookToClub('${book.id}')">Add to Club</button>
                </div>
            </div>
        </div>
    `;

    openModal('library-book-modal');
}

// Global functions for onclick handlers
window.removeFromLibrary = async function(bookId) {
    if (!state.user || !bookId) return;

    if (!confirm('Remove this book from your library?')) return;

    showLoading();
    const result = await removeOwnership(bookId, state.user.uid);
    hideLoading();

    if (result.success) {
        showToast('Removed from library', 'success');
        closeAllModals();
        await loadMyBooks();
    } else {
        showToast('Failed to remove book', 'error');
    }
};

window.toggleReadStatus = async function(bookId, markAsRead) {
    if (!state.user || !bookId) return;

    const shouldMarkRead = markAsRead === 'true' || markAsRead === true;
    const newStatus = shouldMarkRead ? 'read' : 'unread';

    showLoading();
    const result = await updateItemStatus(bookId, newStatus);
    hideLoading();

    if (result.success) {
        showToast(shouldMarkRead ? 'Marked as read!' : 'Marked as unread', 'success');
        closeAllModals();
        await loadMyBooks();
    } else {
        showToast('Failed to update status', 'error');
    }
};

// Start reading an owned book
window.startReadingOwnedBook = async function(bookId) {
    if (!state.user || !bookId) return;

    const book = state.ownedBooks.find(b => b.id === bookId);
    if (!book) return;

    showLoading();
    const result = await updateItemStatus(bookId, 'reading');
    hideLoading();

    if (result.success) {
        showToast('Happy reading!', 'success');
        closeAllModals();
        await loadMyBooks();
        loadHomeData();

        // Post activity to clubs that have this book
        if (book.isbn) {
            const userData = {
                userId: state.user.uid,
                displayName: state.userProfile?.displayName || state.user.displayName || state.user.email,
                photoURL: state.userProfile?.photoURL
            };
            postActivityToClubsWithBook(
                book.isbn,
                book.title,
                book.coverImageUrl,
                'startedBook',
                userData
            );
        }
    } else {
        showToast('Failed to start reading', 'error');
    }
};

// Finish reading an owned book
window.finishOwnedBook = async function(bookId) {
    if (!state.user || !bookId) return;

    const book = state.ownedBooks.find(b => b.id === bookId);
    if (!book) return;

    showLoading();
    const result = await updateItemStatus(bookId, 'read');
    hideLoading();

    if (result.success) {
        showToast('Congratulations on finishing!', 'success');
        closeAllModals();
        await loadMyBooks();
        loadHomeData();

        // Post activity to clubs that have this book
        if (book.isbn) {
            const userData = {
                userId: state.user.uid,
                displayName: state.userProfile?.displayName || state.user.displayName || state.user.email,
                photoURL: state.userProfile?.photoURL
            };
            postActivityToClubsWithBook(
                book.isbn,
                book.title,
                book.coverImageUrl,
                'finishedBook',
                userData
            );
        }
    } else {
        showToast('Failed to mark as finished', 'error');
    }
};

// Add owned book to a list
window.addOwnedBookToList = function(bookId) {
    const book = state.ownedBooks.find(b => b.id === bookId);
    if (!book) return;

    // Convert owned book to format expected by list picker
    state.selectedBook = {
        isbn: book.isbn,
        title: book.title,
        authors: book.authors,
        coverImageUrl: book.coverImageUrl,
        description: book.description,
        pageCount: book.pageCount,
        genre: book.genre,
        categories: book.categories
    };

    closeAllModals();
    renderListPicker();
    openModal('list-picker-modal');
};

// Add owned book to a club
window.addOwnedBookToClub = async function(bookId) {
    const book = state.ownedBooks.find(b => b.id === bookId);
    if (!book) return;

    // Check if user is in any clubs
    if (!state.clubs || state.clubs.length === 0) {
        showToast('Join a club first to share books', 'info');
        return;
    }

    // Store the book for the club picker
    state.selectedBookForClub = {
        isbn: book.isbn,
        title: book.title,
        authors: book.authors,
        coverImageUrl: book.coverImageUrl,
        description: book.description,
        pageCount: book.pageCount,
        genre: book.genre,
        categories: book.categories
    };

    closeAllModals();
    renderClubPicker();
    openModal('club-picker-modal');
};

// Render club picker for adding book to club
function renderClubPicker() {
    const picker = document.getElementById('club-picker');
    if (!picker || !state.clubs) return;

    picker.innerHTML = state.clubs.map(club => `
        <div class="list-picker-item club-picker-item" data-id="${club.id}">
            <div class="list-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
            </div>
            <div class="list-info">
                <div class="list-name">${club.name}</div>
                <div class="list-count">${pluralize(club.memberCount || 0, 'member')}</div>
            </div>
        </div>
    `).join('');

    // Add click handlers
    picker.querySelectorAll('.club-picker-item').forEach(item => {
        item.addEventListener('click', () => addBookToSelectedClub(item.dataset.id));
    });
}

// Add book to selected club
async function addBookToSelectedClub(clubId) {
    if (!state.selectedBookForClub || !state.user || !clubId) return;

    const club = state.clubs.find(c => c.id === clubId);
    if (!club) return;

    showLoading();

    const userData = {
        userId: state.user.uid,
        displayName: state.userProfile?.displayName || state.user.displayName || state.user.email,
        photoURL: state.userProfile?.photoURL
    };

    const result = await addBookToClub(clubId, state.selectedBookForClub, userData);
    hideLoading();

    if (result.success) {
        showToast(`Added to ${club.name}!`, 'success');
        closeAllModals();
        state.selectedBookForClub = null;
    } else {
        showToast(result.error || 'Failed to add book to club', 'error');
    }
}

window.addToMyLibrary = function(bookDataJson) {
    let bookData;
    try {
        bookData = typeof bookDataJson === 'string' ? JSON.parse(bookDataJson) : bookDataJson;
    } catch (e) {
        bookData = bookDataJson;
    }
    state.selectedBook = bookData;

    // Show format picker inline
    const picker = document.getElementById('ownership-format-picker');
    if (picker) {
        picker.classList.add('active');
        picker.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

window.selectOwnershipFormat = function(format) {
    // Update visual selection
    document.querySelectorAll('.format-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.format === format);
    });
};

window.confirmAddToLibrary = async function(format) {
    if (!state.user || !state.selectedBook) return;

    // Check library limit before proceeding
    const canAdd = await checkLibraryLimitBeforeAdd();
    if (!canAdd) {
        return;
    }

    showLoading();

    try {
        // First, find or create a default "My Library" list
        let libraryList = state.lists.find(l =>
            l.name.toLowerCase() === 'my library' || l.listType === 'myLibrary'
        );

        if (!libraryList) {
            // Create "My Library" list if it doesn't exist
            const createResult = await createList({
                name: 'My Library',
                listType: 'myLibrary'
            }, state.user.uid);

            if (createResult.success) {
                await loadLibraryData();
                libraryList = state.lists.find(l => l.id === createResult.data.id);
            }
        }

        if (!libraryList) {
            hideLoading();
            showToast('Could not create library list', 'error');
            return;
        }

        // Add book to the list
        const addResult = await addBookToList(state.selectedBook, libraryList.id, state.user.uid);

        if (!addResult.success) {
            hideLoading();
            showToast(addResult.error || 'Failed to add book', 'error');
            return;
        }

        // Now mark the item as owned (pass userId for limit check)
        const ownedResult = await markAsOwned(addResult.data.id, format, state.user.uid);

        hideLoading();

        if (ownedResult.success) {
            showToast('Added to your library!', 'success');
            closeAllModals();
            await loadMyBooks();
            await loadLibraryData();
        } else if (ownedResult.limitReached) {
            // Show limit modal if marking ownership failed due to limit
            showLibraryLimitModal();
        } else {
            showToast('Book added but ownership not set', 'warning');
        }
    } catch (error) {
        hideLoading();
        console.error('Add to library error:', error);
        showToast('Failed to add book', 'error');
    }
};

function renderClubs() {
    if (state.clubs.length === 0) {
        elements.clubsGrid.innerHTML = '';
        elements.clubsEmpty.style.display = 'block';
        return;
    }

    elements.clubsEmpty.style.display = 'none';
    elements.clubsGrid.innerHTML = state.clubs.map(club => createClubCard(club)).join('');

    // Add click handlers
    elements.clubsGrid.querySelectorAll('.club-card').forEach(card => {
        card.addEventListener('click', () => loadClubDetail(card.dataset.id));
    });
}

function renderDiscoveryCards() {
    const remainingBooks = state.discoveryBooks.slice(state.discoveryIndex);

    if (remainingBooks.length === 0) {
        elements.swipeCards.innerHTML = '';
        elements.swipeEmpty.style.display = 'block';
        return;
    }

    elements.swipeEmpty.style.display = 'none';

    // Show up to 3 cards
    const visibleBooks = remainingBooks.slice(0, 3);
    elements.swipeCards.innerHTML = visibleBooks.map((book, index) =>
        createSwipeCard(book, index === 0)
    ).join('');

    // Add swipe handlers to top card
    const topCard = elements.swipeCards.querySelector('.swipe-card');
    if (topCard) {
        initSwipeGestures(topCard);
    }
}

function renderListPicker() {
    elements.listPicker.innerHTML = state.lists.map(list => `
        <div class="list-picker-item" data-id="${list.id}">
            <div class="list-icon">${getListIcon(list.listType)}</div>
            <div class="list-info">
                <div class="list-name">${list.name}</div>
                <div class="list-count">${pluralize(list.itemCount || 0, 'book')}</div>
            </div>
        </div>
    `).join('');

    // Add click handlers
    elements.listPicker.querySelectorAll('.list-picker-item').forEach(item => {
        item.addEventListener('click', () => addBookToSelectedList(item.dataset.id));
    });
}

// ============================================
// CARD CREATORS
// ============================================

function createReadingCard(item) {
    const progress = item.pageCount && item.currentPage
        ? Math.round((item.currentPage / item.pageCount) * 100)
        : 0;

    return `
        <div class="reading-card" data-id="${item.id}">
            <div class="reading-card-cover">
                ${item.coverImageUrl ? `<img src="${item.coverImageUrl}" alt="${item.title}">` : ''}
            </div>
            <div class="reading-card-info">
                <h4 class="reading-card-title">${item.title}</h4>
                <p class="reading-card-author">${item.authors?.join(', ') || 'Unknown Author'}</p>
                <div class="reading-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${item.currentPage || 0} / ${item.pageCount || '?'} pages</span>
                </div>
                <div class="reading-card-actions">
                    <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); updateProgress('${item.id}', ${item.pageCount || 0})">Update Progress</button>
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); finishBook('${item.id}')">Finished</button>
                </div>
            </div>
        </div>
    `;
}

function createReadingCardCompact(item) {
    const progress = item.pageCount && item.currentPage
        ? Math.round((item.currentPage / item.pageCount) * 100)
        : 0;

    return `
        <div class="reading-card-compact" data-item-id="${item.id}">
            <div class="reading-card-compact-cover">
                ${item.coverImageUrl
                    ? `<img src="${item.coverImageUrl}" alt="${item.title}">`
                    : `<div class="cover-placeholder">${item.title.charAt(0)}</div>`}
            </div>
            <div class="reading-card-compact-info">
                <h4>${item.title}</h4>
                <p>${item.authors?.join(', ') || 'Unknown Author'}</p>
                <div class="progress-bar-mini">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            </div>
            <span class="reading-card-compact-progress">${progress}%</span>
        </div>
    `;
}

function createClubCardCompact(club) {
    return `
        <div class="club-card-compact" data-club-id="${club.id}">
            <div class="club-card-compact-avatar">
                ${club.name.charAt(0).toUpperCase()}
            </div>
            <div class="club-card-compact-info">
                <h4>${club.name}</h4>
                <p>${club.memberCount || 1} member${(club.memberCount || 1) !== 1 ? 's' : ''}</p>
            </div>
            <svg class="club-card-compact-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
    `;
}

// Progress update modal handler
window.updateProgress = async (itemId, pageCount) => {
    const newPage = prompt(`Enter your current page (of ${pageCount || '?'}):`, '');
    if (newPage === null) return;

    const page = parseInt(newPage);
    if (isNaN(page) || page < 0) {
        showToast('Please enter a valid page number', 'error');
        return;
    }

    if (pageCount && page > pageCount) {
        // If they've read more than the page count, ask if they finished
        if (confirm('You\'ve read past the last page! Mark this book as finished?')) {
            finishBook(itemId);
            return;
        }
    }

    showLoading();
    const result = await updateReadingProgress(itemId, page);
    hideLoading();

    if (result.success) {
        showToast('Progress updated!', 'success');
        closeAllModals();

        // Refresh appropriate view
        loadHomeData();
        if (state.currentList) {
            loadListDetail(state.currentList.id);
        }
    } else {
        showToast('Failed to update progress', 'error');
    }
};

function createClubPreviewCard(club) {
    const initial = club.name.charAt(0).toUpperCase();
    return `
        <div class="club-preview-card" data-id="${club.id}">
            <div class="club-avatar">${initial}</div>
            <div class="club-preview-info">
                <h4>${club.name}</h4>
                <p>${club.currentBookTitle || pluralize(club.memberCount || 0, 'member')}</p>
            </div>
        </div>
    `;
}

function createListCard(list) {
    return `
        <div class="list-card" data-id="${list.id}">
            <div class="list-icon">${getListIcon(list.listType)}</div>
            <div class="list-info">
                <div class="list-name">${list.name}</div>
                <div class="list-count">${pluralize(list.itemCount || 0, 'book')}</div>
            </div>
            <span class="list-chevron">›</span>
        </div>
    `;
}

function createBookCard(item) {
    return `
        <div class="book-card" data-id="${item.id}">
            <div class="book-card-cover">
                ${item.coverImageUrl
            ? `<img src="${item.coverImageUrl}" alt="${item.title}">`
            : `<div class="book-card-cover-text">${item.title}</div>`
        }
                ${item.status !== 'unread' ? `<span class="book-card-status ${item.status}"></span>` : ''}
            </div>
            <div class="book-card-info">
                <h4 class="book-card-title">${item.title}</h4>
                <p class="book-card-author">${item.authors?.join(', ') || 'Unknown Author'}</p>
            </div>
        </div>
    `;
}

function createClubCard(club) {
    const initial = club.name.charAt(0).toUpperCase();
    return `
        <div class="club-card" data-id="${club.id}">
            <div class="club-card-header">
                <div class="club-card-avatar">${initial}</div>
                <div class="club-card-info">
                    <h3>${club.name}</h3>
                    <p>${pluralize(club.memberCount || 0, 'member')}</p>
                </div>
            </div>
            ${club.currentBookTitle ? `
                <div class="club-card-book">
                    <div class="club-card-book-cover">
                        ${club.currentBookCoverUrl ? `<img src="${club.currentBookCoverUrl}" alt="${club.currentBookTitle}">` : ''}
                    </div>
                    <div class="club-card-book-info">
                        <div class="club-card-book-label">Currently reading</div>
                        <div class="club-card-book-title">${club.currentBookTitle}</div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function createSwipeCard(book, isTop) {
    // Store book data for Read More access
    const bookDataStr = encodeURIComponent(JSON.stringify(book));
    return `
        <div class="swipe-card" data-id="${book.id}" data-isbn="${book.isbn || ''}" data-book="${bookDataStr}">
            <div class="swipe-indicator like">♥</div>
            <div class="swipe-indicator skip">✕</div>
            <div class="swipe-card-cover">
                ${book.coverImageUrl
            ? `<img src="${book.coverImageUrl}" alt="${book.title}">`
            : `<div class="swipe-card-cover-placeholder">${book.title}</div>`
        }
            </div>
            <div class="swipe-card-content">
                ${book.genre ? `<span class="swipe-card-genre">${book.genre}</span>` : ''}
                <h3 class="swipe-card-title">${book.title}</h3>
                <p class="swipe-card-author">by ${book.authors?.join(', ') || 'Unknown Author'}</p>
                <p class="swipe-card-desc">${book.description || 'No description available.'}</p>
                <button class="swipe-card-readmore" onclick="openBookDetailModal(this.closest('.swipe-card').dataset.book)">Read More</button>
                <div class="swipe-card-meta">
                    ${book.pageCount ? `<span>📖 ${book.pageCount} pages</span>` : ''}
                    ${book.averageRating ? `<span>⭐ ${book.averageRating}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

function createMemberItem(member) {
    const isOwner = member.role === 'owner';
    const avatarHTML = createAvatarHTML({
        photoURL: member.photoURL,
        name: member.displayName,
        size: 'lg',
        className: 'member-card-avatar'
    });

    const booksAdded = member.booksAdded || 0;
    const booksInterested = member.booksInterested || 0;

    return `
        <div class="member-card-new" data-member-id="${member.userId}" onclick="openMemberProfile('${member.userId}')">
            ${avatarHTML}
            <div class="member-card-info">
                <div class="member-card-header">
                    <span class="member-card-name">${member.displayName}</span>
                    ${isOwner ? '<span class="member-card-badge">Owner</span>' : ''}
                </div>
                <div class="member-card-stats">
                    <span class="member-stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        ${booksAdded} added
                    </span>
                    <span class="member-stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        ${booksInterested} interested
                    </span>
                </div>
            </div>
            <svg class="member-card-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
    `;
}

function createActivityItem(activity) {
    const timeAgo = getTimeAgo(activity.createdAt?.toDate());
    const avatarHTML = createAvatarHTML({
        photoURL: activity.userPhotoUrl,
        name: activity.userName,
        size: 'md',
        className: 'activity-item-avatar'
    });

    return `
        <div class="activity-item-new">
            ${avatarHTML}
            <div class="activity-item-content">
                <p class="activity-item-text"><strong>${activity.userName}</strong> ${activity.message || getActivityMessage(activity)}</p>
                <span class="activity-item-time">${timeAgo}</span>
            </div>
        </div>
    `;
}

function createSearchResultItem(book) {
    return `
        <div class="search-result-item" data-book='${JSON.stringify(book).replace(/'/g, "\\'")}'>
            <div class="search-result-cover">
                ${book.coverImageUrl ? `<img src="${book.coverImageUrl}" alt="${book.title}">` : ''}
            </div>
            <div class="search-result-info">
                <div class="search-result-title">${book.title}</div>
                <div class="search-result-author">${book.authors?.join(', ') || 'Unknown Author'}</div>
                <div class="search-result-meta">${book.pageCount ? `${book.pageCount} pages` : ''}</div>
            </div>
        </div>
    `;
}

// ============================================
// SWIPE HANDLING
// ============================================

function initSwipeGestures(card) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;

    const onStart = (e) => {
        const point = e.touches ? e.touches[0] : e;
        startX = point.clientX;
        startY = point.clientY;
        card.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!startX) return;

        const point = e.touches ? e.touches[0] : e;
        currentX = point.clientX - startX;

        // Apply transform
        card.style.transform = `translateX(${currentX}px) rotate(${currentX * 0.05}deg)`;

        // Show indicators
        if (currentX > 50) {
            card.classList.add('swiping-right');
            card.classList.remove('swiping-left');
        } else if (currentX < -50) {
            card.classList.add('swiping-left');
            card.classList.remove('swiping-right');
        } else {
            card.classList.remove('swiping-right', 'swiping-left');
        }
    };

    const onEnd = () => {
        if (!startX) return;

        card.style.transition = 'transform 0.3s ease';

        if (currentX > 100) {
            handleSwipe('right');
        } else if (currentX < -100) {
            handleSwipe('left');
        } else {
            // Return to center
            card.style.transform = '';
            card.classList.remove('swiping-right', 'swiping-left');
        }

        startX = 0;
        currentX = 0;
    };

    card.addEventListener('mousedown', onStart);
    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseup', onEnd);
    card.addEventListener('mouseleave', onEnd);

    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove', onMove, { passive: true });
    card.addEventListener('touchend', onEnd);
}

async function handleSwipe(direction) {
    const card = elements.swipeCards.querySelector('.swipe-card');
    if (!card) return;

    // Skip-only just moves to next card (used after adding via dropdown)
    if (direction === 'skip-only') {
        card.classList.add('removing');
        card.style.transform = 'translateX(150%) rotate(30deg)';
        card.style.opacity = '0';
        setTimeout(() => {
            state.discoveryIndex++;
            renderDiscoveryCards();
        }, 300);
        return;
    }

    // Animate card off screen
    card.classList.add('removing');
    card.style.transform = direction === 'right'
        ? 'translateX(150%) rotate(30deg)'
        : 'translateX(-150%) rotate(-30deg)';
    card.style.opacity = '0';

    if (direction === 'right') {
        // Add directly to "Want to Read" list
        const bookData = getCurrentSwipeBook();
        if (bookData && state.user) {
            const wantToReadList = await getOrCreateWantToReadList();
            if (wantToReadList) {
                const result = await addBookToList(bookData, wantToReadList.id, state.user.uid);
                if (result.success) {
                    showToast('Added to Want to Read!', 'success');
                    loadLibraryData();
                } else {
                    showToast('Failed to add book', 'error');
                }
            }
        }
    }

    // Move to next card
    setTimeout(() => {
        state.discoveryIndex++;
        renderDiscoveryCards();
    }, 300);
}

async function getOrCreateWantToReadList() {
    // Find existing "Want to Read" list
    const existingList = state.lists.find(l =>
        l.name.toLowerCase() === 'want to read' || l.listType === 'toRead'
    );
    if (existingList) return existingList;

    // Create it if it doesn't exist
    const result = await createList({
        name: 'Want to Read',
        listType: 'toRead'
    }, state.user.uid);

    if (result.success) {
        await loadLibraryData();
        return state.lists.find(l => l.id === result.data.id);
    }
    return null;
}

function handleBookmark() {
    const bookData = getCurrentSwipeBook();
    if (bookData) {
        state.selectedBook = bookData;
        renderListPicker();
        openModal('list-picker-modal');
    }
}

function getCurrentSwipeBook() {
    const card = elements.swipeCards.querySelector('.swipe-card');
    if (!card) return null;

    return state.discoveryBooks[state.discoveryIndex];
}

async function addBookToSelectedList(listId) {
    if (!state.selectedBook || !state.user) return;

    showLoading();
    const result = await addBookToList(state.selectedBook, listId, state.user.uid);
    hideLoading();

    if (result.success) {
        showToast('Book added to list!', 'success');
        closeAllModals();
        state.selectedBook = null;
        loadLibraryData();
    } else {
        showToast(result.error || 'Failed to add book', 'error');
    }
}

// Add current swipe card book to the selected list from dropdown
async function addCurrentBookToSelectedList() {
    const listSelect = document.getElementById('swipe-list-select');
    const listId = listSelect.value;
    if (!listId) {
        showToast('Please select a list', 'error');
        return;
    }

    const bookData = getCurrentSwipeBook();
    if (!bookData || !state.user) return;

    showLoading();
    const result = await addBookToList(bookData, listId, state.user.uid);
    hideLoading();

    if (result.success) {
        const listName = listSelect.options[listSelect.selectedIndex].text;
        showToast(`Added to ${listName}!`, 'success');
        loadLibraryData();
        // Move to next card
        handleSwipe('skip-only');
    } else {
        showToast(result.error || 'Failed to add book', 'error');
    }
}

// Populate the swipe list dropdown
function populateSwipeListDropdown() {
    const listSelect = document.getElementById('swipe-list-select');
    if (!listSelect) return;

    listSelect.innerHTML = state.lists.map(list =>
        `<option value="${list.id}">${list.name}</option>`
    ).join('');
}

// Check and show discover tutorial on first visit
function checkDiscoverTutorial() {
    const hasSeenTutorial = localStorage.getItem('pageswipe_discover_tutorial_seen');
    if (!hasSeenTutorial) {
        showDiscoverTutorial();
    }
}

function showDiscoverTutorial() {
    openModal('discover-tutorial-modal');
}

window.dismissDiscoverTutorial = function() {
    localStorage.setItem('pageswipe_discover_tutorial_seen', 'true');
    closeAllModals();
};

// ============================================
// RAPID BARCODE SCANNER (iOS-matching implementation)
// ============================================

let html5QrCode = null;
let isScanning = false;

// Rapid scanner state
const rapidScannerState = {
    recentlyScannedISBNs: new Set(),  // Debounce set - ISBNs scanned in last 3 seconds
    scannedBooks: [],                  // Recently scanned books for display
    sessionCount: 0,                   // Books added this session
    isProcessing: false,               // Currently processing a scan
    isFlashOn: false,                  // Flash/torch state
    ownedListId: null                  // Cached "My Books" list ID
};

// Debounce interval in milliseconds (matches iOS: 3 seconds)
const SCAN_DEBOUNCE_MS = 3000;
const MAX_RECENT_SCANS = 10;
const TOAST_DURATION_MS = 2500;

/**
 * Open the rapid barcode scanner
 */
async function openBarcodeScanner() {
    const scanner = document.getElementById('rapid-scanner');
    const scannerError = document.getElementById('rapid-scanner-error');
    const scannerPreview = document.getElementById('rapid-scanner-preview');
    const processingEl = document.getElementById('rapid-scanner-processing');

    // Reset state for new session
    rapidScannerState.recentlyScannedISBNs.clear();
    rapidScannerState.scannedBooks = [];
    rapidScannerState.sessionCount = 0;
    rapidScannerState.isProcessing = false;
    rapidScannerState.isFlashOn = false;
    rapidScannerState.ownedListId = null;

    // Reset UI
    scannerError.classList.remove('visible');
    processingEl.classList.remove('visible');
    scannerPreview.innerHTML = '';
    updateRapidScannerUI();

    // Open scanner
    scanner.classList.add('open');

    // Small delay to ensure scanner is rendered
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check camera support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        handleRapidScannerError('Camera not supported on this device');
        return;
    }

    try {
        html5QrCode = new Html5Qrcode('rapid-scanner-preview', { verbose: false });
        isScanning = true;

        await html5QrCode.start(
            { facingMode: 'environment' },
            {
                fps: 15,  // Higher FPS for rapid scanning
                qrbox: { width: 280, height: 180 },
                aspectRatio: window.innerHeight / window.innerWidth,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8
                ],
                disableFlip: false
            },
            handleRapidScan,
            () => {} // Ignore continuous scan errors - camera keeps running
        );
    } catch (err) {
        isScanning = false;
        if (err.name === 'NotAllowedError') {
            handleRapidScannerError('Camera permission denied. Please allow camera access in your browser settings.');
        } else if (err.name === 'NotFoundError') {
            handleRapidScannerError('No camera found on this device.');
        } else {
            handleRapidScannerError('Failed to start camera: ' + err.message);
        }
    }
}

/**
 * Handle a barcode scan - continuous scanning with debounce
 */
async function handleRapidScan(decodedText) {
    // Validate ISBN format
    const isbn = decodedText.replace(/[-\s]/g, '');
    if (!/^\d{10}$/.test(isbn) && !/^\d{13}$/.test(isbn)) {
        return; // Not a valid ISBN
    }

    // Debounce: Skip if we just scanned this ISBN
    if (rapidScannerState.recentlyScannedISBNs.has(isbn)) {
        return;
    }

    // Skip if we're currently processing (prevents rapid duplicate processing)
    if (rapidScannerState.isProcessing) {
        return;
    }

    // Add to recently scanned set
    rapidScannerState.recentlyScannedISBNs.add(isbn);

    // Remove from set after debounce interval to allow re-scanning
    setTimeout(() => {
        rapidScannerState.recentlyScannedISBNs.delete(isbn);
    }, SCAN_DEBOUNCE_MS);

    // Haptic feedback
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    // Process the scan
    rapidScannerState.isProcessing = true;
    updateProcessingIndicator(true);

    await processRapidScan(isbn);
}

/**
 * Process a scanned ISBN - lookup and add to library
 */
async function processRapidScan(isbn) {
    const userId = state.user?.uid;
    if (!userId) {
        rapidScannerState.isProcessing = false;
        updateProcessingIndicator(false);
        showRapidScannerToast('error', 'Not signed in', 'Please sign in to add books');
        return;
    }

    try {
        // First check if already owned
        const ownedCheck = await checkIfOwned(userId, isbn);
        if (ownedCheck.success && ownedCheck.data) {
            // Book is already owned
            rapidScannerState.isProcessing = false;
            updateProcessingIndicator(false);
            showRapidScannerToast('info', 'Already in Library', ownedCheck.data.title || isbn);
            if (navigator.vibrate) {
                navigator.vibrate([50, 50, 50]); // Warning pattern
            }
            return;
        }

        // Check library limit before proceeding
        const limitCheck = await canAddToLibrary(userId);
        if (!limitCheck.canAdd) {
            rapidScannerState.isProcessing = false;
            updateProcessingIndicator(false);
            showRapidScannerToast('warning', 'Library Full', `${limitCheck.currentCount}/${limitCheck.limit} books. Upgrade to Pro.`);
            if (navigator.vibrate) {
                navigator.vibrate([50, 50, 50]);
            }
            return;
        }

        // Look up the book
        const lookupResult = await lookupByISBN(isbn);
        if (!lookupResult.success || !lookupResult.data || lookupResult.data.length === 0) {
            rapidScannerState.isProcessing = false;
            updateProcessingIndicator(false);
            showRapidScannerToast('error', 'Book Not Found', 'Try scanning again');
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]); // Error pattern
            }
            return;
        }

        const book = lookupResult.data[0];

        // Add to recently scanned list with "adding" status
        const scanResult = {
            id: Date.now().toString(),
            book: book,
            status: 'adding'
        };
        rapidScannerState.scannedBooks.unshift(scanResult);
        if (rapidScannerState.scannedBooks.length > MAX_RECENT_SCANS) {
            rapidScannerState.scannedBooks.pop();
        }
        updateRapidScannerUI();

        // Get the default "Want to Read" list to add scanned books to
        if (!rapidScannerState.ownedListId) {
            const listsResult = await getUserLists(userId, state.userProfile?.displayName || 'User');
            if (listsResult.success && listsResult.data) {
                // First try to find the default "Want to Read" list
                const wantToReadList = listsResult.data.find(l => l.listType === 'toRead' && l.isDefault);
                if (wantToReadList) {
                    rapidScannerState.ownedListId = wantToReadList.id;
                } else {
                    // Fallback: use any toRead list
                    const anyToReadList = listsResult.data.find(l => l.listType === 'toRead');
                    if (anyToReadList) {
                        rapidScannerState.ownedListId = anyToReadList.id;
                    }
                }
            }
        }

        if (!rapidScannerState.ownedListId) {
            throw new Error('Could not find a list to add books to. Please create a list first.');
        }

        // Add book to list as owned
        const addResult = await addBookToList(book, rapidScannerState.ownedListId, userId);
        if (!addResult.success) {
            throw new Error(addResult.error || 'Failed to add book');
        }

        // Mark as owned with physical format (default)
        const markResult = await markAsOwned(addResult.data.id, 'physical', userId);
        if (!markResult.success) {
            console.warn('Failed to mark as owned:', markResult.error);
        }

        // Update scan result status
        const scanIndex = rapidScannerState.scannedBooks.findIndex(s => s.id === scanResult.id);
        if (scanIndex !== -1) {
            rapidScannerState.scannedBooks[scanIndex].status = 'added';
        }

        // Update session count
        rapidScannerState.sessionCount++;
        updateRapidScannerUI();

        // Success toast
        showRapidScannerToast('success', 'Added to Library', book.title);

        // Success haptic
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

    } catch (error) {
        console.error('Rapid scan error:', error);

        // Update scan result status to failed if we have one
        const failedScan = rapidScannerState.scannedBooks.find(s => s.status === 'adding');
        if (failedScan) {
            failedScan.status = 'failed';
            failedScan.error = 'Could not add';
            updateRapidScannerUI();
        }

        showRapidScannerToast('error', 'Failed to Add', error.message || 'Please try again');
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
    } finally {
        rapidScannerState.isProcessing = false;
        updateProcessingIndicator(false);
    }
}

/**
 * Update the processing indicator in header
 */
function updateProcessingIndicator(isProcessing) {
    const el = document.getElementById('rapid-scanner-processing');
    if (el) {
        el.classList.toggle('visible', isProcessing);
    }
}

/**
 * Update the rapid scanner UI (recent scans, session count)
 */
function updateRapidScannerUI() {
    // Update session count
    const countEl = document.getElementById('rapid-scanner-count');
    if (countEl) {
        const count = rapidScannerState.sessionCount;
        countEl.textContent = `${count} ${count === 1 ? 'book' : 'books'} added this session`;
    }

    // Update recently scanned section
    const recentSection = document.getElementById('rapid-scanner-recent');
    const recentList = document.getElementById('rapid-scanner-recent-list');

    if (rapidScannerState.scannedBooks.length > 0) {
        recentSection.classList.add('visible');
        recentList.innerHTML = rapidScannerState.scannedBooks.map(scan => createRapidScanCard(scan)).join('');

        // Auto-scroll to show newest (leftmost)
        recentList.scrollLeft = 0;
    } else {
        recentSection.classList.remove('visible');
        recentList.innerHTML = '';
    }
}

/**
 * Create HTML for a recent scan card
 */
function createRapidScanCard(scan) {
    const book = scan.book;
    const coverHtml = book.coverImageUrl
        ? `<img src="${book.coverImageUrl}" alt="${book.title}">`
        : `<div class="no-cover"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20"/></svg></div>`;

    let statusHtml = '';
    switch (scan.status) {
        case 'adding':
            statusHtml = `<div class="rapid-scan-card-status adding"><div class="status-spinner"></div><span>Adding...</span></div>`;
            break;
        case 'added':
            statusHtml = `<div class="rapid-scan-card-status added"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg><span>Added</span></div>`;
            break;
        case 'already-owned':
            statusHtml = `<div class="rapid-scan-card-status already-owned"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg><span>Already owned</span></div>`;
            break;
        case 'failed':
            statusHtml = `<div class="rapid-scan-card-status failed"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg><span>${scan.error || 'Failed'}</span></div>`;
            break;
    }

    return `
        <div class="rapid-scan-card">
            <div class="rapid-scan-card-cover">${coverHtml}</div>
            <div class="rapid-scan-card-info">
                <div class="rapid-scan-card-title">${book.title || 'Unknown Title'}</div>
                ${statusHtml}
            </div>
        </div>
    `;
}

/**
 * Show a toast notification in the rapid scanner
 */
function showRapidScannerToast(type, title, subtitle) {
    const container = document.getElementById('rapid-scanner-toast');
    if (!container) return;

    const iconSvgs = {
        success: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 5h2v2h-2V7zm0 4h2v6h-2v-6z"/></svg>'
    };

    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div class="rapid-scanner-toast-item" id="${toastId}">
            <div class="rapid-scanner-toast-icon ${type}">${iconSvgs[type]}</div>
            <div class="rapid-scanner-toast-content">
                <p class="rapid-scanner-toast-title">${title}</p>
                ${subtitle ? `<p class="rapid-scanner-toast-subtitle">${subtitle}</p>` : ''}
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', toastHtml);

    // Auto-dismiss
    setTimeout(() => {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 250);
        }
    }, TOAST_DURATION_MS);
}

/**
 * Toggle flash/torch
 */
async function toggleRapidScannerFlash() {
    if (!html5QrCode) return;

    try {
        const flashBtn = document.getElementById('rapid-scanner-flash');
        rapidScannerState.isFlashOn = !rapidScannerState.isFlashOn;

        // Get video track and apply torch constraint
        const videoElement = document.querySelector('#rapid-scanner-preview video');
        if (videoElement && videoElement.srcObject) {
            const track = videoElement.srcObject.getVideoTracks()[0];
            if (track) {
                await track.applyConstraints({
                    advanced: [{ torch: rapidScannerState.isFlashOn }]
                });
            }
        }

        flashBtn.classList.toggle('active', rapidScannerState.isFlashOn);
    } catch (err) {
        console.warn('Flash toggle not supported:', err);
        rapidScannerState.isFlashOn = false;
    }
}

/**
 * Handle Done button - show confirmation if books were scanned
 */
function handleRapidScannerDone() {
    if (rapidScannerState.sessionCount > 0) {
        // Show confirmation modal
        const messageEl = document.getElementById('scanner-exit-message');
        if (messageEl) {
            const count = rapidScannerState.sessionCount;
            messageEl.textContent = `You've added ${count} ${count === 1 ? 'book' : 'books'} to your library.`;
        }
        openModal('scanner-exit-modal');
    } else {
        // No books scanned, just close
        closeRapidScanner();
    }
}

/**
 * Close the rapid scanner
 */
async function closeRapidScanner() {
    // Stop the scanner
    await stopBarcodeScanner();

    // Close scanner view
    const scanner = document.getElementById('rapid-scanner');
    scanner.classList.remove('open');

    // Close any open modals
    closeAllModals();

    // Refresh My Library if books were added
    if (rapidScannerState.sessionCount > 0) {
        await loadMyBooks();
    }
}

/**
 * Stop the barcode scanner
 */
async function stopBarcodeScanner() {
    if (html5QrCode && isScanning) {
        try {
            // Turn off flash before stopping
            if (rapidScannerState.isFlashOn) {
                const videoElement = document.querySelector('#rapid-scanner-preview video');
                if (videoElement && videoElement.srcObject) {
                    const track = videoElement.srcObject.getVideoTracks()[0];
                    if (track) {
                        await track.applyConstraints({ advanced: [{ torch: false }] });
                    }
                }
            }

            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (err) {
            console.warn('Error stopping scanner:', err);
        }
        isScanning = false;
        html5QrCode = null;
    }
}

/**
 * Close the rapid scanner (alias for backward compatibility)
 */
function closeBarcodeScanner() {
    closeRapidScanner();
}

/**
 * Retry scanner after error
 */
async function retryRapidScanner() {
    const scannerError = document.getElementById('rapid-scanner-error');
    scannerError.classList.remove('visible');
    await openBarcodeScanner();
}

/**
 * Handle scanner error
 */
function handleRapidScannerError(errorMessage) {
    const scannerError = document.getElementById('rapid-scanner-error');
    const scannerErrorText = document.getElementById('rapid-scanner-error-text');
    scannerError.classList.add('visible');
    scannerErrorText.textContent = errorMessage;
}

/**
 * Initialize rapid scanner event listeners
 */
function initRapidScannerListeners() {
    // Done button
    const doneBtn = document.getElementById('rapid-scanner-done');
    if (doneBtn) {
        doneBtn.addEventListener('click', handleRapidScannerDone);
    }

    // Flash toggle
    const flashBtn = document.getElementById('rapid-scanner-flash');
    if (flashBtn) {
        flashBtn.addEventListener('click', toggleRapidScannerFlash);
    }

    // Retry button
    const retryBtn = document.getElementById('rapid-scanner-retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', retryRapidScanner);
    }

    // Exit modal buttons
    const continueBtn = document.getElementById('scanner-continue-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            closeAllModals();
        });
    }

    const exitConfirmBtn = document.getElementById('scanner-exit-confirm-btn');
    if (exitConfirmBtn) {
        exitConfirmBtn.addEventListener('click', () => {
            closeAllModals();
            closeRapidScanner();
        });
    }

    // Escape key to close scanner
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const scanner = document.getElementById('rapid-scanner');
            if (scanner && scanner.classList.contains('open')) {
                handleRapidScannerDone();
            }
        }
    });

    // Close scanner exit modal with close button
    const exitModalClose = document.querySelector('#scanner-exit-modal .modal-close');
    if (exitModalClose) {
        exitModalClose.addEventListener('click', closeAllModals);
    }

    // Close scanner exit modal with backdrop
    const exitModalBackdrop = document.querySelector('#scanner-exit-modal .modal-backdrop');
    if (exitModalBackdrop) {
        exitModalBackdrop.addEventListener('click', closeAllModals);
    }
}

// Profile photo state
let pendingPhotoFile = null;
let photoRemoved = false;

// ============================================
// FORM HANDLERS
// ============================================

async function handleBookSearch() {
    const query = elements.bookSearchInput.value.trim();
    if (!query) return;

    elements.bookSearchResults.innerHTML = '<div class="search-prompt"><span>🔍</span><p>Searching...</p></div>';

    const result = await searchBooks(query);

    if (result.success && result.data.length > 0) {
        elements.bookSearchResults.innerHTML = result.data.map(book => createSearchResultItem(book)).join('');

        // Add click handlers
        elements.bookSearchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const bookData = JSON.parse(item.dataset.book);
                state.selectedBook = bookData;
                closeAllModals();
                renderListPicker();
                openModal('list-picker-modal');
            });
        });
    } else {
        elements.bookSearchResults.innerHTML = '<div class="search-prompt"><span>😕</span><p>No books found. Try a different search.</p></div>';
    }
}

async function handleCreateList(e) {
    e.preventDefault();

    const name = document.getElementById('list-name').value.trim();
    const description = document.getElementById('list-description').value.trim();

    if (!name || !state.user) return;

    showLoading();
    const result = await createList({
        name,
        description,
        ownerId: state.user.uid,
        ownerName: state.userProfile?.displayName || state.user.displayName || state.user.email
    });
    hideLoading();

    if (result.success) {
        showToast('List created!', 'success');
        closeAllModals();
        elements.createListForm.reset();
        loadLibraryData();
    } else {
        showToast(result.error || 'Failed to create list', 'error');
    }
}

async function handleCreateClub(e) {
    e.preventDefault();

    const name = document.getElementById('club-name').value.trim();
    const description = document.getElementById('club-description').value.trim();

    if (!name || !state.user) return;

    showLoading();
    const result = await createClub({
        name,
        description,
        ownerId: state.user.uid,
        ownerName: state.userProfile?.displayName || state.user.displayName || state.user.email,
        ownerPhotoURL: state.user.photoURL
    });
    hideLoading();

    if (result.success) {
        showToast(`Club created! Share code: ${result.data.joinCode}`, 'success');
        closeAllModals();
        elements.createClubForm.reset();
        loadClubsData();
    } else {
        showToast(result.error || 'Failed to create club', 'error');
    }
}

async function handleJoinClub(e) {
    e.preventDefault();

    const code = document.getElementById('join-code').value.trim().toUpperCase();

    if (!code || code.length !== 6 || !state.user) return;

    showLoading();
    const result = await joinClub(code, {
        userId: state.user.uid,
        displayName: state.userProfile?.displayName || state.user.displayName || state.user.email,
        photoURL: state.user.photoURL
    });
    hideLoading();

    if (result.success) {
        showToast(`Joined ${result.data.name}!`, 'success');
        closeAllModals();
        elements.joinClubForm.reset();
        loadClubsData();
    } else {
        showToast(result.error || 'Failed to join club', 'error');
    }
}

// ============================================
// MODAL HANDLING
// ============================================

/**
 * Check premium status before opening create list modal
 * Free users cannot create custom lists (limit: 0)
 */
async function handleOpenCreateListModal() {
    if (!state.user) {
        showToast('Please sign in to create lists', 'error');
        return;
    }

    const check = await canCreateList(state.user.uid);
    if (!check.allowed) {
        showPremiumUpgradePrompt('custom lists');
        return;
    }

    openModal('create-list-modal');
}

/**
 * Check premium status before opening create club modal
 * Free users cannot create clubs
 */
async function handleOpenCreateClubModal() {
    if (!state.user) {
        showToast('Please sign in to create clubs', 'error');
        return;
    }

    const check = await canCreateClub(state.user.uid);
    if (!check.allowed) {
        showPremiumUpgradePrompt('clubs');
        return;
    }

    openModal('create-club-modal');
}

/**
 * Show premium upgrade prompt modal
 * @param {string} feature - Feature name (e.g., 'custom lists', 'clubs')
 */
function showPremiumUpgradePrompt(feature) {
    console.log('[Premium] showPremiumUpgradePrompt called for feature:', feature);
    const modal = document.getElementById('premium-upgrade-modal');
    console.log('[Premium] Modal element found:', !!modal, modal);
    if (!modal) {
        // Fallback if modal doesn't exist
        console.warn('[Premium] Modal not found, falling back to toast + redirect');
        showToast(`Upgrade to Pro for unlimited ${feature}!`, 'info', 2000);
        setTimeout(() => {
            window.location.href = 'premium.html';
        }, 500);
        return;
    }

    // Set the locked feature text
    const featureText = document.getElementById('premium-locked-feature');
    if (featureText) {
        const featureLabels = {
            'custom lists': 'Custom Lists',
            'lists': 'Custom Lists',
            'clubs': 'Book Clubs',
            'reading insights': 'Reading Insights'
        };
        featureText.textContent = featureLabels[feature] || feature;
    }

    console.log('[Premium] Opening modal via openModal()');
    openModal('premium-upgrade-modal');
}

/**
 * Close premium upgrade modal
 */
function closePremiumUpgradeModal() {
    const modal = document.getElementById('premium-upgrade-modal');
    if (modal) {
        modal.classList.remove('open');
    }
}

/**
 * Handle premium upgrade button click
 */
function handlePremiumUpgrade() {
    closePremiumUpgradeModal();
    window.location.href = 'premium.html';
}

// Expose premium modal functions to window
window.closePremiumUpgradeModal = closePremiumUpgradeModal;
window.handlePremiumUpgrade = handlePremiumUpgrade;

// Expose premium-gated modal openers to window for inline onclick handlers
window.handleOpenCreateListModal = handleOpenCreateListModal;
window.handleOpenCreateClubModal = handleOpenCreateClubModal;

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('open');
    }
}

function closeAllModals() {
    // Stop barcode scanner if active
    if (isScanning) {
        stopBarcodeScanner();
    }
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('open');
    });
}

window.openBookDetailModal = function(bookDataStr) {
    try {
        const book = JSON.parse(decodeURIComponent(bookDataStr));

        // Store the book for later use
        state.selectedBook = book;

        // Populate modal
        document.getElementById('book-detail-cover').innerHTML = book.coverImageUrl
            ? `<img src="${book.coverImageUrl}" alt="${book.title}">`
            : '';
        document.getElementById('book-detail-title').textContent = book.title;
        document.getElementById('book-detail-author').textContent = book.authors?.join(', ') || 'Unknown Author';
        document.getElementById('book-detail-description').textContent = book.description || 'No description available.';

        // Metadata
        const metaItems = [];
        if (book.pageCount) metaItems.push(`${book.pageCount} pages`);
        if (book.publishedDate) metaItems.push(`Published ${book.publishedDate}`);
        if (book.publisher) metaItems.push(book.publisher);
        if (book.averageRating) metaItems.push(`Rating: ${book.averageRating}`);
        if (book.isbn) metaItems.push(`ISBN: ${book.isbn}`);
        if (book.genre) metaItems.push(book.genre);

        document.getElementById('book-detail-meta').innerHTML = metaItems
            .map(item => `<span class="book-detail-meta-item">${item}</span>`)
            .join('');

        // Reset format picker state
        const formatPicker = document.getElementById('ownership-format-picker');
        if (formatPicker) {
            formatPicker.classList.remove('active');
            // Reset to physical as default
            document.querySelectorAll('.format-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.format === 'physical');
            });
        }

        // Show the add button
        const addBtn = document.getElementById('add-to-library-btn');
        if (addBtn) {
            addBtn.style.display = 'flex';
        }

        openModal('book-detail-modal');
    } catch (e) {
        console.error('Error parsing book data:', e);
    }
}

async function openBookDetail(itemId, items) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Store current item for move functionality
    state.selectedBook = item;

    // Calculate progress
    const progress = item.pageCount && item.currentPage
        ? Math.round((item.currentPage / item.pageCount) * 100)
        : 0;

    // Determine status display
    const statusLabels = {
        'unread': 'Not started',
        'reading': 'Reading',
        'read': 'Finished'
    };
    const statusLabel = statusLabels[item.status] || item.status;

    // Get description - try from item first, then fetch from cache if missing
    let description = item.description;
    if (!description && item.isbn) {
        description = await getBookDescription(item.isbn);
    }

    // Fetch user's review if book is finished
    let userReview = null;
    if ((item.status === 'read' || item.status === 'finished') && state.user) {
        const reviewResult = await getUserReviewForBook(state.user.uid, item.isbn || item.id);
        if (reviewResult.success && reviewResult.data) {
            userReview = reviewResult.data;
        }
    }

    // Build review section HTML if review exists
    const reviewSection = userReview ? `
        <div class="book-detail-review">
            <h4>Your Review</h4>
            <div class="review-rating">${'★'.repeat(userReview.rating)}${'☆'.repeat(5 - userReview.rating)}</div>
            ${userReview.reviewText ? `<p class="review-text">"${userReview.reviewText}"</p>` : ''}
            ${userReview.recommend ? '<span class="recommend-badge">You recommend this book</span>' : ''}
            <button class="btn btn-secondary btn-sm" onclick="editReview('${item.id}')">Edit Review</button>
        </div>
    ` : '';

    // Determine review button text based on whether review exists
    const reviewButtonHtml = userReview
        ? `<button class="btn btn-secondary" onclick="editReview('${item.id}')">Edit Review</button>`
        : `<button class="btn btn-primary" onclick="writeReviewForBook('${item.id}')">Write a Review</button>`;

    elements.libraryBookContent.innerHTML = `
        <div class="book-detail">
            <div class="book-detail-cover">
                ${item.coverImageUrl
            ? `<img src="${item.coverImageUrl}" alt="${item.title}">`
            : `<div class="book-card-cover-text">${item.title}</div>`
        }
            </div>
            <div class="book-detail-info">
                <h2>${item.title}</h2>
                <p class="book-detail-author">${item.authors?.join(', ') || 'Unknown Author'}</p>
                <div class="book-detail-meta">
                    ${item.pageCount ? `<span>📖 ${item.pageCount} pages</span>` : ''}
                    <span class="status-badge status-${item.status}">${statusLabel}</span>
                </div>
                ${item.status === 'read' ? `
                    <div class="book-detail-progress complete">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 100%"></div>
                        </div>
                        <span class="progress-text">100% Complete</span>
                    </div>
                ` : item.status === 'reading' ? `
                    <div class="book-detail-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <span class="progress-text">${item.currentPage || 0} / ${item.pageCount || '?'} pages (${progress}%)</span>
                    </div>
                ` : ''}
                ${reviewSection}
                <p class="book-detail-desc">${description || 'No description available.'}</p>
                <div class="book-detail-actions">
                    ${item.status === 'unread' ? `
                        <button class="btn btn-secondary" onclick="startReading('${item.id}')">Start Reading</button>
                        <button class="btn btn-primary" onclick="finishBook('${item.id}')">Mark as Finished</button>
                    ` : ''}
                    ${item.status === 'reading' ? `
                        <button class="btn btn-secondary" onclick="updateProgress('${item.id}', ${item.pageCount || 0})">Update Progress</button>
                        <button class="btn btn-primary" onclick="finishBook('${item.id}')">Mark as Finished</button>
                    ` : ''}
                    ${item.status === 'read' ? reviewButtonHtml : ''}
                    <button class="btn btn-secondary" onclick="openMoveToListModal('${item.id}', '${item.listId}')">Move to List</button>
                    <button class="btn btn-secondary" onclick="addListItemToClub('${item.id}')">Add to Club</button>
                    <button class="btn btn-outline" onclick="removeBook('${item.id}', '${item.listId}')">Remove</button>
                </div>
            </div>
        </div>
    `;

    openModal('library-book-modal');
}

// Add a book from a list to a club
window.addListItemToClub = async (itemId) => {
    // Get the book item data
    const result = await getBookItem(itemId);
    if (!result.success) {
        showToast('Could not load book data', 'error');
        return;
    }

    const book = result.data;

    // Check if user is in any clubs
    if (!state.clubs || state.clubs.length === 0) {
        showToast('Join a club first to share books', 'info');
        return;
    }

    // Store the book for the club picker
    state.selectedBookForClub = {
        isbn: book.isbn,
        title: book.title,
        authors: book.authors,
        coverImageUrl: book.coverImageUrl,
        description: book.description,
        pageCount: book.pageCount,
        genre: book.genre,
        categories: book.categories
    };

    closeAllModals();
    renderClubPicker();
    openModal('club-picker-modal');
};

// Allow writing a review for an already-finished book
window.writeReviewForBook = async (itemId) => {
    const result = await getBookItem(itemId);
    if (result.success) {
        state.finishingBook = result.data;
        closeAllModals();
        showReviewModal(result.data);
    }
};

// Edit an existing review for a book
window.editReview = async (itemId) => {
    const result = await getBookItem(itemId);
    if (result.success) {
        state.finishingBook = result.data;
        closeAllModals();
        showReviewModal(result.data);
    }
};

// ============================================
// BOOK ACTIONS (Global for onclick handlers)
// ============================================

window.startReading = async (itemId) => {
    showLoading();

    // Get book data first for activity posting
    const bookItemResult = await getBookItem(itemId);
    const bookData = bookItemResult.success ? bookItemResult.data : null;

    const result = await updateItemStatus(itemId, 'reading');
    hideLoading();

    if (result.success) {
        showToast('Happy reading!', 'success');
        closeAllModals();
        loadHomeData();
        if (state.currentList) {
            loadListDetail(state.currentList.id);
        }

        // Post activity to clubs that have this book
        if (bookData?.isbn) {
            const userData = {
                userId: state.user.uid,
                displayName: state.userProfile?.displayName || state.user.displayName || state.user.email,
                photoURL: state.userProfile?.photoURL
            };
            postActivityToClubsWithBook(
                bookData.isbn,
                bookData.title,
                bookData.coverImageUrl,
                'startedBook',
                userData
            );
        }
    }
};

window.finishBook = async (itemId) => {
    console.log('=== FINISH BOOK CALLED ===');
    console.log('finishBook called with itemId:', itemId);

    // Debug: show toast immediately to confirm function is called
    showToast('Processing...', 'success');

    if (!state.user || !state.userProfile) {
        console.log('No user or profile:', state.user, state.userProfile);
        showToast('Please sign in to mark books as finished', 'error');
        return;
    }

    showLoading();

    try {
        // First, get the book data before we move it (for celebration)
        console.log('Getting book item...');
        const bookItemResult = await getBookItem(itemId);
        console.log('Book item result:', bookItemResult);
        const bookData = bookItemResult.success ? bookItemResult.data : null;

        // Use the finishBookAndMove function that handles:
        // 1. Moving the book from its current list to the Finished list
        // 2. Setting progress to 100% (page count)
        // 3. Setting status to 'read'
        console.log('Calling finishBookAndMove...');
        const result = await finishBookAndMove(
            itemId,
            state.user.uid,
            state.userProfile.displayName || state.user.displayName || state.user.email
        );
        console.log('finishBookAndMove result:', result);

        if (!result.success) {
            hideLoading();
            console.log('finishBookAndMove failed:', result.error);
            showToast(result.error || 'Failed to mark as finished', 'error');
            return;
        }

        console.log('Book move successful!');
        showToast('Book marked as finished!', 'success');

        // Get the updated stats for celebration
        console.log('Getting user stats...');
        const statsResult = await getUserStats(state.user.uid);
        console.log('Stats result:', statsResult);
        const booksFinished = statsResult.success ? statsResult.data.finished : 1;

        hideLoading();

        // Close any open modals first
        closeAllModals();

        // Use book data from result if available, otherwise use what we fetched
        const celebrationBookData = result.data.bookData || bookData;
        console.log('Celebration book data:', celebrationBookData);

        // Always show celebration with review prompt
        console.log('About to show celebration modal...');
        const celebrationData = celebrationBookData || {
            id: itemId,
            title: 'your book',
            authors: []
        };

        // Show celebration immediately
        showCelebration(celebrationData, booksFinished);

        // Post activity to clubs that have this book
        if (celebrationBookData?.isbn) {
            const userData = {
                userId: state.user.uid,
                displayName: state.userProfile?.displayName || state.user.displayName || state.user.email,
                photoURL: state.userProfile?.photoURL
            };
            postActivityToClubsWithBook(
                celebrationBookData.isbn,
                celebrationBookData.title,
                celebrationBookData.coverImageUrl,
                'finishedBook',
                userData
            );
        }

        // Refresh data in background
        loadHomeData();
        loadLibraryData();
        if (state.currentList) {
            loadListDetail(state.currentList.id);
        }

    } catch (error) {
        hideLoading();
        console.error('Finish book error:', error);
        showToast('Something went wrong. Please try again.', 'error');
    }
};

window.removeBook = async (itemId, listId) => {
    if (!confirm('Remove this book from your list?')) return;

    showLoading();
    const result = await removeBookFromList(itemId, listId);
    hideLoading();

    if (result.success) {
        showToast('Book removed', 'success');
        closeAllModals();
        loadLibraryData();
        if (state.currentList) {
            loadListDetail(state.currentList.id);
        }
    }
};

/**
 * Handle refetching a better cover image for a book
 * Shows loading state, calls refetchBookCover, updates UI on success/failure
 * @param {string} itemId - The item document ID
 */
window.handleRefetchCover = async (itemId) => {
    if (!itemId) {
        showToast('Invalid book ID', 'error');
        return;
    }

    showLoading();
    showToast('Searching for better cover...', 'info');

    try {
        // Search for a better cover
        const searchResult = await refetchBookCover(itemId);

        if (!searchResult.success) {
            hideLoading();
            showToast(searchResult.error || 'Could not find a better cover', 'error');
            return;
        }

        const newCoverUrl = searchResult.data;

        // Update the book item with the new cover
        const updateResult = await updateBookCover(itemId, newCoverUrl);

        hideLoading();

        if (updateResult.success) {
            showToast('Cover updated!', 'success');

            // Refresh the UI to show the new cover
            closeAllModals();
            loadLibraryData();
            loadMyBooks();
            if (state.currentList) {
                loadListDetail(state.currentList.id);
            }
        } else {
            showToast(updateResult.error || 'Failed to update cover', 'error');
        }

    } catch (error) {
        hideLoading();
        console.error('Refetch cover error:', error);
        showToast('Something went wrong. Please try again.', 'error');
    }
};

window.openMoveToListModal = (itemId, currentListId) => {
    // Render list options excluding current list
    const moveListPicker = document.getElementById('move-list-picker');
    if (!moveListPicker) return;

    const otherLists = state.lists.filter(list => list.id !== currentListId);

    if (otherLists.length === 0) {
        moveListPicker.innerHTML = '<p class="empty-state small">No other lists available</p>';
    } else {
        moveListPicker.innerHTML = otherLists.map(list => `
            <div class="list-picker-item" data-list-id="${list.id}" data-item-id="${itemId}" data-from-list-id="${currentListId}">
                <div class="list-icon">${getListIcon(list.listType)}</div>
                <div class="list-info">
                    <div class="list-name">${list.name}</div>
                    <div class="list-count">${pluralize(list.itemCount || 0, 'book')}</div>
                </div>
            </div>
        `).join('');

        // Add click handlers
        moveListPicker.querySelectorAll('.list-picker-item').forEach(item => {
            item.addEventListener('click', () => {
                handleMoveToList(item.dataset.itemId, item.dataset.fromListId, item.dataset.listId);
            });
        });
    }

    openModal('move-to-list-modal');
};

async function handleMoveToList(itemId, fromListId, toListId) {
    showLoading();
    const result = await moveItemToList(itemId, fromListId, toListId);
    hideLoading();

    if (result.success) {
        const targetList = state.lists.find(l => l.id === toListId);
        showToast(`Moved to ${targetList?.name || 'list'}`, 'success');
        closeAllModals();
        loadLibraryData();
        if (state.currentList) {
            loadListDetail(state.currentList.id);
        }
    } else {
        showToast(result.error || 'Failed to move book', 'error');
    }
}

window.openModal = openModal;

// ============================================
// PROFILE & SETTINGS HANDLERS
// ============================================

function populateEditProfileForm() {
    if (!state.userProfile) return;

    document.getElementById('edit-display-name').value = state.userProfile.displayName || '';
    document.getElementById('edit-bio').value = state.userProfile.bio || '';
    document.getElementById('edit-reading-goal').value = state.userProfile.readingGoal || '';

    // Reset photo state
    pendingPhotoFile = null;
    photoRemoved = false;

    // Update photo preview
    const previewImg = document.getElementById('profile-photo-image');
    const previewInitials = document.getElementById('profile-photo-initials');
    const removeBtn = document.getElementById('remove-photo-btn');
    const btnText = document.getElementById('photo-btn-text');

    if (state.userProfile.photoURL) {
        previewImg.src = state.userProfile.photoURL;
        previewImg.style.display = 'block';
        previewInitials.style.display = 'none';
        removeBtn.style.display = 'inline-flex';
        btnText.textContent = 'Change Photo';
    } else {
        previewImg.style.display = 'none';
        previewImg.src = '';
        previewInitials.style.display = 'flex';
        previewInitials.textContent = getInitials(state.userProfile.displayName || state.user?.email || '');
        removeBtn.style.display = 'none';
        btnText.textContent = 'Upload Photo';
    }
}

function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        showToast('Please select a JPEG, PNG, or WebP image', 'error');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('Image must be less than 10MB', 'error');
        return;
    }

    pendingPhotoFile = file;
    photoRemoved = false;

    // Preview the selected image
    const previewImg = document.getElementById('profile-photo-image');
    const previewInitials = document.getElementById('profile-photo-initials');
    const removeBtn = document.getElementById('remove-photo-btn');
    const btnText = document.getElementById('photo-btn-text');

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        previewInitials.style.display = 'none';
        removeBtn.style.display = 'inline-flex';
        btnText.textContent = 'Change Photo';
    };
    reader.readAsDataURL(file);
}

function handlePhotoRemove() {
    pendingPhotoFile = null;
    photoRemoved = true;

    const previewImg = document.getElementById('profile-photo-image');
    const previewInitials = document.getElementById('profile-photo-initials');
    const removeBtn = document.getElementById('remove-photo-btn');
    const btnText = document.getElementById('photo-btn-text');

    previewImg.style.display = 'none';
    previewImg.src = '';
    previewInitials.style.display = 'flex';
    previewInitials.textContent = getInitials(state.userProfile?.displayName || state.user?.email || '');
    removeBtn.style.display = 'none';
    btnText.textContent = 'Upload Photo';
}

async function handleEditProfile(e) {
    e.preventDefault();

    const name = document.getElementById('edit-display-name').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const readingGoal = parseInt(document.getElementById('edit-reading-goal').value) || null;

    if (!name || !state.user) return;

    showLoading();

    try {
        // Handle photo upload/removal first
        let newPhotoURL = state.userProfile?.photoURL;

        if (pendingPhotoFile) {
            // Upload new photo
            const uploadResult = await uploadProfilePhoto(state.user.uid, pendingPhotoFile);
            if (uploadResult.success) {
                newPhotoURL = uploadResult.data;
            } else {
                hideLoading();
                showToast(uploadResult.error || 'Failed to upload photo', 'error');
                return;
            }
        } else if (photoRemoved && state.userProfile?.photoURL) {
            // Remove existing photo
            const removeResult = await removeProfilePhoto(state.user.uid);
            if (removeResult.success) {
                newPhotoURL = null;
            } else {
                hideLoading();
                showToast(removeResult.error || 'Failed to remove photo', 'error');
                return;
            }
        }

        // Update other profile fields
        const result = await updateUserProfile(state.user.uid, {
            displayName: name,
            bio: bio,
            readingGoal: readingGoal
        });

        hideLoading();

        if (result.success) {
            // Update local state
            state.userProfile = {
                ...state.userProfile,
                displayName: name,
                bio,
                readingGoal,
                photoURL: newPhotoURL
            };

            showToast('Profile updated!', 'success');
            closeAllModals();
            updateUserUI();
            loadProfileData();

            // Reset photo state
            pendingPhotoFile = null;
            photoRemoved = false;
        } else {
            showToast(result.error || 'Failed to update profile', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('An error occurred', 'error');
        console.error('Edit profile error:', error);
    }
}

async function handleSaveSettings() {
    if (!state.user) return;

    const settings = {
        notifications: {
            clubActivity: document.getElementById('notify-club-activity').checked,
            readingReminders: document.getElementById('notify-reading-reminders').checked,
            recommendations: document.getElementById('notify-recommendations').checked,
            friendActivity: document.getElementById('notify-friend-activity').checked
        },
        preferences: {
            publicProfile: document.getElementById('pref-public-profile').checked,
            showActivity: document.getElementById('pref-show-activity').checked
        }
    };

    showLoading();
    const result = await updateUserSettings(state.user.uid, settings);
    hideLoading();

    if (result.success) {
        state.userSettings = settings;
        showToast('Settings saved!', 'success');
        closeAllModals();
    } else {
        showToast(result.error || 'Failed to save settings', 'error');
    }
}

async function loadUserSettings() {
    if (!state.user) return;

    const result = await getUserSettings(state.user.uid);
    if (result.success && result.data) {
        state.userSettings = result.data;

        // Populate settings form
        const notif = result.data.notifications || {};
        const pref = result.data.preferences || {};

        document.getElementById('notify-club-activity').checked = notif.clubActivity !== false;
        document.getElementById('notify-reading-reminders').checked = notif.readingReminders !== false;
        document.getElementById('notify-recommendations').checked = notif.recommendations === true;
        document.getElementById('notify-friend-activity').checked = notif.friendActivity !== false;
        document.getElementById('pref-public-profile').checked = pref.publicProfile === true;
        document.getElementById('pref-show-activity').checked = pref.showActivity !== false;
    }
}

// ============================================
// REVIEW & CELEBRATION HANDLERS
// ============================================

function setStarRating(rating) {
    state.currentRating = rating;
    document.getElementById('review-rating').value = rating;
    highlightStars(rating);
}

function highlightStars(rating) {
    elements.starRating.querySelectorAll('.star').forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function showCelebration(bookData, booksFinished) {
    // Store the book for potential review
    state.finishingBook = bookData;

    // Update celebration modal content safely
    const titleEl = document.getElementById('celebration-book-title');
    const countEl = document.getElementById('celebration-books-count');

    if (titleEl) {
        titleEl.textContent = `You finished "${bookData?.title || 'your book'}"`;
    }
    if (countEl) {
        countEl.textContent = booksFinished || 1;
    }

    // Open celebration modal
    openModal('celebration-modal');
}

function showReviewModal(bookData) {
    state.currentRating = 0;
    highlightStars(0);
    document.getElementById('review-rating').value = '0';
    document.getElementById('review-text').value = '';
    document.getElementById('review-recommend').checked = true;

    // Populate book info
    elements.reviewBookInfo.innerHTML = `
        <div class="review-book-cover">
            ${bookData.coverImageUrl
                ? `<img src="${bookData.coverImageUrl}" alt="${bookData.title}">`
                : ''}
        </div>
        <div class="review-book-details">
            <div class="review-book-title">${bookData.title}</div>
            <div class="review-book-author">${bookData.authors?.join(', ') || 'Unknown Author'}</div>
        </div>
    `;

    openModal('review-modal');
}

async function handleSubmitReview(e) {
    e.preventDefault();

    if (!state.finishingBook || !state.user) return;

    const rating = parseInt(document.getElementById('review-rating').value);
    const reviewText = document.getElementById('review-text').value.trim();
    const recommend = document.getElementById('review-recommend').checked;

    if (rating === 0) {
        showToast('Please select a rating', 'error');
        return;
    }

    showLoading();
    const result = await addBookReview({
        userId: state.user.uid,
        userName: state.userProfile?.displayName || state.user.displayName || state.user.email,
        userPhotoUrl: state.user.photoURL,
        bookId: state.finishingBook.bookId || state.finishingBook.id,
        bookTitle: state.finishingBook.title,
        bookCoverUrl: state.finishingBook.coverImageUrl,
        rating,
        reviewText,
        recommend
    });
    hideLoading();

    if (result.success) {
        showToast('Review submitted! Thanks for sharing your thoughts.', 'success');

        // Post activity to clubs that have this book
        if (state.finishingBook?.isbn) {
            const userData = {
                userId: state.user.uid,
                displayName: state.userProfile?.displayName || state.user.displayName || state.user.email,
                photoURL: state.userProfile?.photoURL
            };
            postActivityToClubsWithBook(
                state.finishingBook.isbn,
                state.finishingBook.title,
                state.finishingBook.coverImageUrl,
                'reviewedBook',
                userData,
                rating
            );
        }

        closeAllModals();
        state.finishingBook = null;
        state.currentRating = 0;
    } else {
        showToast(result.error || 'Failed to submit review', 'error');
    }
}

// ============================================
// UI HELPERS
// ============================================

function updateUserUI() {
    if (!state.user) return;

    const name = state.userProfile?.displayName || state.user.displayName || state.user.email;
    const photoURL = state.userProfile?.photoURL;

    // Update sidebar avatar with photo support
    updateAvatarElement(elements.sidebarAvatar, photoURL, name);
    elements.sidebarUsername.textContent = name;
}

function updateGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good evening';

    if (hour < 12) {
        greeting = 'Good morning';
    } else if (hour < 18) {
        greeting = 'Good afternoon';
    }

    elements.greetingText.textContent = greeting;
    elements.greetingName.textContent = state.userProfile?.displayName || 'Welcome back';
}

function showLoading() {
    elements.loadingOverlay.classList.add('show');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('show');
}

function showAuthError(message) {
    // Remove and re-add class to re-trigger animation
    elements.authError.classList.remove('show');

    // Force reflow to restart animation
    void elements.authError.offsetWidth;

    elements.authError.textContent = message;
    elements.authError.classList.add('show');

    // Scroll error into view
    elements.authError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAuthError() {
    elements.authError.classList.remove('show');
    elements.authError.textContent = '';
}

function showToast(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
}

function getInitials(name) {
    if (!name) return '?';
    return name
        .split(' ')
        .map(part => part.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}

/**
 * Create avatar HTML with photo support and initials fallback
 * @param {Object} options - Avatar options
 * @param {string} options.photoURL - Photo URL (optional)
 * @param {string} options.name - Display name for initials fallback
 * @param {string} options.size - Size: 'xs' (20px), 'sm' (28px), 'md' (40px), 'lg' (48px), 'xl' (56px)
 * @param {string} options.className - Additional CSS class (optional)
 * @returns {string} HTML string
 */
function createAvatarHTML(options) {
    const { photoURL, name, size = 'md', className = '' } = options;
    const initials = getInitials(name);

    const sizeClasses = {
        'xs': 'avatar-xs',
        'sm': 'avatar-sm',
        'md': 'avatar-md',
        'lg': 'avatar-lg',
        'xl': 'avatar-xl'
    };

    const sizeClass = sizeClasses[size] || 'avatar-md';
    const fullClassName = `avatar ${sizeClass} ${className}`.trim();

    if (photoURL) {
        return `
            <div class="${fullClassName}">
                <img src="${photoURL}" alt="${name}" class="avatar-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <span class="avatar-initials" style="display: none;">${initials}</span>
            </div>
        `;
    }

    return `
        <div class="${fullClassName}">
            <span class="avatar-initials">${initials}</span>
        </div>
    `;
}

/**
 * Update a DOM element to show avatar with photo or initials
 * @param {HTMLElement} element - Avatar container element
 * @param {string|null} photoURL - Photo URL or null
 * @param {string} name - Display name for initials
 */
function updateAvatarElement(element, photoURL, name) {
    const initials = getInitials(name);

    if (photoURL) {
        element.innerHTML = `
            <img src="${photoURL}" alt="${name}" class="avatar-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <span class="avatar-initials" style="display: none;">${initials}</span>
        `;
    } else {
        element.innerHTML = `<span class="avatar-initials">${initials}</span>`;
    }
}

function pluralize(count, singular, plural) {
    return count === 1 ? `1 ${singular}` : `${count} ${plural || singular + 's'}`;
}

function getListIcon(listType) {
    const icons = {
        'reading': '📖',
        'favorites': '❤️',
        'toRead': '🔖',
        'completed': '✓',
        'custom': '📁'
    };
    return icons[listType] || '📁';
}

function getActivityMessage(activity) {
    const book = activity.bookTitle || 'a book';
    const messages = {
        'joined': 'joined the club',
        'addedBook': `added '${book}'`,
        'interested': `is interested in '${book}'`,
        'addedToList': `added '${book}' to their list`,
        'startedBook': `started reading '${book}'`,
        'finishedBook': `finished reading '${book}'`,
        'reviewedBook': activity.rating
            ? `gave '${book}' ${activity.rating} ${activity.rating === 1 ? 'star' : 'stars'}`
            : `reviewed '${book}'`,
        // Legacy types
        'finished': `finished reading '${book}'`,
        'started': `started reading '${book}'`,
        'rated': `rated '${book}' ${activity.rating}/5`
    };
    return messages[activity.type] || activity.type;
}

function getTimeAgo(date) {
    if (!date) return 'Just now';

    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
}
