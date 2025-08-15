"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Stratum, Program, StratumParameter, StratifiedForecast } from '@/types';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc, addDoc, Timestamp, orderBy, limit, getDocs, setDoc } from 'firebase/firestore';
import dayjs from 'dayjs';

// MUI Components
import { Box, Button, Typography, Container, Paper, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Divider, Accordion, AccordionSummary, AccordionDetails, InputAdornment, CircularProgress } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';


const currentYear = new Date().getFullYear();
const INPUT_FORECAST_YEARS = Array.from({ length: 5 }, (_, i) => currentYear + i + 1);

// --- The core calculation function ---
const calculateStratifiedForecast = (
  programs: Program[],
  countryData: any,
  strata: Stratum[],
  strataParams: { [stratumId: string]: StratumParameter }
) => {
  const results: any = {}; // Temporary object for aggregation
  const forecastStartYear = new Date().getFullYear() + 1;
  const forecastYears = Array.from({ length: 5 }, (_, i) => forecastStartYear + i);

  // 1. Loop through all programs, vaccines, doses, and strata to calculate needs
  programs.forEach(program => {
    program.vaccines.forEach(programVaccine => {
      Object.entries(programVaccine.doseAssignments).forEach(([doseNumber, assignment]) => {
        const targetGroupDef = countryData.targetGroups.find((tg: any) => tg.id === assignment.targetGroupId);
        if (!targetGroupDef) return;

        strata.forEach(stratum => {
          forecastYears.forEach(year => {
            const countryPopulation = countryData.projections.find((p: any) => p.year === year)?.population || 0;
            const targetGroupPopulation = countryPopulation * (targetGroupDef.percentage / 100);
            const stratumPercentageForYear = (stratum.percentages[year] || 0) / 100;
            const stratifiedTargetPopulation = targetGroupPopulation * stratumPercentageForYear;

            const params = strataParams[stratum.id]?.[program.id] || { coverageRate: 0, wastageRate: 0 };
            
            const dosesAdministered = stratifiedTargetPopulation * params.coverageRate;
            const dosesWithWastage = dosesAdministered > 0 ? dosesAdministered / (1 - params.wastageRate) : 0;

            // 2. Aggregate results into a structured object
            const cat = program.programCategory;
            const vacId = programVaccine.vaccineId;
            const stratumId = stratum.id;
            const tgId = targetGroupDef.id;

            if (!results[cat]) results[cat] = {};
            if (!results[cat][vacId]) results[cat][vacId] = { vaccineName: programVaccine.vaccineName, strata: {} };
            if (!results[cat][vacId].strata[stratumId]) results[cat][vacId].strata[stratumId] = { stratumName: stratum.name, targetGroups: {} };
            if (!results[cat][vacId].strata[stratumId].targetGroups[tgId]) {
              results[cat][vacId].strata[stratumId].targetGroups[tgId] = { targetGroupName: targetGroupDef.name, years: {} };
            }
            if (!results[cat][vacId].strata[stratumId].targetGroups[tgId].years[year]) {
              results[cat][vacId].strata[stratumId].targetGroups[tgId].years[year] = { dosesAdministered: 0, dosesWithWastage: 0 };
            }
            
            results[cat][vacId].strata[stratumId].targetGroups[tgId].years[year].dosesAdministered += dosesAdministered;
            results[cat][vacId].strata[stratumId].targetGroups[tgId].years[year].dosesWithWastage += dosesWithWastage;
          });
        });
      });
    });
  });

  return { results, forecastYears };
};


export default function StratifiedForecastPage() {
  const { user } = useAuth();
  const [strata, setStrata] = useState<Stratum[]>([]);
  const [newStratumName, setNewStratumName] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [countryData, setCountryData] = useState<any>(null);
  const [strataParams, setStrataParams] = useState<{ [stratumId: string]: StratumParameter }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scenarioName, setScenarioName] = useState(`Forecast ${dayjs().format('YYYY-MM-DD')}`);
  const [forecastResult, setForecastResult] = useState<any>(null);
  const [forecastYears, setForecastYears] = useState<number[]>([]);
  const [loadedForecastId, setLoadedForecastId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let unsubPrograms: (() => void) | undefined;
    
    // This function now securely fetches all data
    const fetchInitialData = async () => {
        setLoading(true);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            console.error("User profile not found");
            setLoading(false); 
            return;
        }
        const userCountry = userDoc.data().country;

        // Fetch the country data needed for calculations
        const countryDoc = await getDoc(doc(db, 'countries', userCountry));
        if (countryDoc.exists()) {
            setCountryData(countryDoc.data());
        }

        // Create a secure query that filters programs by the user's country
        const programsQuery = query(collection(db, "programs"), where("country", "==", userCountry));
        
        // The listener will now only receive programs the user is allowed to see
        unsubPrograms = onSnapshot(programsQuery, (snapshot) => {
            setPrograms(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Program)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching programs:", error);
            setLoading(false);
        });

        // --- THIS IS THE NEW LOGIC TO LOAD THE LATEST FORECAST ---
        const forecastQuery = query(
          collection(db, "forecasts_stratified"),
          where("country", "==", userCountry),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const forecastSnapshot = await getDocs(forecastQuery);
        if (!forecastSnapshot.empty) {
          const latestForecastDoc = forecastSnapshot.docs[0];
          const latestForecast = latestForecastDoc.data() as StratifiedForecast;
          
          setLoadedForecastId(latestForecastDoc.id);
          setScenarioName(latestForecast.scenarioName);
          setStrata(latestForecast.strataDefinitions);
          setStrataParams(latestForecast.strataParameters);
          setForecastResult(latestForecast.results);
          setForecastYears(latestForecast.forecastYears || []);
        }
        // --- END OF NEW LOGIC ---        
        setLoading(false);

    };
    
    fetchInitialData();

    return () => {
      if (unsubPrograms) unsubPrograms();
    };
  }, [user]);

  const handleAddStratum = () => {
    if (!newStratumName.trim()) return;
    const newStratum: Stratum = {
      id: new Date().getTime().toString(),
      name: newStratumName.trim(),
      percentages: INPUT_FORECAST_YEARS.reduce((acc, year) => ({ ...acc, [year]: 0 }), {})
    };
    setStrata([...strata, newStratum]);
    setNewStratumName('');
  };

  const handleRemoveStratum = (idToRemove: string) => {
    setStrata(strata.filter(s => s.id !== idToRemove));
  };

  const handleStratumChange = (id: string, year: number, value: string) => {
    const percentage = value === '' ? 0 : parseFloat(value) || 0;
    setStrata(strata.map(s => 
      s.id === id ? { ...s, percentages: { ...s.percentages, [year]: percentage } } : s
    ));
  };

  const handleParamChange = (stratumId: string, programId: string, field: 'coverageRate' | 'wastageRate', value: string) => {
    const percentage = value === '' ? 0 : parseFloat(value) || 0;
    const decimalValue = percentage / 100;

    setStrataParams(prev => ({
      ...prev,
      [stratumId]: {
        ...prev[stratumId],
        [programId]: {
          ...(prev[stratumId]?.[programId] || { coverageRate: 0, wastageRate: 0 }),
          [field]: decimalValue
        }
      }
    }));
  };

  const yearlyTotals = useMemo(() => {
    return INPUT_FORECAST_YEARS.map(year => 
      strata.reduce((sum, s) => sum + (Number(s.percentages[year]) || 0), 0)
    );
  }, [strata]);

  const handleRunForecast = () => {
    if (!countryData || programs.length === 0 || strata.length === 0) {
        alert("Please define programs, strata, and parameters before running the forecast.");
        return;
    }
    const { results, forecastYears: years } = calculateStratifiedForecast(programs, countryData, strata, strataParams);
    setForecastResult(results);
    setForecastYears(years);
  };
  
  // --- UPDATED SAVE FUNCTION ---
  const handleSaveForecast = async () => {
    if (!forecastResult || !user) return;
    setSaving(true);
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const countryId = userDoc.data()?.country;
        if (!countryId) throw new Error("User country not found.");

        const forecastToSave: Omit<StratifiedForecast, 'id'> = {
            scenarioName,
            country: countryId,
            createdAt: Timestamp.now(), // Firestore will use this for a new doc
            strataDefinitions: strata,
            strataParameters: strataParams,
            results: forecastResult,
            forecastYears: forecastYears,
        };

        if (loadedForecastId) {
            // If we loaded a forecast, update it
            await setDoc(doc(db, 'forecasts_stratified', loadedForecastId), forecastToSave, { merge: true });
        } else {
            // Otherwise, create a new one
            const newDocRef = await addDoc(collection(db, 'forecasts_stratified'), forecastToSave);
            setLoadedForecastId(newDocRef.id); // Set the ID so the next save is an update
        }
        alert('Forecast saved successfully!');
    } catch (error) {
        console.error("Error saving forecast: ", error);
        alert('Error saving forecast.');
    } finally {
        setSaving(false);
    }
  };
  return (
    <ProtectedRoute>
      <Container maxWidth="xl">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Stratified Forecast Scenario Builder
          </Typography>
          
          <Paper sx={{ p: 3, mt: 4 }}>
             <Typography variant="h6" component="h2" gutterBottom>
              Step 1: Define Population Strata
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
              <TextField 
                label="New Stratum Name"
                value={newStratumName}
                onChange={(e) => setNewStratumName(e.target.value)}
                variant="outlined"
                size="small"
              />
              <Button 
                variant="contained" 
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleAddStratum}
              >
                Add Stratum
              </Button>
            </Box>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Stratum Name</TableCell>
                    {INPUT_FORECAST_YEARS.map(year => (
                      <TableCell key={year} align="right" sx={{ fontWeight: 'bold' }}>{year} Pop %</TableCell>
                    ))}
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {strata.map((stratum) => (
                    <TableRow key={stratum.id}>
                      <TableCell>{stratum.name}</TableCell>
                      {INPUT_FORECAST_YEARS.map(year => (
                        <TableCell key={year} align="right">
                          <TextField 
                            type="text"
                            variant="standard"
                            value={stratum.percentages[year]}
                            onChange={(e) => handleStratumChange(stratum.id, year, e.target.value)}
                            sx={{ input: { textAlign: "right", width: '60px' } }}
                          />
                        </TableCell>
                      ))}
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => handleRemoveStratum(stratum.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ '& td': { fontWeight: 'bold', borderTop: '2px solid black' } }}>
                    <TableCell>Total %</TableCell>
                    {yearlyTotals.map((total, index) => (
                      <TableCell 
                        key={INPUT_FORECAST_YEARS[index]} 
                        align="right"
                        sx={{ color: total > 100 ? 'error.main' : 'inherit' }}
                      >
                        {total.toFixed(1)}%
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Note: The total percentage can exceed 100% to account for transient populations like refugees, but a warning color will be shown.
            </Typography>
          </Paper>

          <Paper sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Step 2: Set Coverage & Wastage by Program and Stratum
            </Typography>
            {loading ? <CircularProgress /> : (
              <Box>
                {programs.map(program => (
                  <Accordion key={program.id}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>{program.programName} ({program.programCategory})</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Stratum</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }} align="right">Coverage Rate</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }} align="right">Wastage Rate</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {strata.map(stratum => (
                              <TableRow key={stratum.id}>
                                <TableCell>{stratum.name}</TableCell>
                                <TableCell align="right">
                                  <TextField 
                                    type="text"
                                    variant="standard"
                                    value={parseFloat(((strataParams[stratum.id]?.[program.id]?.coverageRate || 0) * 100).toFixed(2))}
                                    onChange={(e) => handleParamChange(stratum.id, program.id, 'coverageRate', e.target.value)}
                                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                                    sx={{ input: { textAlign: "right", width: '80px' } }}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                <TextField 
                                    type="text"
                                    variant="standard"
                                    value={parseFloat(((strataParams[stratum.id]?.[program.id]?.wastageRate || 0) * 100).toFixed(2))}
                                    onChange={(e) => handleParamChange(stratum.id, program.id, 'wastageRate', e.target.value)}
                                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                                    sx={{ input: { textAlign: "right", width: '80px' } }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Step 3: Run & Save Forecast
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField label="Forecast Scenario Name" value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} size="small" sx={{flexGrow: 1}} />
                <Button variant="contained" size="large" startIcon={<PlayArrowIcon />} onClick={handleRunForecast} disabled={loading}>Run Forecast</Button>
                <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleSaveForecast} disabled={!forecastResult || saving}>
                    {saving ? <CircularProgress size={24} color="inherit" /> : 'Save Forecast'}
                </Button>
            </Box>
          </Paper>

         {forecastResult && (
            <Paper sx={{ p: 3, mt: 4 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Forecast Results for "{scenarioName}"
              </Typography>
              {Object.entries(forecastResult).map(([category, vaccines]: [string, any]) => (
                <Accordion key={category} defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="h6">{category}</Typography></AccordionSummary>
                  <AccordionDetails>
                    {Object.entries(vaccines).map(([vaccineId, vaccineData]: [string, any]) => (
                      <Accordion key={vaccineId} sx={{ '&.Mui-expanded': { margin: 0 } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="subtitle1" fontWeight="bold">{vaccineData.vaccineName}</Typography></AccordionSummary>
                        <AccordionDetails>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell rowSpan={2}>Stratum</TableCell>
                                  <TableCell rowSpan={2}>Target Group</TableCell>
                                  {/* Each year now spans two columns */}
                                  {forecastYears.map(year => <TableCell key={year} align="center" colSpan={2} sx={{borderLeft: '1px solid rgba(224, 224, 224, 1)'}}>{year}</TableCell>)}
                                </TableRow>
                                <TableRow>
                                  {/* Add sub-headers for the two dose types */}
                                  {forecastYears.map(year => (
                                    <React.Fragment key={year}>
                                      <TableCell align="right" sx={{borderLeft: '1px solid rgba(224, 224, 224, 1)'}}>Doses Admin.</TableCell>
                                      <TableCell align="right">Doses w/ Wastage</TableCell>
                                    </React.Fragment>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {Object.entries(vaccineData.strata).map(([stratumId, stratumData]: [string, any]) => (
                                  Object.entries(stratumData.targetGroups).map(([tgId, tgData]: [string, any], index) => (
                                    <TableRow key={`${stratumId}-${tgId}`}>
                                      {index === 0 && <TableCell rowSpan={Object.keys(stratumData.targetGroups).length}>{stratumData.stratumName}</TableCell>}
                                      <TableCell>{tgData.targetGroupName}</TableCell>
                                      {/* Render both dose values for each year */}
                                      {forecastYears.map(year => (
                                        <React.Fragment key={year}>
                                          <TableCell align="right" sx={{borderLeft: '1px solid rgba(224, 224, 224, 1)'}}>{Math.round(tgData.years[year]?.dosesAdministered || 0).toLocaleString()}</TableCell>
                                          <TableCell align="right">{Math.round(tgData.years[year]?.dosesWithWastage || 0).toLocaleString()}</TableCell>
                                        </React.Fragment>
                                      ))}
                                    </TableRow>
                                  ))
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Paper>
          )}
        </Box>
      </Container>
    </ProtectedRoute>
  );
}