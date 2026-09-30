import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StackHeader } from "@/components/layout/StackHeader";
import { Gallery } from "@/components/pdp/Gallery";
import { ProductPurchase } from "@/components/pdp/ProductPurchase";
import { Reviews } from "@/components/pdp/Reviews";
import { ShareButton } from "@/components/pdp/ShareButton";
import { ProductGrid } from "@/components/product/ProductCard";
import { WishlistButton } from "@/components/product/WishlistButton";
import { Icon } from "@/components/ui/Icon";
import { getCategories, getProductBySlug, getProductReviews, listProducts } from "@/lib/catalog";
import { formatCount } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Product not found" };
  return {
    title: p.name,
    description: p.short_description ?? undefined,
    openGraph: { title: p.name, description: p.short_description ?? undefined, images: p.images[0]?.url ? [p.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [reviews, related, categories] = await Promise.all([
    getProductReviews(product.id),
    listProducts({ categoryIds: [product.category_id], excludeId: product.id, limit: 4 }),
    getCategories(),
  ]);
  const parentCat = product.category?.parent_id ? categories.find((c) => c.id === product.category?.parent_id) : null;
  const official = product.badges.some((b) => /official|pta/i.test(b));

  return (
    <>
      <StackHeader title="Product Details" actions={<ShareButton title={product.name} className="w-11 h-11 flex items-center justify-center text-on-surface hover:text-primary transition-colors" />} />
      <main className="flex flex-col relative w-full pb-safe bg-surface flex-grow">
        <div className="flex flex-col w-full pb-28 max-w-screen-xl mx-auto">
          {/* Sub-navigation bar */}
          <div className="flex items-center justify-between px-margin py-space-sm bg-surface-container-lowest shadow-sm">
            <div className="flex items-center gap-space-xs min-w-0">
              <Icon name={parentCat?.icon ?? "category"} className="text-[18px] text-primary" />
              {product.category ? (
                <Link href={`/categories/${product.category.slug}`} className="font-label-md text-label-md text-secondary hover:text-primary truncate">
                  {product.category.name}
                </Link>
              ) : null}
              <Icon name="chevron_right" className="text-[14px] text-outline" />
              <span className="font-label-md text-label-md text-on-surface truncate max-w-[130px]">{product.name}</span>
            </div>
            <div className="flex items-center gap-space-xs">
              <WishlistButton productId={product.id} size="md" />
              <ShareButton title={product.name} />
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-2 lg:gap-gutter-desktop lg:px-margin lg:pt-space-md">
            <Gallery images={product.images} name={product.name} officialTag={official} />

            <div>
              <div className="flex flex-col px-margin pt-space-md gap-space-sm lg:px-0 lg:pt-0">
                {product.badges.length ? (
                  <div className="flex flex-wrap items-center gap-space-xs">
                    {product.badges.map((b, i) => (
                      <div
                        key={b}
                        className={
                          i === 0
                            ? "flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-container text-on-primary-container shadow-sm"
                            : "flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container"
                        }
                      >
                        <Icon name={i === 0 ? "check_circle" : "shield"} className="text-[14px]" />
                        <span className="font-label-sm text-label-sm">{b}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">{product.name}</h2>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-on-surface-variant">
                  {product.rating_count > 0 ? (
                    <a href="#reviews" className="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded-md">
                      <span className="font-label-lg text-label-lg text-on-surface">{Number(product.rating_avg).toFixed(1)}</span>
                      <Icon name="star" filled className="text-[14px] text-amber-500" />
                      <span className="font-body-sm text-body-sm text-secondary">({product.rating_count} Reviews)</span>
                    </a>
                  ) : (
                    <span className="font-body-sm text-body-sm text-secondary">No reviews yet</span>
                  )}
                  {product.sold_count > 0 ? (
                    <>
                      <span className="text-surface-container-highest">•</span>
                      <span className="font-label-md text-label-md text-on-surface">{formatCount(product.sold_count)} Sold</span>
                    </>
                  ) : null}
                  {product.brand ? (
                    <>
                      <span className="text-surface-container-highest">•</span>
                      <Link href={`/search?brand=${product.brand.slug}`} className="font-label-md text-label-md text-primary">
                        {product.brand.name}
                      </Link>
                    </>
                  ) : null}
                </div>
                {product.vendor ? (
                  <p className="font-body-sm text-body-sm text-secondary flex items-center gap-1">
                    <Icon name="storefront" className="text-[14px]" /> Sold by <span className="text-on-surface font-medium">{product.vendor.name}</span>
                  </p>
                ) : null}
              </div>

              <div className="px-margin lg:px-0">
                <ProductPurchase product={product} />
              </div>
            </div>
          </div>

          {product.description ? (
            <div className="flex flex-col px-margin mt-space-md">
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-space-xs">Description</h3>
              <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm font-body-md text-body-md text-on-surface-variant whitespace-pre-line">
                {product.description}
              </div>
            </div>
          ) : null}

          {product.specs?.length ? (
            <div className="flex flex-col px-margin mt-space-md">
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-space-xs">Key Specifications</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-sm">
                {product.specs.map((s) => (
                  <div key={s.label} className="p-space-sm rounded-lg bg-surface-container-lowest shadow-sm flex flex-col">
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">{s.label}</span>
                    <span className="font-label-lg text-label-lg text-on-surface mt-1">{s.value}</span>
                    {s.detail ? <span className="font-body-sm text-body-sm text-outline">{s.detail}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Reviews productId={product.id} slug={product.slug} reviews={reviews} ratingAvg={product.rating_avg} ratingCount={product.rating_count} />

          {related.items.length ? (
            <section className="px-margin mt-space-xl">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight mb-space-sm">You May Also Like</h3>
              <ProductGrid products={related.items} />
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}
