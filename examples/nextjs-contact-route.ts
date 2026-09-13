/**
 * Example only — copy files from examples/nextjs-plugin/ instead.
 *
 * In the existing contact route, before email / CRM:
 *
 *   import { blockedResponse, checkContactSpam } from "@/lib/check-contact-spam";
 *
 *   const check = await checkContactSpam({ name, email, phone, message });
 *   if (check.blocked) return blockedResponse(check.reason);
 */
