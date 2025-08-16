"use client";

import { useState, useEffect } from 'react';
import { Vaccine, Equipment } from '@/types'; // <-- Import Equipment type
import { db } from '@/lib/firebase';
import { 
  doc, setDoc, addDoc, collection, 
  query, where, onSnapshot // <-- Import query and onSnapshot
} from 'firebase/firestore';

// MUI Components
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, 
    Button, Box, CircularProgress, Typography, InputAdornment, 
    Divider, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent
} from '@mui/material';

interface VaccineFormModalProps {
  open: boolean;
  onClose: () => void;
  vaccine: Partial<Vaccine> | null;
}

const initialFormState: Omit<Vaccine, 'id'> = {
  vaccineName: '', vaccineType: '', dosesInSchedule: 0, pricePerDose: 0,
  vialSize: 0, dosesPerVial: 0, volumePerDose: 0, vialsPerBox: 0,
  procurementLeadTime: 0, administrationSyringeId: '', dilutionSyringeId: '',
  bufferStock: 0, minInventory: 0, absMinInventory: 0, maxInventory: 0,
};

export default function VaccineFormModal({ open, onClose, vaccine }: VaccineFormModalProps) {
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  
  // --- NEW: State to hold the list of available syringes ---
  const [syringes, setSyringes] = useState<Equipment[]>([]);

  // --- NEW: useEffect to fetch syringe data from Firestore ---
  useEffect(() => {
    // Query for equipment that is a type of syringe
    const q = query(
      collection(db, "equipment"), 
      where("equipmentType", "in", ["Administration Syringe (ADS)", "Dilution Syringe"])
    );

    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const syringesData: Equipment[] = [];
      querySnapshot.forEach((doc) => {
        syringesData.push({ id: doc.id, ...doc.data() } as Equipment);
      });
      setSyringes(syringesData);
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, []); // Empty dependency array means this runs once when the component mounts

  useEffect(() => {
    if (vaccine) {
      setFormData({ ...initialFormState, ...vaccine });
    } else {
      setFormData(initialFormState);
    }
  }, [vaccine, open]);

  // ... (handleChange and handleSave functions are unchanged)
  const handleChange = (event: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }> | SelectChangeEvent) => {
    const { name, value } = event.target;
    const id = name as keyof typeof initialFormState;
    const isWholeNumber = ['dosesInSchedule', 'dosesPerVial', 'vialsPerBox', 'procurementLeadTime'].includes(id);
    let finalValue = value;
    if (typeof value === 'string') {
        const numericValue = isWholeNumber ? parseInt(value, 10) : parseFloat(value);
        if (!isNaN(numericValue)) { finalValue = numericValue; }
    }
    setFormData(prev => ({ ...prev, [id]: finalValue }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (vaccine?.id) {
        await setDoc(doc(db, 'vaccines', vaccine.id), formData, { merge: true });
      } else {
        await addDoc(collection(db, 'vaccines'), formData);
      }
      onClose();
    } catch (error) { console.error("Error saving vaccine: ", error); } 
    finally { setLoading(false); }
  };

  // const renderTextField = (id: keyof typeof initialFormState, label: string, props: object = {}) => (
  //   <Grid item xs={12} sm={6} md={4}>
  //     <TextField fullWidth name={id} label={label} type="number" value={formData[id]} onChange={handleChange} variant="outlined" size="small" {...props} />
  //   </Grid>
  // );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{vaccine?.id ? 'Edit Vaccine' : 'Add New Vaccine'}</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ mt: 2 }}>
          {/* --- General Information Section --- */}
          <Typography variant="h6" gutterBottom>General Information</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1 }}>
              <Box sx={{ p: 1, width: '100%' }}><TextField fullWidth name="vaccineName" label="Vaccine Name" type="text" value={formData.vaccineName} onChange={handleChange} variant="outlined" size="small" /></Box>
              <Box sx={{ p: 1, width: { xs: '100%', md: '50%' } }}><TextField fullWidth name="vaccineType" label="Vaccine Type" type="text" value={formData.vaccineType} onChange={handleChange} variant="outlined" size="small" /></Box>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%', md: '33.33%' } }}><TextField fullWidth name="dosesInSchedule" label="Doses in Schedule" type="number" value={formData.dosesInSchedule} onChange={handleChange} variant="outlined" size="small" inputProps={{ step: 1 }} /></Box>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%', md: '33.33%' } }}><TextField fullWidth name="pricePerDose" label="Price per Dose" type="number" value={formData.pricePerDose} onChange={handleChange} variant="outlined" size="small" InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} /></Box>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%', md: '33.33%' } }}><TextField fullWidth name="vialSize" label="Vial Size" type="number" value={formData.vialSize} onChange={handleChange} variant="outlined" size="small" InputProps={{ endAdornment: <InputAdornment position="end">ml</InputAdornment> }} /></Box>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%', md: '33.33%' } }}><TextField fullWidth name="dosesPerVial" label="Doses per Vial" type="number" value={formData.dosesPerVial} onChange={handleChange} variant="outlined" size="small" inputProps={{ step: 1 }} /></Box>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%', md: '33.33%' } }}><TextField fullWidth name="volumePerDose" label="Volume per Dose (cm³)" type="number" value={formData.volumePerDose} onChange={handleChange} variant="outlined" size="small" /></Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* --- Packaging and Procurement Section --- */}
          <Typography variant="h6" gutterBottom>Packaging & Procurement</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1 }}>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}><TextField fullWidth name="vialsPerBox" label="Vials per Box" type="number" value={formData.vialsPerBox} onChange={handleChange} variant="outlined" size="small" inputProps={{ step: 1 }} /></Box>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}><TextField fullWidth name="procurementLeadTime" label="Lead Time (Days)" type="number" value={formData.procurementLeadTime} onChange={handleChange} variant="outlined" size="small" inputProps={{ step: 1 }} /></Box>
          </Box>
          
          <Divider sx={{ my: 3 }} />

          {/* --- Ancillary Equipment Section --- */}
          <Typography variant="h6" gutterBottom>Ancillary Equipment</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1 }}>
            <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Administration Syringe</InputLabel>
                <Select name="administrationSyringeId" value={formData.administrationSyringeId} label="Administration Syringe" onChange={handleChange}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {syringes.filter(s => s.equipmentType === 'Administration Syringe (ADS)').map(syringe => (
                    <MenuItem key={syringe.id} value={syringe.id}>{syringe.equipmentName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Dilution Syringe</InputLabel>
                <Select name="dilutionSyringeId" value={formData.dilutionSyringeId} label="Dilution Syringe" onChange={handleChange}>
                  <MenuItem value=""><em>None</em></MenuItem>
                  {syringes.filter(s => s.equipmentType === 'Dilution Syringe').map(syringe => (
                    <MenuItem key={syringe.id} value={syringe.id}>{syringe.equipmentName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* --- Default Inventory Parameters Section --- */}
          <Typography variant="h6" gutterBottom>Default Inventory Parameters</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1 }}>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%', md: '25%' } }}><TextField fullWidth name="bufferStock" label="Buffer Stock (MOS)" type="number" value={formData.bufferStock} onChange={handleChange} variant="outlined" size="small" /></Box>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%', md: '25%' } }}><TextField fullWidth name="minInventory" label="Min System Inv. (MOS)" type="number" value={formData.minInventory} onChange={handleChange} variant="outlined" size="small" /></Box>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%', md: '25%' } }}><TextField fullWidth name="absMinInventory" label="Abs. Min Inv. (MOS)" type="number" value={formData.absMinInventory} onChange={handleChange} variant="outlined" size="small" /></Box>
              <Box sx={{ p: 1, width: { xs: '100%', sm: '50%', md: '25%' } }}><TextField fullWidth name="maxInventory" label="Max System Inv. (MOS)" type="number" value={formData.maxInventory} onChange={handleChange} variant="outlined" size="small" /></Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Save Vaccine'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}