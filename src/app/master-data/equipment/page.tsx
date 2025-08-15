"use client";

import { useEffect, useState } from 'react';
import { Equipment } from '@/types';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import EquipmentFormModal from '@/components/EquipmentFormModal';

// MUI and MUI X Components
import { Box, Button, Typography, Paper } from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState<Partial<Equipment> | null>(null);

  useEffect(() => {
    const q = query(collection(db, "equipment"), orderBy("equipmentName"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const equipmentData: Equipment[] = [];
      querySnapshot.forEach((doc) => {
        equipmentData.push({ id: doc.id, ...doc.data() } as Equipment);
      });
      setEquipment(equipmentData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (equipmentItem: Partial<Equipment> | null) => {
    setCurrentEquipment(equipmentItem);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setCurrentEquipment(null);
    setIsModalOpen(false);
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      await deleteDoc(doc(db, 'equipment', id));
    }
  };

  const columns: GridColDef[] = [
    { field: 'equipmentName', headerName: 'Name', flex: 1.5 },
    { field: 'equipmentType', headerName: 'Type', flex: 1 },
    { field: 'equipmentCode', headerName: 'Code', flex: 0.7 },
    { field: 'equipmentCost', headerName: 'Cost/Box ($)', type: 'number', flex: 0.7 },
    {
      field: 'actions', type: 'actions', headerName: 'Actions', width: 100,
      getActions: (params) => [
        <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={() => handleOpenModal(params.row)} />,
        <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDelete(params.id as string)} />,
      ],
    },
  ];

  return (
    <ProtectedRoute>
      <Paper sx={{ p: 2, m: 2, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">Equipment Master Data</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal(null)}>
            Add New Equipment
          </Button>
        </Box>
        <Box sx={{ flexGrow: 1, height: '100%' }}>
          <DataGrid rows={equipment} columns={columns} loading={loading} />
        </Box>
      </Paper>
      <EquipmentFormModal open={isModalOpen} onClose={handleCloseModal} equipment={currentEquipment} />
    </ProtectedRoute>
  );
}