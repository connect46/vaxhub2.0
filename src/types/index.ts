// src/types/index.ts
import { Timestamp } from "firebase/firestore";

export interface Vaccine {
  id: string; // Firestore document ID
  vaccineName: string;
  vaccineType: string;
  dosesInSchedule: number;
  pricePerDose: number;
  vialSize: number;
  dosesPerVial: number;
  volumePerDose: number;
  vialsPerBox: number;
  procurementLeadTime: number;
  administrationSyringeId: string;
  dilutionSyringeId: string;
  bufferStock: number;
  minInventory: number;
  absMinInventory: number;
  maxInventory: number;
}

export interface Equipment {
  id: string; // Firestore document ID
  equipmentName: string;
  equipmentType: 'Administration Syringe (ADS)' | 'Dilution Syringe' | 'Safety box';
  equipmentCode: string;
  equipmentUnits: number;    // Units per box
  equipmentCost: number;     // Cost per box
  equipmentFreight: number;  // Freight per box
  disposalCapacity?: number; // Optional: only for safety boxes
  safetyFactor?: number;     // Optional: only for safety boxes
}

export interface DoseAssignment {
  targetGroupId: string;
  coverageRate: number; // Stored as a decimal, e.g., 0.95 for 95%
  wastageRate: number;  // Stored as a decimal, e.g., 0.15 for 15%
}

export interface Program {
  id: string;
  country: string;
  programCategory: 'Routine' | 'Catchup' | 'SIA';
  programName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  vaccines: ProgramVaccine[];
}

export interface ProgramVaccine {
  vaccineId: string;
  vaccineName: string;
  dosesInSchedule: number;
  // This now maps a dose number to our new DoseAssignment object
  doseAssignments: { [doseNumber: number]: DoseAssignment }; 
}

export interface ForecastYear {
  coverageRate: number;
  wastageRate: number;
  dosesAdministered: number;
  dosesWithWastage: number;
}

export interface ForecastTargetGroup {
  targetGroupId: string;
  targetGroupName: string;
  // The key for this object will be the year, e.g., 2025, 2026
  years: { [year: number]: ForecastYear };
}

export interface UnstratifiedForecast {
  id: string; // The Firestore document ID will be the vaccineId
  country: string;
  vaccineName: string;
  targetGroups: ForecastTargetGroup[];
  createdAt: Timestamp;
  lastUpdated: Timestamp;
}

export interface Stratum {
  id: string;
  name: string;
  // Year-by-year percentage of total population, stored as decimal
  percentages: { [year: number]: number };
}

export interface StratumParameter {
  // Key is programId, value is another object
  [programId: string]: {
    coverageRate: number;
    wastageRate: number;
  }
}

export interface StratifiedForecast {
  id: string;
  scenarioName: string;
  country: string;
  createdAt: Timestamp;
  strataDefinitions: Stratum[];
  strataParameters: { [stratumId: string]: StratumParameter };
  // Replace 'any' with our new specific type
  results: { [programCategory: string]: { [vaccineId: string]: StratifiedResultVaccine } };
  forecastYears: number[];
}

export interface StratifiedResultYear {
  dosesAdministered: number;
  dosesWithWastage: number;
}
export interface StratifiedResultTargetGroup {
  targetGroupName: string;
  years: { [year: string]: StratifiedResultYear };
}
export interface StratifiedResultStratum {
  stratumName: string;
  targetGroups: { [tgId: string]: StratifiedResultTargetGroup };
}
export interface StratifiedResultVaccine {
  vaccineName: string;
  strata: { [stratumId: string]: StratifiedResultStratum };
}

export interface ConsumptionResult {
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

export interface MonthlyConsumption {
  consumption: number;
  reportingRate: number; // Stored as decimal, e.g., 0.95 for 95%
}

export interface VaccineConsumptionData {
  avgWastageRate: number; // Stored as decimal
  // The key is a string "YYYY-MM", e.g., "2025-09"
  monthlyData: { [yearMonth: string]: MonthlyConsumption };
}

export interface ConsumptionHcForecast {
  id: string;
  scenarioName: string;
  country: string;
  createdAt: Timestamp;
  historicalData: { [vaccineId: string]: VaccineConsumptionData };
  results: ConsumptionResult; // Replace 'any' with our new specific type
}

export interface ConsumptionScForecast {
  id: string;
  scenarioName: string;
  country: string;
  createdAt: Timestamp;
  historicalData: { [vaccineId: string]: VaccineConsumptionData };
  results: ConsumptionResult; // Replace 'any' with our new specific type
}

export interface ManualForecastYear {
  dosesAdministered: number;
  dosesWithWastage: number;
}

export interface ManualForecast {
  id: string; // Will be the vaccineId
  country: string;
  vaccineName: string;
  description: string;
  // The key for this object will be the year, e.g., 2026
  years: { [year: number]: ManualForecastYear };
  lastUpdated: Timestamp;
}

export interface CombinedForecastInput {
  weight: number; // Stored as decimal, e.g., 1.0 for 100%
  confidence: number; // Stored as a value from 1-5
}

export interface CombinedForecastResult {
  finalAdministered: number;
  finalWithWastage: number;
}

export interface CombinedForecast {
  id: string;
  scenarioName: string;
  country: string;
  createdAt: Timestamp;
  // Nested object structure: { vaccineId: { year: { methodName: { ... } } } }
  inputs: { 
    [vaccineId: string]: { 
      [year: number]: { 
        [method: string]: CombinedForecastInput 
      } 
    } 
  };
  // Nested object structure: { vaccineId: { year: { ... } } }
  results: {
    [vaccineId: string]: {
      [year: number]: CombinedForecastResult
    }
  };
  forecastYears: number[];
}

export interface EquipmentForecastItem {
  equipmentId: string;
  equipmentName: string;
  // The key is the year, e.g., 2026
  yearlyQuantities: { [year: number]: number };
}

export interface EquipmentForecastProgram {
  programId: string;
  programName: string;
  programCategory: string;
  equipment: EquipmentForecastItem[];
}

export interface EquipmentForecast {
  id: string; // Firestore document ID
  country: string;
  scenarioName: string;
  createdAt: Timestamp;
  results: EquipmentForecastProgram[];
}

export interface FinancialPlanInventoryInput {
  onHand: number;
  expShipments: number;
  expUsage: number;
}

export interface FinancialPlanFunder {
  id: string;
  name: string;
  allocation: number; // Percentage
  committed: number; // Dollar amount
}

export interface FinancialPlan {
  id: string; // Firestore document ID
  country: string;
  year: number;
  createdAt: Timestamp;
  inventoryAsOfDate?: Timestamp;
  vaccineInputs: { [vaccineId: string]: FinancialPlanInventoryInput };
  equipmentInputs: { [equipmentId: string]: FinancialPlanInventoryInput };
  funders: FinancialPlanFunder[];
}

export interface FinancialPlan {
  id: string; // Firestore document ID
  country: string;
  year: number;
  createdAt: Timestamp;
  inventoryAsOfDate?: Timestamp;
  vaccineInputs: { [vaccineId: string]: FinancialPlanInventoryInput };
  equipmentInputs: { [equipmentId:string]: FinancialPlanInventoryInput };
  funders: FinancialPlanFunder[];
  proposedProcurement?: { [itemId: string]: number };
  constrainedForecast: {
    fundingPercentage: number;
    forecasts: {
      id: string;
      name: string;
      original: number;
      constrained: number;
      constrainedAdmin?: number; 
    }[];
  };
  calculatedEquipmentUsage?: { [equipmentId: string]: number };
  procurementData?: ProcurementDataItem[];
}

export interface ProcurementDataItem {
  id: string;
  name: string;
  forecast: number;
  buffer: number;
  boyInventory: number;
  recommendedProcurement: number;
  costOfRecommended: number;
  proposedValue: number;
  costOfProposed: number;
}

export interface InventoryPlan {
  id: string; // The vaccineId or equipmentId
  country: string;
  lastUpdated: Timestamp;
  // The key is a string "YYYY-MM", e.g., "2026-01"
  shipments: { [yearMonth: string]: number };
  // We'll also store the initial recommendation for reference
  recommendation: { [yearMonth: string]: number }; 
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'country_lead' | 'global_lead';
  country: string;
  displayName?: string; // Add an optional display name
}