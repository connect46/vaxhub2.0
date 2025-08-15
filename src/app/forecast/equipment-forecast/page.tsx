"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CombinedForecast, Program, Vaccine, Equipment, EquipmentForecast } from '@/types';
import EquipmentForecastResults from '@/components/EquipmentForecastResults';

// MUI Components
import { Box, Button, Typography, Container, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';

const calculateEquipmentForecast = (
  combinedForecast: CombinedForecast,
  programs: Program[],
  vaccines: Vaccine[],
  equipment: Equipment[]
): EquipmentForecast['results'] => {
  const equipmentResults: EquipmentForecast['results'] = [];
  const forecastYears = combinedForecast.forecastYears || [];
  const safetyBox = equipment.find(e => e.equipmentType === 'Safety box');

  programs.forEach(program => {
    const programEquipment: { [eqId: string]: { equipmentName: string, yearlyQuantities: { [year: number]: number } } } = {};

    program.vaccines.forEach(programVaccine => {
      const vaccineDetails = vaccines.find(v => v.id === programVaccine.vaccineId);
      if (!vaccineDetails) return;

      forecastYears.forEach(year => {
        const finalDoses = combinedForecast.results[vaccineDetails.id]?.[year];
        if (!finalDoses) return;

        // 1. Administration Syringes (ADS)
        if (vaccineDetails.administrationSyringeId) {
          const eqId = vaccineDetails.administrationSyringeId;
          if (!programEquipment[eqId]) programEquipment[eqId] = { equipmentName: '', yearlyQuantities: {} };
          programEquipment[eqId].yearlyQuantities[year] = (programEquipment[eqId].yearlyQuantities[year] || 0) + finalDoses.finalAdministered;
        }

        // 2. Dilution Syringes (DS)
        if (vaccineDetails.dilutionSyringeId && vaccineDetails.dosesPerVial > 0) {
          const eqId = vaccineDetails.dilutionSyringeId;
          const vialsNeeded = finalDoses.finalWithWastage / vaccineDetails.dosesPerVial;
          if (!programEquipment[eqId]) programEquipment[eqId] = { equipmentName: '', yearlyQuantities: {} };
          programEquipment[eqId].yearlyQuantities[year] = (programEquipment[eqId].yearlyQuantities[year] || 0) + vialsNeeded;
        }
      });
    });

    // 3. Safety Boxes
    if (safetyBox?.disposalCapacity) {
        if (!programEquipment[safetyBox.id]) {
            programEquipment[safetyBox.id] = { equipmentName: safetyBox.equipmentName, yearlyQuantities: {} };
        }
        const safetyFactor = 1 + ((safetyBox.safetyFactor || 0) / 100);
        
        forecastYears.forEach(year => {
            let totalSyringes = 0;
            Object.keys(programEquipment).forEach(eqId => {
                if (eqId !== safetyBox.id) {
                    totalSyringes += programEquipment[eqId].yearlyQuantities[year] || 0;
                }
            });
            const capacity = safetyBox.disposalCapacity || 1;
            const boxesNeeded = totalSyringes / (capacity * safetyFactor);
            programEquipment[safetyBox.id].yearlyQuantities[year] = boxesNeeded;
        });
    }

    equipmentResults.push({
      programId: program.id,
      programName: program.programName,
      programCategory: program.programCategory,
      equipment: Object.entries(programEquipment).map(([eqId, data]) => {
        const eqDetails = equipment.find(e => e.id === eqId);
        return {
          equipmentId: eqId,
          equipmentName: eqDetails?.equipmentName || 'Unknown',
          yearlyQuantities: data.yearlyQuantities,
        };
      }),
    });
  });

  return equipmentResults;
};

export default function EquipmentForecastPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countryId, setCountryId] = useState<string | null>(null);
  const [combinedForecast, setCombinedForecast] = useState<CombinedForecast | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentForecast, setEquipmentForecast] = useState<EquipmentForecast | null>(null);
  const [loadedForecastId, setLoadedForecastId] = useState<string | null>(null);

  const grandTotals = useMemo(() => {
    if (!equipmentForecast) return null;

    const totals: { [eqId: string]: { equipmentName: string, yearlyQuantities: { [year: number]: number } } } = {};

    equipmentForecast.results.forEach(program => {
      program.equipment.forEach(item => {
        if (!totals[item.equipmentId]) {
          totals[item.equipmentId] = {
            equipmentName: item.equipmentName,
            yearlyQuantities: {}
          };
        }
        Object.entries(item.yearlyQuantities).forEach(([year, qty]) => {
          const yearNum = Number(year);
          totals[item.equipmentId].yearlyQuantities[yearNum] = (totals[item.equipmentId].yearlyQuantities[yearNum] || 0) + qty;
        });
      });
    });

    return totals;
  }, [equipmentForecast]);

  useEffect(() => {
    if (!user) return;

    const fetchAllData = async () => {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) { setLoading(false); return; }
      const userCountryId = userDoc.data().country;
      setCountryId(userCountryId);

      // Create queries for all the data we need
      const combinedQuery = query(collection(db, 'forecasts_combined'), where("country", "==", userCountryId), orderBy("createdAt", "desc"), limit(1));
      const programsQuery = query(collection(db, 'programs'), where("country", "==", userCountryId));
      const vaccinesQuery = query(collection(db, 'vaccines'));
      const equipmentQuery = query(collection(db, 'equipment'));
      const eqForecastQuery = query(collection(db, "forecasts_equipment"), where("country", "==", userCountryId), orderBy("createdAt", "desc"), limit(1));


      // Fetch all data in parallel
      const [
        combinedSnapshot,
        programsSnapshot,
        vaccinesSnapshot,
        equipmentSnapshot,
        eqForecastSnapshot,
      ] = await Promise.all([
        getDocs(combinedQuery),
        getDocs(programsQuery),
        getDocs(vaccinesQuery),
        getDocs(equipmentQuery),
        getDocs(eqForecastQuery),
      ]);

      // Process and set state for each data type
      if (!combinedSnapshot.empty) {
        setCombinedForecast(combinedSnapshot.docs[0].data() as CombinedForecast);
      }
      setPrograms(programsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Program)));
      setVaccines(vaccinesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vaccine)));
      setEquipment(equipmentSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Equipment)));
      if (!eqForecastSnapshot.empty) {
        const latestForecastDoc = eqForecastSnapshot.docs[0];
        setEquipmentForecast(latestForecastDoc.data() as EquipmentForecast);
        setLoadedForecastId(latestForecastDoc.id);
      }

      setLoading(false);
    };

    fetchAllData();
  }, [user]);

  const handleCalculate = () => {
    if (!combinedForecast || !programs || !vaccines || !equipment) {
      alert("All data must be loaded to calculate the equipment forecast.");
      return;
    }
    const results = calculateEquipmentForecast(combinedForecast, programs, vaccines, equipment);
    const newForecast: EquipmentForecast = {
      id: loadedForecastId || '',
      country: combinedForecast.country,
      scenarioName: `Equipment Forecast for ${combinedForecast.scenarioName}`,
      createdAt: Timestamp.now(),
      results: results,
    };
    setEquipmentForecast(newForecast);
  };

  const handleSaveForecast = async () => {
    if (!equipmentForecast || !countryId) return;
    setSaving(true);
    try {
      const dataToSave = { ...equipmentForecast, country: countryId, createdAt: Timestamp.now() };
      if (loadedForecastId) {
        await setDoc(doc(db, 'forecasts_equipment', loadedForecastId), dataToSave);
      } else {
        const newDocRef = await addDoc(collection(db, 'forecasts_equipment'), dataToSave);
        setLoadedForecastId(newDocRef.id);
      }
      alert('Equipment forecast saved successfully!');
    } catch (error) {
      console.error("Error saving equipment forecast:", error);
      alert("Error saving equipment forecast.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Equipment Forecast
          </Typography>
          <Paper sx={{ p: 3 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              This tool calculates required equipment based on your final Combined Forecast.
            </Typography>
            <Button 
              variant="contained" 
              size="large"
              startIcon={<PlayArrowIcon />} 
              onClick={handleCalculate}
              disabled={loading || !combinedForecast}
            >
              Calculate Equipment Forecast
            </Button>
            {loading && <CircularProgress sx={{ ml: 2 }} size={24} />}
          </Paper>

     {equipmentForecast && (
            <>
              {/* --- NEW: Grand Total Summary Section --- */}
              {grandTotals && (
                <Paper sx={{ p: 3, my: 4 }}>
                  <Typography variant="h5" component="h2" gutterBottom>
                    Grand Total Summary
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Equipment</TableCell>
                          {/* Get years from the first item */}
                          {Object.keys(Object.values(grandTotals)[0].yearlyQuantities).sort().map(year => (
                            <TableCell key={year} align="right" sx={{ fontWeight: 'bold' }}>{year}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.values(grandTotals).map(item => (
                          <TableRow key={item.equipmentName}>
                            <TableCell>{item.equipmentName}</TableCell>
                            {Object.keys(item.yearlyQuantities).sort().map(year => (
                              <TableCell key={year} align="right">{Math.ceil(item.yearlyQuantities[parseInt(year)]).toLocaleString()}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {/* The existing detailed results component */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleSaveForecast} disabled={saving}>
                  {saving ? <CircularProgress size={24} /> : 'Save Equipment Forecast'}
                </Button>
              </Box>
              <EquipmentForecastResults forecast={equipmentForecast} />
            </>
          )}
        </Box>
      </Container>
    </ProtectedRoute>
  );
}