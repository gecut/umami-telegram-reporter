/**
 * Humanizer Mini-Engine
 * Translates technical paths, referrers, UTM parameters, and channels into clean,
 * natural Persian terms tailored for business owners (کارفرما).
 */

const KNOWN_PAYMENT_GATEWAYS: RegExp[] = [
  /shaparak\.ir$/i,
  /zarinpal\.com$/i,
  /pay\.ir$/i,
  /idpay\.ir$/i,
  /nextpay\.org$/i,
  /jibit\.ir$/i,
  /aqayepardakht\.ir$/i,
  /payping\.ir$/i,
];

/**
 * Checks if a referrer domain is a payment gateway return loop.
 * Customers returning from banks are not acquisition sources.
 */
export function isPaymentGateway(domain: string | undefined | null): boolean {
  if (!domain) return false;
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  return KNOWN_PAYMENT_GATEWAYS.some((regex) => regex.test(clean));
}

/**
 * Normalizes and translates technical referrer domains to Persian brand names.
 */
export function humanizeReferrer(
  referrer: string | undefined | null,
  customMap?: Record<string, string>
): string {
  if (!referrer || referrer === "(بدون منبع)" || referrer === "(مستقیم / نامشخص)") {
    return "ورود مستقیم به سایت";
  }

  const clean = referrer.trim().toLowerCase();

  // 1. Check custom project map first
  if (customMap) {
    for (const [key, label] of Object.entries(customMap)) {
      if (key.toLowerCase() === clean) return label;
    }
  }

  // 2. Google Search (Web and Mobile Android QuickSearchBox)
  if (
    clean.includes("googlequicksearchbox") ||
    clean.includes("google.com") ||
    clean.includes("google.ir")
  ) {
    return "جستجوی گوگل";
  }

  // 3. Torob
  if (clean.includes("torob.com")) {
    return "موتور جستجوی ترب";
  }

  // 4. Emalls
  if (clean.includes("emalls.ir")) {
    return "موتور جستجوی ایمالز";
  }

  // 5. Basalam
  if (clean.includes("basalam.com")) {
    return "باسلام";
  }

  // 6. Instagram
  if (clean.includes("instagram.com")) {
    return "اینستاگرام";
  }

  // 7. Telegram
  if (clean.includes("t.me") || clean.includes("telegram.me") || clean.includes("telegram.org")) {
    return "تلگرام";
  }

  // 8. Facebook
  if (clean.includes("facebook.com")) {
    return "فیس‌بوک";
  }

  // 9. Twitter / X
  if (clean.includes("t.co") || clean.includes("twitter.com") || clean.includes("x.com")) {
    return "توییتر (X)";
  }

  // 10. WhatsApp
  if (clean.includes("wa.me") || clean.includes("whatsapp.com")) {
    return "واتس‌اپ";
  }

  // 11. Divar / Sheypoor
  if (clean.includes("divar.ir")) return "دیوار";
  if (clean.includes("sheypoor.com")) return "شیپور";

  // 12. Payment Gateway fallback label if not filtered
  if (isPaymentGateway(clean)) {
    return "بازگشت از درگاه بانک";
  }

  // Fallback: Strip protocol and leading www/m/l
  return referrer.replace(/^https?:\/\//i, "").replace(/^(www|m|l)\./i, "");
}

/**
 * Translates technical URL paths to business-friendly Persian page labels.
 */
export function humanizePath(
  path: string | undefined | null,
  customMap?: Record<string, string>
): string {
  if (!path) return "صفحه اصلی";

  let clean = path.trim();
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Keep raw if decoding fails
  }

  // Remove trailing slash if longer than 1 character
  if (clean.length > 1 && clean.endsWith("/")) {
    clean = clean.slice(0, -1);
  }

  // 1. Check custom project map first
  if (customMap) {
    const cleanMatch = customMap[clean];
    if (cleanMatch) return cleanMatch;
    const rawMatch = customMap[path];
    if (rawMatch) return rawMatch;
  }

  // 2. Exact match common e-commerce paths
  const EXACT_MAP: Record<string, string> = {
    "/": "صفحه اصلی (خانه)",
    "/shop": "ویترین فروشگاه",
    "/products": "فهرست محصولات",
    "/cart": "سبد خرید",
    "/checkout": "تسویه حساب",
    "/auth": "بخش ورود و عضویت",
    "/auth/login": "ورود به حساب کاربری",
    "/auth/login-otp": "ورود با پیامک (OTP)",
    "/auth/register": "ثبت‌نام در سایت",
    "/auth/complete-profile": "تکمیل اطلاعات کاربری",
    "/profile": "پروفایل کاربری",
    "/orders": "سفارش‌های من",
    "/blog": "وبلاگ و مقالات",
    "/mag": "مجله فروشگاه",
    "/about": "درباره ما",
    "/about-us": "درباره ما",
    "/contact": "تماس با ما",
    "/contact-us": "تماس با ما",
    "/faq": "پرسش‌های متداول",
  };

  const directMatch = EXACT_MAP[clean.toLowerCase()];
  if (directMatch) return directMatch;

  // 3. Pattern match parameterized routes
  if (clean.startsWith("/shop/c/")) {
    const category = clean.replace("/shop/c/", "").replaceAll("-", " ");
    return `دسته‌بندی: ${category}`;
  }

  if (clean.startsWith("/product/") || clean.startsWith("/products/") || clean.startsWith("/p/")) {
    const slug = clean.split("/").pop()?.replaceAll("-", " ") ?? "";
    return `محصول: ${slug}`;
  }

  if (clean.startsWith("/blog/") || clean.startsWith("/mag/")) {
    const slug = clean.split("/").pop()?.replaceAll("-", " ") ?? "";
    return `مقاله: ${slug}`;
  }

  if (clean.startsWith("/auth/")) {
    return "بخش ورود و حساب کاربری";
  }

  // Fallback: clean the string
  return clean.replace(/^\//, "").replaceAll("-", " ");
}

/**
 * Translates UTM source parameters to clean Persian brand names.
 */
export function humanizeUtmSource(
  source: string | undefined | null,
  customMap?: Record<string, string>
): string {
  if (!source || source === "(بدون منبع)") return "ورود مستقیم";
  const clean = source.trim().toLowerCase();

  if (customMap) {
    for (const [key, label] of Object.entries(customMap)) {
      if (key.toLowerCase() === clean) return label;
    }
  }

  const MAP: Record<string, string> = {
    instagram: "اینستاگرام",
    ig: "اینستاگرام",
    telegram: "تلگرام",
    tg: "تلگرام",
    torob: "موتور ترب",
    emalls: "ایمالز",
    google: "جستجوی گوگل",
    googleads: "تبلیغات گوگل (گوگل ادز)",
    adwords: "تبلیغات گوگل (گوگل ادز)",
    sms: "پیامک تبلیغاتی",
    sms_marketing: "پیامک تبلیغاتی",
    email: "ایمیل مارکتینگ",
    newsletter: "خبرنامه ایمیلی",
  };

  return MAP[clean] ?? source;
}

/**
 * Translates UTM content dimensions (e.g. bio, story, banner) to Persian terms.
 */
export function humanizeUtmContent(
  content: string | undefined | null,
  customMap?: Record<string, string>
): string {
  if (!content) return "نامشخص";
  const clean = content.trim().toLowerCase();

  if (customMap) {
    for (const [key, label] of Object.entries(customMap)) {
      if (key.toLowerCase() === clean) return label;
    }
  }

  const MAP: Record<string, string> = {
    bio: "لینک بیو",
    story: "استوری‌ها",
    stories: "استوری‌ها",
    post: "پست‌ها",
    posts: "پست‌ها",
    reels: "ویدیوهای ریلز",
    banner: "بنر تبلیغاتی",
    cta: "دکمه اقدام (CTA)",
    footer: "فوتر سایت",
    header: "هدر سایت",
  };

  return MAP[clean] ?? content;
}
