"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { PaymentAccounts } from "@/lib/payments";

export interface StoreInfo {
  name?: string;
  tagline?: string;
  support_phone?: string;
  support_whatsapp?: string;
  support_email?: string;
}

export function StoreSettingsForm({ store, accounts, trending }: { store: StoreInfo; accounts: PaymentAccounts; trending: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [info, setInfo] = useState<StoreInfo>({ name: "NEXORA", tagline: "Everything. One Place.", ...store });
  const [acc, setAcc] = useState<Required<PaymentAccounts>>({
    easypaisa: { title: "", number: "", ...accounts.easypaisa },
    jazzcash: { title: "", number: "", ...accounts.jazzcash },
    bank_transfer: { bank: "", title: "", account_number: "", iban: "", ...accounts.bank_transfer },
  });
  const [trend, setTrend] = useState(trending.join(", "));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await getSupabaseBrowser()
      .from("store_settings")
      .upsert([
        { key: "store", value: info, is_public: true, updated_at: now },
        { key: "payment_accounts", value: acc, is_public: true, updated_at: now },
        { key: "trending_searches", value: trend.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12), is_public: true, updated_at: now },
      ]);
    setSaving(false);
    if (error) toast(error.message, "error");
    else {
      toast("Settings saved");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-space-md">
      <div className="grid lg:grid-cols-2 gap-space-md">
        <div className="flex flex-col gap-3">
          <p className="font-label-lg text-label-lg">Store & support</p>
          <Input label="Store name" name="store_name" value={info.name ?? ""} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
          <Input label="Tagline" name="tagline" value={info.tagline ?? ""} onChange={(e) => setInfo({ ...info, tagline: e.target.value })} />
          <Input label="Support phone" optional name="support_phone" value={info.support_phone ?? ""} onChange={(e) => setInfo({ ...info, support_phone: e.target.value })} />
          <Input label="Support WhatsApp" optional name="support_whatsapp" value={info.support_whatsapp ?? ""} onChange={(e) => setInfo({ ...info, support_whatsapp: e.target.value })} />
          <Input label="Support email" optional name="support_email" value={info.support_email ?? ""} onChange={(e) => setInfo({ ...info, support_email: e.target.value })} />
          <Input label="Trending searches (comma separated)" name="trending" value={trend} onChange={(e) => setTrend(e.target.value)} hint="Shown as pills under the home search bar" />
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-label-lg text-label-lg">Payment accounts (shown at checkout)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Easypaisa title" name="ep_title" value={acc.easypaisa.title ?? ""} onChange={(e) => setAcc({ ...acc, easypaisa: { ...acc.easypaisa, title: e.target.value } })} />
            <Input label="Easypaisa number" name="ep_number" value={acc.easypaisa.number ?? ""} onChange={(e) => setAcc({ ...acc, easypaisa: { ...acc.easypaisa, number: e.target.value } })} />
            <Input label="JazzCash title" name="jc_title" value={acc.jazzcash.title ?? ""} onChange={(e) => setAcc({ ...acc, jazzcash: { ...acc.jazzcash, title: e.target.value } })} />
            <Input label="JazzCash number" name="jc_number" value={acc.jazzcash.number ?? ""} onChange={(e) => setAcc({ ...acc, jazzcash: { ...acc.jazzcash, number: e.target.value } })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Bank" name="bank" value={acc.bank_transfer.bank ?? ""} onChange={(e) => setAcc({ ...acc, bank_transfer: { ...acc.bank_transfer, bank: e.target.value } })} />
            <Input label="Account title" name="bank_title" value={acc.bank_transfer.title ?? ""} onChange={(e) => setAcc({ ...acc, bank_transfer: { ...acc.bank_transfer, title: e.target.value } })} />
            <Input label="Account number" name="bank_acc" value={acc.bank_transfer.account_number ?? ""} onChange={(e) => setAcc({ ...acc, bank_transfer: { ...acc.bank_transfer, account_number: e.target.value } })} />
            <Input label="IBAN" name="iban" value={acc.bank_transfer.iban ?? ""} onChange={(e) => setAcc({ ...acc, bank_transfer: { ...acc.bank_transfer, iban: e.target.value } })} />
          </div>
        </div>
      </div>
      <Button size="lg" loading={saving} onClick={() => void save()} className="self-start">
        Save settings
      </Button>
    </div>
  );
}
