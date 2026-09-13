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

## Next.js install

Copy the kit in [examples/nextjs-plugin](examples/nextjs-plugin): env vars, `lib/check-contact-spam.ts`, and `components/SpamBlockedModal.tsx`. The site’s existing form and contact route stay; you only add a check before send and a modal on the client.

Same `SPAM_CHECKER_API_KEY` on every site. `SPAM_CHECKER_WEBSITE` is what shows up in the blocked log.

## Later (not V1)

Per-site API keys, extra block categories (e.g. job enquiries), and an admin UI.
