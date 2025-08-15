"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Import MUI components
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';

export default function AddNoteForm() {
  const { user } = useAuth();
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || noteText.trim() === '') return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'notes'), {
        text: noteText,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      setNoteText('');
    } catch (error) {
      console.error("Error adding document: ", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Add a New Note
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          multiline
          rows={4}
          label="Your Note"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          variant="outlined"
        />
        <Button
          type="submit"
          disabled={loading}
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
        >
          {loading ? 'Adding...' : 'Add Note'}
        </Button>
      </Box>
    </Paper>
  );
}