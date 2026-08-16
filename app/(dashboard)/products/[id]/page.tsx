"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { fetchProduct } from "@/lib/products-api";
import { fetchOrders, fetchUserMap } from "@/lib/orders-api";
import { ArrowLeft, Edit2, Package, DollarSign, ShoppingCart, BarChart2, Star, Image as ImageIcon, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";

type Product = {
  id: string; title: string; slug?: string; description?: string;
  category?: string; price: number; original_price?: number;
  gst_rate?: number; stock_quantity?: number; in_stock?: boolean;
  status?: string; thumbnail_url?: string; created_at: string;
  features?: string[] | string;
};

type RecentOrder = {
  id: string; created_at: string; total_amount: number; status: string;
  profiles?: { email: string; full_name: string | null } | null;
};

type Analytics = {
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
  recentOrders: RecentOrder[];
};

function Stat({ icon: Icon, label, value, color = "text-blue-600", bg = "bg-blue-50" }: {
  icon: typeof Package; label: string; value: string | number;
  color?: string; bg?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className={`inline-flex p-2.5 rounded-xl ${bg} mb-3`}>
        <Icon size={18} className={color} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default function ViewProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [analytics, setAnalytics] = useState<Analytics>({ totalOrders: 0, paidOrders: 0, totalRevenue: 0, recentOrders: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      // GET /products/:id, GET /orders and GET /users.
      // The buyer email previously came from an embedded join
      // (`profiles(email, full_name)`), which REST cannot do — users are
      // fetched separately and joined in memory below.
      const [prod, allOrders, userMap] = await Promise.all([
        fetchProduct(id),
        fetchOrders().catch(() => []),
        fetchUserMap().catch(() => new Map()),
      ]);

      if (prod) setProduct(prod as unknown as Product);

      // Filter orders that contain this product in items array
      const allOrdersTyped = allOrders
        .filter((o) => o.status !== "cancelled")
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .map((o) => {
          const u = userMap.get(o.user_id);
          return {
            id: o.id,
            created_at: o.created_at,
            total_amount: o.total_amount,
            status: o.status,
            items: Array.isArray(o.items) ? o.items : [],
            profiles: u ? { email: u.email ?? "", full_name: u.full_name ?? null } : null,
          };
        }) as Array<{
        id: string; created_at: string; total_amount: number; status: string;
        profiles?: { email: string; full_name: string | null } | null;
        items?: Array<{ id?: string; title?: string; qty?: number; price?: number }>;
      }>;

      const productOrders = allOrdersTyped.filter(o => {
        const items = Array.isArray(o.items) ? o.items : [];
        return items.some((item: { id?: string }) => item.id === id);
      });

      // Paid orders = status is paid, shipped, or delivered
      const paidOrders = productOrders.filter(o =>
        o.status === "paid" || o.status === "shipped" || o.status === "delivered"
      );

      // Revenue only from paid orders
      const revenue = paidOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);

      setAnalytics({
        totalOrders: productOrders.length,
        paidOrders: paidOrders.length,
        totalRevenue: revenue,
        recentOrders: paidOrders.slice(0, 8) as RecentOrder[],
      });
      setLoading(false);
    }
    fetchAll();
  }, [id]);

  if (loading) return (
    <div className="space-y-6 max-w-4xl">
      <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse" />
      <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );

  if (!product) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Package size={40} className="text-gray-300 mb-3" />
      <p className="text-gray-500">Product not found</p>
      <button onClick={() => router.push("/products")} className="mt-4 text-blue-600 hover:underline text-sm">
        Back to Products
      </button>
    </div>
  );

  const features = Array.isArray(product.features)
    ? product.features
    : typeof product.features === "string" && product.features
      ? product.features.split(",").map((f: string) => f.trim()).filter(Boolean)
      : [];

  const stockQty = product.stock_quantity ?? -1;
  const stockStatus =
    stockQty < 0 ? { label: "Unlimited Stock", color: "bg-blue-50 text-blue-700" } :
    stockQty === 0 ? { label: "Out of Stock", color: "bg-red-50 text-red-700" } :
    stockQty < 5 ? { label: `Critical Low Stock (${stockQty})`, color: "bg-red-50 text-red-700" } :
    stockQty < 10 ? { label: `Low Stock (${stockQty})`, color: "bg-amber-50 text-amber-700" } :
    { label: `In Stock (${stockQty})`, color: "bg-green-50 text-green-700" };

  const STATUS_COLOR: Record<string, string> = {
    pending:   "bg-amber-50 text-amber-700",
    paid:      "bg-blue-50 text-blue-700",
    shipped:   "bg-purple-50 text-purple-700",
    delivered: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <button onClick={() => router.push("/products")}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition text-sm">
        <ArrowLeft size={16} /> Back to Products
      </button>

      {/* Product header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-0">
          {/* Thumbnail */}
          <div className="sm:w-64 shrink-0">
            {product.thumbnail_url ? (
              <img src={product.thumbnail_url} alt={product.title}
                className="w-full h-48 sm:h-full object-cover" />
            ) : (
              <div className="w-full h-48 sm:h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <ImageIcon size={36} className="text-gray-300" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {product.category && (
                    <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
                      {product.category}
                    </span>
                  )}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stockStatus.color}`}>
                    {stockStatus.label}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{product.title}</h1>
                {product.slug && (
                  <p className="text-xs text-gray-400 mt-1 font-mono">/{product.slug}</p>
                )}
              </div>
              <Link href={`/products/${id}/edit`}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition text-sm font-medium shrink-0">
                <Edit2 size={14} /> Edit
              </Link>
            </div>

            {product.description && (
              <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-3">
                {product.description}
              </p>
            )}

            {/* Low stock warning banner */}
            {stockQty >= 0 && stockQty < 10 && (
              <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                stockQty === 0 ? "bg-red-50 text-red-700 border border-red-100" : "bg-amber-50 text-amber-700 border border-amber-100"
              }`}>
                <AlertTriangle size={13} />
                {stockQty === 0
                  ? "This product is out of stock and not available for purchase"
                  : `Only ${stockQty} unit${stockQty === 1 ? "" : "s"} left — consider restocking soon`
                }
              </div>
            )}

            {/* Price + details grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-gray-100 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Sale Price</p>
                <p className="font-bold text-green-600 text-lg mt-0.5">₹{product.price?.toLocaleString()}</p>
              </div>
              {(product.original_price ?? 0) > 0 && (
                <div>
                  <p className="text-gray-400 text-xs">Original Price</p>
                  <p className="font-medium text-gray-500 mt-0.5 line-through">₹{product.original_price?.toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-gray-400 text-xs">GST Rate</p>
                <p className="font-semibold text-gray-900 mt-0.5">{product.gst_rate ?? 18}%</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Added On</p>
                <p className="font-medium text-gray-900 mt-0.5">
                  {new Date(product.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>

            {/* Features */}
            {features.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Features</p>
                <div className="flex flex-wrap gap-2">
                  {features.map((f: string, i: number) => (
                    <span key={i} className="text-xs bg-gray-50 border border-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart2 size={18} className="text-blue-500" /> Purchase Analytics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat icon={ShoppingCart} label="Total Orders" value={analytics.totalOrders}
            color="text-gray-600" bg="bg-gray-50" />
          <Stat icon={TrendingUp} label="Paid Orders" value={analytics.paidOrders}
            color="text-blue-600" bg="bg-blue-50" />
          <Stat icon={DollarSign} label="Revenue (Paid)" value={`₹${analytics.totalRevenue.toLocaleString()}`}
            color="text-green-600" bg="bg-green-50" />
          <Stat icon={Star} label="Unit Price" value={`₹${product.price?.toLocaleString()}`}
            color="text-amber-600" bg="bg-amber-50" />
        </div>
      </div>

      {/* Purchase History — only PAID orders */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Purchase History (Paid Orders)</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
              {analytics.paidOrders} paid orders
            </span>
            <Link href="/orders" className="text-xs text-blue-600 hover:underline">View all orders →</Link>
          </div>
        </div>
        {analytics.recentOrders.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <ShoppingCart size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-900">No paid orders yet</p>
            <p className="text-xs text-gray-400 mt-1">Orders appear here once payment is completed</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Order Total</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentOrders.map(o => (
                <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-gray-900">
                      {(o.profiles as any)?.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400">{(o.profiles as any)?.email ?? o.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-6 py-3 text-sm font-semibold text-gray-900">
                    ₹{o.total_amount?.toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[o.status] ?? "bg-gray-50 text-gray-600"}`}>
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500">
                    {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
