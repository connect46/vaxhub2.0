"use client";

import React from 'react';
import { Paper, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, InputAdornment } from '@mui/material';

type ForecastData = {
  [vaccineId: string]: {
    vaccineName: string;
    years: {
      [year: number]: {
        dosesAdministered: number;
        wastageRate: number;
        dosesWithWastage: number;
      }
    }
  }
}

interface ConsumptionForecastResultsProps {
  forecastData: ForecastData; // The calculated forecast data
  onUpdate: (vaccineId: string, year: number, value: string) => void;
}

export default function ConsumptionForecastResults({ forecastData, onUpdate }: ConsumptionForecastResultsProps) {
  if (!forecastData || Object.keys(forecastData).length === 0) {
    return null;
  }
  
  const years = Object.keys(Object.values(forecastData)[0].years).sort();

  return (
    <Box sx={{ mt: 4 }}>
      {Object.entries(forecastData).map(([vaccineId, vaccineForecast]: [string, any]) => (
        <Paper key={vaccineId} sx={{ p: 3, mb: 3 }} variant="outlined">
          <Typography variant="h6" gutterBottom>{vaccineForecast.vaccineName} - Consumption Forecast</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Year</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Doses Administered</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Wastage Rate (%)</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Doses w/ Wastage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {years.map(year => {
                  const yearData = vaccineForecast.years[year];
                  return (
                    <TableRow key={year}>
                      <TableCell>{year}</TableCell>
                      <TableCell align="right">{Math.round(yearData.dosesAdministered).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <TextField
                          type="text"
                          variant="standard"
                          value={parseFloat((yearData.wastageRate * 100).toFixed(2))}
                          onChange={(e) => onUpdate(vaccineId, parseInt(year), e.target.value)}
                          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                          sx={{ input: { textAlign: "right", width: '80px' } }}
                        />
                      </TableCell>
                      <TableCell align="right">{Math.round(yearData.dosesWithWastage).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ))}
    </Box>
  );
}