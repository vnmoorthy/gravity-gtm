// Enrichment waterfall: domain DNS → MX validation → email pattern synthesis → Hunter.io finder/verifier (if keyed).
import dns from "node:dns/promises";

const mxCache = new Map();
export async function checkDomain(domain) {
  if (!domain) return { domain, a: false, mx: [] };
  domain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  if (mxCache.has(domain)) return mxCache.get(domain);
  const out = { domain, a: false, mx: [], provider: null };
  if (domain.endsWith(".example")) { Object.assign(out, { a: true, mx: ["mx1.demo-mail.example"], provider: "Demo MX (illustrative)" }); mxCache.set(domain, out); return out; }
  try { const a = await dns.resolve4(domain); out.a = a.length > 0; } catch { /* none */ }
  try {
    const mx = await dns.resolveMx(domain);
    out.mx = mx.sort((x, y) => x.priority - y.priority).map((m) => m.exchange);
    const m = out.mx.join(" ").toLowerCase();
    out.provider = /google|gmail/.test(m) ? "Google Workspace" : /outlook|microsoft/.test(m) ? "Microsoft 365" : /pphosted|proofpoint/.test(m) ? "Proofpoint" : /mimecast/.test(m) ? "Mimecast" : out.mx.length ? "Custom MX" : null;
  } catch { /* none */ }
  mxCache.set(domain, out);
  return out;
}

function splitName(name = "") {
  const parts = name.replace(/\(.*?\)/g, "").replace(/\b(dr|mr|ms|mrs)\.?\s/gi, "").trim().split(/\s+/);
  const first = (parts[0] || "").toLowerCase().replace(/[^a-z]/g, "");
  const last = (parts[parts.length - 1] || "").toLowerCase().replace(/[^a-z]/g, "");
  return { first, last };
}

export function patterns(name, domain) {
  const { first, last } = splitName(name);
  if (!first || !domain) return [];
  return [
    { email: `${first}.${last}@${domain}`, pattern: "first.last", prior: 0.42 },
    { email: `${first}@${domain}`, pattern: "first", prior: 0.24 },
    { email: `${first[0]}${last}@${domain}`, pattern: "flast", prior: 0.18 },
    { email: `${first}${last}@${domain}`, pattern: "firstlast", prior: 0.08 },
  ].filter((p) => last || p.pattern === "first");
}

async function hunter(path, params) {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;
  const q = new URLSearchParams({ ...params, api_key: key });
  const res = await fetch(`https://api.hunter.io/v2/${path}?${q}`);
  if (!res.ok) throw new Error(`Hunter ${path} ${res.status}`);
  return (await res.json()).data;
}

export async function enrichPerson(person, account) {
  const steps = [];
  const domain = (account?.domain || "").replace(/^www\./, "");
  const d = await checkDomain(domain);
  steps.push({ step: "domain", ok: d.a || d.mx.length > 0, detail: d.a ? `A record resolves for ${d.domain}` : `No A record for ${d.domain}` });
  steps.push({ step: "mx", ok: d.mx.length > 0, detail: d.mx.length ? `MX → ${d.mx[0]} (${d.provider})` : "No MX records — mail undeliverable" });

  let email = null, status = "unknown", confidence = 0, provider = "pattern";
  const { first, last } = splitName(person.name);
  if (process.env.HUNTER_API_KEY && first && domain) {
    try {
      const f = await hunter("email-finder", { domain, first_name: first, last_name: last });
      if (f?.email) {
        email = f.email; confidence = (f.score || 70) / 100; provider = "hunter.io";
        status = f.verification?.status === "valid" ? "verified" : confidence > 0.8 ? "verified" : "likely";
        steps.push({ step: "hunter", ok: true, detail: `Hunter finder score ${f.score}` });
      } else steps.push({ step: "hunter", ok: false, detail: "Hunter: no match" });
    } catch (e) { steps.push({ step: "hunter", ok: false, detail: e.message }); }
  }
  if (!email) {
    const cands = patterns(person.name, domain);
    if (cands.length) {
      const best = cands[0];
      email = best.email;
      provider = "pattern+mx";
      confidence = d.mx.length ? Math.min(0.78, best.prior + 0.33) : 0.15;
      status = d.mx.length ? "likely" : "invalid";
      steps.push({ step: "pattern", ok: Boolean(d.mx.length), detail: `${best.pattern} pattern (${cands.length} candidates)`, candidates: cands.map((c) => c.email) });
    }
  }
  const linkedin = person.linkedin && /linkedin\.com\/in\//.test(person.linkedin)
    ? { url: person.linkedin, status: "verified" }
    : { url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${person.name} ${account?.name || ""}`)}`, status: "search" };
  steps.push({ step: "linkedin", ok: linkedin.status === "verified", detail: linkedin.status === "verified" ? "Profile URL found in public source" : "Resolved to LinkedIn people search" });

  return {
    email, email_status: status, email_confidence: Math.round(confidence * 100) / 100, email_provider: provider,
    mx: d.mx, mail_provider: d.provider, domain_ok: d.a || d.mx.length > 0,
    linkedin: linkedin.url, linkedin_status: linkedin.status,
    hq: account?.hq, steps, enrichedAt: new Date().toISOString(),
  };
}
