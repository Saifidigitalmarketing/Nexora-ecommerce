"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { usePwa } from "@/components/providers/PwaProvider";

/** "Install NEXORA App" strip from the Stitch header. Hidden once installed or dismissed. */
export function InstallStrip() {
  const { canPrompt, isIOS, isStandalone, bannerDismissed, dismissBanner, install } = usePwa();
  const [help, setHelp] = useState(false);

  if (isStandalone || bannerDismissed) return null;

  const onInstall = async () => {
    if (canPrompt) {
      await install();
    } else {
      setHelp(true);
    }
  };

  return (
    <>
      <div className="h-9 px-margin flex items-center justify-between bg-surface-container-low">
        <div className="flex items-center gap-space-xs min-w-0">
          <Icon name="install_mobile" className="text-[16px] text-secondary" />
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider truncate">Install NEXORA App</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onInstall}
            className="px-3 py-1 rounded-full bg-on-surface text-surface font-label-sm text-label-sm hover:opacity-90 transition-opacity"
          >
            Install
          </button>
          <button type="button" onClick={dismissBanner} aria-label="Dismiss install banner" className="w-7 h-7 flex items-center justify-center text-secondary">
            <Icon name="close" className="text-[16px]" />
          </button>
        </div>
      </div>
      <Sheet open={help} onClose={() => setHelp(false)} title="Install NEXORA">
        <div className="flex items-center gap-3 mb-4">
          <img src="/icons/icon-192.png" alt="" className="w-14 h-14 rounded-xl shadow-sm" />
          <div>
            <p className="font-label-lg text-label-lg text-on-surface">NEXORA</p>
            <p className="font-body-sm text-body-sm text-secondary">Everything. One Place.</p>
          </div>
        </div>
        {isIOS ? (
          <ol className="flex flex-col gap-3 font-body-md text-body-md text-on-surface">
            <li className="flex gap-2"><Icon name="ios_share" className="text-primary text-[20px]" /> Tap the <strong>Share</strong> button in Safari.</li>
            <li className="flex gap-2"><Icon name="add_box" className="text-primary text-[20px]" /> Choose <strong>Add to Home Screen</strong>.</li>
            <li className="flex gap-2"><Icon name="check_circle" className="text-primary text-[20px]" /> Tap <strong>Add</strong> — NEXORA opens like an app.</li>
          </ol>
        ) : (
          <ol className="flex flex-col gap-3 font-body-md text-body-md text-on-surface">
            <li className="flex gap-2"><Icon name="more_vert" className="text-primary text-[20px]" /> Open your browser menu.</li>
            <li className="flex gap-2"><Icon name="install_mobile" className="text-primary text-[20px]" /> Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          </ol>
        )}
      </Sheet>
    </>
  );
}
