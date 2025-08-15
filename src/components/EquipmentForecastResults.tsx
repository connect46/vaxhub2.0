"use client";

import React from 'react';
import { EquipmentForecast } from '@/types';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails, Table, TableContainer, TableHead, TableRow, TableCell, TableBody, Paper } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface EquipmentForecastResultsProps {
  forecast: EquipmentForecast;
}

type GroupedResults = { [category: string]: EquipmentForecast['results'] };

export default function EquipmentForecastResults({ forecast }: EquipmentForecastResultsProps) {
  if (!forecast || !forecast.results) return null;

  // Group programs by category for display
  const groupedResults = forecast.results.reduce((acc, program) => {
    const category = program.programCategory;
    if (!acc[category]) acc[category] = [];
    acc[category].push(program);
    return acc;
  }, {} as GroupedResults);
  
  const years = forecast.results[0]?.equipment[0] ? Object.keys(forecast.results[0].equipment[0].yearlyQuantities).sort() : [];

  return (
    <Paper sx={{ p: 3, mt: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Equipment Forecast Details
      {/* // for "{forecast.scenarioName} */}
      </Typography>
      {Object.entries(groupedResults).map(([category, programs]) => (
        <Accordion key={category} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{category}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {programs.map(program => (
              <Accordion key={program.programId}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight="bold">{program.programName}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Equipment</TableCell>
                          {years.map(year => <TableCell key={year} align="right">{year}</TableCell>)}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {program.equipment.map(item => (
                          <TableRow key={item.equipmentId}>
                            <TableCell>{item.equipmentName}</TableCell>
                            {years.map(year => (
                              <TableCell key={year} align="right">{Math.ceil(item.yearlyQuantities[parseInt(year)] || 0).toLocaleString()}</TableCell>
                            ))}
                          </TableRow>
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
  );
}