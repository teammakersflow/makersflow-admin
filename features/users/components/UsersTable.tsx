'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/users';
import { Search, Download, UserCheck, Shield, Clock, Filter } from 'lucide-react';

interface Props { onSelectUser: (user: UserProfile) => void; }

export default function UsersTable({ onSelectUser }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortField, setSortField] = useState<'created_at'|'last_sign_in_at'>('created_at');

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setUsers(data ?? []); setLoading(false); });

    const channel = supabase.channel('realtime-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        if (payload.eventType === 'INSERT') setUsers(p => [payload.new as UserProfile, ...p]);
        else if (payload.eventType === 'UPDATE') setUsers(p => p.map(u => u.id === (payload.new as UserProfile).id ? payload.new as UserProfile : u));
        else if (payload.eventType === 'DELETE') setUsers(p => p.filter(u => u.id !== (payload.old as UserProfile).id));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  }).sort((a, b) => {
    const av = (a as any)[sortField] ?? '';
    const bv = (b as any)[sortField] ?? '';
    return bv.localeCompare(av);
  }), [users, search, roleFilter, sortField]);

  const exportCSV = () => {
    const rows = [['Name', 'Email', 'Role', 'Joined', 'Last Login']];
    filtered.forEach(u => rows.push([
      u.full_name ?? '', u.email ?? '', u.role ?? '',
      new Date(u.created_at).toLocaleDateString('en-IN'),
      u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-IN') : 'Never',
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `users_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const uniqueRoles = [...new Set(users.map(u => u.role).filter(Boolean))];
  const newThisMonth = users.filter(u => new Date(u.created_at) >= new Date(Date.now() - 30*86400000)).length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: users.length, icon: UserCheck, color: 'text-blue-600 bg-blue-50' },
          { label: 'New This Month', value: newThisMonth, icon: Clock, color: 'text-green-600 bg-green-50' },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: Shield, color: 'text-purple-600 bg-purple-50' },
          { label: 'Showing', value: filtered.length, icon: Filter, color: 'text-gray-600 bg-gray-50' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`inline-flex p-2 rounded-lg mb-2 ${s.color}`}><Icon size={16} /></div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters + Export */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search by name, email or user ID..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white">
          <option value="all">All Roles</option>
          {uniqueRoles.map(r => <option key={r} value={r}>{(r ?? '').charAt(0).toUpperCase() + (r ?? '').slice(1)}</option>)}
        </select>
        <select value={sortField} onChange={e => setSortField(e.target.value as any)}
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white">
          <option value="created_at">Sort: Newest first</option>
          <option value="last_sign_in_at">Sort: Recently active</option>
        </select>
        <button onClick={exportCSV}
          className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs border-b border-gray-100">
              <tr>
                <th className="px-6 py-3.5 text-left">User</th>
                <th className="px-6 py-3.5 text-left">Role</th>
                <th className="px-6 py-3.5 text-left">Joined</th>
                <th className="px-6 py-3.5 text-left">Last Login</th>
                <th className="px-6 py-3.5 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  {search ? `No users match "${search}"` : 'No users found'}
                </td></tr>
              ) : filtered.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                        {(user.full_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{user.full_name ?? 'No name'}</p>
                        <p className="text-gray-400 text-xs">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'
                    }`}>{user.role ?? 'user'}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {new Date(user.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {user.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
                      : <span className="text-gray-300">Never</span>}
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => onSelectUser(user)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline">
                      View Details →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/50 text-xs text-gray-400 font-medium">
            Showing {filtered.length} of {users.length} users
          </div>
        </div>
      )}
    </div>
  );
}
