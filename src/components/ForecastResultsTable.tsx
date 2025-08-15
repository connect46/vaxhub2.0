"use client";

import { UnstratifiedForecast } from '@/types';
import { Accordion, AccordionDetails, AccordionSummary, Box, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import React from 'react';

interface ForecastResultsTableProps {
  forecastData: { [vaccineId: string]: UnstratifiedForecast };
  onUpdate: (vaccineId: string, targetGroupId: string, year: number, field: 'coverageRate' | 'wastageRate', value: number) => void;
}

export default function ForecastResultsTable({ forecastData, onUpdate }: ForecastResultsTableProps) {
  const years = Object.keys(Object.values(forecastData)[0]?.targetGroups[0]?.years || {}).sort();

  return (
    <Box>
      {Object.values(forecastData).map((vaccineForecast) => (
        <Accordion key={vaccineForecast.id} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{vaccineForecast.vaccineName}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Target Group</TableCell>
                    {years.map(year => (
                      <TableCell key={year} colSpan={4} align="center" sx={{ fontWeight: 'bold', borderLeft: '1px solid rgba(224, 224, 224, 1)' }}>{year}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell></TableCell>
                    {years.map(year => (
                      <React.Fragment key={year}>
                        <TableCell align="right" sx={{ borderLeft: '1px solid rgba(224, 224, 224, 1)' }}>Coverage</TableCell>
                        <TableCell align="right">Wastage</TableCell>
                        <TableCell align="right">Doses Admin.</TableCell>
                        <TableCell align="right">Doses w/ Wastage</TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vaccineForecast.targetGroups.map(tg => (
                    <TableRow key={tg.targetGroupId}>
                      <TableCell>{tg.targetGroupName}</TableCell>
                      {years.map(year => {
                        const yearData = tg.years[parseInt(year)];
                        return (
                          <React.Fragment key={year}>
                            <TableCell align="right" sx={{ borderLeft: '1px solid rgba(224, 224, 224, 1)' }}>
                              <TextField
                                type="number" variant="standard"
                                value={(yearData.coverageRate * 100).toFixed(0)}
                                onChange={(e) => onUpdate(vaccineForecast.id, tg.targetGroupId, parseInt(year), 'coverageRate', Number(e.target.value) / 100)}
                                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                                sx={{ input: { textAlign: "right", width: '60px' } }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number" variant="standard"
                                value={(yearData.wastageRate * 100).toFixed(0)}
                                onChange={(e) => onUpdate(vaccineForecast.id, tg.targetGroupId, parseInt(year), 'wastageRate', Number(e.target.value) / 100)}
                                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                                sx={{ input: { textAlign: "right", width: '60px' } }}
                              />
                            </TableCell>
                            <TableCell align="right">{Math.round(yearData.dosesAdministered).toLocaleString()}</TableCell>
                            <TableCell align="right">{Math.round(yearData.dosesWithWastage).toLocaleString()}</TableCell>
                          </React.Fragment>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}