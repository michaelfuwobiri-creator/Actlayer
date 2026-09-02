// Generates the actual fix content sold behind the paid unlock. These are
// deliberately real, drop-in-able snippets -- not vague advice -- reusing
// the same language/approach built and shipped for gysm.io's own EU AI
// Act + GDPR remediation (cookie consent banner, AI disclosure copy,
// machine-readable marking), genericized with a {{SITE_NAME}} placeholder
// instead of being GYSM-specific.

export type Fix = {
  checkId: string;
  title: string;
  format: "component" | "snippet" | "copy";
  content: string;
};

const FIXES: Record<string, (siteName: string) => Fix> = {
  cookie_banner_present: (siteName) => ({
    checkId: "cookie_banner_present",
    title: "Drop-in cookie/analytics consent banner (React)",
    format: "component",
    content: `"use client";
import { useEffect, useState } from "react";

// GDPR/ePrivacy require opt-in, granular consent before anything
// non-essential runs. Drop this component in your root layout, and gate
// any analytics/ad script behind readConsent()?.analytics === true.
export const CONSENT_KEY = "${siteName}_cookie_consent";

export function readConsent(): { analytics: boolean } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readConsent() !== null) return;
    const gpc = (navigator as any).globalPrivacyControl === true;
    if (gpc) {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: false }));
      return;
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = (analytics: boolean) => {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics }));
    setVisible(false);
  };

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: 16, background: "#fff", borderTop: "1px solid #ddd", zIndex: 100 }}>
      <p style={{ fontSize: 13, marginBottom: 8 }}>
        We use cookies for optional analytics. Necessary storage is always on.
      </p>
      <button onClick={() => accept(true)}>Accept all</button>{" "}
      <button onClick={() => accept(false)}>Reject non-essential</button>
    </div>
  );
}`,
  }),
  ai_disclosure_visible: (siteName) => ({
    checkId: "ai_disclosure_visible",
    title: "AI disclosure copy",
    format: "copy",
    content: `Add this near any AI-generated content or AI chat interface on ${siteName}:

"You're interacting with ${siteName}'s AI -- responses and content here are AI-generated, not written or reviewed by a human before you see them."

For AI-generated pages/documents specifically, a short visible footer label works well:
"AI-generated with ${siteName}" (with a tooltip/title attribute spelling out the full sentence above for accessibility).`,
  }),
  ai_machine_marking: (siteName) => ({
    checkId: "ai_machine_marking",
    title: "Machine-readable AI-generated meta tag",
    format: "snippet",
    content: `// Inject into the <head> of any AI-generated document before serving it.
// Satisfies EU AI Act Art. 50(2)'s machine-readable marking requirement
// (existing generative systems have until Dec 2, 2026 to add this).
export function injectAiGeneratedMeta(html: string): string {
  const tags = '<meta name="ai-generated" content="true"><meta name="generator" content="${siteName}">';
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => m + tags);
  }
  return tags + html;
}`,
  }),
  chat_widget_ai_disclosure: (siteName) => ({
    checkId: "chat_widget_ai_disclosure",
    title: "Chat widget AI disclosure",
    format: "copy",
    content: `Add as the first message in your chat widget, before any user input is processed:

"You're chatting with ${siteName}'s AI, not a human."

If a human sometimes takes over the same chat thread, disclose the handoff too -- Art. 50 requires clarity about when AI vs. a person is responding.`,
  }),
  privacy_policy_exists: (siteName) => ({
    checkId: "privacy_policy_exists",
    title: "Privacy policy starting template",
    format: "copy",
    content: `${siteName} ("we," "us") explains what data we collect, why, and how you can control it.

Information we collect: account info, usage data, and standard web logs (IP, browser type).
How we use it: to operate the service, keep it secure, and improve it. We do not sell personal data.
Who we share it with: the service providers that power ${siteName} (hosting, payments, and any AI providers -- name them specifically once you have them).
Your rights: access, correct, delete, or export your data; EU/UK residents have GDPR rights, California residents have CCPA/CPRA rights.
Contact: [privacy contact email].

This is a starting skeleton -- have a lawyer review before publishing, especially once you know your exact vendor list and user base.`,
  }),
  privacy_names_ai_subprocessors: (siteName) => ({
    checkId: "privacy_names_ai_subprocessors",
    title: "AI sub-processor disclosure paragraph",
    format: "copy",
    content: `Add to your privacy policy:

"When you use ${siteName}'s AI features, relevant data is sent to [OpenAI / Anthropic / Google / etc. -- name your actual providers] to generate a response. Each provider processes that data under its own commercial API terms, which typically exclude using API inputs/outputs to train their models (unlike free consumer AI products) -- confirm this with each provider's current terms."`,
  }),
  privacy_has_rights_section: () => ({
    checkId: "privacy_has_rights_section",
    title: "GDPR/CCPA rights section",
    format: "copy",
    content: `Add to your privacy policy:

"Depending on where you live, you may have the right to access, correct, delete, or export your personal data. EU/UK/EEA residents can exercise rights under the GDPR, including lodging a complaint with a data protection authority. California residents have equivalent rights under the CCPA/CPRA. To exercise these rights, contact [email] -- we'll verify your request and respond within the time required by law."`,
  }),
  privacy_last_updated_fresh: () => ({
    checkId: "privacy_last_updated_fresh",
    title: "Add a maintained \"last updated\" date",
    format: "copy",
    content: `Add a visible "Last updated [date]" line at the top of your privacy policy, and update it every time the policy content changes -- not just on a schedule. This is what lets visitors (and regulators) judge how current it is.`,
  }),
  privacy_mentions_cookies: () => ({
    checkId: "privacy_mentions_cookies",
    title: "Cookies/analytics section",
    format: "copy",
    content: `Add to your privacy policy:

"We use [cookieless analytics tool / cookies] for basic product analytics. Non-essential storage only runs after you've made an explicit choice via our cookie banner; you can change that choice anytime from [location]."`,
  }),
  privacy_contact_present: () => ({
    checkId: "privacy_contact_present",
    title: "Privacy contact line",
    format: "copy",
    content: `Add a clear contact line to your privacy policy: "Questions about this policy or your data can be sent to privacy@[yourdomain]."`,
  }),
  international_transfer_language: () => ({
    checkId: "international_transfer_language",
    title: "International transfer paragraph",
    format: "copy",
    content: `Add to your privacy policy:

"If you're accessing our service from the EEA, UK, or Switzerland, your data may be transferred to and processed in other countries. Our providers rely on recognized transfer mechanisms (such as the EU-U.S. Data Privacy Framework or Standard Contractual Clauses) to do so."`,
  }),
  cookie_consent_granular: (siteName) => ({
    checkId: "cookie_consent_granular",
    title: "Make consent granular",
    format: "copy",
    content: `Update your banner to offer at least three actions, not just one: "Accept all", "Reject non-essential", and "Customize" (per-category toggles). A single "OK"/"Accept" button isn't valid consent under GDPR guidance. See the drop-in ${siteName} component from the cookie-banner fix above -- it already includes reject/customize.`,
  }),
  analytics_before_consent: () => ({
    checkId: "analytics_before_consent",
    title: "Gate analytics behind consent",
    format: "snippet",
    content: `// Wrap any analytics/ad script mount so it only renders after opt-in.
// Example for a React analytics component:
import { useEffect, useState } from "react";
import { readConsent, CONSENT_KEY } from "./CookieConsent"; // from the cookie-banner fix

export default function AnalyticsGate({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(!!readConsent()?.analytics);
  }, []);
  if (!on) return null;
  return <>{children}</>;
}`,
  }),
};

export function getFix(checkId: string, siteName: string): Fix | null {
  const builder = FIXES[checkId];
  if (!builder) return null;
  return builder(siteName);
}
