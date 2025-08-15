// src/components/ThemeRegistry.tsx
'use client';

import * as React from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import NextAppDirEmotionCacheProvider from './EmotionCache';
import { Inter } from 'next/font/google'; // <-- Import the font

// Configure the font
const inter = Inter({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

// --- THIS IS THE THEME CONFIGURATION ---
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#00529B', // A professional blue
    },
    secondary: {
      main: '#64B5F6', // A lighter blue for accents
    },
  },
  typography: {
    fontFamily: inter.style.fontFamily, // <-- Apply the font
  },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <NextAppDirEmotionCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </NextAppDirEmotionCacheProvider>
  );
}