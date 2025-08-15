"use client"; // We need this to use hooks

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation"; // Next.js's router hook
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If the user is already logged in, redirect them to the homepage
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Show a loading indicator while auth state is being checked
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  // If user is not logged in, show the login form
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <AuthForm />
        </div>
      </div>
    );
  }

  // This will be shown briefly during the redirect
  return null;
}