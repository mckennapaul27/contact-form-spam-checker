# Next.js plug-in

Copy these three pieces into every client site. The contact form UI can stay as-is.

## 1. Env (Vercel / `.env`)

```
SPAM_CHECKER_URL=https://bunker-spam-checker-0d34055e5302.herokuapp.com
SPAM_CHECKER_API_KEY=
SPAM_CHECKER_WEBSITE=https://this-client-site.co.uk
```

`SPAM_CHECKER_WEBSITE` is this site’s public URL. Same API key on every site.

## 2. Server helper

Copy [`lib/check-contact-spam.ts`](lib/check-contact-spam.ts) to `lib/check-contact-spam.ts`.

In the existing contact route (`app/api/contact/route.ts` or whatever they use), add this **before** email / CRM:

```ts
import { blockedResponse, checkContactSpam } from "@/lib/check-contact-spam";

const check = await checkContactSpam({ name, email, phone, message });
if (check.blocked) return blockedResponse(check.reason);
```

Do not change the rest of the handler. Fail-open: if the checker is down, `blocked` is false and the enquiry still sends.

## 3. Modal

Copy [`components/SpamBlockedModal.tsx`](components/SpamBlockedModal.tsx) to `components/SpamBlockedModal.tsx`.

In the contact form component (client):

```tsx
import {
  showIfBlocked,
  SpamBlockedModal,
  useSpamBlockedModal,
} from "@/components/SpamBlockedModal";

const blocked = useSpamBlockedModal();

// after fetch("/api/contact"):
const data = await res.json();
if (showIfBlocked(data, blocked.show)) return;

// render once on the page:
<SpamBlockedModal
  open={blocked.open}
  message={blocked.message}
  onClose={blocked.close}
/>
```

The modal is self-contained Tailwind (slate / amber). It does not use the site theme, so it looks the same on every install.
