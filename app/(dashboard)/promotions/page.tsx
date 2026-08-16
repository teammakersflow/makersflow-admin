"use client";

import { useEffect, useState } from "react";
import { backendApi } from "@/lib/backend-api";
import {
  Plus, Trash2, ToggleLeft, ToggleRight, Megaphone, Calendar, Link2, X,
} from "lucide-react";

// Manages the `promotions` table — the banner carousel shown on the
// mobile app's home screen (seasonal offers, new course launches, etc.)

type Promotion = {
  id: number;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link: string | null;
  is_active: boolean;
  expires_at: string | null;
  display_order: number | null;
  created_at: string;
};

const EMPTY_FORM = { title: "", subtitle: "", image_url: "", link: "", expires_at: "", display_order: "" };

export default function PromotionsPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const load = () =>
    backendApi
      .endpoint("/promotions")
      .select("*")
      .order("display_order", { ascending: true, nullsFirst: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setPromos((data as Promotion[]) ?? []);
        setLoading(false);
      });

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (id: number, current: boolean) => {
    // BUG FIX: errors were ignored and the UI updated optimistically — if RLS
    // rejected the write, the admin SAW the banner toggled/deleted but the
    // database (and therefore the app) never changed. Now we surface failures.
    const { error: err } = await backendApi
      .endpoint("/promotions")
      .update({ is_active: !current })
      .eq("id", id);
    if (err) {
      alert(`Could not update banner: ${err.message}\n\nRun ADMIN_CONNECT.sql (admin RLS policies) if this says "row-level security".`);
      load();
      return;
    }
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: !current } : p)));
  };

  const deletePromo = async (id: number) => {
    if (!confirm("Delete this banner? This cannot be undone.")) return;
    const { error: err } = await backendApi.endpoint("/promotions").delete().eq("id", id);
    if (err) {
      alert(`Could not delete banner: ${err.message}\n\nRun ADMIN_CONNECT.sql (admin RLS policies) if this says "row-level security".`);
      load();
      return;
    }
    setPromos((prev) => prev.filter((p) => p.id !== id));
  };

  const createPromo = async () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");
    const { error: err } = await backendApi.endpoint("/promotions").insert({
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      image_url: form.image_url.trim() || null,
      link: form.link.trim() || null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: true,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
    load();
  };

  const isExpired = (expiry: string | null) => (expiry ? new Date(expiry) < new Date() : false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promotions</h1>
          <p className="mt-1 text-gray-600">
            Banner carousel shown on the student app&apos;s home screen
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? "Cancel" : "New Banner"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Summer Sale — 30% off Robotics"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
              <input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="Use code SUMMER30 at checkout"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…/banner.png"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link (in-app route or URL)
              </label>
              <input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="/course/12"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires at</label>
              <input type="datetime-local" value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Order <span className="text-gray-400 text-xs">(1 = first in carousel)</span></label>
              <input type="number" min="1" value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                placeholder="e.g. 1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={createPromo}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create Banner"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : promos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
          <Megaphone className="mx-auto mb-3 text-gray-300" size={40} />
          No banners yet. Create one and it appears on the app home screen.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promos.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.title} className="w-full h-32 object-cover" />
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{p.title}</h3>
                    {p.subtitle && <p className="text-sm text-gray-600">{p.subtitle}</p>}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                      !p.is_active
                        ? "bg-gray-100 text-gray-600"
                        : isExpired(p.expires_at)
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {!p.is_active ? "Inactive" : isExpired(p.expires_at) ? "Expired" : "Live"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {p.link && (
                    <span className="flex items-center gap-1">
                      <Link2 size={12} /> {p.link}
                    </span>
                  )}
                  {p.expires_at && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> until {new Date(p.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => toggleActive(p.id, p.is_active)}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    {p.is_active ? (
                      <ToggleRight size={18} className="text-green-600" />
                    ) : (
                      <ToggleLeft size={18} />
                    )}
                    {p.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => deletePromo(p.id)}
                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
