import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: any = null;
let auth: any = null;
let analytics: any = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  // Initialize Analytics lazily to avoid component registration timing issues
  if (typeof window !== 'undefined') {
    try {
      analytics = getAnalytics(app);
    } catch (analyticsErr) {
      console.warn('Analytics initialization deferred:', analyticsErr);
    }
  }
  console.log('✅ Firebase connected to project:', firebaseConfig.projectId);
} catch (err) {
  console.warn('Firebase initialization error:', err);
}

export { auth, analytics };

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Local mock user for instant offline guest demo
const GUEST_USER: AuthUser = {
  uid: 'yaswanth_lead_uid',
  email: 'yaswanth@company.internal',
  displayName: 'Yaswanth',
  photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
};

// Check if currently using local mock user
let localMockUser: AuthUser | null = (() => {
  const saved = localStorage.getItem('meetingmind_auth_user');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }
  return null;
})();

const listeners: Array<(user: AuthUser | null) => void> = [];

export function subscribeAuth(callback: (user: AuthUser | null) => void) {
  listeners.push(callback);
  callback(localMockUser);

  if (auth) {
    try {
      return onAuthStateChanged(auth, (fbUser) => {
        if (fbUser) {
          const u: AuthUser = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            photoURL: fbUser.photoURL,
          };
          localMockUser = u;
          localStorage.setItem('meetingmind_auth_user', JSON.stringify(u));
          callback(u);
        }
      });
    } catch (err) {}
  }

  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export async function loginWithGoogle(): Promise<AuthUser> {
  if (auth) {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const u: AuthUser = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName || 'Google User',
        photoURL: result.user.photoURL,
      };
      localMockUser = u;
      localStorage.setItem('meetingmind_auth_user', JSON.stringify(u));
      listeners.forEach((cb) => cb(u));
      return u;
    } catch (err) {
      console.warn('Google Popup auth error, falling back to local session:', err);
    }
  }

  // Local user fallback
  const u: AuthUser = {
    uid: `user_${Date.now()}`,
    email: 'user@local.device',
    displayName: 'Local User',
    photoURL: null,
  };
  localMockUser = u;
  localStorage.setItem('meetingmind_auth_user', JSON.stringify(u));
  listeners.forEach((cb) => cb(u));
  return u;
}

export async function loginWithEmail(email: string, _pass: string): Promise<AuthUser> {
  if (auth) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, _pass);
      const u: AuthUser = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName || email.split('@')[0],
        photoURL: result.user.photoURL,
      };
      localMockUser = u;
      localStorage.setItem('meetingmind_auth_user', JSON.stringify(u));
      listeners.forEach((cb) => cb(u));
      return u;
    } catch (err) {
      console.warn('Email sign-in failed with Firebase, using local profile:', err);
    }
  }

  const u: AuthUser = {
    uid: `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    displayName: email.split('@')[0],
    photoURL: null,
  };
  localMockUser = u;
  localStorage.setItem('meetingmind_auth_user', JSON.stringify(u));
  listeners.forEach((cb) => cb(u));
  return u;
}

export async function signUpWithEmail(email: string, _pass: string, name: string): Promise<AuthUser> {
  if (auth) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, _pass);
      const u: AuthUser = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: name || email.split('@')[0],
        photoURL: result.user.photoURL,
      };
      localMockUser = u;
      localStorage.setItem('meetingmind_auth_user', JSON.stringify(u));
      listeners.forEach((cb) => cb(u));
      return u;
    } catch (err) {
      console.warn('Firebase signup failed, creating local profile:', err);
    }
  }

  const u: AuthUser = {
    uid: `user_${Date.now()}`,
    email,
    displayName: name || email.split('@')[0],
    photoURL: null,
  };
  localMockUser = u;
  localStorage.setItem('meetingmind_auth_user', JSON.stringify(u));
  listeners.forEach((cb) => cb(u));
  return u;
}

export async function logoutUser(): Promise<void> {
  if (auth) {
    try {
      await fbSignOut(auth);
    } catch (err) {}
  }
  localMockUser = null;
  localStorage.removeItem('meetingmind_auth_user');
  listeners.forEach((cb) => cb(null));
}

export function getCurrentAuthUser(): AuthUser | null {
  return localMockUser;
}
