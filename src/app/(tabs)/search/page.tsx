import type { Metadata } from "next";
import { ProductListing } from "@/components/listing/ProductListing";
import type { RawParams } from "@/components/listing/params";
import { SearchField } from "@/components/listing/SearchField";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawParams> }): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  return { title: q ? `Search: ${q}` : "Search" };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const flash = sp.flash === "1";
  return (
    <ProductListing
      searchParams={sp}
      context={flash ? "Flash Deals" : undefined}
      heading={q ? `Results for "${q}"` : undefined}
      searchSlot={<SearchField defaultValue={q} />}
    />
  );
}
