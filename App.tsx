
import React, { useState, useEffect, useMemo } from 'react';
import { View, StockItem, LabelExtractionResult, Product, User, ReceiptHistory, ReleaseHistory, GuestRequest } from './types';
import { Layout } from './components/Layout';
import { Scanner } from './components/Scanner';
import { extractLabelInfo } from './services/geminiService';
import { storageService } from './services/storageService';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>(View.GUEST_REQUEST);
  const [items, setItems] = useState<StockItem[]>([]);
  const [receiptHistory, setReceiptHistory] = useState<ReceiptHistory[]>([]);
  const [releaseHistory, setReleaseHistory] = useState<ReleaseHistory[]>([]);
  const [guestRequests, setGuestRequests] = useState<GuestRequest[]>([]);
  const [registeredProducts, setRegisteredProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'in' | 'out'>('all');
  const [scanResult, setScanResult] = useState<LabelExtractionResult | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [potentialMatches, setPotentialMatches] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inputQty, setInputQty] = useState<number>(1);
  const [patientName, setPatientName] = useState('');

  const [loginAttemptUser, setLoginAttemptUser] = useState<User | null>(null);
  const [loginPassword, setLoginPassword] = useState('');

  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', username: '', email: '', password: '', role: 'staff' as 'admin' | 'staff' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  
  const [tempContact, setTempContact] = useState('');
  const [tempMinStock, setTempMinStock] = useState<number>(0);
  const [tempCriticalStock, setTempCriticalStock] = useState<number>(0);
  const [tempAlertEmail, setTempAlertEmail] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any | null>(null);
  const [sentAlerts, setSentAlerts] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('sent_alerts_session');
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch (e) {
        return new Set();
      }
    }
    return new Set();
  });
  const sentAlertsRef = React.useRef<Set<string>>(new Set());
  const alertCooldowns = React.useRef<Record<string, number>>({});

  // Sync ref with initial state once
  useEffect(() => {
    const saved = localStorage.getItem('sent_alerts_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        sentAlertsRef.current = new Set(parsed);
      } catch (e) {}
    }
  }, []);

  // Search state for manual selection
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Guest Form State
  const [guestForm, setGuestForm] = useState({
    patient_name: '',
    phone: '',
    product_name: '',
    quantity: '' as unknown as number,
    expected_date: '',
    hn_number: '',
    file_number: ''
  });

  useEffect(() => {
    const init = async () => {
      await storageService.migrateDatabase();
      loadData();
    };
    init();
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        setActiveView(View.INVENTORY);
      } catch (e) {
        localStorage.removeItem('current_user');
      }
    }
  }, []);

  const loadData = async () => {
    setIsDataLoading(true);
    try {
      const [itemsData, productsData, usersData, historyData, outHistoryData, guestData] = await Promise.all([
        storageService.fetchItems(),
        storageService.fetchProducts(),
        storageService.fetchUsers(),
        storageService.fetchReceiptHistory(),
        storageService.fetchReleaseHistory(),
        storageService.fetchGuestRequests()
      ]);
      setItems(itemsData || []);
      setRegisteredProducts(productsData || []);
      setUsers(usersData || []);
      setReceiptHistory(historyData || []);
      setReleaseHistory(outHistoryData || []);
      setGuestRequests(guestData || []);
      
      if (usersData?.length === 0) {
        console.warn("Supabase returned 0 users. If you just created the tables, make sure Row Level Security (RLS) is disabled or you have added access policies.");
      }
    } catch (err: any) {
      console.error("Supabase load error:", err);
      setError("Cloud Connection Error: " + (err.message || "Unknown error") + " (Check console for details)");
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user');
    setActiveView(View.GUEST_REQUEST);
    showSuccess("ออกจากระบบแล้ว");
  };

  const handleVerifyPassword = () => {
    if (!loginAttemptUser) return;
    const inputPass = String(loginPassword).trim();
    const userPass = String(loginAttemptUser.password || '').trim();
    
    if (inputPass === userPass) {
      setCurrentUser(loginAttemptUser);
      localStorage.setItem('current_user', JSON.stringify(loginAttemptUser));
      showSuccess(`ยินดีต้อนรับ คุณ ${loginAttemptUser.firstName}`);
      setLoginAttemptUser(null);
      setLoginPassword('');
      setActiveView(View.INVENTORY);
    } else {
      setError("รหัสผ่านไม่ถูกต้อง");
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const validatePhone = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length === 10;
  };

  const submitGuestRequest = async (type: 'Request' | 'Return') => {
    if (!guestForm.patient_name || !guestForm.phone || !guestForm.product_name || !guestForm.expected_date || !guestForm.quantity) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน รวมถึงจำนวนที่ต้องการ");
      return;
    }
    
    if (!validatePhone(guestForm.phone)) {
      setError("⚠️ เบอร์โทรศัพท์ต้องมี 10 หลักเท่านั้น");
      return;
    }

    setIsLoading(true);
    try {
      await storageService.saveGuestRequest({
        type,
        patient_name: guestForm.patient_name,
        phone: guestForm.phone.replace(/\D/g, ''),
        product_name: guestForm.product_name,
        quantity: Number(guestForm.quantity),
        expected_date: guestForm.expected_date,
        hn_number: guestForm.hn_number,
        file_number: guestForm.file_number
      });
      showSuccess(type === 'Request' ? "ส่งรายการขอน้ำยาเรียบร้อยแล้ว" : "ส่งรายการคืนน้ำยาเรียบร้อยแล้ว");
      setGuestForm({ patient_name: '', phone: '', product_name: '', quantity: '' as unknown as number, expected_date: '', hn_number: '', file_number: '' });
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallAndCopy = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    navigator.clipboard.writeText(cleanPhone).then(() => {
      showSuccess(`คัดลอกเบอร์ ${cleanPhone} แล้ว กำลังโทรออก...`);
      window.location.href = `tel:${cleanPhone}`;
    }).catch(() => {
      window.location.href = `tel:${cleanPhone}`;
    });
  };

  const updateQueueStatus = async (id: string, status: GuestRequest['status']) => {
    try {
      await storageService.updateGuestRequestStatus(id, status);
      showSuccess("อัปเดตสถานะคิวแล้ว");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const findMatches = (scannedThai: string, scannedEng: string, scannedAI: string = '') => {
    const normalize = (s: string) => (s || "").replace(/[\s\-\_\.]/g, '').toLowerCase();
    const normSThai = normalize(scannedThai);
    const normSEng = normalize(scannedEng);
    const normSAI = normalize(scannedAI);
    
    return registeredProducts.filter(p => {
      // 1. Direct AI Search Name Match (Highest Priority)
      const pAISearch = normalize(p.ai_search_name || '');
      if (normSAI && pAISearch === normSAI) return true;

      // 2. Name Based Matching
      const pThai = normalize(p.thai_name);
      const pEng = normalize(p.english_name);
      const pSearch = normalize(p.search_name);
      
      const prefixLength = 10;
      const thaiPrefixMatch = normSThai.length >= prefixLength && pThai.length >= prefixLength && normSThai.substring(0, prefixLength) === pThai.substring(0, prefixLength);
      const engPrefixMatch = normSEng.length >= prefixLength && pEng.length >= prefixLength && normSEng.substring(0, prefixLength) === pEng.substring(0, prefixLength);
      
      const thaiContains = (normSThai && pThai.includes(normSThai)) || (normSThai && pThai.length > 0 && normSThai.includes(pThai));
      const engContains = (normSEng && pEng.includes(normSEng)) || (normSEng && pEng.length > 0 && normSEng.includes(pEng));
      const searchContains = (normSThai && pSearch.includes(normSThai)) || (normSEng && pSearch.includes(normSEng));
      
      // Also match if the scanned names somehow contain the AI code (fallback)
      const aiSearchInNames = (normSAI && (pThai.includes(normSAI) || pEng.includes(normSAI) || pSearch.includes(normSAI)));

      return thaiPrefixMatch || engPrefixMatch || thaiContains || engContains || searchContains || aiSearchInNames;
    });
  };

  const handleManualSelect = (product: Product) => {
    const mockScanData: LabelExtractionResult = {
      thaiName: product.thai_name,
      englishName: product.english_name,
      batchNo: '',
      mfd: '',
      exp: '',
      manufacturer: product.manufacturer,
      searchName: product.search_name
    };
    
    if (activeView === View.STOCK_IN) {
      selectItemForStockIn(product, mockScanData);
    } else if (activeView === View.STOCK_OUT) {
      selectItemForStockOut(product, mockScanData);
    }
    setIsManualMode(false);
  };

  const filteredManualProducts = useMemo(() => {
    const query = manualSearchQuery.toLowerCase().trim();
    if (!query) return registeredProducts;
    return registeredProducts.filter(p => 
      p.thai_name?.toLowerCase().includes(query) || 
      p.english_name?.toLowerCase().includes(query) || 
      p.search_name?.toLowerCase().includes(query) ||
      p.ai_search_name?.toLowerCase().includes(query)
    );
  }, [manualSearchQuery, registeredProducts]);

  const handleStockIn = async (image: string) => {
    if (!currentUser) { setActiveView(View.USERS); return; }
    setIsLoading(true);
    setError(null);
    setPotentialMatches([]);
    setMatchedProduct(null);
    try {
      const data = await extractLabelInfo(image);
      const matches = findMatches(data.thaiName, data.englishName, data.aiSearchName);
      if (matches.length === 0) { 
        setError(`⚠️ ไม่พบสินค้าในทะเบียน กรุณาลองใช้ปุ่ม "เลือกรายการเอง"`); 
        return; 
      }
      setScanResult(data);
      setPotentialMatches(matches);
      if (matches.length === 1) selectItemForStockIn(matches[0], data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectItemForStockIn = (product: Product, data: LabelExtractionResult) => {
    setMatchedProduct(product);
    setScanResult({ ...data, thaiName: product.thai_name, englishName: product.english_name });
    setInputQty(1);
    setManualDate(new Date().toISOString().split('T')[0]);
    setManualSearchQuery('');
  };

  const executeStockIn = async () => {
    if (!currentUser || !scanResult) return;
    if (!scanResult.batchNo || !scanResult.exp) {
      setError("กรุณากรอก Batch No. และ วันหมดอายุ");
      return;
    }
    setIsLoading(true);
    try {
      await storageService.saveItem({
        thai_name: scanResult.thaiName,
        english_name: scanResult.englishName,
        batch_no: scanResult.batchNo,
        mfd: scanResult.mfd,
        exp: scanResult.exp,
        manufacturer: scanResult.manufacturer,
        quantity: inputQty,
        receipt_date: manualDate
      }, currentUser.username);
      setScanResult(null);
      setMatchedProduct(null);
      showSuccess(`รับเข้าสำเร็จ`);
      setActiveView(View.INVENTORY);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStockOutScan = async (image: string) => {
    if (!currentUser) { setActiveView(View.USERS); return; }
    setIsLoading(true);
    setError(null);
    setPotentialMatches([]);
    setMatchedProduct(null);
    try {
      const data = await extractLabelInfo(image);
      const matches = findMatches(data.thaiName, data.englishName, data.aiSearchName);
      if (matches.length === 0) {
        setError(`⚠️ ไม่พบสินค้าในคลัง กรุณาลองใช้ปุ่ม "เลือกรายการเอง"`);
        return;
      }
      setScanResult(data);
      setPotentialMatches(matches);
      if (matches.length === 1) selectItemForStockOut(matches[0], data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectItemForStockOut = (product: Product, data: LabelExtractionResult) => {
    setMatchedProduct(product);
    setScanResult({ ...data, thaiName: product.thai_name, englishName: product.english_name });
    setInputQty(1);
    setPatientName('');
    setManualDate(new Date().toISOString().split('T')[0]);
    setManualSearchQuery('');
  };

  const executeStockOut = async () => {
    if (!currentUser || !scanResult || !patientName.trim()) {
      if (!patientName.trim()) setError("กรุณาระบุชื่อผู้ป่วย");
      return;
    }
    if (!scanResult.batchNo) {
      setError("กรุณาระบุ Batch No. ที่ต้องการจ่ายออก");
      return;
    }
    setIsLoading(true);
    try {
      const releasedItem = await storageService.releaseItemByBatch(scanResult.batchNo, inputQty, currentUser.username, patientName, manualDate);
      if (releasedItem) {
        showSuccess(`จ่ายออกสำเร็จ`);
        setScanResult(null);
        setMatchedProduct(null);
        setPatientName('');
        setActiveView(View.INVENTORY);
        loadData();
      } else {
        setError(`❌ ไม่พบข้อมูล Batch หรือจำนวนไม่พอ`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterScan = async (image: string) => {
    if (!currentUser) { setActiveView(View.USERS); return; }
    setIsLoading(true);
    setError(null);
    setEditingProductId(null);
    try {
      const info = await extractLabelInfo(image);
      const finalThaiName = (info.thaiName || "").trim() === "" ? (info.englishName || "").trim() : info.thaiName;
      setScanResult({ 
        ...info, 
        thaiName: finalThaiName, 
        image: image, 
        searchName: '', 
        alertEmail: currentUser?.email || '',
        aiSearchName: info.aiSearchName || ''
      });
      setTempContact('');
      setTempMinStock(0);
      setTempCriticalStock(0);
      setTempAlertEmail(currentUser?.email || '');
      showSuccess("AI เตรียมข้อมูลให้แล้ว กรุณาตรวจสอบก่อนบันทึก");
    } catch (err: any) {
      setError("AI Scan Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductScanDuringRegistration = async (imageBase64: string) => {
    setIsLoading(true);
    try {
      const extracted = await extractLabelInfo(imageBase64);
      if (scanResult) {
        setScanResult({
          ...scanResult,
          image: imageBase64,
          aiSearchName: extracted.aiSearchName || scanResult.aiSearchName
        });
      }
      showSuccess("AI วิเคราะห์รูปภาพและบันทึก AI Search Name แล้ว");
    } catch (err: any) {
      setError("AI Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startManualRegistration = () => {
    setEditingProductId(null);
    setScanResult({
      thaiName: '',
      englishName: '',
      searchName: '',
      batchNo: '',
      mfd: '',
      exp: '',
      manufacturer: '',
      image: undefined,
      minStock: 0,
      criticalStock: 0,
      alertEmail: currentUser?.email || ''
    });
    setTempContact('');
    setTempMinStock(0);
    setTempCriticalStock(0);
    setTempAlertEmail(currentUser?.email || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectProductForEdit = (product: Product) => {
    setEditingProductId(product.id);
    setScanResult({
      thaiName: product.thai_name,
      englishName: product.english_name,
      searchName: product.search_name || '',
      aiSearchName: product.ai_search_name || '',
      batchNo: '',
      mfd: '',
      exp: '',
      manufacturer: product.manufacturer,
      image: product.photo,
      minStock: product.min_stock,
      criticalStock: product.critical_stock,
      alertEmail: product.alert_email
    });
    setTempContact(product.contact_number || '');
    setTempMinStock(product.min_stock || 0);
    setTempCriticalStock(product.critical_stock || 0);
    setTempAlertEmail(product.alert_email || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeRegistration = async () => {
    if (!currentUser || !scanResult) return;
    if (!scanResult.thaiName) {
      setError("กรุณากรอกชื่อสินค้า");
      return;
    }
    
    if (tempContact && !validatePhone(tempContact)) {
      setError("⚠️ เบอร์โทรศัพท์ต้องมี 10 หลักเท่านั้น");
      return;
    }

    setIsLoading(true);
    try {
      const productPayload = {
        thai_name: scanResult.thaiName,
        english_name: scanResult.englishName,
        search_name: scanResult.searchName || '',
        ai_search_name: scanResult.aiSearchName || '',
        manufacturer: scanResult.manufacturer,
        contact_number: tempContact.replace(/\D/g, ''),
        min_stock: tempMinStock,
        critical_stock: tempCriticalStock,
        alert_email: tempAlertEmail,
        photo: scanResult.image
      };
      if (editingProductId) {
        await storageService.updateProduct(editingProductId, productPayload);
        showSuccess("อัปเดตข้อมูลสินค้าสำเร็จ");
      } else {
        await storageService.registerProduct(productPayload, currentUser.username);
        showSuccess("ลงทะเบียนสินค้าสำเร็จ");
      }
      setScanResult(null);
      setEditingProductId(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserReg = async () => {
    if (!newUser.firstName || !newUser.username || !newUser.password) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setIsLoading(true);
    try {
      if (editingUser) {
        await storageService.updateUser(editingUser.id, newUser);
        showSuccess("อัปเดตผู้ใช้งานสำเร็จ");
      } else {
        await storageService.registerUser(newUser);
        showSuccess("เพิ่มผู้ใช้งานสำเร็จ");
      }
      setNewUser({ firstName: '', lastName: '', username: '', email: '', password: '', role: 'staff' });
      setEditingUser(null);
      setIsAddingUser(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้นี้?")) return;
    setIsLoading(true);
    try {
      await storageService.deleteUser(id);
      showSuccess("ลบผู้ใช้งานสำเร็จ");
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedStock = useMemo(() => {
    const inStock = items.filter(i => i.status === 'In Stock');
    const groups: Record<string, any> = {};

    // Initialize with all registered products to ensure 0-stock items are shown
    registeredProducts.forEach(p => {
      const key = (p.thai_name || p.english_name || "Unknown").toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          name: p.thai_name || p.english_name,
          thaiName: p.thai_name,
          englishName: p.english_name,
          manufacturer: p.manufacturer,
          totalCount: 0,
          nearestExpiry: null,
          productId: p.id,
          minStock: p.min_stock || 0,
          criticalStock: p.critical_stock || 0,
          alertEmail: p.alert_email || '',
          alertAcknowledgedAt: p.alert_acknowledged_at,
          batches: []
        };
      }
    });

    inStock.forEach(item => {
      const key = (item.thai_name || item.english_name || "Unknown").toLowerCase();
      if (!groups[key]) {
        const master = registeredProducts.find(p => (p.thai_name?.toLowerCase() === item.thai_name?.toLowerCase()) || (p.english_name?.toLowerCase() === item.english_name?.toLowerCase()));
        groups[key] = { 
          name: item.thai_name || item.english_name,
          thaiName: item.thai_name,
          englishName: item.english_name,
          manufacturer: item.manufacturer, 
          totalCount: 0,
          nearestExpiry: item.exp,
          productId: master?.id,
          minStock: master?.min_stock || 0,
          criticalStock: master?.critical_stock || 0,
          alertEmail: master?.alert_email || '',
          alertAcknowledgedAt: master?.alert_acknowledged_at,
          batches: [] // Store individual batches here
        };
      }
      groups[key].totalCount += (item.quantity || 1);
      groups[key].batches.push(item);
      if (item.exp && (!groups[key].nearestExpiry || item.exp < groups[key].nearestExpiry)) {
        groups[key].nearestExpiry = item.exp;
      }
    });

    // Sort batches by expiry date
    Object.values(groups).forEach((group: any) => {
      group.batches.sort((a: StockItem, b: StockItem) => (a.exp || "").localeCompare(b.exp || ""));
    });

    return Object.values(groups).sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  }, [items, registeredProducts]);

  // Effect to trigger Real Email Alerts when stock is low
  useEffect(() => {
    if (groupedStock.length === 0 || !currentUser) return;

    const triggerAlerts = async () => {
      const now = Date.now();
      for (const group of groupedStock) {
        const productKey = (group.thaiName || group.englishName || "unknown").toLowerCase();
        
        // Cooldown check (5 minutes) to prevent loops on errors
        const lastAttempt = alertCooldowns.current[productKey] || 0;
        if (now - lastAttempt < 300000) continue; 

        // Conditions for alert:
        // 1. Below or equal critical stock
        // 2. Alert email is configured
        // 3. Haven't already sent a SUCCESSFUL alert for this product (Ref check is instant)
        // 4. Alert has not been acknowledged in the database
        if (group.totalCount <= group.criticalStock && group.alertEmail && !sentAlertsRef.current.has(productKey) && !group.alertAcknowledgedAt) {
          
          // Mark as attempted immediately in this session's cooldown record
          alertCooldowns.current[productKey] = now;
          
          console.log(`🚀 Sending Real Email Alert for ${group.thaiName} to ${group.alertEmail}`);
          
          try {
            const response = await fetch('/api/send-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                product: group.thaiName || group.englishName,
                currentStock: group.totalCount,
                criticalLevel: group.criticalStock,
                recipients: group.alertEmail
              })
            });

            if (response.ok) {
              // Update Ref immediately so next iteration of the loop doesn't trigger same product
              sentAlertsRef.current.add(productKey);
              
              // Persist to localStorage to survive refreshes
              localStorage.setItem('sent_alerts_session', JSON.stringify([...sentAlertsRef.current]));
              
              setSentAlerts(new Set(sentAlertsRef.current));
              console.log(`✅ Alert Email Sent for ${group.thaiName}`);
              
              // Wait 1 second before next email attempt to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              const error = await response.json();
              console.error("Failed to send alert email:", error);
              
              // If we hit Gmail rate limit or daily limit, stop the entire loop for this render pass
              if (error.error?.includes('454') || error.error?.includes('550') || error.error?.includes('Limit')) {
                console.error("Stopping alert loop due to Gmail limits");
                return;
              }
            }
          } catch (err) {
            console.error("Network error sending alert:", err);
          }
        }

        // Automatic reset of acknowledgement: if stock goes above critical, clear the acknowledgement date
        if (group.totalCount > group.criticalStock && (group.alertAcknowledgedAt || sentAlertsRef.current.has(productKey)) && group.productId) {
          const pid = group.productId;
          storageService.updateProduct(pid, { alert_acknowledged_at: null }).then(() => {
             setRegisteredProducts(prev => prev.map(p => p.id === pid ? { ...p, alert_acknowledged_at: null } : p));
             
             // Also clear session sentinel
             sentAlertsRef.current.delete(productKey);
             localStorage.setItem('sent_alerts_session', JSON.stringify([...sentAlertsRef.current]));
             setSentAlerts(new Set(sentAlertsRef.current));
          }).catch(console.error);
        }
      }
    };

    triggerAlerts();
  }, [groupedStock, currentUser]);

  const sortedGuestRequests = useMemo(() => {
    return [...guestRequests].sort((a, b) => {
      // Pending first
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
      
      // If same status, sort by expected_date (nearest first)
      if (a.expected_date < b.expected_date) return -1;
      if (a.expected_date > b.expected_date) return 1;
      return 0;
    });
  }, [guestRequests]);

  const hasPendingRequests = useMemo(() => {
    return guestRequests.some(req => req.status === 'Pending');
  }, [guestRequests]);

  const mergedHistory = useMemo(() => {
    let receipts = (receiptHistory || []).map(h => ({ ...h, historyType: 'in' as const }));
    let releases = (releaseHistory || []).map(h => ({ ...h, historyType: 'out' as const }));
    
    let combined = [...receipts, ...releases];
    if (historyFilter !== 'all') {
      combined = combined.filter(h => h.historyType === historyFilter);
    }
    
    return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [receiptHistory, releaseHistory, historyFilter]);

  // ค้นหารูปภาพสินค้าที่ผู้ป่วยเลือกในหน้า Guest Form
  const selectedGuestProduct = useMemo(() => {
    if (!guestForm.product_name) return null;
    return registeredProducts.find(p => p.thai_name === guestForm.product_name);
  }, [guestForm.product_name, registeredProducts]);

  return (
    <Layout 
      activeView={activeView} 
      onViewChange={(v) => { setActiveView(v); setIsManualMode(false); setScanResult(null); }} 
      currentUser={currentUser} 
      onLogout={handleLogout}
      hasPendingRequests={hasPendingRequests}
    >
      
      {/* Login Password Modal */}
      {loginAttemptUser && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[600] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 shadow-2xl">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-900 rounded-full flex items-center justify-center mx-auto text-3xl font-black mb-4">{(loginAttemptUser?.firstName || '?')[0]}</div>
              <h3 className="text-2xl font-black text-blue-900">ระบุรหัสผ่าน</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase">User: {loginAttemptUser.username}</p>
            </div>
            <input 
              type="password" 
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus 
              className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none focus:ring-4 focus:ring-blue-100 font-black text-center text-3xl tracking-widest text-blue-900" 
              value={loginPassword} 
              onChange={e => setLoginPassword(e.target.value.replace(/\D/g, ''))} 
              onKeyDown={e => e.key === 'Enter' && handleVerifyPassword()} 
            />
            <div className="flex gap-4">
              <button onClick={() => setLoginAttemptUser(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-sm">ยกเลิก</button>
              <button onClick={handleVerifyPassword} className="flex-1 py-5 bg-blue-900 text-white rounded-3xl font-black text-sm shadow-xl">ตกลง</button>
            </div>
          </div>
        </div>
      )}

      {successMessage && <div className="fixed top-24 left-4 right-4 bg-emerald-600 text-white p-6 rounded-[2rem] shadow-2xl z-[700] text-center font-black animate-in slide-in-from-top-4">{successMessage}</div>}

      <div className="animate-in fade-in duration-500">
        
        {/* หน้าจอ ขอน้ำยา / คืนน้ำยา (Guest) */}
        {(activeView === View.GUEST_REQUEST || activeView === View.GUEST_RETURN) && (
          <div className="space-y-8 pb-32">
            <div className={`${activeView === View.GUEST_REQUEST ? 'bg-blue-900' : 'bg-orange-600'} px-8 py-6 rounded-[2rem] text-white shadow-xl`}>
              <h2 className="text-2xl font-black leading-none">{activeView === View.GUEST_REQUEST ? 'แบบฟอร์มขอน้ำยา' : 'แบบฟอร์มคืนน้ำยา'}</h2>
              <p className="text-[10px] font-bold text-white/70 uppercase mt-2 tracking-widest">
                {activeView === View.GUEST_REQUEST ? 'Patient Request Form' : 'Supply Return Form'}
              </p>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ชื่อ-นามสกุล ผู้ป่วย</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-blue-900" placeholder="ระบุชื่อจริง-นามสกุล" value={guestForm.patient_name} onChange={e => setGuestForm({...guestForm, patient_name: e.target.value})} />
                </div>
                
                {/* ข้อมูล HN และ เลขที่แฟ้ม (Grid 2 columns) */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">เลขที่ HN (ไม่บังคับ)</label>
                    <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-blue-900" placeholder="เช่น 12345/67" value={guestForm.hn_number} onChange={e => setGuestForm({...guestForm, hn_number: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">เลขที่แฟ้ม (ไม่บังคับ)</label>
                    <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-blue-900" placeholder="ระบุเลขที่แฟ้ม" value={guestForm.file_number} onChange={e => setGuestForm({...guestForm, file_number: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">เบอร์โทรศัพท์ติดต่อ (10 หลัก)</label>
                  <input type="tel" maxLength={10} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-blue-900" placeholder="08XXXXXXXX" value={guestForm.phone} onChange={e => setGuestForm({...guestForm, phone: e.target.value.replace(/\D/g, '')})} />
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">เลือกรายการสินค้า</label>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold appearance-none text-blue-900 border border-transparent focus:border-blue-500" value={guestForm.product_name} onChange={e => setGuestForm({...guestForm, product_name: e.target.value})}>
                      <option value="" className="text-slate-400">-- เลือกรายการ --</option>
                      {registeredProducts.map(p => (
                        <option key={p.id} value={p.thai_name}>{p.thai_name} {p.search_name ? `(${p.search_name})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* แสดงรูปภาพสินค้าที่เลือก */}
                  {selectedGuestProduct && (
                    <div className="animate-in zoom-in-95 duration-300">
                      <div className="bg-slate-50 rounded-[2rem] p-4 border border-slate-100 flex flex-col items-center gap-3">
                        <div className="w-full aspect-video bg-white rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                          {selectedGuestProduct.photo ? (
                            <img src={selectedGuestProduct.photo} alt={selectedGuestProduct.thai_name} className="w-full h-full object-contain" />
                          ) : (
                            <div className="text-4xl">📦</div>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ตรวจสอบรายการก่อนกดส่ง</p>
                          <p className="font-black text-blue-900 text-sm mt-1">{selectedGuestProduct.thai_name}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">จำนวน</label>
                    <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-blue-900" placeholder="ระบุจำนวน" value={guestForm.quantity} min="1" onChange={e => setGuestForm({...guestForm, quantity: e.target.value === '' ? '' as unknown as number : parseInt(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">{activeView === View.GUEST_REQUEST ? 'วันที่มารับ' : 'วันที่มาส่ง'}</label>
                    <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-blue-900" value={guestForm.expected_date} onChange={e => setGuestForm({...guestForm, expected_date: e.target.value})} />
                  </div>
                </div>
              </div>
              <button disabled={isLoading} onClick={() => submitGuestRequest(activeView === View.GUEST_REQUEST ? 'Request' : 'Return')} className={`w-full py-6 text-white font-black rounded-[2rem] shadow-xl transition-all active:scale-95 ${activeView === View.GUEST_REQUEST ? 'bg-blue-900' : 'bg-orange-600'} ${isLoading ? 'opacity-50' : ''}`}>
                {isLoading ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลรายการ'}
              </button>
            </div>
          </div>
        )}

        {/* หน้าจอ รับสินค้าเข้า */}
        {activeView === View.STOCK_IN && currentUser && (
           <div className="space-y-8">
             <div className="bg-blue-900 px-8 py-6 rounded-[2rem] text-white shadow-xl">
               <h2 className="text-2xl font-black leading-none">รับสินค้าเข้า</h2>
               <p className="text-[10px] font-bold text-blue-200 uppercase mt-2 tracking-widest">Inventory Inflow</p>
             </div>
             
             {!scanResult && !isManualMode && (
               <div className="space-y-4">
                 <Scanner label="สแกนฉลากเพื่อรับเข้า" onScan={handleStockIn} isLoading={isLoading} />
                 <button onClick={() => setIsManualMode(true)} className="w-full py-4 bg-white border-2 border-blue-100 text-blue-900 font-black rounded-2xl shadow-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                   <span>📂</span> ไม่มีรูป/กล้องเสีย: เลือกรายการเอง
                 </button>
               </div>
             )}

             {scanResult && !matchedProduct && potentialMatches.length > 0 && (
               <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-bottom-4">
                 <div className="flex justify-between items-center">
                   <h3 className="font-black text-blue-900">พบหลายรายการที่ใกล้เคียง</h3>
                   <button onClick={() => {setScanResult(null); setPotentialMatches([]);}} className="text-xs font-bold text-slate-400">ยกเลิก</button>
                 </div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">กรุณาเลือกรายการที่ถูกต้องจากรูปภาพ</p>
                 <div className="space-y-2">
                   {potentialMatches.map(p => (
                     <div key={p.id} onClick={() => selectItemForStockIn(p, scanResult)} className="p-4 bg-blue-50/50 rounded-2xl hover:bg-blue-100 cursor-pointer border border-blue-100 flex items-center gap-4">
                       <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">📦</div>
                       <div>
                         <p className="font-black text-blue-900 text-sm">{p.thai_name}</p>
                         <p className="text-[9px] text-blue-400 font-bold uppercase">{p.search_name || p.english_name} {p.ai_search_name ? `| AI: ${p.ai_search_name}` : ''}</p>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {isManualMode && (
               <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-100 space-y-4">
                 <div className="flex justify-between items-center">
                   <h3 className="font-black text-blue-900">เลือกสินค้าจากคลังข้อมูล</h3>
                   <button onClick={() => setIsManualMode(false)} className="text-xs font-bold text-slate-400">ยกเลิก</button>
                 </div>
                 <input placeholder="พิมพ์ชื่อสินค้า หรือ ชื่อค้นหา..." className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-blue-900 border border-slate-100" value={manualSearchQuery} onChange={e => setManualSearchQuery(e.target.value)} />
                 <div className="max-h-60 overflow-y-auto space-y-2">
                   {filteredManualProducts.map(p => (
                     <div key={p.id} onClick={() => handleManualSelect(p)} className="p-4 bg-slate-50 rounded-2xl hover:bg-blue-50 cursor-pointer">
                       <p className="font-black text-slate-800 text-sm">{p.thai_name}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">{p.search_name || p.english_name}</p>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {scanResult && matchedProduct && (
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-6">
                  <div className="flex justify-between items-center border-b pb-4">
                    <div className="font-black text-xl text-blue-900">{matchedProduct.thai_name}</div>
                    <button onClick={() => {setScanResult(null); setMatchedProduct(null);}} className="text-slate-300">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Batch No.</label>
                      <input className="w-full p-4 bg-slate-50 rounded-xl outline-none font-black text-blue-900" value={scanResult.batchNo} onChange={e => setScanResult({...scanResult, batchNo: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">EXP</label>
                      <input type="date" className="w-full p-4 bg-slate-50 rounded-xl outline-none font-black text-blue-900" value={scanResult.exp} onChange={e => setScanResult({...scanResult, exp: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">วันที่รับเข้าสินค้า (ย้อนหลังได้)</label>
                    <input type="date" className="w-full p-4 bg-slate-50 rounded-xl outline-none font-black text-blue-900 border-2 border-blue-100" value={manualDate} onChange={e => setManualDate(e.target.value)} />
                  </div>
                  <div className="bg-blue-50 p-6 rounded-[2rem] text-center">
                    <p className="text-[10px] font-black text-blue-400 mb-2">จำนวนที่รับเข้า</p>
                    <div className="flex items-center justify-center gap-6">
                      <button onClick={() => setInputQty(Math.max(1, inputQty - 1))} className="w-12 h-12 bg-white rounded-full font-black text-blue-900">-</button>
                      <input type="number" className="bg-transparent text-center font-black text-4xl w-24 outline-none text-blue-900" value={inputQty} onChange={e => setInputQty(parseInt(e.target.value) || 1)} />
                      <button onClick={() => setInputQty(inputQty + 1)} className="w-12 h-12 bg-white rounded-full font-black text-blue-900">+</button>
                    </div>
                  </div>
                  <button onClick={executeStockIn} className="w-full py-6 bg-blue-900 text-white font-black rounded-[2rem] shadow-xl">ยืนยันรับเข้า</button>
                </div>
             )}
           </div>
        )}

        {/* หน้าจอ จ่ายสินค้าออก */}
        {activeView === View.STOCK_OUT && currentUser && (
          <div className="space-y-8">
             <div className="bg-red-900 px-8 py-6 rounded-[2rem] text-white shadow-xl">
               <h2 className="text-2xl font-black leading-none">จ่ายสินค้าออก</h2>
               <p className="text-[10px] font-bold text-red-200 uppercase mt-2 tracking-widest">Inventory Outflow</p>
             </div>

             {!scanResult && !isManualMode && (
               <div className="space-y-4">
                 <Scanner label="สแกนฉลากเพื่อจ่ายออก" onScan={handleStockOutScan} isLoading={isLoading} />
                 <button onClick={() => setIsManualMode(true)} className="w-full py-4 bg-white border-2 border-red-50 text-red-900 font-black rounded-2xl shadow-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                   <span>📂</span> ไม่มีรูป/กล้องเสีย: เลือกรายการเอง
                 </button>
               </div>
             )}

             {scanResult && !matchedProduct && potentialMatches.length > 0 && (
               <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-bottom-4">
                 <div className="flex justify-between items-center">
                   <h3 className="font-black text-red-900">พบหลายรายการที่ใกล้เคียง</h3>
                   <button onClick={() => {setScanResult(null); setPotentialMatches([]);}} className="text-xs font-bold text-slate-400">ยกเลิก</button>
                 </div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">กรุณาเลือกรายการที่ถูกต้องจากรูปภาพ</p>
                 <div className="space-y-2">
                   {potentialMatches.map(p => (
                     <div key={p.id} onClick={() => selectItemForStockOut(p, scanResult)} className="p-4 bg-red-50/50 rounded-2xl hover:bg-red-100 cursor-pointer border border-red-100 flex items-center gap-4">
                       <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">📦</div>
                       <div>
                         <p className="font-black text-red-900 text-sm">{p.thai_name}</p>
                         <p className="text-[9px] text-red-400 font-bold uppercase">{p.search_name || p.english_name} {p.ai_search_name ? `| AI: ${p.ai_search_name}` : ''}</p>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {isManualMode && (
               <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-100 space-y-4">
                 <div className="flex justify-between items-center">
                   <h3 className="font-black text-red-900">เลือกสินค้าที่จะจ่าย</h3>
                   <button onClick={() => setIsManualMode(false)} className="text-xs font-bold text-slate-400">ยกเลิก</button>
                 </div>
                 <input placeholder="พิมพ์ชื่อสินค้า หรือ ชื่อค้นหา..." className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-blue-900 border border-slate-100" value={manualSearchQuery} onChange={e => setManualSearchQuery(e.target.value)} />
                 <div className="max-h-60 overflow-y-auto space-y-2">
                   {filteredManualProducts.map(p => (
                     <div key={p.id} onClick={() => handleManualSelect(p)} className="p-4 bg-slate-50 rounded-2xl hover:bg-red-50 cursor-pointer">
                       <p className="font-black text-slate-800 text-sm">{p.thai_name}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">{p.search_name || p.english_name}</p>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {scanResult && matchedProduct && (
                <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-6">
                  <div className="flex justify-between items-center border-b pb-4">
                    <div className="font-black text-xl text-blue-900">{matchedProduct.thai_name}</div>
                    <button onClick={() => {setScanResult(null); setMatchedProduct(null);}} className="text-slate-300">✕</button>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Batch ที่ต้องการจ่าย</label>
                      <select 
                        className="w-full p-4 bg-slate-50 rounded-xl outline-none font-black text-blue-900 appearance-none border border-transparent focus:border-red-500"
                        value={scanResult.batchNo} 
                        onChange={e => {
                          const selectedBatch = e.target.value;
                          setScanResult({...scanResult, batchNo: selectedBatch});
                          // Potentially update EXP if we want to be fancy, but the scanner might have already found it.
                          // Actually, for dropdown, it's better to just set the batch.
                        }}
                      >
                        <option value="">-- เลือก Batch No. --</option>
                        {groupedStock.find(g => (g.thaiName === matchedProduct?.thai_name || g.englishName === matchedProduct?.english_name))?.batches.map((b: StockItem) => (
                          <option key={b.id} value={b.batch_no}>
                            {b.batch_no} (EXP: {b.exp}) - คงเหลือ: {b.quantity}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">ชื่อผู้ป่วย / หน่วยงาน</label>
                      <input className="w-full p-4 bg-slate-50 rounded-xl outline-none font-black text-blue-900" value={patientName} onChange={e => setPatientName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">วันที่จ่ายออก (ย้อนหลังได้)</label>
                      <input type="date" className="w-full p-4 bg-slate-50 rounded-xl outline-none font-black text-blue-900 border-2 border-red-100" value={manualDate} onChange={e => setManualDate(e.target.value)} />
                    </div>
                    <div className="bg-red-50 p-6 rounded-[2rem] text-center">
                      <p className="text-[10px] font-black text-red-400 mb-2">จำนวนที่จ่าย</p>
                      <div className="flex items-center justify-center gap-6">
                        <button onClick={() => setInputQty(Math.max(1, inputQty - 1))} className="w-12 h-12 bg-white rounded-full font-black text-blue-900">-</button>
                        <input type="number" className="bg-transparent text-center font-black text-4xl w-24 outline-none text-blue-900" value={inputQty} onChange={e => setInputQty(parseInt(e.target.value) || 1)} />
                        <button onClick={() => setInputQty(inputQty + 1)} className="w-12 h-12 bg-white rounded-full font-black text-blue-900">+</button>
                      </div>
                    </div>
                  </div>
                  <button onClick={executeStockOut} className="w-full py-6 bg-red-600 text-white font-black rounded-[2rem] shadow-xl">บันทึกการจ่ายออก</button>
                </div>
             )}
          </div>
        )}

        {/* หน้าจอ ลงทะเบียนสินค้า (Master Data) */}
        {activeView === View.REGISTRATION && currentUser && (
           <div className="space-y-8 pb-32">
             <div className="bg-purple-900 p-10 rounded-[3rem] text-white shadow-xl">
               <h2 className="text-3xl font-black leading-none">ลงทะเบียนสินค้า</h2>
               <p className="text-xs font-bold text-purple-200 uppercase mt-3 tracking-widest">Master Data Registration</p>
             </div>
             
             {!scanResult && (
               <div className="space-y-4">
                 <Scanner label="สแกนเพื่อเริ่มลงทะเบียน" onScan={handleRegisterScan} isLoading={isLoading} />
                 <button onClick={startManualRegistration} className="w-full py-4 bg-white border-2 border-purple-100 text-purple-900 font-black rounded-2xl shadow-sm hover:bg-purple-50 transition-all flex items-center justify-center gap-2">
                   <span>➕</span> ไม่มีรูป/กล้องเสีย: กรอกข้อมูลเอง
                 </button>
               </div>
             )}

             {scanResult && (
               <div className="bg-white p-8 rounded-[3rem] shadow-2xl space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-purple-900 uppercase tracking-widest">{editingProductId ? 'แก้ไขข้อมูล' : 'กรอกข้อมูลสินค้า'}</h3>
                    <button onClick={() => setScanResult(null)} className="text-xs font-bold text-slate-400">ยกเลิก</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ชื่อเต็ม (Full Name)</label>
                      <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-blue-900" value={scanResult.thaiName} onChange={e => setScanResult({...scanResult, thaiName: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">AI Search Name (AI ONLY)</label>
                      <input 
                        readOnly
                        className="w-full p-4 bg-amber-50 cursor-not-allowed rounded-2xl outline-none font-black text-amber-900 border border-amber-100" 
                        placeholder="[AI จะใส่ข้อมูลให้อัตโนมัติเมื่อเพิ่มรูป]" 
                        value={scanResult.aiSearchName} 
                      />
                    </div>
                  </div>
                  
                  {/* Photo Section in Registration */}
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">รูปภาพสินค้า (ต้องมีอย่างน้อย 1 รูปเพื่อให้ AI ทำงาน)</label>
                    <Scanner 
                      label={scanResult.image ? "เปลี่ยนรูปสินค้า" : "เพิ่มรูปสินค้าเพื่อให้ AI วิเคราะห์"} 
                      onScan={handleProductScanDuringRegistration} 
                      isLoading={isLoading} 
                    />
                    {scanResult.image && (
                      <div className="w-full h-48 bg-slate-50 rounded-[2rem] overflow-hidden border-2 border-slate-100 flex items-center justify-center p-2">
                        <img src={scanResult.image} alt="Target Product" className="h-full object-contain rounded-xl" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ชื่อค้นหาทั่วไป (Search Name)</label>
                      <input className="w-full p-4 bg-blue-50/50 rounded-2xl outline-none font-black text-blue-900" placeholder="เช่น รหัสย่อ หรือ ชื่อเรียกสั้นๆ" value={scanResult.searchName} onChange={e => setScanResult({...scanResult, searchName: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">ผู้ผลิต</label>
                      <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-blue-900" value={scanResult.manufacturer} onChange={e => setScanResult({...scanResult, manufacturer: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Min Stock Alert</label>
                      <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-blue-900" value={tempMinStock} onChange={e => setTempMinStock(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Critical Stock Alert</label>
                      <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-blue-900" value={tempCriticalStock} onChange={e => setTempCriticalStock(parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Email แจ้งเตือน (กรณีวิกฤติ)</label>
                    <input type="email" placeholder="example@email.com" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-blue-900" value={tempAlertEmail} onChange={e => setTempAlertEmail(e.target.value)} />
                  </div>
                  <button onClick={executeRegistration} className="w-full py-6 bg-purple-600 text-white font-black rounded-[2rem] shadow-xl">💾 บันทึกข้อมูลสินค้า</button>
               </div>
             )}
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
               {registeredProducts.map(p => (
                 <div key={p.id} onClick={() => selectProductForEdit(p)} className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-purple-300 transition-all">
                   <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-xl shrink-0 text-purple-600 font-bold">📦</div>
                   <div className="truncate">
                     <p className="font-black text-slate-800 text-sm truncate">{p.thai_name}</p>
                      <div className="flex gap-1 overflow-hidden">
                        <p className="text-[9px] font-bold text-slate-400 uppercase truncate">
                          {p.search_name || 'NO SEARCH TAG'}
                        </p>
                        {p.ai_search_name && (
                          <span className="text-[8px] font-black bg-amber-50 text-amber-600 px-1 rounded uppercase shrink-0">AI: {p.ai_search_name}</span>
                        )}
                      </div>
                   </div>
                 </div>
               ))}
             </div>
           </div>
        )}

        {/* หน้าจอ รายการรอคิว (Staff/Admin) */}
        {activeView === View.QUEUE_LIST && currentUser && (
          <div className="space-y-8 pb-32">
            <div className="bg-indigo-900 p-10 rounded-[3rem] text-white shadow-xl flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black leading-none">รายการรอคิว</h2>
                <p className="text-xs font-bold text-indigo-200 uppercase mt-3 tracking-widest">Guest Request Queue</p>
              </div>
              <button onClick={loadData} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">🔄</button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {sortedGuestRequests.length === 0 && <div className="text-center py-20 text-slate-400 font-bold">ไม่มีรายการรอคิว</div>}
              {sortedGuestRequests.map(req => (
                <div key={req.id} className={`bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition-all ${req.status !== 'Pending' ? 'opacity-60 grayscale' : 'border-indigo-100'}`}>
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className={`w-14 h-14 rounded-3xl flex items-center justify-center font-black text-xl shadow-inner shrink-0 ${req.type === 'Request' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                      {req.type === 'Request' ? 'ขอ' : 'คืน'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h4 className="font-black text-slate-800 text-lg leading-none truncate">{req.patient_name}</h4>
                      </div>
                      
                      {/* ข้อมูล HN และ เลขที่แฟ้ม (Enhanced Badges) */}
                      {(req.hn_number || req.file_number) && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {req.hn_number && (
                            <span className="flex items-center gap-1 text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100 shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              HN: {req.hn_number}
                            </span>
                          )}
                          {req.file_number && (
                            <span className="flex items-center gap-1 text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg border border-indigo-100 shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4a2 2 0 0 1 2-2h8.5L20 7.5V22a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><polyline points="14 2 14 8 20 8"/></svg>
                              แฟ้ม: {req.file_number}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center flex-wrap gap-2 mt-2">
                        <p className="text-xs font-bold text-slate-500 truncate max-w-[200px]">{req.product_name}</p>
                        <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          x {req.quantity}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] font-black uppercase px-2 py-1 bg-slate-100 rounded-lg text-slate-500">
                          {req.type === 'Request' ? 'นัดรับ:' : 'นัดคืน:'} {new Date(req.expected_date).toLocaleDateString('th-TH')}
                        </span>
                        {req.status !== 'Pending' && (
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${req.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            {req.status === 'Completed' ? 'ดำเนินการแล้ว' : 'ยกเลิกแล้ว'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-right w-full md:w-auto mt-4 md:mt-0">
                    <button onClick={() => handleCallAndCopy(req.phone)} className="flex items-center justify-center md:justify-end gap-2 text-blue-600 bg-blue-50 px-5 py-2.5 rounded-2xl border border-blue-100 hover:bg-blue-100 transition-colors shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      <span className="font-black text-sm">{req.phone}</span>
                    </button>
                    {req.status === 'Pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => updateQueueStatus(req.id, 'Cancelled')} className="px-5 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black flex-1 md:flex-initial hover:bg-slate-200 transition-colors">ยกเลิก</button>
                        <button onClick={() => updateQueueStatus(req.id, 'Completed')} className="px-5 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black flex-1 md:flex-initial shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">เรียบร้อย</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* หน้าจอสต๊อกคงเหลือ */}
        {activeView === View.INVENTORY && currentUser && (
          <div className="space-y-8">
            <div className="flex justify-between items-end px-2">
              <div>
                <h2 className="text-3xl font-black text-slate-800">สต๊อกคงเหลือ</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cloud Sync Active</p>
              </div>
              <div className="flex gap-2">
                {currentUser?.role === 'admin' && (
                  <button 
                    onClick={() => setActiveView(View.RECALIBRATE)}
                    className="px-6 py-3 bg-amber-500 text-white font-black rounded-2xl shadow-lg shadow-amber-900/10 hover:bg-amber-600 transition-all flex items-center gap-2"
                  >
                    <span>⚖️</span> ปรับสต็อก (Recalibrate)
                  </button>
                )}
                <button onClick={loadData} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">🔄</button>
              </div>
            </div>
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase">สินค้า</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase text-center">คงเหลือ</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase text-center">วันหมดอายุใกล้สุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {groupedStock.map((group: any, idx) => {
                    const isCritical = group.totalCount <= group.criticalStock;
                    const isLow = group.totalCount <= group.minStock && !isCritical;
                    const isExpanded = selectedInventoryItem?.name === group.name;

                    return (
                      <React.Fragment key={idx}>
                        <tr 
                          onClick={() => setSelectedInventoryItem(isExpanded ? null : group)}
                          className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${isCritical ? 'bg-red-50/30' : ''} ${isExpanded ? 'bg-blue-50/30' : ''}`}
                        >
                          <td className="px-8 py-7">
                            <div className="flex items-center gap-3">
                              <span className={`text-xs transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                              <div>
                                <div className="font-black text-slate-800">{group.thaiName || group.englishName}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase">{group.manufacturer}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-7 text-center">
                            <span className={`px-4 py-2 rounded-2xl font-black text-sm ${
                              isCritical
                                ? 'bg-red-600 text-white animate-blink shadow-lg shadow-red-900/20'
                                : isLow 
                                  ? 'bg-amber-400 text-white shadow-sm' 
                                  : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {group.totalCount}
                            </span>
                          </td>
                          <td className="px-8 py-7 text-center">
                            <span className="text-[12px] font-black text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                              {group.nearestExpiry ? (() => {
                                const parts = group.nearestExpiry.split('-');
                                return parts.length >= 2 ? `${parts[1]}/${parts[0]}` : group.nearestExpiry;
                              })() : '-'}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/30">
                            <td colSpan={3} className="px-8 py-4">
                              <div className="bg-white rounded-2xl border border-slate-100 shadow-inner overflow-hidden animate-in slide-in-from-top-2">
                                <table className="w-full text-left">
                                  <thead className="bg-slate-100/50">
                                    <tr>
                                      <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase">Batch No.</th>
                                      <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase">EXP Date</th>
                                      <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase text-center">Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {group.batches.map((batch: StockItem, bIdx: number) => (
                                      <tr key={bIdx} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 font-bold text-slate-700 text-xs">{batch.batch_no}</td>
                                        <td className="px-6 py-3 font-bold text-slate-600 text-xs">
                                          {batch.exp ? (() => {
                                            const parts = batch.exp.split('-');
                                            return parts.length >= 2 ? `${parts[1]}/${parts[0]}` : batch.exp;
                                          })() : '-'}
                                        </td>
                                        <td className="px-6 py-3 font-black text-blue-600 text-xs text-center">{batch.quantity}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              {isDataLoading && <div className="p-8 text-center text-slate-400 font-bold text-xs">กำลังโหลดข้อมูลล่าสุด...</div>}
            </div>
          </div>
        )}

        {/* หน้าจอพิเศษ: Recalibrate Stock (Admin Only) */}
        {activeView === View.RECALIBRATE && currentUser?.role === 'admin' && (
          <div className="space-y-8 pb-32">
            <div className="bg-amber-600 p-10 rounded-[3rem] text-white shadow-xl">
              <h2 className="text-3xl font-black leading-none text-white">ปรับแก้สต็อกสินค้า</h2>
              <p className="text-xs font-bold text-amber-100 uppercase mt-3 tracking-widest">Stock Recalibration Mode</p>
            </div>

            <div className="space-y-4">
              {groupedStock.map((group: any, gIdx: number) => (
                <div key={gIdx} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800">{group.thaiName || group.englishName}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{group.manufacturer}</p>
                  </div>
                  
                  <div className="space-y-4">
                    {group.batches.map((batch: StockItem, bIdx: number) => (
                      <div key={bIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-xs font-black text-slate-700">Batch: {batch.batch_no}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">
                            EXP: {batch.exp ? (() => {
                              const parts = batch.exp.split('-');
                              return parts.length >= 2 ? `${parts[1]}/${parts[0]}` : batch.exp;
                            })() : '-'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <button 
                            disabled={isLoading}
                            onClick={async () => {
                              setIsLoading(true);
                              try {
                                await storageService.releaseItemByBatch(batch.batch_no, 1, currentUser.username, "RECALIBRATION", new Date().toISOString().split('T')[0]);
                                showSuccess("ปรับลดสต็อกแล้ว");
                                loadData();
                              } catch (err: any) {
                                setError(err.message);
                              } finally {
                                setIsLoading(false);
                              }
                            }}
                            className="bg-red-100 text-red-600 px-4 py-2 rounded-xl font-black text-xs hover:bg-red-200 transition-colors"
                          >
                            จ่ายออก (-1)
                          </button>
                          
                          <div className="w-12 text-center font-black text-blue-600 text-lg">
                            {batch.quantity}
                          </div>

                          <button 
                            disabled={isLoading}
                            onClick={async () => {
                              setIsLoading(true);
                              try {
                                await storageService.saveItem({
                                  thai_name: batch.thai_name,
                                  english_name: batch.english_name,
                                  batch_no: batch.batch_no,
                                  mfd: batch.mfd,
                                  exp: batch.exp,
                                  manufacturer: batch.manufacturer,
                                  quantity: 1,
                                  receipt_date: new Date().toISOString().split('T')[0]
                                }, currentUser.username);
                                showSuccess("ปรับเพิ่มสต็อกแล้ว");
                                loadData();
                              } catch (err: any) {
                                setError(err.message);
                              } finally {
                                setIsLoading(false);
                              }
                            }}
                            className="bg-emerald-100 text-emerald-600 px-4 py-2 rounded-xl font-black text-xs hover:bg-emerald-200 transition-colors"
                          >
                            รับเข้า (+1)
                          </button>
                        </div>
                      </div>
                    ))}
                    {group.batches.length === 0 && (
                      <div className="p-8 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 text-center">
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">ไม่มีสินค้าในคลัง</p>
                        <p className="text-[10px] text-slate-300 mt-1">กรุณาใช้เมนู "รับเข้า" เพื่อระบุ Batch No. ใหม่</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setActiveView(View.INVENTORY)} className="w-full py-5 bg-slate-100 text-slate-400 font-black rounded-2xl">กลับหน้าหลัก</button>
          </div>
        )}

        {/* หน้าจอ Update Logs (Admin Only) */}
        {activeView === View.UPDATE_LOGS && currentUser?.role === 'admin' && (
          <div className="space-y-8 pb-32">
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl">
              <h2 className="text-3xl font-black leading-none text-white">บันทึกการอัปเดตระบบ</h2>
              <p className="text-xs font-bold text-slate-400 uppercase mt-3 tracking-widest">System Update Logs</p>
            </div>

            <div className="space-y-6">
              {[
                {
                  version: 'Update - 016',
                  date: '2026-04-25',
                  changes: [
                    'ปรับปรุงรูปแบบวันหมดอายุใกล้สุดให้แสดงเพียง เดือน/ปี (MM/YYYY)',
                    'เพิ่มการตรวจจับข้อผิดพลาด Gmail Daily Limit (550) เพื่อหยุดการส่งซ้ำอัตโนมัติ',
                    'แก้ไขปัญหาแอพค้างจาก Email Loop เมื่อโควตาเต็ม'
                  ],
                  isNew: true
                },
                {
                  version: 'Update - 015',
                  date: '2026-04-25',
                  changes: [
                    'แก้ไขปัญหา Email Loop และ Gmail Rate Limit อย่างสมบูรณ์',
                    'เพิ่มระบบ SMTP Pooling เพื่อลดจำนวนครั้งการ Login ไปยัง Gmail',
                    'ระบบจดจำสถานะการส่ง Email ลงในเครื่อง (LocalStorage) แม้ Refresh หน้าเดิมก็ไม่ส่งซ้ำ',
                    'เพิ่มการหน่วงเวลา 1 วินาทีระหว่างการส่งแต่ละฉบับ'
                  ]
                },
                {
                  version: 'Update - 014',
                  date: '2026-04-25',
                  changes: [
                    'เพิ่มระบบ Email Retry สำหรับจัดการข้อผิดพลาด SMTP 421 (Temporary System Problem)',
                    'ปรับปรุงความเสถียรของระบบแจ้งเตือนอัตโนมัติ',
                    'อัปเดตเวอร์ชันเป็น 014'
                  ]
                },
                {
                  version: 'Update - 013',
                  date: '2026-04-25',
                  changes: [
                    'แสดงรายการสินค้าในหน้าสต็อกแม้จำนวนคงเหลือจะเป็น 0',
                    'ถอดการยืนยัน (Confirmation) ในโหมด Recalibrate เพื่อความรวดเร็ว',
                    'ปรับปรุงความเสถียรของระบบคำนวณ Stock Grouping'
                  ]
                },
                {
                  version: 'Update - 012',
                  date: '2026-04-25',
                  changes: [
                    'เพิ่มโหมด Recalibrate Stock สำหรับ Admin เพื่อปรับสต็อกได้ทันที (ไม่ต้องพิมพ์ชื่อ/Batch)',
                    'เปลี่ยนช่องกรอก Batch No. ในหน้า "จ่ายออก" เป็น Dropdown เพื่อความรวดเร็ว',
                    'ปรับปรุงเวอร์ชันเป็น 012'
                  ]
                },
                {
                  version: 'Update - 011',
                  date: '2026-04-25',
                  changes: [
                    'เพิ่มระบบดู Stock แยกตาม Batch และวันหมดอายุ (Sub-stock View)',
                    'ปรับปรุงหน้า Inventory ให้สามารถคลิกเพื่อดูรายละเอียดรายการย่อยได้',
                    'แก้ไขการจัดเรียงวันหมดอายุในหน้าสรุปสต็อก'
                  ]
                },
                {
                  version: 'Update - 010',
                  date: '2026-04-25',
                  changes: [
                    'เพิ่มหน้า Update Logs สำหรับติดตามประวัติการอัปเดตระบบ (เฉพาะ Admin)',
                    'ปรับปรุงเวอร์ชันเป็น 010 เพื่อรองรับฟีเจอร์ใหม่',
                    'แก้ไขลิงก์การนำทางในส่วนของ Header ให้ถูกต้อง'
                  ]
                },
                {
                  version: 'Update - 009',
                  date: '2026-04-25',
                  changes: [
                    'เพิ่มการจดจำสีฉลากของ Lucenxia (ขาว 1.5%, น้ำเงิน 2.5%, ชมพู 4.25%)',
                    'พัฒนาระบบ AI Scanner ให้แสดงรายการที่ใกล้เคียงเมื่อพบหลายรายการ',
                    'แก้ไขระบบสแกนในหน้า "รับเข้า" และ "จ่ายออก" ให้ทำงานเสถียรขึ้น'
                  ]
                }
              ].map(log => (
                <div key={log.version} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-4 relative overflow-hidden">
                  {log.isNew && <div className="absolute top-0 right-0 bg-blue-600 text-white text-[8px] font-black px-4 py-1 uppercase rounded-bl-xl tracking-widest shadow-lg">LATEST</div>}
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800">{log.version}</h3>
                    <span className="text-[10px] font-bold text-slate-400">{log.date}</span>
                  </div>
                  <ul className="space-y-2">
                    {log.changes.map((change, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0"></span>
                        <span className="text-sm font-bold text-slate-600 leading-relaxed">{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            
            <button onClick={() => setActiveView(View.INVENTORY)} className="w-full py-5 bg-slate-100 text-slate-400 font-black rounded-2xl">กลับหน้าหลัก</button>
          </div>
        )}

        {/* หน้าจอ Login สำหรับ Staff */}
        {activeView === View.USERS && (
          <div className="space-y-8 pb-32">
            <div className="bg-slate-700 p-10 rounded-[3rem] text-white shadow-xl">
              <h2 className="text-3xl font-black leading-none">เข้าสู่ระบบเจ้าหน้าที่</h2>
              <p className="text-xs font-bold text-slate-300 uppercase mt-3 tracking-widest">Authorized Personnel Only</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users.length > 0 ? (
                users.map(u => (
                  <div key={u.id} onClick={() => {setLoginAttemptUser(u); setLoginPassword('');}} className="p-6 bg-white rounded-[2.5rem] border-2 border-slate-100 hover:border-blue-500 cursor-pointer flex items-center gap-5">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center font-black text-xl">{(u.firstName || '?')[0]}</div>
                    <div>
                      <p className="font-black text-slate-800">{u.firstName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{u.role}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full p-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 text-center">
                   <span className="text-4xl mb-4 block">🔌</span>
                   <p className="font-black text-slate-400 uppercase tracking-widest text-xs">ไม่พบรายชื่อบุคลากร</p>
                   <p className="text-[10px] text-slate-400 mt-2">กรุณาตรวจสอบการเชื่อมต่อ Supabase หรือเปิดใช้งาน RLS Policy</p>
                   <button onClick={() => loadData()} className="mt-6 px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs">RELOAD 🔄</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* หน้าจอจัดการผู้ใช้ (Admin Only) */}
        {activeView === View.USER_MANAGEMENT && currentUser?.role === 'admin' && (
          <div className="space-y-8 pb-32">
            <div className="bg-purple-900 p-10 rounded-[3rem] text-white shadow-xl flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black leading-none text-white">จัดการผู้ใช้งาน</h2>
              </div>
              <button onClick={() => storageService.migrateDatabase().then(() => showSuccess("Database Updated"))} className="px-4 py-2 bg-white/10 text-white text-[10px] font-black rounded-xl">DB SYNC 🔄</button>
            </div>

            {/* ส่วนของแบบฟอร์ม: ล็อคไว้จนกว่าจะกดปุ่มเพิ่ม */}
            {(!isAddingUser && !editingUser) ? (
              <button 
                onClick={() => {
                  setIsAddingUser(true); 
                  setNewUser({ firstName: '', lastName: '', username: '', password: '', role: 'staff' });
                }}
                className="w-full py-8 bg-white border-4 border-dashed border-purple-200 text-purple-900 font-black rounded-[3rem] shadow-sm hover:border-purple-400 transition-all flex flex-col items-center justify-center gap-2"
              >
                <span className="text-3xl">👤➕</span>
                <span className="text-sm uppercase tracking-widest">เพิ่มผู้ใช้งานใหม่</span>
              </button>
            ) : (
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border-4 border-purple-100 space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-purple-900 uppercase tracking-widest">{editingUser ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}</h3>
                  <button onClick={() => {setIsAddingUser(false); setEditingUser(null);}} className="text-xs font-bold text-slate-400">ยกเลิก</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 ml-2">ชื่อเรียก</label>
                    <input placeholder="เช่น หมอแจ็ค" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-blue-900 border border-transparent focus:border-blue-500" value={newUser.firstName} onChange={e => setNewUser({...newUser, firstName: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 ml-2">Username</label>
                    <input placeholder="ภาษาอังกฤษ" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-blue-900 border border-transparent focus:border-blue-500" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 ml-2">Email แจ้งเตือน</label>
                    <input placeholder="เช่น example@mail.com" className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-blue-900 border border-transparent focus:border-blue-500" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 ml-2">รหัสผ่าน (ตัวเลขเท่านั้น)</label>
                    <input 
                      type="password" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="เช่น 1234" 
                      className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-blue-900 border border-transparent focus:border-blue-500 text-center text-xl tracking-widest" 
                      value={newUser.password} 
                      onChange={e => setNewUser({...newUser, password: e.target.value.replace(/\D/g, '')})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 ml-2">ระดับสิทธิ์</label>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-blue-900 border border-transparent focus:border-blue-500 appearance-none" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                      <option value="staff">Staff (เจ้าหน้าที่)</option>
                      <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => {setIsAddingUser(false); setEditingUser(null);}} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl">ยกเลิก</button>
                  <button onClick={handleUserReg} className="flex-[2] py-5 bg-purple-600 text-white font-black rounded-2xl shadow-lg hover:bg-purple-700 transition-all">
                    {editingUser ? '💾 บันทึกการแก้ไข' : '✅ ยืนยันเพิ่มผู้ใช้'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ระบบฐานข้อมูล</h3>
                <button 
                  onClick={async () => {
                    if (!window.confirm("ต้องการเตรียมความพร้อมฐานข้อมูล (Migrate) ใช่หรือไม่?\nขั้นตอนนี้จะสร้างตารางที่จำเป็นใน Supabase")) return;
                    setIsLoading(true);
                    try {
                      await storageService.migrateDatabase();
                      showSuccess("เตรียมฐานข้อมูลสำเร็จ! พร้อมใช้งานแล้ว");
                    } catch (err: any) {
                      setError(err.message);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="p-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black flex items-center gap-2 active:scale-95 transition-all shadow-lg"
                >
                  <span>⚡️</span> ตั้งค่าฐานข้อมูล (MIGRATE)
                </button>
              </div>

              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mt-8">รายชื่อผู้ใช้งานในระบบ</h3>
              {users.map(u => (
                <div key={u.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm hover:border-purple-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-white ${u.role === 'admin' ? 'bg-purple-600' : 'bg-blue-600'}`}>{(u.firstName || '?')[0]}</div>
                    <div>
                      <p className="font-black text-slate-800">{u.firstName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">@{u.username} • {u.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {setEditingUser(u); setNewUser({...u, password: u.password || ''}); window.scrollTo({ top: 0, behavior: 'smooth' });}} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center">✏️</button>
                    <button onClick={() => handleDeleteUser(u.id)} className="w-10 h-10 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dashboard & History view */}
        {activeView === View.DASHBOARD && currentUser && (
          <div className="space-y-8 pb-32">
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black leading-none">แผงควบคุมสรุป</h2>
                <p className="text-xs font-bold text-slate-400 uppercase mt-3 tracking-widest">Dashboard & History</p>
              </div>
              <button onClick={loadData} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">🔄</button>
            </div>

            {/* ส่วนสรุปคงเหลือ (แบบย่อ) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedStock.slice(0, 6).map((group: any, idx) => {
                const isCritical = group.totalCount <= group.criticalStock;
                const isLow = group.totalCount <= group.minStock && !isCritical;
                
                return (
                  <div key={idx} className={`bg-white p-6 rounded-[2.5rem] border shadow-sm flex items-center justify-between transition-all ${isCritical ? 'border-red-500 bg-red-50' : isLow ? 'border-amber-400 bg-amber-50' : 'border-slate-100'}`}>
                    <div className="truncate pr-4">
                      <p className={`font-black text-sm truncate ${isCritical ? 'text-red-900' : isLow ? 'text-amber-900' : 'text-slate-800'}`}>{group.thaiName || group.englishName}</p>
                      <p className={`text-[9px] font-bold uppercase tracking-tighter ${isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-slate-400'}`}>
                        {isCritical ? '!!! วิกฤติ !!!' : isLow ? '!! ต่ำกว่ากำหนด !!' : 'ยอดคงคลัง'}
                      </p>
                      {isCritical && !group.alertAcknowledgedAt && group.productId && (
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm(`ยืนยันการรับทราบคำเตือนสำหรับ ${group.thaiName}?\nระบบจะหยุดส่งอีเมลแจ้งเตือนจนกว่าสต็อกจะกลับมาปกติ`)) return;
                            try {
                              await storageService.updateProduct(group.productId, { alert_acknowledged_at: new Date().toISOString() });
                              showSuccess("รับทราบคำเตือนแล้ว");
                              loadData();
                            } catch (err: any) {
                              setError(err.message);
                            }
                          }}
                          className="mt-2 px-3 py-1 bg-red-600 text-white text-[10px] font-bold rounded-full shadow-md active:scale-95 transition-all"
                        >
                          🔔 รับทราบ & ปิดแจ้งเตือน
                        </button>
                      )}
                      {isCritical && group.alertAcknowledgedAt && (
                        <p className="mt-2 text-[8px] font-bold text-red-400 italic">✓ รับทราบแล้วเมื่อ {new Date(group.alertAcknowledgedAt).toLocaleDateString('th-TH')}</p>
                      )}
                    </div>
                    <div className={`text-xl font-black ${isCritical ? 'text-red-600 animate-blink' : isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {group.totalCount}
                    </div>
                  </div>
                );
              })}
              {groupedStock.length > 6 && (
                <button onClick={() => setActiveView(View.INVENTORY)} className="bg-blue-50 p-6 rounded-[3rem] border border-blue-100 text-blue-600 font-black text-sm flex items-center justify-center">
                  ดูทั้งหมดในคลัง ({groupedStock.length}) →
                </button>
              )}
            </div>

            {/* ประวัติการรับ/จ่าย (ยุบรวม) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ประวัติการ รับ-จ่าย {historyFilter === 'in' ? 'รับเข้า' : historyFilter === 'out' ? 'จ่ายออก' : 'ทั้งหมด'}</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner w-full sm:w-auto">
                  <button 
                    onClick={() => setHistoryFilter('all')} 
                    className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${historyFilter === 'all' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    ทั้งหมด
                  </button>
                  <button 
                    onClick={() => setHistoryFilter('in')} 
                    className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${historyFilter === 'in' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    รับเข้า
                  </button>
                  <button 
                    onClick={() => setHistoryFilter('out')} 
                    className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${historyFilter === 'out' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    จ่ายออก
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50">
                     <tr>
                       <th className="p-4 text-[10px] font-black uppercase text-slate-400">วันที่ / ประเภท</th>
                       <th className="p-4 text-[10px] font-black uppercase text-slate-400">สินค้า/ผู้เกี่ยวข้อง</th>
                       <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-center">จำนวน</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y text-slate-600">
                     {mergedHistory.length === 0 && <tr><td colSpan={3} className="p-10 text-center text-slate-400 font-bold">ไม่มีข้อมูลประวัติ</td></tr>}
                     {mergedHistory.map((h: any) => (
                       <tr key={h.historyType + '-' + h.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="p-4">
                           <p className="text-[10px] font-bold text-slate-500">{new Date(h.created_at).toLocaleDateString('th-TH')}</p>
                           <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${h.historyType === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                             {h.historyType === 'in' ? 'รับเข้า' : 'จ่ายออก'}
                           </span>
                         </td>
                         <td className="p-4">
                           <p className="font-black text-slate-800 text-xs">{h.thai_name}</p>
                           <p className="text-[9px] font-bold text-slate-400 truncate max-w-[150px]">
                             {h.patient_name ? `ผู้ป่วย: ${h.patient_name}` : `โดย: @${h.processed_by}`}
                           </p>
                         </td>
                         <td className={`p-4 font-black text-sm text-center ${h.historyType === 'in' ? 'text-emerald-600' : 'text-orange-600'}`}>
                           {h.historyType === 'in' ? '+' : '-'}{h.quantity}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
            </div>
          </div>
        )}

        {/* ประวัติการรับ/จ่าย (Legacy - Deprecated but kept for safety) */}
        {(activeView === View.RECEIPT_HISTORY || activeView === View.RELEASE_HISTORY) && currentUser && (
           <div className="space-y-8 pb-32">
             <div className={`${activeView === View.RECEIPT_HISTORY ? 'bg-emerald-900' : 'bg-orange-900'} p-10 rounded-[3rem] text-white shadow-xl`}>
               <h2 className="text-3xl font-black leading-none">{activeView === View.RECEIPT_HISTORY ? 'ประวัติการรับเข้า' : 'ประวัติการจ่ายออก'}</h2>
             </div>
             <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">วันที่</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">สินค้า/ผู้ป่วย</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">จำนวน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(activeView === View.RECEIPT_HISTORY ? receiptHistory : releaseHistory).map((h: any) => (
                      <tr key={h.id}>
                        <td className="p-4 text-[10px] font-bold text-slate-500">{new Date(h.created_at).toLocaleDateString('th-TH')}</td>
                        <td className="p-4">
                          <p className="font-black text-slate-800 text-xs">{h.thai_name}</p>
                          <p className="text-[9px] font-bold text-slate-400">{h.patient_name ? `ผู้ป่วย: ${h.patient_name}` : `โดย: @${h.processed_by}`}</p>
                        </td>
                        <td className="p-4 font-black text-xs">{h.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </div>
        )}

      </div>
      {error && (
        <div className="fixed bottom-28 left-4 right-4 bg-red-600 text-white p-6 rounded-[2rem] shadow-2xl z-[800] flex items-center justify-between font-black animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-4">
            <span className="text-2xl">⚠️</span>
            <div className="flex flex-col">
              <span className="text-xs leading-tight mb-2">{error}</span>
              {error.toLowerCase().includes('schema cache') && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    setIsLoading(true);
                    try {
                      await storageService.migrateDatabase();
                      showSuccess("บังคับอัปเดตระบบแล้ว กรุณาลองใหม่");
                      setError(null);
                      loadData();
                    } catch(err: any) {
                      setError("Sync ไม่สำเร็จ: " + err.message);
                    } finally {
                      setIsLoading(false);
                    }
                  }} 
                  className="bg-white text-red-600 px-4 py-2 rounded-xl text-[10px] uppercase shadow-lg active:scale-95 transition-all w-fit"
                >
                  แก้ปัญหาด้วยการ SYNC 🔄
                </button>
              )}
            </div>
          </div>
          <button onClick={() => setError(null)} className="h-8 w-8 flex shrink-0 items-center justify-center bg-white/20 rounded-full text-xs hover:bg-white/30 transition-colors">✕</button>
        </div>
      )}
    </Layout>
  );
};

export default App;
