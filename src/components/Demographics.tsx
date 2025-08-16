"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// MUI Components
import {
  Box, Button, Paper, TextField, Typography, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, InputAdornment, IconButton, Divider
} from '@mui/material';
import Grid from '@mui/material/Grid';
// MUI Icons
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';


// --- NEW: Define a type for our Target Group data ---
interface TargetGroup {
  id: string; // Use for React key, can be a temporary unique ID
  name: string;
  ageLower: number | string; // Use string to allow empty input
  ageUpper: number | string;
  percentage: number | string;
}

interface Projection {
  year: number;
  population: number;
}

export default function Demographics() {
  const { user } = useAuth();
  const [countryId, setCountryId] = useState<string | null>(null);
  const [countryName, setCountryName] = useState('');
  const [basePopulation, setBasePopulation] = useState<number>(0);
  const [growthRate, setGrowthRate] = useState<number>(0);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- NEW: State for managing Target Groups ---
  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([]);
  const [newGroup, setNewGroup] = useState<Omit<TargetGroup, 'id'>>({
    name: '',
    ageLower: '',
    ageUpper: '',
    percentage: ''
  });

  // 1. Fetch data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const userCountryId = userData.country;
          if (userCountryId) {
            setCountryId(userCountryId);
            const countryDocRef = doc(db, 'countries', userCountryId);
            const countryDocSnap = await getDoc(countryDocRef);
            if (countryDocSnap.exists()) {
              const countryData = countryDocSnap.data();
              setCountryName(countryData.name);
              setBasePopulation(countryData.population || 0);
              setGrowthRate(countryData.annualGrowthRate || 0);
              setProjections(countryData.projections || []);
              // --- NEW: Fetch target groups ---
              setTargetGroups(countryData.targetGroups || []);
            }
          }
        }
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // 2. Recalculate projections when base data changes
  useEffect(() => {
    // Only auto-calculate if projections haven't been manually set/loaded
    if (basePopulation > 0 && growthRate > 0 && projections.length === 0) {
      const startYear = new Date().getFullYear();
      let currentPopulation = basePopulation;
      const newProjections: Projection[] = [];

      for (let i = 0; i < 5; i++) {
        currentPopulation = currentPopulation * (1 + growthRate);
        newProjections.push({
          year: startYear + i + 1,
          population: Math.round(currentPopulation),
        });
      }
      setProjections(newProjections);
    }
  }, [basePopulation, growthRate, projections.length]);

  // Handler for editing a projection in the table
  const handleProjectionChange = (year: number, value: string) => {
    // FORMATTING FIX: Remove commas before parsing to a number
    const newPopulation = parseInt(value.replace(/,/g, ''), 10) || 0;
    setProjections(prevProjections => 
      prevProjections.map(p => p.year === year ? { ...p, population: newPopulation } : p)
    );
  };

  // --- NEW: Handlers for adding and removing target groups ---
  const handleAddGroup = () => {
    if (!newGroup.name) {
      alert('Group name is required.');
      return;
    }
    const newGroupToAdd: TargetGroup = {
      id: new Date().getTime().toString(), // Simple unique ID for client-side key
      name: newGroup.name,
      ageLower: Number(newGroup.ageLower) || 0,
      ageUpper: Number(newGroup.ageUpper) || 0,
      percentage: Number(newGroup.percentage) || 0,
    };
    setTargetGroups([...targetGroups, newGroupToAdd]);
    // Reset the input form
    setNewGroup({ name: '', ageLower: '', ageUpper: '', percentage: '' });
  };

  const handleRemoveGroup = (idToRemove: string) => {
    setTargetGroups(targetGroups.filter(group => group.id !== idToRemove));
  };
  
  // Update state for the "new group" input fields
  const handleNewGroupChange = (field: keyof Omit<TargetGroup, 'id'>, value: string) => {
    setNewGroup(prev => ({...prev, [field]: value}));
  };

  // 3. Save ALL data back to Firestore
  const handleSave = async () => {
    if (!countryId) return;
    setSaving(true);
    try {
      const countryDocRef = doc(db, 'countries', countryId);
      await setDoc(countryDocRef, {
        name: countryName,
        population: basePopulation,
        annualGrowthRate: growthRate,
        projections: projections,
        targetGroups: targetGroups, // <-- NEW: Save target groups
      }, { merge: true });
      alert('Demographics saved successfully!');
    } catch (error) {
      console.error("Error saving data: ", error);
      alert('Error saving data.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CircularProgress sx={{ display: 'block', margin: 'auto', mt: 4 }} />;
  }
  
  return (
    <Paper elevation={3} sx={{ p: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Demographics for {countryName}
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Base Population"
            type="text" // Change to text to allow for commas
            // FORMATTING FIX: Display number with commas
            value={basePopulation.toLocaleString()}
            // FORMATTING FIX: Remove commas before updating state
            onChange={(e) => setBasePopulation(Number(e.target.value.replace(/,/g, '')))}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Annual Growth Rate"
            type="number"
            // FORMATTING FIX: Display decimal as percentage
            value={growthRate * 100}
            // FORMATTING FIX: Convert percentage back to decimal for state
            onChange={(e) => setGrowthRate(Number(e.target.value) / 100)}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
          />
        </Grid>
      </Grid>
      
      <Typography variant="h6" component="h3" gutterBottom>
        5-Year Population Forecast
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Year</TableCell>
              <TableCell align="right">Projected Population</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projections.map((proj) => (
              <TableRow key={proj.year}>
                <TableCell>{proj.year}</TableCell>
                <TableCell align="right">
                  <TextField
                    variant="standard"
                    type="text" // Change to text to allow for commas
                    // FORMATTING FIX: Display number with commas
                    value={proj.population.toLocaleString()}
                    onChange={(e) => handleProjectionChange(proj.year, e.target.value)}
                    sx={{ input: { textAlign: "right" } }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 4 }} />

      {/* --- NEW: Target Groups Section --- */}
      <Box>
        <Typography variant="h6" component="h3" gutterBottom>
          Population Target Groups
        </Typography>
        <TableContainer component={Paper} variant="outlined">
            <Table size="small">
            <TableHead>
                <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Age (Lower)</TableCell>
                <TableCell align="right">Age (Upper)</TableCell>
                <TableCell align="right">% of Population</TableCell>
                {/* --- NEW COLUMN HEADER --- */}
                <TableCell align="right">Calculated Population</TableCell>
                <TableCell align="center">Actions</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {targetGroups.map((group) => {
                // --- NEW: Real-time calculation ---
                const calculatedPopulation = Math.round(basePopulation * (Number(group.percentage) / 100));

                return (
                    <TableRow key={group.id}>
                    <TableCell>{group.name}</TableCell>
                    <TableCell align="right">{group.ageLower}</TableCell>
                    <TableCell align="right">{group.ageUpper}</TableCell>
                    <TableCell align="right">{group.percentage}%</TableCell>
                    {/* --- NEW CALCULATED CELL --- */}
                    <TableCell align="right">
                        {/* Display the calculated number with comma separators */}
                        {calculatedPopulation.toLocaleString()}
                    </TableCell>
                    <TableCell align="center">
                        <IconButton size="small" onClick={() => handleRemoveGroup(group.id)}>
                        <DeleteIcon />
                        </IconButton>
                    </TableCell>
                    </TableRow>
                );
                })}
                {/* Row for adding a new group */}
                <TableRow>
                <TableCell>
                    <TextField variant="standard" size="small" placeholder="e.g., Surviving Infants" value={newGroup.name} onChange={(e) => handleNewGroupChange('name', e.target.value)} />
                </TableCell>
                <TableCell align="right">
                    <TextField variant="standard" size="small" type="number" value={newGroup.ageLower} onChange={(e) => handleNewGroupChange('ageLower', e.target.value)} sx={{maxWidth: 80}}/>
                </TableCell>
                <TableCell align="right">
                    <TextField variant="standard" size="small" type="number" value={newGroup.ageUpper} onChange={(e) => handleNewGroupChange('ageUpper', e.target.value)} sx={{maxWidth: 80}}/>
                </TableCell>
                <TableCell align="right">
                    <TextField variant="standard" size="small" type="number" value={newGroup.percentage} onChange={(e) => handleNewGroupChange('percentage', e.target.value)} sx={{maxWidth: 80}} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                </TableCell>
                {/* Add an empty cell to align with the new column */}
                <TableCell />
                <TableCell align="center">
                    <Button variant="contained" size="small" startIcon={<AddCircleOutlineIcon />} onClick={handleAddGroup}>Add</Button>
                </TableCell>
                </TableRow>
            </TableBody>
            </Table>
        </TableContainer>
      </Box>

      <Box sx={{ mt: 4, textAlign: 'right' }}>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={24} /> : 'Save Demographics'}
        </Button>
      </Box>
    </Paper>
  );
}