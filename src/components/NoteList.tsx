"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, query, where, onSnapshot, orderBy, Timestamp,
  doc, deleteDoc, updateDoc 
} from 'firebase/firestore';

// Import MUI and MUI Icons
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

interface Note {
  id: string;
  text: string;
  createdAt: Timestamp;
}

export default function NoteList() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    // ... (useEffect logic is unchanged)
    if (user) {
      const q = query(collection(db, "notes"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const notesData: Note[] = [];
        querySnapshot.forEach((doc) => {
          notesData.push({ id: doc.id, ...doc.data() } as Note);
        });
        setNotes(notesData);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleDelete = async (noteId: string) => { /* ... (logic is unchanged) */ 
    try {
      await deleteDoc(doc(db, 'notes', noteId));
    } catch (error) { console.error("Error deleting document: ", error); }
  };

  const handleUpdate = async (noteId: string) => { /* ... (logic is unchanged) */ 
    try {
      await updateDoc(doc(db, 'notes', noteId), { text: editText });
      setEditingNoteId(null);
      setEditText('');
    } catch (error) { console.error("Error updating document: ", error); }
  };
  
  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditText(note.text);
  };

  if (loading) return <p>Loading notes...</p>;

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Your Notes
      </Typography>
      {notes.length === 0 ? (
        <Typography variant="body1">You haven't added any notes yet.</Typography>
      ) : (
        <List>
          {notes.map((note) => (
            <ListItem key={note.id} divider>
              {editingNoteId === note.id ? (
                <Box sx={{ width: '100%' }}>
                  <TextField fullWidth multiline rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <IconButton onClick={() => handleUpdate(note.id)} color="primary"><SaveIcon /></IconButton>
                    <IconButton onClick={() => setEditingNoteId(null)}><CancelIcon /></IconButton>
                  </Box>
                </Box>
              ) : (
                <>
                  <ListItemText primary={note.text} />
                  <IconButton onClick={() => startEditing(note)} edge="end" aria-label="edit"><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDelete(note.id)} edge="end" aria-label="delete"><DeleteIcon /></IconButton>
                </>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}