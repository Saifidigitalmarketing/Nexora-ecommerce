"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/** Promote an existing account (by email) to rider. Riders sign up like customers first. */
export function AddRider() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col sm:flex-row gap-2 sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const supabase = getSupabaseBrowser();
        const { data: user } = await supabase.from("profiles").select("id, role").eq("email", email.trim().toLowerCase()).maybeSingle();
        if (!user) {
          setBusy(false);
          toast("No account with that email. Ask the rider to sign up first.", "error");
          return;
        }
        const { error } = await supabase.rpc("admin_set_user_role", { p_user: user.id, p_role: "rider" });
        setBusy(false);
        if (error) toast(error.message, "error");
        else {
          toast("Rider added");
          setEmail("");
          router.refresh();
        }
      }}
    >
      <div className="flex-1">
        <Input label="Rider's account email" name="rider_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="The rider must create a NEXORA account first." />
      </div>
      <Button type="submit" loading={busy} disabled={!email}>
        Make rider
      </Button>
    </form>
  );
}

export function EditRider({ rider }: { rider: { id: string; vehicle_type: string; vehicle_number: string | null; cnic: string | null; zone_city: string | null; is_active: boolean } }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ ...rider, vehicle_number: rider.vehicle_number ?? "", cnic: rider.cnic ?? "", zone_city: rider.zone_city ?? "" });
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="font-label-md text-label-md text-primary">
        Edit
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Rider details">
        <div className="flex flex-col gap-3">
          <Input label="Vehicle type" name="vehicle_type" value={v.vehicle_type} onChange={(e) => setV({ ...v, vehicle_type: e.target.value })} />
          <Input label="Vehicle number" optional name="vehicle_number" value={v.vehicle_number} onChange={(e) => setV({ ...v, vehicle_number: e.target.value })} />
          <Input label="CNIC" optional name="cnic" value={v.cnic} onChange={(e) => setV({ ...v, cnic: e.target.value })} />
          <Input label="Zone / city" optional name="zone_city" value={v.zone_city} onChange={(e) => setV({ ...v, zone_city: e.target.value })} />
          <label className="flex items-center justify-between font-body-md text-body-md">
            Active (can receive orders)
            <input type="checkbox" className="w-5 h-5 accent-primary" checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
          </label>
          <Button
            size="lg"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const { error } = await getSupabaseBrowser()
                .from("riders")
                .update({ vehicle_type: v.vehicle_type.trim() || "Motorbike", vehicle_number: v.vehicle_number.trim() || null, cnic: v.cnic.trim() || null, zone_city: v.zone_city.trim() || null, is_active: v.is_active })
                .eq("id", rider.id);
              setBusy(false);
              if (error) toast(error.message, "error");
              else {
                toast("Rider updated");
                setOpen(false);
                router.refresh();
              }
            }}
          >
            Save
          </Button>
        </div>
      </Sheet>
    </>
  );
}
