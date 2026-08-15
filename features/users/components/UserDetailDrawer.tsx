'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/users';
import { X, GraduationCap, Package, Shield, AlertTriangle, Send, Check, BookOpen, Plus } from 'lucide-react';

interface Props {
  user: UserProfile | null;
  onClose: () => void;
}

type Enrollment = { id: string; enrolled_at: string; payment_status: string; course_id: string; courses?: { title: string; price: number } | null };
type Purchase = { id: string; created_at: string; total_amount: number; status: string; items?: any[] };
type Course = { id: string; title: string };

export default function UserDetailDrawer({ user, onClose }: Props) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [banning, setBanning] = useState(false);
  const [grantingCourse, setGrantingCourse] = useState(false);
  const [sendingNotif, setSendingNotif] = useState(false);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [showNotifForm, setShowNotifForm] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [isBanned, setIsBanned] = useState<boolean>((user as any)?.is_banned ?? false);

  useEffect(() => {
    if (!user) return;
    setIsBanned((user as any)?.is_banned ?? false);
    setLoading(true);
    setActionMsg('');
    Promise.all([
      supabase.from('enrollments').select('id, enrolled_at, payment_status, course_id, courses(title, price)').eq('user_id', user.id).order('enrolled_at', { ascending: false }),
      supabase.from('orders').select('id, created_at, total_amount, status, items').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('courses').select('id, title').eq('is_published', true).order('title'),
    ]).then(([e, p, c]) => {
      setEnrollments((e.data ?? []) as unknown as Enrollment[]);
      setPurchases(p.data ?? []);
      setAllCourses(c.data ?? []);
      setLoading(false);
    });
  }, [user]);

  if (!user) return null;

  const handleBanToggle = async () => {
    if (!confirm(isBanned ? `Unban ${user.email}?` : `Ban ${user.email}? They won't be able to log in.`)) return;
    setBanning(true);
    const { error } = await supabase.from('profiles').update({ is_banned: !isBanned } as any).eq('id', user.id);
    if (error) { alert(error.message); } else {
      setIsBanned(b => !b);
      setActionMsg(isBanned ? 'User unbanned successfully.' : 'User banned successfully.');
    }
    setBanning(false);
  };

  const handleGrantAccess = async () => {
    if (!selectedCourseId) { alert('Select a course'); return; }
    if (!confirm(`Grant free access to selected course for ${user.email}?`)) return;
    setGrantingCourse(true);
    const expiresAt = new Date(Date.now() + 365 * 86400000).toISOString();
    const { error } = await supabase.from('enrollments').upsert({
      user_id: user.id, course_id: selectedCourseId,
      payment_status: 'completed', enrolled_at: new Date().toISOString(),
      expires_at: expiresAt,
    }, { onConflict: 'user_id,course_id' });
    if (error) { alert(error.message); }
    else {
      const course = allCourses.find(c => c.id === selectedCourseId);
      setActionMsg(`✓ Access granted to "${course?.title}".`);
      setShowGrantForm(false);
      setSelectedCourseId('');
      // Reload enrollments
      const { data } = await supabase.from('enrollments').select('id, enrolled_at, payment_status, course_id, courses(title, price)').eq('user_id', user.id).order('enrolled_at', { ascending: false });
      setEnrollments((data ?? []) as unknown as Enrollment[]);
    }
    setGrantingCourse(false);
  };

  const handleRevokeAccess = async (enrollmentId: string, courseTitle: string) => {
    if (!confirm(`Revoke access to "${courseTitle}"? Student will lose access immediately.`)) return;
    const { error } = await supabase.from('enrollments').delete().eq('id', enrollmentId);
    if (!error) {
      setEnrollments(prev => prev.filter(e => e.id !== enrollmentId));
      setActionMsg(`✓ Access to "${courseTitle}" revoked.`);
    } else { alert(error.message); }
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifMsg.trim()) { alert('Title and message required'); return; }
    setSendingNotif(true);
    const { error } = await supabase.from('notifications').insert({
      user_id: user.id, title: notifTitle, body: notifMsg,
      type: 'info', is_read: false, link: null, created_at: new Date().toISOString(),
    });
    if (error) { alert(error.message); }
    else { setActionMsg(`✓ Notification sent to ${user.email}.`); setShowNotifForm(false); setNotifTitle(''); setNotifMsg(''); }
    setSendingNotif(false);
  };

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-400';
  const paidEnrollments = enrollments.filter(e => e.payment_status === 'completed');
  const totalSpent = purchases.filter(p => ['paid','shipped','delivered'].includes(p.status)).reduce((s, p) => s + p.total_amount, 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[460px] bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="p-6 space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">User Details</h2>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
              <X size={18} />
            </button>
          </div>

          {/* Action message */}
          {actionMsg && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2 text-sm text-green-700 font-medium">
              <Check size={14} /> {actionMsg}
            </div>
          )}

          {/* Profile */}
          <div className={`flex items-center gap-4 p-4 rounded-xl ${isBanned ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${isBanned ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              {(user.full_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">{user.full_name ?? 'No name'}</p>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full capitalize font-medium">{user.role ?? 'user'}</span>
                {isBanned && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">BANNED</span>}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Courses', value: paidEnrollments.length, icon: GraduationCap, color: 'text-blue-600 bg-blue-50' },
              { label: 'Orders', value: purchases.length, icon: Package, color: 'text-green-600 bg-green-50' },
              { label: 'Total Spent', value: `₹${totalSpent.toLocaleString()}`, icon: Package, color: 'text-purple-600 bg-purple-50' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-3 text-center">
                  <div className={`inline-flex p-2 rounded-lg mb-1.5 ${s.color}`}><Icon size={14} /></div>
                  <p className="text-base font-bold text-gray-900">{s.value}</p>
                  <p className="text-[10px] text-gray-400">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Login info */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 text-sm space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Account Info</p>
            <div className="flex justify-between"><span className="text-gray-500">User ID</span><span className="font-mono text-xs text-gray-500 truncate max-w-[200px]">{user.id}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Joined</span><span className="text-gray-800">{new Date(user.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Last Login</span><span className="text-gray-800">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : 'Never'}</span></div>
          </div>

          {/* Admin Actions */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Admin Actions</p>

            {/* Grant course access */}
            <button onClick={() => { setShowGrantForm(v => !v); setShowNotifForm(false); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 border border-blue-200 text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition text-sm font-medium">
              <Plus size={15} /> Grant Course Access
            </button>
            {showGrantForm && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
                <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} className={inp}>
                  <option value="">Select a course...</option>
                  {allCourses.filter(c => !enrollments.some(e => e.course_id === c.id && e.payment_status === 'completed')).map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={handleGrantAccess} disabled={grantingCourse || !selectedCourseId}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                    {grantingCourse ? 'Granting...' : 'Grant Free Access (1 year)'}
                  </button>
                  <button onClick={() => setShowGrantForm(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            {/* Send notification */}
            <button onClick={() => { setShowNotifForm(v => !v); setShowGrantForm(false); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition text-sm font-medium">
              <Send size={15} /> Send Notification
            </button>
            {showNotifForm && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="Notification title" className={inp} />
                <textarea value={notifMsg} onChange={e => setNotifMsg(e.target.value)} placeholder="Message..." rows={3} className={inp} />
                <div className="flex gap-2">
                  <button onClick={handleSendNotification} disabled={sendingNotif}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
                    {sendingNotif ? 'Sending...' : 'Send'}
                  </button>
                  <button onClick={() => setShowNotifForm(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            {/* Ban / unban */}
            <button onClick={handleBanToggle} disabled={banning}
              className={`w-full flex items-center gap-2 px-4 py-2.5 border rounded-xl transition text-sm font-medium disabled:opacity-50 ${isBanned ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100' : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'}`}>
              <AlertTriangle size={15} /> {banning ? 'Processing...' : isBanned ? 'Unban User' : 'Ban / Suspend User'}
            </button>
          </div>

          {/* Course Enrollments */}
          {loading ? (
            <div className="text-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>
          ) : (
            <>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <BookOpen size={12} /> Course Enrollments ({paidEnrollments.length} paid)
                </p>
                {enrollments.length === 0 ? (
                  <p className="text-sm text-gray-400">No course enrollments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {enrollments.map(e => (
                      <div key={e.id} className={`flex items-center gap-3 p-3 rounded-xl border ${e.payment_status === 'completed' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{(e.courses as any)?.title ?? 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{new Date(e.enrolled_at).toLocaleDateString('en-IN')} · <span className={`font-semibold ${e.payment_status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>{e.payment_status}</span></p>
                        </div>
                        {e.payment_status === 'completed' && (
                          <button onClick={() => handleRevokeAccess(e.id, (e.courses as any)?.title ?? 'course')}
                            className="text-[10px] text-red-600 hover:text-red-800 font-semibold px-2 py-1 border border-red-100 rounded-lg hover:bg-red-50 transition shrink-0">
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order history */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Package size={12} /> Order History (last 10)
                </p>
                {purchases.length === 0 ? (
                  <p className="text-sm text-gray-400">No orders yet.</p>
                ) : (
                  <div className="space-y-2">
                    {purchases.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                        <div>
                          <p className="font-mono text-xs font-bold text-gray-700">#{p.id.slice(0,8).toUpperCase()}</p>
                          <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('en-IN')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">₹{p.total_amount.toLocaleString()}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.status === 'paid' || p.status === 'delivered' ? 'bg-green-100 text-green-700' : p.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
