import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>سياسة الخصوصية — طيباتي</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
      background: #f9f7f4;
      color: #1a1a1a;
      line-height: 1.8;
      padding: 0 16px 60px;
    }
    .wrap { max-width: 720px; margin: 0 auto; }
    header {
      padding: 40px 0 24px;
      border-bottom: 2px solid #e5e0d8;
      margin-bottom: 32px;
    }
    .logo { font-size: 28px; font-weight: 700; color: #2d6a4f; }
    .logo span { color: #74c69d; }
    h1 { font-size: 22px; color: #374151; margin-top: 8px; font-weight: 600; }
    .updated { font-size: 13px; color: #6b7280; margin-top: 4px; }
    section { margin-bottom: 32px; }
    h2 {
      font-size: 17px;
      font-weight: 700;
      color: #2d6a4f;
      border-right: 4px solid #74c69d;
      padding-right: 12px;
      margin-bottom: 12px;
    }
    p { font-size: 15px; color: #374151; margin-bottom: 10px; }
    ul { padding-right: 20px; margin-bottom: 10px; }
    li { font-size: 15px; color: #374151; margin-bottom: 6px; }
    a { color: #2d6a4f; text-decoration: underline; }
    .contact-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 20px;
    }
    footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid #e5e0d8;
      font-size: 13px;
      color: #9ca3af;
      text-align: center;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #111827; color: #f3f4f6; }
      header { border-bottom-color: #374151; }
      h1 { color: #e5e7eb; }
      p, li { color: #d1d5db; }
      h2 { color: #6ee7b7; border-right-color: #34d399; }
      .contact-box { background: #064e3b; border-color: #065f46; }
      footer { border-top-color: #374151; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="logo">طيبـاتي <span>Tayyibati</span></div>
      <h1>سياسة الخصوصية</h1>
      <p class="updated">آخر تحديث: يونيو 2026</p>
    </header>

    <section>
      <h2>مقدمة</h2>
      <p>
        مرحباً بك في تطبيق <strong>طيباتي</strong>. نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.
        تشرح هذه السياسة كيفية جمع المعلومات واستخدامها وحمايتها عند استخدامك للتطبيق.
      </p>
    </section>

    <section>
      <h2>المعلومات التي نجمعها</h2>
      <ul>
        <li><strong>معلومات الحساب:</strong> عنوان البريد الإلكتروني المستخدم عند التسجيل.</li>
        <li><strong>سجل التحليلات:</strong> نصوص المكونات والصور التي تقدمها لتحليلها، مع نتائج التحليل.</li>
        <li><strong>بيانات الاستخدام:</strong> عدد التحليلات اليومية لتطبيق حدود الخطة.</li>
        <li><strong>بيانات الاشتراك:</strong> حالة الاشتراك المميز (مجاني / مميز) المرتبطة بمعرّف المستخدم.</li>
      </ul>
    </section>

    <section>
      <h2>كيف نستخدم بياناتك</h2>
      <ul>
        <li>تحليل مكونات الغذاء وإعادة نتائج التحليل إليك.</li>
        <li>حفظ سجل تحليلاتك الشخصية للرجوع إليها.</li>
        <li>تطبيق حدود الاستخدام اليومي وفق خطتك (مجاني / مميز).</li>
        <li>إرسال رمز إعادة تعيين كلمة المرور عند الطلب.</li>
        <li>التحقق من اشتراكك المدفوع عبر خدمة RevenueCat.</li>
      </ul>
    </section>

    <section>
      <h2>خدمات الطرف الثالث</h2>
      <p>يستخدم التطبيق الخدمات الخارجية التالية:</p>
      <ul>
        <li>
          <strong>OpenAI:</strong> نرسل نصوص المكونات أو صور الملصقات إلى نماذج OpenAI لاستخراج المكونات وتصنيفها.
          تخضع البيانات لـ <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener">سياسة خصوصية OpenAI</a>.
        </li>
        <li>
          <strong>RevenueCat:</strong> تُدار المشتريات داخل التطبيق من خلال RevenueCat، الذي يتحقق من حالة اشتراكك.
          لمزيد من التفاصيل، راجع <a href="https://www.revenuecat.com/privacy" target="_blank" rel="noopener">سياسة خصوصية RevenueCat</a>.
        </li>
        <li>
          <strong>Apple / Google:</strong> تتم معالجة مدفوعات داخل التطبيق عبر App Store أو Google Play وفق شروط كل منصة.
        </li>
        <li>
          <strong>Resend:</strong> نستخدم Resend لإرسال بريد إعادة تعيين كلمة المرور فقط.
        </li>
      </ul>
    </section>

    <section>
      <h2>الاحتفاظ بالبيانات ومشاركتها</h2>
      <p>
        لا نبيع بياناتك الشخصية ولا نشاركها مع أطراف ثالثة لأغراض تسويقية.
        نحتفظ ببيانات حسابك وسجل تحليلاتك طالما كان حسابك نشطاً.
        يمكنك طلب حذف بياناتك في أي وقت عبر التواصل معنا على العنوان أدناه.
      </p>
    </section>

    <section>
      <h2>أمان البيانات</h2>
      <p>
        نطبّق تشفير HTTPS لجميع الاتصالات بين التطبيق والخادم.
        كلمات المرور مشفّرة ولا يمكن الاطلاع عليها.
        رموز إعادة تعيين كلمة المرور صالحة لمدة 15 دقيقة فقط وتنتهي صلاحيتها بعد الاستخدام.
      </p>
    </section>

    <section>
      <h2>حقوقك</h2>
      <ul>
        <li>الاطلاع على البيانات الشخصية التي نحتفظ بها عنك.</li>
        <li>طلب تصحيح أي معلومات غير دقيقة.</li>
        <li>طلب حذف حسابك وبياناتك كاملاً.</li>
      </ul>
    </section>

    <section>
      <h2>تواصل معنا</h2>
      <div class="contact-box">
        <p>إذا كان لديك أي استفسار بشأن هذه السياسة أو بياناتك، يُرجى التواصل معنا:</p>
        <p><strong>البريد الإلكتروني:</strong> <a href="mailto:support@tayyibati.app">support@tayyibati.app</a></p>
      </div>
    </section>

    <footer>
      &copy; 2026 طيباتي — Tayyibati. جميع الحقوق محفوظة.
    </footer>
  </div>
</body>
</html>`);
});

export default router;
