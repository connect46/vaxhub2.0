"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CombinedForecast, EquipmentForecast, Vaccine, Equipment, FinancialPlanInventoryInput, FinancialPlanFunder, FinancialPlan } from '@/types';

// MUI Components
import { Box, Button, Typography, Container, CircularProgress, Paper, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, TableFooter } from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers';

const planningYear = new Date().getFullYear() + 1;

export default function FinancialPlanningPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // State to hold all fetched data
  const [combinedForecast, setCombinedForecast] = useState<CombinedForecast | null>(null);
  const [equipmentForecast, setEquipmentForecast] = useState<EquipmentForecast | null>(null);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  
  const [asOfDate, setAsOfDate] = useState<Dayjs | null>(null);
  const [vaccineInputs, setVaccineInputs] = useState<{ [id: string]: Partial<FinancialPlanInventoryInput> }>({});
  const [equipmentInputs, setEquipmentInputs] = useState<{ [id: string]: Partial<FinancialPlanInventoryInput> }>({});
  const [vaccineWastageInputs, setVaccineWastageInputs] = useState<{ [id: string]: number }>({});

  const [countryId, setCountryId] = useState<string | null>(null);
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);

  const [proposedProcurement, setProposedProcurement] = useState<{ [id: string]: number | string }>({});

  const handleProposedProcurementChange = (itemId: string, value: string) => {
    setProposedProcurement(prev => ({
      ...prev,
      [itemId]: value, // Keep as string for better input experience
    }));
  };

  useEffect(() => {
    if (!user) return;
    
    const fetchAllData = async () => {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) { setLoading(false); return; }
      
      const userCountryId = userDoc.data().country;
      setCountryId(userCountryId);

      // Your existing block to fetch prerequisites is correct
      const combinedQuery = query(collection(db, 'forecasts_combined'), where("country", "==", userCountryId), orderBy("createdAt", "desc"), limit(1));
      const equipmentQuery = query(collection(db, 'forecasts_equipment'), where("country", "==", userCountryId), orderBy("createdAt", "desc"), limit(1));
      const vaccinesQuery = query(collection(db, 'vaccines'));
      const equipmentMasterQuery = query(collection(db, 'equipment'));

      const [ combinedSnap, equipmentSnap, vaccinesSnap, equipmentMasterSnap ] = await Promise.all([
        getDocs(combinedQuery),
        getDocs(equipmentQuery),
        getDocs(vaccinesQuery),
        getDocs(equipmentMasterQuery),
      ]);

      if (!combinedSnap.empty) setCombinedForecast(combinedSnap.docs[0].data() as CombinedForecast);
      if (!equipmentSnap.empty) {
        const forecastData = equipmentSnap.docs[0].data() as EquipmentForecast;
        
        // --- ADD THIS LINE FOR DEBUGGING ---
        // console.log("Loaded Equipment Forecast:", forecastData);

        setEquipmentForecast(forecastData);
      }
      setVaccines(vaccinesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vaccine)));
      setEquipment(equipmentMasterSnap.docs.map(d => ({ id: d.id, ...d.data() } as Equipment)));
      // End of prerequisite fetching

      // --- THIS IS THE ADDED LOGIC ---
      // This block fetches any previously saved Financial Plan
      const planQuery = doc(db, 'financial_plans', `${userCountryId}_${planningYear}`);
      const planSnap = await getDoc(planQuery);
      if (planSnap.exists()) {
        const planData = planSnap.data() as FinancialPlan;
        setLoadedPlanId(planSnap.id);
        setAsOfDate(planData.inventoryAsOfDate ? dayjs(planData.inventoryAsOfDate.toDate()) : null);
        setVaccineInputs(planData.vaccineInputs || {});
        setEquipmentInputs(planData.equipmentInputs || {});
        setFunders(planData.funders || [{ id: new Date().getTime().toString(), name: 'Govt. Funding', allocation: 100, committed: 0 }]);
        setProposedProcurement(planData.proposedProcurement || {});
      } else {
        // Set default funder if no plan exists
        setFunders([{ id: new Date().getTime().toString(), name: 'Govt. Funding', allocation: 100, committed: 0 }]);
      }
      
      setLoading(false);
    };
    fetchAllData();
  }, [user]);
  
  // --- ADD THIS STATE AND LOGIC ---
  const [funders, setFunders] = useState<FinancialPlanFunder[]>([
    // Start with one default funder
    { id: new Date().getTime().toString(), name: 'Govt. Funding', allocation: 100, committed: 0 }
  ]);

  const handleAddFunder = () => {
    const newFunder: FinancialPlanFunder = {
      id: new Date().getTime().toString(),
      name: '',
      allocation: 0,
      committed: 0
    };
    setFunders([...funders, newFunder]);
  };

  const handleRemoveFunder = (idToRemove: string) => {
    setFunders(funders.filter(f => f.id !== idToRemove));
  };

  const handleFunderChange = (id: string, field: keyof Omit<FinancialPlanFunder, 'id'>, value: string) => {
    const numericValue = Number(value.replace(/,/g, '')) || 0;
    const isName = field === 'name';

    setFunders(funders.map(f => 
      f.id === id ? { ...f, [field]: isName ? value : numericValue } : f
    ));
  };

  // --- Calculate Proposed Budget ---
   // These are for display in the "Proposed Budget" box 

  // This calculates equipment usage for the BOY Inventory table
  const calculatedEquipmentUsage = useMemo(() => {
    const usageMap: { [equipmentId: string]: number } = {};

    vaccines.forEach(vaccine => {
      const inputs = vaccineInputs[vaccine.id] || {};
      const usageDoses = inputs.expUsage || 0;
      const wastageRate = vaccineWastageInputs[vaccine.id] || 0;
      
      if (usageDoses > 0) {
        // Calculate Administration Syringe usage
        if (vaccine.administrationSyringeId) {
          usageMap[vaccine.administrationSyringeId] = (usageMap[vaccine.administrationSyringeId] || 0) + usageDoses;
        }

        // Calculate Dilution Syringe usage
        if (vaccine.dilutionSyringeId && vaccine.dosesPerVial > 0) {
          const dosesWithWastage = usageDoses / (1 - wastageRate);
          const vialsUsed = Math.ceil(usageDoses / vaccine.dosesPerVial);
          usageMap[vaccine.dilutionSyringeId] = (usageMap[vaccine.dilutionSyringeId] || 0) + vialsUsed;
        }
      }
    });

    // --- NEW: Calculate Safety Box Usage ---
    const safetyBox = equipment.find(e => e.equipmentType === 'Safety box');
    if (safetyBox) {
      // Sum all syringes that were calculated
      const totalSyringes = Object.entries(usageMap).reduce((sum, [equipmentId, quantity]) => {
        const eq = equipment.find(e => e.id === equipmentId);
        if (eq && (eq.equipmentType === 'Administration Syringe (ADS)' || eq.equipmentType === 'Dilution Syringe')) {
          return sum + quantity;
        }
        return sum;
      }, 0);

      if (totalSyringes > 0 && safetyBox.disposalCapacity) {
        const safetyFactor = 1 + ((safetyBox.safetyFactor || 0) / 100);
        const capacity = safetyBox.disposalCapacity || 1;
        usageMap[safetyBox.id] = totalSyringes / (capacity * safetyFactor);
      }
    }
    // --- END OF NEW LOGIC ---

    return usageMap;
  }, [vaccines, vaccineInputs, vaccineWastageInputs, equipment]);

const totalInventoryValue = useMemo(() => {
  let total = 0;
  vaccines.forEach(vaccine => {
    const inputs = vaccineInputs[vaccine.id] || {};
    const boyInventory = (inputs.onHand || 0) + (inputs.expShipments || 0) - (inputs.expUsage || 0);
    total += boyInventory * vaccine.pricePerDose;
  });
    equipment.forEach(item => {
      const inputs = equipmentInputs[item.id] || {};
      // FIX: If a derived usage exists (for syringes), use it. Otherwise, use the manual input.
      const usage = calculatedEquipmentUsage[item.id] !== undefined 
        ? calculatedEquipmentUsage[item.id] 
        : (inputs.expUsage || 0);
      
      const boyInventory = (inputs.onHand || 0) + (inputs.expShipments || 0) - usage;
      total += boyInventory * item.equipmentCost;
  });
  return total;
}, [vaccineInputs, equipmentInputs, vaccines, equipment, calculatedEquipmentUsage]);

  const equipmentBuffer = useMemo(() => {
    const bufferMap: { [equipmentId: string]: number } = {};
    if (!combinedForecast) return bufferMap;

    vaccines.forEach(vaccine => {
      const forecast = combinedForecast.results[vaccine.id]?.[planningYear]?.finalWithWastage || 0;
      // Calculate the number of buffer doses needed for this vaccine
      const vaccineBufferInDoses = (vaccine.bufferStock || 0) * (forecast / 12);

      if (vaccineBufferInDoses > 0) {
        // Calculate buffer for Administration Syringes (based on doses administered, which is roughly doses w/ wastage * (1-wastage))
        if (vaccine.administrationSyringeId) {
           const wastageRate = vaccineWastageInputs[vaccine.id] || 0;
           const bufferDosesAdministered = vaccineBufferInDoses * (1 - wastageRate);
           bufferMap[vaccine.administrationSyringeId] = (bufferMap[vaccine.administrationSyringeId] || 0) + bufferDosesAdministered;
        }
        // Calculate buffer for Dilution Syringes (based on vials)
        if (vaccine.dilutionSyringeId && vaccine.dosesPerVial > 0) {
          const vialsNeeded = Math.ceil(vaccineBufferInDoses / vaccine.dosesPerVial);
          bufferMap[vaccine.dilutionSyringeId] = (bufferMap[vaccine.dilutionSyringeId] || 0) + vialsNeeded;
        }
      }
    });

    // --- THIS IS THE MISSING LOGIC ---
    // Now, calculate the safety boxes needed for the buffer of syringes
    const safetyBox = equipment.find(e => e.equipmentType === 'Safety box');
    if (safetyBox?.disposalCapacity) {
      const totalBufferSyringes = Object.entries(bufferMap).reduce((sum, [eqId, qty]) => {
        const eq = equipment.find(e => e.id === eqId);
        if (eq?.equipmentType.includes('Syringe')) {
          return sum + qty;
        }
        return sum;
      }, 0);

      if (totalBufferSyringes > 0) {
        const safetyFactor = 1 + ((safetyBox.safetyFactor || 0) / 100);
        const capacity = safetyBox.disposalCapacity || 1;
        bufferMap[safetyBox.id] = (bufferMap[safetyBox.id] || 0) + (totalBufferSyringes / (capacity * safetyFactor));
      }
    }
    // --- END OF MISSING LOGIC ---

    return bufferMap;
  }, [vaccines, equipment, combinedForecast, vaccineWastageInputs]);

  const procurementData = useMemo(() => {
    return [...vaccines, ...equipment].map(item => {
      const isVaccine = 'vaccineName' in item;
      const id = item.id;
      const name = isVaccine ? (item as Vaccine).vaccineName : (item as Equipment).equipmentName;
      const unitPrice = isVaccine ? (item as Vaccine).pricePerDose : (item as Equipment).equipmentCost;

      // --- THIS LOGIC IS NOW CORRECTED ---
      const forecast = isVaccine
        ? combinedForecast?.results[id]?.[planningYear]?.finalWithWastage || 0
        : (equipmentForecast?.results.reduce((sum, program) => {
            const equipmentItem = program.equipment.find(e => e.equipmentId === id);
            return sum + (equipmentItem?.yearlyQuantities[planningYear] || 0);
          }, 0) || 0);
      // --- END OF CORRECTION ---

      const buffer = isVaccine 
        ? ((item as Vaccine).bufferStock || 0) * (forecast / 12) 
        : (equipmentBuffer[id] || 0);

      const inputs = isVaccine ? vaccineInputs[id] : equipmentInputs[id];
      const derivedUsage = isVaccine ? 0 : (calculatedEquipmentUsage[id] || 0);
      const usage = isVaccine ? (inputs?.expUsage || 0) : (derivedUsage !== undefined ? derivedUsage : (inputs?.expUsage || 0));
      const boyInventory = (inputs?.onHand || 0) + (inputs?.expShipments || 0) - usage;
      
      const recommendedProcurement = Math.max(0, forecast + buffer - boyInventory);
      const costOfRecommended = recommendedProcurement * unitPrice;
      
      const proposedValue = Number(String(proposedProcurement[id] || '0').replace(/,/g, ''));
      const costOfProposed = proposedValue * unitPrice;

      return { id, name, forecast, buffer, boyInventory, recommendedProcurement, costOfRecommended, proposedValue, costOfProposed };
    });
  }, [vaccines, equipment, combinedForecast, equipmentForecast, vaccineInputs, equipmentInputs, calculatedEquipmentUsage, proposedProcurement, equipmentBuffer]);

  const vaccineCosts = useMemo(() => {
    if (!combinedForecast) return 0;
    let totalCost = 0;
    Object.entries(combinedForecast.results).forEach(([vaccineId, yearlyData]) => {
        const vaccineInfo = vaccines.find(v => v.id === vaccineId);
        if (vaccineInfo) {
            const yearData = yearlyData[planningYear];
            if (yearData) {
                totalCost += yearData.finalWithWastage * vaccineInfo.pricePerDose;
            }
        }
    });
    return totalCost;
  }, [combinedForecast, vaccines]);

  const equipmentCosts = useMemo(() => {
    if (!equipmentForecast) return 0;
    let totalCost = 0;
    equipmentForecast.results.forEach(program => {
        program.equipment.forEach(item => {
            const equipmentInfo = equipment.find(e => e.id === item.equipmentId);
            if (equipmentInfo) {
                const quantity = item.yearlyQuantities[planningYear] || 0;
                const cost = quantity * equipmentInfo.equipmentCost;;
                totalCost += cost;
            }
        });
    });
    return totalCost;
  }, [equipmentForecast, equipment]);

const totalProposedProcurementCost = useMemo(() => {
  return procurementData.reduce((sum, item) => sum + item.costOfProposed, 0);
}, [procurementData]);

const netFundingAsk = totalProposedProcurementCost - totalInventoryValue;

const fundingTotals = useMemo(() => {
  return funders.reduce((acc, funder) => {
    acc.totalAllocation += funder.allocation || 0;
    acc.totalCommitted += funder.committed || 0;
    return acc;
  }, { totalAllocation: 0, totalCommitted: 0 });
}, [funders]);

  const handleVaccineInputChange = (vaccineId: string, field: keyof FinancialPlanInventoryInput, value: string) => {
    const numericValue = Number(value.replace(/,/g, '')) || 0;
    setVaccineInputs(prev => ({
      ...prev,
      [vaccineId]: { ...prev[vaccineId], [field]: numericValue }
    }));
  };

  const handleEquipmentInputChange = (equipmentId: string, field: keyof FinancialPlanInventoryInput, value: string) => {
    const numericValue = Number(value.replace(/,/g, '')) || 0;
    setEquipmentInputs(prev => ({
      ...prev,
      [equipmentId]: { ...prev[equipmentId], [field]: numericValue }
    }));
  };

  const handleWastageInputChange = (vaccineId: string, value: string) => {
    const numericValue = Number(value) / 100 || 0; // Store as decimal
    setVaccineWastageInputs(prev => ({ ...prev, [vaccineId]: numericValue }));
  };

  const constrainedForecastData = useMemo(() => {
    const totalCommitted = fundingTotals.totalCommitted;
    if (!combinedForecast || !equipmentForecast || netFundingAsk <= 0 || totalCommitted <= 0) {
      return { fundingPercentage: 0, forecasts: [] };
    }
  
    const fundingPercentage = Math.min(1, totalCommitted / netFundingAsk);
    
    const vaccineForecasts = vaccines.map(vaccine => {
      const originalAdmin = combinedForecast.results[vaccine.id]?.[planningYear]?.finalAdministered || 0;
      const originalWastage = combinedForecast.results[vaccine.id]?.[planningYear]?.finalWithWastage || 0;
      
      return {
        id: vaccine.id,
        name: vaccine.vaccineName,
        original: originalWastage,
        constrained: originalWastage * fundingPercentage,
        constrainedAdmin: originalAdmin * fundingPercentage, // <-- ADD THIS
      };
    });
  
    const equipmentForecasts = equipment.map(item => {
      const originalForecast = equipmentForecast.results
        .reduce((sum, program) => {
            const equipmentItem = program.equipment.find(e => e.equipmentId === item.id);
            return sum + (equipmentItem?.yearlyQuantities[planningYear] || 0);
        }, 0);

      return {
        id: item.id,
        name: item.equipmentName,
        original: originalForecast,
        constrained: originalForecast * fundingPercentage,
        constrainedAdmin: originalForecast * fundingPercentage, // For equipment, admin = wastage
      };
    });
  
    return { fundingPercentage, forecasts: [...vaccineForecasts, ...equipmentForecasts] };
  }, [fundingTotals, netFundingAsk, combinedForecast, equipmentForecast, vaccines, equipment]);

  const handleSaveFinancialPlan = async () => {
    if (!user || !countryId) return;
    setSaving(true);
    try {
      // Sanitize the input data to ensure it's complete
      const sanitizedVaccineInputs: { [id: string]: FinancialPlanInventoryInput } = {};
      Object.entries(vaccineInputs).forEach(([id, inputs]) => {
        sanitizedVaccineInputs[id] = {
          onHand: inputs.onHand || 0,
          expShipments: inputs.expShipments || 0,
          expUsage: inputs.expUsage || 0,
        };
      });
      const sanitizedEquipmentInputs: { [id: string]: FinancialPlanInventoryInput } = {};
      Object.entries(equipmentInputs).forEach(([id, inputs]) => {
        sanitizedEquipmentInputs[id] = {
          onHand: inputs.onHand || 0,
          expShipments: inputs.expShipments || 0,
          expUsage: inputs.expUsage || 0,
        };
      });

      const planToSave: Omit<FinancialPlan, 'id' | 'country' | 'createdAt'> = {
        year: planningYear,
        inventoryAsOfDate: asOfDate ? Timestamp.fromDate(asOfDate.toDate()) : undefined,
        vaccineInputs: sanitizedVaccineInputs,
        equipmentInputs: sanitizedEquipmentInputs,
        funders,
        proposedProcurement: proposedProcurement as { [key: string]: number },
        constrainedForecast: constrainedForecastData,
        calculatedEquipmentUsage: calculatedEquipmentUsage,        
      };

      const docId = loadedPlanId || `${countryId}_${planningYear}`;
      const docRef = doc(db, 'financial_plans', docId);
      await setDoc(docRef, {
        ...planToSave,
        country: countryId,
        createdAt: Timestamp.now(),
      }, { merge: true });

      setLoadedPlanId(docId);
      alert('Financial Plan saved successfully!');
    } catch (error) {
      console.error("Error saving financial plan:", error);
      alert('Error saving financial plan.');
    } finally {
      setSaving(false);
    }
  };  

  return (
    <ProtectedRoute>
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Annual Procurement Planning
          </Typography>

          {loading ? <CircularProgress /> : (
            <Grid container spacing={4}>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>1. Beginning of Year Inventory for {planningYear}</Typography>
                  <Box sx={{ my: 2 }}>
                    <DatePicker 
                      label="Inventory As-Of Date"
                      value={asOfDate}
                      onChange={(date) => setAsOfDate(date)}
                    />
                  </Box>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell align="right">On-Hand Inv.</TableCell>
                          <TableCell align="right">Exp. Shipments</TableCell>
                          <TableCell align="right">Exp. Usage</TableCell>
                          {/* <TableCell align="right">Wastage Rate (%)</TableCell> */}
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>BOY Inventory</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Inventory Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={6} sx={{ fontWeight: 'bold', backgroundColor: 'grey.100' }}>Vaccines</TableCell>
                        </TableRow>
                        {vaccines.map(vaccine => {
                          const inputs = vaccineInputs[vaccine.id] || {};
                          const boyInventory = (inputs.onHand || 0) + (inputs.expShipments || 0) - (inputs.expUsage || 0);
                          const inventoryValue = boyInventory * vaccine.pricePerDose;
                          return (
                            <TableRow key={vaccine.id}>
                              <TableCell>{vaccine.vaccineName}</TableCell>
                              <TableCell><TextField variant="standard" size="small" type="text" value={(inputs.onHand || '').toLocaleString()} onChange={e => handleVaccineInputChange(vaccine.id, 'onHand', e.target.value)} sx={{input: {textAlign: 'right'}}} /></TableCell>
                              <TableCell><TextField variant="standard" size="small" type="text" value={(inputs.expShipments || '').toLocaleString()} onChange={e => handleVaccineInputChange(vaccine.id, 'expShipments', e.target.value)} sx={{input: {textAlign: 'right'}}} /></TableCell>
                              <TableCell><TextField variant="standard" size="small" type="text" value={(inputs.expUsage || '').toLocaleString()} onChange={e => handleVaccineInputChange(vaccine.id, 'expUsage', e.target.value)} sx={{input: {textAlign: 'right'}}} /></TableCell>
                              {/* --- NEW WASTAGE INPUT CELL --- */}
                              {/* <TableCell>
                                  <TextField 
                                      variant="standard" 
                                      size="small" 
                                      type="number" 
                                      value={(vaccineWastageInputs[vaccine.id] || 0) * 100} 
                                      onChange={e => handleWastageInputChange(vaccine.id, e.target.value)} 
                                      sx={{input: {textAlign: 'right', width: '60px'}}} 
                                      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                                  />
                              </TableCell> */}
                              <TableCell align="right">{boyInventory.toLocaleString()}</TableCell>
                              <TableCell align="right">${inventoryValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</TableCell>
                            </TableRow>
                          );
                        })}
                         <TableRow>
                          <TableCell colSpan={6} sx={{ fontWeight: 'bold', backgroundColor: 'grey.100' }}>Equipment</TableCell>
                        </TableRow>
                        {equipment.map(item => {
                           const inputs = equipmentInputs[item.id] || {};
                           
                           // --- FIX: Use the same robust logic as the summary calculation ---
                           const derivedUsage = calculatedEquipmentUsage[item.id];
                           const usage = derivedUsage !== undefined ? derivedUsage : (inputs.expUsage || 0);

                           const boyInventory = (inputs.onHand || 0) + (inputs.expShipments || 0) - usage;
                           const inventoryValue = boyInventory * item.equipmentCost;
                           return (
                            <TableRow key={item.id}>
                              <TableCell>{item.equipmentName}</TableCell>
                              <TableCell><TextField variant="standard" size="small" type="text" value={(inputs.onHand || '').toLocaleString()} onChange={e => handleEquipmentInputChange(item.id, 'onHand', e.target.value)} sx={{input: {textAlign: 'right'}}} /></TableCell>
                              <TableCell><TextField variant="standard" size="small" type="text" value={(inputs.expShipments || '').toLocaleString()} onChange={e => handleEquipmentInputChange(item.id, 'expShipments', e.target.value)} sx={{input: {textAlign: 'right'}}} /></TableCell>
                              
                              {/* --- This cell is now smarter: calculated for syringes, editable for others --- */}
                              <TableCell align="right">
                                {derivedUsage !== undefined ? (
                                  <Typography variant="body2">{Math.ceil(derivedUsage).toLocaleString()}</Typography>
                                ) : (
                                  <TextField variant="standard" size="small" type="text" value={(inputs.expUsage || '').toLocaleString()} onChange={e => handleEquipmentInputChange(item.id, 'expUsage', e.target.value)} sx={{input: {textAlign: 'right'}}} />
                                )}
                              </TableCell>
                              <TableCell align="right">{Math.round(boyInventory).toLocaleString()}</TableCell>
                              <TableCell align="right">${inventoryValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                            </TableRow>
                           );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>2. Recommended & Proposed Procurement for {planningYear}</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell align="right">Final Forecast</TableCell>
                          <TableCell align="right">Buffer</TableCell>
                          <TableCell align="right">BOY Inventory</TableCell>
                          <TableCell align="right" sx={{fontWeight: 'bold'}}>Rec. Procurement</TableCell>
                          <TableCell align="right" sx={{fontWeight: 'bold'}}>Cost of Rec.</TableCell>
                          <TableCell align="center" sx={{fontWeight: 'bold'}}>Proposed Procurement</TableCell>
                          <TableCell align="right" sx={{fontWeight: 'bold'}}>Cost of Proposed</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {procurementData.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell align="right">{Math.ceil(item.forecast).toLocaleString()}</TableCell>
                            <TableCell align="right">{Math.ceil(item.buffer).toLocaleString()}</TableCell>
                            <TableCell align="right">{Math.ceil(item.boyInventory).toLocaleString()}</TableCell>
                            <TableCell align="right">{Math.ceil(item.recommendedProcurement).toLocaleString()}</TableCell>
                            <TableCell align="right">${item.costOfRecommended.toLocaleString(undefined, {maximumFractionDigits: 0})}</TableCell>
                            <TableCell align="center">
                              <TextField 
                                variant="standard" 
                                size="small" 
                                type="text" 
                                value={item.proposedValue.toLocaleString()} 
                                onChange={e => handleProposedProcurementChange(item.id, e.target.value)} 
                                sx={{input: {textAlign: 'right', width: '120px'}}} 
                              />
                            </TableCell>
                            <TableCell align="right">${item.costOfProposed.toLocaleString(undefined, {maximumFractionDigits: 0})}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>2. Proposed Budget for {planningYear}</Typography>
                  <Grid container spacing={2} sx={{ textAlign: 'center', mt: 1 }}>
                    <Grid item xs={3}><Typography color="text.secondary">Vaccine Costs</Typography><Typography variant="h5" fontWeight="bold">${vaccineCosts.toLocaleString(undefined, {maximumFractionDigits: 0})}</Typography></Grid>
                    <Grid item xs={3}><Typography color="text.secondary">Equipment Costs</Typography><Typography variant="h5" fontWeight="bold">${equipmentCosts.toLocaleString(undefined, {maximumFractionDigits: 0})}</Typography></Grid>
                    <Grid item xs={3}><Typography color="text.secondary">Less: Inventory Value</Typography><Typography variant="h5" fontWeight="bold">(${totalInventoryValue.toLocaleString(undefined, {maximumFractionDigits: 0})})</Typography></Grid>
                    <Grid item xs={3}><Paper elevation={2} sx={{p: 1, backgroundColor: 'primary.light', color: 'primary.contrastText'}}><Typography>Net Funding Ask</Typography><Typography variant="h5" fontWeight="bold">${netFundingAsk.toLocaleString(undefined, {maximumFractionDigits: 0})}</Typography></Paper></Grid>
                  </Grid>
                </Paper>
              </Grid>
              {/* --- ADD THIS NEW SECTION FOR FUNDING --- */}
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>3. Funding Allocation for {planningYear}</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Funder Name</TableCell>
                          <TableCell align="right">Allocation (%)</TableCell>
                          <TableCell align="right">Allocated Ask ($)</TableCell>
                          <TableCell align="right">Committed Amount ($)</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {funders.map(funder => {
                          const allocatedAsk = netFundingAsk * (funder.allocation / 100);
                          return (
                            <TableRow key={funder.id}>
                              <TableCell><TextField variant="standard" size="small" type="text" value={funder.name} onChange={e => handleFunderChange(funder.id, 'name', e.target.value)} /></TableCell>
                              <TableCell><TextField variant="standard" size="small" type="text" value={funder.allocation} onChange={e => handleFunderChange(funder.id, 'allocation', e.target.value)} sx={{input: {textAlign: 'right'}}} /></TableCell>
                              <TableCell align="right">${allocatedAsk.toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                              <TableCell><TextField variant="standard" size="small" type="text" value={funder.committed.toLocaleString()} onChange={e => handleFunderChange(funder.id, 'committed', e.target.value)} sx={{input: {textAlign: 'right'}}} /></TableCell>
                              <TableCell align="center"><Button color="error" size="small" onClick={() => handleRemoveFunder(funder.id)}>Del</Button></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter sx={{'& td': { fontWeight: 'bold' }}}>
                        <TableRow>
                          <TableCell>Totals</TableCell>
                          <TableCell align="right" sx={{color: fundingTotals.totalAllocation !== 100 ? 'error.main' : 'inherit'}}>{fundingTotals.totalAllocation}%</TableCell>
                          <TableCell align="right">${netFundingAsk.toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                          <TableCell align="right">${fundingTotals.totalCommitted.toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TableContainer>
                  <Button size="small" onClick={handleAddFunder} sx={{mt: 1}}>+ Add Funder</Button>
                </Paper>
              </Grid>
              {/* --- NEW: Constrained Forecast Section --- */}
              <Grid item xs={12}>
                <Paper sx={{ p: 3, backgroundColor: 'primary.light', color: 'primary.contrastText' }} elevation={4}>
                  <Typography variant="h6" gutterBottom>4. Constrained Forecast for {planningYear}</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Vaccine</TableCell>
                          <TableCell align="right">Original Forecast</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Constrained Forecast</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {constrainedForecastData.forecasts.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell align="right">{Math.round(item.original).toLocaleString()}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{Math.round(item.constrained).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                    Overall funding level: {(constrainedForecastData.fundingPercentage * 100).toFixed(1)}%
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sx={{ textAlign: 'right' }}>
                <Button variant="contained" color="success" size="large" onClick={handleSaveFinancialPlan} disabled={saving}>
                  {saving ? <CircularProgress size={24} /> : 'Save Financial Plan'}
                </Button>
              </Grid>              
            </Grid>
          )}
        </Box>
      </Container>
    </ProtectedRoute>
  );
}