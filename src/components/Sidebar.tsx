"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from '@/lib/navItems';

// MUI Components and Icons
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Collapse, Typography, IconButton } from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

const drawerWidth = 240;

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState('');
  const pathname = usePathname();

  const handleSubMenuClick = (title: string) => {
    // If the drawer is closed, open it when a submenu is clicked
    if (!open) {
      setOpen(true);
    }
    setOpenSubMenu(openSubMenu === title ? '' : title);
  };
  
  const drawerContent = (
    <div>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', p: 1, height: '64px' }}>
        {open && <Typography variant="h6" sx={{ flexGrow: 1, ml: 1 }}>VaxHub</Typography>}
        <IconButton onClick={() => setOpen(!open)}>
          <ChevronLeftIcon />
        </IconButton>
      </Box>
      <List component="nav">
        {navItems.map((item) => {
          if (item.isSectionHeader) {
            return open && <Typography key={item.title} variant="caption" sx={{ pl: 2.5, py:1, textTransform: 'uppercase', color: 'text.secondary', display: 'block' }}>{item.title}</Typography>;
          }
          if (item.submenu) {
            return (
              <div key={item.title}>
                {/* Tooltip removed from here */}
                <ListItemButton onClick={() => handleSubMenuClick(item.title)} sx={{ pl: 2.5 }}>
                  <ListItemIcon><item.icon /></ListItemIcon>
                  {open && <ListItemText primary={item.title} />}
                  {open && (openSubMenu === item.title ? <ExpandLess /> : <ExpandMore />)}
                </ListItemButton>
                <Collapse in={open && openSubMenu === item.title} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.submenu.map((subItem) => (
                      <ListItemButton key={subItem.title} component={Link} href={subItem.path} sx={{ pl: 9 }} selected={pathname === subItem.path}>
                        <ListItemText primary={subItem.title} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </div>
            );
          }
          return (
            <ListItem key={item.title} disablePadding>
              {/* Tooltip removed from here */}
              <ListItemButton component={Link} href={item.path || '#'} selected={pathname === item.path} sx={{ pl: 2.5 }}>
                <ListItemIcon><item.icon /></ListItemIcon>
                {open && <ListItemText primary={item.title} />}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </div>
  );

  return (
    <Drawer
      variant="permanent"
      open={open}
      sx={{
        width: open ? drawerWidth : 60,
        flexShrink: 0,
        transition: (theme) => theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        '& .MuiDrawer-paper': {
          width: open ? drawerWidth : 60,
          overflowX: 'hidden',
          boxSizing: 'border-box',
          transition: (theme) => theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        },
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        setOpen(false);
        setOpenSubMenu(''); // Also close submenus when collapsing
      }}
    >
      {drawerContent}
    </Drawer>
  );
}