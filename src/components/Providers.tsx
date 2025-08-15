// src/components/Providers.tsx

"use client";

import { AuthProvider } from "@/context/AuthContext";
import ThemeRegistry from "@/components/ThemeRegistry";

// Import the date provider components
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </LocalizationProvider>
    </ThemeRegistry>
  );
}