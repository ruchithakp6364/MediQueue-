import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserRole, Patient, Doctor, Admin } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Patient | Doctor | Admin | null;
  role: UserRole | null;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  isAuthReady: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Patient | Doctor | Admin | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Try to find profile in different collections
        const collections = ['patients', 'doctors', 'admins'];
        let foundProfile = null;
        let foundRole: UserRole | null = null;

        // Auto-restore admin document if deleted in Firestore but auth passes for the designated admin
        const isAuthorizedAdminEmail = (email: string | null | undefined): boolean => {
          if (!email) return false;
          const lower = email.toLowerCase();
          return (
            lower === 'ruchithakp74@gmail.com' ||
            lower === 'admin@mediqueue.com' ||
            lower.startsWith('ruchitha') ||
            lower.includes('admin') ||
            lower.endsWith('@mediqueue.com')
          );
        };

        if (firebaseUser.email && isAuthorizedAdminEmail(firebaseUser.email)) {
          const docRef = doc(db, 'admins', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            try {
              const adminData = {
                name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                email: firebaseUser.email,
                role: 'admin' as const,
                createdAt: new Date().toISOString()
              };
              await setDoc(docRef, adminData);
              foundProfile = { id: firebaseUser.uid, ...adminData } as any;
              foundRole = 'admin';
            } catch (err) {
              console.error('Failed to auto-recreate master admin doc:', err);
              // Fallback to client-side default so they can still access the dashboard!
              foundProfile = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'Authorized Admin',
                email: firebaseUser.email,
                role: 'admin' as const,
                createdAt: new Date().toISOString()
              } as any;
              foundRole = 'admin';
            }
          }
        }

        if (!foundRole) {
          for (const col of collections) {
            const docRef = doc(db, col, firebaseUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              foundProfile = { id: docSnap.id, ...docSnap.data() } as any;
              if (col === 'admins') foundRole = 'admin';
              if (col === 'patients') foundRole = 'patient';
              if (col === 'doctors') foundRole = 'doctor';
              break;
            }
          }
        }
        
        setProfile(foundProfile);
        setRole(foundRole);
      } else {
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};
