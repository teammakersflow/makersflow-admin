import { backendApi } from "@/lib/backend-api";

export async function fetchAllUsers() {
  const { data, error } = await backendApi
    .endpoint("/users")
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchUserDetail(userId: string) {
  const [profileRes, enrollmentsRes, purchasesRes] = await Promise.all([
    backendApi.endpoint("/users").select('*').eq('id', userId).single(),
    backendApi
      .endpoint("/enrollments")
      .select('*, course:courses(id, title, thumbnail_url)')
      .eq('user_id', userId),
    backendApi
      .endpoint("/orders")
      .select('*, product:products(id, name, price)')
      .eq('user_id', userId),
  ]);

  return {
    profile: profileRes.data,
    enrollments: enrollmentsRes.data ?? [],
    purchases: purchasesRes.data ?? [],
  };
}