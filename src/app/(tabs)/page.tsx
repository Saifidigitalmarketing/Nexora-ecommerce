import Link from "next/link";
import { BrandRow } from "@/components/home/BrandRow";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { Countdown } from "@/components/home/Countdown";
import { HeroBanner } from "@/components/home/HeroBanner";
import { SectionHeader } from "@/components/home/SectionHeader";
import { TrustStrip } from "@/components/home/TrustStrip";
import { FlashDealCard } from "@/components/product/FlashDealCard";
import { ProductGrid } from "@/components/product/ProductCard";
import { Icon } from "@/components/ui/Icon";
import { SearchBar } from "@/components/ui/SearchBar";
import { getActiveBanners, getCategories, getFeaturedBrands, getPublicSetting, listProducts } from "@/lib/catalog";


export default async function HomePage() {
  const [categories, banners, brands, trending, flash, featured, bestSellers, newArrivals] = await Promise.all([
    getCategories(),
    getActiveBanners(),
    getFeaturedBrands(),
    getPublicSetting<string[]>("trending_searches", []),
    listProducts({ flash: true, limit: 10, sort: "popular" }),
    listProducts({ featured: true, limit: 8, sort: "newest" }),
    listProducts({ limit: 4, sort: "popular" }),
    listProducts({ limit: 4, sort: "newest" }),
  ]);

  const topLevel = categories.filter((c) => !c.parent_id).slice(0, 8);
  const flashEnds = flash.items
    .map((p) => p.flash_deal_ends_at)
    .filter((d): d is string => !!d)
    .sort()[0];

  return (
    <div className="flex flex-col w-full pb-8">
      {/* 1. Search */}
      <section className="px-margin pt-space-sm pb-space-xs">
        <SearchBar />
      </section>

      {/* 2. Trending pills */}
      {trending.length ? (
        <section className="w-full overflow-x-auto no-scrollbar py-space-xs px-margin">
          <div className="flex items-center gap-space-xs whitespace-nowrap">
            {trending.map((t, i) => (
              <Link
                key={t}
                href={`/search?q=${encodeURIComponent(t)}`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container text-label-sm font-label-sm shadow-sm transition-all"
              >
                {i === 0 ? <Icon name="trending_up" className="text-[14px] text-primary" /> : null}
                <span>{t}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* 3. Hero */}
      <HeroBanner banners={banners} />

      {/* 4. Categories */}
      <section className="px-margin mt-space-lg" aria-label="Categories">
        <CategoryTiles categories={topLevel} />
      </section>

      {/* 5. Trust */}
      <section className="px-margin mt-space-md">
        <TrustStrip />
      </section>

      {/* 6. Flash deals */}
      {flash.items.length ? (
        <section className="mt-space-lg">
          <div className="px-margin">
            <SectionHeader
              title="Flash Deals"
              href="/search?flash=1"
              extra={
                flashEnds ? (
                  <div className="flex items-center gap-1 bg-surface-container-highest text-on-surface px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold">
                    <Icon name="timer" className="text-[14px] text-error" />
                    <Countdown endsAt={flashEnds} />
                  </div>
                ) : null
              }
            />
          </div>
          <div className="w-full overflow-x-auto no-scrollbar px-margin flex gap-space-sm">
            {flash.items.map((p) => (
              <FlashDealCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Official stores */}
      {brands.length ? (
        <section className="mt-space-lg px-margin">
          <div className="flex items-center justify-between mb-space-sm">
            <div className="flex items-center gap-1.5">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Official Brand Flagships</h2>
              <Icon name="verified" filled className="text-[16px] text-primary" />
            </div>
            <span className="font-label-sm text-label-sm text-secondary font-medium">100% Warranted</span>
          </div>
          <BrandRow brands={brands} />
        </section>
      ) : null}

      {/* 8. Featured */}
      {featured.items.length ? (
        <section className="px-margin mt-space-xl">
          <SectionHeader title="Featured Products" subtitle="Hand-picked by the NEXORA team" href="/search?featured=1" />
          <ProductGrid products={featured.items.slice(0, 4)} priorityCount={2} />
        </section>
      ) : null}

      {/* 9. Best sellers */}
      {bestSellers.items.length ? (
        <section className="px-margin mt-space-xl">
          <SectionHeader title="Best Sellers" subtitle="What Pakistan is buying right now" href="/search?sort=popular" />
          <ProductGrid products={bestSellers.items} />
        </section>
      ) : null}

      {/* 10. New arrivals */}
      {newArrivals.items.length ? (
        <section className="px-margin mt-space-xl">
          <SectionHeader title="New Arrivals" subtitle="Fresh drops from verified merchants" href="/search?sort=newest" />
          <ProductGrid products={newArrivals.items} />
        </section>
      ) : null}

      {/* 11. Recommended */}
      {featured.items.length > 4 ? (
        <section className="px-margin mt-space-xl">
          <div className="flex items-center justify-between mb-space-sm">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Recommended For You</h2>
              <p className="font-body-sm text-body-sm text-secondary">Handpicked based on what shoppers love</p>
            </div>
            <Link href="/search" aria-label="Filter products" className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface">
              <Icon name="tune" className="text-[18px]" />
            </Link>
          </div>
          <ProductGrid products={featured.items.slice(4, 8)} />
        </section>
      ) : null}

      {!flash.items.length && !featured.items.length && !bestSellers.items.length ? (
        <section className="px-margin mt-space-xl text-center text-secondary font-body-md text-body-md">
          No products yet. Add products from the admin dashboard.
        </section>
      ) : null}

      <footer className="mt-space-xl px-margin flex flex-col items-center justify-center gap-1 text-center opacity-70">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <p className="font-label-sm text-label-sm text-secondary tracking-widest uppercase font-semibold">NEXORA Pakistan • Everything. One Place.</p>
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        </div>
        <span className="font-body-sm text-body-sm text-secondary">Curated quality, verified merchants, swift delivery across PK</span>
        <nav className="flex gap-3 mt-2 font-label-md text-label-md text-secondary">
          <Link href="/help" className="hover:text-primary">Help &amp; Support</Link>
          <Link href="/track" className="hover:text-primary">Track Order</Link>
        </nav>
      </footer>
    </div>
  );
}
