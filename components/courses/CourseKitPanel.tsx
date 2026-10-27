"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listKits, getCourseKit, setCourseKit, type ApiKit } from "@/lib/kits-api";

export default function CourseKitPanel({ courseId }: { courseId: string }) {
  const [kits, setKits] = useState<ApiKit[]>([]);
  const [hasKit, setHasKit] = useState(false);
  const [kitId, setKitId] = useState("");
  const [savedKitId, setSavedKitId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [all, current] = await Promise.all([listKits(), getCourseKit(courseId)]);
        setKits(all);
        const id = current.kit?.id ?? "";
        setHasKit(!!id);
        setKitId(id);
        setSavedKitId(id);
      } catch (e: any) {
        setMsg({ ok: false, text: e?.message ?? "Failed to load kits" });
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  const save = async () => {
    if (hasKit && !kitId) return setMsg({ ok: false, text: "Select a kit, or choose No" });
    setSaving(true);
    setMsg(null);
    try {
      const target = hasKit ? kitId : null;
      await setCourseKit(courseId, target);
      setSavedKitId(target ?? "");
      setMsg({ ok: true, text: target ? "Kit attached to this course" : "Kit removed from this course" });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const selected = kits.find((k) => k.id === kitId);
  const dirty = (hasKit ? kitId : "") !== savedKitId;

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Course kit</h2>
        <p className="text-sm text-muted-foreground">
          Paid courses: the kit is included at no extra cost. Free courses: the kit is shown for separate purchase.
        </p>
      </div>

      {loading ? (
        <p className="text-sm">Loading…</p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">Does this course include a kit?</p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={!hasKit} onChange={() => setHasKit(false)} /> No
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={hasKit} onChange={() => setHasKit(true)} /> Yes
              </label>
            </div>
          </div>

          {hasKit && (
            <div className="space-y-2">
              <select
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={kitId}
                onChange={(e) => setKitId(e.target.value)}
              >
                <option value="">Select a kit…</option>
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}{k.status !== "active" ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
              {selected && (
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {selected.kit_items.map((i) => (
                    <li key={i.id}>{i.products?.title ?? `Product #${i.product_id}`} × {i.quantity}</li>
                  ))}
                </ul>
              )}
              <p className="text-sm">
                Need a new kit? <Link href="/kits" className="underline">Create one on the Kits page</Link>.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : "Save kit setting"}</Button>
            {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
          </div>
        </>
      )}
    </Card>
  );
}
