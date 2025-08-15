"use client";

import { useEffect, useState } from 'react';
import { Vaccine } from '@/types';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import VaccineFormModal from '@/components/VaccineFormModal';

// MUI and MUI X Components
import { Box, Button, Typography, Paper } from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export default function VaccinesPage() {
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentVaccine, setCurrentVaccine] = useState<Partial<Vaccine> | null>(null);

  useEffect(() => {
    const q = query(collection(db, "vaccines"), orderBy("vaccineName"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const vaccinesData: Vaccine[] = [];
      querySnapshot.forEach((doc) => {
        vaccinesData.push({ id: doc.id, ...doc.data() } as Vaccine);
      });
      setVaccines(vaccinesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (vaccine: Partial<Vaccine> | null) => {
    setCurrentVaccine(vaccine);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setCurrentVaccine(null);
    setIsModalOpen(false);
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this vaccine?')) {
      await deleteDoc(doc(db, 'vaccines', id));
    }
  };

  const columns: GridColDef[] = [
    { field: 'vaccineName', headerName: 'Vaccine Name', flex: 1.5 },
    { field: 'vaccineType', headerName: 'Type', flex: 1 },
    { field: 'pricePerDose', headerName: 'Price/Dose ($)', type: 'number', flex: 0.7 },
    { field: 'dosesPerVial', headerName: 'Doses/Vial', type: 'number', flex: 0.7 },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<EditIcon />}
          label="Edit"
          onClick={() => handleOpenModal(params.row)}
        />,
        <GridActionsCellItem
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => handleDelete(params.id as string)}
        />,
      ],
    },
  ];

  return (
    <ProtectedRoute>
      <Paper sx={{ p: 2, m: 2, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">Vaccine Master Data</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal(null)}>
            Add New Vaccine
          </Button>
        </Box>
        <Box sx={{ flexGrow: 1, height: '100%' }}>
          <DataGrid
            rows={vaccines}
            columns={columns}
            loading={loading}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </Box>
      </Paper>
      <VaccineFormModal open={isModalOpen} onClose={handleCloseModal} vaccine={currentVaccine} />
    </ProtectedRoute>
  );
}