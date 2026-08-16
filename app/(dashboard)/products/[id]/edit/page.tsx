"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { fetchCategories as apiFetchCategories, createCategory } from "@/lib/categories-api";
import { fetchProduct as apiFetchProduct, updateProduct } from "@/lib/products-api";
import { ArrowLeft, Upload, X, Star, Play } from "lucide-react";
import { uploadToS3, deleteFromS3, extractS3Key } from "@/lib/s3Upload";

type Category = { id: string; name: string };
type ExistingMedia = { url: string; type: "image" | "video" };

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

/** Normalise whatever shape the DB column holds into a plain string[] of URLs. */
function toUrlArray(raw: unknown): string[] {
  if (raw == null) return [];
  let value: unknown = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    // Column may hold a JSON array, a comma-joined list, or a single URL.
    if (trimmed.startsWith("[")) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = trimmed.split(",");
      }
    } else {
      value = trimmed.split(",");
    }
  }
  if (!Array.isArray(value)) value = [value];
  return (value as unknown[])
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        return (o.url || o.uri || o.src || o.publicUrl || o.public_url || o.path || "") as string;
      }
      return "";
    })
    .map((u) => String(u).trim())
    .filter((u) => u.length > 0 && u !== "undefined" && u !== "null");
}

export default function EditProductPage() {
  const router = useRouter();
  const { id: rawId } = useParams();
  const id = String(rawId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Category states
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // Existing media from DB
  const [existingMedia, setExistingMedia] = useState<ExistingMedia[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    category: "",
    features: "",
    price: 0,
    original_price: 0,
    gst_rate: 18,
    weight_kg: 0.5,
    in_stock: true,
    status: "available",
  });

  // Fetch categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const list = await apiFetchCategories();   // GET /categories
        setCategories(list as any);
      } catch (e) {
        console.warn("[products/edit] could not load categories:", e);
      }
    }
    loadCategories();
  }, []);

  // Fetch product
  useEffect(() => {
    async function fetchProduct() {
      // GET /products/:id
      let data: any = null;
      try {
        data = await apiFetchProduct(id);
      } catch (e) {
        console.warn("[products/edit] could not load product:", e);
      }
      if (!data) { setLoading(false); return; }

      setForm({
        title: data.title || "",
        slug: data.slug || "",
        description: data.description || "",
        category: data.category || "",
        features: Array.isArray(data.features)
          ? data.features.join(", ")
          : data.features || "",
        price: data.price || 0,
        original_price: data.original_price || 0,
        gst_rate: data.gst_rate ?? 18,
        weight_kg: Number(data.weight_kg) || 0.5,
        in_stock: data.in_stock ?? true,
        status: data.status || "available",
      });

      const thumb = (data.thumbnail_url || "").trim();
      setThumbnailUrl(thumb);

      // Build existing media list from images[] and videos[].
      const imageUrls = toUrlArray(data.images);
      const videoUrls = toUrlArray(data.videos);

      // ── FIX ──────────────────────────────────────────────────────────────
      // Older products were saved with only `thumbnail_url` and an empty
      // `images[]`. Those thumbnails were invisible in this grid, so there was
      // no way to see or replace them. Backfill the thumbnail into the gallery
      // whenever it isn't already there.
      if (thumb && !imageUrls.includes(thumb)) {
        imageUrls.unshift(thumb);
      }

      const images: ExistingMedia[] = imageUrls.map((url) => ({ url, type: "image" }));
      const videos: ExistingMedia[] = videoUrls.map((url) => ({ url, type: "video" }));
      setExistingMedia([...images, ...videos]);

      setLoading(false);
    }
    fetchProduct();
  }, [id]);

  // Add new category inline
  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    setAddingCategory(true);
    let data: any = null;
    let error: { message: string } | null = null;
    try {
      data = await createCategory({ name, slug });   // POST /categories
    } catch (e) {
      error = { message: e instanceof Error ? e.message : "Could not add category" };
    }
    if (error) {
      alert(error.message);
    } else if (data) {
      setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => ({ ...prev, category: data.name }));
      setNewCategoryName("");
      setShowAddCategory(false);
    }
    setAddingCategory(false);
  }

  /** Persist the current gallery + thumbnail to the DB. */
  async function persistMedia(media: ExistingMedia[], thumb: string) {
    const images = media.filter((m) => m.type === "image").map((m) => m.url);
    const videos = media.filter((m) => m.type === "video").map((m) => m.url);
    try {
      await updateProduct(id, {          // PATCH /products/:id
        images,
        videos,
        thumbnail_url: thumb || undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      console.warn("[products/edit] persistMedia failed:", e);
      setUploadError(`Could not save media: ${msg}`);
    }
  }

  // Remove existing media
  async function removeExistingMedia(index: number) {
    const media = existingMedia[index];
    const updated = existingMedia.filter((_, i) => i !== index);
    setExistingMedia(updated);

    const images = updated.filter((m) => m.type === "image").map((m) => m.url);
    const newThumb = thumbnailUrl === media.url ? (images[0] || "") : thumbnailUrl;
    setThumbnailUrl(newThumb);

    await persistMedia(updated, newThumb);

    // delete from S3
    if (media.url.includes("amazonaws.com")) {
      const key = extractS3Key(media.url, "products");
      if (key) await deleteFromS3(key);
    }
  }

  // ── FIX ────────────────────────────────────────────────────────────────────
  // Clicking a thumbnail used to only change local state, so the choice was
  // lost unless you also hit Save — which is why "changing the image" appeared
  // to do nothing in the app. Persist it right away.
  async function setAsThumbnail(url: string) {
    if (url === thumbnailUrl) return;
    setThumbnailUrl(url);
    await persistMedia(existingMedia, url);
  }

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `"${file.name}": unsupported file type.`;
    }
    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? 100 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return `"${file.name}" is too large. Images: 5 MB max, Videos: 100 MB max.`;
    }
    return null;
  }

  // ── FIX ────────────────────────────────────────────────────────────────────
  // Was single-file only and read `existingMedia` from a stale closure, so
  // uploading several files kept only the last one. Uploads run sequentially
  // and accumulate into one local array, then persist in a single write.
  async function uploadFiles(files: File[]) {
    setUploadError("");
    if (files.length === 0) return;

    const errors: string[] = [];
    const valid = files.filter((f) => {
      const err = validateFile(f);
      if (err) { errors.push(err); return false; }
      return true;
    });
    if (errors.length) setUploadError(errors.join(" "));
    if (valid.length === 0) return;

    setUploading(true);
    let media = [...existingMedia];
    let thumb = thumbnailUrl;

    try {
      for (let i = 0; i < valid.length; i++) {
        const file = valid[i];
        setUploadProgress(`Uploading ${i + 1} of ${valid.length}...`);
        const newUrl = await uploadToS3(file, "products");
        const newType: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
        media = [...media, { url: newUrl, type: newType }];
        if (!thumb && newType === "image") thumb = newUrl;
      }

      setExistingMedia(media);
      setThumbnailUrl(thumb);
      await persistMedia(media, thumb);
    } catch (err) {
      console.warn("[products/[id]/edit] data error:", err);
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload. Please try again."
      );
      // Keep whatever did upload successfully.
      setExistingMedia(media);
      setThumbnailUrl(thumb);
      await persistMedia(media, thumb);
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) uploadFiles(files);
    // Reset so selecting the same file again still fires onChange.
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) uploadFiles(files);
  }

  const handleSave = async () => {
    setSaving(true);
    const images = existingMedia.filter((m) => m.type === "image").map((m) => m.url);
    const videos = existingMedia.filter((m) => m.type === "video").map((m) => m.url);

    // ── FIX ────────────────────────────────────────────────────────────────
    // The panel had two independent controls for the same idea: an `in_stock`
    // checkbox and a `status` dropdown containing "sold_out". They could
    // disagree — status "sold_out" with in_stock still true. The mobile app
    // reads ONLY `in_stock` (app/store/[id].tsx), so a product marked sold out
    // via the dropdown kept selling. Derive both from one intent.
    const outOfStock = form.status === "sold_out" || form.in_stock === false;
    const resolvedStatus =
      form.status === "archived"
        ? "archived"
        : outOfStock
          ? "sold_out"
          : "available";

    try {
      // PATCH /products/:id (admin-guarded). Fields the backend DTO does not
      // accept yet are stripped by products-api with a console warning.
      await updateProduct(id, {
        ...form,
        in_stock: !outOfStock,
        status: resolvedStatus,
        price: Number(form.price) || 0,
        original_price: Number(form.original_price) || 0,
        weight_kg: Number(form.weight_kg) || 0,
        // Media is written here too so Save is always authoritative.
        images,
        videos,
        thumbnail_url: thumbnailUrl || undefined,
        features: form.features.split(",").map((f) => f.trim()).filter(Boolean),
      });
      router.push("/products");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      console.warn("[products/[id]/edit] data error:", e);
      alert(`Failed to save: ${msg}`);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <button onClick={() => router.push("/products")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition">
        <ArrowLeft size={18} /> Back to Products
      </button>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>

        {/* Title */}
        <div>
          <label className="text-sm font-medium text-gray-700">Title</label>
          <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>

        {/* Slug */}
        <div>
          <label className="text-sm font-medium text-gray-700">Slug</label>
          <input className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea rows={4} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        {/* Category dropdown with inline add */}
        <div>
          <label className="text-sm font-medium text-gray-700">Category</label>
          <select
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            value={form.category}
            onChange={(e) => {
              if (e.target.value === "__add_new__") {
                setShowAddCategory(true);
              } else {
                setForm({ ...form, category: e.target.value });
                setShowAddCategory(false);
              }
            }}
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
            <option value="__add_new__">➕ Add new category...</option>
          </select>

          {showAddCategory && (
            <div className="mt-2 flex gap-2 items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="text"
                autoFocus
                placeholder="New category name..."
                className="flex-1 border border-gray-300 px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCategory();
                  if (e.key === "Escape") { setShowAddCategory(false); setNewCategoryName(""); }
                }}
              />
              <button type="button" onClick={handleAddCategory} disabled={addingCategory || !newCategoryName.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {addingCategory ? "Adding..." : "Add"}
              </button>
              <button type="button" onClick={() => { setShowAddCategory(false); setNewCategoryName(""); }}
                className="px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-100 transition">
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Features */}
        <div>
          <label className="text-sm font-medium text-gray-700">Features <span className="text-gray-400 font-normal">(comma separated)</span></label>
          <textarea rows={3} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Sale Price (₹)</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="e.g. 299"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              value={form.price === 0 && String(form.price) === "0" ? "" : String(form.price)}
              onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^0-9]/g, "") as unknown as number })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Original Price (₹)</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="e.g. 499"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              value={form.original_price === 0 && String(form.original_price) === "0" ? "" : String(form.original_price)}
              onChange={(e) => setForm({ ...form, original_price: e.target.value.replace(/[^0-9]/g, "") as unknown as number })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">GST Rate (%)</label>
            <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: Number(e.target.value) })}>
              <option value={0}>0% — Exempt</option>
              <option value={5}>5% — Essential goods</option>
              <option value={12}>12% — Standard goods</option>
              <option value={18}>18% — Standard (default)</option>
              <option value={28}>28% — Luxury goods</option>
            </select>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            value={form.status}
            onChange={(e) => {
              const status = e.target.value;
              // Mirror the choice into in_stock so what you see is what saves.
              setForm({
                ...form,
                status,
                in_stock: status === "sold_out" ? false : form.in_stock,
              });
            }}>
            <option value="available">Available</option>
            <option value="sold_out">Sold Out</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Weight */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) — Shiprocket shipping rate</label>
          <input type="number" step="0.001" min="0" value={form.weight_kg}
            onChange={(e) => setForm({ ...form, weight_kg: Number(e.target.value) })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 0.500 — Bulb=0.05, Sensor=0.1, Kit=0.5, Digital=0" />
        </div>

        {/* In Stock */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="in_stock" checked={form.in_stock}
            onChange={(e) => {
              const checked = e.target.checked;
              setForm({
                ...form,
                in_stock: checked,
                // Unticking marks it sold out; re-ticking clears that, but never
                // resurrects an archived product.
                status: checked
                  ? (form.status === "sold_out" ? "available" : form.status)
                  : (form.status === "archived" ? "archived" : "sold_out"),
              });
            }} className="w-4 h-4" />
          <label htmlFor="in_stock" className="text-sm font-medium text-gray-700">In Stock</label>
        </div>

        {/* Product Media */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Product Media
            {existingMedia.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {existingMedia.filter((m) => m.type === "image").length} image(s),{" "}
                {existingMedia.filter((m) => m.type === "video").length} video(s)
              </span>
            )}
          </label>

          {/* Existing media grid */}
          {existingMedia.length > 0 && (
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
              {existingMedia.map((media, index) => (
                <div key={`${media.url}-${index}`}
                  onClick={() => media.type === "image" && setAsThumbnail(media.url)}
                  className={`relative group rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                    thumbnailUrl === media.url ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {media.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media.url} alt="" className="w-full h-24 object-cover" />
                  ) : (
                    <div className="relative w-full h-24 bg-gray-900">
                      <video src={media.url} className="w-full h-full object-cover opacity-80" muted />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play size={24} className="text-white drop-shadow" />
                      </div>
                    </div>
                  )}

                  {thumbnailUrl === media.url && media.type === "image" && (
                    <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <Star size={9} /> Thumb
                    </div>
                  )}

                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-full capitalize">
                    {media.type}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); removeExistingMedia(index); }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mb-2">
            💡 Click an image to set it as the thumbnail (saves immediately). Hover to remove.
          </p>

          {/* Upload drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition ${
              isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <Upload size={24} className="text-gray-400" />
            <p className="text-sm font-medium text-gray-900">
              {uploading ? (uploadProgress || "Uploading...") : "Click or drag & drop to add more"}
            </p>
            <p className="text-xs text-gray-400">
              PNG, JPG, WEBP · MP4, MOV, WEBM — you can select several at once
            </p>
            <input ref={fileInputRef} type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
              className="hidden" onChange={handleFileSelect} />
          </div>

          {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
        </div>

        <button onClick={handleSave} disabled={saving || uploading}
          className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
