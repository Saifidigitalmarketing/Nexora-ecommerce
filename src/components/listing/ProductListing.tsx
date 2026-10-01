import { Suspense } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { getBrands, listProducts } from "@/lib/catalog";
import { ListingControls, LoadMore, ViewToggle } from "./ListingControls";
import { activeFilterCount, parseListing, toQuery, type RawParams } from "./params";
import { ResultCard } from "./ProductListItem";

/** Search/category results: sticky controls, count + view toggle, grid, load more. */
export async function ProductListing({
  searchParams,
  categoryIds,
  heading,
  context,
  searchSlot,
}: {
  searchParams: RawParams;
  categoryIds?: string[];
  heading?: string;
  context?: string;
  searchSlot: React.ReactNode;
}) {
  const state = parseListing(searchParams);
  const [{ items, total }, brands] = await Promise.all([listProducts(toQuery(state, categoryIds)), getBrands()]);
  const count = activeFilterCount(state);

  return (
    <div className="flex flex-col w-full">
      <Suspense>
        <ListingControls state={state} brands={brands} filterCount={count}>
          {searchSlot}
        </ListingControls>
      </Suspense>

      <section className="flex items-center justify-between px-margin py-space-sm bg-surface">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {total} {total === 1 ? "Result" : "Results"}
            </span>
            {context ? <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">in {context}</span> : null}
          </div>
          <p className="font-body-sm text-body-sm text-secondary truncate">{heading ?? "Verified inventory shipped across Pakistan"}</p>
        </div>
        <Suspense>
          <ViewToggle view={state.view} />
        </Suspense>
      </section>

      {items.length ? (
        <>
          <section className="px-margin pb-space-lg">
            <div className={state.view === "list" ? "grid grid-cols-1 lg:grid-cols-2 gap-3 w-full" : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3 w-full"}>
              {items.map((p) => (
                <ResultCard key={p.id} product={p} layout={state.view} />
              ))}
            </div>
          </section>
          <Suspense>
            <LoadMore page={state.page} shown={items.length} total={total} />
          </Suspense>
        </>
      ) : (
        <EmptyState
          icon="search_off"
          title="No products found"
          description={state.q ? `We couldn't find anything for "${state.q}". Try a different word or remove some filters.` : "Try removing some filters."}
          action={<ButtonLink href="/categories" variant="outline">Browse categories</ButtonLink>}
        />
      )}
    </div>
  );
}
