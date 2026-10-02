import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  UserX, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Power, 
  Shield, 
  Key, 
  RefreshCw, 
  Clock, 
  Check, 
  X,
  UserCheck,
  Lock
} from 'lucide-react';
import { 
  subscribeAllUsers, 
  updateUserRole, 
  updateUserStatus 
} from '../../services/authService';
import { AppUserAccount, AuthRole, UserAccountStatus } from '../../types';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { UserManagementPassKeyGate } from './UserManagementPassKeyGate';

interface UserManagementModuleProps {
  onNavigateToDashboard?: () => void;
}

export const UserManagementModule: React.FC<UserManagementModuleProps> = ({
  onNavigateToDashboard
}) => {
  // Pass Key gate state - always required when opening User Management
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  const [users, setUsers] = useState<AppUserAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRole, setFilterRole] = useState<'all' | AuthRole>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | UserAccountStatus>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<AppUserAccount | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUserAccount | null>(null);
  
  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (!isUnlocked) return;
    setIsLoading(true);
    const unsubscribe = subscribeAllUsers((userList) => {
      setUsers(userList);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [isUnlocked]);

  // If pass key is not yet verified, render Pass Key Gate
  if (!isUnlocked) {
    return (
      <UserManagementPassKeyGate
        onSuccess={() => setIsUnlocked(true)}
        onCancel={onNavigateToDashboard}
      />
    );
  }

  // Quick Action: Toggle Role (Admin <-> Random)
  const handleToggleRole = async (user: AppUserAccount) => {
    const nextRole: AuthRole = user.role === 'admin' ? 'random' : 'admin';
    try {
      await updateUserRole(user.id, nextRole);
      showToast(`Role updated for ${user.userId} to ${nextRole === 'admin' ? 'Admin' : 'Random'}.`);
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed to update role'}`);
    }
  };

  // Quick Action: Toggle Status (Active <-> Disabled)
  const handleToggleStatus = async (user: AppUserAccount) => {
    const nextStatus: UserAccountStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      await updateUserStatus(user.id, nextStatus);
      showToast(`Status updated for ${user.userId} to ${nextStatus.toUpperCase()}.`);
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed to update status'}`);
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.userId.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;

    return matchSearch && matchRole && matchStatus;
  });

  const totalCount = users.length;
  const activeCount = users.filter(u => u.status === 'active').length;
  const disabledCount = users.filter(u => u.status === 'disabled').length;
  const deletedCount = users.filter(u => u.status === 'deleted').length;

  return (
    <div className="space-y-6">
      
      {/* Top Notification Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3.5 bg-slate-900 border border-cyan-500/80 rounded-2xl shadow-2xl shadow-cyan-950/50 flex items-center gap-2.5 text-xs text-cyan-300 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-2xl text-white shadow-lg shadow-cyan-950/60">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white font-mono">
                User Management
              </h1>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-full">
                ADMIN ACCESS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Create, configure roles, activate/disable, and securely manage system users in Firebase Firestore.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setIsUnlocked(false);
              showToast("User Management locked.");
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
            title="Lock User Management Screen"
          >
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>Lock</span>
          </button>

          {/* Create User Button */}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm text-slate-900 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-lg shadow-cyan-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-slate-900 stroke-[2.5]" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Users */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Registered</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-mono font-black text-white">
            {totalCount}
          </div>
        </div>

        {/* Active Users */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Active Users</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-black text-emerald-400">
            {activeCount}
          </div>
        </div>

        {/* Disabled Users */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Disabled Users</span>
            <Power className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-black text-amber-400">
            {disabledCount}
          </div>
        </div>

        {/* Deleted / Revoked */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Deleted / Revoked</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-mono font-black text-rose-400">
            {deletedCount}
          </div>
        </div>

      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
        
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by User Name or User ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="w-full sm:w-auto px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin Only</option>
            <option value="random">Random Only</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-full sm:w-auto px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled Only</option>
            <option value="deleted">Deleted Only</option>
          </select>
        </div>

      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-5">User Name</th>
                <th className="py-4 px-4">User ID</th>
                <th className="py-4 px-4">Role</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Created Date</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Loading Users from Firebase Cloud...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No users found matching your search or filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isDeleted = u.status === 'deleted';
                  const isDisabled = u.status === 'disabled';
                  const isActive = u.status === 'active';

                  return (
                    <tr 
                      key={u.id} 
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isDeleted ? 'bg-rose-950/10 opacity-70' : isDisabled ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong className="text-white font-semibold block">{u.name}</strong>
                            <span className="text-[10px] text-slate-500 font-mono">UID: {u.id.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* User ID */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg font-mono font-bold text-cyan-300 text-xs">
                          {u.userId}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950 border border-cyan-700/80 text-cyan-300">
                            <ShieldCheck className="w-3 h-3 text-cyan-400" /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-300">
                            <Shield className="w-3 h-3 text-slate-400" /> Random
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950 border border-emerald-700 text-emerald-400">
                            <Check className="w-3 h-3 text-emerald-400 stroke-[3]" /> Active
                          </span>
                        )}
                        {isDisabled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950 border border-amber-700 text-amber-300">
                            <Power className="w-3 h-3 text-amber-400" /> Disabled
                          </span>
                        )}
                        {isDeleted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950 border border-rose-800 text-rose-400">
                            <X className="w-3 h-3 text-rose-400 stroke-[3]" /> Deleted
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-4 text-slate-400 font-mono text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => setEditingUser(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Edit User"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Role Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleRole(u)}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-cyan-950 hover:border-cyan-800 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
                            title="Switch Role Admin / Random"
                          >
                            {u.role === 'admin' ? 'Make Random' : 'Make Admin'}
                          </button>

                          {/* Enable / Disable Button */}
                          {!isDeleted && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u)}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors cursor-pointer ${
                                isActive 
                                  ? 'bg-amber-950/60 hover:bg-amber-900 border-amber-800 text-amber-300' 
                                  : 'bg-emerald-950/60 hover:bg-emerald-900 border-emerald-800 text-emerald-300'
                              }`}
                              title={isActive ? "Disable Login Access" : "Enable User Access"}
                            >
                              {isActive ? 'Disable' : 'Enable'}
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeletingUser(u)}
                            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
                            title="Delete User (Revoke Access)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(createdId) => {
          showToast(`User ${createdId} created successfully with Firebase Auth.`);
        }}
      />

      {/* Edit User Modal */}
      <EditUserModal
        user={editingUser}
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        onSuccess={() => {
          showToast("User details updated successfully in Firebase.");
        }}
      />

      {/* Delete User Modal */}
      <DeleteConfirmModal
        user={deletingUser}
        isOpen={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        onSuccess={() => {
          showToast("User deleted and login access permanently revoked.");
        }}
      />

    </div>
  );
};
