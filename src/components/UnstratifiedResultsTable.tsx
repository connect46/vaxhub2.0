"use client";

import React, { useMemo } from 'react'; // <-- Import useMemo
import { UnstratifiedForecast } from '@/types';

// MUI Components
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails, Table, TableContainer, TableHead, TableRow, TableCell, TableBody, Paper, TextField, InputAdornment } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface UnstratifiedResultsTableProps {
  forecastData: { [vaccineId: string]: UnstratifiedForecast };
  onUpdate: (vaccineId: string, targetGroupId: string, year: number, field: 'coverageRate' | 'wastageRate', value: string) => void;
}

export default function UnstratifiedResultsTable({ forecastData, onUpdate }: UnstratifiedResultsTableProps) {
  if (!forecastData) return null;

  // --- NEW: Calculate aggregate totals for each vaccine ---
  const aggregateTotals = useMemo(() => {
    const totals: { [vaccineId: string]: { [year: number]: { totalAdministered: number, totalWithWastage: number } } } = {};
    Object.values(forecastData).forEach(vaccineForecast => {
      totals[vaccineForecast.id] = {};
      vaccineForecast.targetGroups.forEach(tg => {
        Object.entries(tg.years).forEach(([year, yearData]) => {
          if (!totals[vaccineForecast.id][Number(year)]) {
            totals[vaccineForecast.id][Number(year)] = { totalAdministered: 0, totalWithWastage: 0 };
          }
          totals[vaccineForecast.id][Number(year)].totalAdministered += yearData.dosesAdministered;
          totals[vaccineForecast.id][Number(year)].totalWithWastage += yearData.dosesWithWastage;
        });
      });
    });
    return totals;
  }, [forecastData]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
      {Object.values(forecastData).map((vaccineForecast) => (
        <Accordion key={vaccineForecast.id} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{vaccineForecast.vaccineName}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* --- NEW: Summary Table --- */}
            <Box>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">Annual Summary</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Year</TableCell>
                      <TableCell align="right">Total Doses Administered</TableCell>
                      <TableCell align="right">Total Doses w/ Wastage</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(aggregateTotals[vaccineForecast.id] || {}).map(([year, yearData]) => (
                      <TableRow key={year}>
                        <TableCell>{year}</TableCell>
                        <TableCell align="right">{Math.round(yearData.totalAdministered).toLocaleString()}</TableCell>
                        <TableCell align="right">{Math.round(yearData.totalWithWastage).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* --- Detailed Breakdown Table (now in its own accordion) --- */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Detailed Breakdown by Target Group</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Target Group</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Year</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Coverage (%)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Wastage (%)</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Doses Administered</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Doses w/ Wastage</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {vaccineForecast.targetGroups.flatMap(tg => 
                        Object.entries(tg.years).map(([year, yearData], index) => (
                          <TableRow key={`${tg.targetGroupId}-${year}`}>
                            {index === 0 && <TableCell rowSpan={Object.keys(tg.years).length}>{tg.targetGroupName}</TableCell>}
                            <TableCell>{year}</TableCell>
                            <TableCell align="right">
                              <TextField type="text" variant="standard" value={parseFloat((yearData.coverageRate * 100).toFixed(2))} onChange={(e) => onUpdate(vaccineForecast.id, tg.targetGroupId, parseInt(year), 'coverageRate', e.target.value)} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} sx={{ input: { textAlign: "right", width: '80px' } }} />
                            </TableCell>
                            <TableCell align="right">
                              <TextField type="text" variant="standard" value={parseFloat((yearData.wastageRate * 100).toFixed(2))} onChange={(e) => onUpdate(vaccineForecast.id, tg.targetGroupId, parseInt(year), 'wastageRate', e.target.value)} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} sx={{ input: { textAlign: "right", width: '80px' } }} />
                            </TableCell>
                            <TableCell align="right">{Math.round(yearData.dosesAdministered).toLocaleString()}</TableCell>
                            <TableCell align="right">{Math.round(yearData.dosesWithWastage).toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}