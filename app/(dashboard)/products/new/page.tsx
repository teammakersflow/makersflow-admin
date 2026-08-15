"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save, Upload, X, Star, Play } from "lucide-react";
import { uploadToS3 } from "@/lib/s3Upload";

type MediaFile = {
  file: File;
  preview: string;
  type: "image" | "video";
};

type Category = {
  id: string;
  name: string;
};

export default function NewProductPage() {
  const router = useRouter();

  // Form fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [gstRate, setGstRate] = useState("18");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("available");
  const [inStock, setInStock] = useState(true);
  const [weightKg, setWeightKg] = useState("0.500");
  const [features, setFeatures] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // Categories from Supabase
  const [categories, setCategories] = useState<Category[]>([]);

  // Media
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  // Fetch categories on mount
  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");
      if (!error && data) setCategories(data);
    }
    fetchCategories();
  }, []);

  // Auto-generate slug from title
  const handleTitleChange = (value: string) => {
    setTitle(value);
    setSlug(value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
  };

  // Handle file selection (images + videos)
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newMedia: MediaFile[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith("video/") ? "video" : "image",
    }));
    setMediaFiles((prev) => [...prev, ...newMedia]);
  };

  // Remove a media file
  const removeMedia = (index: number) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      const updated = prev.filter((_, i) => i !== index);
      if (thumbnailIndex >= updated.length) setThumbnailIndex(0);
      return updated;
    });
  };



  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;

    // Generate slug from name
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    setAddingCategory(true);
    const { data, error } = await supabase
      .from("categories")
      .insert({ name, slug })   // 👈 add slug here
      .select("id, name")
      .single();

    if (error) {
      alert(error.message);
    } else if (data) {
      setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setCategory(data.name);
      setNewCategoryName("");
      setShowAddCategory(false);
    }
    setAddingCategory(false);
  }

  async function createProduct() {
    if (!title.trim()) {
      alert("Product name is required");
      return;
    }
    if (!price) {
      alert("Sale price is required");
      return;
    }

    setLoading(true);

    // Step 1: Insert product to get the ID
    setUploadProgress("Creating product...");
    const { data: product, error: insertError } = await supabase
      .from("products")
      .insert({
        title,
        slug,
        description,
        price: Number(price) || 0,
        original_price: Number(originalPrice) || 0,
        gst_rate: Number(gstRate) || 18,
        category,
        // ── FIX ────────────────────────────────────────────────────────────
        // Same lockstep rule as the edit page: `status` and `in_stock` are two
        // controls for one idea, and the mobile app reads only `in_stock`.
        // Derive both so a product created as "sold_out" cannot still sell.
        status:
          status === "archived"
            ? "archived"
            : (status === "sold_out" || !inStock)
              ? "sold_out"
              : "available",
        weight_kg: Number(weightKg) || 0.5,
        in_stock: status === "sold_out" ? false : inStock,
        features: features
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      })
      .select()
      .single();

    if (insertError || !product) {
      alert(insertError?.message || "Failed to create product");
      setLoading(false);
      setUploadProgress("");
      return;
    }

    // Step 2: Upload all media files
    const imageUrls: string[] = [];
    const videoUrls: string[] = [];

   for (let i = 0; i < mediaFiles.length; i++) {
      const media = mediaFiles[i];
  setUploadProgress(
    `Uploading ${media.type} ${i + 1} of ${mediaFiles.length}...`
  );
  try {
    const url = await uploadToS3(media.file, 'products');
    if (media.type === "video") videoUrls.push(url);
    else imageUrls.push(url);
  } catch (err) {
    console.error(`Failed to upload ${media.type}:`, err);
  }
}

    // Step 3: Update product with media URLs
    // Step 3: Update product with media URLs
const thumbnailMedia = mediaFiles[thumbnailIndex];
const thumbnailUrl =
  thumbnailMedia?.type === "image" ? imageUrls[thumbnailIndex] || imageUrls[0] : undefined;

setUploadProgress("Saving media...");
const { error: updateError } = await supabase
  .from("products")
  .update({
    images: imageUrls,
    videos: videoUrls,
    thumbnail_url: thumbnailUrl || imageUrls[0] || null,
  })
  .eq("id", product.id);

if (updateError) {
  console.error("Update error:", updateError);
  alert("Failed to save media: " + updateError.message);
  setLoading(false);
  setUploadProgress("");
  return;
}

console.log("Update successful, redirecting...");
setLoading(false);
setUploadProgress("");
router.push("/products");
}

  const imageFiles = mediaFiles.filter((m) => m.type === "image");
  const videoFiles = mediaFiles.filter((m) => m.type === "video");

  return (
    <div className="space-y-6">
      {/* Header */}
      <button
        onClick={() => router.push("/products")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
      >
        <ArrowLeft size={20} /> Back to Products
      </button>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create New Product</h1>
        <p className="mt-2 text-gray-600">Add a new product to your store</p>
      </div>

      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-8 space-y-8">

        {/* ── Product Information ── */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Product Information
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Premium Starter Course Bundle"
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Slug <span className="text-gray-400 text-xs">(auto-generated)</span>
            </label>
            <input
              type="text"
              placeholder="e.g., premium-starter-bundle"
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
            <textarea
              placeholder="Describe your product in detail..."
              rows={4}
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Category dropdown — populated from Supabase categories table */}
          {/* Category dropdown — populated from Supabase categories table */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Category</label>
            <select
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
              value={category}
              onChange={(e) => {
                if (e.target.value === "__add_new__") {
                  setShowAddCategory(true);
                } else {
                  setCategory(e.target.value);
                  setShowAddCategory(false);
                }
              }}
            >
              <option value="">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
              <option value="__add_new__">➕ Add new category...</option>
            </select>

            {showAddCategory && (
              <div className="mt-3 flex gap-2 items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="text"
                  autoFocus
                  placeholder="New category name..."
                  className="flex-1 border border-gray-300 px-3 py-2 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCategory();
                    if (e.key === "Escape") { setShowAddCategory(false); setNewCategoryName(""); }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={addingCategory || !newCategoryName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {addingCategory ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddCategory(false); setNewCategoryName(""); }}
                  className="px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
              </div>
            )}

            {categories.length === 0 && !showAddCategory && (
              <p className="text-xs text-gray-400 mt-1">
                No categories yet.{" "}
                <button type="button" onClick={() => setShowAddCategory(true)} className="text-blue-500 underline hover:text-blue-700">
                  Add one now
                </button>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Features{" "}
              <span className="text-gray-400 text-xs">(comma separated)</span>
            </label>
            <textarea
              placeholder="Feature 1, Feature 2, Feature 3"
              rows={3}
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
            />
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="space-y-6 pb-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Pricing
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Sale Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                placeholder="0"
                className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Original Price (₹){" "}
                <span className="text-gray-400 text-xs">(for strikethrough)</span>
              </label>
              <input
                type="number"
                placeholder="0"
                className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                GST Rate (%)
              </label>
              <select
                className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
              >
                <option value="0">0% — Exempt</option>
                <option value="5">5% — Essential goods</option>
                <option value="12">12% — Standard goods</option>
                <option value="18">18% — Standard (default)</option>
                <option value="28">28% — Luxury goods</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Shown as GST in checkout. Applies on taxable amount after coupon discount.
              </p>
            </div>
          </div>
        </section>

        {/* ── Media Upload ── */}
        <section className="space-y-6 pb-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Product Media
          </h2>

          {/* Drop zone */}
          <label
            htmlFor="media-upload"
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 text-center bg-gray-50 hover:bg-blue-50 hover:border-blue-400 transition cursor-pointer"
          >
            <Upload size={36} className="text-gray-400 mb-3" />
            <p className="text-sm font-semibold text-gray-800">
              Click or drag &amp; drop to upload
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Images: PNG, JPG, WEBP &nbsp;|&nbsp; Videos: MP4, MOV, WEBM
            </p>
            <p className="text-xs text-gray-400 mt-1">Up to 10 files · Images 5 MB · Videos 100 MB</p>
            <input
              id="media-upload"
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleMediaSelect}
            />
          </label>

          {/* Previews */}
          {mediaFiles.length > 0 && (
            <div className="space-y-6">

              {/* Stats row */}
              <div className="flex gap-4 text-sm text-gray-600">
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                  🖼 {imageFiles.length} image{imageFiles.length !== 1 ? "s" : ""}
                </span>
                <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium">
                  🎬 {videoFiles.length} video{videoFiles.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {mediaFiles.map((media, index) => (
                  <div
                    key={index}
                    onClick={() => media.type === "image" && setThumbnailIndex(index)}
                    className={`relative group rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                      thumbnailIndex === index && media.type === "image"
                        ? "border-blue-500 ring-2 ring-blue-300"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {/* Media preview */}
                    {media.type === "image" ? (
                      <img
                        src={media.preview}
                        alt={`media-${index}`}
                        className="w-full h-28 object-cover"
                      />
                    ) : (
                      <div className="relative w-full h-28 bg-gray-900">
                        <video
                          src={media.preview}
                          className="w-full h-full object-cover opacity-80"
                          muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play size={28} className="text-white drop-shadow" />
                        </div>
                      </div>
                    )}

                    {/* Thumbnail badge */}
                    {thumbnailIndex === index && media.type === "image" && (
                      <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star size={10} /> Thumbnail
                      </div>
                    )}

                    {/* Type badge */}
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full capitalize">
                      {media.type}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeMedia(index); }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {/* Add more */}
                <label
                  htmlFor="media-upload-more"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl h-28 text-gray-400 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition"
                >
                  <Upload size={20} />
                  <span className="text-xs mt-1">Add more</span>
                  <input
                    id="media-upload-more"
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleMediaSelect}
                  />
                </label>
              </div>

              <p className="text-xs text-gray-500">
                💡 Click an image to set it as the thumbnail. Hover over any item to remove it.
              </p>
            </div>
          )}
        </section>

        {/* ── Availability ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Availability
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
              <select
                className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="available">Available (Active)</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive / Draft</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) — Shiprocket shipping rate</label>
            <input type="number" step="0.001" min="0" value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 0.500 — Bulb=0.05, Sensor=0.1, Kit=0.5, Digital=0" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700">In Stock</span>
          </label>
        </section>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/products")}
          className="px-6 py-2.5 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </button>

        <button
          onClick={createProduct}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={18} />
          {loading ? uploadProgress || "Creating..." : "Create Product"}
        </button>
      </div>
    </div>
  );
}