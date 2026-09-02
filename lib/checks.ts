// ActLayer's scan engine. Static-HTML-only for v1 (no headless browser) --
// fetches the target page and its privacy policy as plain HTML/text and
// runs heuristic checks against them. This deliberately does NOT try to
// verify runtime behavior (e.g. "does this script actually wait for
// consent before firing") -- that needs a real browser and is fast-follow
// work, not v1. Where a check can't be verified statically with
// confidence, it returns "review" rather than guessing pass/fail --
// false accusations of non-compliance are worse than an honest "can't
// tell from source alone."

export type CheckStatus = "pass" | "warn" | "fail" | "review" | "na";

export type CheckResult = {
  id: string;
  category: "Cookies & tracking" | "AI disclosure" | "Privacy policy";
  title: string;
  status: CheckStatus;
  detail: string;
  /** Only present when status is "fail" or "warn" -- this is the thing
   *  the paid unlock actually sells. */
  fixAvailable: boolean;
};

export type ScanResult = {
  url: string;
  privacyUrl: string | null;
  isAiProduct: boolean;
  findings: CheckResult[];
  score: number;
};

const FETCH_TIMEOUT_MS = 8000;
const UA = "ActLayerBot/0.1 (+https://actlayer.eu) compliance scanner";

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function findPrivacyLink(homepageHtml: string, baseUrl: string): string | null {
  const hrefRe = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(homepageHtml))) {
    const href = match[1];
    if (/privacy/i.test(href)) {
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        continue;
      }
    }
  }
  return null;
}

const AI_CONTEXT_RE = /\b(AI[- ]generated|artificial intelligence|generative ai|large language model|\bGPT\b|\bLLM\b|machine learning model|powered by ai|ai assistant|ai agent|ai-powered|no-code ai|ai app builder)\b/i;

function detectIsAiProduct(homepageHtml: string): boolean {
  const matches = homepageHtml.match(new RegExp(AI_CONTEXT_RE, "gi"));
  return !!matches && matches.length >= 1;
}

const CMP_SCRIPT_RE = /(cookiebot\.com|onetrust\.com|OptanonConsent|osano\.com|termly\.io|cookieconsent|cookie-consent|cc-banner|cmp-banner|gdpr-consent)/i;
const GENERIC_COOKIE_BANNER_RE = /cookie[^.]{0,80}(consent|accept|banner)/i;

function checkCookieBannerPresent(html: string): CheckResult {
  const hasCmp = CMP_SCRIPT_RE.test(html);
  const hasGeneric = GENERIC_COOKIE_BANNER_RE.test(html);
  if (hasCmp || hasGeneric) {
    return {
      id: "cookie_banner_present",
      category: "Cookies & tracking",
      title: "Cookie/consent banner present",
      status: "pass",
      detail: hasCmp
        ? "Detected a known consent management script."
        : "Detected cookie-consent-related markup on the page.",
      fixAvailable: false,
    };
  }
  return {
    id: "cookie_banner_present",
    category: "Cookies & tracking",
    title: "Cookie/consent banner present",
    status: "fail",
    detail: "No cookie or consent banner detected. Under GDPR/ePrivacy, any non-essential cookie or tracking script needs opt-in consent before it runs.",
    fixAvailable: true,
  };
}

function checkGranularConsent(html: string): CheckResult {
  const hasCmp = CMP_SCRIPT_RE.test(html);
  if (!GENERIC_COOKIE_BANNER_RE.test(html) && !hasCmp) {
    return {
      id: "cookie_consent_granular",
      category: "Cookies & tracking",
      title: "Consent is granular (not just \"Accept all\")",
      status: "na",
      detail: "No banner detected to evaluate -- see the previous check.",
      fixAvailable: false,
    };
  }
  const hasRejectOption = /reject|decline|manage preferences|customi[sz]e|necessary only/i.test(html);
  if (hasCmp && hasRejectOption) {
    return {
      id: "cookie_consent_granular",
      category: "Cookies & tracking",
      title: "Consent is granular (not just \"Accept all\")",
      status: "pass",
      detail: "A known consent manager plus reject/customize language were both found.",
      fixAvailable: false,
    };
  }
  return {
    id: "cookie_consent_granular",
    category: "Cookies & tracking",
    title: "Consent is granular (not just \"Accept all\")",
    status: "review",
    detail: "A banner was detected but this can't be confirmed as granular from the page source alone -- check it by hand, or open it in a browser and look for a reject/customize option next to \"Accept all.\"",
    fixAvailable: true,
  };
}

const TRACKER_RE = /(googletagmanager\.com\/gtag|google-analytics\.com|connect\.facebook\.net|posthog\.com|plausible\.io|hotjar\.com|mixpanel\.com)/gi;

function checkAnalyticsGating(html: string): CheckResult {
  const trackers = html.match(TRACKER_RE);
  if (!trackers || trackers.length === 0) {
    return {
      id: "analytics_before_consent",
      category: "Cookies & tracking",
      title: "Analytics/ad scripts gated behind consent",
      status: "na",
      detail: "No common analytics or ad-tracking scripts detected in the page source.",
      fixAvailable: false,
    };
  }
  return {
    id: "analytics_before_consent",
    category: "Cookies & tracking",
    title: "Analytics/ad scripts gated behind consent",
    status: "review",
    detail: `Found tracking script(s) (${Array.from(new Set(trackers)).join(", ")}) in the page source. A static scan can't confirm whether these actually wait for consent before firing -- verify in a browser with dev tools open, or use the fix to gate them explicitly.`,
    fixAvailable: true,
  };
}

const AI_DISCLOSURE_RE = /(ai[- ]generated|generated by ai|you'?re (chatting|talking) with (an? )?ai|you are (chatting|talking) with (an? )?ai|this (content|app|page) was (created|generated) by ai)/i;

function checkAiDisclosureVisible(html: string, isAiProduct: boolean): CheckResult {
  if (!isAiProduct) {
    return {
      id: "ai_disclosure_visible",
      category: "AI disclosure",
      title: "Visible AI-generated content disclosure",
      status: "na",
      detail: "No clear AI-product signals detected on this page -- EU AI Act Art. 50 transparency rules apply to AI systems specifically.",
      fixAvailable: false,
    };
  }
  if (AI_DISCLOSURE_RE.test(html)) {
    return {
      id: "ai_disclosure_visible",
      category: "AI disclosure",
      title: "Visible AI-generated content disclosure",
      status: "pass",
      detail: "Found explicit AI-disclosure language on the page.",
      fixAvailable: false,
    };
  }
  return {
    id: "ai_disclosure_visible",
    category: "AI disclosure",
    title: "Visible AI-generated content disclosure",
    status: "fail",
    detail: "This looks like an AI product, but no visible disclosure telling users they're interacting with or viewing AI-generated content was found. Required under EU AI Act Art. 50 for AI systems and AI-generated content shown to third parties.",
    fixAvailable: true,
  };
}

function checkMachineReadableMarking(html: string, isAiProduct: boolean): CheckResult {
  if (!isAiProduct) {
    return {
      id: "ai_machine_marking",
      category: "AI disclosure",
      title: "Machine-readable AI-generated marking",
      status: "na",
      detail: "No clear AI-product signals detected on this page.",
      fixAvailable: false,
    };
  }
  const hasMeta = /<meta[^>]+name=["']ai-generated["']/i.test(html);
  if (hasMeta) {
    return {
      id: "ai_machine_marking",
      category: "AI disclosure",
      title: "Machine-readable AI-generated marking",
      status: "pass",
      detail: "Found a machine-readable ai-generated meta tag.",
      fixAvailable: false,
    };
  }
  return {
    id: "ai_machine_marking",
    category: "AI disclosure",
    title: "Machine-readable AI-generated marking",
    status: "fail",
    detail: "No machine-readable marker (e.g. a <meta name=\"ai-generated\"> tag) found. EU AI Act Art. 50(2) requires generative AI output to be detectable as artificially generated in a machine-readable format -- existing systems have until December 2, 2026 to add this.",
    fixAvailable: true,
  };
}

const CHAT_WIDGET_RE = /(intercom\.io|drift\.com|crisp\.chat|tawk\.to|chat-widget|chatbot-widget)/i;

function checkChatWidgetDisclosure(html: string): CheckResult {
  if (!CHAT_WIDGET_RE.test(html)) {
    return {
      id: "chat_widget_ai_disclosure",
      category: "AI disclosure",
      title: "Chat widget discloses it's AI",
      status: "na",
      detail: "No chat widget detected on this page.",
      fixAvailable: false,
    };
  }
  if (AI_DISCLOSURE_RE.test(html)) {
    return {
      id: "chat_widget_ai_disclosure",
      category: "AI disclosure",
      title: "Chat widget discloses it's AI",
      status: "pass",
      detail: "A chat widget was found alongside AI-disclosure language.",
      fixAvailable: false,
    };
  }
  return {
    id: "chat_widget_ai_disclosure",
    category: "AI disclosure",
    title: "Chat widget discloses it's AI",
    status: "warn",
    detail: "A chat widget was detected with no nearby language confirming whether it's an AI or a human -- if it's AI-driven, Art. 50 requires disclosing that at the start of the conversation.",
    fixAvailable: true,
  };
}

function checkPrivacyPolicyExists(privacyText: string | null): CheckResult {
  if (privacyText) {
    return {
      id: "privacy_policy_exists",
      category: "Privacy policy",
      title: "Privacy policy exists",
      status: "pass",
      detail: "Found and fetched a privacy policy page.",
      fixAvailable: false,
    };
  }
  return {
    id: "privacy_policy_exists",
    category: "Privacy policy",
    title: "Privacy policy exists",
    status: "fail",
    detail: "No privacy policy could be found (checked page links and common paths like /privacy). This is a baseline legal requirement, not just an AI Act one.",
    fixAvailable: true,
  };
}

const AI_VENDOR_RE = /(OpenAI|Anthropic|Claude|Google Gemini|Cohere|Mistral AI)/i;

function checkPrivacyNamesAiVendors(privacyText: string | null, isAiProduct: boolean): CheckResult {
  if (!isAiProduct) {
    return {
      id: "privacy_names_ai_subprocessors",
      category: "Privacy policy",
      title: "Privacy policy names AI sub-processors",
      status: "na",
      detail: "No clear AI-product signals detected on this page.",
      fixAvailable: false,
    };
  }
  if (!privacyText) {
    return {
      id: "privacy_names_ai_subprocessors",
      category: "Privacy policy",
      title: "Privacy policy names AI sub-processors",
      status: "fail",
      detail: "No privacy policy found to check.",
      fixAvailable: true,
    };
  }
  if (AI_VENDOR_RE.test(privacyText)) {
    return {
      id: "privacy_names_ai_subprocessors",
      category: "Privacy policy",
      title: "Privacy policy names AI sub-processors",
      status: "pass",
      detail: "The privacy policy names at least one AI provider.",
      fixAvailable: false,
    };
  }
  return {
    id: "privacy_names_ai_subprocessors",
    category: "Privacy policy",
    title: "Privacy policy names AI sub-processors",
    status: "warn",
    detail: "This looks like an AI product, but its privacy policy doesn't appear to name which AI model providers process user data. GDPR transparency expects sub-processors to be identified.",
    fixAvailable: true,
  };
}

function checkPrivacyRightsSection(privacyText: string | null): CheckResult {
  if (!privacyText) {
    return {
      id: "privacy_has_rights_section",
      category: "Privacy policy",
      title: "GDPR/CCPA rights section",
      status: "fail",
      detail: "No privacy policy found to check.",
      fixAvailable: true,
    };
  }
  const hasRights = /(right to access|right to delete|right to erasure|GDPR|CCPA|CPRA|data subject)/i.test(privacyText);
  return {
    id: "privacy_has_rights_section",
    category: "Privacy policy",
    title: "GDPR/CCPA rights section",
    status: hasRights ? "pass" : "warn",
    detail: hasRights
      ? "Found language referencing user data rights and/or GDPR/CCPA."
      : "No language found describing user rights (access, deletion, etc.) or referencing GDPR/CCPA by name.",
    fixAvailable: !hasRights,
  };
}

function checkPrivacyFreshness(privacyText: string | null): CheckResult {
  if (!privacyText) {
    return {
      id: "privacy_last_updated_fresh",
      category: "Privacy policy",
      title: "Privacy policy has a recent \"last updated\" date",
      status: "fail",
      detail: "No privacy policy found to check.",
      fixAvailable: true,
    };
  }
  const dateMatch = privacyText.match(/last updated[:\s]*([A-Za-z]+ \d{1,2},? \d{4})/i);
  if (!dateMatch) {
    return {
      id: "privacy_last_updated_fresh",
      category: "Privacy policy",
      title: "Privacy policy has a recent \"last updated\" date",
      status: "warn",
      detail: "No \"last updated\" date found -- readers (and regulators) can't tell how current the policy is.",
      fixAvailable: true,
    };
  }
  const parsed = new Date(dateMatch[1]);
  if (isNaN(parsed.getTime())) {
    return {
      id: "privacy_last_updated_fresh",
      category: "Privacy policy",
      title: "Privacy policy has a recent \"last updated\" date",
      status: "review",
      detail: `Found a date-like string ("${dateMatch[1]}") that couldn't be parsed automatically -- check it by hand.`,
      fixAvailable: false,
    };
  }
  const monthsOld = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const stale = monthsOld > 12;
  return {
    id: "privacy_last_updated_fresh",
    category: "Privacy policy",
    title: "Privacy policy has a recent \"last updated\" date",
    status: stale ? "warn" : "pass",
    detail: stale
      ? `Last updated ${dateMatch[1]}, over a year ago -- worth a refresh given how much AI/privacy law has changed recently.`
      : `Last updated ${dateMatch[1]}.`,
    fixAvailable: stale,
  };
}

function checkPrivacyMentionsCookies(privacyText: string | null): CheckResult {
  if (!privacyText) {
    return {
      id: "privacy_mentions_cookies",
      category: "Privacy policy",
      title: "Privacy policy covers cookies/analytics",
      status: "fail",
      detail: "No privacy policy found to check.",
      fixAvailable: true,
    };
  }
  const mentions = /cookie|analytics|tracking/i.test(privacyText);
  return {
    id: "privacy_mentions_cookies",
    category: "Privacy policy",
    title: "Privacy policy covers cookies/analytics",
    status: mentions ? "pass" : "warn",
    detail: mentions
      ? "The privacy policy discusses cookies/tracking."
      : "No mention of cookies, analytics, or tracking found in the privacy policy.",
    fixAvailable: !mentions,
  };
}

function checkPrivacyContact(privacyText: string | null): CheckResult {
  if (!privacyText) {
    return {
      id: "privacy_contact_present",
      category: "Privacy policy",
      title: "Contact method for privacy requests",
      status: "fail",
      detail: "No privacy policy found to check.",
      fixAvailable: true,
    };
  }
  const hasContact = /mailto:|contact (us|via)|privacy@|support@|dpo@/i.test(privacyText);
  return {
    id: "privacy_contact_present",
    category: "Privacy policy",
    title: "Contact method for privacy requests",
    status: hasContact ? "pass" : "warn",
    detail: hasContact
      ? "Found a contact method for privacy/data requests."
      : "No clear email or contact method found for exercising privacy rights.",
    fixAvailable: !hasContact,
  };
}

function checkInternationalTransfers(html: string, privacyText: string | null, isAiProduct: boolean): CheckResult {
  const euSignals = /(EUR|€|hreflang=["']de|hreflang=["']fr|hreflang=["']es|GDPR)/i.test(html + " " + (privacyText || ""));
  if (!euSignals) {
    return {
      id: "international_transfer_language",
      category: "Privacy policy",
      title: "International data transfer language",
      status: "na",
      detail: "No clear EU-facing signals detected on this page.",
      fixAvailable: false,
    };
  }
  const hasLanguage = /(standard contractual clauses|data privacy framework|international transfer)/i.test(privacyText || "");
  return {
    id: "international_transfer_language",
    category: "Privacy policy",
    title: "International data transfer language",
    status: hasLanguage ? "pass" : "warn",
    detail: hasLanguage
      ? "Found language addressing international data transfers."
      : "This site shows EU-facing signals but its privacy policy doesn't appear to address international data transfers (e.g. Standard Contractual Clauses or the EU-U.S. Data Privacy Framework).",
    fixAvailable: !hasLanguage,
  };
}

function scoreOf(findings: CheckResult[]): number {
  const scored = findings.filter((f) => f.status !== "na");
  if (scored.length === 0) return 100;
  const points = scored.reduce((sum, f) => {
    if (f.status === "pass") return sum + 1;
    if (f.status === "review") return sum + 0.5;
    if (f.status === "warn") return sum + 0.3;
    return sum; // fail
  }, 0);
  return Math.round((points / scored.length) * 100);
}

export async function runScan(rawUrl: string): Promise<ScanResult> {
  const url = normalizeUrl(rawUrl);
  const homepageHtml = await fetchText(url);
  if (homepageHtml === null) {
    throw new Error(`Couldn't fetch ${url}. Check the URL is correct and the site is publicly reachable.`);
  }

  const isAiProduct = detectIsAiProduct(homepageHtml);

  let privacyUrl = findPrivacyLink(homepageHtml, url);
  let privacyText: string | null = null;
  if (privacyUrl) {
    privacyText = await fetchText(privacyUrl);
  }
  if (!privacyText) {
    for (const path of ["/privacy", "/privacy-policy", "/legal/privacy"]) {
      const candidate = new URL(path, url).toString();
      const text = await fetchText(candidate);
      if (text) {
        privacyText = text;
        privacyUrl = candidate;
        break;
      }
    }
  }

  const findings: CheckResult[] = [
    checkCookieBannerPresent(homepageHtml),
    checkGranularConsent(homepageHtml),
    checkAnalyticsGating(homepageHtml),
    checkAiDisclosureVisible(homepageHtml, isAiProduct),
    checkMachineReadableMarking(homepageHtml, isAiProduct),
    checkChatWidgetDisclosure(homepageHtml),
    checkPrivacyPolicyExists(privacyText),
    checkPrivacyNamesAiVendors(privacyText, isAiProduct),
    checkPrivacyRightsSection(privacyText),
    checkPrivacyFreshness(privacyText),
    checkPrivacyMentionsCookies(privacyText),
    checkPrivacyContact(privacyText),
    checkInternationalTransfers(homepageHtml, privacyText, isAiProduct),
  ];

  return {
    url,
    privacyUrl,
    isAiProduct,
    findings,
    score: scoreOf(findings),
  };
}
