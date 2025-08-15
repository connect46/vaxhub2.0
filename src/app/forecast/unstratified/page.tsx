"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, doc, getDoc, onSnapshot, setDoc, Timestamp, getDocs } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Program, Vaccine, UnstratifiedForecast, ForecastTargetGroup } from '@/types';
import ForecastResultsTable from '@/components/ForecastResultsTable';
import UnstratifiedResultsTable from '@/components/UnstratifiedResultsTable';

// MUI Components
import { Box, Button, Typography, Container, CircularProgress, Paper } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';

interface CountryData {
  name: string;
  population: number;
  annualGrowthRate: number;
  projections: { year: number, population: number }[];
  targetGroups: { id: string, name: string, percentage: number }[];
}

const calculateUnstratifiedForecast = (
  programs: Program[], 
  countryData: CountryData,
  vaccines: Vaccine[]
): { [vaccineId: string]: UnstratifiedForecast } => {
  const results: { [vaccineId: string]: { vaccineName: string, targetGroups: { [tgId: string]: ForecastTargetGroup } } } = {};
  const startYear = new Date().getFullYear() + 1;
  const endYear = startYear + 4;

  programs.forEach(program => {
    program.vaccines.forEach(programVaccine => {
      const vaccineInfo = vaccines.find(v => v.id === programVaccine.vaccineId);
      if (!vaccineInfo) return;

      Object.entries(programVaccine.doseAssignments).forEach(([doseNumber, assignment]) => {
        const { targetGroupId, coverageRate, wastageRate } = assignment;
        const targetGroupDef = countryData.targetGroups.find(tg => tg.id === targetGroupId);
        if (!targetGroupDef) return;

        if (!results[vaccineInfo.id]) {
          results[vaccineInfo.id] = { vaccineName: vaccineInfo.vaccineName, targetGroups: {} };
        }
        if (!results[vaccineInfo.id].targetGroups[targetGroupId]) {
          results[vaccineInfo.id].targetGroups[targetGroupId] = {
            targetGroupId: targetGroupId,
            targetGroupName: targetGroupDef.name,
            years: {},
          };
        }

        for (let year = startYear; year <= endYear; year++) {
          const yearProjection = countryData.projections.find(p => p.year === year);
          if (!yearProjection) continue;

          const totalPopulation = yearProjection.population;
          const targetPopulation = totalPopulation * (targetGroupDef.percentage / 100);
          const dosesAdministered = targetPopulation * coverageRate;
          const dosesWithWastage = dosesAdministered > 0 ? dosesAdministered / (1 - wastageRate) : 0;
          
          const yearData = results[vaccineInfo.id].targetGroups[targetGroupId].years[year] || {
            coverageRate, wastageRate, dosesAdministered: 0, dosesWithWastage: 0,
          };
          
          yearData.dosesAdministered += dosesAdministered;
          yearData.dosesWithWastage += dosesWithWastage;
          results[vaccineInfo.id].targetGroups[targetGroupId].years[year] = yearData;
        }
      });
    });
  });

  const finalForecasts: { [vaccineId: string]: UnstratifiedForecast } = {};
  Object.keys(results).forEach(vaccineId => {
    finalForecasts[vaccineId] = {
      id: vaccineId,
      country: countryData.name, // Using name for now, should be ID
      vaccineName: results[vaccineId].vaccineName,
      targetGroups: Object.values(results[vaccineId].targetGroups),
      createdAt: Timestamp.now(),
      lastUpdated: Timestamp.now(),
    };
  });
  
  return finalForecasts;
};

export default function UnstratifiedForecastPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countryId, setCountryId] = useState<string | null>(null); 
  const [countryData, setCountryData] = useState<CountryData | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [forecastResult, setForecastResult] = useState<{[vaccineId: string]: UnstratifiedForecast} | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Initialize all unsubscribe functions
    let unsubPrograms: () => void = () => {};
    let unsubVaccines: () => void = () => {};
    let unsubForecasts: () => void = () => {};
    
    const fetchAllData = async () => {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        setLoading(false);
        return;
      }
      
      const userCountryId = userDoc.data().country;
      setCountryId(userCountryId);

      const countryDoc = await getDoc(doc(db, 'countries', userCountryId));
      if (countryDoc.exists()) {
        setCountryData(countryDoc.data() as CountryData);
      }

      const programsQuery = query(collection(db, "programs"), where("country", "==", userCountryId));
      unsubPrograms = onSnapshot(programsQuery, (snapshot) => {
        setPrograms(snapshot.docs.map(p => ({ id: p.id, ...p.data() } as Program)));
      });

      const vaccinesQuery = query(collection(db, "vaccines"));
      unsubVaccines = onSnapshot(vaccinesQuery, (snapshot) => {
        setVaccines(snapshot.docs.map(v => ({ id: v.id, ...v.data() } as Vaccine)));
      });

      // --- THIS IS THE ADDED LOGIC ---
      const forecastQuery = query(collection(db, "forecasts_unstratified"), where("country", "==", userCountryId));
      unsubForecasts = onSnapshot(forecastQuery, (snapshot) => {
        if (!snapshot.empty) {
          const forecastsData: { [vaccineId: string]: UnstratifiedForecast } = {};
          snapshot.forEach(doc => {
            forecastsData[doc.id] = doc.data() as UnstratifiedForecast;
          });
          setForecastResult(forecastsData);
        }
        setLoading(false); // Loading is complete when the last listener is ready
      });
      // --- END OF ADDED LOGIC ---
    };

    fetchAllData();

    return () => {
      unsubPrograms();
      unsubVaccines();
      unsubForecasts(); // Add cleanup for the new listener
    };
  }, [user]);

  const handleRunForecast = () => {
    if (!countryData || programs.length === 0 || vaccines.length === 0) {
      alert("Required data is not loaded yet.");
      return;
    }
    const result = calculateUnstratifiedForecast(programs, countryData, vaccines);
    setForecastResult(result);
  };

  const handleForecastUpdate = (vaccineId: string, targetGroupId: string, year: number, field: 'coverageRate' | 'wastageRate', value: string) => {
    if (!forecastResult) return;

    const newRate = parseFloat(value) / 100 || 0;

    // Create a deep copy to safely update the nested state
    const newResult = JSON.parse(JSON.stringify(forecastResult));

    const targetGroup = newResult[vaccineId].targetGroups.find((tg: any) => tg.targetGroupId === targetGroupId);

    if (targetGroup && targetGroup.years[year]) {
      // Update the rate that was changed
      targetGroup.years[year][field] = newRate;

      // Recalculate doses w/ wastage using the potentially new rates
      const { dosesAdministered, wastageRate } = targetGroup.years[year];
      targetGroup.years[year].dosesWithWastage = dosesAdministered > 0 ? dosesAdministered / (1 - wastageRate) : 0;

      setForecastResult(newResult);
    }
  };

  const handleSaveForecast = async () => {
    if (!forecastResult || !countryId) return;
    setSaving(true);
    try {
      const now = Timestamp.now();
      for (const vaccineId in forecastResult) {
        const forecastDocRef = doc(db, 'forecasts_unstratified', vaccineId);
        const dataToSave = {
          ...forecastResult[vaccineId],
          country: countryId,
          lastUpdated: now,
          createdAt: forecastResult[vaccineId].createdAt || now,
        };
        await setDoc(forecastDocRef, dataToSave, { merge: true });
      }
      alert('Forecast saved successfully!');
    } catch (error) {
      console.error("Error saving forecast: ", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <Container maxWidth="xl">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>Unstratified Forecast</Typography>
          <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button 
              variant="contained" size="large"
              startIcon={<PlayArrowIcon />} 
              onClick={handleRunForecast}
              disabled={loading || !countryData || programs.length === 0}
            >
              Run Forecast
            </Button>
            {loading && <CircularProgress size={24} />}
            <Typography variant="body2" color="text.secondary">
              Calculates a 5-year forecast based on your defined programs and demographics.
            </Typography>
          </Paper>

          {forecastResult && (
            <Paper sx={{ p: 3, mt: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">Forecast Results</Typography>
                <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleSaveForecast} disabled={saving}>
                  {saving ? <CircularProgress size={24} color="inherit" /> : 'Save Forecast'}
                </Button>
              </Box>
              <UnstratifiedResultsTable forecastData={forecastResult} onUpdate={handleForecastUpdate} />
            </Paper>
          )}
        </Box>
      </Container>
    </ProtectedRoute>
  );
}