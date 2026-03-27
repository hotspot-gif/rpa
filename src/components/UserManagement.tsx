import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { RpaUser } from '@/types';
import { normalizeBranch } from '@/data/mockData';
import {
  UserPlus, Pencil, Trash2, X, Check, Search, Shield, Building2,
  Users, AlertTriangle, ChevronDown, Eye, EyeOff,
} from 'lucide-react';

const ALL_BRANCHES = [
  'LMIT-HS-BARI',
  'LMIT-HS-BOLOGNA',
  'LMIT-HS-MILAN',
  'LMIT-HS-NAPLES',
  'LMIT-HS-PADOVA',
  'LMIT-HS-PALERMO',
  'LMIT-HS-ROME',
  'LMIT-HS-TORINO',
];
const NORTH_BRANCHES = ['LMIT-HS-MILAN', 'LMIT-HS-BOLOGNA', 'LMIT-HS-TORINO', 'LMIT-HS-PADOVA'];
const SOUTH_BRANCHES = ['LMIT-HS-ROME', 'LMIT-HS-NAPLES', 'LMIT-HS-PALERMO', 'LMIT-HS-BARI'];

const ROLES: { value: RpaUser['role']; label: string; color: string }[] = [
  { value: 'HS-ADMIN', label: 'HS Admin', color: 'bg-[#46286E]' },
  { value: 'RSM', label: 'Regional Manager', color: 'bg-[#006AE0]' },
  { value: 'ASM', label: 'Area Manager', color: 'bg-[#08DC7D]' },
];

const emptyForm = {
  full_name: '',
  email: '',
  username: '',
  role: 'ASM' as RpaUser['role'],
  branches: [] as string[],
  is_active: true,
  password: '',
};

type FormData = typeof emptyForm;

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<RpaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<RpaUser | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('rpa_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (!err && data) setUsers(data as RpaUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Auto-clear success message
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const filteredUsers = users.filter(u => {
    const matchSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (u: RpaUser) => {
    setEditingUser(u);
    setForm({
      full_name: u.full_name,
      email: u.email,
      username: u.username,
      role: u.role,
      branches: u.branches.map(normalizeBranch),
      is_active: u.is_active,
      password: '',
    });
    setError('');
    setShowModal(true);
  };

  const toggleBranch = (branch: string) => {
    setForm(prev => ({
      ...prev,
      branches: prev.branches.includes(branch)
        ? prev.branches.filter(b => b !== branch)
        : [...prev.branches, branch],
    }));
  };

  const selectRegion = (region: 'north' | 'south' | 'all') => {
    const regionBranches =
      region === 'north' ? NORTH_BRANCHES :
      region === 'south' ? SOUTH_BRANCHES : ALL_BRANCHES;
    setForm(prev => ({ ...prev, branches: [...regionBranches] }));
  };

  const handleRoleChange = (role: RpaUser['role']) => {
    let branches = form.branches;
    if (role === 'HS-ADMIN') branches = [...ALL_BRANCHES];
    else if (role === 'RSM') branches = branches.length > 4 ? [...NORTH_BRANCHES] : branches;
    else if (role === 'ASM') branches = branches.length > 1 ? [branches[0]] : branches;
    setForm(prev => ({ ...prev, role, branches }));
  };

  const validate = (): string | null => {
    if (!form.full_name.trim()) return 'Full name is required';
    if (!form.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Invalid email format';
    if (!form.username.trim()) return 'Username is required';
    if (form.branches.length === 0) return 'At least one branch must be selected';
    if (form.role === 'ASM' && form.branches.length > 1) return 'ASM can only have one branch';
    if (!editingUser && !form.password) return 'Password is required for new users';
    if (form.password && form.password.length < 6) return 'Password must be at least 6 characters';
    // Check uniqueness against existing users (excluding current editing user)
    const dup = users.find(u => u.id !== editingUser?.id &&
      (u.username === form.username || u.email === form.email));
    if (dup) return dup.email === form.email ? 'Email already in use' : 'Username already in use';
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    setError('');

    try {
      if (editingUser) {
        // UPDATE existing user
        const updates: Record<string, unknown> = {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          username: form.username.trim(),
          role: form.role,
          branches: form.branches,
          is_active: form.is_active,
          updated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await supabase
          .from('rpa_users')
          .update(updates)
          .eq('id', editingUser.id);

        if (updateErr) throw updateErr;
        setSuccess(`User "${form.full_name}" updated successfully`);
      } else {
        // CREATE new user
        // Step 1: Create auth user via Supabase Auth
        let authUserId: string | null = null;
        if (form.password) {
          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: form.email.trim(),
            password: form.password,
            options: {
              data: { full_name: form.full_name.trim() },
            },
          });
          // signUp with anon key may not fully create the user or may auto-confirm depending on settings
          // We handle both cases
          if (signUpErr) {
            // If user already exists in auth, we'll just create the profile
            if (!signUpErr.message.includes('already registered')) {
              throw signUpErr;
            }
          } else if (signUpData?.user) {
            authUserId = signUpData.user.id;
          }
        }

        // Step 2: Insert rpa_users profile
        const { error: insertErr } = await supabase
          .from('rpa_users')
          .insert({
            auth_user_id: authUserId,
            full_name: form.full_name.trim(),
            email: form.email.trim(),
            username: form.username.trim(),
            role: form.role,
            branches: form.branches,
            is_active: form.is_active,
            created_by: currentUser?.id || null,
          });

        if (insertErr) throw insertErr;
        setSuccess(`User "${form.full_name}" created successfully`);
      }

      setShowModal(false);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'An error occurred');
    }

    setSaving(false);
  };

  const handleDelete = async (userId: string) => {
    if (userId === currentUser?.id) {
      setError('You cannot delete your own account');
      return;
    }
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('rpa_users')
        .delete()
        .eq('id', userId);
      if (delErr) throw delErr;
      setDeleteConfirm(null);
      setSuccess('User deleted successfully');
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to delete user');
    }
    setDeleting(false);
  };

  const toggleActive = async (u: RpaUser) => {
    if (u.id === currentUser?.id) return;
    const { error: err } = await supabase
      .from('rpa_users')
      .update({ is_active: !u.is_active, updated_at: new Date().toISOString() })
      .eq('id', u.id);
    if (!err) {
      setSuccess(`User "${u.full_name}" ${u.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    }
  };

  const getRoleBadge = (role: string) => {
    const r = ROLES.find(x => x.value === role);
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full text-white font-medium ${r?.color || 'bg-gray-400'}`}>
        <Shield size={10} />
        {r?.label || role}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#21264E] flex items-center gap-3">
            <Users size={28} />
            User Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create, edit and manage user accounts and permissions
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#21264E] hover:bg-[#245bc1] text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-[#21264E]/20"
        >
          <UserPlus size={18} />
          Create User
        </button>
      </div>

      {/* Success / Error banners */}
      {success && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
          <Check size={16} />
          {success}
        </div>
      )}
      {error && !showModal && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or username..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl text-[#21264E] placeholder:text-gray-400 focus:ring-2 focus:ring-[#245bc1] outline-none bg-white"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl text-[#21264E] bg-white focus:ring-2 focus:ring-[#245bc1] outline-none cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="HS-ADMIN">HS Admin</option>
            <option value="RSM">Regional Manager</option>
            <option value="ASM">Area Manager</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="text-sm text-gray-500 ml-auto">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#21264E]/[0.03] border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#21264E]/60 uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#21264E]/60 uppercase tracking-wider">Username</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#21264E]/60 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#21264E]/60 uppercase tracking-wider">Branches</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-[#21264E]/60 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-[#21264E]/60 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map(u => (
                <tr key={u.id} className={`hover:bg-[#fff7f2]/60 transition ${!u.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        u.role === 'HS-ADMIN' ? 'bg-[#46286E]' : u.role === 'RSM' ? 'bg-[#006AE0]' : 'bg-[#08DC7D]'
                      }`}>
                        {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#21264E]">{u.full_name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-[#21264E]">{u.username}</code>
                  </td>
                  <td className="px-5 py-4">{getRoleBadge(u.role)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {u.branches.slice(0, 3).map(b => (
                        <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-[#21264E]/5 text-[#21264E] font-medium">
                          {b}
                        </span>
                      ))}
                      {u.branches.length > 3 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#21264E]/10 text-[#21264E] font-medium">
                          +{u.branches.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={u.id === currentUser?.id}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer disabled:cursor-not-allowed ${
                        u.is_active
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-500 hover:bg-red-100'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-2 text-gray-400 hover:text-[#245bc1] hover:bg-[#245bc1]/10 rounded-lg transition"
                        title="Edit user"
                      >
                        <Pencil size={15} />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeleteConfirm(u.id)}
                          className="p-2 text-gray-400 hover:text-[#F04438] hover:bg-[#F04438]/10 rounded-lg transition"
                          title="Delete user"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        {ROLES.map(r => {
          const count = users.filter(u => u.role === r.value).length;
          return (
            <div key={r.value} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${r.color} flex items-center justify-center`}>
                <Shield size={18} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#21264E]">{count}</p>
                <p className="text-xs text-gray-500">{r.label}s</p>
              </div>
            </div>
          );
        })}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F04438] flex items-center justify-center">
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#21264E]">{users.filter(u => !u.is_active).length}</p>
            <p className="text-xs text-gray-500">Inactive</p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#F04438]/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-[#F04438]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#21264E]">Delete User</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{users.find(u => u.id === deleteConfirm)?.full_name}</strong>?
              This will remove their profile and access permissions.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-[#21264E] font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm bg-[#F04438] hover:bg-red-600 text-white rounded-xl font-medium transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#21264E] flex items-center justify-center">
                  {editingUser ? <Pencil size={18} className="text-white" /> : <UserPlus size={18} className="text-white" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#21264E]">{editingUser ? 'Edit User' : 'Create New User'}</h2>
                  <p className="text-xs text-gray-400">{editingUser ? 'Update user details and permissions' : 'Set up a new user account'}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5">
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                  <AlertTriangle size={14} />
                  {error}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-[#21264E]/70 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-[#F04438]">*</span>
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Marco Rossi"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl text-[#21264E] placeholder:text-gray-400 focus:ring-2 focus:ring-[#245bc1] outline-none"
                />
              </div>

              {/* Email & Username row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#21264E]/70 uppercase tracking-wider mb-1.5">
                    Email <span className="text-[#F04438]">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="user@company.com"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl text-[#21264E] placeholder:text-gray-400 focus:ring-2 focus:ring-[#245bc1] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#21264E]/70 uppercase tracking-wider mb-1.5">
                    Username <span className="text-[#F04438]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                    placeholder="m.rossi"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl text-[#21264E] placeholder:text-gray-400 focus:ring-2 focus:ring-[#245bc1] outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-[#21264E]/70 uppercase tracking-wider mb-1.5">
                  Password {!editingUser && <span className="text-[#F04438]">*</span>}
                  {editingUser && <span className="text-gray-400 normal-case font-normal">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder={editingUser ? '••••••••' : 'Min 6 characters'}
                    className="w-full px-4 py-2.5 pr-11 text-sm border border-gray-200 rounded-xl text-[#21264E] placeholder:text-gray-400 focus:ring-2 focus:ring-[#245bc1] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#21264E] transition"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-[#21264E]/70 uppercase tracking-wider mb-2">
                  Role <span className="text-[#F04438]">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => handleRoleChange(r.value)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
                        form.role === r.value
                          ? 'border-[#245bc1] bg-[#245bc1]/5 text-[#21264E]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Shield size={14} className={`mx-auto mb-1 ${form.role === r.value ? 'text-[#245bc1]' : 'text-gray-400'}`} />
                      {r.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {form.role === 'HS-ADMIN' && 'Full access to all branches, data import, and user management'}
                  {form.role === 'RSM' && 'Access to assigned regional branches (up to 4)'}
                  {form.role === 'ASM' && 'Access to a single assigned branch only'}
                </p>
              </div>

              {/* Branches */}
              <div>
                <label className="block text-xs font-semibold text-[#21264E]/70 uppercase tracking-wider mb-2">
                  <Building2 size={12} className="inline mr-1" />
                  Branches <span className="text-[#F04438]">*</span>
                  <span className="text-gray-400 normal-case font-normal ml-2">
                    ({form.branches.length} selected)
                  </span>
                </label>

                {/* Quick select buttons */}
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => selectRegion('north')}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#006AE0]/10 text-[#006AE0] hover:bg-[#006AE0]/20 transition font-medium"
                  >
                    North Region
                  </button>
                  <button
                    type="button"
                    onClick={() => selectRegion('south')}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#08DC7D]/10 text-[#08dc7d] hover:bg-[#08DC7D]/20 transition font-medium"
                  >
                    South Region
                  </button>
                  <button
                    type="button"
                    onClick={() => selectRegion('all')}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#46286E]/10 text-[#46286E] hover:bg-[#46286E]/20 transition font-medium"
                  >
                    All Branches
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* North */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#006AE0] uppercase tracking-widest px-1">North</p>
                    {NORTH_BRANCHES.map(b => (
                      <label
                        key={b}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-sm ${
                          form.branches.includes(b)
                            ? 'bg-[#21264E]/5 text-[#21264E] font-medium'
                            : 'text-gray-500 hover:bg-gray-50'
                        } ${form.role === 'ASM' && form.branches.length >= 1 && !form.branches.includes(b) ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={form.branches.includes(b)}
                          onChange={() => {
                            if (form.role === 'ASM' && !form.branches.includes(b)) {
                              setForm(p => ({ ...p, branches: [b] }));
                            } else {
                              toggleBranch(b);
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-[#245bc1] focus:ring-[#245bc1]"
                        />
                        {b}
                      </label>
                    ))}
                  </div>
                  {/* South */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#08DC7D] uppercase tracking-widest px-1">South</p>
                    {SOUTH_BRANCHES.map(b => (
                      <label
                        key={b}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition text-sm ${
                          form.branches.includes(b)
                            ? 'bg-[#21264E]/5 text-[#21264E] font-medium'
                            : 'text-gray-500 hover:bg-gray-50'
                        } ${form.role === 'ASM' && form.branches.length >= 1 && !form.branches.includes(b) ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={form.branches.includes(b)}
                          onChange={() => {
                            if (form.role === 'ASM' && !form.branches.includes(b)) {
                              setForm(p => ({ ...p, branches: [b] }));
                            } else {
                              toggleBranch(b);
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-[#245bc1] focus:ring-[#245bc1]"
                        />
                        {b}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active toggle (edit only) */}
              {editingUser && (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-[#21264E]">Account Status</p>
                    <p className="text-xs text-gray-400">Inactive users cannot log in</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                    className={`relative w-12 h-6 rounded-full transition ${form.is_active ? 'bg-[#08DC7D]' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-100 text-[#21264E] font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#21264E] hover:bg-[#245bc1] text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 shadow-lg shadow-[#21264E]/20"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    {editingUser ? 'Update User' : 'Create User'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
