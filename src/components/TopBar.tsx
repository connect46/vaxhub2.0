"use client";

import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

// Import MUI components and icons
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LogoutIcon from '@mui/icons-material/Logout';

export default function TopBar() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <AppBar position="static" color="default" elevation={1} sx={{ backgroundColor: 'white' }}>
      <Toolbar>
        {/* This Box will push the user info to the right */}
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {/* You can add a page title here later if you want */}
        </Typography>

        {user ? (
          // If user is logged in, show their email and a Log Out button
          <>
            <Typography variant="body1" sx={{ mr: 2 }}>
              {user.email}
            </Typography>
            <Button 
              color="inherit" 
              onClick={handleLogout} 
              startIcon={<LogoutIcon />}
            >
              Logout
            </Button>
          </>
        ) : (
          // If no user, you can show a login button or nothing
          <Button color="inherit" href="/login">Login</Button>
        )}
      </Toolbar>
    </AppBar>
  );
}