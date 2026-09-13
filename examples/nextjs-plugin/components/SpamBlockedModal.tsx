// "use client";

// import { useCallback, useEffect, useId, useState } from "react";

// export function useSpamBlockedModal() {
//   const [open, setOpen] = useState(false);
//   const [message, setMessage] = useState("");

//   const show = useCallback((reason: string) => {
//     setMessage(reason);
//     setOpen(true);
//   }, []);

//   const close = useCallback(() => {
//     setOpen(false);
//   }, []);

//   return { open, message, show, close };
// }

// export function showIfBlocked(
//   data: unknown,
//   show: (reason: string) => void,
// ): boolean {
//   if (
//     !data ||
//     typeof data !== "object" ||
//     !("blocked" in data) ||
//     (data as { blocked: unknown }).blocked !== true
//   ) {
//     return false;
//   }

//   const reason =
//     "reason" in data && typeof (data as { reason: unknown }).reason === "string"
//       ? (data as { reason: string }).reason
//       : "We couldn't accept this message.";

//   show(reason);
//   return true;
// }

// type SpamBlockedModalProps = {
//   open: boolean;
//   message: string;
//   onClose: () => void;
// };

// export function SpamBlockedModal({
//   open,
//   message,
//   onClose,
// }: SpamBlockedModalProps) {
//   const titleId = useId();

//   useEffect(() => {
//     if (!open) return;

//     function onKey(event: KeyboardEvent) {
//       if (event.key === "Escape") onClose();
//     }

//     document.addEventListener("keydown", onKey);
//     const previous = document.body.style.overflow;
//     document.body.style.overflow = "hidden";

//     return () => {
//       document.removeEventListener("keydown", onKey);
//       document.body.style.overflow = previous;
//     };
//   }, [open, onClose]);

//   if (!open) return null;

//   return (
//     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
//       <button
//         type="button"
//         className="absolute inset-0 bg-slate-900/50"
//         aria-label="Close"
//         onClick={onClose}
//       />
//       <div
//         role="dialog"
//         aria-modal="true"
//         aria-labelledby={titleId}
//         className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
//       >
//         <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700">
//           <svg
//             viewBox="0 0 24 24"
//             className="h-5 w-5"
//             fill="none"
//             stroke="currentColor"
//             strokeWidth="2"
//             aria-hidden="true"
//           >
//             <path
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
//             />
//           </svg>
//         </div>
//         <h2 id={titleId} className="text-lg font-semibold text-slate-900">
//           Message not sent
//         </h2>
//         <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
//         <button
//           type="button"
//           onClick={onClose}
//           className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
//         >
//           Close
//         </button>
//       </div>
//     </div>
//   );
// }
