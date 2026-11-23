/*
  سجل المنصات — لإضافة منصة جديدة أضف عنصراً واحداً لهذه القائمة فقط.
  kind:
    "linked"  منصة خارجية تُعرض داخل تبويب، مع ملخص يدوي (snapshot) تُدخل أرقامه وتُحفظ في القاعدة المشتركة.
    "native"  منصة مبنية داخل البوابة وتحلل بياناتها مباشرة (الرخص، بطاقات السلامة).
  fields: مؤشرات الملخص. better: "up" الأعلى أفضل، "down" الأقل أفضل.
  health(s): يحسب حالة المنصة من آخر قراءة: {level:"ok"|"warn"|"bad", text}
*/
(function () {
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

  window.REGISTRY = [
    {
      id: "projects",
      name: "تقارير المشاريع",
      short: "المشاريع",
      icon: "M4 20V9l8-5 8 5v11M9 20v-6h6v6",
      purpose: "موقف المشاريع وأوامر العمل وحالة الإغلاق",
      kind: "linked",
      url: "https://mainoffice-wo-report.netlify.app/",
      fields: [
        { key: "total", label: "إجمالي أوامر العمل", better: "up" },
        { key: "closed", label: "أوامر مغلقة", better: "up" },
        { key: "open", label: "أوامر مفتوحة", better: "down" },
        { key: "late", label: "متأخرة الإغلاق", better: "down" },
      ],
      health(s) {
        const r = pct(s.closed, s.total);
        if (r == null) return null;
        const level = s.late > 0 && r < 60 ? "bad" : r < 80 || s.late > 0 ? "warn" : "ok";
        return { level, score: r, text: `نسبة الإغلاق ${r}%` + (s.late ? ` و${s.late} متأخرة` : "") };
      },
    },
    {
      id: "schedule",
      name: "جدول الأعمال اليومي والشهري",
      short: "جدول الأعمال",
      icon: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
      purpose: "المخطط مقابل المنفذ يومياً وشهرياً",
      kind: "linked",
      url: "https://najran-wabran-dor-dashboard.netlify.app/",
      fields: [
        { key: "dayPlan", label: "أعمال اليوم المخططة", better: "up" },
        { key: "dayDone", label: "أعمال اليوم المنفذة", better: "up" },
        { key: "monthPlan", label: "أعمال الشهر المخططة", better: "up" },
        { key: "monthDone", label: "أعمال الشهر المنفذة", better: "up" },
      ],
      health(s) {
        const r = pct(s.monthDone, s.monthPlan) ?? pct(s.dayDone, s.dayPlan);
        if (r == null) return null;
        return { level: r >= 85 ? "ok" : r >= 60 ? "warn" : "bad", score: r, text: `الإنجاز مقابل المخطط ${r}%` };
      },
    },
    {
      id: "invoices",
      name: "تحليل الفواتير الضريبية",
      short: "الفواتير",
      icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
      purpose: "قيمة الفواتير والمحصّل والمعلّق والضريبة",
      kind: "linked",
      url: "https://najran-invoice-intelligence.netlify.app/",
      fields: [
        { key: "count", label: "عدد الفواتير", better: "up" },
        { key: "value", label: "إجمالي القيمة", unit: "ريال", better: "up" },
        { key: "paid", label: "المحصّل", unit: "ريال", better: "up" },
        { key: "pending", label: "المعلّق", unit: "ريال", better: "down" },
      ],
      health(s) {
        const r = pct(s.paid, s.value);
        if (r == null) return null;
        return { level: r >= 80 ? "ok" : r >= 50 ? "warn" : "bad", score: r, text: `نسبة التحصيل ${r}%` };
      },
    },
    {
      id: "assign",
      name: "تحليل إسناد أوامر العمل",
      short: "إسناد الأوامر",
      icon: "M5 12h9M10 7l5 5-5 5M19 5v14",
      purpose: "الأوامر المسندة والمنجزة وغير المسندة",
      kind: "linked",
      url: "https://work-orders-control-center.netlify.app/",
      fields: [
        { key: "assigned", label: "أوامر مسندة", better: "up" },
        { key: "inprog", label: "قيد التنفيذ", better: "up" },
        { key: "done", label: "منجزة", better: "up" },
        { key: "unassigned", label: "غير مسندة", better: "down" },
      ],
      health(s) {
        const r = pct(s.done, s.assigned);
        if (r == null) return null;
        const level = s.unassigned > 5 || r < 50 ? "bad" : s.unassigned > 0 || r < 75 ? "warn" : "ok";
        return { level, score: r, text: `منجز ${r}% من المسند` + (s.unassigned ? ` و${s.unassigned} غير مسندة` : "") };
      },
    },
    {
      id: "dispatch",
      name: "تخطيط العمل اليومي",
      short: "التخطيط اليومي",
      icon: "M3 17l6-6 4 4 8-8M15 7h6v6",
      purpose: "توزيع الفرق والمهام على مواقع اليوم",
      kind: "linked",
      url: "https://najran-dispatch-board.netlify.app/",
      fields: [
        { key: "crews", label: "فرق اليوم", better: "up" },
        { key: "tasks", label: "مهام مخططة", better: "up" },
        { key: "tasksDone", label: "مهام منجزة", better: "up" },
        { key: "idle", label: "فرق بلا مهام", better: "down" },
      ],
      health(s) {
        const r = pct(s.tasksDone, s.tasks);
        if (r == null) return null;
        const level = s.idle > 0 && r < 60 ? "bad" : s.idle > 0 || r < 80 ? "warn" : "ok";
        return { level, score: r, text: `إنجاز مهام اليوم ${r}%` + (s.idle ? ` و${s.idle} فرق بلا مهام` : "") };
      },
    },
    {
      id: "licenses",
      name: "موقف الرخص",
      short: "الرخص",
      icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13l2 2 4-4",
      purpose: "رخص الحفر: المفتوحة والمتجاوزة وأسباب التأخر",
      kind: "native",
      url: "https://wabran-licenses-platform.netlify.app/",
      source: "https://claude.ai/artifact/7TZiqWZ9rgsecPJwSkufnw",
    },
    {
      id: "safety",
      name: "بطاقات السلامة",
      short: "السلامة",
      icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
      purpose: "هويات SCECO للعمال: المنتهية والقريبة من الانتهاء",
      kind: "native",
      url: "https://najran-safety-cards.netlify.app/",
      source: "https://claude.ai/artifact/TLfTbRDsQCFc2GUMUJgSxr",
    },
  ];
})();
