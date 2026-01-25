/**
 * PageSwipe RevenueCat Service
 * Handles RevenueCat Purchases.js integration for web subscriptions via Stripe
 *
 * Documentation: https://www.revenuecat.com/docs/web/purchases-js
 */

import { db } from './firebase-config.js';
import { doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// ============================================
// CONFIGURATION
// ============================================

const REVENUECAT_API_KEY = 'rcb_kwFsnAjtAxQorIyvKexWMUnruozJ';
const OFFERING_ID = 'PageSwipe_Premium';
const ENTITLEMENT_ID = 'pro';

// Package identifiers
const PACKAGE_IDS = {
    MONTHLY: '$rc_monthly',
    ANNUAL: '$rc_annual'
};

// Track initialization state
let isInitialized = false;
let currentOfferings = null;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize RevenueCat SDK
 * Should be called after user logs in with their Firebase UID
 * @param {string} userId - Firebase user ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function initRevenueCat(userId) {
    if (!userId) {
        return { success: false, error: 'No user ID provided' };
    }

    // Wait for Purchases SDK to be available
    // Note: UMD build exposes SDK as Purchases.Purchases, not directly as Purchases
    if (typeof Purchases === 'undefined' || typeof Purchases.Purchases === 'undefined') {
        console.warn('RevenueCat Purchases SDK not loaded yet');
        return { success: false, error: 'SDK not loaded' };
    }

    try {
        // Configure RevenueCat with API key and user ID
        Purchases.Purchases.configure({
            apiKey: REVENUECAT_API_KEY,
            appUserId: userId
        });

        isInitialized = true;
        console.log('RevenueCat initialized for user:', userId);

        return { success: true };
    } catch (error) {
        console.error('RevenueCat initialization error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if RevenueCat is initialized
 * @returns {boolean}
 */
export function isRevenueCatInitialized() {
    return isInitialized;
}

// ============================================
// ENTITLEMENTS & CUSTOMER INFO
// ============================================

/**
 * Check if user has the Pro entitlement
 * @returns {Promise<{isPro: boolean, expirationDate?: Date, willRenew?: boolean}>}
 */
export async function checkProEntitlement() {
    if (!isInitialized) {
        console.warn('RevenueCat not initialized');
        return { isPro: false };
    }

    try {
        const customerInfo = await Purchases.Purchases.getSharedInstance().getCustomerInfo();

        if (!customerInfo || !customerInfo.entitlements) {
            return { isPro: false };
        }

        const proEntitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

        if (proEntitlement) {
            return {
                isPro: true,
                expirationDate: proEntitlement.expirationDate ? new Date(proEntitlement.expirationDate) : null,
                willRenew: proEntitlement.willRenew ?? true
            };
        }

        return { isPro: false };
    } catch (error) {
        console.error('Error checking entitlement:', error);
        return { isPro: false };
    }
}

/**
 * Get full customer info from RevenueCat
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function getCustomerInfo() {
    if (!isInitialized) {
        return { success: false, error: 'RevenueCat not initialized' };
    }

    try {
        const customerInfo = await Purchases.Purchases.getSharedInstance().getCustomerInfo();
        return { success: true, data: customerInfo };
    } catch (error) {
        console.error('Error getting customer info:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sync entitlement status with Firestore
 * Updates the user's isPro field based on RevenueCat entitlement
 * @param {string} userId - Firebase user ID
 * @returns {Promise<{success: boolean, isPro: boolean, error?: string}>}
 */
export async function syncEntitlementWithFirestore(userId) {
    if (!userId) {
        return { success: false, isPro: false, error: 'No user ID' };
    }

    try {
        const entitlementResult = await checkProEntitlement();

        // Update Firestore with current entitlement status
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            isPro: entitlementResult.isPro,
            subscriptionUpdatedAt: serverTimestamp()
        });

        console.log('Synced entitlement to Firestore:', entitlementResult.isPro);
        return { success: true, isPro: entitlementResult.isPro };
    } catch (error) {
        console.error('Error syncing entitlement:', error);
        return { success: false, isPro: false, error: error.message };
    }
}

// ============================================
// OFFERINGS & PACKAGES
// ============================================

/**
 * Get available offerings from RevenueCat
 * @returns {Promise<{success: boolean, offerings?: object, error?: string}>}
 */
export async function getOfferings() {
    if (!isInitialized) {
        return { success: false, error: 'RevenueCat not initialized' };
    }

    try {
        const offerings = await Purchases.Purchases.getSharedInstance().getOfferings();
        currentOfferings = offerings;
        return { success: true, offerings };
    } catch (error) {
        console.error('Error getting offerings:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get the PageSwipe Premium offering
 * @returns {Promise<{success: boolean, offering?: object, error?: string}>}
 */
export async function getPremiumOffering() {
    const result = await getOfferings();

    if (!result.success) {
        return result;
    }

    const offering = result.offerings?.all?.[OFFERING_ID] || result.offerings?.current;

    if (!offering) {
        return { success: false, error: 'Premium offering not found' };
    }

    return { success: true, offering };
}

/**
 * Get monthly package from the premium offering
 * @returns {Promise<{success: boolean, package?: object, error?: string}>}
 */
export async function getMonthlyPackage() {
    const result = await getPremiumOffering();

    if (!result.success) {
        return result;
    }

    const monthlyPackage = result.offering.availablePackages.find(
        pkg => pkg.identifier === PACKAGE_IDS.MONTHLY
    );

    if (!monthlyPackage) {
        return { success: false, error: 'Monthly package not found' };
    }

    return { success: true, package: monthlyPackage };
}

/**
 * Get annual package from the premium offering
 * @returns {Promise<{success: boolean, package?: object, error?: string}>}
 */
export async function getAnnualPackage() {
    const result = await getPremiumOffering();

    if (!result.success) {
        return result;
    }

    const annualPackage = result.offering.availablePackages.find(
        pkg => pkg.identifier === PACKAGE_IDS.ANNUAL
    );

    if (!annualPackage) {
        return { success: false, error: 'Annual package not found' };
    }

    return { success: true, package: annualPackage };
}

// ============================================
// PURCHASES
// ============================================

/**
 * Purchase a package (triggers Stripe checkout)
 * @param {object} rcPackage - RevenueCat package object
 * @returns {Promise<{success: boolean, customerInfo?: object, error?: string}>}
 */
export async function purchasePackage(rcPackage) {
    if (!isInitialized) {
        return { success: false, error: 'RevenueCat not initialized' };
    }

    if (!rcPackage) {
        return { success: false, error: 'No package provided' };
    }

    try {
        const result = await Purchases.Purchases.getSharedInstance().purchase({ rcPackage });

        console.log('Purchase successful:', result);
        return { success: true, customerInfo: result.customerInfo };
    } catch (error) {
        // Handle user cancellation
        if (error.userCancelled) {
            return { success: false, error: 'Purchase cancelled', cancelled: true };
        }

        console.error('Purchase error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Purchase monthly subscription
 * @returns {Promise<{success: boolean, customerInfo?: object, error?: string}>}
 */
export async function purchaseMonthly() {
    const packageResult = await getMonthlyPackage();

    if (!packageResult.success) {
        return packageResult;
    }

    return purchasePackage(packageResult.package);
}

/**
 * Purchase annual subscription
 * @returns {Promise<{success: boolean, customerInfo?: object, error?: string}>}
 */
export async function purchaseAnnual() {
    const packageResult = await getAnnualPackage();

    if (!packageResult.success) {
        return packageResult;
    }

    return purchasePackage(packageResult.package);
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

/**
 * Get the management URL for customer portal (Stripe)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function getManagementURL() {
    if (!isInitialized) {
        return { success: false, error: 'RevenueCat not initialized' };
    }

    try {
        const url = await Purchases.Purchases.getSharedInstance().getManagementURL();

        if (!url) {
            return { success: false, error: 'No management URL available' };
        }

        return { success: true, url };
    } catch (error) {
        console.error('Error getting management URL:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Open the subscription management portal
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function openManagementPortal() {
    const result = await getManagementURL();

    if (!result.success) {
        return result;
    }

    // Open in new tab
    window.open(result.url, '_blank');
    return { success: true };
}

// ============================================
// EXPORTS FOR GLOBAL ACCESS
// ============================================

// Make functions available globally for HTML onclick handlers
if (typeof window !== 'undefined') {
    window.RevenueCatService = {
        init: initRevenueCat,
        checkProEntitlement,
        syncEntitlementWithFirestore,
        purchaseMonthly,
        purchaseAnnual,
        openManagementPortal,
        getOfferings,
        getCustomerInfo
    };
}
