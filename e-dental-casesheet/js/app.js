/**
 * E-Dental CaseSheet Platform - Core Interactive Controller (Simplified Direct Mode)
 * Academic Year 2026–2027 • College of Dentistry Clinical Information System
 */

document.addEventListener('DOMContentLoaded', () => {
  // App State
  const state = {
    selectedDeptId: '',
    selectedSheetId: '',
    searchQuery: '',
    currentOpenSheet: null,
    activeOdontogramTooth: null,
    odontogramData: {}, // { toothNumber: { condition: 'caries', notes: '...' } }
    savedDrafts: JSON.parse(localStorage.getItem('e_dental_drafts') || '[]'),
    stats: {
      todayCases: STUDENT_SESSION.stats.todayCases,
      savedDrafts: STUDENT_SESSION.stats.savedDrafts,
      approvedRequirements: STUDENT_SESSION.stats.approvedRequirements,
      totalRequired: STUDENT_SESSION.stats.totalRequired
    }
  };

  // DOM Elements
  const deptSelect = document.getElementById('dept-select');
  const sheetSelect = document.getElementById('sheet-select');
  const openSheetBtn = document.getElementById('open-sheet-btn');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const searchResultsList = document.getElementById('search-results-list');
  const searchClearBtn = document.getElementById('search-clear');
  const caseModal = document.getElementById('case-sheet-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const saveDraftBtn = document.getElementById('save-draft-btn');
  const printCaseBtn = document.getElementById('print-case-btn');
  const submitSupervisorBtn = document.getElementById('submit-supervisor-btn');
  const toastContainer = document.getElementById('toast-container');

  // Stats Elements
  const statTodayCases = document.getElementById('stat-today-cases');
  const statDrafts = document.getElementById('stat-drafts');
  const statApproved = document.getElementById('stat-approved');
  const statProgressPercent = document.getElementById('stat-progress-percent');

  // Initialize Application
  initApp();

  function initApp() {
    renderSessionInfo();
    populateDeptDropdown();
    setupEventListeners();
    updateStatsDisplay();
    initIcons();
  }

  // Render Session & Header Details
  function renderSessionInfo() {
    const sessionDateElem = document.getElementById('session-date');
    if (sessionDateElem) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const today = new Date();
      sessionDateElem.textContent = today.toLocaleDateString('ar-IQ', options);
    }
    const studentNameElem = document.getElementById('student-name-display');
    if (studentNameElem) studentNameElem.textContent = STUDENT_SESSION.name;
    
    const stageElem = document.getElementById('student-stage-badge');
    if (stageElem) stageElem.textContent = STUDENT_SESSION.stageAr;
  }

  // Populate Dropdown 1: Main Departments
  function populateDeptDropdown() {
    deptSelect.innerHTML = '<option value="" disabled selected>-- اختر الفرع الأكاديمي الرئيسي ▼ --</option>';
    DENTAL_DEPARTMENTS.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id;
      option.textContent = `${dept.nameAr} (${dept.code})`;
      deptSelect.appendChild(option);
    });
  }

  // Populate Dropdown 2: Case Sheets dynamically based on Dept selection
  function updateSheetDropdown(deptId) {
    sheetSelect.innerHTML = '<option value="" disabled selected>-- اختر الكيس شيت المطلوب ▼ --</option>';
    
    if (!deptId) {
      sheetSelect.disabled = true;
      openSheetBtn.disabled = true;
      openSheetBtn.classList.add('opacity-50', 'cursor-not-allowed');
      return;
    }

    const dept = DENTAL_DEPARTMENTS.find(d => d.id === deptId);
    if (!dept) return;

    dept.caseSheets.forEach(sheet => {
      const option = document.createElement('option');
      option.value = sheet.id;
      option.textContent = `${sheet.titleAr} [${sheet.code}] - ${sheet.titleEn}`;
      sheetSelect.appendChild(option);
    });

    sheetSelect.disabled = false;
    openSheetBtn.disabled = true;
    openSheetBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Dropdown 1: Department Change
    deptSelect.addEventListener('change', (e) => {
      state.selectedDeptId = e.target.value;
      state.selectedSheetId = '';
      updateSheetDropdown(state.selectedDeptId);
    });

    // Dropdown 2: Case Sheet Change
    sheetSelect.addEventListener('change', (e) => {
      state.selectedSheetId = e.target.value;
      if (state.selectedSheetId) {
        openSheetBtn.disabled = false;
        openSheetBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        openSheetBtn.classList.add('hover:shadow-xl', 'hover:scale-[1.01]');
      } else {
        openSheetBtn.disabled = true;
        openSheetBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });

    // Action Button: Open Digital Case Sheet
    openSheetBtn.addEventListener('click', () => {
      const deptId = state.selectedDeptId || deptSelect.value;
      const sheetId = state.selectedSheetId || sheetSelect.value;
      if (deptId && sheetId) {
        openDigitalCaseSheet(deptId, sheetId);
      } else {
        showToast('يرجى اختيار الفرع الأكاديمي والكيس شيت أولاً', 'warning');
      }
    });

    // Fast Search Handler
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      state.searchQuery = query;
      handleSearch(query);
    });

    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      searchResults.classList.add('hidden');
    });

    // Keyboard shortcut Ctrl+K or / for Search
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === 'Escape') {
        searchResults.classList.add('hidden');
        closeCaseModal();
      }
    });

    // Click outside search to close
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
      }
    });

    // Modal Close
    modalCloseBtn.addEventListener('click', closeCaseModal);
    modalCancelBtn.addEventListener('click', closeCaseModal);

    // Modal Actions
    saveDraftBtn.addEventListener('click', saveCurrentCaseDraft);
    printCaseBtn.addEventListener('click', () => {
      if (state.currentOpenSheet && (state.currentOpenSheet.sheet.id === 'omfs-ext-01' || state.currentOpenSheet.dept.id === 'omfs')) {
        window.open('oral-surgery-complete.html', '_blank');
      } else {
        window.print();
      }
    });
    submitSupervisorBtn.addEventListener('click', submitCaseToSupervisor);

    // Realtime Evaluation Score Calculation for Al-Qabas 10-Mark Table
    for (let i = 1; i <= 6; i++) {
      const evalMarkElem = document.getElementById(`eval-mark-${i}`);
      if (evalMarkElem) {
        evalMarkElem.addEventListener('change', calculateTotalScore);
      }
    }

    // 2-Way Sync: Target Tooth Select Dropdown
    const p2TargetToothSelect = document.getElementById('p2-target-tooth');
    if (p2TargetToothSelect) {
      p2TargetToothSelect.addEventListener('change', () => {
        selectOdontogramTooth(p2TargetToothSelect.value);
      });
    }

    // Differential Diagnosis Dropdown Quick Selection
    const p2DiffDrop = document.getElementById('p2-diff-dropdown');
    const p2DiffTxt = document.getElementById('p2-diff-text');
    if (p2DiffDrop && p2DiffTxt) {
      p2DiffDrop.addEventListener('change', () => {
        if (p2DiffDrop.value) p2DiffTxt.value = p2DiffDrop.value;
      });
    }

    // Definitive Diagnosis Dropdown Quick Selection
    const p2DiagDrop = document.getElementById('p2-diag-dropdown');
    const p2DiagTxt = document.getElementById('p2-diag-text');
    if (p2DiagDrop && p2DiagTxt) {
      p2DiagDrop.addEventListener('change', () => {
        if (p2DiagDrop.value) p2DiagTxt.value = p2DiagDrop.value;
      });
    }

    // Intelligent Clinical Decision Support Button
    const btnSuggestDiag = document.getElementById('btn-suggest-diagnosis');
    if (btnSuggestDiag) {
      btnSuggestDiag.addEventListener('click', () => {
        suggestDifferentialDiagnosis();
        showToast('تم تحديث التشخيص التفريقي والاستدلال السريري بذكاء!', 'success');
      });
    }

    // Auto-update differential diagnosis on clinical input changes
    const clinicalInputs = [
      'p2-tooth-condition', 'p2-inspection', 'p2-ttp', 'p2-ttp-vert', 'p2-ttp-horiz',
      'p2-palpation', 'p2-mobility', 'p2-vitality', 'p2-vitality-thermal', 'p2-rad-findings',
      'p2-target-tooth', 'p2-rad-type', 'p2-occlusion'
    ];
    clinicalInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => suggestDifferentialDiagnosis());
      }
    });

    // Treatment Plan Dropdown Sync with Checkboxes
    const tpSelect = document.getElementById('p2-treatment-plan');
    if (tpSelect) {
      tpSelect.addEventListener('change', () => {
        const val = tpSelect.value;
        const simple = document.getElementById('p2-tp-simple');
        const surgical = document.getElementById('p2-tp-surgical');
        const drainage = document.getElementById('p2-tp-drainage');
        const operculectomy = document.getElementById('p2-tp-operculectomy');
        const referral = document.getElementById('p2-tp-referral');
        if (simple) simple.checked = (val === 'Simple Extraction');
        if (surgical) surgical.checked = (val === 'Surgical Extraction');
        if (drainage) drainage.checked = (val === 'Incision & Drainage');
        if (operculectomy) operculectomy.checked = (val === 'Operculectomy');
        if (referral) referral.checked = (val === 'Referral / Endodontics');
      });
    }

    // Odontogram Condition Picker Listeners (Supports both Al-Qabas and standard views)
    const conditionButtons = document.querySelectorAll('[data-tooth-condition], [data-p2-condition]');
    conditionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const condition = btn.dataset.toothCondition || btn.dataset.p2Condition;
        applyConditionToActiveTooth(condition);
      });
    });

    // Supabase Synchronization UI Setup
    setupSupabaseUI();
  }

  // Calculate Total Clinical Evaluation Score for Al-Qabas Page 2
  function calculateTotalScore() {
    let sum = 0;
    let found = false;
    for (let i = 1; i <= 6; i++) {
      const el = document.getElementById(`eval-mark-${i}`);
      if (el) {
        sum += parseFloat(el.value || '0');
        found = true;
      }
    }
    const display = document.getElementById('eval-total-display');
    if (display) {
      display.textContent = `${sum.toFixed(1)} / 10`;
    }
    return found ? parseFloat(sum.toFixed(1)) : null;
  }


  // Setup Supabase Cloud Sync UI & Event Handlers
  function setupSupabaseUI() {
    const sbBtn = document.getElementById('supabase-status-btn');
    const sbModal = document.getElementById('supabase-config-modal');
    const sbClose = document.getElementById('sb-modal-close');
    const sbDone = document.getElementById('sb-modal-done-btn');
    const sbTestSave = document.getElementById('sb-test-save-btn');
    const sbDisconnect = document.getElementById('sb-disconnect-btn');
    const sbCopySql = document.getElementById('sb-copy-sql-btn');
    const sbUrlInput = document.getElementById('sb-input-url');
    const sbKeyInput = document.getElementById('sb-input-key');

    const updateStatusPill = () => {
      const dot = document.getElementById('supabase-status-dot');
      const txt = document.getElementById('supabase-status-text');
      const dialogDot = document.getElementById('sb-dialog-status-dot');
      const dialogTxt = document.getElementById('sb-dialog-status-text');
      const disconnectBtn = document.getElementById('sb-disconnect-btn');

      if (!navigator.onLine) {
        if (dot) {
          dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping';
        }
        if (txt) txt.textContent = '⚠️ أوفلاين: لا يوجد إنترنت';
        if (dialogDot) dialogDot.className = 'w-3 h-3 rounded-full bg-amber-500 animate-pulse';
        if (dialogTxt) dialogTxt.textContent = 'الحالة الحالية: غير متصل بالإنترنت (وضع أوفلاين) • يتم الحفظ محلياً بأمان';
        if (sbBtn) {
          sbBtn.classList.add('border-amber-400', 'bg-amber-50', 'text-amber-900');
          sbBtn.classList.remove('border-slate-200', 'bg-white', 'text-slate-700', 'border-emerald-300', 'bg-emerald-50', 'text-emerald-900');
        }
        return;
      }

      if (sbBtn) {
        sbBtn.classList.remove('border-amber-400', 'bg-amber-50', 'text-amber-900');
        sbBtn.classList.add('border-slate-200', 'bg-white', 'text-slate-700');
      }

      const isConfigured = window.EDentalSupabase && window.EDentalSupabase.isConfigured();
      if (isConfigured) {
        if (dot) {
          dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
        }
        if (txt) txt.textContent = 'سوبابيس: متصل 🟢';
        if (dialogDot) dialogDot.className = 'w-3 h-3 rounded-full bg-emerald-500';
        if (dialogTxt) dialogTxt.textContent = 'الحالة الحالية: متصل بسحابة سوبابيس (مزامنة فورية) 🟢';
        if (disconnectBtn) disconnectBtn.classList.remove('hidden');
      } else {
        if (dot) {
          dot.className = 'w-2.5 h-2.5 rounded-full bg-slate-400';
        }
        if (txt) txt.textContent = 'سوبابيس: أوفلاين ⚙️';
        if (dialogDot) dialogDot.className = 'w-3 h-3 rounded-full bg-slate-400';
        if (dialogTxt) dialogTxt.textContent = 'الحالة الحالية: غير متصل (يعمل محلياً فقط)';
        if (disconnectBtn) disconnectBtn.classList.add('hidden');
      }
    };

    window.addEventListener('online', updateStatusPill);
    window.addEventListener('offline', updateStatusPill);

    updateStatusPill();

    if (sbBtn && sbModal) {
      sbBtn.addEventListener('click', () => {
        if (window.EDentalSupabase) {
          const creds = window.EDentalSupabase.getCredentials();
          if (sbUrlInput) sbUrlInput.value = creds.url;
          if (sbKeyInput) sbKeyInput.value = creds.key;
        }
        sbModal.classList.remove('hidden');
        sbModal.style.display = 'block';
        updateStatusPill();
        initIcons();
      });
    }

    const closeSbModal = () => {
      if (sbModal) {
        sbModal.classList.add('hidden');
        sbModal.style.display = '';
      }
    };

    if (sbClose) sbClose.addEventListener('click', closeSbModal);
    if (sbDone) sbDone.addEventListener('click', closeSbModal);

    if (sbTestSave) {
      sbTestSave.addEventListener('click', async () => {
        const url = (sbUrlInput ? sbUrlInput.value.trim() : '');
        const key = (sbKeyInput ? sbKeyInput.value.trim() : '');

        if (!url || !key) {
          showToast('يرجى إدخال رابط المشروع (Project URL) والمفتاح العام (Anon Key)', 'warning');
          return;
        }

        sbTestSave.disabled = true;
        sbTestSave.innerHTML = '<span class="animate-spin inline-block mr-2">⏳</span> جاري فحص الاتصال...';

        try {
          const res = await window.EDentalSupabase.testConnection(url, key);
          if (res.success) {
            window.EDentalSupabase.saveCredentials(url, key);
            updateStatusPill();
            showToast(res.message, res.needsSchema ? 'warning' : 'success');
            setTimeout(closeSbModal, 1500);
          } else {
            showToast(res.message, 'error');
          }
        } catch (err) {
          showToast('خطأ أثناء الفحص: ' + err.message, 'error');
        } finally {
          sbTestSave.disabled = false;
          sbTestSave.innerHTML = '<i data-lucide="plug-zap" class="w-4 h-4"></i><span>فحص وحفظ الاتصال السحابي</span>';
          initIcons();
        }
      });
    }

    if (sbDisconnect) {
      sbDisconnect.addEventListener('click', () => {
        if (window.EDentalSupabase) {
          window.EDentalSupabase.disconnect();
          if (sbUrlInput) sbUrlInput.value = '';
          if (sbKeyInput) sbKeyInput.value = '';
          updateStatusPill();
          showToast('تم فصل الاتصال بسوبابيس والعودة للوضع المحلي (أوفلاين)', 'info');
        }
      });
    }

    if (sbCopySql) {
      sbCopySql.addEventListener('click', () => {
        if (window.EDentalSupabase && navigator.clipboard) {
          navigator.clipboard.writeText(window.EDentalSupabase.SQL_SCHEMA).then(() => {
            showToast('تم نسخ كود SQL بنجاح! الصقه في Supabase SQL Editor واضغط Run', 'success');
          }).catch(() => {
            showToast('يرجى نسخ الكود يدوياً من الشرح أدناه', 'warning');
          });
        }
      });
    }
  }

  // Search Logic
  function handleSearch(query) {
    if (!query || query.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }

    const matches = [];

    DENTAL_DEPARTMENTS.forEach(dept => {
      dept.caseSheets.forEach(sheet => {
        const inTitleAr = sheet.titleAr.toLowerCase().includes(query);
        const inTitleEn = sheet.titleEn.toLowerCase().includes(query);
        const inCode = sheet.code.toLowerCase().includes(query);
        const inKeywords = sheet.keywords.some(k => k.toLowerCase().includes(query));
        const inDeptAr = dept.nameAr.toLowerCase().includes(query);

        if (inTitleAr || inTitleEn || inCode || inKeywords || inDeptAr) {
          matches.push({ sheet, dept });
        }
      });
    });

    if (matches.length === 0) {
      searchResultsList.innerHTML = `
        <div class="p-6 text-center text-slate-500 text-xs">
          <i data-lucide="search-x" class="w-8 h-8 mx-auto text-slate-400 mb-2"></i>
          لا توجد شعبة مطابقة للبحث "<strong>${query}</strong>"
        </div>
      `;
    } else {
      searchResultsList.innerHTML = matches.map(({ sheet, dept }) => `
        <div class="p-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 flex items-center justify-between gap-3 cursor-pointer group" data-open-sheet data-dept-id="${dept.id}" data-sheet-id="${sheet.id}">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs font-latin">
              ${sheet.code.split('-')[0]}
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-bold text-slate-900 group-hover:text-sky-600 transition-colors">${sheet.titleAr}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-latin font-medium">${sheet.code}</span>
              </div>
              <p class="text-[11px] text-slate-500">${dept.nameAr} • <span class="font-latin">${sheet.titleEn}</span></p>
            </div>
          </div>
          <button class="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1">
            <span>فتح</span>
            <i data-lucide="external-link" class="w-3 h-3"></i>
          </button>
        </div>
      `).join('');

      // Add click listeners to search items
      searchResultsList.querySelectorAll('[data-open-sheet]').forEach(item => {
        item.addEventListener('click', () => {
          const deptId = item.dataset.deptId;
          const sheetId = item.dataset.sheetId;
          searchResults.classList.add('hidden');
          searchInput.value = '';
          openDigitalCaseSheet(deptId, sheetId);
        });
      });
    }

    searchResults.classList.remove('hidden');
    initIcons();
  }

  // Open Digital Case Sheet Modal
  function openDigitalCaseSheet(deptId, sheetId) {
    try {
      const dept = DENTAL_DEPARTMENTS.find(d => d.id === deptId);
      if (!dept) {
        showToast('تعذر العثور على الفرع الأكاديمي المحدد', 'error');
        return;
      }
      const sheet = dept.caseSheets.find(s => s.id === sheetId);
      if (!sheet) {
        showToast('تعذر العثور على الكيس شيت المحدد', 'error');
        return;
      }

      state.currentOpenSheet = { dept, sheet };
      state.activeOdontogramTooth = null;
      state.odontogramData = {};

      // Generate random Case ID for simulation
      const caseId = `CS-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      const setElemText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      };
      const setElemVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      };

      // Populate Modal Header
      setElemText('modal-dept-title', dept.nameAr);
      setElemText('modal-sheet-title', sheet.titleAr);
      setElemText('modal-sheet-code', sheet.code);
      setElemText('modal-sheet-en', `${sheet.titleEn} • ${dept.nameEn}`);
      setElemText('modal-case-id', caseId);
      setElemText('modal-req-badge', sheet.requirement);

      // Reset admission fields with intelligent defaults
      setElemVal('patient-name', '');
      setElemVal('patient-age', '24');
      setElemVal('patient-gender', 'male');
      setElemVal('patient-phone', '0770XXXXXXX');
      setElemVal('patient-cc', 'ألم متقطع في الفك السفلي يزداد مع المشروبات الباردة والساخنة');

      // If Periodontics & Scaling (4th Year BDS) selected, open dedicated case sheet
      if (sheetId === 'perio-surg-02') {
        const opened = window.open('periodontics-page4.html', '_blank');
        if (!opened) {
          window.location.href = 'periodontics-page4.html';
        }
        showToast('تم فتح طبلة عيادة أمراض وجراحة اللثة لطلاب المرحلة الرابعة (4th Year BDS) 🌿', 'success');
        return;
      }

      // Switch view based on sheetId / department
      const alqabasView = document.getElementById('modal-alqabas-view');
      const standardView = document.getElementById('modal-standard-view');
      if (sheetId === 'omfs-ext-01') {
        if (alqabasView) alqabasView.classList.remove('hidden');
        if (standardView) standardView.classList.add('hidden');
        calculateTotalScore();
      } else {
        if (alqabasView) alqabasView.classList.add('hidden');
        if (standardView) standardView.classList.remove('hidden');
      }

      // Render Department-specific Clinical Focus
      renderDepartmentClinicalFocus(sheet);

      // Render Interactive Odontogram
      renderOdontogram();

      // Default to Tooth #46 for Al-Qabas Oral Surgery
      if (sheetId === 'omfs-ext-01') {
        selectOdontogramTooth('46');
        suggestDifferentialDiagnosis();
      }

      // Show Modal
      if (caseModal) {
        caseModal.classList.remove('hidden');
        caseModal.style.display = 'block';
      }
      document.body.classList.add('overflow-hidden');
      initIcons();

      showToast(`تم فتح الطبلة السريرية: ${sheet.titleAr}`, 'info');
    } catch (err) {
      console.error('Error opening case sheet modal:', err);
      showToast('حدث خطأ أثناء فتح الطبلة السريرية: ' + err.message, 'error');
    }
  }

  // Render Department-Specific Clinical Focus
  function renderDepartmentClinicalFocus(sheet) {
    const container = document.getElementById('clinical-focus-container');
    if (!container) return;

    container.innerHTML = `
      <div class="mb-3">
        <h4 class="text-sm font-bold text-slate-800 flex items-center gap-2">
          <i data-lucide="check-square" class="w-4 h-4 text-sky-600"></i>
          بنود الفحص السريري المعتمدة لـ (${sheet.titleAr}):
        </h4>
        <p class="text-xs text-slate-500 font-latin mt-0.5">Clinical Examination & Department Protocols</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${sheet.clinicalFocus.map((focusItem, idx) => `
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
            <input type="checkbox" id="focus-check-${idx}" class="mt-1 w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500" checked>
            <label for="focus-check-${idx}" class="text-xs font-semibold text-slate-800 cursor-pointer">
              <span class="font-latin block text-slate-900">${focusItem}</span>
              <span class="text-[11px] text-slate-500">تم الفحص والتوثيق وفق المعايير السريرية للفرع</span>
            </label>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Helper: Anatomical tooth label
  function getToothDisplayName(tNum) {
    const names = {
      '18': 'Tooth #18 (Upper Right 3rd Molar / Wisdom)',
      '17': 'Tooth #17 (Upper Right 2nd Molar)',
      '16': 'Tooth #16 (Upper Right 1st Molar)',
      '15': 'Tooth #15 (Upper Right 2nd Premolar)',
      '14': 'Tooth #14 (Upper Right 1st Premolar)',
      '13': 'Tooth #13 (Upper Right Canine)',
      '12': 'Tooth #12 (Upper Right Lateral Incisor)',
      '11': 'Tooth #11 (Upper Right Central Incisor)',
      '21': 'Tooth #21 (Upper Left Central Incisor)',
      '22': 'Tooth #22 (Upper Left Lateral Incisor)',
      '23': 'Tooth #23 (Upper Left Canine)',
      '24': 'Tooth #24 (Upper Left 1st Premolar)',
      '25': 'Tooth #25 (Upper Left 2nd Premolar)',
      '26': 'Tooth #26 (Upper Left 1st Molar)',
      '27': 'Tooth #27 (Upper Left 2nd Molar)',
      '28': 'Tooth #28 (Upper Left 3rd Molar / Wisdom)',
      '48': 'Tooth #48 (Lower Right 3rd Molar / Wisdom)',
      '47': 'Tooth #47 (Lower Right 2nd Molar)',
      '46': 'Tooth #46 (Lower Right 1st Molar)',
      '45': 'Tooth #45 (Lower Right 2nd Premolar)',
      '44': 'Tooth #44 (Lower Right 1st Premolar)',
      '43': 'Tooth #43 (Lower Right Canine)',
      '42': 'Tooth #42 (Lower Right Lateral Incisor)',
      '41': 'Tooth #41 (Lower Right Central Incisor)',
      '31': 'Tooth #31 (Lower Left Central Incisor)',
      '32': 'Tooth #32 (Lower Left Lateral Incisor)',
      '33': 'Tooth #33 (Lower Left Canine)',
      '34': 'Tooth #34 (Lower Left 1st Premolar)',
      '35': 'Tooth #35 (Lower Left 2nd Premolar)',
      '36': 'Tooth #36 (Lower Left 1st Molar)',
      '37': 'Tooth #37 (Lower Left 2nd Molar)',
      '38': 'Tooth #38 (Lower Left 3rd Molar / Wisdom)'
    };
    return names[tNum] || `Tooth #${tNum}`;
  }

  // Render FDI 2-Digit Odontogram (Supports Al-Qabas sheet and standard sheet)
  function renderOdontogram() {
    const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
    const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
    const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
    const lowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];

    const renderQuadrant = (container, teeth) => {
      if (!container) return;
      container.innerHTML = teeth.map(tNum => `
        <div class="tooth-box group" data-tooth-num="${tNum}" title="سن رقم ${tNum}">
          <span class="text-[10px] font-bold text-slate-600 font-latin">${tNum}</span>
          <svg class="w-6 h-6 tooth-crown" viewBox="0 0 24 24" fill="#ffffff" stroke="#64748b" stroke-width="1.5">
            <path d="M7 2h10c2 0 3 1.5 3 3.5 0 2-1 4.5-2 9.5-1 4.5-3 7-6 7s-5-2.5-6-7C5 10 4 5.5 4 3.5 4 1.5 5 2 7 2z"/>
          </svg>
          <span class="text-[8px] tooth-status-lbl text-slate-400 font-latin">Sound</span>
        </div>
      `).join('');
    };

    // Render into Al-Qabas container
    renderQuadrant(document.getElementById('p2-odont-ur'), upperRight);
    renderQuadrant(document.getElementById('p2-odont-ul'), upperLeft);
    renderQuadrant(document.getElementById('p2-odont-lr'), lowerRight);
    renderQuadrant(document.getElementById('p2-odont-ll'), lowerLeft);

    // Render into Standard container
    renderQuadrant(document.getElementById('odont-ur'), upperRight);
    renderQuadrant(document.getElementById('odont-ul'), upperLeft);
    renderQuadrant(document.getElementById('odont-lr'), lowerRight);
    renderQuadrant(document.getElementById('odont-ll'), lowerLeft);

    // Add Tooth Click Listeners to all rendered tooth boxes
    const allToothBoxes = document.querySelectorAll('.tooth-box');
    allToothBoxes.forEach(box => {
      box.addEventListener('click', () => {
        const tNum = box.dataset.toothNum;
        selectOdontogramTooth(tNum);
      });
    });
  }

  // 2-Way Selection: Select a tooth and synchronize with Target Tooth dropdown
  function selectOdontogramTooth(tNum) {
    if (!tNum) return;
    state.activeOdontogramTooth = tNum;

    // Highlight active tooth across all odontograms
    document.querySelectorAll('.tooth-box').forEach(b => {
      if (b.dataset.toothNum === tNum) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });

    // Update active tooth labels
    const displayName = getToothDisplayName(tNum);
    const p2ActiveDisplay = document.getElementById('p2-active-tooth-display');
    if (p2ActiveDisplay) {
      p2ActiveDisplay.textContent = displayName;
    }
    const activeToothDisplay = document.getElementById('active-tooth-display');
    if (activeToothDisplay) {
      activeToothDisplay.textContent = `السن المحدد: #${tNum}`;
    }

    // Update Target Tooth select if needed
    const p2TargetTooth = document.getElementById('p2-target-tooth');
    if (p2TargetTooth && p2TargetTooth.value !== tNum) {
      p2TargetTooth.value = tNum;
    }

    // Auto-suggest differential diagnosis for the newly selected tooth
    suggestDifferentialDiagnosis();
  }

  // Apply Condition to Currently Selected Tooth
  function applyConditionToActiveTooth(condition) {
    if (!state.activeOdontogramTooth) {
      showToast('يرجى النقر على رقم السن في المخطط أولاً لتحديده', 'warning');
      return;
    }

    const toothBoxes = document.querySelectorAll(`.tooth-box[data-tooth-num="${state.activeOdontogramTooth}"]`);
    if (!toothBoxes.length) return;

    const conditionNames = {
      'sound': 'Sound',
      'caries': 'Caries',
      'filled': 'Filled',
      'endo': 'Endo',
      'missing': 'Missing',
      'crowned': 'Crown'
    };

    toothBoxes.forEach(toothBox => {
      toothBox.setAttribute('data-condition', condition);
      const statusLbl = toothBox.querySelector('.tooth-status-lbl');
      if (statusLbl) statusLbl.textContent = conditionNames[condition] || 'Sound';
    });

    state.odontogramData[state.activeOdontogramTooth] = condition;

    // Smart sync with Tooth Condition dropdown
    const toothConditionSelect = document.getElementById('p2-tooth-condition');
    if (toothConditionSelect) {
      if (condition === 'caries') {
        toothConditionSelect.value = 'Carious / Broken Crown';
      } else if (condition === 'sound') {
        toothConditionSelect.value = 'Crown Intact';
      } else if (condition === 'missing') {
        toothConditionSelect.value = 'Retained Root';
      } else if (condition === 'endo') {
        toothConditionSelect.value = 'Carious / Broken Crown';
      }
      suggestDifferentialDiagnosis();
    }

    showToast(`تم تعيين حالة السن #${state.activeOdontogramTooth}: ${conditionNames[condition]}`, 'success');
  }

  // Intelligent Clinical Decision Support: Suggest Differential Diagnosis based on findings
  function suggestDifferentialDiagnosis() {
    const tooth = document.getElementById('p2-target-tooth')?.value || '46';
    const condition = document.getElementById('p2-tooth-condition')?.value || '';
    const inspection = document.getElementById('p2-inspection')?.value || '';
    const ttp = document.getElementById('p2-ttp')?.value || '';
    const ttpVert = document.getElementById('p2-ttp-vert')?.value || '';
    const ttpHoriz = document.getElementById('p2-ttp-horiz')?.value || '';
    const palpation = document.getElementById('p2-palpation')?.value || '';
    const mobility = document.getElementById('p2-mobility')?.value || '';
    const vitality = document.getElementById('p2-vitality')?.value || document.getElementById('p2-vitality-thermal')?.value || '';
    const rad = document.getElementById('p2-rad-findings')?.value || '';

    let diffOptions = [];
    let definitiveDiag = '';
    let rationale = '';
    let suggestedTreatments = { simple: true, surgical: false, drainage: false, operculectomy: false, referral: false, plan: 'Simple Extraction' };

    // Clinical Logic Rules
    const isWisdom = ['18', '28', '38', '48'].includes(tooth);
    const hasOperculum = inspection.includes('Operculum') || inspection.includes('Food Impaction') || condition.includes('Impacted');
    const isNecrotic = vitality.includes('Necrotic') || vitality.includes('Non-vital') || vitality.includes('No Response');
    const isHypersensitive = vitality.includes('Hypersensitive');
    const hasAbscess = palpation.includes('Fluctuant') || palpation.includes('Tender') || palpation.includes('Swelling');
    const isRetainedRoot = condition.includes('Retained Root');
    const isFractured = condition.includes('Fracture') || inspection.includes('Crown Fracture');
    const isGrade3Mob = mobility.includes('Grade III');
    const isAnkylosed = rad.includes('Ankylosis');
    const hasDilaceration = rad.includes('Dilaceration');

    if (isAnkylosed) {
      diffOptions = [
        'Ankylosed Tooth with Loss of Periodontal Space vs Severe Hypercementosis',
        'Failed Surgical Eruption / Bony Impaction with Ankylosis vs Dense Alveolar Sclerosis'
      ];
      definitiveDiag = 'Ankylosed Tooth / Failed Eruption';
      rationale = 'غياب مسافة الرباط السني والتحام الملاط بالعظم السنخي شعاعياً؛ يستدعي قلعاً جراحياً مع تجزئة عظمية وسنية.';
      suggestedTreatments = { simple: false, surgical: true, drainage: false, operculectomy: false, referral: false, plan: 'Surgical Extraction' };
    } else if (isWisdom && (hasOperculum || tooth === '48' || tooth === '38')) {
      diffOptions = [
        'Pericoronitis of Partially Erupted 3rd Molar vs Deep Distal Caries of Adjacent 2nd Molar',
        'Acute Pericoronitis with Trismus vs Masticatory Space Infection / Cellulitis',
        'Pericoronal Abscess vs Temporomandibular Joint Disorder (TMD) Myofascial Pain'
      ];
      definitiveDiag = 'Pericoronitis of Impacted Mandibular 3rd Molar';
      rationale = `سن عقل سفلي (#${tooth}) مع قلنسوة لثوية ملتهبة (Operculum) وانحشار طعام يسبب ألماً موضعياً وتشنجاً فكياً.`;
      suggestedTreatments = { simple: false, surgical: true, drainage: false, operculectomy: true, referral: false, plan: 'Surgical Extraction' };
    } else if (isRetainedRoot) {
      diffOptions = [
        'Retained Root with Chronic Periapical Pathology vs Residual Radicular Cyst',
        'Retained Subgingival Root Fragment vs Chronic Sclerosing Osteitis',
        'Non-restorable Carious Root with Chronic Periodontitis vs Chronic Alveolar Fistula'
      ];
      definitiveDiag = 'Retained Root with Chronic Periapical Pathology';
      rationale = 'جذر سني متبقي تحت اللثة مع نخر تاجي متهدم بالكامل وشفافية شعاعية ذروية مزمنة.';
      suggestedTreatments = { simple: true, surgical: true, drainage: false, operculectomy: false, referral: false, plan: 'Simple Extraction' };
    } else if (isFractured) {
      diffOptions = [
        'Unrestorable Crown-Root Fracture vs Vertical Root Fracture (VRF)',
        'Traumatic Oblique Split Fracture extending Subgingivally vs Deep Class V Breakdown'
      ];
      definitiveDiag = 'Unrestorable Crown-Root Fracture';
      rationale = 'كسر تاجي جذري ممتد عميقاً تحت الحافة السنخية يستحيل عزله أو ترميمه تعويضياً.';
      suggestedTreatments = { simple: false, surgical: true, drainage: false, operculectomy: false, referral: false, plan: 'Surgical Extraction' };
    } else if (isGrade3Mob) {
      diffOptions = [
        'Severe Periodontal Breakdown (Grade III Mobility) vs Combined Endo-Perio Lesion',
        'Terminal Periodontitis with Secondary Occlusal Trauma vs Deep Marginal Bone Resorption'
      ];
      definitiveDiag = 'Severe Periodontal Breakdown (Grade III Mobility)';
      rationale = 'تخلخل سني شديد من الدرجة الثالثة (أفقي وعمودي) مع امتصاص عظمي سنخي متقدم وفقدان الدعم السنخي.';
      suggestedTreatments = { simple: true, surgical: false, drainage: false, operculectomy: false, referral: false, plan: 'Simple Extraction' };
    } else if (hasAbscess && isNecrotic) {
      diffOptions = [
        'Acute Dentoalveolar Abscess with Vestibular Cellulitis vs Phoenix Abscess',
        'Infected Radicular Cyst with Acute Exacerbation vs Periodontal Abscess',
        'Acute Periapical Abscess with Subperiosteal Swelling vs Osteomyelitis'
      ];
      definitiveDiag = 'Acute Dentoalveolar Abscess';
      rationale = 'تموت اللب السني مع تورم دهليزي قيحي متموج وألم شديد عند جس الذروة مع إيجابية الفحص الارتجاجي.';
      suggestedTreatments = { simple: true, surgical: false, drainage: true, operculectomy: false, referral: false, plan: 'Incision & Drainage' };
    } else if (isHypersensitive) {
      diffOptions = [
        'Irreversible Pulpitis with Partial Necrosis vs Symptomatic Reversible Pulpitis',
        'Cracked Tooth Syndrome vs Deep Dentinal Caries with Pulpal Hyperemia'
      ];
      definitiveDiag = 'Irreversible Pulpitis with Partial Necrosis';
      rationale = 'استجابة حرارية حادة وممتدة بعد زوال المحفز ناتجة عن نخر عميق ممتد للحجرة اللبية.';
      suggestedTreatments = { simple: false, surgical: false, drainage: false, operculectomy: false, referral: true, plan: 'Referral / Endodontics' };
    } else {
      diffOptions = [
        'Chronic Apical Periodontitis with Periapical Granuloma vs Periapical Radicular Cyst',
        'Non-vital Tooth with Chronic Periapical Rarefying Osteitis vs Periapical Scar Tissue',
        'Chronic Dentoalveolar Abscess with Draining Sinus vs Cementoma (Early Osteolytic Stage)'
      ];
      definitiveDiag = 'Chronic Apical Periodontitis with Periapical Granuloma';
      rationale = 'لب سني متموت تماماً مع شفافية شعاعية ذروية مستديرة وإيجابية الطرق السني بدون تورم حاد.';
      suggestedTreatments = { simple: true, surgical: false, drainage: false, operculectomy: false, referral: false, plan: 'Simple Extraction' };
    }

    // Populate Differential Diagnosis Dropdown and Text
    const diffDrop = document.getElementById('p2-diff-dropdown');
    const diffText = document.getElementById('p2-diff-text');
    const diffRationale = document.getElementById('p2-diff-rationale');
    const diagDrop = document.getElementById('p2-diag-dropdown');
    const diagText = document.getElementById('p2-diag-text');

    if (diffDrop) {
      diffDrop.innerHTML = diffOptions.map((opt, i) => `<option value="${opt}" ${i===0?'selected':''}>${opt}</option>`).join('');
    }
    if (diffText && diffOptions.length > 0) {
      diffText.value = diffOptions[0];
    }
    if (diffRationale) {
      diffRationale.textContent = rationale;
    }

    // Pre-select matching Definitive Diagnosis
    if (diagDrop) {
      let found = false;
      for (let i = 0; i < diagDrop.options.length; i++) {
        if (diagDrop.options[i].value === definitiveDiag) {
          diagDrop.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found) {
        const newOpt = new Option(definitiveDiag, definitiveDiag, true, true);
        diagDrop.add(newOpt);
      }
    }
    if (diagText) {
      diagText.value = definitiveDiag;
    }

    // Auto-update Treatment Plan Dropdown & Checkboxes
    const tpDropdown = document.getElementById('p2-treatment-plan');
    if (tpDropdown && suggestedTreatments.plan) {
      tpDropdown.value = suggestedTreatments.plan;
    }
    if (document.getElementById('p2-tp-simple')) document.getElementById('p2-tp-simple').checked = suggestedTreatments.simple;
    if (document.getElementById('p2-tp-surgical')) document.getElementById('p2-tp-surgical').checked = suggestedTreatments.surgical;
    if (document.getElementById('p2-tp-drainage')) document.getElementById('p2-tp-drainage').checked = suggestedTreatments.drainage;
    if (document.getElementById('p2-tp-operculectomy')) document.getElementById('p2-tp-operculectomy').checked = suggestedTreatments.operculectomy;
    if (document.getElementById('p2-tp-referral')) document.getElementById('p2-tp-referral').checked = suggestedTreatments.referral;
  }

  // Close Modal
  function closeCaseModal() {
    caseModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  // Save Draft to LocalStorage and Sync with Supabase Cloud
  async function saveCurrentCaseDraft() {
    if (!state.currentOpenSheet) return;

    const modalCaseId = document.getElementById('modal-case-id');
    const caseIdText = modalCaseId ? modalCaseId.textContent : `CS-${Date.now()}`;
    const isAlqabas = (state.currentOpenSheet.sheet.id === 'omfs-ext-01' || state.currentOpenSheet.dept.id === 'omfs');

    let patientName = '';
    let patientAge = '25';
    let patientSex = 'M';
    let patientPhone = '';
    let chiefComplaint = '';
    let chiefComplaintNotes = '';
    let hpiData = {};
    let pastDentalHistory = {};
    let medicalHistory = {};
    let currentMedications = {};
    let bloodPressure = {};
    let familyHistory = '';
    let socialHistory = '';
    let extraoralExam = {};
    let page2Data = null;

    if (isAlqabas) {
      const aqNameInput = document.getElementById('aq-name');
      patientName = (aqNameInput && aqNameInput.value.trim()) ? aqNameInput.value.trim() : 'مريض جراحة الفم والقلع';
      patientAge = document.getElementById('aq-age')?.value || '25';
      patientSex = document.getElementById('aq-sex')?.value || 'M';
      patientPhone = document.getElementById('aq-phone')?.value || '';
      chiefComplaint = document.getElementById('aq-cc')?.value || '';
      chiefComplaintNotes = document.getElementById('aq-cc-notes')?.value || '';

      hpiData = {
        site: document.getElementById('aq-hpi-site')?.value || '',
        severity: document.getElementById('aq-hpi-severity')?.value || '',
        onset: document.getElementById('aq-hpi-onset')?.value || '',
        aggravating: document.getElementById('aq-hpi-aggravating')?.value || '',
        duration: document.getElementById('aq-hpi-duration')?.value || '',
        relieving: document.getElementById('aq-hpi-relieving')?.value || '',
        character: document.getElementById('aq-hpi-character')?.value || '',
        frequency: document.getElementById('aq-hpi-frequency')?.value || '',
        associated: document.getElementById('aq-hpi-associated')?.value || ''
      };

      pastDentalHistory = {
        previousExtractions: document.getElementById('aq-pdh-prev')?.value || '',
        complications: document.getElementById('aq-pdh-comp')?.value || '',
        treatments: document.getElementById('aq-pdh-treatments')?.value || ''
      };

      for (let i = 1; i <= 24; i++) {
        const diseaseElem = document.getElementById(`aq-med-${i}`);
        if (diseaseElem) medicalHistory[`disease_${i}`] = diseaseElem.value;
      }

      currentMedications = {
        category: document.getElementById('aq-meds-class')?.value || '',
        notes: document.getElementById('aq-meds-notes')?.value || ''
      };

      bloodPressure = {
        classification: document.getElementById('aq-bp')?.value || '',
        systolic: document.getElementById('aq-bp-sys')?.value || '120',
        diastolic: document.getElementById('aq-bp-dia')?.value || '80'
      };

      familyHistory = document.getElementById('aq-fam')?.value || '';
      socialHistory = document.getElementById('aq-soc')?.value || '';

      extraoralExam = {
        symmetry: document.getElementById('aq-exam-sym')?.value || '',
        profile: document.getElementById('aq-exam-prof')?.value || '',
        lymphNodes: document.getElementById('aq-exam-ln')?.value || '',
        tmj: document.getElementById('aq-exam-tmj')?.value || '',
        mouthOpening: document.getElementById('aq-exam-opening')?.value || '',
        skinSalivary: document.getElementById('aq-exam-skin')?.value || '',
        eyes: document.getElementById('aq-exam-eyes')?.value || ''
      };

      // Page 2: Soft Tissues, Charting, Target Tooth, Diagnosis, Notes, & Evaluation
      const totalScore = calculateTotalScore();
      page2Data = {
        date: document.getElementById('p2-date')?.value || '',
        studentGroup: document.getElementById('p2-group')?.value || '',
        softTissues: {
          lips: document.getElementById('p2-lips')?.value || '',
          buccal: document.getElementById('p2-buccal')?.value || '',
          tongue: document.getElementById('p2-tongue')?.value || '',
          floor: document.getElementById('p2-floor')?.value || '',
          palate: document.getElementById('p2-palate')?.value || '',
          gingiva: document.getElementById('p2-gingiva')?.value || ''
        },
        hardTissueCharting: {
          missing: {
            ur: document.getElementById('p2-missing-ur')?.value || '',
            ul: document.getElementById('p2-missing-ul')?.value || '',
            lr: document.getElementById('p2-missing-lr')?.value || '',
            ll: document.getElementById('p2-missing-ll')?.value || ''
          },
          caries: {
            ur: document.getElementById('p2-caries-ur')?.value || '',
            ul: document.getElementById('p2-caries-ul')?.value || '',
            lr: document.getElementById('p2-caries-lr')?.value || '',
            ll: document.getElementById('p2-caries-ll')?.value || ''
          },
          retainedRoots: {
            ur: document.getElementById('p2-roots-ur')?.value || '',
            ul: document.getElementById('p2-roots-ul')?.value || '',
            lr: document.getElementById('p2-roots-lr')?.value || '',
            ll: document.getElementById('p2-roots-ll')?.value || ''
          },
          mobileTeeth: {
            ur: document.getElementById('p2-mob-ur')?.value || '',
            ul: document.getElementById('p2-mob-ul')?.value || '',
            lr: document.getElementById('p2-mob-lr')?.value || '',
            ll: document.getElementById('p2-mob-ll')?.value || ''
          }
        },
        targetTooth: {
          number: document.getElementById('p2-target-tooth')?.value || '',
          condition: document.getElementById('p2-tooth-condition')?.value || '',
          inspection: document.getElementById('p2-inspection')?.value || '',
          ttp: document.getElementById('p2-ttp')?.value || '',
          ttpVert: document.getElementById('p2-ttp-vert')?.value || '',
          ttpHoriz: document.getElementById('p2-ttp-horiz')?.value || '',
          palpation: document.getElementById('p2-palpation')?.value || '',
          mobility: document.getElementById('p2-mobility')?.value || '',
          vitality: document.getElementById('p2-vitality')?.value || document.getElementById('p2-vitality-thermal')?.value || '',
          vitalityVal: document.getElementById('p2-vitality-val')?.value || document.getElementById('p2-vitality-ept')?.value || '',
          occlusion: document.getElementById('p2-occlusion')?.value || '',
          radType: document.getElementById('p2-rad-type')?.value || '',
          radFindings: document.getElementById('p2-rad-findings')?.value || ''
        },
        differentialDiagnosis: document.getElementById('p2-diff-text')?.value || '',
        diagnosis: document.getElementById('p2-diag-text')?.value || '',
        treatmentPlan: {
          plan: document.getElementById('p2-treatment-plan')?.value || 'Simple Extraction',
          simple: document.getElementById('p2-tp-simple')?.checked || false,
          surgical: document.getElementById('p2-tp-surgical')?.checked || false,
          drainage: document.getElementById('p2-tp-drainage')?.checked || false,
          operculectomy: document.getElementById('p2-tp-operculectomy')?.checked || false,
          referral: document.getElementById('p2-tp-referral')?.checked || false
        },
        localAnesthesia: {
          technique: document.getElementById('p2-la-tech')?.value || '',
          agent: document.getElementById('p2-la-agent')?.value || ''
        },
        medicationsPostOp: {
          analgesics: document.getElementById('p2-med-analgesics')?.checked || false,
          antibiotics: document.getElementById('p2-med-antibiotics')?.checked || false,
          mouthwash: document.getElementById('p2-med-mouthwash')?.checked || false,
          gauze: document.getElementById('p2-med-gauze')?.checked || false
        },
        notes: document.getElementById('p2-notes')?.value || '',
        evaluation: {
          caseSheet: document.getElementById('eval-mark-1')?.value || '2.0',
          la: document.getElementById('eval-mark-2')?.value || '1.0',
          extraction: document.getElementById('eval-mark-3')?.value || '2.0',
          sterilization: document.getElementById('eval-mark-4')?.value || '2.0',
          woundCare: document.getElementById('eval-mark-5')?.value || '1.0',
          ethics: document.getElementById('eval-mark-6')?.value || '2.0',
          totalScore: totalScore
        }
      };
    } else {
      const patientNameInput = document.getElementById('patient-name');
      patientName = (patientNameInput && patientNameInput.value.trim()) ? patientNameInput.value.trim() : 'مريض مجهول';
      patientAge = document.getElementById('patient-age')?.value || '28';
      patientSex = document.getElementById('patient-gender')?.value || 'male';
      patientPhone = document.getElementById('patient-phone')?.value || '';
      chiefComplaint = document.getElementById('patient-cc')?.value || '';
    }

    const payload = {
      id: caseIdText,
      patientFile: isAlqabas ? 'AQ-2026-841' : 'P-2026-001',
      patientName,
      patientAge,
      patientSex,
      patientPhone,
      deptId: state.currentOpenSheet.dept.id,
      deptName: state.currentOpenSheet.dept.nameAr,
      sheetId: state.currentOpenSheet.sheet.id,
      sheetCode: state.currentOpenSheet.sheet.code,
      sheetTitle: state.currentOpenSheet.sheet.titleAr,
      studentId: STUDENT_SESSION.id,
      studentName: STUDENT_SESSION.name,
      chiefComplaint,
      chiefComplaintNotes,
      hpiData,
      pastDentalHistory,
      medicalHistory,
      currentMedications,
      bloodPressure,
      familyHistory,
      socialHistory,
      extraoralExam,
      page2Data,
      differentialDiagnosis: isAlqabas && page2Data ? page2Data.differentialDiagnosis : '',
      diagnosis: isAlqabas && page2Data ? page2Data.diagnosis : '',
      supervisorScore: isAlqabas && page2Data ? (page2Data.evaluation.totalScore !== null ? `${page2Data.evaluation.totalScore} / 10` : 'قيد تقييم المشرف') : '9/10',
      supervisorNotes: isAlqabas && page2Data ? page2Data.notes : 'Clinical case approved by supervisor',
      odontogramData: state.odontogramData,
      status: 'draft',
      date: new Date().toISOString()
    };

    // Update state & stats
    state.savedDrafts.push(payload);
    state.stats.savedDrafts++;
    updateStatsDisplay();

    // Save with Supabase Sync
    if (window.EDentalSupabase) {
      const result = await window.EDentalSupabase.saveCase(payload);
      if (result.source === 'supabase') {
        showToast(`تم الحفظ السحابي في سوبابيس بنجاح! 🟢☁️ (${patientName})`, 'success');
      } else if (result.source === 'offline_queue') {
        showToast(`⚠️ تنبيه: لا يوجد إنترنت! تم حفظ الحالة محلياً بأمان، وستتم المزامنة فور عودة النت ⏳ (${patientName})`, 'warning');
      } else {
        showToast(`تم الحفظ كمسودة محلياً بنجاح باسم (${patientName})`, 'info');
      }
    } else {
      showToast(`تم حفظ مسودة الحالة بنجاح باسم (${patientName})`, 'success');
    }
  }

  // Submit Case to Supervisor & Sync
  async function submitCaseToSupervisor() {
    if (!state.currentOpenSheet) return;

    const modalCaseId = document.getElementById('modal-case-id');
    const caseIdText = modalCaseId ? modalCaseId.textContent : '';

    const isAlqabas = state.currentOpenSheet.sheet.id === 'omfs-ext-01' || state.currentOpenSheet.dept.id === 'omfs';
    const scoreVal = calculateTotalScore();
    const finalScore = isAlqabas ? (scoreVal !== null ? `${scoreVal} / 10` : 'قيد تقييم المشرف') : '9/10';
    const finalNotes = isAlqabas ? (document.getElementById('p2-notes')?.value || 'Oral Surgery Case submitted') : 'تم تقديم الكيس شيت للاعتماد السريري من قبل الطالب';

    state.stats.todayCases++;
    if (state.stats.approvedRequirements < state.stats.totalRequired) {
      state.stats.approvedRequirements++;
    }
    updateStatsDisplay();

    if (window.EDentalSupabase && caseIdText) {
      await window.EDentalSupabase.submitCaseReview(caseIdText, {
        status: 'submitted',
        score: finalScore,
        notes: finalNotes
      });
    }

    closeCaseModal();
    showToast('تم إرسال الطبلة للاعتماد السريري وتوقيع الطبيب المشرف بنجاح! ☁️', 'success');
  }

  // Update Stats Display in Dashboard Bar
  function updateStatsDisplay() {
    if (statTodayCases) statTodayCases.textContent = state.stats.todayCases;
    if (statDrafts) statDrafts.textContent = state.stats.savedDrafts;
    if (statApproved) statApproved.textContent = `${state.stats.approvedRequirements} / ${state.stats.totalRequired}`;
    
    const percentage = Math.round((state.stats.approvedRequirements / state.stats.totalRequired) * 100);
    if (statProgressPercent) statProgressPercent.textContent = `${percentage}%`;
  }

  // Toast Notification Function
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColors = {
      'info': 'bg-slate-900 text-white border-slate-700',
      'success': 'bg-emerald-600 text-white border-emerald-500',
      'warning': 'bg-amber-600 text-white border-amber-500',
      'error': 'bg-rose-600 text-white border-rose-500'
    };

    const icons = {
      'info': 'info',
      'success': 'check-circle',
      'warning': 'alert-triangle',
      'error': 'alert-circle'
    };

    toast.className = `clinical-toast px-4 py-3 rounded-xl border flex items-center gap-2.5 text-xs font-bold shadow-xl transition-all ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 shrink-0"></i>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);
    initIcons();

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // Initialize Lucide Icons
  function initIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
});
