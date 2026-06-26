export type RequestStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type UserRole = 'operator' | 'maintenance_manager' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
}

export interface SparePart {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  location: string;
  equipment?: string;
  price?: number;
  isConform: boolean;
  lastUpdated: string;
}

export interface PartRequest {
  id: string;
  requestNumber: string;
  partId: string;
  partCode: string;
  partName: string;
  quantity: number;
  reason: 'missing' | 'insufficient' | 'non_conform' | 'preventive' | 'corrective';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  equipment: string;
  description: string;
  status: RequestStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  erpReference?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'request' | 'part' | 'user';
  entityId: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
  oldValue?: string;
  newValue?: string;
}

export interface Notification {
  id: string;
  type: 'request_created' | 'request_approved' | 'request_rejected' | 'stock_low' | 'part_non_conform';
  title: string;
  message: string;
  userId: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}
