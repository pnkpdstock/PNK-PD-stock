import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StockItem, Product, User, ReceiptHistory, ReleaseHistory, GuestRequest } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are missing before initializing
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Supabase environment variables are missing! The app will not function correctly. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment/Vercel settings.");
}

let supabase: SupabaseClient;

try {
  supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder', {
    auth: { persistSession: false }
  });
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
  // Fallback to avoid breaking the build/import
  supabase = {} as any;
}

const sanitizeDate = (dateStr: string | undefined | null) => {
  if (!dateStr || dateStr.trim() === "" || dateStr === "null") return null;
  return dateStr;
};

export const storageService = {
  isConfigured: () => true,

  migrateDatabase: async (): Promise<void> => {
    const queries = [
      // Core Tables
      `CREATE TABLE IF NOT EXISTS products (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        thai_name TEXT NOT NULL,
        english_name TEXT,
        search_name TEXT,
        manufacturer TEXT,
        contact_number TEXT,
        min_stock INTEGER DEFAULT 0,
        critical_stock INTEGER DEFAULT 0,
        alert_email TEXT,
        photo TEXT,
        status TEXT DEFAULT 'Active',
        registered_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS stock_items (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        thai_name TEXT,
        english_name TEXT,
        batch_no TEXT,
        mfd DATE,
        exp DATE,
        manufacturer TEXT,
        quantity INTEGER DEFAULT 1,
        status TEXT DEFAULT 'In Stock',
        processed_by TEXT,
        patient_name TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
        release_timestamp TIMESTAMP WITH TIME ZONE
      );`,
      `CREATE TABLE IF NOT EXISTS receipt_history (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        thai_name TEXT,
        english_name TEXT,
        batch_no TEXT,
        exp DATE,
        quantity INTEGER,
        processed_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS release_history (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        thai_name TEXT,
        english_name TEXT,
        batch_no TEXT,
        exp DATE,
        quantity INTEGER,
        processed_by TEXT,
        patient_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS guest_requests (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        type TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        expected_date DATE NOT NULL,
        status TEXT DEFAULT 'Pending',
        file_number TEXT,
        hn_number TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        firstname TEXT,
        lastname TEXT,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        password TEXT,
        role TEXT DEFAULT 'staff'
      );`,
      // Default Admin
      `INSERT INTO users (firstname, lastname, username, password, role)
       VALUES ('Admin', 'System', 'admin', '1234', 'admin')
       ON CONFLICT (username) DO NOTHING;`,
      // Column Updates (Safety)
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS firstname TEXT;',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS lastname TEXT;',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS search_name TEXT;',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0;',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS critical_stock INTEGER DEFAULT 0;',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS alert_email TEXT;',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS alert_acknowledged_at TIMESTAMP WITH TIME ZONE;',
      'ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS receipt_date DATE;',
      'ALTER TABLE receipt_history ADD COLUMN IF NOT EXISTS receipt_date DATE;',
      'ALTER TABLE release_history ADD COLUMN IF NOT EXISTS release_date DATE;',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'staff\';',
      'ALTER TABLE guest_requests ADD COLUMN IF NOT EXISTS file_number TEXT;',
      'ALTER TABLE guest_requests ADD COLUMN IF NOT EXISTS hn_number TEXT;',
      'NOTIFY pgrst, \'reload schema\';'
    ];

    for (const sql of queries) {
      try {
        await supabase.rpc('exec_sql', { sql_query: sql });
      } catch (e) {
        console.error("Migration error:", e);
      }
    }
  },

  fetchUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').order('username');
    if (error) throw error;
    // Normalize keys to camelCase for the frontend
    return (data || []).map((u: any) => ({
      ...u,
      firstName: u.firstname || '',
      lastName: u.lastname || '',
      email: u.email || ''
    })) as User[];
  },

  registerUser: async (user: Omit<User, 'id'>): Promise<User> => {
    const dbUser = {
      firstname: user.firstName,
      lastname: user.lastName,
      username: user.username,
      email: user.email,
      password: user.password,
      role: user.role
    };
    const { data, error } = await supabase.from('users').insert([dbUser]).select().single();
    if (error) throw error;
    const u = data as any;
    return { ...u, firstName: u.firstname || '', lastName: u.lastname || '', email: u.email || '' } as User;
  },

  updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
    const dbUpdates: any = {};
    if (updates.firstName !== undefined) dbUpdates.firstname = updates.firstName;
    if (updates.lastName !== undefined) dbUpdates.lastname = updates.lastName;
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.password !== undefined) dbUpdates.password = updates.password;
    if (updates.role !== undefined) dbUpdates.role = updates.role;

    const { data, error } = await supabase.from('users').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    const u = data as any;
    return { ...u, firstName: u.firstname || '', lastName: u.lastname || '', email: u.email || '' } as User;
  },

  deleteUser: async (id: string): Promise<void> => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  },

  fetchItems: async (): Promise<StockItem[]> => {
    const { data, error } = await supabase.from('stock_items').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    return (data || []) as StockItem[];
  },

  saveReceiptHistory: async (history: Omit<ReceiptHistory, 'id' | 'created_at'>): Promise<void> => {
    const { error } = await supabase.from('receipt_history').insert([{
      ...history,
      exp: sanitizeDate(history.exp)
    }]);
    if (error) throw error;
  },

  fetchReceiptHistory: async (): Promise<ReceiptHistory[]> => {
    const { data, error } = await supabase.from('receipt_history').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ReceiptHistory[];
  },

  saveReleaseHistory: async (history: Omit<ReleaseHistory, 'id' | 'created_at'>): Promise<void> => {
    const { error } = await supabase.from('release_history').insert([{
      ...history,
      exp: sanitizeDate(history.exp)
    }]);
    if (error) throw error;
  },

  fetchReleaseHistory: async (): Promise<ReleaseHistory[]> => {
    const { data, error } = await supabase.from('release_history').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ReleaseHistory[];
  },

  saveGuestRequest: async (request: Omit<GuestRequest, 'id' | 'created_at' | 'status'>): Promise<void> => {
    const { error } = await supabase.from('guest_requests').insert([{
      ...request,
      expected_date: sanitizeDate(request.expected_date)
    }]);
    if (error) throw error;
  },

  fetchGuestRequests: async (): Promise<GuestRequest[]> => {
    const { data, error } = await supabase.from('guest_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as GuestRequest[];
  },

  updateGuestRequestStatus: async (id: string, status: GuestRequest['status']): Promise<void> => {
    const { error } = await supabase.from('guest_requests').update({ status }).eq('id', id);
    if (error) throw error;
  },

  saveItem: async (item: Omit<StockItem, 'id' | 'timestamp' | 'status'>, username?: string): Promise<StockItem> => {
    const timestamp = new Date().toISOString();
    const newItem = { 
      thai_name: item.thai_name,
      english_name: item.english_name,
      batch_no: item.batch_no,
      mfd: sanitizeDate(item.mfd),
      exp: sanitizeDate(item.exp),
      manufacturer: item.manufacturer,
      quantity: item.quantity,
      status: 'In Stock', 
      processed_by: username, 
      timestamp: timestamp,
      receipt_date: sanitizeDate(item.receipt_date)
    };

    const { data, error } = await supabase.from('stock_items').insert([newItem]).select().single();
    if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`);

    try {
      await storageService.saveReceiptHistory({
        thai_name: item.thai_name,
        english_name: item.english_name,
        batch_no: item.batch_no,
        exp: item.exp,
        quantity: item.quantity,
        processed_by: username || 'System',
        receipt_date: item.receipt_date
      });
    } catch (logErr) {
      console.error("History Log Error:", logErr);
    }

    return data as StockItem;
  },

  releaseItemByBatch: async (batch_no: string, qtyToRelease: number, username?: string, patient_name?: string, releaseDate?: string): Promise<StockItem | null> => {
    const { data: items, error: findError } = await supabase
      .from('stock_items')
      .select('*')
      .eq('batch_no', batch_no)
      .eq('status', 'In Stock')
      .order('timestamp', { ascending: true });

    if (findError || !items || items.length === 0) return null;

    let totalAvailable = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
    if (totalAvailable < qtyToRelease) return null;

    let remainingToRelease = qtyToRelease;
    let lastUpdatedItem = null;
    const firstItem = items[0];

    for (const item of items) {
      if (remainingToRelease <= 0) break;
      const currentQty = item.quantity || 1;
      
      if (currentQty <= remainingToRelease) {
        const { data, error } = await supabase
          .from('stock_items')
          .update({ 
            status: 'Released', 
            processed_by: username, 
            patient_name: patient_name,
            release_timestamp: new Date().toISOString() 
          })
          .eq('id', item.id).select().single();
        if (error) throw error;
        remainingToRelease -= currentQty;
        lastUpdatedItem = data;
      } else {
        await supabase.from('stock_items').update({ quantity: currentQty - remainingToRelease }).eq('id', item.id);
        const { id, ...itemWithoutId } = item;
        const { data: releasedData, error: insertError } = await supabase.from('stock_items').insert([{
          ...itemWithoutId,
          quantity: remainingToRelease,
          status: 'Released',
          processed_by: username,
          patient_name: patient_name,
          release_timestamp: new Date().toISOString()
        }]).select().single();
        if (insertError) throw insertError;
        remainingToRelease = 0;
        lastUpdatedItem = releasedData;
      }
    }

    try {
      await storageService.saveReleaseHistory({
        thai_name: firstItem.thai_name,
        english_name: firstItem.english_name,
        batch_no: batch_no,
        exp: firstItem.exp,
        quantity: qtyToRelease,
        processed_by: username || 'System',
        patient_name: patient_name || 'N/A',
        release_date: releaseDate
      });
    } catch (err) {
      console.error("Failed to save release history:", err);
    }

    return lastUpdatedItem as StockItem;
  },

  fetchProducts: async (): Promise<Product[]> => {
    const { data, error } = await supabase.from('products').select('*').order('thai_name');
    if (error) throw error;
    return (data || []) as Product[];
  },

  registerProduct: async (product: Omit<Product, 'id' | 'created_at'>, username?: string): Promise<Product> => {
    const { data, error } = await supabase.from('products').insert([{ 
      ...product, 
      status: 'Active', 
      registered_by: username 
    }]).select().single();
    if (error) throw error;
    return data as Product;
  },

  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product> => {
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as Product;
  }
};