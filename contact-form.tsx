"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast, { Toaster } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import {
  showIfBlocked,
  SpamBlockedModal,
  useSpamBlockedModal,
} from "@/components/SpamBlockedModal";

interface GTMEvent {
  event: string;
  page?: string;
  [key: string]: unknown;
}

type WindowWithDataLayer = Window & {
  dataLayer: GTMEvent[];
};

declare const window: WindowWithDataLayer;

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  message: z.string().min(1, "Message is required"),
  preferredContact: z
    .optional(z.enum(["email", "call"]))
    .refine((val) => val !== undefined, {
      message: "Please select how you'd like us to contact you",
    }),
});

type FormValues = z.infer<typeof formSchema>;

export default function ContactForm() {
  const [loading, setLoading] = useState(false);
  const blocked = useSpamBlockedModal();
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const preferredContact = watch("preferredContact");

  const onRecaptchaChange = (token: string | null) => {
    setRecaptchaToken(token);
  };

  const onSubmit = async (values: FormValues) => {
    if (!recaptchaToken) {
      toast.error("Please complete the reCAPTCHA verification.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          formType: "contact",
          recaptchaToken,
        }),
      });

      const data = await res.json();
      if (showIfBlocked(data, blocked.show)) {
        setRecaptchaToken(null);
        recaptchaRef.current?.reset();
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      toast.success("Message sent successfully! We'll get back to you soon.");
      // Reset form
      setValue("name", "");
      setValue("email", "");
      setValue("phone", "");
      setValue("message", "");
      setValue("preferredContact", undefined as any);
      // Reset reCAPTCHA
      setRecaptchaToken(null);
      recaptchaRef.current?.reset();
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "contactFormSubmission",
      });
    } catch (e: any) {
      const errorMessage = e.message || "An unexpected error occurred.";
      toast.error(errorMessage);
      // Reset reCAPTCHA on error
      setRecaptchaToken(null);
      recaptchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          type="text"
          {...register("name")}
          aria-invalid={errors.name ? "true" : "false"}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          aria-invalid={errors.email ? "true" : "false"}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          {...register("phone")}
          aria-invalid={errors.phone ? "true" : "false"}
        />
        {errors.phone && (
          <p className="text-sm text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message *</Label>
        <Textarea
          id="message"
          rows={6}
          {...register("message")}
          aria-invalid={errors.message ? "true" : "false"}
        />
        {errors.message && (
          <p className="text-sm text-destructive">{errors.message.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="preferredContact">
          How would you prefer us to contact you? *
        </Label>
        <Select
          value={preferredContact}
          onValueChange={(value) =>
            setValue("preferredContact", value as "email" | "call")
          }
        >
          <SelectTrigger
            id="preferredContact"
            className="w-full"
            aria-invalid={errors.preferredContact ? "true" : "false"}
          >
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="call">Call back</SelectItem>
          </SelectContent>
        </Select>
        {errors.preferredContact && (
          <p className="text-sm text-destructive">
            {errors.preferredContact.message}
          </p>
        )}
      </div>

      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
        onChange={onRecaptchaChange}
      />
      <Button
        type="submit"
        disabled={isSubmitting || loading}
        className="w-full"
        size="lg"
      >
        {isSubmitting || loading ? "Sending..." : "Send Message"}
      </Button>
        <Toaster position="top-right" />
      </form>
      <SpamBlockedModal
        open={blocked.open}
        message={blocked.message}
        onClose={blocked.close}
      />
    </>
  );
}
