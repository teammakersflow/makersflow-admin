"use client";

import { useRef, useState, useEffect } from "react";
import { ImagePlus, X, Loader2, Star } from "lucide-react";
import { Category, CourseFormData } from "@/types/course";
import { fetchCategories } from "@/lib/course-api";
import { createCategory } from "@/lib/categories-api";
import { uploadToS3, deleteFromS3, extractS3Key } from "@/lib/s3Upload";

interface Props {
  initialData?: Partial<CourseFormData>;
  onNext: (data: CourseFormData) => void;
  isSubmitting?: boolean;
}

const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function Step1CourseDetails({
  initialData,
  onNext,
  isSubmitting,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [thumbPreview, setThumbPreview] = useState<string | null>(
    initialData?.thumbnail_url || null
  );
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Gallery state — courses now support multiple images, same as products.
  // The first entry doubles as the thumbnail unless another is chosen.
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [galleryProgress, setGalleryProgress] = useState("");
  const [galleryError, setGalleryError] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof CourseFormData, string>>>({});

  // New category states
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [form, setForm] = useState<CourseFormData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    slug: initialData?.slug || "",
    category: initialData?.category || "",
    thumbnail_url: initialData?.thumbnail_url || "",
    images: initialData?.images ?? [],
    level: initialData?.level || "Beginner",
    price: initialData?.price != null ? String(initialData.price) : "",
    gst_rate: initialData?.gst_rate ?? 18,
    is_free: initialData?.is_free ?? false,
    is_published: initialData?.is_published ?? false,
  });

  // Load categories
  useEffect(() => {
    // Backend serialises BigInt ids as strings (see main.ts), so this
    // matches the Category type.
    fetchCategories().then((list) => setCategories(list as unknown as Category[]));
  }, []);

  function set<K extends keyof CourseFormData>(key: K, value: CourseFormData[K]) {
    setForm((prev) => {
      const updated = { ...prev };
      updated[key] = value;
      // Auto-generate slug when title changes
      if (key === "title" && !slugManuallyEdited) {
        updated.slug = slugify(value as string);
      }
      return updated;
    });
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

async function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;

  const localUrl = URL.createObjectURL(file);
  setThumbPreview(localUrl);
  setUploadingThumb(true);

  try {
    // delete old thumbnail from S3 if it exists and is an S3 URL
    if (form.thumbnail_url && form.thumbnail_url.includes('amazonaws.com')) {
      const oldKey = extractS3Key(form.thumbnail_url, 'courses');
      if (oldKey) await deleteFromS3(oldKey);
    }

    const publicUrl = await uploadToS3(file, 'courses');
    set("thumbnail_url", publicUrl);
  } catch (err) {
    console.warn("[components/courses/Step1CourseDetails] data error:", err);
    alert("Failed to upload thumbnail. Please try again.");
    setThumbPreview(null);
  } finally {
    setUploadingThumb(false);
  }
}

  function removeThumbnail() {
    setThumbPreview(null);
    set("thumbnail_url", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Gallery: upload one or many images ──────────────────────────────────
  async function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    setGalleryError("");
    const valid: File[] = [];
    const errs: string[] = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        errs.push(`"${f.name}" is not an image.`);
      } else if (f.size > 5 * 1024 * 1024) {
        errs.push(`"${f.name}" is larger than 5 MB.`);
      } else {
        valid.push(f);
      }
    }
    if (errs.length) setGalleryError(errs.join(" "));
    if (valid.length === 0) return;

    setUploadingGallery(true);
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < valid.length; i++) {
        setGalleryProgress(`Uploading ${i + 1} of ${valid.length}...`);
        uploaded.push(await uploadToS3(valid[i], "courses"));
      }
    } catch (err) {
      console.warn("[components/courses/Step1CourseDetails] data error:", err);
      setGalleryError(
        err instanceof Error ? err.message : "Failed to upload one or more images."
      );
    } finally {
      if (uploaded.length) {
        setForm((prev) => {
          const nextImages = [...(prev.images ?? []), ...uploaded];
          return {
            ...prev,
            images: nextImages,
            // Adopt the first upload as thumbnail if none is set yet.
            thumbnail_url: prev.thumbnail_url || nextImages[0] || "",
          };
        });
        setThumbPreview((prev) => prev || uploaded[0]);
      }
      setUploadingGallery(false);
      setGalleryProgress("");
    }
  }

  function removeGalleryImage(url: string) {
    setForm((prev) => {
      const nextImages = (prev.images ?? []).filter((u) => u !== url);
      const nextThumb =
        prev.thumbnail_url === url ? nextImages[0] || "" : prev.thumbnail_url;
      setThumbPreview(nextThumb || null);
      return { ...prev, images: nextImages, thumbnail_url: nextThumb };
    });
    if (url.includes("amazonaws.com")) {
      const key = extractS3Key(url, "courses");
      if (key) deleteFromS3(key).catch(() => {});
    }
  }

  function makeThumbnail(url: string) {
    set("thumbnail_url", url);
    setThumbPreview(url);
  }

  async function handleAddCategory() {
    const name = newCategory.trim();
    if (!name) return;

    setSavingCategory(true);
    try {
      // POST /categories
      const data = await createCategory({ name, slug: slugify(name) });

      setCategories((prev) => [...prev, data as any]);
      set("category", data.name);
      setIsAddingCategory(false);
      setNewCategory("");
    } catch (err) {
      console.warn("[components/courses/Step1CourseDetails] data error:", err);
      alert("Failed to add category. Please try again.");
    } finally {
      setSavingCategory(false);
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof CourseFormData, string>> = {};

    if (!form.title.trim()) newErrors.title = "Course title is required";
    if (!form.slug.trim()) newErrors.slug = "Slug is required";
    if (!form.category) newErrors.category = "Please select a category";
    if (!form.is_free && Number(form.price) <= 0)
      newErrors.price = "Enter a valid price or mark the course as free";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    // Guarantee the thumbnail is also present in the gallery so the app's
    // swiper always has at least one image to show.
    const images = [...(form.images ?? [])];
    if (form.thumbnail_url && !images.includes(form.thumbnail_url)) {
      images.unshift(form.thumbnail_url);
    }
    onNext({ ...form, images, price: Number(form.price) || 0 });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Basic information</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Set the core details of your course
        </p>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">
          Course title <span className="text-red-500">*</span>
        </label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g., Introduction to React"
          className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${errors.title ? "border-red-400 bg-red-50" : "border-gray-300"}`}
        />
        {errors.title && (
          <p className="text-xs text-red-500">{errors.title}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe what students will learn in this course..."
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none transition
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>

      {/* Slug + Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Slug */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            Slug <span className="text-red-500">*</span>
          </label>
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugManuallyEdited(true);
              set("slug", slugify(e.target.value));
            }}
            placeholder="auto-generated-from-title"
            className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${errors.slug ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          />
          {form.slug && (
            <p className="text-xs text-gray-400">
              yoursite.com/courses/
              <span className="text-blue-500">{form.slug}</span>
            </p>
          )}
          {errors.slug && (
            <p className="text-xs text-red-500">{errors.slug}</p>
          )}
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">
            Category <span className="text-red-500">*</span>
          </label>

          {!isAddingCategory ? (
            <select
              value={form.category}
              onChange={(e) => {
                if (e.target.value === "__add_new__") {
                  setIsAddingCategory(true);
                  set("category", "");
                } else {
                  set("category", e.target.value);
                }
              }}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white
                ${errors.category ? "border-red-400 bg-red-50" : "border-gray-300"}`}
            >
              <option value="">— Select a category —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
              <option value="__add_new__">+ Add new category</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter category name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCategory();
                  if (e.key === "Escape") {
                    setIsAddingCategory(false);
                    setNewCategory("");
                  }
                }}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                  outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                disabled={savingCategory || !newCategory.trim()}
                onClick={handleAddCategory}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg
                  hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center gap-1"
              >
                {savingCategory ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Add"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingCategory(false);
                  setNewCategory("");
                }}
                className="px-3 py-2 border border-gray-200 text-gray-500 text-sm
                  rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          )}

          {errors.category && (
            <p className="text-xs text-red-500">{errors.category}</p>
          )}
        </div>
      </div>

      {/* Thumbnail upload */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Thumbnail</label>

        {thumbPreview ? (
          <div className="relative w-full max-w-xs">
            <img
              src={thumbPreview}
              alt="Thumbnail preview"
              className="w-full h-40 object-cover rounded-lg border border-gray-200"
            />
            {uploadingThumb && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg">
                <Loader2 size={22} className="animate-spin text-blue-500" />
              </div>
            )}
            {!uploadingThumb && (
              <button
                onClick={removeThumbnail}
                className="absolute top-2 right-2 bg-white border border-gray-200 rounded-full p-1
                  shadow-sm hover:bg-red-50 hover:border-red-300 transition"
              >
                <X size={14} className="text-gray-500" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-xs h-40 border-2 border-dashed border-gray-300 rounded-lg
              flex flex-col items-center justify-center gap-2 text-gray-400
              hover:border-blue-400 hover:text-blue-500 transition cursor-pointer"
          >
            <ImagePlus size={28} />
            <span className="text-sm">Click to upload thumbnail</span>
            <span className="text-xs text-gray-400">PNG, JPG up to 5MB</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleThumbnailChange}
        />
      </div>

      {/* ── Course gallery (multiple images) ──────────────────────────────── */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">
          Gallery images
          {(form.images ?? []).length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {(form.images ?? []).length} image(s)
            </span>
          )}
        </label>
        <p className="text-xs text-gray-400">
          Learners can swipe through these on the course page. Click one to make
          it the thumbnail.
        </p>

        {(form.images ?? []).length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-1">
            {(form.images ?? []).map((url, index) => (
              <div
                key={`${url}-${index}`}
                onClick={() => makeThumbnail(url)}
                className={`relative group rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                  form.thumbnail_url === url
                    ? "border-blue-500 ring-2 ring-blue-300"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-24 object-cover" />

                {form.thumbnail_url === url && (
                  <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Star size={9} /> Thumb
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeGalleryImage(url);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploadingGallery}
          className="mt-2 w-full border-2 border-dashed border-gray-300 rounded-lg
            px-6 py-6 flex flex-col items-center justify-center gap-2 text-gray-400
            hover:border-blue-400 hover:text-blue-500 transition cursor-pointer
            disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploadingGallery ? (
            <Loader2 size={22} className="animate-spin text-blue-500" />
          ) : (
            <ImagePlus size={22} />
          )}
          <span className="text-sm font-medium">
            {uploadingGallery
              ? galleryProgress || "Uploading..."
              : "Click to add gallery images"}
          </span>
          <span className="text-xs text-gray-400">
            PNG, JPG up to 5MB — you can select several at once
          </span>
        </button>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleGallerySelect}
        />

        {galleryError && (
          <p className="text-xs text-red-500">{galleryError}</p>
        )}
      </div>

      {/* Level + Price */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Level */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Level</label>
          <select
            value={form.level}
            onChange={(e) =>
              set("level", e.target.value as CourseFormData["level"])
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none
              transition focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Price (₹)</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="e.g. 999"
            value={form.is_free ? "" : form.price}
            disabled={form.is_free}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "");
              set("price", val);
            }}
            className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${form.is_free ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "border-gray-300"}
              ${errors.price ? "border-red-400 bg-red-50" : ""}`}
          />
          {errors.price && (
            <p className="text-xs text-red-500">{errors.price}</p>
          )}
        </div>

        {/* GST Rate */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">GST Rate (%)</label>
          <select
            value={form.gst_rate}
            onChange={(e) => set("gst_rate", Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={0}>0% — Exempt</option>
            <option value={5}>5% — Essential goods</option>
            <option value={12}>12% — Standard goods</option>
            <option value={18}>18% — Standard (default)</option>
            <option value={28}>28% — Luxury goods</option>
          </select>
          <p className="text-xs text-gray-500">Applied at checkout on taxable amount after coupon discount.</p>
        </div>
      </div>

      {/* Free toggle */}
      <label className="flex items-center gap-3 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={form.is_free}
          onChange={(e) => {
            set("is_free", e.target.checked);
            if (e.target.checked) set("price", 0);
          }}
          className="w-4 h-4 accent-blue-600"
        />
        <span className="text-sm text-gray-700">Make this course free</span>
      </label>

      {/* Divider */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Publishing</h3>
        <label className="flex items-center gap-3 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => set("is_published", e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm text-gray-700">Publish course immediately</span>
        </label>
        <p className="text-xs text-blue-500">
          Published courses will be visible to students
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || uploadingThumb || uploadingGallery}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg
            hover:bg-blue-700 transition font-medium text-sm
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : null}
          {isSubmitting ? "Saving..." : "Save & continue →"}
        </button>
      </div>
    </div>
  );
}