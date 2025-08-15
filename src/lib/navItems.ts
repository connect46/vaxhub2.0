// src/lib/navItems.ts
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import LayersIcon from '@mui/icons-material/Layers';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import InventoryIcon from '@mui/icons-material/Inventory';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ScienceIcon from '@mui/icons-material/Science';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import { title } from 'process';
import path from 'path';

export const navItems = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: DashboardIcon,
  },
  {
    title: 'Forecasting',
    icon: BarChartIcon,
    submenu: [
      { title: 'Unstratified', path: '/forecast/unstratified' },
      { title: 'Stratified', path: '/forecast/stratified' },
      { title: 'Consumption (HC)', path: '/forecast/consumption-hc' },
      { title: 'Consumption (SC)', path: '/forecast/consumption-sc' },
      { title: 'Manual', path: '/forecast/manual' },
      { title: 'Combined', path: '/forecast/combined' },
    ],
  },
  {
    title: 'Equipment Forecast',
    path: '/forecast/equipment-forecast',
    icon: LayersIcon,
  },
  {
    title: 'Annual Procurement Planning',
    path: '/financial-planning',
    icon: MonetizationOnIcon,
  },
  {
    title: 'Inventory Planning',
    path: '/inventory',
    icon: InventoryIcon,
  },
  // Master Data Section Header
  { isSectionHeader: true, title: 'Master Data' },
  {
    // 'Population Forecast' has been moved here.
    title: 'Population Forecast',
    path: '/master-data/population-forecast',
    icon: PeopleIcon,
  },
  {
    title: 'Vaccines',
    path: '/master-data/vaccines',
    icon: ScienceIcon,
  },
  {
    title: 'Equipment',
    path: '/master-data/equipment',
    icon: BusinessIcon,
  },
  {
    title: 'Programs',
    path: '/master-data/programs',
    icon: CategoryIcon,
  },
];