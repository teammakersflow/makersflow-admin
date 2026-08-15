"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Save, Upload, X } from "lucide-react";

export default function NewArticlePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(false);

  // Thumbnail states
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleThumbnailSelect(file: File) {
    setUploadError("");
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadError("Unsupported file type. Use PNG, JPG, or WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File too large. Max 5 MB.");
      return;
    }
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleThumbnailSelect(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleThumbnailSelect(file);
  }

  function removeThumbnail() {
    setThumbnailFile(null);
    setThumbnailPreview("");
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadThumbnail(): Promise<string | null> {
    if (!thumbnailFile) return null;
    setUploading(true);
    const ext = thumbnailFile.name.split(".").pop();
    const fileName = `news-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("news-images") // 👈 tell your backend dev to create this bucket
      .upload(fileName, thumbnailFile, { cacheControl: "3600", upsert: false });

    if (error) {
      setUploadError(error.message);
      setUploading(false);
      return null;
    }

    const { data } = supabase.storage.from("news-images").getPublicUrl(fileName);
    setUploading(false);
    return data.publicUrl;
  }

  async function createArticle() {
    if (!title.trim()) {
      alert("Article title is required");
      return;
    }

    setLoading(true);

    // Upload thumbnail first if selected
    const thumbnailUrl = await uploadThumbnail();

    const { error } = await supabase.from("news").insert({
      title,
      slug,
      content,
      status,
      thumbnail_url: thumbnailUrl, // 👈 tell backend dev to add this column
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/news");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/news")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft size={20} />
          Back to News
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Publish New Article</h1>
        <p className="mt-2 text-gray-600">
          Create and publish a news article to keep your community updated
        </p>
      </div>

      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-8 space-y-8">
        {/* Article Details */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Article Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Article Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Q4 Updates and Announcements"
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={title}
              onChange={(e) => {
                const newTitle = e.target.value;
                setTitle(newTitle);
                setSlug(
                  newTitle.toLowerCase().trim()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-")
                    .replace(/-+/g, "-")
                );
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Slug</label>
            <input
              type="text"
              placeholder="e.g., q4-updates-announcements"
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Auto-generated URL-friendly name</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Article Content <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="Write your article content here..."
              rows={8}
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Thumbnail Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Thumbnail Image
              <span className="text-gray-400 font-normal text-xs ml-2">(PNG, JPG, WEBP · max 5 MB)</span>
            </label>

            {!thumbnailPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition ${
                  isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                <Upload size={28} className="text-gray-400" />
                <p className="text-sm font-medium text-gray-800">Click or drag & drop to upload</p>
                <p className="text-xs text-gray-400">PNG, JPG, WEBP up to 5 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            ) : (
              <div className="relative inline-block">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-full max-w-sm h-48 object-cover rounded-xl border border-gray-200"
                />
                <button
                  type="button"
                  onClick={removeThumbnail}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
          </div>
        </div>

        {/* Publishing */}
        <div className="space-y-6 pb-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Publishing</h2>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
            <select
              className="w-full border border-gray-300 px-4 py-2.5 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <p className="text-xs text-gray-500">
            {status === "draft"
              ? "This article will be saved as a draft and not visible to the public."
              : "This article will be published immediately and visible to everyone."}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => router.push("/news")}
          className="px-6 py-2.5 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={createArticle}
          disabled={loading || uploading}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={18} />
          {uploading ? "Uploading..." : loading ? "Publishing..." : "Publish Article"}
        </button>
      </div>
    </div>
  );
}