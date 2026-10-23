import { Locale } from '../types';

export function translateErrorMessage(errorMsg: string, locale: Locale): string {
  if (!errorMsg) return '';
  if (locale !== 'ar') return errorMsg;

  // 1. Role permission errors
  // Example: Insufficient permissions: required one of [ADMIN, WAREHOUSE_MANAGER, CLERK, SUPER_ADMIN], user has 'ACCOUNTANT'
  const permMatch = errorMsg.match(
    /Insufficient permissions:\s*required one of\s*\[(.*?)\]\s*,\s*user has\s*'(\w+)'/i,
  );
  if (permMatch) {
    const rolesMap: Record<string, string> = {
      ADMIN: 'مدير النظام',
      ACCOUNTANT: 'محاسب',
      WAREHOUSE_MANAGER: 'مدير المستودع',
      CLERK: 'أمين مستودع / كاتب',
      VIEWER: 'مستعرض فقط',
      SUPER_ADMIN: 'المدير العام',
    };
    const required = permMatch[1]
      .split(',')
      .map((r) => rolesMap[r.trim()] || r.trim())
      .join('، ');
    const userRole = rolesMap[permMatch[2].trim()] || permMatch[2].trim();
    return `صلاحيات غير كافية: هذا الإجراء يتطلب أحد الأدوار التالية: [${required}]، بينما دورك الحالي هو '${userRole}'.`;
  }

  // 2. Specific domain & accounting exceptions
  if (/CLOSED accounting period/i.test(errorMsg)) {
    return 'لا يمكن ترحيل السند: تاريخ الترحيل يقع ضمن فترة محاسبية مغلقة.';
  }
  if (/no accounting period/i.test(errorMsg)) {
    return 'لا يمكن ترحيل السند: لا توجد فترة محاسبية مفتوحة تغطي تاريخ الترحيل.';
  }
  if (
    /Insufficient on-hand inventory/i.test(errorMsg) ||
    /negative stock/i.test(errorMsg) ||
    /insufficient stock/i.test(errorMsg)
  ) {
    return 'لا يمكن إتمام العملية: رصيد المخزون المتوفر في المستودع غير كافٍ.';
  }
  if (/conflict/i.test(errorMsg) || /modified by another user/i.test(errorMsg)) {
    return 'تعارض في التعديل: تم تعديل هذا السند بواسطة مستخدم آخر. يرجى تحديث الصفحة للمزامنة.';
  }
  if (/Receipt not found/i.test(errorMsg)) {
    return 'سند الاستلام المطلوب غير موجود في النظام.';
  }
  if (/Only DRAFT receipts can be edited/i.test(errorMsg)) {
    return 'لا يمكن تعديل السند إلا إذا كان في حالة مسودة (DRAFT).';
  }
  if (/Only DRAFT receipts can be deleted/i.test(errorMsg)) {
    return 'لا يمكن حذف السند إلا إذا كان في حالة مسودة (DRAFT).';
  }
  if (/Only POSTED receipts can be voided/i.test(errorMsg)) {
    return 'لا يمكن إلغاء وعكس السند إلا إذا كان في حالة مرحل (POSTED).';
  }
  if (/User context is missing/i.test(errorMsg) || /Unauthorized/i.test(errorMsg)) {
    return 'انتهت جلسة تسجيل الدخول أو بيانات الاعتماد غير صالحة. يرجى تسجيل الدخول مجدداً.';
  }
  if (/Forbidden/i.test(errorMsg) || /Access denied/i.test(errorMsg)) {
    return 'تم رفض الوصول: ليس لديك الصلاحيات الكافية لتنفيذ هذا الإجراء.';
  }

  return errorMsg;
}
