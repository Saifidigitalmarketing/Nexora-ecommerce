import { HeaderActions } from "./HeaderActions";
import { InstallStrip } from "./InstallStrip";
import { LocationPicker } from "./LocationPicker";
import { Logo } from "./Logo";

/**
 * Tab-screen header from the Stitch home/search/cart screens.
 * The install strip scrolls away; the 60px brand row stays sticky so
 * page-level sticky bars can sit at top-[60px].
 */
export function AppHeader() {
  return (
    <>
      <div className="pt-safe bg-surface-container-low">
        <InstallStrip />
      </div>
      <header className="sticky top-0 w-full z-50 bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-[60px] px-margin flex items-center justify-between max-w-screen-xl mx-auto">
          <div className="flex items-center gap-space-sm min-w-0">
            <Logo />
            <LocationPicker />
          </div>
          <HeaderActions />
        </div>
      </header>
    </>
  );
}
