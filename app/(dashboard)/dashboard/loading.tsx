export default function DashboardLoading() {
  return (
    <div className="space-y-7 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-gray-200 rounded-lg" />
        <div className="h-4 w-32 bg-gray-200 rounded-md" />
      </div>

      {/* Top KPIs Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-8 w-16 bg-gray-200 rounded-lg" />
            <div className="h-3 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Secondary KPIs Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="h-6 w-12 bg-gray-200 rounded-md" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="h-5 w-36 bg-gray-200 rounded" />
              <div className="h-3.5 w-48 bg-gray-200 rounded" />
            </div>
            <div className="h-4 w-16 bg-gray-200 rounded" />
          </div>
          <div className="h-[200px] bg-gray-50 rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="space-y-1">
            <div className="h-5 w-24 bg-gray-200 rounded" />
            <div className="h-3.5 w-32 bg-gray-200 rounded" />
          </div>
          <div className="h-[200px] bg-gray-50 rounded-xl" />
        </div>
      </div>

      {/* Lists Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((list) => (
          <div key={list} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-3.5 w-16 bg-gray-200 rounded" />
            </div>
            <div className="divide-y divide-gray-100 px-6 py-2">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="py-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 bg-gray-200 rounded" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                  </div>
                  <div className="space-y-1.5 text-right">
                    <div className="h-3.5 w-12 bg-gray-200 rounded ml-auto" />
                    <div className="h-3 w-16 bg-gray-200 rounded ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
