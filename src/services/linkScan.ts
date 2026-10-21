type LinkScanInput = {
  website: string;
  message: string;
  name?: string;
  phone?: string;
  fields?: Record<string, string>;
};

const LINK_BLOCK_REASON =
  "We couldn't accept this message because it includes a link that doesn't look like a genuine customer enquiry. This contact form is for people who want to use this business's services. If that's you, please send a new message describing what you need, without promotional or unusual links.";

const MAX_LINKS = 3;

const SHORTENERS = new Set([
  "bit.ly",
  "bitly.com",
  "t.co",
  "tinyurl.com",
  "tiny.cc",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "cutt.ly",
  "shorturl.at",
  "rb.gy",
  "t.ly",
  "v.gd",
  "bl.ink",
  "clck.ru",
  "soo.gd",
  "bc.vc",
  "adf.ly",
  "adfoc.us",
  "s.id",
  "lnkd.in",
]);

const SUSPICIOUS_TLDS = new Set([
  "xyz",
  "top",
  "click",
  "link",
  "loan",
  "gq",
  "tk",
  "ml",
  "cf",
  "ga",
  "zip",
  "mov",
  "cfd",
  "sbs",
  "cyou",
  "rest",
  "surf",
  "cam",
  "country",
  "stream",
  "download",
  "review",
  "quest",
  "icu",
  "bond",
  "monster",
  "hair",
  "mom",
  "dating",
  "faith",
  "win",
  "party",
  "science",
  "accountant",
  "bid",
  "trade",
  "webcam",
  "cricket",
]);

const ALLOWED_HOST_SUFFIXES = [
  "google.com",
  "google.co.uk",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "whatsapp.com",
  "apple.com",
  "microsoft.com",
  "bing.com",
  "gov.uk",
  "nhs.uk",
  "wikipedia.org",
];

const URL_CANDIDATE =
  /(?:https?:\/\/|hxxps?:\/\/|www\.)[^\s<>"'\]\)]+/gi;
const BARE_IPV4 =
  /(?:^|[\s<(])((?:\d{1,3}\.){3}\d{1,3})(?::\d{2,5})?(?:\/[^\s<>"']*)?/g;

export type LinkScanHit = {
  blocked: true;
  category: "suspicious_link";
  reason: string;
};

export function scanSubmissionLinks(input: LinkScanInput): LinkScanHit | null {
  const text = collectText(input);
  const hosts = extractHosts(text);
  const siteHost = hostFromWebsite(input.website);

  const suspicious = hosts.filter((host) => {
    if (siteHost && (host === siteHost || host.endsWith(`.${siteHost}`))) {
      return false;
    }
    return isAllowedHost(host) ? false : isSuspiciousHost(host);
  });

  if (suspicious.some((host) => isIpHost(host))) {
    return hit();
  }
  if (suspicious.some((host) => isShortener(host))) {
    return hit();
  }
  if (suspicious.some((host) => host.includes("xn--"))) {
    return hit();
  }
  if (suspicious.some((host) => hasSuspiciousTld(host))) {
    return hit();
  }
  if (hosts.filter((host) => !isAllowedHost(host)).length >= MAX_LINKS) {
    return hit();
  }

  return null;
}

function hit(): LinkScanHit {
  return {
    blocked: true,
    category: "suspicious_link",
    reason: LINK_BLOCK_REASON,
  };
}

function collectText(input: LinkScanInput): string {
  const parts = [input.name, input.phone, input.message];
  if (input.fields) {
    parts.push(...Object.values(input.fields));
  }
  return deobfuscate(parts.filter(Boolean).join("\n"));
}

function deobfuscate(text: string): string {
  return text
    .replace(/hxxps/gi, "https")
    .replace(/hxxp/gi, "http")
    .replace(/\[(?:\.|dot)\]|\((?:\.|dot)\)|\{\.\}/gi, ".")
    .replace(/\[:\]/g, ":");
}

function extractHosts(text: string): string[] {
  const hosts = new Set<string>();

  for (const match of text.matchAll(URL_CANDIDATE)) {
    const host = hostFromCandidate(match[0]);
    if (host) hosts.add(host);
  }

  for (const match of text.matchAll(BARE_IPV4)) {
    const ip = match[1];
    if (ip && isValidIpv4(ip)) hosts.add(ip);
  }

  for (const shortener of SHORTENERS) {
    const re = new RegExp(
      `(?:^|[^\\w.-])(?:www\\.)?${escapeRegex(shortener)}(?:/[^\\s<>"']*)?`,
      "gi",
    );
    if (re.test(text)) hosts.add(shortener);
  }

  return [...hosts];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hostFromCandidate(raw: string): string | null {
  const trimmed = raw.replace(/[.,;:!?]+$/, "");
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    const host = url.hostname.replace(/^\[|\]$/g, "").replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

function hostFromWebsite(website: string): string | null {
  return hostFromCandidate(website);
}

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

function isSuspiciousHost(host: string): boolean {
  return (
    isIpHost(host) ||
    isShortener(host) ||
    host.includes("xn--") ||
    hasSuspiciousTld(host)
  );
}

function isShortener(host: string): boolean {
  return [...SHORTENERS].some((s) => host === s || host.endsWith(`.${s}`));
}

function hasSuspiciousTld(host: string): boolean {
  const tld = host.split(".").pop()?.toLowerCase();
  return Boolean(tld && SUSPICIOUS_TLDS.has(tld));
}

function isIpHost(host: string): boolean {
  return isValidIpv4(host) || isIpv6(host);
}

function isValidIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function isIpv6(host: string): boolean {
  return host.includes(":");
}
