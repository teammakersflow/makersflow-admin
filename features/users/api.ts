import { supabase } from '@/lib/supabase';

export async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchUserDetail(userId: string) {
  const [profileRes, enrollmentsRes, purchasesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase
      .from('enrollments')
      .select('*, course:courses(id, title, thumbnail_url)')
      .eq('user_id', userId),
    supabase
      .from('orders')
      .select('*, product:products(id, name, price)')
      .eq('user_id', userId),
  ]);

  return {
    profile: profileRes.data,
    enrollments: enrollmentsRes.data ?? [],
    purchases: purchasesRes.data ?? [],
  };
}