import { describe, it, expect } from "bun:test";
import { escapeHtml, html } from "../../src/lib/html";

describe("HTML Sanitization & Template Tag", () => {
  it("escapes special HTML entities: &, <, >, \"", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert('xss')&lt;/script&gt;");
    expect(escapeHtml("Home & Garden")).toBe("Home &amp; Garden");
    expect(escapeHtml('Title with "quotes"')).toBe("Title with &quot;quotes&quot;");
  });

  it("safely handles null and undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("handles numbers cleanly", () => {
    expect(escapeHtml(1234)).toBe("1234");
  });

  it("interpolates values safely using tagged template literal", () => {
    const maliciousTitle = '<img src=x onerror="alert(1)">';
    const count = 42;
    const result = html`<b>${maliciousTitle}</b>: <code>${count}</code>`;
    expect(result).toBe('<b>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</b>: <code>42</code>');
  });
});
