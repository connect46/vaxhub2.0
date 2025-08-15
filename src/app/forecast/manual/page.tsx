"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { Vaccine, ManualForecast } from '@/types';
import ProtectedRoute from '@/components/ProtectedRoute';
import Papa from 'papaparse';

// MUI Components
import { Box, Button, Typography, Container, Paper, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

const forecastYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i + 1);

export default function ManualForecastPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countryId, setCountryId] = useState<string | null>(null);

  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [manualForecasts, setManualForecasts] = useState<{ [vaccineId: string]: Partial<ManualForecast> }>({});

  useEffect(() => {
    if (!user) return;
    
    let unsubVaccines: () => void;
    let unsubForecasts: () => void;

    const fetchInitialData = async () => {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) { setLoading(false); return; }
      
      const userCountryId = userDoc.data().country;
      setCountryId(userCountryId);

      unsubVaccines = onSnapshot(collection(db, 'vaccines'), (snapshot) => {
        setVaccines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vaccine)));
      });

      const forecastQuery = query(collection(db, "forecasts_manual"), where("country", "==", userCountryId));
      unsubForecasts = onSnapshot(forecastQuery, (snapshot) => {
        const forecastsData: { [vaccineId: string]: Partial<ManualForecast> } = {};
        snapshot.forEach((doc) => {
          forecastsData[doc.id] = doc.data() as ManualForecast;
        });
        setManualForecasts(forecastsData);
        setLoading(false);
      });
    };

    fetchInitialData();
    
    return () => {
      if (unsubVaccines) unsubVaccines();
      if (unsubForecasts) unsubForecasts();
    };
  }, [user]);

  const handleDataChange = (vaccineId: string, year: number, field: 'dosesAdministered' | 'dosesWithWastage', value: string) => {
    const numericValue = parseInt(value.replace(/,/g, ''), 10) || 0;
    
    setManualForecasts(prev => {
      // Create a deep copy to safely modify the nested structure
      const newState = JSON.parse(JSON.stringify(prev));
      
      // Ensure the path to the property exists
      if (!newState[vaccineId]) {
          newState[vaccineId] = { years: {} };
      }
      if (!newState[vaccineId].years) {
          newState[vaccineId].years = {};
      }
      if (!newState[vaccineId].years[year]) {
          newState[vaccineId].years[year] = { dosesAdministered: 0, dosesWithWastage: 0 };
      }

      // Update the specific value
      newState[vaccineId].years[year][field] = numericValue;

      return newState;
    });
  };

  const handleDescriptionChange = (vaccineId: string, value: string) => {
     setManualForecasts(prev => ({
      ...prev,
      [vaccineId]: { ...prev[vaccineId], description: value }
    }));
  };

  const handleSaveForecasts = async () => {
    if (!countryId) return;
    setSaving(true);
    try {
      for (const vaccineId in manualForecasts) {
        if (Object.keys(manualForecasts[vaccineId]).length > 0) {
          const forecastDocRef = doc(db, 'forecasts_manual', vaccineId);
          const dataToSave = {
            ...manualForecasts[vaccineId],
            id: vaccineId,
            country: countryId,
            vaccineName: vaccines.find(v => v.id === vaccineId)?.vaccineName,
            lastUpdated: Timestamp.now(),
          };
          await setDoc(forecastDocRef, dataToSave, { merge: true });
        }
      }
      alert('Manual forecasts saved successfully!');
    } catch (error) {
      console.error("Error saving forecasts:", error);
      alert('Error saving forecasts.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ['VaccineId', 'VaccineName', 'Description', 'Year', 'DosesAdministered', 'DosesWithWastage'];
    let csvContent = headers.join(',') + '\n';

    vaccines.forEach(vaccine => {
      forecastYears.forEach(year => {
        const row = [
          vaccine.id,
          `"${vaccine.vaccineName}"`,
          '', // Description placeholder
          year,
          '', // DosesAdministered placeholder
          ''  // DosesWithWastage placeholder
        ];
        csvContent += row.join(',') + '\n';
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'manual_forecast_template.csv');
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
        const parsedData = results.data as any[];
        const newForecasts: { [vaccineId: string]: Partial<ManualForecast> } = {};

        parsedData.forEach(row => {
          const vaccineId = row.VaccineId;
          const year = parseInt(row.Year, 10);
          if (!vaccineId || !year) return;

          if (!newForecasts[vaccineId]) {
            newForecasts[vaccineId] = {
              description: row.Description || '',
              years: {}
            };
          }

          newForecasts[vaccineId].years![year] = {
            dosesAdministered: parseInt(row.DosesAdministered, 10) || 0,
            dosesWithWastage: parseInt(row.DosesWithWastage, 10) || 0,
          };
        });

        setManualForecasts(prev => ({ ...prev, ...newForecasts }));
        alert('CSV data uploaded. Review the data and click "Save All" to persist it.');
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        alert('Failed to parse CSV file.');
      }
    });
    event.target.value = ''; // Reset file input
  };


  return (
    <ProtectedRoute>
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" component="h1">Manual Forecast Entry</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" component="label">
              Upload CSV
              <input type="file" hidden accept=".csv" onChange={handleFileUpload} />
            </Button>
            <Button variant="outlined" onClick={handleDownloadTemplate}>
              Download Template
            </Button>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveForecasts} disabled={saving}>
              {saving ? <CircularProgress size={24} color="inherit" /> : 'Save All Forecasts'}
            </Button>
          </Box>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Enter or upload externally generated forecast data for each vaccine.
          </Typography>

          {loading ? <CircularProgress /> : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {vaccines.map(vaccine => {
                const forecast = manualForecasts[vaccine.id] || {};
                return (
                  <Paper key={vaccine.id} sx={{ p: 3 }}>
                    <Typography variant="h6" component="h2" gutterBottom>{vaccine.vaccineName}</Typography>
                    <TextField
                      fullWidth
                      label="Description"
                      variant="outlined"
                      size="small"
                      value={forecast.description || ''}
                      onChange={(e) => handleDescriptionChange(vaccine.id, e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Year</TableCell>
                            <TableCell align="right">Doses Administered</TableCell>
                            <TableCell align="right">Doses w/ Wastage</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {forecastYears.map(year => (
                            <TableRow key={year}>
                              <TableCell>{year}</TableCell>
                              <TableCell align="right">
                                <TextField
                                  type="text"
                                  variant="standard"
                                  value={forecast.years?.[year]?.dosesAdministered.toLocaleString() || ''}
                                  onChange={(e) => handleDataChange(vaccine.id, year, 'dosesAdministered', e.target.value)}
                                  sx={{ input: { textAlign: "right" } }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <TextField
                                  type="text"
                                  variant="standard"
                                  value={forecast.years?.[year]?.dosesWithWastage.toLocaleString() || ''}
                                  onChange={(e) => handleDataChange(vaccine.id, year, 'dosesWithWastage', e.target.value)}
                                  sx={{ input: { textAlign: "right" } }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
        {/* We can add the CSV buttons and logic here later */}
      </Container>
    </ProtectedRoute>
  );
}