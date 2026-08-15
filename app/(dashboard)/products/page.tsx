"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchProducts, fetchProduct, deleteProduct } from "@/lib/products-api";
import { Search, Plus, Edit2, Trash2, Eye, Package } from "lucide-react";
import { deleteFromS3, extractS3Key } from "@/lib/s3Upload";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

type Product = {
  id: string; title: string; category: string; price: number;
  gst_rate: number; stock_quantity: number;
  status: string; thumbnail_url: string; in_stock: boolean;
  created_at?: string | null;
};

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
      <div className="h-36 bg-gray-100 rounded-xl mb-3" />
      <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
      <div className="flex justify-between"><div className="h-5 bg-gray-100 rounded w-16" /><div className="h-6 bg-gray-100 rounded w-20" /></div>
    </div>
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortField, setSortField] = useState<"created_at"|"price"|"stock_quantity">("created_at");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      try {
        const list = await fetchProducts();          // GET /products
        setProducts(list as unknown as Product[]);
      } catch (e) {
        console.warn("[products] could not load products:", e);
      }
      setLoading(false);
    }
    loadProducts();
  }, []);

  const handleView = (id: string) => { router.push(`/products/${id}`); };
  const handleEdit = (id: string) => { router.push(`/products/${id}/edit`); };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      // Read the media URLs first — after DELETE they are gone.
      const product = await fetchProduct(id);        // GET /products/:id
      try {
        await deleteProduct(id);                     // DELETE /products/:id
      } catch (err) {
        alert(`Failed to delete: ${err instanceof Error ? err.message : "unknown error"}`);
        return;
      }
      setProducts(prev => prev.filter(p => p.id !== id));
      if (product) {
        const urls = [...(product.images || []), ...(product.videos || [])];
        for (const url of urls) {
          const key = extractS3Key(url, "products");
          if (key) await deleteFromS3(key);
        }
      }
    } catch (e) { console.warn("[products] data error:", e); }
    finally { setDeletingId(null); }
  };

  const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const filteredProducts = products.filter(product => {
    if (search && !product.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "all" && product.category !== categoryFilter) return false;
    if (stockFilter === "out" && product.stock_quantity !== 0) return false;
    if (stockFilter === "low" && !((product.stock_quantity ?? -1) > 0 && (product.stock_quantity ?? -1) <= 3)) return false;
    if (stockFilter === "ok" && (product.stock_quantity ?? -1) <= 3) return false;
    return true;
  }).sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortField === "price") return ((a.price ?? 0) - (b.price ?? 0)) * mul;
    if (sortField === "stock_quantity") return ((a.stock_quantity ?? 999) - (b.stock_quantity ?? 999)) * mul;
    return (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()) * mul;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-100 text-green-800";
      case "sold_out":  return "bg-red-100 text-red-800";
      case "archived":  return "bg-gray-100 text-gray-800";
      default:          return "bg-blue-100 text-blue-800";
    }
  };

  const formatStatus = (status: string) => {
    if (!status) return "Active";
    // ── FIX ────────────────────────────────────────────────────────────────
    // charAt(0) was taken from the underscore-replaced string but slice(1)
    // from the original, so "sold_out" rendered as "Sold_out" — the underscore
    // survived. Replace once, then capitalise that same string.
    const label = status.replace(/_/g, " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description={`${products.length} products in your store`}
        action={{ label: "Add Product", href: "/products/new" }}>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-56" />
        </div>
      </PageHeader>

      {/* Extra filters */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          {uniqueCategories.length > 0 && (
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 outline-none focus:bg-white focus:border-blue-400">
              <option value="all">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 outline-none focus:bg-white focus:border-blue-400">
            <option value="all">All Stock</option>
            <option value="out">Out of Stock</option>
            <option value="low">Low Stock (≤3)</option>
            <option value="ok">In Stock</option>
          </select>
          <select value={sortField} onChange={e => setSortField(e.target.value as any)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 outline-none focus:bg-white focus:border-blue-400">
            <option value="created_at">Sort: Newest</option>
            <option value="price">Sort: Price</option>
            <option value="stock_quantity">Sort: Stock</option>
          </select>
          <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 hover:bg-white transition">
            {sortDir === "desc" ? "↓ Desc" : "↑ Asc"}
          </button>
        </div>
      )}

      {/* Summary */}
      {!loading && (
        <div className="flex gap-4 flex-wrap">
          {[
            { label: "Total", value: products.length, color: "bg-gray-50 text-gray-600" },
            { label: "In Stock", value: products.filter(p => p.in_stock !== false).length, color: "bg-green-50 text-green-700" },
            { label: "Low Stock (≤3)", value: products.filter(p => (p.stock_quantity ?? -1) > 0 && (p.stock_quantity ?? -1) <= 3).length, color: "bg-amber-50 text-amber-700" },
          ].map(s => (
            <div key={s.label} className={`px-4 py-2 rounded-xl text-sm font-medium ${s.color}`}>
              {s.label}: <span className="font-bold">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState icon={Package}
          title={search ? "No products found" : "No products yet"}
          description={search ? `No products match "${search}"` : "Add your first product to start selling"}
          action={!search ? { label: "Add Product", href: "/products/new" } : undefined} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all group">
              {/* Thumbnail */}
              <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                {product.thumbnail_url ? (
                  <img src={product.thumbnail_url} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={32} className="text-gray-300" />
                  </div>
                )}
                {/* Stock badge */}
                {(product.stock_quantity ?? -1) > 0 && (product.stock_quantity ?? -1) <= 3 && (
                  <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 bg-amber-500 text-white rounded-full">
                    Low stock
                  </span>
                )}
                {/* Action overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
                  <div className="flex gap-1">
                    <button onClick={() => router.push(`/products/${product.id}`)}
                      className="p-1.5 bg-white rounded-lg shadow text-blue-600 hover:bg-blue-50 transition">
                      <Eye size={13} />
                    </button>
                    <button onClick={() => router.push(`/products/${product.id}/edit`)}
                      className="p-1.5 bg-white rounded-lg shadow text-gray-600 hover:bg-gray-50 transition">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(product.id)} disabled={deletingId === product.id}
                      className="p-1.5 bg-white rounded-lg shadow text-red-500 hover:bg-red-50 transition disabled:opacity-40">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="font-semibold text-gray-900 text-sm truncate" title={product.title}>{product.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{product.category || "Uncategorized"}</p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-base font-bold text-gray-900">₹{product.price?.toLocaleString()}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    product.gst_rate === 0 ? "bg-gray-100 text-gray-500" :
                    product.gst_rate <= 5 ? "bg-green-50 text-green-600" :
                    product.gst_rate <= 12 ? "bg-blue-50 text-blue-600" :
                    "bg-amber-50 text-amber-600"
                  }`}>GST {product.gst_rate ?? 18}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredProducts.length > 0 && (
        <p className="text-sm text-gray-400">Showing {filteredProducts.length} of {products.length} products</p>
      )}
    </div>
  );
}