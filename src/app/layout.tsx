// src/app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers"; // <-- Import our new Providers component
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Box from "@mui/material/Box";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VaxHub",
  description: "Vaccine Planning Application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers> {/* <-- Use the single Providers component */}
          <Box sx={{ display: 'flex' }}>
            <Sidebar />
            <Box component="main" sx={{ flexGrow: 1 }}>
              <TopBar />
              <Box sx={{ p: 3 }}>
                {children}
              </Box>
            </Box>
          </Box>
        </Providers>
      </body>
    </html>
  );
}