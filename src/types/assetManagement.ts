export type AssetStatus = 'Draft' | 'Active' | 'Fully Depreciated' | 'Transferred' | 'Pending Disposal' | 'Disposed' | 'Sold' | 'Written Off' | 'Cancelled';

export type DepreciationMethod = 'Straight Line';

export interface AssetCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  defaultRate?: number;
  defaultUsefulLife?: number;
  assetGlAccountId?: string;
  accumulatedDepreciationGlAccountId?: string;
  depreciationExpenseGlAccountId?: string;
  gainOnDisposalAccountId?: string;
  lossOnDisposalAccountId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Custodian {
  id: string;
  custodianCode: string;
  employeeId?: string;
  name: string;
  department?: string;
  designation?: string;
  contact?: string;
  status: 'Active' | 'Inactive';
}

export interface FixedAsset {
  id: string;
  assetId: string;
  assetTag?: string;
  name: string;
  categoryId: string;
  subCategory?: string;
  description?: string;
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: string;
  
  supplierName?: string;
  purchaseInvoiceNumber?: string;
  purchaseVoucherId?: string;
  purchaseDate?: string;
  capitalizationDate: string;
  
  cost: number;
  additionalCapitalizedCost: number;
  totalCapitalizedCost: number;
  
  depreciationMethod: DepreciationMethod;
  depreciationBasis: 'Rate' | 'Useful Life';
  depreciationRate?: number;
  usefulLife?: number;
  residualValue: number; // Must ALWAYS be 1
  depreciationStartDate: string;
  
  accumulatedDepreciation: number;
  currentPeriodDepreciation: number;
  netBookValue: number;
  fullyDepreciatedDate?: string;
  
  location?: string;
  department?: string;
  costCentre?: string;
  currentCustodianId?: string;
  custodianAssignmentDate?: string;
  
  assetGlAccountId?: string;
  accumulatedDepreciationGlAccountId?: string;
  depreciationExpenseGlAccountId?: string;
  gainOnDisposalAccountId?: string;
  lossOnDisposalAccountId?: string;
  
  status: AssetStatus;
  
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetCustodianHistory {
  id: string;
  assetId: string;
  custodianId: string;
  assignedDate: string;
  releasedDate?: string;
  department?: string;
  location?: string;
  remarks?: string;
  createdBy: string;
}

export interface AssetTransfer {
  id: string;
  transferNumber: string;
  assetId: string;
  transferDate: string;
  fromCustodianId?: string;
  toCustodianId?: string;
  fromDepartment?: string;
  toDepartment?: string;
  fromLocation?: string;
  toLocation?: string;
  reason?: string;
  approvedBy?: string;
  createdBy: string;
}

export interface DepreciationTransaction {
  id: string;
  assetId: string;
  financialYear: string;
  accountingPeriod: string;
  depreciationDate: string;
  openingNbv: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  closingNbv: number;
  journalId?: string;
  status: 'Calculated' | 'Reviewed' | 'Posted' | 'Reversed';
  postedBy?: string;
  postedAt?: string;
}

export interface AssetDisposal {
  id: string;
  disposalNumber: string;
  assetId: string;
  disposalType: 'Sale' | 'Disposal' | 'Scrapped' | 'Written Off' | 'Lost' | 'Donated' | 'Other';
  disposalDate: string;
  assetCost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  saleProceeds: number;
  gainLoss: number;
  buyer?: string;
  invoiceNumber?: string;
  journalId?: string;
  status: 'Pending' | 'Completed' | 'Reversed';
  remarks?: string;
  createdBy: string;
  createdAt: string;
}

export interface AssetAuditLog {
  id: string;
  assetId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  userId: string;
  timestamp: string;
  remarks?: string;
}
