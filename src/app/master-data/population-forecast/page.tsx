import ProtectedRoute from "@/components/ProtectedRoute";
import Demographics from "@/components/Demographics"; // Import our new component

// Import MUI components
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Demographics
          </Typography>
          
          {/* Render the Demographics component here */}
          <Demographics />

        </Box>
      </Container>
    </ProtectedRoute>
  );
}