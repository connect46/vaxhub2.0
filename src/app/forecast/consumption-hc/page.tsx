"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, onSnapshot, query, where, orderBy, limit, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { Vaccine, VaccineConsumptionData, ConsumptionHcForecast } from '@/types';
import ProtectedRoute from '@/components/ProtectedRoute';
import dayjs from 'dayjs';
import Papa from 'papaparse';

// MUI Components
import { Box, Button, Typography, Container, Paper, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, InputAdornment, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import ConsumptionForecastResults from '@/components/ConsumptionForecastResults'; // <-- Import the new component
import SaveIcon from '@mui/icons-material/Save';

// --- ADD THIS ENTIRE BLOCK ---
// Helper to generate the last 24 months for the table headers
const getPastMonths = () => {
  const months = [];
  let currentDate = dayjs();
  for (let i = 0; i < 24; i++) {
    const month = currentDate.subtract(i, 'month');
    months.push({
      key: month.format('YYYY-MM'), // e.g., "2025-08"
      display: month.format('MMM YYYY'), // e.g., "Aug 2025"
    });
  }
  return months;
};

const monthHeaders = getPastMonths();


// --- The Core Calculation Function ---
const calculateConsumptionForecast = (historicalData: { [key: string]: Partial<VaccineConsumptionData> }, countryData: any, vaccines: Vaccine[]) => {
  
    // --- ADD THIS LINE FOR DEBUGGING ---
  console.log("CALCULATION INPUTS:", { historicalData, countryData, vaccines });

  
  const results: any = {};
  const forecastStartYear = new Date().getFullYear() + 1;
  const forecastYears = Array.from({ length: 5 }, (_, i) => forecastStartYear + i);
  const growthRate = countryData.annualGrowthRate || 0;

  vaccines.forEach(vaccine => {
    const data = historicalData[vaccine.id];
    if (!data || !data.monthlyData) return;

    let totalAdjustedConsumption = 0;
    let monthCount = 0;

    Object.values(data.monthlyData).forEach(month => {
      if (month.consumption > 0 && month.reportingRate > 0) {
        totalAdjustedConsumption += month.consumption / month.reportingRate;
        monthCount++;
      }
    });

    if (monthCount === 0) return;

    const avgMonthlyConsumption = totalAdjustedConsumption / monthCount;
    let annualDoses = avgMonthlyConsumption * 12;

    results[vaccine.id] = {
      vaccineName: vaccine.vaccineName,
      years: {}
    };

    forecastYears.forEach((year, index) => {
      if (index > 0) {
        annualDoses *= (1 + growthRate); // Apply growth rate for subsequent years
      }
      const dosesAdministered = annualDoses;
      const wastageRate = data.avgWastageRate || 0;
      const dosesWithWastage = dosesAdministered > 0 ? dosesAdministered / (1 - wastageRate) : 0;

      results[vaccine.id].years[year] = {
        dosesAdministered,
        wastageRate,
        dosesWithWastage,
      };
    });
  });

  return results;
};


export default function ConsumptionForecastPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countryId, setCountryId] = useState<string | null>(null);
  const [countryData, setCountryData] = useState<any>(null);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [historicalData, setHistoricalData] = useState<{ [vaccineId: string]: Partial<VaccineConsumptionData> }>({});
  const [scenarioName, setScenarioName] = useState(`Consumption Forecast ${dayjs().format('YYYY-MM-DD')}`);
  const [loadedForecastId, setLoadedForecastId] = useState<string | null>(null);
  const [forecastResult, setForecastResult] = useState<any>(null); // State to hold calculated results

  useEffect(() => {
    if (!user) return;
    
    let unsubVaccines: (() => void) | undefined;
    
    const fetchInitialData = async () => {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) { setLoading(false); return; }
      
      const userCountryId = userDoc.data().country;
      setCountryId(userCountryId);

      // --- ADD THIS BLOCK TO FETCH COUNTRY DATA ---
      const countryDoc = await getDoc(doc(db, 'countries', userCountryId));
      if (countryDoc.exists()) {
          setCountryData(countryDoc.data());
      } else {
          console.error("Could not find country document for ID:", userCountryId);
      }
      // --- END OF BLOCK ---      

      // Fetch master list of all vaccines
      unsubVaccines = onSnapshot(collection(db, 'vaccines'), (snapshot) => {
        setVaccines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vaccine)));
      });

      // Fetch the latest saved consumption forecast scenario
      const forecastQuery = query(
        collection(db, "forecasts_consumption_hc"),
        where("country", "==", userCountryId),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const forecastSnapshot = await getDocs(forecastQuery);
      if (!forecastSnapshot.empty) {
        const latestForecastDoc = forecastSnapshot.docs[0];
        const latestForecast = latestForecastDoc.data() as ConsumptionHcForecast;
        
        setLoadedForecastId(latestForecastDoc.id);
        setScenarioName(latestForecast.scenarioName);
        setHistoricalData(latestForecast.historicalData || {});
        setForecastResult(latestForecast.results || null);
      }

      setLoading(false);
    };

    fetchInitialData();
    
    return () => { if(unsubVaccines) unsubVaccines(); }
  }, [user]);

  const handleDataChange = (vaccineId: string, monthKey: string, field: 'consumption' | 'reportingRate', value: string) => {
    const numericValue = Number(value) || 0;
    const isRate = field === 'reportingRate';
    
    setHistoricalData(prev => {
      const newData = JSON.parse(JSON.stringify(prev)); // Deep copy
      if (!newData[vaccineId]) newData[vaccineId] = { monthlyData: {} };
      if (!newData[vaccineId]!.monthlyData![monthKey]) newData[vaccineId]!.monthlyData![monthKey] = { consumption: 0, reportingRate: 0 };
      
      newData[vaccineId]!.monthlyData![monthKey][field] = isRate ? numericValue / 100 : numericValue;
      return newData;
    });
  };
  
  const handleWastageChange = (vaccineId: string, value: string) => {
    const numericValue = Number(value) / 100 || 0; // store as decimal
    setHistoricalData(prev => ({
      ...prev,
      [vaccineId]: {
        ...prev[vaccineId],
        avgWastageRate: numericValue,
      }
    }));
  };

  const handleDownloadTemplate = () => {
    const headers = ['VaccineId', 'VaccineName', 'Month (YYYY-MM)', 'Consumption', 'ReportingRate(%)'];
    let csvContent = headers.join(',') + '\n';

    vaccines.forEach(vaccine => {
      monthHeaders.forEach(month => {
        const row = [vaccine.id, `"${vaccine.vaccineName}"`, month.key, '', ''];
        csvContent += row.join(',') + '\n';
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'consumption_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };  

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data as { 
          VaccineId: string; 
          'Month (YYYY-MM)': string;
          Consumption: string;
          'ReportingRate(%)': string;
        }[];
        
        const newHistoricalData: { [vaccineId: string]: Partial<VaccineConsumptionData> } = {};

        parsedData.forEach(row => {
          const vaccineId = row.VaccineId;
          const monthKey = row['Month (YYYY-MM)'];
          const consumption = Number(row.Consumption) || 0;
          const reportingRate = (Number(row['ReportingRate(%)']) || 0) / 100;

          if (!vaccineId || !monthKey) return;

          if (!newHistoricalData[vaccineId]) {
            newHistoricalData[vaccineId] = { 
              // Preserve existing avgWastageRate if it exists
              avgWastageRate: historicalData[vaccineId]?.avgWastageRate || 0,
              monthlyData: {} 
            };
          }
          if (!newHistoricalData[vaccineId]!.monthlyData) {
              newHistoricalData[vaccineId]!.monthlyData = {};
          }
          
          newHistoricalData[vaccineId]!.monthlyData![monthKey] = { consumption, reportingRate };
        });

        // Merge with existing data to not lose avgWastageRate from other vaccines
        setHistoricalData(prev => ({...prev, ...newHistoricalData}));
        alert('CSV data uploaded successfully. Review the data and click "Save Data" to persist it.');
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        alert('Failed to parse CSV file.');
      }
    });
    // Reset file input so the same file can be uploaded again
    event.target.value = '';
  };

  const handleSaveForecast = async () => {
    if (!countryId) return;
    setSaving(true);
    try {
      // Sanitize historical data to ensure it's complete
      const sanitizedHistoricalData: { [vaccineId: string]: VaccineConsumptionData } = {};
      Object.entries(historicalData).forEach(([vaccineId, data]) => {
          sanitizedHistoricalData[vaccineId] = {
              avgWastageRate: data.avgWastageRate || 0,
              monthlyData: data.monthlyData || {},
          };
      });

      const dataToSave: Omit<ConsumptionHcForecast, 'id'> = {
        scenarioName,
        country: countryId,
        createdAt: Timestamp.now(),
        historicalData: sanitizedHistoricalData,
        results: forecastResult || {}, // Now saves the calculated results
      };

      if (loadedForecastId) {
        await setDoc(doc(db, 'forecasts_consumption_hc', loadedForecastId), dataToSave, { merge: true });
      } else {
        const newDocRef = await addDoc(collection(db, 'forecasts_consumption_hc'), dataToSave);
        setLoadedForecastId(newDocRef.id);
      }
      alert('Forecast saved successfully!');
    } catch (error) {
      console.error("Error saving forecast:", error);
      alert('Error saving forecast.');
    } finally {
      setSaving(false);
    }
  };

  const handleCalculateForecast = () => {
    // This improved check ensures countryData and its required fields are loaded
    if (!countryData || typeof countryData.annualGrowthRate === 'undefined') {
      alert("Cannot run forecast. Country demographic data (including annualGrowthRate) has not been loaded. Please ensure it's been saved on the Population Forecast page.");
      return;
    }
    if (vaccines.length === 0 || Object.keys(historicalData).length === 0) {
      alert("Cannot run forecast. Please ensure vaccine master data and historical consumption data have been entered and saved.");
      return;
    }
    const results = calculateConsumptionForecast(historicalData, countryData, vaccines);
    setForecastResult(results);
  };

  const handleForecastUpdate = (vaccineId: string, year: number, value: string) => {
    const newWastageRate = Number(value) / 100 || 0;
    setForecastResult((prev: any) => {
      const newResult = { ...prev };
      const yearData = newResult[vaccineId].years[year];
      yearData.wastageRate = newWastageRate;
      yearData.dosesWithWastage = yearData.dosesAdministered / (1 - newWastageRate);
      return newResult;
    });
  };  



  return (
    <ProtectedRoute>
      <Container maxWidth="xl">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>Consumption-Based Forecast (HC)</Typography>
          
          {loading ? <CircularProgress /> : (
            <>
              <Paper sx={{ p: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Typography variant="h6" component="h2" sx={{flexGrow: 1}}>
                      1. Enter Historical Data
                    </Typography>
                    <TextField 
                        label="Scenario Name" 
                        value={scenarioName} 
                        onChange={(e) => setScenarioName(e.target.value)} 
                        size="small" 
                    />
                </Box>
                <TableContainer>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ minWidth: 150, fontWeight: 'bold', zIndex: 10 }}>Vaccine</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Avg. Wastage Rate (%)</TableCell>
                        {monthHeaders.map(month => (
                          <React.Fragment key={month.key}>
                            <TableCell align="center" colSpan={2} sx={{ fontWeight: 'bold' }}>{month.display}</TableCell>
                          </React.Fragment>
                        ))}
                      </TableRow>
                       <TableRow>
                        <TableCell colSpan={2}></TableCell>
                        {monthHeaders.map(month => (
                          <React.Fragment key={`${month.key}-sub`}>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Consumption</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Rep. Rate %</TableCell>
                          </React.Fragment>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {vaccines.map(vaccine => (
                        <TableRow key={vaccine.id}>
                          <TableCell component="th" scope="row">{vaccine.vaccineName}</TableCell>
                          <TableCell align="right">
                            <TextField variant="standard" type="text"
                              value={Math.round(((historicalData[vaccine.id]?.avgWastageRate || 0) * 100))}
                              onChange={(e) => handleWastageChange(vaccine.id, e.target.value)}
                              sx={{ input: { textAlign: "right", width: '60px' } }}
                            />
                          </TableCell>
                          {monthHeaders.map(month => {
                            const data = historicalData[vaccine.id]?.monthlyData?.[month.key];
                            return (
                              <React.Fragment key={month.key}>
                                <TableCell align="right">
                                  <TextField variant="standard" type="text"
                                    value={data?.consumption?.toLocaleString() || ''}
                                    onChange={(e) => handleDataChange(vaccine.id, month.key, 'consumption', e.target.value.replace(/,/g, ''))}
                                    sx={{ input: { textAlign: "right", width: '100px' } }}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <TextField variant="standard" type="text"
                                    value={Math.round((data?.reportingRate || 0) * 100)}
                                    onChange={(e) => handleDataChange(vaccine.id, month.key, 'reportingRate', e.target.value)}
                                    sx={{ input: { textAlign: "right", width: '60px' } }}
                                  />
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                  {/* Connect the download handler */}
                  <Button variant="outlined" onClick={handleDownloadTemplate}>Download Template</Button>
                  <Button variant="outlined" component="label">
                    Upload CSV
                    {/* Connect the upload handler */}
                    <input type="file" hidden accept=".csv" onChange={handleFileUpload} />
                  </Button>
                </Box>
              </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" component="h2" gutterBottom>2. Calculate & View Forecast</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControl sx={{ minWidth: 240 }} size="small">
                <InputLabel>Method</InputLabel>
                <Select value="simple" label="Method">
                  <MenuItem value="simple">Simple Extrapolation</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" size="large" onClick={handleCalculateForecast}>
                Calculate Forecast
              </Button>
              <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleSaveForecast} disabled={!forecastResult || saving}>
                {saving ? <CircularProgress size={24} color="inherit" /> : 'Save Forecast'}
              </Button>              
            </Box>
            <ConsumptionForecastResults forecastData={forecastResult} onUpdate={handleForecastUpdate} />
          </Paper>
            </>
          )}
        </Box>
      </Container>
    </ProtectedRoute>
  );
}