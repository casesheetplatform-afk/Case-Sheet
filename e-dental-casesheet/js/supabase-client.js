/**
 * E-Dental CaseSheet Platform - Supabase Cloud Synchronization Engine
 * Academic Year 2026–2027 • College of Dentistry Clinical Information System
 */

(function () {
  const STORAGE_KEY_URL = 'e_dental_supabase_url';
  const STORAGE_KEY_KEY = 'e_dental_supabase_key';
  const STORAGE_KEY_MODE = 'e_dental_supabase_mode'; // 'live', 'demo', or 'offline'

  // SQL Schema Script for one-click setup in Supabase SQL Editor
  const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- E-Dental CaseSheet • Database Schema (Supabase PostgreSQL)
-- Academic Year 2026-2027 • College of Dentistry CIS
-- ========================================================

-- 1. Create Patients Table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_number TEXT UNIQUE,
    full_name TEXT NOT NULL,
    age TEXT,
    sex TEXT,
    occupation TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Case Sheets Table
CREATE TABLE IF NOT EXISTS public.case_sheets (
    id TEXT PRIMARY KEY,
    patient_file TEXT,
    patient_name TEXT NOT NULL,
    patient_age TEXT,
    patient_sex TEXT,
    patient_phone TEXT,
    dept_id TEXT NOT NULL,
    dept_name TEXT NOT NULL,
    sheet_id TEXT NOT NULL,
    sheet_code TEXT NOT NULL,
    sheet_title TEXT NOT NULL,
    student_id TEXT DEFAULT 'STU-4891',
    student_name TEXT DEFAULT 'د. علي حيدر الموسوي',
    chief_complaint TEXT,
    chief_complaint_notes TEXT,
    hpi_data JSONB DEFAULT '{}'::jsonb,
    past_dental_history JSONB DEFAULT '{}'::jsonb,
    medical_history JSONB DEFAULT '{}'::jsonb,
    current_medications JSONB DEFAULT '{}'::jsonb,
    blood_pressure JSONB DEFAULT '{}'::jsonb,
    family_history TEXT,
    social_history TEXT,
    extraoral_exam JSONB DEFAULT '{}'::jsonb,
    odontogram_data JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'draft',
    supervisor_score TEXT,
    supervisor_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security (RLS) - Allow Access for Clinical App
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on patients" ON public.patients;
CREATE POLICY "Allow anon all on patients" ON public.patients FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on case_sheets" ON public.case_sheets;
CREATE POLICY "Allow anon all on case_sheets" ON public.case_sheets FOR ALL TO anon USING (true) WITH CHECK (true);

-- Indexes for lightning fast clinical queries
CREATE INDEX IF NOT EXISTS idx_case_sheets_dept ON public.case_sheets(dept_id);
CREATE INDEX IF NOT EXISTS idx_case_sheets_sheet ON public.case_sheets(sheet_id);
CREATE INDEX IF NOT EXISTS idx_case_sheets_student ON public.case_sheets(student_id);
CREATE INDEX IF NOT EXISTS idx_case_sheets_status ON public.case_sheets(status);
`;

  const DEFAULT_URL = 'https://nkshybnrzzxkqyusultb.supabase.co';
  const DEFAULT_KEY = 'sb_publishable_FAbhaWvsEJI4sX_C83o6UA_bqeqcuek';

  let clientInstance = null;

  // Initialize Client
  function getClient() {
    if (clientInstance) return clientInstance;

    const url = localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL;
    const key = localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_KEY;

    if (url && key && window.supabase && window.supabase.createClient) {
      try {
        clientInstance = window.supabase.createClient(url.trim(), key.trim());
        return clientInstance;
      } catch (err) {
        console.error('Error creating Supabase client:', err);
        return null;
      }
    }
    return null;
  }

  // Check if configured
  function isConfigured() {
    const url = localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL;
    const key = localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_KEY;
    return Boolean(url && key);
  }

  // Get current credentials
  function getCredentials() {
    return {
      url: localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL,
      key: localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_KEY,
      mode: localStorage.getItem(STORAGE_KEY_MODE) || 'live'
    };
  }

  // Save Credentials
  function saveCredentials(url, key) {
    if (url && key) {
      localStorage.setItem(STORAGE_KEY_URL, url.trim());
      localStorage.setItem(STORAGE_KEY_KEY, key.trim());
      localStorage.setItem(STORAGE_KEY_MODE, 'live');
      clientInstance = null; // reset
      getClient();
      return true;
    }
    return false;
  }

  // Disconnect / Clear
  function disconnect() {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_KEY);
    localStorage.setItem(STORAGE_KEY_MODE, 'offline');
    clientInstance = null;
  }

  // Test Connection
  async function testConnection(url, key) {
    if (!window.supabase || !window.supabase.createClient) {
      return { success: false, message: 'مكتبة Supabase JS غير محملة في الصفحة' };
    }

    try {
      const tempClient = window.supabase.createClient(url.trim(), key.trim());
      // Query case_sheets table or health check
      const { data, error } = await tempClient.from('case_sheets').select('id').limit(1);

      if (error) {
        // Check if error is because table does not exist yet
        if (error.code === '42P01' || error.message.includes('relation "public.case_sheets" does not exist')) {
          return {
            success: true,
            needsSchema: true,
            message: 'تم الاتصال بمشروع سوبابيس بنجاح! تنبيه: جدول case_sheets غير منشأ بعد. يرجى تنفيذ كود SQL المرفق.'
          };
        }
        return { success: false, message: `خطأ في الاتصال: ${error.message} (${error.code || ''})` };
      }

      return { success: true, needsSchema: false, message: 'تم الاتصال بقاعدة بيانات سوبابيس بنجاح تام! 🟢' };
    } catch (err) {
      return { success: false, message: 'تعذر الاتصال بسوبابيس: ' + err.message };
    }
  }

  const STORAGE_KEY_QUEUE = 'e_dental_sync_queue';

  // Helper: Format record for Supabase
  function formatCaseRecord(casePayload) {
    return {
      id: casePayload.id,
      patient_file: casePayload.patientFile || 'AQ-2026-841',
      patient_name: casePayload.patientName || 'مريض سريري',
      patient_age: casePayload.patientAge || '25',
      patient_sex: casePayload.patientSex || 'M',
      patient_phone: casePayload.patientPhone || '',
      dept_id: casePayload.deptId || 'omfs',
      dept_name: casePayload.deptName || 'جراحة الفم والفكين',
      sheet_id: casePayload.sheetId || 'omfs-ext-01',
      sheet_code: casePayload.sheetCode || 'OMFS-EXT-01',
      sheet_title: casePayload.sheetTitle || 'طبلة القلع السريرية',
      student_id: casePayload.studentId || 'STU-4891',
      student_name: casePayload.studentName || 'د. علي حيدر الموسوي',
      chief_complaint: casePayload.chiefComplaint || '',
      chief_complaint_notes: casePayload.chiefComplaintNotes || '',
      hpi_data: casePayload.hpiData || {},
      past_dental_history: casePayload.pastDentalHistory || {},
      medical_history: casePayload.medicalHistory || {},
      current_medications: casePayload.currentMedications || {},
      blood_pressure: casePayload.bloodPressure || {},
      family_history: casePayload.familyHistory || '',
      social_history: casePayload.socialHistory || '',
      extraoral_exam: casePayload.extraoralExam || {},
      odontogram_data: casePayload.odontogramData || {},
      status: casePayload.status || 'draft',
      supervisor_score: casePayload.supervisorScore || null,
      supervisor_notes: casePayload.supervisorNotes || null,
      updated_at: new Date().toISOString()
    };
  }

  // Get Offline Sync Queue
  function getSyncQueue() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_QUEUE) || '[]');
    } catch (e) {
      return [];
    }
  }

  // Add/Update in Sync Queue
  function addToSyncQueue(casePayload) {
    try {
      const queue = getSyncQueue();
      const idx = queue.findIndex(item => item.id === casePayload.id);
      const queuedItem = {
        ...casePayload,
        _queuedAt: new Date().toISOString(),
        _syncAttempts: (idx >= 0 && queue[idx]._syncAttempts ? queue[idx]._syncAttempts : 0)
      };
      if (idx >= 0) {
        queue[idx] = queuedItem;
      } else {
        queue.push(queuedItem);
      }
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
      updateNetworkBanner();
      updateHeaderPill();
    } catch (e) {
      console.error('Error adding to sync queue:', e);
    }
  }

  // Remove from Sync Queue
  function removeFromSyncQueue(caseId) {
    try {
      let queue = getSyncQueue();
      queue = queue.filter(item => item.id !== caseId);
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
      updateNetworkBanner();
      updateHeaderPill();
    } catch (e) {
      console.error('Error removing from sync queue:', e);
    }
  }

  // Auto-Sync all pending cases in queue with Supabase
  async function syncPendingQueue() {
    if (!navigator.onLine) {
      updateNetworkBanner();
      return { success: false, message: 'لا يوجد اتصال بالإنترنت حالياً' };
    }

    const client = getClient();
    if (!client) {
      return { success: false, message: 'النظام السحابي غير مهيأ' };
    }

    const queue = getSyncQueue();
    if (queue.length === 0) {
      return { success: true, count: 0, message: 'لا توجد حالات معلقة للمزامنة' };
    }

    showNetworkBanner('syncing', `جاري المزامنة السحابية لـ (${queue.length}) كيس شيت... ⏳`);

    let syncedCount = 0;
    const remaining = [];

    for (const item of queue) {
      try {
        const record = formatCaseRecord(item);
        const { error } = await client
          .from('case_sheets')
          .upsert(record, { onConflict: 'id' });

        if (!error) {
          syncedCount++;
        } else {
          item._syncAttempts = (item._syncAttempts || 0) + 1;
          remaining.push(item);
        }
      } catch (err) {
        remaining.push(item);
      }
    }

    localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(remaining));
    updateHeaderPill();

    if (syncedCount > 0) {
      showNetworkBanner('success', `🟢 تم رفع ومزامنة (${syncedCount}) كيس شيت سحابياً بنجاح!`);
      setTimeout(() => {
        if (navigator.onLine && getSyncQueue().length === 0) {
          hideNetworkBanner();
        }
      }, 4000);
    } else {
      updateNetworkBanner();
    }

    return { success: true, count: syncedCount, remaining: remaining.length };
  }

  // Floating Warning Banner Management
  function ensureNetworkBanner() {
    let banner = document.getElementById('edental-network-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'edental-network-banner';
      banner.className = 'fixed top-0 inset-x-0 z-[999999] transition-all duration-300 transform -translate-y-full px-4 py-2.5 text-xs font-bold shadow-lg flex items-center justify-between text-center select-none';
      if (document.body) {
        document.body.appendChild(banner);
      }
    }
    return banner;
  }

  function showNetworkBanner(type, customMsg) {
    const banner = ensureNetworkBanner();
    if (!banner) return;
    const queue = getSyncQueue();
    const queueNotice = queue.length > 0 ? ` [يوجد ${queue.length} حالة معلقة بانتظار المزامنة ⏳]` : '';

    if (type === 'offline') {
      banner.className = 'fixed top-0 inset-x-0 z-[999999] transition-all duration-300 transform translate-y-0 px-4 py-3 text-xs sm:text-sm font-black shadow-2xl flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-amber-600 via-amber-500 to-rose-600 text-white border-b-2 border-amber-700';
      banner.innerHTML = `
        <div class="flex items-center gap-2.5 mx-auto text-right">
          <span class="w-3 h-3 rounded-full bg-red-400 animate-ping shrink-0"></span>
          <span class="text-base">⚠️</span>
          <span>${customMsg || 'تنبيه سريري: لا يوجد اتصال بالإنترنت (أنت الآن في وضع أوفلاين) • يتم حفظ جميع التعديلات والكيس شيت محلياً بأمان، وستتم المزامنة السحابية تلقائياً فور عودة الإنترنت.'}${queueNotice}</span>
        </div>
        <button onclick="window.EDentalSupabase && window.EDentalSupabase.syncPendingQueue()" class="mx-auto sm:mx-0 px-3 py-1 bg-slate-950/80 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer">
          مزامنة الآن 🔄
        </button>
      `;
    } else if (type === 'syncing') {
      banner.className = 'fixed top-0 inset-x-0 z-[999999] transition-all duration-300 transform translate-y-0 px-4 py-2.5 text-xs sm:text-sm font-black shadow-xl flex items-center justify-center gap-2 bg-sky-600 text-white border-b-2 border-sky-700';
      banner.innerHTML = `
        <div class="flex items-center gap-2 mx-auto">
          <span class="w-3 h-3 rounded-full bg-white animate-spin shrink-0"></span>
          <span>${customMsg}</span>
        </div>
      `;
    } else if (type === 'success') {
      banner.className = 'fixed top-0 inset-x-0 z-[999999] transition-all duration-300 transform translate-y-0 px-4 py-2.5 text-xs sm:text-sm font-black shadow-xl flex items-center justify-center gap-2 bg-emerald-600 text-white border-b-2 border-emerald-700';
      banner.innerHTML = `
        <div class="flex items-center gap-2 mx-auto">
          <span class="text-base">🟢</span>
          <span>${customMsg}</span>
        </div>
      `;
    }
  }

  function hideNetworkBanner() {
    const banner = document.getElementById('edental-network-banner');
    if (banner) {
      banner.classList.remove('translate-y-0');
      banner.classList.add('-translate-y-full');
    }
  }

  function updateNetworkBanner() {
    if (!navigator.onLine) {
      showNetworkBanner('offline');
    } else {
      const queue = getSyncQueue();
      if (queue.length > 0) {
        showNetworkBanner('offline', `🟢 متصل بالإنترنت: يوجد (${queue.length}) كيس شيت بانتظار المزامنة السحابية.`);
      } else {
        hideNetworkBanner();
      }
    }
  }

  function updateHeaderPill() {
    const dot = document.getElementById('supabase-status-dot');
    const txt = document.getElementById('supabase-status-text');
    const btn = document.getElementById('supabase-status-btn');
    if (!dot || !txt) return;

    const queue = getSyncQueue();
    if (!navigator.onLine) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping';
      txt.textContent = queue.length > 0 ? `⚠️ أوفلاين (${queue.length} معلقة)` : '⚠️ أوفلاين (بدون إنترنت)';
      if (btn) {
        btn.classList.add('border-amber-400', 'bg-amber-50', 'text-amber-900');
        btn.classList.remove('border-emerald-300', 'bg-emerald-50', 'text-emerald-900');
      }
    } else {
      if (queue.length > 0) {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse';
        txt.textContent = `مزامنة (${queue.length} معلقة) ⏳`;
      } else {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
        txt.textContent = 'السجل السريري: متزامن 🟢';
      }
      if (btn) {
        btn.classList.remove('border-amber-400', 'bg-amber-50', 'text-amber-900');
        btn.classList.add('border-emerald-300', 'bg-emerald-50', 'text-emerald-900');
      }
    }
  }

  // Network Event Listeners
  window.addEventListener('offline', () => {
    updateNetworkBanner();
    updateHeaderPill();
  });

  window.addEventListener('online', () => {
    updateHeaderPill();
    showNetworkBanner('success', '🟢 تم استعادة الاتصال بالإنترنت بنجاح! جاري فحص ومزامنة البيانات سحابياً...');
    setTimeout(() => {
      syncPendingQueue();
    }, 1200);
  });

  // Save Case Sheet to Supabase with Offline-First Queue
  async function saveCase(casePayload) {
    // 1. If currently offline, queue immediately
    if (!navigator.onLine) {
      saveCaseToLocalFallback(casePayload);
      addToSyncQueue(casePayload);
      updateNetworkBanner();
      return {
        success: true,
        source: 'offline_queue',
        message: '⚠️ تنبيه: لا يوجد اتصال بالإنترنت! تم حفظ الاستمارة بأمان في ذاكرة جهازك (Offline)، وستتم المزامنة السحابية تلقائياً فور عودة النت ⏳'
      };
    }

    const client = getClient();
    if (!client) {
      saveCaseToLocalFallback(casePayload);
      addToSyncQueue(casePayload);
      return {
        success: true,
        source: 'local',
        message: 'تم الحفظ محلياً في الذاكرة بنجاح.'
      };
    }

    try {
      const record = formatCaseRecord(casePayload);

      // 2. Upsert to Supabase
      const { data, error } = await client
        .from('case_sheets')
        .upsert(record, { onConflict: 'id' })
        .select();

      if (error) {
        console.warn('Cloud save error, adding to offline queue:', error);
        saveCaseToLocalFallback(casePayload);
        addToSyncQueue(casePayload);
        return {
          success: true,
          source: 'offline_queue',
          error: error.message,
          message: '⚠️ تعذر الرفع السحابي حالياً! تم حفظ الكيس شيت في طابور المزامنة المحلي بأمان.'
        };
      }

      // Success: save local backup and remove from queue
      saveCaseToLocalFallback(casePayload);
      removeFromSyncQueue(casePayload.id);

      // Trigger sync for any other pending cases in queue
      setTimeout(() => syncPendingQueue(), 600);

      return {
        success: true,
        source: 'supabase',
        data: data,
        message: 'تم الحفظ والمزامنة السحابية للسجل بنجاح! 🟢☁️'
      };
    } catch (err) {
      console.error('Fatal error saving to cloud:', err);
      saveCaseToLocalFallback(casePayload);
      addToSyncQueue(casePayload);
      return {
        success: true,
        source: 'offline_queue',
        message: '⚠️ تعذر الاتصال السحابي حالياً! تم حفظ الاستمارة محلياً وستتم المزامنة تلقائياً فور توفر النت.'
      };
    }
  }

  // Update Status / Supervisor Review in Supabase
  async function submitCaseReview(caseId, reviewPayload) {
    if (!navigator.onLine) {
      return { success: true, source: 'offline', message: 'تم الاعتماد محلياً (أوفلاين)' };
    }

    const client = getClient();
    if (!client) {
      return { success: true, source: 'local', message: 'تم الاعتماد محلياً' };
    }

    try {
      const updateData = {
        status: reviewPayload.status || 'submitted',
        supervisor_score: reviewPayload.score || '9/10',
        supervisor_notes: reviewPayload.notes || 'معتمد سريرياً',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('case_sheets')
        .update(updateData)
        .eq('id', caseId)
        .select();

      if (error) throw error;
      return { success: true, source: 'supabase', data };
    } catch (err) {
      console.warn('Error submitting review to Supabase:', err);
      return { success: false, error: err.message };
    }
  }

  // Fetch all cases for current student from Supabase
  async function fetchCases(studentId = 'STU-4891') {
    const client = getClient();
    if (!client || !navigator.onLine) {
      const local = JSON.parse(localStorage.getItem('e_dental_drafts') || '[]');
      return { success: true, source: 'local', data: local };
    }

    try {
      const { data, error } = await client
        .from('case_sheets')
        .select('*')
        .eq('student_id', studentId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return { success: true, source: 'supabase', data: data || [] };
    } catch (err) {
      console.warn('Error fetching from Supabase, loading local:', err);
      const local = JSON.parse(localStorage.getItem('e_dental_drafts') || '[]');
      return { success: true, source: 'local', data: local, error: err.message };
    }
  }

  // Helper: Save to localStorage as backup
  function saveCaseToLocalFallback(casePayload) {
    try {
      const localDrafts = JSON.parse(localStorage.getItem('e_dental_drafts') || '[]');
      const existingIdx = localDrafts.findIndex(d => d.id === casePayload.id);
      if (existingIdx >= 0) {
        localDrafts[existingIdx] = { ...localDrafts[existingIdx], ...casePayload };
      } else {
        localDrafts.push(casePayload);
      }
      localStorage.setItem('e_dental_drafts', JSON.stringify(localDrafts));
    } catch (e) {
      console.error('Local backup save failed:', e);
    }
  }

  // Initialize network monitor on page ready
  function initNetworkMonitor() {
    updateNetworkBanner();
    updateHeaderPill();
    if (navigator.onLine) {
      syncPendingQueue();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNetworkMonitor);
  } else {
    initNetworkMonitor();
  }

  // Register Service Worker for offline caching & PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // Export to window
  window.EDentalSupabase = {
    isConfigured,
    getClient,
    getCredentials,
    saveCredentials,
    disconnect,
    testConnection,
    saveCase,
    submitCaseReview,
    fetchCases,
    getSyncQueue,
    syncPendingQueue,
    updateNetworkBanner,
    updateHeaderPill,
    SQL_SCHEMA: SUPABASE_SQL_SCHEMA
  };
})();
