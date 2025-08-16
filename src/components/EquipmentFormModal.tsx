"use client";

import { useState, useEffect } from 'react';
import { Equipment } from '@/types';
import { db } from '@/lib/firebase';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';

// MUI Components
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, CircularProgress, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

interface EquipmentFormModalProps {
  open: boolean;
  onClose: () => void;
  equipment: Partial<Equipment> | null;
}

const initialFormState: Omit<Equipment, 'id'> = {
  equipmentName: '',
  equipmentType: 'Administration Syringe (ADS)',
  equipmentCode: '',
  equipmentUnits: 0,
  equipmentCost: 0,
  equipmentFreight: 0,
  disposalCapacity: 0,
  safetyFactor: 0,
};

export default function EquipmentFormModal({ open, onClose, equipment }: EquipmentFormModalProps) {
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (equipment) {
      setFormData({ ...initialFormState, ...equipment });
    } else {
      setFormData(initialFormState);
    }
  }, [equipment, open]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value, type } = event.target as HTMLInputElement;
    setFormData(prev => ({ ...prev, [name!]: type === 'number' ? Number(value) : value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const dataToSave = { ...formData };
      if (dataToSave.equipmentType !== 'Safety box') {
        delete dataToSave.disposalCapacity;
        delete dataToSave.safetyFactor;
      }

      if (equipment?.id) {
        await setDoc(doc(db, 'equipment', equipment.id), dataToSave, { merge: true });
      } else {
        await addDoc(collection(db, 'equipment'), dataToSave);
      }
      onClose();
    } catch (error) {
      console.error("Error saving equipment: ", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{equipment?.id ? 'Edit Equipment' : 'Add New Equipment'}</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1 }}>
            <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}>
              <TextField fullWidth name="equipmentName" label="Name" value={formData.equipmentName} onChange={handleChange} />
            </Box>
            <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select name="equipmentType" value={formData.equipmentType} label="Type" onChange={handleChange as any}>
                  <MenuItem value="Administration Syringe (ADS)">Administration Syringe (ADS)</MenuItem>
                  <MenuItem value="Dilution Syringe">Dilution Syringe</MenuItem>
                  <MenuItem value="Safety box">Safety box</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}><TextField fullWidth name="equipmentCode" label="Code" value={formData.equipmentCode} onChange={handleChange} /></Box>
            <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}><TextField fullWidth name="equipmentUnits" label="Units (per box)" type="number" value={formData.equipmentUnits} onChange={handleChange} /></Box>
            <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}><TextField fullWidth name="equipmentCost" label="Cost (per box)" type="number" value={formData.equipmentCost} onChange={handleChange} /></Box>
            <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}><TextField fullWidth name="equipmentFreight" label="Freight (per box)" type="number" value={formData.equipmentFreight} onChange={handleChange} /></Box>
            
            {/* --- Conditional Fields for Safety Box --- */}
            {formData.equipmentType === 'Safety box' && (
              <>
                <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}><TextField fullWidth name="disposalCapacity" label="Disposal Capacity (syringes/box)" type="number" value={formData.disposalCapacity} onChange={handleChange} /></Box>
                <Box sx={{ p: 1, width: { xs: '100%', sm: '50%' } }}><TextField fullWidth name="safetyFactor" label="Safety Factor (%)" type="number" value={formData.safetyFactor} onChange={handleChange} /></Box>
              </>
            )}
            </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Save Equipment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}