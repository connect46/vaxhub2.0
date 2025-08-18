"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

// Import MUI components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { setDoc, doc } from "firebase/firestore";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        // Login success is now handled by the AuthProvider's automatic redirect
      } else {
        // --- THIS IS THE CORRECTED SIGN-UP LOGIC ---
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        // This crucial step creates the user's profile in the Firestore 'users' collection
        await setDoc(doc(db, "users", newUser.uid), {
          email: newUser.email,
          role: "country_lead", // Assign a default role
          country: null,       // Country is null until they complete the next step
        });
        // The AuthProvider will now automatically redirect them to /profile-setup
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Typography component="h1" variant="h5">
        {isLogin ? "Sign in" : "Create an account"}
      </Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label="Email Address"
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label="Password"
          type="password"
          id="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        
        {error && <Alert severity="error" sx={{ mt: 2, width: '100%' }}>{error}</Alert>}

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
          sx={{ mt: 3, mb: 2 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : (isLogin ? "Sign In" : "Create Account")}
        </Button>
        
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={() => {
            setIsLogin(!isLogin);
            setError(null);
          }}
          sx={{ textAlign: 'center' }}
        >
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
        </Link>
      </Box>
    </Box>
  );
}