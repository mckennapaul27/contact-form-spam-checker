# Contact form spam checker

Express microservice that Next.js contact forms call before sending an enquiry. It asks an LLM (Vercel AI SDK via AI Gateway) whether the message is an unsolicited marketing, SEO/backlink, or web design pitch. Blocked copies are stored in MongoDB.

V1 uses one shared API key. `website` on each request is what distinguishes client sites in the log.

## Run locally

Requires Node 22+.

```bash
cp .env.example .env
# fill API_KEY, MONGODB_URI, AI_GATEWAY_API_KEY
npm install
npm run dev
```

- `npm run build` / `npm start` for production
- `GET /health` is unauthenticated and returns `{ ok: true }`

## Environment (this service)

| Variable | Required | Notes |
| --- | --- | --- |
| `API_KEY` | yes | Shared bearer token every client site uses |
| `MONGODB_URI` | yes | Atlas or local Mongo |
| `AI_GATEWAY_API_KEY` | yes | Vercel AI Gateway key (read automatically by the AI SDK) |
| `AI_MODEL` | no | Defaults to `openai/gpt-4.1-mini` |
| `PORT` | no | Defaults to `3000` |
| `RATE_LIMIT_PER_WEBSITE` | no | Max `/v1/check` calls per website per window. Defaults to `30` |
| `RATE_LIMIT_WINDOW_MS` | no | Rate-limit window in ms. Defaults to `60000` (1 minute) |

## HTTP contract

All `/v1/*` routes need `Authorization: Bearer <API_KEY>`.

### `POST /v1/check`

```json
{
  "website": "https://client.co.uk",
  "message": "Hi, can you fix my boiler?",
  "name": "James",
  "email": "james@example.com",
  "phone": "07700 900123",
  "fields": { "location": "Leeds" }
}
```

`website` and `message` are required. `extraCategories` is accepted and ignored in V1.

Field limits: `website` 200, `name` 200, `email` 254, `phone` 50, `message` 10,000, each extra field key 80 / value 1,000, max 20 extra fields. Oversize values return `400`.

`POST /v1/check` is rate-limited per `website` (default 30 per minute, in memory). Over the limit returns `429` with `Retry-After`. The Next.js helper treats that as not-spam (fail-open). Add a visitor-IP limit on each site's `/api/contact` if you need to stop form flooding.

Always `200` when the request is valid (including fail-open):

```json
{
  "blocked": false,
  "category": null,
  "reason": null
}
```

When blocked:

```json
{
  "blocked": true,
  "category": "seo",
  "reason": "We couldn't accept this message because it looks like an unsolicited SEO or backlink sales pitch. This contact form is for customers of this business, not for agencies offering digital marketing services. If you are looking to hire this company, please rewrite your message to explain what you need help with."
}
```

`reason` is visitor-facing copy for the contact-form UI (2–4 sentences: what was rejected, why, and that the form is for customers). Show it as-is.

When the model is down, the service fails open so real leads are not dropped:

```json
{
  "blocked": false,
  "category": null,
  "reason": null,
  "unavailable": true
}
```

`401` if the key is missing or wrong. `400` if the body fails validation. `429` if that website is over its check limit.

### `GET /v1/blocked?website=&page=1&limit=20`

Newest first. Returns `{ items, page, limit, total }`.

## What gets blocked

Intent, not keywords.

**Blocked:** people offering marketing, lead-gen, SEO, backlinks/guest posts, or web design/redesign to the site owner (including “free website suggestions” and DA/DR lists).

**Allowed:** genuine customers asking for that business’s own services. A shop asking a marketing agency for SEO is a lead. An SEO specialist pitching a plumber is spam.

Only blocked submissions are written to MongoDB.

## Add to a Next.js contact form

The site’s existing form and `/api/contact` route stay. You copy two files, add three env vars, then add a few lines in the route and on the form.

Files to copy from [examples/nextjs-plugin](examples/nextjs-plugin):

| Copy from | Paste into the client site |
| --- | --- |
| `examples/nextjs-plugin/lib/check-contact-spam.ts` | `lib/check-contact-spam.ts` |
| `examples/nextjs-plugin/components/SpamBlockedModal.tsx` | `components/SpamBlockedModal.tsx` |

A full form example (react-hook-form + toast + recaptcha) is in [contact-form.tsx](contact-form.tsx).

### 1. Env on the client site

Add these to Vercel (or `.env.local`). Never expose the API key to the browser — only the contact **route** uses it.

```
SPAM_CHECKER_URL=https://bunker-spam-checker-0d34055e5302.herokuapp.com
SPAM_CHECKER_API_KEY=
SPAM_CHECKER_WEBSITE=https://this-client-site.co.uk
```

- Same `SPAM_CHECKER_API_KEY` on every site (the shared `API_KEY` from this service).
- `SPAM_CHECKER_WEBSITE` is **this** site’s public URL. That is what appears in the blocked log.
- Redeploy after adding env vars.

### 2. Contact API route (server)

In `app/api/contact/route.ts` (or whichever route the form posts to), call the checker **after** you have parsed `name` / `email` / `phone` / `message`, and **before** email or CRM.

```ts
import { blockedResponse, checkContactSpam } from "@/lib/check-contact-spam";

export async function POST(request: Request) {
  const { name, email, phone, message } = await request.json();

  // existing validation / recaptcha stays here

  const check = await checkContactSpam({ name, email, phone, message });
  if (check.blocked) return blockedResponse(check.reason);

  // existing email / CRM send continues here
  return Response.json({ ok: true });
}
```

`blockedResponse` returns HTTP 400 with `{ ok: false, blocked: true, reason }`. The form modal reads `reason`.

If the checker is down or rate-limited, `checkContactSpam` fail-opens (`blocked: false`) so real enquiries still send.

### 3. Contact form (client)

In the form component that `fetch`es `/api/contact`:

```tsx
import {
  showIfBlocked,
  SpamBlockedModal,
  useSpamBlockedModal,
} from "@/components/SpamBlockedModal";

export default function ContactForm() {
  const blocked = useSpamBlockedModal();

  async function onSubmit(values) {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await res.json();
    if (showIfBlocked(data, blocked.show)) return;

    if (!res.ok) {
      // existing error handling (toast, etc.)
      return;
    }

    // existing success handling
  }

  return (
    <>
      <form onSubmit={/* existing submit */}>{/* existing fields */}</form>
      <SpamBlockedModal
        open={blocked.open}
        message={blocked.message}
        onClose={blocked.close}
      />
    </>
  );
}
```

Check `showIfBlocked` **before** treating `!res.ok` as a generic error. A blocked submission is a 400; without that check the visitor gets a toast instead of the modal.

The modal is self-contained Tailwind (slate / amber). It does not use the site theme, so it looks the same on every install.

### Checklist

1. Copy the two files into the site.
2. Set the three env vars and redeploy.
3. Add the two lines in the contact route before send.
4. Add the hook, `showIfBlocked`, and `<SpamBlockedModal />` on the form.
5. Submit a marketing/SEO pitch — you should see the modal, not a success toast.
6. Submit a real customer message — it should still send as before.

## Later (not V1)

Per-site API keys, extra block categories (e.g. job enquiries), and an admin UI.
