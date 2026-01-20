/**
 * PageSwipe Firebase Configuration
 *
 * IMPORTANT: This file contains your Firebase config.
 * For production, consider using environment variables.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-analytics.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCWQHsdFEPG0fhxNIykkCjBkfWnKZpcce0",
  authDomain: "pageswipe.firebaseapp.com",
  projectId: "pageswipe",
  storageBucket: "pageswipe.firebasestorage.app",
  messagingSenderId: "916001546685",
  appId: "1:916001546685:web:26d8866333a7f59b61f2d4",
  measurementId: "G-TPHCN52F2S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const functions = getFunctions(app);

export default app;
