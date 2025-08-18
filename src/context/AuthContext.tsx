"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from 'next/navigation';

// Define the shape of the context data
type AuthContextType = {
  user: User | null;
  loading: boolean;
};

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        // If user profile exists but country is missing...
        if (userDoc.exists() && !userDoc.data().country) {
          // ...redirect to the main user profile page.
          if (pathname !== '/user-profile') {
            router.push('/user-profile');
          }
        } else if (userDoc.exists() && userDoc.data().country) {
          // If user has a country and they are on the login page, redirect to dashboard
          if (pathname === '/login') {
             router.push('/dashboard');
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, pathname, router]);

  // --- THIS RETURN STATEMENT WAS MISSING ---
  const value = { user, loading };
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; // <-- The AuthProvider component ends here.

// --- THE useAuth HOOK WAS MOVED OUTSIDE ---
// Create a custom hook for easy access to the context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};