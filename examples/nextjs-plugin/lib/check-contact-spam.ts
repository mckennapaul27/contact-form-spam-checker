/**
 * Server-only. Copy to `lib/check-contact-spam.ts` on the client site.
 * Call this from the existing contact API route before sending email / CRM.
 */

export type ContactSpamInput = {
  name?: string;
  email?: string;
  phone?: string;
  message: string;
  fields?: Record<string, string>;
};

export type ContactSpamResult = {
  blocked: boolean;
  reason: string | null;
};

export async function checkContactSpam(
  input: ContactSpamInput,
): Promise<ContactSpamResult> {
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
    return (await res.json()) as ContactSpamResult;
  } catch {
    return { blocked: false, reason: null };
  }
}

/** Return this JSON from the contact route when the checker blocks the message. */
export function blockedResponse(reason: string | null) {
  return Response.json(
    {
      ok: false,
      blocked: true,
      reason: reason ?? "We couldn't accept this message.",
    },
    { status: 400 },
  );
}
