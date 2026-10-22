export type Locale = 'en' | 'ar';

export interface Translations {
  appName: string;
  appSubtitle: string;
  login: {
    title: string;
    subtitle: string;
    companyCode: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    quickAccounts: string;
    quickAdmin: string;
    quickClerk: string;
    quickAccountant: string;
    logout: string;
  };
  nav: {
    receipts: string;
    newReceipt: string;
    systemHealth: string;
    userProfile: string;
  };
  roles: {
    ADMIN: string;
    ACCOUNTANT: string;
    WAREHOUSE_MANAGER: string;
    CLERK: string;
    VIEWER: string;
    SUPER_ADMIN: string;
  };
  statuses: {
    DRAFT: string;
    POSTED: string;
    VOIDED: string;
    CANCELLED: string;
    ALL: string;
  };
  receipts: {
    listTitle: string;
    createTitle: string;
    editTitle: string;
    detailsTitle: string;
    receiptNumber: string;
    date: string;
    warehouse: string;
    supplier: string;
    status: string;
    totalAmount: string;
    subtotal: string;
    taxAmount: string;
    actions: string;
    view: string;
    edit: string;
    delete: string;
    post: string;
    void: string;
    notes: string;
    lines: string;
    item: string;
    sku: string;
    quantity: string;
    unitCost: string;
    lineTotal: string;
    addLine: string;
    removeLine: string;
    selectWarehouse: string;
    selectSupplier: string;
    selectItem: string;
    filterByStatus: string;
    filterByWarehouse: string;
    filterBySupplier: string;
    searchPlaceholder: string;
    dateFrom: string;
    dateTo: string;
    applyFilters: string;
    resetFilters: string;
    sortBy: string;
    sortOrder: string;
    asc: string;
    desc: string;
    noReceiptsFound: string;
    noReceiptsSub: string;
    createNewReceipt: string;
    serverAuthoritativeNote: string;
    journalEntry: string;
    postedBy: string;
    voidedBy: string;
    voidReason: string;
    createdAt: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
  };
  postModal: {
    title: string;
    subtitle: string;
    warningText: string;
    debitText: string;
    creditText: string;
    totalImpact: string;
    confirmButton: string;
    postingButton: string;
    cancelButton: string;
  };
  voidModal: {
    title: string;
    subtitle: string;
    warningText: string;
    reasonLabel: string;
    reasonPlaceholder: string;
    reasonRequired: string;
    confirmButton: string;
    voidingButton: string;
    cancelButton: string;
  };
  pagination: {
    pageOf: string;
    showing: string;
    of: string;
    items: string;
    previous: string;
    next: string;
    perPage: string;
  };
  common: {
    loading: string;
    save: string;
    saving: string;
    cancel: string;
    back: string;
    refresh: string;
    success: string;
    error: string;
    required: string;
    invalidQuantity: string;
    invalidCost: string;
    atLeastOneLine: string;
    selectRequired: string;
    duplicateLinesWarning: string;
    unsavedChangesWarning: string;
    connected: string;
    disconnected: string;
    language: string;
  };
}

export const translations: Record<Locale, Translations> = {
  en: {
    appName: 'Inventory Receipts ERP',
    appSubtitle: 'Enterprise Inventory Receipts with Weighted Costing & GL Posting',
    login: {
      title: 'Sign In to Your Workspace',
      subtitle: 'Enter your company code and credentials to access the ERP system.',
      companyCode: 'Company Code',
      email: 'Email Address',
      password: 'Password',
      submit: 'Sign In',
      submitting: 'Signing in...',
      quickAccounts: 'Quick Test Accounts:',
      quickAdmin: 'Admin (COMP-01)',
      quickClerk: 'Clerk (COMP-01)',
      quickAccountant: 'Accountant (COMP-01)',
      logout: 'Sign Out',
    },
    nav: {
      receipts: 'Inventory Receipts',
      newReceipt: 'New Receipt Draft',
      systemHealth: 'System Health',
      userProfile: 'My Profile',
    },
    roles: {
      ADMIN: 'Administrator',
      ACCOUNTANT: 'Accountant',
      WAREHOUSE_MANAGER: 'Warehouse Manager',
      CLERK: 'Clerk',
      VIEWER: 'Viewer',
      SUPER_ADMIN: 'Super Administrator',
    },
    statuses: {
      DRAFT: 'Draft',
      POSTED: 'Posted',
      VOIDED: 'Voided',
      CANCELLED: 'Cancelled',
      ALL: 'All Statuses',
    },
    receipts: {
      listTitle: 'Inventory Receipts',
      createTitle: 'Create Receipt Draft',
      editTitle: 'Edit Receipt Draft',
      detailsTitle: 'Receipt Document Details',
      receiptNumber: 'Receipt #',
      date: 'Receipt Date',
      warehouse: 'Warehouse',
      supplier: 'Supplier',
      status: 'Status',
      totalAmount: 'Total Value',
      subtotal: 'Subtotal',
      taxAmount: 'Tax',
      actions: 'Actions',
      view: 'View',
      edit: 'Edit',
      delete: 'Delete',
      post: 'Post to GL',
      void: 'Void Receipt',
      notes: 'Notes / Reference',
      lines: 'Receipt Line Items',
      item: 'Item',
      sku: 'SKU',
      quantity: 'Quantity Received',
      unitCost: 'Unit Cost',
      lineTotal: 'Line Total',
      addLine: '+ Add Line Item',
      removeLine: 'Remove',
      selectWarehouse: 'Select Warehouse...',
      selectSupplier: 'Select Supplier...',
      selectItem: 'Select Item SKU...',
      filterByStatus: 'Filter by Status',
      filterByWarehouse: 'All Warehouses',
      filterBySupplier: 'All Suppliers',
      searchPlaceholder: 'Search by receipt # or notes...',
      dateFrom: 'Date From',
      dateTo: 'Date To',
      applyFilters: 'Filter',
      resetFilters: 'Reset',
      sortBy: 'Sort By',
      sortOrder: 'Order',
      asc: 'Ascending',
      desc: 'Descending',
      noReceiptsFound: 'No receipts match your search criteria.',
      noReceiptsSub: 'Create a new receipt draft to begin receiving goods.',
      createNewReceipt: 'Create New Draft',
      serverAuthoritativeNote:
        '* Line totals shown here are client previews. Final totals are authoritatively computed and verified by the server.',
      journalEntry: 'General Ledger Journal Entry',
      postedBy: 'Posted By',
      voidedBy: 'Voided By',
      voidReason: 'Reason for Voiding',
      createdAt: 'Created Timestamp',
      deleteConfirmTitle: 'Delete Draft Receipt',
      deleteConfirmMessage:
        'Are you sure you want to delete this draft receipt? This action cannot be undone.',
    },
    postModal: {
      title: 'Confirm Inventory Receipt Posting',
      subtitle:
        'This is a financial transaction that commits permanent inventory and accounting changes.',
      warningText:
        'Posting will immediately update warehouse stock balances, revalue moving weighted-average costs, and post balanced double-entry journals to the General Ledger.',
      debitText: 'Debit: Inventory Asset Account (per SKU)',
      creditText: 'Credit: Accrued Goods Received Clearing Account',
      totalImpact: 'Total Financial Value to Post:',
      confirmButton: 'Confirm & Post to Ledger',
      postingButton: 'Posting to Ledger...',
      cancelButton: 'Cancel',
    },
    voidModal: {
      title: 'Confirm Receipt Reversal & Voiding',
      subtitle: 'Safely reverses stock movements and cancels general ledger impact.',
      warningText:
        'Voiding requires sufficient on-hand inventory. If any received goods have already been consumed or issued, voiding will be blocked to protect against negative stock.',
      reasonLabel: 'Mandatory Reason for Voiding',
      reasonPlaceholder:
        'Enter audit rationale for voiding this receipt (e.g., incorrect shipment delivered, supplier duplicate)...',
      reasonRequired: 'A reason is required before voiding can be processed.',
      confirmButton: 'Execute Safe Void',
      voidingButton: 'Processing Reversal...',
      cancelButton: 'Cancel',
    },
    pagination: {
      pageOf: 'Page {page} of {totalPages}',
      showing: 'Showing',
      of: 'of',
      items: 'receipts',
      previous: 'Previous',
      next: 'Next',
      perPage: 'per page',
    },
    common: {
      loading: 'Loading data...',
      save: 'Save Draft',
      saving: 'Saving...',
      cancel: 'Cancel',
      back: 'Back to List',
      refresh: 'Refresh',
      success: 'Operation completed successfully.',
      error: 'An error occurred.',
      required: 'This field is required',
      invalidQuantity: 'Quantity must be greater than 0',
      invalidCost: 'Unit cost cannot be negative',
      atLeastOneLine: 'At least one receipt line item is required',
      selectRequired: 'Please make a selection',
      duplicateLinesWarning: 'Warning: Multiple lines contain the same item.',
      unsavedChangesWarning: 'You have unsaved changes. Are you sure you want to leave?',
      connected: 'Connected',
      disconnected: 'Disconnected',
      language: 'Language',
    },
  },
  ar: {
    appName: 'نظام إدارة سندات الاستلام والمخزون',
    appSubtitle:
      'نظام تخطيط موارد المؤسسات لإدارة استلام البضائع، تقييم المخزون المرجح، والترحيل لدفتر الأستاذ العام',
    login: {
      title: 'تسجيل الدخول إلى بيئة العمل',
      subtitle: 'أدخل رمز الشركة وبيانات الاعتماد للدخول إلى النظام المحاسبي.',
      companyCode: 'رمز الشركة',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      submit: 'تسجيل الدخول',
      submitting: 'جاري تسجيل الدخول...',
      quickAccounts: 'حسابات تجريبية سريعة:',
      quickAdmin: 'المدير (COMP-01)',
      quickClerk: 'أمين المستودع (COMP-01)',
      quickAccountant: 'المحاسب (COMP-01)',
      logout: 'تسجيل الخروج',
    },
    nav: {
      receipts: 'سندات الاستلام',
      newReceipt: 'سند استلام جديد',
      systemHealth: 'حالة الخادم وقاعدة البيانات',
      userProfile: 'الملف الشخصي',
    },
    roles: {
      ADMIN: 'مدير النظام',
      ACCOUNTANT: 'محاسب',
      WAREHOUSE_MANAGER: 'مدير المستودع',
      CLERK: 'أمين مستودع / كاتب',
      VIEWER: 'مستعرض فقط',
      SUPER_ADMIN: 'المدير العام',
    },
    statuses: {
      DRAFT: 'مسودة',
      POSTED: 'مرحل',
      VOIDED: 'ملغي / معكوس',
      CANCELLED: 'ملغي',
      ALL: 'جميع الحالات',
    },
    receipts: {
      listTitle: 'سندات استلام المخزون',
      createTitle: 'إنشاء مسودة سند استلام',
      editTitle: 'تعديل مسودة سند استلام',
      detailsTitle: 'تفاصيل وثيقة سند الاستلام',
      receiptNumber: 'رقم السند',
      date: 'تاريخ الاستلام',
      warehouse: 'المستودع',
      supplier: 'المورد',
      status: 'الحالة',
      totalAmount: 'القيمة الإجمالية',
      subtotal: 'المجموع الفرعي',
      taxAmount: 'الضريبة',
      actions: 'الإجراءات',
      view: 'عرض',
      edit: 'تعديل',
      delete: 'حذف',
      post: 'ترحيل دفتري',
      void: 'إلغاء وعكس',
      notes: 'الملاحظات / المرجع',
      lines: 'بنود سند الاستلام',
      item: 'الصنف',
      sku: 'رمز الصنف (SKU)',
      quantity: 'الكمية المستلمة',
      unitCost: 'تكلفة الوحدة',
      lineTotal: 'إجمالي البند',
      addLine: '+ إضافة صنف جديد',
      removeLine: 'حذف',
      selectWarehouse: 'اختر المستودع...',
      selectSupplier: 'اختر المورد...',
      selectItem: 'اختر الصنف من القائمة...',
      filterByStatus: 'فلترة حسب الحالة',
      filterByWarehouse: 'جميع المستودعات',
      filterBySupplier: 'جميع الموردين',
      searchPlaceholder: 'بحث برقم السند أو الملاحظات...',
      dateFrom: 'من تاريخ',
      dateTo: 'إلى تاريخ',
      applyFilters: 'تطبيق الفلترة',
      resetFilters: 'إعادة ضبط',
      sortBy: 'ترتيب حسب',
      sortOrder: 'الاتجاه',
      asc: 'تصاعدي',
      desc: 'تنازلي',
      noReceiptsFound: 'لا توجد سندات مطابقة لمعايير البحث.',
      noReceiptsSub: 'يمكنك إنشاء سند استلام جديد للبدء في توريد البضائع.',
      createNewReceipt: 'إنشاء سند جديد',
      serverAuthoritativeNote:
        '* إجماليات البنود المعروضة هنا هي للمعاينة فقط. الحساب النهائي المعتمد يتم حسابه وتدقيقه في الخادم بشكل قاطع.',
      journalEntry: 'قيد اليومية العامة المرتبط',
      postedBy: 'تم الترحيل بواسطة',
      voidedBy: 'تم الإلغاء بواسطة',
      voidReason: 'سبب الإلغاء',
      createdAt: 'تاريخ الإنشاء',
      deleteConfirmTitle: 'تأكيد حذف مسودة السند',
      deleteConfirmMessage:
        'هل أنت متأكد من رغبتك في حذف مسودة هذا السند؟ هذا الإجراء نهائي ولا يمكن التراجع عنه.',
    },
    postModal: {
      title: 'تأكيد ترحيل سند الاستلام إلى المخزون والحسابات',
      subtitle: 'هذه معاملة مالية ومخزنية نهائية ستحدث أثر محاسبي ومخزني فوري.',
      warningText:
        'الترحيل سيقوم فورياً بزيادة أرصدة المستودع، وإعادة حساب متوسط التكلفة المرجح، وتوليد قيود يومية متوازنة في دفتر الأستاذ العام.',
      debitText: 'مدين: حساب أصل المخزون (لكل صنف)',
      creditText: 'دائن: حساب وسيط البضائع المستلمة غير المفوترة (GRN Clearing)',
      totalImpact: 'إجمالي الأثر المالي للترحيل:',
      confirmButton: 'تأكيد الترحيل والاعتماد',
      postingButton: 'جاري الترحيل المالي...',
      cancelButton: 'إلغاء الأمر',
    },
    voidModal: {
      title: 'تأكيد عكس وإلغاء سند الاستلام المرحل',
      subtitle: 'عكس حركات المخزون وإلغاء أثر قيد اليومية العامة بشكل آمن ومحكم.',
      warningText:
        'يتطلب الإلغاء توفر كميات كافية في رصيد المستودع الحالي. إذا تم صرف أي كمية مستلمة مسبقاً، سيتم منع الإلغاء لحماية المخزون من الأرصدة السالبة.',
      reasonLabel: 'سبب الإلغاء (إلزامي للتدقيق المالي)',
      reasonPlaceholder:
        'أدخل سبب الإلغاء لأغراض التدقيق المحاسبي (مثال: بضاعة غير مطابقة، تكرار من المورد)...',
      reasonRequired: 'يجب كتابة سبب الإلغاء قبل المتابعة.',
      confirmButton: 'تنفيذ الإلغاء والعكس',
      voidingButton: 'جاري تنفيذ العكس المحاسبي...',
      cancelButton: 'تراجع',
    },
    pagination: {
      pageOf: 'صفحة {page} من {totalPages}',
      showing: 'عرض',
      of: 'من أصل',
      items: 'سند',
      previous: 'السابق',
      next: 'التالي',
      perPage: 'لكل صفحة',
    },
    common: {
      loading: 'جاري تحميل البيانات...',
      save: 'حفظ المسودة',
      saving: 'جاري الحفظ...',
      cancel: 'إلغاء',
      back: 'الرجوع للقائمة',
      refresh: 'تحديث',
      success: 'تمت العملية بنجاح.',
      error: 'حدث خطأ في النظام.',
      required: 'هذا الحقل إلزامي',
      invalidQuantity: 'يجب أن تكون الكمية أكبر من 0',
      invalidCost: 'لا يمكن أن تكون تكلفة الوحدة سالبة',
      atLeastOneLine: 'يجب إضافة بند واحد على الأقل في السند',
      selectRequired: 'يرجى الاختيار من القائمة',
      duplicateLinesWarning: 'تنبيه: يحتوي السند على بنود مكررة لنفس الصنف.',
      unsavedChangesWarning: 'لديك تعديلات غير محفوظة. هل أنت متأكد من مغادرة الصفحة؟',
      connected: 'متصل',
      disconnected: 'غير متصل',
      language: 'اللغة',
    },
  },
};
