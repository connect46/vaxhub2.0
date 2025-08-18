"use client";

import Link from 'next/link';
import { Container, Box, Typography, Button, SvgIcon } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { BeakerIcon } from '@heroicons/react/24/solid'; // Using a thematic icon

export default function HomePage() {
  return (
    <Container maxWidth="md">
      <Box
        sx={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <SvgIcon 
          component={BeakerIcon} 
          inheritViewBox
          sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} 
        />
        
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontWeight: 700,
            fontSize: { xs: '3rem', sm: '4rem', md: '5rem' },
            // Create a gradient text effect
            background: (theme) => `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.light} 90%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          VaxHub
        </Typography>

        <Typography
          variant="h5"
          component="h2"
          color="text.secondary"
          sx={{ mt: 2, mb: 4 }}
        >
          Global vaccination supply chain management
        </Typography>

        <Button
          component={Link}
          href="/login"
          variant="contained"
          size="large"
          startIcon={<LoginIcon />}
        >
          Login
        </Button>
      </Box>
    </Container>
  );
}