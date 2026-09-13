/**
 * Drop-in helper for a Next.js App Router contact route.
 *
 * 1. Copy `isSpamSubmission` into `app/api/contact/route.ts`
 * 2. Add env vars on the client site (Vercel):
 *    SPAM_CHECKER_URL=https://your-checker.example.com
 *    SPAM_CHECKER_API_KEY=the-shared-key
 *    SPAM_CHECKER_WEBSITE=https://this-client-site.co.uk
 * 3. Call it before your existing email / CRM send.
 *
 * Fail-open: if the checker is down, the enquiry still goes through.
 */

type ContactInput = {
  name?: string;
  email?: string;
  phone?: string;
  message: string;
};

type SpamCheckResult = {
  blocked: boolean;
  reason: string | null;
};

export async function isSpamSubmission(
  input: ContactInput,
): Promise<SpamCheckResult> {
  try {
    const res = await fetch(`${process.env.SPAM_CHECKER_URL}/v1/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SPAM_CHECKER_API_KEY}`,
      },
      body: JSON.stringify({
        website: process.env.SPAM_CHECKER_WEBSITE,
        ...input,
      }),
    });

    if (!res.ok) return { blocked: false, reason: null };
    return (await res.json()) as SpamCheckResult;
  } catch {
    return { blocked: false, reason: null };
  }
}

export async function POST(request: Request) {
  const { name, email, phone, message } = (await request.json()) as ContactInput;

  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const check = await isSpamSubmission({ name, email, phone, message });
  if (check.blocked) {
    // `reason` is visitor-facing copy — show it on the form
    return Response.json(
      { error: check.reason ?? "Submission rejected" },
      { status: 400 },
    );
  }

  // Existing email / CRM send continues here.
  return Response.json({ ok: true });
}
