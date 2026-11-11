"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchProducts, type ApiProduct } from "@/lib/products-api";

/**
 * Searchable product picker for the Kits dialog.
 *
 * - Searches the backend (`GET /products?search=`) 300 ms after typing stops,
 *   so it reaches the whole catalogue, not only the first page.
 * - Course products and products already in the kit are hidden.
 * - Draft / unpublished and out-of-stock products are greyed out and labelled.
 *   They stay selectable while the team decides (see the work-split doc,
 *   "Open questions"); pass `allowUnavailable={false}` to block them.
 * - Keyboard: ↓/↑ to move, Enter to add, Esc to close the list (the dialog
 *   stays open).
 */

const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 50;

type Availability = { stockLabel: string; outOfStock: boolean; draft: boolean; statusLabel: string | null };

export function productAvailability(p: ApiProduct): Availability {
  const qty = p.stock_quantity;
  const status = (p.status ?? "").trim().toLowerCase();
  const draft = status !== "" && status !== "published";

  let stockLabel: string;
  let outOfStock = p.in_stock === false;
  if (qty === null || qty === undefined) {
    stockLabel = outOfStock ? "Out of stock" : "Stock not set";
  } else if (qty < 0) {
    stockLabel = "Unlimited stock"; // backend convention: -1 = unlimited
  } else if (qty === 0) {
    stockLabel = "Out of stock";
    outOfStock = true;
  } else {
    stockLabel = outOfStock ? "Out of stock" : `${qty} in stock`;
  }

  return {
    stockLabel,
    outOfStock,
    draft,
    statusLabel: draft ? status.charAt(0).toUpperCase() + status.slice(1) : null,
  };
}

export function formatPrice(price: ApiProduct["price"] | null | undefined): string {
  const n = Number(price);
  if (price === null || price === undefined || !Number.isFinite(n)) return "No price";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

type Props = {
  /** Product IDs already in the kit; they are not offered again. */
  excludeIds: ReadonlySet<string>;
  onSelect: (product: ApiProduct) => void;
  allowUnavailable?: boolean;
  disabled?: boolean;
};

export function ProductCombobox({ excludeIds, onSelect, allowUnavailable = true, disabled }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // The last finished search: which query it was for, its rows, its error.
  const [settled, setSettled] = useState<{ query: string; rows: ApiProduct[]; error: string | null } | null>(null);
  const [active, setActive] = useState(0);

  // Fetch matching products, debounced, cancelling any request in flight.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchProducts(query, RESULT_LIMIT, controller.signal);
        if (!controller.signal.aborted) {
          setSettled({ query, rows: rows.filter((p) => !p.is_course), error: null });
        }
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        setSettled({ query, rows: [], error: e instanceof Error ? e.message : "Search failed" });
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const results = useMemo(() => settled?.rows ?? [], [settled]);
  const error = settled?.error ?? null;
  const loading = open && settled?.query !== query;

  const options = useMemo(
    () => results.filter((p) => !excludeIds.has(String(p.id))),
    [results, excludeIds],
  );

  const isSelectable = (p: ApiProduct) => {
    if (allowUnavailable) return true;
    const a = productAvailability(p);
    return !a.outOfStock && !a.draft;
  };

  // The highlighted option, kept inside the current list.
  const current = options.length === 0 ? -1 : Math.min(Math.max(active, 0), options.length - 1);

  // Scroll the highlighted option into view.
  useEffect(() => {
    if (current < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current]);

  // Esc closes only the list. Radix Dialog listens for Esc on the document in
  // the capture phase, so stop the event at the window first while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open]);

  const choose = (p: ApiProduct) => {
    if (!isSelectable(p)) return;
    onSelect(p);
    setQuery("");
    setActive(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (options.length) setActive((current + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (options.length) setActive(current <= 0 ? options.length - 1 : current - 1);
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const p = options.at(current);
      if (p) choose(p);
    }
  };

  const activeId = open && current >= 0 ? `${listId}-opt-${current}` : undefined;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        role="combobox"
        aria-label="Search Store products to add"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        placeholder="Search Store products by name…"
        className="h-9 pl-8"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />

      {open && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          {loading && options.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </p>
          ) : error ? (
            <p className="px-3 py-2 text-sm text-red-600">Couldn’t load products: {error}</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {results.length > 0
                ? "All matching products are already in this kit."
                : query.trim()
                  ? `No Store products match “${query.trim()}”.`
                  : "No Store products found."}
            </p>
          ) : null}

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Store products"
            className={cn("max-h-72 overflow-y-auto py-1", options.length === 0 && "hidden")}
          >
            {options.map((p, index) => {
              const a = productAvailability(p);
              const unavailable = a.outOfStock || a.draft;
              const selectable = isSelectable(p);
              return (
                <li
                  key={String(p.id)}
                  id={`${listId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === current}
                  aria-disabled={!selectable || undefined}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-2 py-1.5",
                    index === current && "bg-muted",
                    !selectable && "cursor-not-allowed",
                  )}
                  // Keep focus in the input so the list does not close first.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(p)}
                >
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted", unavailable && "opacity-50")}>
                    {p.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className={cn("min-w-0 flex-1", unavailable && "opacity-60")}>
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.outOfStock ? formatPrice(p.price) : `${formatPrice(p.price)} · ${a.stockLabel}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {a.statusLabel && (
                      <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {a.statusLabel}
                      </span>
                    )}
                    {a.outOfStock && (
                      <span className="rounded-full border border-red-300 px-2 py-0.5 text-[11px] text-red-600 dark:border-red-800 dark:text-red-400">
                        Out of stock
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          {loading && options.length > 0 && (
            <p className="border-t px-3 py-1 text-xs text-muted-foreground">Updating…</p>
          )}
        </div>
      )}
    </div>
  );
}
