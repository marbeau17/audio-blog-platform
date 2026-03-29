'use client';

import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';
import type { User } from '@/types';

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for redirect result (from Google sign-in redirect)
    getRedirectResult(auth).catch((err) => {
      console.error('Redirect result error:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const res = await api.get<User>('/auth/me');
          setUser(res.data);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    await api.post('/auth/register', { email, password, display_name: displayName });
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      // Try popup first (works on desktop)
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        // Fallback to redirect (works on mobile and when popups are blocked)
        await signInWithRedirect(auth, provider);
      } else {
        throw err;
      }
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  return { firebaseUser, user, loading, signIn, signUp, signInWithGoogle, signOut };
}
