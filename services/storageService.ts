import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StockItem, Product, User, ReceiptHistory, ReleaseHistory, GuestRequest } from "../types";

const SUPABASE_URL = "https://iovkwbomfhwlbmrnaqlu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlvdmt3Ym9tZmh3bGJtcm5hcWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MDczMDMsImV4cCI6MjA4MTk4MzMwM30.dTU6IuoTbvTqYYMnWbmE3zFmY9JSTO-l-6Dro2AMIi4";

let supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

export const storageService = {
  isConfigured: () => true,

  migrateDatabase: async (): Promise<void> => {
    const queries = [
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS search_name TEXT;',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0;',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS critical_stock INTEGER DEFAULT 0;',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS alert_email TEXT;',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'staff\';',
      'ALTER TABLE guest_requests ADD COLUMN IF NOT EXISTS file_number TEXT;',
      'ALTER TABLE guest_requests ADD COLUMN IF NOT EXISTS hn_number TEXT;',
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
      );`
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
    return data as User[];
  },

  registerUser: async (user: Omit<User, 'id'>): Promise<User> => {
    const { data, error } = await supabase.from('users').insert([user]).select().single();
    if (error) throw error;
    return data as User;
  },

  updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as User;
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
    const { error } = await supabase.from('receipt_history').insert([history]);
    if (error) throw error;
  },

  fetchReceiptHistory: async (): Promise<ReceiptHistory[]> => {
    const { data, error } = await supabase.from('receipt_history').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ReceiptHistory[];
  },

  saveReleaseHistory: async (history: Omit<ReleaseHistory, 'id' | 'created_at'>): Promise<void> => {
    const { error } = await supabase.from('release_history').insert([history]);
    if (error) throw error;
  },

  fetchReleaseHistory: async (): Promise<ReleaseHistory[]> => {
    const { data, error } = await supabase.from('release_history').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ReleaseHistory[];
  },

  saveGuestRequest: async (request: Omit<GuestRequest, 'id' | 'created_at' | 'status'>): Promise<void> => {
    const { error } = await supabase.from('guest_requests').insert([request]);
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
      mfd: item.mfd,
      exp: item.exp,
      manufacturer: item.manufacturer,
      quantity: item.quantity,
      status: 'In Stock', 
      processed_by: username, 
      timestamp: timestamp 
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
        processed_by: username || 'System'
      });
    } catch (logErr) {
      console.error("History Log Error:", logErr);
    }

    return data as StockItem;
  },

  releaseItemByBatch: async (batch_no: string, qtyToRelease: number, username?: string, patient_name?: string): Promise<StockItem | null> => {
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
        patient_name: patient_name || 'N/A'
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