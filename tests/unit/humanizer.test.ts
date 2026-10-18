import { describe, it, expect } from "bun:test";
import {
  isPaymentGateway,
  humanizeReferrer,
  humanizePath,
  humanizeUtmSource,
  humanizeUtmContent,
} from "../../src/lib/humanizer";

describe("Humanizer Mini-Engine", () => {
  describe("Payment Gateway Detection", () => {
    it("detects shaparak.ir subdomains", () => {
      expect(isPaymentGateway("sep.shaparak.ir")).toBe(true);
      expect(isPaymentGateway("https://bpm.shaparak.ir/pay")).toBe(true);
      expect(isPaymentGateway("sadad.shaparak.ir")).toBe(true);
    });

    it("detects third-party payment gateways", () => {
      expect(isPaymentGateway("zarinpal.com")).toBe(true);
      expect(isPaymentGateway("idpay.ir")).toBe(true);
      expect(isPaymentGateway("pay.ir")).toBe(true);
    });

    it("does not flag regular websites as gateways", () => {
      expect(isPaymentGateway("google.com")).toBe(false);
      expect(isPaymentGateway("torob.com")).toBe(false);
      expect(isPaymentGateway(null)).toBe(false);
    });
  });

  describe("Referrer Humanization", () => {
    it("translates Google search and Android quicksearchbox", () => {
      expect(humanizeReferrer("google.com")).toBe("جستجوی گوگل");
      expect(humanizeReferrer("com.google.android.googlequicksearchbox")).toBe("جستجوی گوگل");
      expect(humanizeReferrer("https://www.google.ir")).toBe("جستجوی گوگل");
    });

    it("translates Torob and Iranian marketplaces", () => {
      expect(humanizeReferrer("api.torob.com")).toBe("موتور جستجوی ترب");
      expect(humanizeReferrer("torob.com")).toBe("موتور جستجوی ترب");
      expect(humanizeReferrer("emalls.ir")).toBe("موتور جستجوی ایمالز");
    });

    it("translates social networks", () => {
      expect(humanizeReferrer("l.instagram.com")).toBe("اینستاگرام");
      expect(humanizeReferrer("t.me")).toBe("تلگرام");
      expect(humanizeReferrer("m.facebook.com")).toBe("فیس‌بوک");
    });

    it("supports custom project overrides", () => {
      const custom = { "special-partner.com": "همکار ویژه (کمپین تخفیف)" };
      expect(humanizeReferrer("special-partner.com", custom)).toBe("همکار ویژه (کمپین تخفیف)");
    });
  });

  describe("Path Humanization", () => {
    it("translates root and standard e-commerce paths", () => {
      expect(humanizePath("/")).toBe("صفحه اصلی (خانه)");
      expect(humanizePath("/shop")).toBe("ویترین فروشگاه");
      expect(humanizePath("/cart")).toBe("سبد خرید");
      expect(humanizePath("/checkout")).toBe("تسویه حساب");
    });

    it("translates auth paths", () => {
      expect(humanizePath("/auth/complete-profile")).toBe("تکمیل اطلاعات کاربری");
      expect(humanizePath("/auth/login-otp")).toBe("ورود با پیامک (OTP)");
    });

    it("translates categorized shop paths with heuristics", () => {
      expect(humanizePath("/shop/c/hair-clip")).toBe("دسته‌بندی: hair clip");
    });

    it("prefers custom project map overrides", () => {
      const custom = {
        "/shop/c/hair-clip": "دسته‌بندی کلیپس مو",
      };
      expect(humanizePath("/shop/c/hair-clip", custom)).toBe("دسته‌بندی کلیپس مو");
    });
  });

  describe("UTM Humanization", () => {
    it("translates UTM sources", () => {
      expect(humanizeUtmSource("instagram")).toBe("اینستاگرام");
      expect(humanizeUtmSource("Torob")).toBe("موتور ترب");
      expect(humanizeUtmSource("telegram")).toBe("تلگرام");
      expect(humanizeUtmSource("googleads")).toBe("تبلیغات گوگل (گوگل ادز)");
    });

    it("translates UTM content dimensions", () => {
      expect(humanizeUtmContent("bio")).toBe("لینک بیو");
      expect(humanizeUtmContent("story")).toBe("استوری‌ها");
      expect(humanizeUtmContent("post")).toBe("پست‌ها");
    });
  });
});
