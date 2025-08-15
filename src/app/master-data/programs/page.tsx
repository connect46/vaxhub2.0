// src/app/master-data/programs/page.tsx

"use client";

import { useEffect, useState } from 'react';
import { Program } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, doc, getDoc, orderBy, deleteDoc } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import ProgramFormModal from '@/components/ProgramFormModal';

// MUI Components
import { 
  Box, Button, Typography, Container, CircularProgress, Accordion, 
  AccordionSummary, AccordionDetails, List, ListItem, ListItemText, 
  IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// Define the shape of the grouped programs and target group objects
type GroupedPrograms = { [category: string]: Program[] };
interface TargetGroup { id: string; name: string; }

export default function ProgramsPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [groupedPrograms, setGroupedPrograms] = useState<GroupedPrograms>({});
  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([]); // <-- NEW state for target groups
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);

  // Updated useEffect to fetch both programs and target groups
  useEffect(() => {
    if (!user) return;

    let unsubPrograms: () => void;
    const fetchInitialData = async () => {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userCountry = userDocSnap.data().country;
        
        // Fetch target groups for the user's country
        const countryDocRef = doc(db, 'countries', userCountry);
        const countryDocSnap = await getDoc(countryDocRef);
        if (countryDocSnap.exists()) {
          setTargetGroups(countryDocSnap.data().targetGroups || []);
        }

        // Fetch programs for the user's country
        const q = query(collection(db, "programs"), where("country", "==", userCountry), orderBy("programName"));
        unsubPrograms = onSnapshot(q, (querySnapshot) => {
          const programsData: Program[] = [];
          querySnapshot.forEach((doc) => {
            programsData.push({ id: doc.id, ...doc.data() } as Program);
          });
          setPrograms(programsData);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    };

    fetchInitialData();

    return () => { if (unsubPrograms) unsubPrograms(); };
  }, [user]);

  // useEffect for grouping programs (unchanged)
  useEffect(() => {
    const grouped = programs.reduce((acc, program) => {
      const category = program.programCategory;
      if (!acc[category]) { acc[category] = []; }
      acc[category].push(program);
      return acc;
    }, {} as GroupedPrograms);
    setGroupedPrograms(grouped);
  }, [programs]);
  
  // Helper function to find a target group name by its ID
  const getTargetGroupName = (id: string) => {
    const targetGroup = targetGroups.find(tg => tg.id === id);
    return targetGroup ? targetGroup.name : 'Unknown';
  };

  // Handlers for modal and actions (unchanged)
  const handleOpenModal = (program: Program | null) => { setCurrentProgram(program); setIsModalOpen(true); };
  const handleCloseModal = () => { setCurrentProgram(null); setIsModalOpen(false); };
  const handleDelete = async (programId: string) => {
    if (window.confirm('Are you sure you want to delete this program?')) {
      await deleteDoc(doc(db, 'programs', programId));
    }
  };

  return (
    <ProtectedRoute>
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" component="h1">Program Management</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenModal(null)}>Add New Program</Button>
          </Box>
          
          {loading ? <CircularProgress /> : (
            <Box>
              {Object.keys(groupedPrograms).length > 0 ? (
                Object.keys(groupedPrograms).map((category) => (
                  <Accordion key={category} defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="h6">{category}</Typography></AccordionSummary>
                    <AccordionDetails>
                      <List>
                        {groupedPrograms[category].map((program) => (
                          <ListItem key={program.id} divider sx={{ display: 'block' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <ListItemText primary={program.programName} primaryTypographyProps={{ fontWeight: 'bold' }} />
                              <Box>
                                <IconButton edge="end" onClick={() => handleOpenModal(program)}><EditIcon /></IconButton>
                                <IconButton edge="end" onClick={() => handleDelete(program.id)}><DeleteIcon /></IconButton>
                              </Box>
                            </Box>
                            
                            {/* --- UPDATED: Nested table for vaccine/dose details --- */}
                            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{fontWeight: 'bold'}}>Vaccine</TableCell>
                                    <TableCell sx={{fontWeight: 'bold'}} align="center">Dose</TableCell>
                                    <TableCell sx={{fontWeight: 'bold'}}>Target Group</TableCell>
                                    <TableCell sx={{fontWeight: 'bold'}} align="right">Coverage</TableCell>
                                    <TableCell sx={{fontWeight: 'bold'}} align="right">Wastage</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {program.vaccines.map((vaccine) => 
                                    Object.entries(vaccine.doseAssignments).map(([doseNumber, assignment]) => (
                                      <TableRow key={`${vaccine.vaccineId}-${doseNumber}`}>
                                        <TableCell component="th" scope="row">{vaccine.vaccineName}</TableCell>
                                        <TableCell align="center">{doseNumber}</TableCell>
                                        <TableCell>{getTargetGroupName(assignment.targetGroupId)}</TableCell>
                                        <TableCell align="right">{(assignment.coverageRate * 100).toFixed(0)}%</TableCell>
                                        <TableCell align="right">{(assignment.wastageRate * 100).toFixed(0)}%</TableCell>
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                ))
              ) : (
                <Typography>No programs found. Click "Add New Program" to get started.</Typography>
              )}
            </Box>
          )}
        </Box>
      </Container>
      <ProgramFormModal open={isModalOpen} onClose={handleCloseModal} program={currentProgram} />
    </ProtectedRoute>
  );
}