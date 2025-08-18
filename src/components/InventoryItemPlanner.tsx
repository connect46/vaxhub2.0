"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Paper, Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Alert } from "@mui/material";
import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, LineController, BarController } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, LineController, BarController,  Tooltip, Legend, Filler);

interface PlannerProps {
  itemName: string;
  boyInventory: number;
  monthlyDemand: number[]; // Now an array for 12 months
  minInventoryMOS: number;
  maxInventoryMOS: number;
  procurementLimit: number;
  shipments: { [monthKey: string]: number };
  onShipmentsChange: (monthKey: string, value: number) => void;
}

interface PlanRow {
  month: string;
  beginningInv: number;
  demand: number;
  shipments: number;
  endingInv: number;
  minLevel: number;
  maxLevel: number;
  recommendedOrder: number;
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const planningYear = new Date().getFullYear() + 1;

export default function InventoryItemPlanner({ itemName, boyInventory, monthlyDemand, minInventoryMOS, maxInventoryMOS, procurementLimit, shipments, onShipmentsChange }: PlannerProps) {
  const [plan, setPlan] = useState<PlanRow[]>([]);

  useEffect(() => {
    const newPlan: PlanRow[] = [];
    let currentInventory = boyInventory;

    for (let i = 0; i < 12; i++) {
      const monthKey = `${planningYear}-${String(i + 1).padStart(2, '0')}`;
      const demand = monthlyDemand[i] || 0;
      
      const beginningInv = currentInventory;
      const minLevel = demand * minInventoryMOS;
      const maxLevel = demand * maxInventoryMOS;

      // Calculate recommended order
      const projectedEndInv = beginningInv - demand;
      let recommendedOrder = 0;
      if (projectedEndInv < minLevel) {
        recommendedOrder = Math.ceil(Math.max(0, maxLevel - projectedEndInv));
      }
      
      // Use the user's shipment if it exists, otherwise use the recommendation
      const finalShipment = shipments[monthKey] !== undefined ? shipments[monthKey] : recommendedOrder;
      const endingInv = beginningInv + finalShipment - demand;
      
      newPlan.push({ month: months[i], beginningInv, demand, shipments: finalShipment, endingInv, minLevel, maxLevel, recommendedOrder });
      currentInventory = endingInv;
    }
    setPlan(newPlan);
  }, [boyInventory, monthlyDemand, minInventoryMOS, maxInventoryMOS, shipments]);

  const totalPlannedShipments = useMemo(() => {
    return Object.values(shipments).reduce((sum, qty) => sum + qty, 0);
  }, [shipments]);

  const isOverBudget = procurementLimit > 0 && totalPlannedShipments > procurementLimit;

  const chartData = {
    labels: plan.map(p => p.month),
    datasets: [
      { type: 'line' as const, label: 'Ending Inventory', data: plan.map(p => p.endingInv), borderColor: '#3B82F6', fill: false, tension: 0.1, yAxisID: 'y' },
      { type: 'line' as const, label: 'Min Inventory', data: plan.map(p => p.minLevel), borderColor: '#FBBF24', borderDash: [5, 5], pointRadius: 0, fill: false, yAxisID: 'y' },
      { type: 'bar' as const, label: 'Shipments', data: plan.map(p => p.shipments), backgroundColor: 'rgba(34, 197, 94, 0.7)', yAxisID: 'y' },
      { type: 'bar' as const, label: 'Demand', data: plan.map(p => p.demand), backgroundColor: 'rgba(107, 114, 128, 0.5)', yAxisID: 'y' },
    ],
  };

  return (
    <Paper sx={{ p: 3, mb: 4 }} variant="outlined">
      <Typography variant="h6" gutterBottom>{itemName}</Typography>
      <Box sx={{ height: '300px', mb: 3 }}>
        <Chart type='bar' data={chartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { beginAtZero: true } } }} />
      </Box>

      {isOverBudget && (
        <Alert severity="warning" sx={{mb: 2}}>
          Total planned shipments ({totalPlannedShipments.toLocaleString()}) exceed the proposed procurement budget of {procurementLimit.toLocaleString()}.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Month</TableCell>
              <TableCell align="right">Beginning Inv.</TableCell>
              <TableCell align="right">Demand</TableCell>
              <TableCell align="center">Planned Shipments</TableCell>
              <TableCell align="right">Ending Inv.</TableCell>
              <TableCell align="right">Min Level</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plan.map((row, i) => (
              <TableRow key={row.month} sx={{backgroundColor: row.endingInv < row.minLevel ? '#fee2e2' : 'inherit'}}>
                <TableCell>{row.month} {planningYear}</TableCell>
                <TableCell align="right">{Math.round(row.beginningInv).toLocaleString()}</TableCell>
                <TableCell align="right">{Math.round(row.demand).toLocaleString()}</TableCell>
                <TableCell align="center">
                  <TextField 
                    type="text" 
                    variant="standard" 
                    placeholder={Math.round(row.recommendedOrder).toLocaleString()}
                    value={row.shipments.toLocaleString()}
                    onChange={(e) => onShipmentsChange(`${planningYear}-${String(i + 1).padStart(2, '0')}`, Number(e.target.value.replace(/,/g, '')))}
                    sx={{ input: { textAlign: "center", width: '100px' } }}
                  />
                </TableCell>
                <TableCell align="right" sx={{fontWeight: 'bold'}}>{Math.round(row.endingInv).toLocaleString()}</TableCell>
                <TableCell align="right" sx={{color: 'text.secondary'}}>{Math.round(row.minLevel).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}