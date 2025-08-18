"use client";

import React, { useEffect, useState, useMemo } from 'react';
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, Timestamp, addDoc } from 'firebase/firestore';
import { Vaccine, UnstratifiedForecast, StratifiedForecast, ConsumptionHcForecast, ManualForecast, CombinedForecast, ConsumptionScForecast, CombinedForecastInput } from '@/types';

// MUI Components
import { Box, Container, Typography, CircularProgress, Accordion, AccordionSummary, AccordionDetails, Table, TableContainer, TableHead, TableRow, TableCell, TableBody, Paper, TextField, Button } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import dayjs from 'dayjs';

// A type to hold our organized data
interface ForecastData {
  [vaccineId: string]: {
    vaccineName: string;
    years: {
      [year: number]: {
        [method: string]: {
          dosesAdministered: number;
          dosesWithWastage: number;
        }
      }
    }
  }
}

const FORECAST_METHODS = [
    { key: 'unstratified', name: 'Unstratified'},
    { key: 'stratified', name: 'Stratified'},
    { key: 'consumptionHc', name: 'Consumption (Health Center)'},
    { key: 'consumptionSc', name: 'Consumption (Supply Chain)'},
    { key: 'manual', name: 'Manual Override'},
];
const forecastYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + 1 + i);

export default function CombinedForecastPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [allForecastData, setAllForecastData] = useState<ForecastData>({});
  const [inputs, setInputs] = useState<CombinedForecast['inputs']>({});
  const [loadedForecastId, setLoadedForecastId] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState(`Combined Forecast ${dayjs().format('YYYY-MM-DD')}`);

  useEffect(() => {
    if (!user) return;

    const fetchAllForecasts = async () => {
      setLoading(true);
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) { setLoading(false); return; }
      const countryId = userDoc.data().country;

      const vaccineSnapshot = await getDocs(collection(db, 'vaccines'));
      const vaccineList = vaccineSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vaccine));
      setVaccines(vaccineList);

      const forecastCollections = {
          unstratified: 'forecasts_unstratified',
          stratified: 'forecasts_stratified',
          consumptionHc: 'forecasts_consumption_hc',
          consumptionSc: 'forecasts_consumption_sc',
          manual: 'forecasts_manual'
      };

      // Create a query for each forecast type
      const queries = Object.values(forecastCollections).map(coll => 
          query(collection(db, coll), where("country", "==", countryId))
      );
      
      // Fetch all forecast types in parallel
      const snapshots = await Promise.all(queries.map(q => getDocs(q)));
      
      // Prepare a clean object to hold the processed data
      const processedData: ForecastData = {};
      vaccineList.forEach(vaccine => {
          processedData[vaccine.id] = { vaccineName: vaccine.vaccineName, years: {} };
          forecastYears.forEach(year => {
              processedData[vaccine.id].years[year] = {};
          });
      });

      // --- COMPLETE DATA PROCESSING LOGIC ---

      // Helper function to safely add doses to the results object
      const addDoses = (vaccineId: string, year: number, method: string, dosesAdmin: number, dosesWastage: number) => {
          if (processedData[vaccineId]?.years[year]) {
              if (!processedData[vaccineId].years[year][method]) {
                  processedData[vaccineId].years[year][method] = { dosesAdministered: 0, dosesWithWastage: 0 };
              }
              processedData[vaccineId].years[year][method].dosesAdministered += dosesAdmin;
              processedData[vaccineId].years[year][method].dosesWithWastage += dosesWastage;
          }
      };

      // 1. Process Unstratified Forecasts
      snapshots[0].docs.forEach(d => {
        const forecast = d.data() as UnstratifiedForecast;
        forecast.targetGroups.forEach(tg => {
          Object.entries(tg.years).forEach(([year, yearData]) => {
            addDoses(forecast.id, Number(year), 'unstratified', yearData.dosesAdministered, yearData.dosesWithWastage);
          });
        });
      });

      // 2. Process Stratified Forecasts
      snapshots[1].docs.forEach(d => {
        const forecast = d.data() as StratifiedForecast;
        
        // The results are nested under categories, then vaccines. We must iterate through them.
        Object.entries(forecast.results).forEach(([category, vaccineGroup]) => {
          Object.entries(vaccineGroup).forEach(([vaccineId, vaccineData]) => {
            
            // For each vaccine, we need to sum up the doses for each year 
            // across all its strata and target groups.
            const yearlyTotals: { [year: number]: { dosesAdministered: number, dosesWithWastage: number } } = {};

            Object.values(vaccineData.strata).forEach(stratumData => {
              Object.values(stratumData.targetGroups).forEach(tgData => {
                Object.entries(tgData.years).forEach(([year, yearData]) => {
                  const yearNum = Number(year);
                  if (!yearlyTotals[yearNum]) {
                    yearlyTotals[yearNum] = { dosesAdministered: 0, dosesWithWastage: 0 };
                  }
                  yearlyTotals[yearNum].dosesAdministered += yearData.dosesAdministered;
                  yearlyTotals[yearNum].dosesWithWastage += yearData.dosesWithWastage;
                });
              });
            });

            // Now, add the summed totals to our main results object
            Object.entries(yearlyTotals).forEach(([year, totalData]) => {
              addDoses(vaccineId, Number(year), 'stratified', totalData.dosesAdministered, totalData.dosesWithWastage);
            });
          });
        });
      });

      // 3. Process Consumption HC Forecasts
      snapshots[2].docs.forEach(d => {
        const forecast = d.data() as ConsumptionHcForecast;
        Object.entries(forecast.results).forEach(([vaccineId, vaccineData]) => {
          Object.entries(vaccineData.years).forEach(([year, yearData]) => {
            addDoses(vaccineId, Number(year), 'consumptionHc', yearData.dosesAdministered, yearData.dosesWithWastage);
          });
        });
      });
      
      // 4. Process Consumption SC Forecasts (assumes same structure as HC)
      snapshots[3].docs.forEach(d => {
        const forecast = d.data() as ConsumptionScForecast;
        Object.entries(forecast.results).forEach(([vaccineId, vaccineData]) => {
          Object.entries(vaccineData.years).forEach(([year, yearData]) => {
            addDoses(vaccineId, Number(year), 'consumptionSc', yearData.dosesAdministered, yearData.dosesWithWastage);
          });
        });
      });

      // 5. Process Manual Forecasts
      snapshots[4].docs.forEach(d => {
        const forecast = d.data() as ManualForecast;
        Object.entries(forecast.years).forEach(([year, yearData]) => {
          addDoses(forecast.id, Number(year), 'manual', yearData.dosesAdministered, yearData.dosesWithWastage);
        });
      });

      setAllForecastData(processedData);

      // --- (Logic to fetch saved combined forecast inputs is unchanged) ---
      const combinedQuery = query(collection(db, 'forecasts_combined'), where("country", "==", countryId), orderBy("createdAt", "desc"), limit(1));
      const combinedSnapshot = await getDocs(combinedQuery);
      if (!combinedSnapshot.empty) {
        const latestCombined = combinedSnapshot.docs[0].data() as CombinedForecast;
        setInputs(latestCombined.inputs || {});
        setScenarioName(latestCombined.scenarioName);
        setLoadedForecastId(combinedSnapshot.docs[0].id);
      }
      setLoading(false);
    };

    fetchAllForecasts();
  }, [user]);


  const handleInputChange = (vaccineId: string, year: number, method: string, field: 'weight' | 'confidence', value: string) => {
    const numericValue = Number(value);
    setInputs(prev => {
        const newInputs = JSON.parse(JSON.stringify(prev));
        if (!newInputs[vaccineId]) newInputs[vaccineId] = {};
        if (!newInputs[vaccineId][year]) newInputs[vaccineId][year] = {};
        if (!newInputs[vaccineId][year][method]) newInputs[vaccineId][year][method] = { weight: 0, confidence: 0 };
        
        newInputs[vaccineId][year][method][field] = field === 'weight' ? numericValue / 100 : numericValue;
        return newInputs;
    });
  };

  const totals = useMemo(() => {
    const newTotals: any = {};
    vaccines.forEach(vaccine => {
        newTotals[vaccine.id] = {};
        forecastYears.forEach(year => {
            let totalWeight = 0, finalAdministered = 0, finalWithWastage = 0;
            FORECAST_METHODS.forEach(method => {
                const weight = inputs[vaccine.id]?.[year]?.[method.key]?.weight || 0;
                totalWeight += weight;
                const forecastData = allForecastData[vaccine.id]?.years[year]?.[method.key];
                if (forecastData) {
                    finalAdministered += forecastData.dosesAdministered * weight;
                    finalWithWastage += forecastData.dosesWithWastage * weight;
                }
            });
            newTotals[vaccine.id][year] = { totalWeight, finalAdministered, finalWithWastage };
        });
    });
    return newTotals;
  }, [inputs, allForecastData, vaccines]);


  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const countryId = userDoc.data()?.country;

    const dataToSave: Omit<CombinedForecast, 'id'> = {
        scenarioName,
        country: countryId,
        createdAt: Timestamp.now(),
        inputs,
        results: totals,
        forecastYears: forecastYears,
    };

    try {
        if (loadedForecastId) {
            await setDoc(doc(db, 'forecasts_combined', loadedForecastId), dataToSave, { merge: true });
        } else {
            await addDoc(collection(db, 'forecasts_combined'), dataToSave);
        }
        alert('Combined forecast saved!');
    } catch (error) {
        console.error("Error saving combined forecast:", error);
    } finally {
        setSaving(false);
    }
  };


  return (
    <ProtectedRoute>
      <Container maxWidth="xl">
        <Box sx={{ my: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" component="h1">Combined Forecast</Typography>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
                {saving ? <CircularProgress size={24} /> : 'Save Combined Forecast'}
            </Button>
          </Box>
          <TextField label="Scenario Name" value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} size="small" sx={{mb: 2, width: '400px'}} />

          {loading ? <CircularProgress /> : vaccines.map(vaccine => (
            <Accordion key={vaccine.id} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">{vaccine.vaccineName} - Combined Forecast</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {forecastYears.map(year => (
                  <TableContainer component={Paper} key={year} sx={{ mb: 4 }} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>{year}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Doses Administered</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Doses w/ Wastage</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold' }}>Confidence (1-5)</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 'bold' }}>Weight (%)</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>Administered (Weighted)</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>With Wastage (Weighted)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {FORECAST_METHODS.map(method => {
                            const forecast = allForecastData[vaccine.id]?.years[year]?.[method.key];
                            const input = inputs[vaccine.id]?.[year]?.[method.key];
                            const weight = input?.weight || 0;
                            const weightedAdmin = (forecast?.dosesAdministered || 0) * weight;
                            const weightedWastage = (forecast?.dosesWithWastage || 0) * weight;
                            
                            return (
                                <TableRow key={method.key}>
                                    <TableCell>{method.name}</TableCell>
                                    <TableCell align="right">{forecast ? Math.round(forecast.dosesAdministered).toLocaleString() : 'N/A'}</TableCell>
                                    <TableCell align="right">{forecast ? Math.round(forecast.dosesWithWastage).toLocaleString() : 'N/A'}</TableCell>
                                    <TableCell align="center"><TextField type="number" size="small" sx={{width: '80px'}} value={input?.confidence || ''} onChange={(e) => handleInputChange(vaccine.id, year, method.key, 'confidence', e.target.value)} /></TableCell>
                                    <TableCell align="center"><TextField type="number" size="small" sx={{width: '80px'}} value={weight * 100} onChange={(e) => handleInputChange(vaccine.id, year, method.key, 'weight', e.target.value)} /></TableCell>
                                    <TableCell align="right">{Math.round(weightedAdmin).toLocaleString()}</TableCell>
                                    <TableCell align="right">{Math.round(weightedWastage).toLocaleString()}</TableCell>
                                </TableRow>
                            );
                        })}
                      </TableBody>
                       <TableBody sx={{borderTop: '2px solid black'}}>
                          <TableRow>
                              <TableCell colSpan={4} align="right"><Typography variant="body1" fontWeight="bold">Total Weight:</Typography></TableCell>
                              <TableCell align="center"><Typography variant="body1" fontWeight="bold" color={totals[vaccine.id]?.[year]?.totalWeight === 1 ? 'inherit' : 'error'}>{(totals[vaccine.id]?.[year]?.totalWeight * 100).toFixed(0)}%</Typography></TableCell>
                              <TableCell align="right"><Typography variant="body1" fontWeight="bold">Final Administered:</Typography></TableCell>
                              <TableCell align="right"><Typography variant="body1" fontWeight="bold">{Math.round(totals[vaccine.id]?.[year]?.finalAdministered).toLocaleString()}</Typography></TableCell>
                          </TableRow>
                           <TableRow>
                              <TableCell colSpan={6} align="right"><Typography variant="body1" fontWeight="bold">Final w/ Wastage:</Typography></TableCell>
                              <TableCell align="right"><Typography variant="body1" fontWeight="bold">{Math.round(totals[vaccine.id]?.[year]?.finalWithWastage).toLocaleString()}</Typography></TableCell>
                          </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                ))}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Container>
    </ProtectedRoute>
  );
}