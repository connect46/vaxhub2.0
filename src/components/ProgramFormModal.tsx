"use client";

import { useState, useEffect } from 'react';
import { Program, ProgramVaccine, Vaccine } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection, onSnapshot, Timestamp } from 'firebase/firestore';
import dayjs, { Dayjs } from 'dayjs';

// MUI Components & Date Pickers
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Grid, Box, CircularProgress, Typography, Divider, FormControl, InputLabel, Select, MenuItem, IconButton, Paper, InputAdornment } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';

// Define a type for the Target Groups we fetch from the country document
interface TargetGroup {
  id: string;
  name: string;
}

interface ProgramFormModalProps {
  open: boolean;
  onClose: () => void;
  program: Program | null;
}

const initialFormState = {
  programCategory: 'Routine',
  programName: '',
  startDate: null as Dayjs | null,
  endDate: null as Dayjs | null,
};

export default function ProgramFormModal({ open, onClose, program }: ProgramFormModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialFormState);
  const [programVaccines, setProgramVaccines] = useState<ProgramVaccine[]>([]);

  // State for populating dropdowns
  const [availableVaccines, setAvailableVaccines] = useState<Vaccine[]>([]);
  const [availableTargetGroups, setAvailableTargetGroups] = useState<TargetGroup[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [selectedVaccineToAdd, setSelectedVaccineToAdd] = useState('');

  // Effect to fetch master data (vaccines, target groups)
  useEffect(() => {
    if (!user) return;

    // Fetch all vaccines
    const unsubVaccines = onSnapshot(collection(db, 'vaccines'), (snapshot) => {
      setAvailableVaccines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vaccine)));
    });

    // Fetch target groups from the user's country document
    const fetchTargetGroups = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const countryId = userDoc.data().country;
        if (countryId) {
          const countryDoc = await getDoc(doc(db, 'countries', countryId));
          if (countryDoc.exists()) {
            setAvailableTargetGroups(countryDoc.data().targetGroups || []);
          }
        }
      }
    };
    fetchTargetGroups();
    
    return () => unsubVaccines();
  }, [user]);

  // Effect to populate form when editing an existing program
  useEffect(() => {
    if (program) {
      setFormData({
        programCategory: program.programCategory,
        programName: program.programName,
        startDate: program.startDate ? dayjs(program.startDate.toDate()) : null,
        endDate: program.endDate ? dayjs(program.endDate.toDate()) : null,
      });
      setProgramVaccines(program.vaccines || []);
    } else {
      setFormData(initialFormState);
      setProgramVaccines([]);
    }
  }, [program, open]);

  const handleAddVaccine = () => {
    const vaccine = availableVaccines.find(v => v.id === selectedVaccineToAdd);
    if (!vaccine || programVaccines.some(pv => pv.vaccineId === vaccine.id)) return;

    const newProgramVaccine: ProgramVaccine = {
      vaccineId: vaccine.id,
      vaccineName: vaccine.vaccineName,
      dosesInSchedule: vaccine.dosesInSchedule,
      doseAssignments: {}, // Start with empty assignments
    };
    setProgramVaccines([...programVaccines, newProgramVaccine]);
    setSelectedVaccineToAdd(''); // Reset dropdown
  };

  // --- UPDATED: More flexible handler for dose assignment changes ---
  const handleDoseAssignmentChange = (vaccineId: string, doseNumber: number, field: keyof DoseAssignment, value: string) => {
    setProgramVaccines(prev => prev.map(pv => {
      if (pv.vaccineId === vaccineId) {
        const currentAssignment = pv.doseAssignments[doseNumber] || { targetGroupId: '', coverageRate: 0, wastageRate: 0 };
        let processedValue: string | number = value;
        if (field === 'coverageRate' || field === 'wastageRate') {
            processedValue = Number(value) / 100; // Convert percentage to decimal
        }
        const updatedAssignment = { ...currentAssignment, [field]: processedValue };
        return { ...pv, doseAssignments: { ...pv.doseAssignments, [doseNumber]: updatedAssignment } };
      }
      return pv;
    }));
  };
  
  const handleRemoveVaccine = (vaccineId: string) => {
    setProgramVaccines(prev => prev.filter(pv => pv.vaccineId !== vaccineId));
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const countryId = userDoc.data()?.country;
    if (!countryId) {
        alert("Error: User country not found.");
        setLoading(false);
        return;
    }

    const dataToSave = {
      ...formData,
      country: countryId,
      startDate: formData.startDate ? Timestamp.fromDate(formData.startDate.toDate()) : null,
      endDate: formData.endDate ? Timestamp.fromDate(formData.endDate.toDate()) : null,
      vaccines: programVaccines,
    };

    try {
      if (program?.id) {
        await setDoc(doc(db, 'programs', program.id), dataToSave, { merge: true });
      } else {
        await addDoc(collection(db, 'programs'), dataToSave);
      }
      onClose();
    } catch (error) {
      console.error("Error saving program: ", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{program?.id ? 'Edit Program' : 'Add New Program'}</DialogTitle>
      <DialogContent>
        {/* --- Part A: Basic Program Info --- */}
        <Typography variant="h6" sx={{ mt: 2 }}>Program Details</Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select value={formData.programCategory} label="Category" onChange={(e) => setFormData(p => ({...p, programCategory: e.target.value as any}))}>
                        <MenuItem value="Routine">Routine</MenuItem>
                        <MenuItem value="Catchup">Catchup</MenuItem>
                        <MenuItem value="SIA">SIA</MenuItem>
                    </Select>
                </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Program Name" value={formData.programName} onChange={(e) => setFormData(p => ({...p, programName: e.target.value}))} /></Grid>
            <Grid item xs={12} sm={6}><DatePicker label="Start Date" value={formData.startDate} onChange={(date) => setFormData(p => ({...p, startDate: date}))} sx={{ width: '100%' }}/></Grid>
            <Grid item xs={12} sm={6}><DatePicker label="End Date" value={formData.endDate} onChange={(date) => setFormData(p => ({...p, endDate: date}))} sx={{ width: '100%' }}/></Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* --- Part B & C: Add Vaccines and Assign Target Groups --- */}
        <Typography variant="h6">Vaccines in Program</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2, mb: 3 }}>
            <FormControl fullWidth>
                <InputLabel>Select a Vaccine to Add</InputLabel>
                <Select value={selectedVaccineToAdd} label="Select a Vaccine to Add" onChange={(e) => setSelectedVaccineToAdd(e.target.value)}>
                    {availableVaccines.map(v => <MenuItem key={v.id} value={v.id}>{v.vaccineName}</MenuItem>)}
                </Select>
            </FormControl>
            <Button variant="outlined" onClick={handleAddVaccine} startIcon={<AddCircleOutlineIcon />}>Add</Button>
        </Box>

        {programVaccines.map(pv => (
          <Paper key={pv.vaccineId} variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">{pv.vaccineName}</Typography>
              <IconButton onClick={() => handleRemoveVaccine(pv.vaccineId)}><DeleteIcon /></IconButton>
            </Box>
            
            {[...Array(pv.dosesInSchedule)].map((_, i) => {
                const doseNumber = i + 1;
                const assignment = pv.doseAssignments[doseNumber] || {};
                return (
                  <Grid container spacing={2} key={doseNumber} sx={{ alignItems: 'center', mb: 2 }}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Dose {doseNumber} Target Group</InputLabel>
                        <Select 
                          value={assignment.targetGroupId || ''} 
                          label={`Dose ${doseNumber} Target Group`}
                          onChange={(e) => handleDoseAssignmentChange(pv.vaccineId, doseNumber, 'targetGroupId', e.target.value)}
                        >
                          {availableTargetGroups.map(tg => <MenuItem key={tg.id} value={tg.id}>{tg.name}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth label="Coverage" type="number" 
                        value={(assignment.coverageRate || 0) * 100}
                        onChange={(e) => handleDoseAssignmentChange(pv.vaccineId, doseNumber, 'coverageRate', e.target.value)}
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth label="Wastage" type="number" 
                        value={(assignment.wastageRate || 0) * 100}
                        onChange={(e) => handleDoseAssignmentChange(pv.vaccineId, doseNumber, 'wastageRate', e.target.value)}
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                      />
                    </Grid>
                  </Grid>
                );
              })}
          </Paper>
        ))}

      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Save Program'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}