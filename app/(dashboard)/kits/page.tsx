"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { type ApiProduct } from "@/lib/products-api";
import { ProductCombobox, ProductThumb } from "@/components/kits/ProductCombobox";
import {
  listKits, createKit, updateKit, deleteKit, type ApiKit, type KitItemInput,
} from "@/lib/kits-api";

type FormState = {
  id?: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  items: KitItemInput[];
};

const EMPTY: FormState = { name: "", description: "", status: "active", items: [] };

/** What the dialog needs to show for a product already in the kit. */
type KnownProduct = { title: string; thumbnail_url: string | null };

export default function KitsPage() {
  const [kits, setKits] = useState<ApiKit[]>([]);
  // Titles/thumbnails for products in the open kit (from the kit itself or
  // from the search result they were picked from).
  const [known, setKnown] = useState<Map<string, KnownProduct>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setKits(await listKits());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load kits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const inKit = useMemo(() => new Set(form.items.map((i) => i.product_id)), [form.items]);

  const openNew = () => { setForm(EMPTY); setKnown(new Map()); setFormError(null); setOpen(true); };

  const openEdit = (k: ApiKit) => {
    setForm({
      id: k.id,
      name: k.name,
      description: k.description ?? "",
      status: k.status === "inactive" ? "inactive" : "active",
      items: k.kit_items.map((i) => ({ product_id: String(i.product_id), quantity: i.quantity })),
    });
    setKnown(new Map(
      k.kit_items.map((i) => [
        String(i.product_id),
        { title: i.products?.title ?? `Product #${i.product_id}`, thumbnail_url: i.products?.thumbnail_url ?? null },
      ]),
    ));
    setFormError(null);
    setOpen(true);
  };

  const addProduct = (p: ApiProduct) => {
    const pid = String(p.id);
    if (form.items.some((i) => i.product_id === pid)) return;
    setKnown((m) => new Map(m).set(pid, { title: p.title, thumbnail_url: p.thumbnail_url }));
    setForm((f) => ({ ...f, items: [...f.items, { product_id: pid, quantity: 1 }] }));
  };

  const setQty = (pid: string, q: number) =>
    setForm({ ...form, items: form.items.map((i) => (i.product_id === pid ? { ...i, quantity: q } : i)) });

  const removeItem = (pid: string) =>
    setForm({ ...form, items: form.items.filter((i) => i.product_id !== pid) });

  const save = async () => {
    if (!form.name.trim()) return setFormError("Kit name is required");
    if (form.items.length === 0) return setFormError("Add at least one product");
    if (form.items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) {
      return setFormError("Quantities must be whole numbers of 1 or more");
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = { name: form.name, description: form.description, items: form.items };
      if (form.id) await updateKit(form.id, { ...payload, status: form.status });
      else await createKit(payload);
      setOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (k: ApiKit) => {
    if (!window.confirm(`Delete kit "${k.name}"? Courses using it will no longer include a kit.`)) return;
    try {
      await deleteKit(k.id);
      await load();
    } catch (e: any) {
      window.alert(e?.message ?? "Delete failed");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kits</h1>
          <p className="text-sm text-muted-foreground">
            Bundles of Store products that can be included with a course.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />New kit</Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Courses</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
            ) : kits.length === 0 ? (
              <TableRow><TableCell colSpan={5}>No kits yet. Create one to attach it to a course.</TableCell></TableRow>
            ) : (
              kits.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell className="text-sm">
                    {k.kit_items.map((i) => `${i.products?.title ?? i.product_id} × ${i.quantity}`).join(", ")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {k.courses?.length ? k.courses.map((c) => c.title).join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-sm capitalize">{k.status}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(k)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(k)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit kit" : "New kit"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {form.id && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Status</label>
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (hidden from course pages)</option>
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Products in this kit</label>
              <ProductCombobox excludeIds={inKit} onSelect={addProduct} />

              {form.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No products added yet.</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {form.items.map((i) => (
                    <div key={i.product_id} className="flex items-center gap-3 p-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        <ProductThumb
                          key={known.get(i.product_id)?.thumbnail_url ?? ""}
                          src={known.get(i.product_id)?.thumbnail_url}
                        />
                      </span>
                      <span className="flex-1 text-sm">
                        {known.get(i.product_id)?.title ?? `Product #${i.product_id}`}
                      </span>
                      <Input
                        type="number"
                        min={1}
                        className="w-20"
                        value={i.quantity}
                        onChange={(e) => setQty(i.product_id, Number(e.target.value))}
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeItem(i.product_id)} aria-label="Remove">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save kit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
