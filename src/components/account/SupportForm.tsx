"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function SupportForm({ userId }: { userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (subject.trim().length < 3) errs.subject = "Add a short subject";
        if (message.trim().length < 10) errs.message = "Tell us a little more (10+ characters)";
        setErrors(errs);
        if (Object.keys(errs).length) return;
        setSaving(true);
        const { error } = await getSupabaseBrowser().from("support_tickets").insert({ user_id: userId, subject: subject.trim(), message: message.trim() });
        setSaving(false);
        if (error) toast(error.message, "error");
        else {
          toast("Message sent — we'll reply soon");
          setSubject("");
          setMessage("");
          router.refresh();
        }
      }}
    >
      <Input label="Subject" name="subject" placeholder="e.g. Order NX-… delivery question" value={subject} onChange={(e) => setSubject(e.target.value)} error={errors.subject} maxLength={120} />
      <Textarea label="Message" name="message" value={message} onChange={(e) => setMessage(e.target.value)} error={errors.message} maxLength={2000} />
      <Button type="submit" loading={saving}>
        Send message
      </Button>
    </form>
  );
}
