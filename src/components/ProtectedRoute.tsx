"use client";

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// This component is a "wrapper" that protects routes
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until the loading state is false
    if (!loading) {
      // If there is no user, redirect to the login page
      if (!user) {
        router.push('/login');
      }
    }
  }, [user, loading, router]); // Effect depends on user, loading, and router

  // If authentication is still loading, show a loading message
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  // If there's a user, render the children (the protected page)
  if (user) {
    return <>{children}</>;
  }

  // If no user and not loading (and redirect is in progress), render nothing
  return null;
}