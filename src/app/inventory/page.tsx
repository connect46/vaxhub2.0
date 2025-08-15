"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FinancialPlan, Vaccine, Equipment, InventoryPlan } from '@/types';
import InventoryItemPlanner from '@/components/InventoryItemPlanner';

// MUI Components
import { Box, Button, Typography, Container, CircularProgress, Paper } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

const planningYear = new Date().getFullYear() + 1;

export default function InteractiveInventoryPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [financialPlan, setFinancialPlan] = useState<FinancialPlan | null>(null);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [shipmentPlans, setShipmentPlans] = useState<{ [itemId: string]: { [monthKey: string]: number } }>({});

  useEffect(() => {
    if (!user) return;
    const fetchAllData = async () => {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) { setLoading(false); return; }
      const countryId = userDoc.data().country;

      const planSnap = await getDoc(doc(db, 'financial_plans', `${countryId}_${planningYear}`));
      if (planSnap.exists()) setFinancialPlan(planSnap.data() as FinancialPlan);
      
      const vaccinesSnap = await getDocs(query(collection(db, 'vaccines')));
      setVaccines(vaccinesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vaccine)));
      
      const equipmentSnap = await getDocs(query(collection(db, 'equipment')));
      setEquipment(equipmentSnap.docs.map(d => ({ id: d.id, ...d.data() } as Equipment)));

      const inventoryPlansSnap = await getDocs(query(collection(db, 'inventory_plans'), where("country", "==", countryId)));
      const savedPlans: any = {};
      inventoryPlansSnap.forEach(doc => {
          savedPlans[doc.id] = doc.data().shipments;
      });
      setShipmentPlans(savedPlans);

      setLoading(false);
    };
    fetchAllData();
  }, [user]);

  const handleShipmentsChange = (itemId: string, monthKey: string, value: number) => {
    setShipmentPlans(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], [monthKey]: value }
    }));
  };

  const handleSavePlans = async () => {
    if (!user) return;
    setSaving(true);
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const countryId = userDoc.data()?.country;
    try {
        for (const itemId in shipmentPlans) {
            const docRef = doc(db, 'inventory_plans', itemId);
            const planToSave: Partial<InventoryPlan> = {
                country: countryId,
                lastUpdated: Timestamp.now(),
                shipments: shipmentPlans[itemId]
            };
            await setDoc(docRef, planToSave, { merge: true });
        }
        alert('Inventory plans saved successfully!');
    } catch (error) {
        console.error("Error saving plans: ", error);
    } finally {
        setSaving(false);
    }
  };

  // This is the main data processing logic
  const processedFinancialData = useMemo(() => {
    if (!financialPlan) return [];
    
    const monthlyEquipmentDemand: {[eqId: string]: number[]} = {};
    const constrainedVaccineForecasts = financialPlan.constrainedForecast?.forecasts.filter(f => vaccines.some(v => v.id === f.id)) || [];

    constrainedVaccineForecasts.forEach(forecast => {
        const vaccine = vaccines.find(v => v.id === forecast.id);
        if (!vaccine) return;

        const monthlyAdminDoses = (forecast.constrainedAdmin || 0) / 12;
        const monthlyWastageDoses = (forecast.constrained || 0) / 12;
        const monthlyVials = vaccine.dosesPerVial > 0 ? monthlyWastageDoses / vaccine.dosesPerVial : 0;
        
        if (vaccine.administrationSyringeId) {
            if(!monthlyEquipmentDemand[vaccine.administrationSyringeId]) monthlyEquipmentDemand[vaccine.administrationSyringeId] = Array(12).fill(0);
            for(let i=0; i<12; i++) monthlyEquipmentDemand[vaccine.administrationSyringeId][i] += monthlyAdminDoses;
        }
        if (vaccine.dilutionSyringeId) {
            if(!monthlyEquipmentDemand[vaccine.dilutionSyringeId]) monthlyEquipmentDemand[vaccine.dilutionSyringeId] = Array(12).fill(0);
            for(let i=0; i<12; i++) monthlyEquipmentDemand[vaccine.dilutionSyringeId][i] += monthlyVials;
        }
    });
    
    const safetyBox = equipment.find(e => e.equipmentType === 'Safety box');
    if(safetyBox) {
        if(!monthlyEquipmentDemand[safetyBox.id]) monthlyEquipmentDemand[safetyBox.id] = Array(12).fill(0);
        const safetyFactor = 1 + ((safetyBox.safetyFactor || 0) / 100);
        const capacity = safetyBox.disposalCapacity || 1;
        for(let i=0; i<12; i++) {
            let totalSyringesForMonth = 0;
            Object.keys(monthlyEquipmentDemand).forEach(eqId => {
                const eq = equipment.find(e => e.id === eqId);
                if (eq?.equipmentType.includes('Syringe')) {
                    totalSyringesForMonth += monthlyEquipmentDemand[eqId][i];
                }
            });
            monthlyEquipmentDemand[safetyBox.id][i] = totalSyringesForMonth / (capacity * safetyFactor);
        }
    }
    
    const allItems = [...vaccines, ...equipment];
    return allItems.map(item => {
        const isVaccine = 'vaccineName' in item;
        const constrainedData = financialPlan.constrainedForecast?.forecasts.find(f => f.id === item.id);
        const boyInput = isVaccine ? financialPlan.vaccineInputs[item.id] : financialPlan.equipmentInputs[item.id];
        const derivedUsage = financialPlan.calculatedEquipmentUsage?.[item.id] || 0;
        const usage = isVaccine ? (boyInput?.expUsage || 0) : derivedUsage;

        return {
            id: item.id,
            name: isVaccine ? item.vaccineName : item.equipmentName,
            boyInventory: (boyInput?.onHand || 0) + (boyInput?.expShipments || 0) - usage,
            monthlyDemand: isVaccine ? Array(12).fill((constrainedData?.constrained || 0) / 12) : (monthlyEquipmentDemand[item.id] || Array(12).fill(0)),
            minInventoryMOS: isVaccine ? (item as Vaccine).minInventory || 1.5 : 1.5,
            maxInventoryMOS: isVaccine ? (item as Vaccine).maxInventory || 3.0 : 3.0,
            procurementLimit: financialPlan.proposedProcurement?.[item.id] || 0,
        };
    });
  }, [financialPlan, vaccines, equipment]);

  return (
    <ProtectedRoute>
      <Container maxWidth="xl">
        <Box sx={{ my: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" component="h1">Interactive Inventory Planning</Typography>
            <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleSavePlans} disabled={saving}>
              {saving ? <CircularProgress size={24}/> : 'Save All Plans'}
            </Button>
          </Box>

          {loading ? <CircularProgress /> : !financialPlan ? (
            <Paper sx={{p:3}}><Typography color="error">A Financial Plan for {planningYear} must be created and saved before planning inventory.</Typography></Paper>
          ) : (
            <Box>
              {processedFinancialData.map(data => (
                  <InventoryItemPlanner 
                    key={data.id} 
                    itemName={data.name} 
                    boyInventory={data.boyInventory}
                    monthlyDemand={data.monthlyDemand}
                    minInventoryMOS={data.minInventoryMOS}
                    maxInventoryMOS={data.maxInventoryMOS}
                    procurementLimit={data.procurementLimit}
                    shipments={shipmentPlans[data.id] || {}}
                    onShipmentsChange={(monthKey, value) => handleShipmentsChange(data.id, monthKey, value)}
                  />
              ))}
            </Box>
          )}
        </Box>
      </Container>
    </ProtectedRoute>
  );
}