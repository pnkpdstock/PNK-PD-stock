export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email?: string;
  password?: string;
  role: 'admin' | 'staff';
}

export interface Product {
  id: string;
  thai_name: string;
  english_name: string;
  search_name: string;
  ai_search_name?: string;
  manufacturer: string;
  contact_number?: string;
  min_stock?: number;
  critical_stock?: number;
  alert_email?: string;
  photo?: string;
  status?: 'Active' | 'Cancelled';
  registered_by?: string; 
  alert_acknowledged_at?: string | null;
  created_at: string;
}

export interface StockItem {
  id: string;
  thai_name: string;
  english_name: string;
  batch_no: string;
  mfd: string;
  exp: string;
  manufacturer: string;
  quantity: number;
  status: 'In Stock' | 'Released';
  processed_by?: string; 
  patient_name?: string; 
  timestamp: string;
  receipt_date?: string;
  release_timestamp?: string;
}

export interface ReceiptHistory {
  id: string;
  thai_name: string;
  english_name: string;
  batch_no: string;
  exp: string;
  quantity: number;
  processed_by: string;
  receipt_date?: string;
  created_at: string;
}

export interface ReleaseHistory {
  id: string;
  thai_name: string;
  english_name: string;
  batch_no: string;
  exp: string;
  quantity: number;
  processed_by: string;
  patient_name: string;
  release_date?: string;
  created_at: string;
}

export interface GuestRequest {
  id: string;
  type: 'Request' | 'Return';
  patient_name: string;
  phone: string;
  product_name: string;
  quantity: number;
  expected_date: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  file_number?: string;
  hn_number?: string;
  created_at: string;
}

export interface LabelExtractionResult {
  thaiName: string;
  englishName: string;
  searchName?: string;
  aiSearchName?: string;
  batchNo: string;
  mfd: string;
  exp: string;
  manufacturer: string;
  image?: string;
  quantity?: number;
  minStock?: number;
  criticalStock?: number;
  alertEmail?: string;
}

export enum View {
  INVENTORY = 'inventory',
  REGISTRATION = 'registration',
  STOCK_IN = 'stock_in',
  STOCK_OUT = 'stock_out',
  RECEIPT_HISTORY = 'receipt_history',
  RELEASE_HISTORY = 'release_history',
  SETTINGS = 'settings',
  USERS = 'users',
  USER_MANAGEMENT = 'user_management',
  DASHBOARD = 'dashboard',
  GUEST_REQUEST = 'guest_request', // ขอน้ำยา
  GUEST_RETURN = 'guest_return',   // คืนน้ำยา
  QUEUE_LIST = 'queue_list',        // รายการรอคิว (สำหรับ Staff/Admin)
  UPDATE_LOGS = 'update_logs'
}