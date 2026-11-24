// Messaging layer — dispatch only after HITL approval. Sandbox by default: real prospects are never emailed
// unless DISPATCH_MODE=live. In sandbox, mail is redirected to TEST_INBOX (if set) so the demo sends real email safely.
export const dispatchMode = () => (process.env.DISPATCH_MODE === "live" ? "live" : "sandbox");
export const emailProvider = () => (process.env.RESEND_API_KEY ? "resend" : process.env.SENDGRID_API_KEY ? "sendgrid" : null);

export async function sendEmail({ to, subject, text, tags = {} }) {
  const mode = dispatchMode();
  const provider = emailProvider();
  const target = mode === "live" ? to : process.env.TEST_INBOX || null;
  const from = process.env.FROM_EMAIL || "Gravity <onboarding@resend.dev>";
  if (!provider || !target) {
    return { delivered: false, simulated: true, mode, provider: provider || "none", to: target || to, note: target ? "No email provider key — simulated" : "Sandbox: no TEST_INBOX — simulated send" };
  }
  const body = mode === "sandbox" ? `[Gravity sandbox — intended for ${to}]\n\n${text}` : text;
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [target], subject, text: body, tags: Object.entries(tags).map(([name, value]) => ({ name, value: String(value).replace(/[^a-zA-Z0-9_-]/g, "_") })) }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(j).slice(0, 160)}`);
    return { delivered: true, mode, provider, to: target, id: j.id };
  }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ personalizations: [{ to: [{ email: target }] }], from: { email: from.replace(/.*<|>.*/g, "") }, subject, content: [{ type: "text/plain", value: body }] }),
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}`);
  return { delivered: true, mode, provider, to: target };
}

/** Nexla — stream records into a Nexla webhook data source (lead → CRM/warehouse via Nexla flows). */
export async function pushToNexla(kind, record) {
  const url = process.env.NEXLA_WEBHOOK_URL;
  if (!url) return { pushed: false, reason: "NEXLA_WEBHOOK_URL not set" };
  const headers = { "Content-Type": "application/json" };
  if (process.env.NEXLA_API_KEY) headers.Authorization = `Basic ${process.env.NEXLA_API_KEY}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ kind, source: "gravity-gtm", at: new Date().toISOString(), ...record }) });
  return { pushed: res.ok, status: res.status };
}
