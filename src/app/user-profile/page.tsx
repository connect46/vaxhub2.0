"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { UserProfile } from '@/types';
import ProtectedRoute from '@/components/ProtectedRoute';

// MUI Components
import { Box, Button, Typography, Container, CircularProgress, Paper, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';

interface CountryOption {
  id: string; // The 3-letter country code
  name: string;
}

export default function UserProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [displayName, setDisplayName] = useState('');
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      const fetchProfileAndCountries = async () => {
        setLoading(true);
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // FIX: Explicitly cast the data to our UserProfile type
          const data = docSnap.data() as UserProfile;
          setProfile(data);
          setDisplayName(data.displayName || '');
          setSelectedCountry(data.country || '');
        } else {
          // FIX: Safely handle a potentially null email from the auth object
          setProfile({ email: user.email || 'No email found' });
        }

        if (!docSnap.data()?.country) {
          try {
            const querySnapshot = await getDocs(collection(db, 'countries'));
            const countryList = querySnapshot.docs.map((doc) => ({
              id: doc.id,
              // FIX: Tell TypeScript that doc.data().name is a string
              name: doc.data().name as string
            })).sort((a, b) => a.name.localeCompare(b.name));
            setCountries(countryList);
          } catch (error) {
            console.error("Error fetching countries from Firestore:", error);
          }
        }
        setLoading(false);
      };
      fetchProfileAndCountries();
    }
  }, [user]);

  const handleSave = async () => {
    if (!user || (!profile.country && !selectedCountry)) {
      alert("Please select a country.");
      return;
    }
    setSaving(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const dataToSave: any = { displayName };
      if (!profile.country && selectedCountry) {
        dataToSave.country = selectedCountry;
      }
      await setDoc(userDocRef, dataToSave, { merge: true });
      alert("Profile updated successfully!");
      router.push('/dashboard'); // Go to dashboard after initial setup
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CircularProgress sx={{ display: 'block', margin: 'auto', mt: 10 }} />;
  }

  return (
    <ProtectedRoute>
      <Container maxWidth="md">
        <Paper sx={{ mt: 4, p: 4 }}>
          <Typography component="h1" variant="h4" gutterBottom>
            User Profile
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField fullWidth label="Email Address" value={profile.email || ''} InputProps={{ readOnly: true }} variant="filled" />
            <TextField fullWidth label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} variant="outlined" helperText="Your public name."/>
            
            {/* Conditional Country Field */}
            {profile.country ? (
              <TextField fullWidth label="Country" value={profile.country || ''} InputProps={{ readOnly: true }} variant="filled" />
            ) : (
              <FormControl fullWidth>
                <InputLabel>Select Your Country</InputLabel>
                <Select value={selectedCountry} label="Select Your Country" onChange={(e) => setSelectedCountry(e.target.value)}>
                  {countries.map((country) => (
                    <MenuItem key={country.id} value={country.id}>{country.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField fullWidth label="Role" value={profile.role || ''} InputProps={{ readOnly: true }} variant="filled" />
          </Box>
          <Box sx={{ mt: 4, textAlign: 'right' }}>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={24} /> : "Save Profile"}
            </Button>
          </Box>
        </Paper>
      </Container>
    </ProtectedRoute>
  );
}