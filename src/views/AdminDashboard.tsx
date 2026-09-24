'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../auth/AuthContext';
import {
  adminApi,
  AdminOverview,
  AdminUser,
  UserDetails,
  WhitelistEntry,
  PromoCode,
  AuditLog,
  AdminCreditRequest,
} from '../api/admin';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Table, Th, Td, TdEmpty } from '../components/common/Table';
import { Spinner } from '../components/common/Spinner';
import { errorMessage } from '../lib/errors';
import Image from 'next/image';
import {
  Shield,
  Users,
  Ticket,
  AlertTriangle,
  FileText,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Power,
  CheckCircle,
  DollarSign,
  Clock,
  UserCheck,
  UserX,
  CreditCard,
  Layers,
  X,
  Check,
} from 'lucide-react';

type Tab = 'overview' | 'whitelist' | 'promo-codes' | 'credit-requests' | 'accounts' | 'emergency' | 'audit';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Whitelist state
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [whitelistEnforced, setWhitelistEnforced] = useState(true);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistSearch, setWhitelistSearch] = useState('');
  const [showAddWhitelistModal, setShowAddWhitelistModal] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newEmailNotes, setNewEmailNotes] = useState('');
  const [submittingWhitelist, setSubmittingWhitelist] = useState(false);

  // Promo codes state
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [showCreatePromoModal, setShowCreatePromoModal] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoAmount, setNewPromoAmount] = useState('5.00');
  const [newPromoDesc, setNewPromoDesc] = useState('');
  const [newPromoMax, setNewPromoMax] = useState('');
  const [newPromoExpiry, setNewPromoExpiry] = useState('');
  const [submittingPromo, setSubmittingPromo] = useState(false);

  // Credit requests state
  const [creditRequests, setCreditRequests] = useState<AdminCreditRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [requestSearch, setRequestSearch] = useState('');
  const [actioningRequestId, setActioningRequestId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<AdminCreditRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [_loadingDetails, setLoadingDetails] = useState(false);

  // Credit adjustment state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustTargetUser, setAdjustTargetUser] = useState<AdminUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('10.00');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = useState('Manual credit grant');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Emergency state
  const [emergency, setEmergency] = useState({
    killSwitch: false,
    consumptionPaused: false,
    maintenanceMode: false,
  });
  const [_emergencyLoading, setEmergencyLoading] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicLoading, setPanicLoading] = useState(false);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Fetch overview
  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await adminApi.getOverview();
      setOverview(res.stats);
      setEmergency(res.stats.emergency);
      setWhitelistEnforced(res.stats.whitelist.enforced);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to load overview'), 'error');
    } finally {
      setLoadingOverview(false);
    }
  }, [showToast]);

  // Fetch whitelist
  const loadWhitelist = useCallback(async () => {
    setWhitelistLoading(true);
    try {
      const res = await adminApi.getWhitelist();
      setWhitelist(res.entries);
      setWhitelistEnforced(res.enforced);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to load whitelist'), 'error');
    } finally {
      setWhitelistLoading(false);
    }
  }, [showToast]);

  // Fetch promo codes
  const loadPromoCodes = useCallback(async () => {
    setPromoLoading(true);
    try {
      const res = await adminApi.getPromoCodes();
      setPromoCodes(res.codes);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to load promo codes'), 'error');
    } finally {
      setPromoLoading(false);
    }
  }, [showToast]);

  // Fetch credit requests
  const loadCreditRequests = useCallback(async (status = requestFilter) => {
    setRequestsLoading(true);
    try {
      const res = await adminApi.getCreditRequests(status === 'all' ? undefined : status);
      setCreditRequests(res.requests);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to load credit requests'), 'error');
    } finally {
      setRequestsLoading(false);
    }
  }, [requestFilter, showToast]);

  // Fetch users
  const loadUsers = useCallback(async (query = usersSearch) => {
    setUsersLoading(true);
    try {
      const res = await adminApi.getUsers({ search: query, limit: 100 });
      setUsers(res.users);
      setUsersTotal(res.total);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to load users'), 'error');
    } finally {
      setUsersLoading(false);
    }
  }, [usersSearch, showToast]);

  // Fetch user details
  const loadUserDetails = useCallback(async (userId: string) => {
    setLoadingDetails(true);
    try {
      const res = await adminApi.getUserDetails(userId);
      setUserDetails(res);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to load user details'), 'error');
    } finally {
      setLoadingDetails(false);
    }
  }, [showToast]);

  // Fetch emergency
  const loadEmergency = useCallback(async () => {
    setEmergencyLoading(true);
    try {
      const res = await adminApi.getEmergencyStatus();
      setEmergency(res.status);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to load emergency status'), 'error');
    } finally {
      setEmergencyLoading(false);
    }
  }, [showToast]);

  // Fetch audit logs
  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await adminApi.getAuditLogs(150);
      setAuditLogs(res.logs);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to load audit logs'), 'error');
    } finally {
      setAuditLoading(false);
    }
  }, [showToast]);

  // Initial load when tab changes or admin verified
  useEffect(() => {
    if (user?.isAdmin) {
      if (tab === 'overview') void loadOverview();
      if (tab === 'whitelist') void loadWhitelist();
      if (tab === 'promo-codes') void loadPromoCodes();
      if (tab === 'credit-requests') void loadCreditRequests();
      if (tab === 'accounts') void loadUsers();
      if (tab === 'emergency') void loadEmergency();
      if (tab === 'audit') void loadAuditLogs();
    }
  }, [user, tab, loadOverview, loadWhitelist, loadPromoCodes, loadCreditRequests, loadUsers, loadEmergency, loadAuditLogs]);

  // Credit Request Handlers
  const handleApproveRequest = async (req: AdminCreditRequest) => {
    if (!confirm(`Grant $${req.amount_usdc.toFixed(2)} to ${req.user_email || req.user_id}?`)) {
      return;
    }
    setActioningRequestId(req.id);
    try {
      const res = await adminApi.approveCreditRequest(req.id);
      showToast(res.message);
      void loadCreditRequests();
      void loadOverview();
      void loadUsers();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to approve credit request'), 'error');
    } finally {
      setActioningRequestId(null);
    }
  };

  const handleOpenRejectModal = (req: AdminCreditRequest) => {
    setRejectingRequest(req);
    setRejectNote('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequest) return;
    setSubmittingReject(true);
    setActioningRequestId(rejectingRequest.id);
    try {
      const res = await adminApi.rejectCreditRequest(rejectingRequest.id, rejectNote);
      showToast(res.message);
      setShowRejectModal(false);
      setRejectingRequest(null);
      void loadCreditRequests();
      void loadOverview();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to reject credit request'), 'error');
    } finally {
      setSubmittingReject(false);
      setActioningRequestId(null);
    }
  };

  // Handlers for Whitelist
  const handleToggleWhitelistEnforce = async () => {
    try {
      const next = !whitelistEnforced;
      await adminApi.toggleWhitelistEnforcement(next);
      setWhitelistEnforced(next);
      showToast(next ? 'Whitelist enforcement enabled' : 'Whitelist enforcement disabled (open access)');
    } catch (err) {
      showToast(errorMessage(err, 'Failed to toggle enforcement'), 'error');
    }
  };

  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmailInput.trim()) return;
    setSubmittingWhitelist(true);
    try {
      const res = await adminApi.addToWhitelist({
        emails: newEmailInput.split(/[\s,]+/).filter(Boolean),
        notes: newEmailNotes.trim() || undefined,
      });
      setWhitelist(res.whitelist);
      setNewEmailInput('');
      setNewEmailNotes('');
      setShowAddWhitelistModal(false);
      showToast(`Added ${res.addedCount} account(s) to whitelist`);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to add whitelist'), 'error');
    } finally {
      setSubmittingWhitelist(false);
    }
  };

  const handleRemoveWhitelist = async (email: string) => {
    if (!confirm(`Remove ${email} from early access whitelist?`)) return;
    try {
      const res = await adminApi.removeFromWhitelist(email);
      setWhitelist(res.whitelist);
      showToast(`Removed ${email} from whitelist`);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to remove from whitelist'), 'error');
    }
  };

  // Handlers for Promo Codes
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newPromoCode.trim().toUpperCase();
    const amount = parseFloat(newPromoAmount);
    if (!code || isNaN(amount) || amount <= 0) return;

    setSubmittingPromo(true);
    try {
      await adminApi.createPromoCode({
        code,
        amountUsdc: amount,
        description: newPromoDesc.trim() || `$${amount} Credit`,
        maxRedemptions: newPromoMax ? parseInt(newPromoMax, 10) : null,
        expiresAt: newPromoExpiry || null,
      });
      setShowCreatePromoModal(false);
      setNewPromoCode('');
      setNewPromoAmount('5.00');
      setNewPromoDesc('');
      setNewPromoMax('');
      setNewPromoExpiry('');
      showToast(`Promo code ${code} created`);
      void loadPromoCodes();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to create promo code'), 'error');
    } finally {
      setSubmittingPromo(false);
    }
  };

  const handleTogglePromoActive = async (promo: PromoCode) => {
    try {
      await adminApi.updatePromoCode(promo.code, { active: !promo.active });
      showToast(`Promo code ${promo.code} ${!promo.active ? 'activated' : 'paused'}`);
      void loadPromoCodes();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to update promo code'), 'error');
    }
  };

  const handleDeletePromo = async (code: string) => {
    if (!confirm(`Permanently delete promo code ${code}?`)) return;
    try {
      await adminApi.deletePromoCode(code);
      showToast(`Promo code ${code} deleted`);
      void loadPromoCodes();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to delete promo code'), 'error');
    }
  };

  // Handlers for Users & Credits
  const handleOpenAdjust = (target: AdminUser) => {
    setAdjustTargetUser(target);
    setAdjustAmount('10.00');
    setAdjustType('credit');
    setAdjustReason('Admin balance adjustment');
    setShowAdjustModal(true);
  };

  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetUser) return;
    const rawVal = parseFloat(adjustAmount);
    if (isNaN(rawVal) || rawVal <= 0) return;
    const finalAmount = adjustType === 'credit' ? rawVal : -rawVal;

    setSubmittingAdjust(true);
    try {
      await adminApi.adjustCredits(adjustTargetUser.id, finalAmount, adjustReason.trim());
      showToast(`Successfully adjusted balance for ${adjustTargetUser.email}`);
      setShowAdjustModal(false);
      void loadUsers();
      if (selectedUserId === adjustTargetUser.id) {
        void loadUserDetails(adjustTargetUser.id);
      }
    } catch (err) {
      showToast(errorMessage(err, 'Failed to adjust balance'), 'error');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleToggleSuspendUser = async (u: AdminUser) => {
    const next = !u.isSuspended;
    const reason = next ? prompt('Enter reason for suspension:') || 'Administrative freeze' : undefined;
    if (next && !reason) return;

    try {
      await adminApi.toggleSuspend(u.id, next, reason);
      showToast(next ? `Suspended account ${u.email}` : `Reinstated account ${u.email}`);
      void loadUsers();
      if (selectedUserId === u.id) {
        void loadUserDetails(u.id);
      }
    } catch (err) {
      showToast(errorMessage(err, 'Failed to update suspension'), 'error');
    }
  };

  const handleRevokeUserSessions = async (userId: string, email: string) => {
    if (!confirm(`Revoke all active sessions for ${email}?`)) return;
    try {
      const res = await adminApi.revokeUserSessions(userId);
      showToast(`Revoked ${res.revokedCount} session(s) for ${email}`);
      if (selectedUserId === userId) {
        void loadUserDetails(userId);
      }
    } catch (err) {
      showToast(errorMessage(err, 'Failed to revoke sessions'), 'error');
    }
  };

  // Handlers for Emergency
  const handleToggleEmergency = async (
    key: 'emergency_kill_switch' | 'api_consumption_paused' | 'maintenance_mode',
    enabled: boolean,
  ) => {
    try {
      await adminApi.toggleEmergency(key, enabled);
      showToast(`Emergency toggle updated`);
      void loadEmergency();
    } catch (err) {
      showToast(errorMessage(err, 'Failed to toggle emergency setting'), 'error');
    }
  };

  const handlePanicRevoke = async () => {
    setPanicLoading(true);
    try {
      const res = await adminApi.panicRevokeAllSessions();
      setShowPanicModal(false);
      showToast(`PANIC TRIGGERED: Revoked ${res.revokedCount} active sessions across the platform!`);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to execute panic revocation'), 'error');
    } finally {
      setPanicLoading(false);
    }
  };

  // Filtered whitelist
  const filteredWhitelist = useMemo(() => {
    if (!whitelistSearch.trim()) return whitelist;
    const q = whitelistSearch.toLowerCase();
    return whitelist.filter(
      w => w.email.toLowerCase().includes(q) || (w.notes && w.notes.toLowerCase().includes(q)),
    );
  }, [whitelist, whitelistSearch]);

  // Filtered credit requests
  const filteredCreditRequests = useMemo(() => {
    let list = creditRequests;
    if (requestFilter !== 'all') {
      list = list.filter(r => r.status === requestFilter);
    }
    if (!requestSearch.trim()) return list;
    const q = requestSearch.toLowerCase();
    return list.filter(
      r =>
        (r.user_email && r.user_email.toLowerCase().includes(q)) ||
        (r.user_name && r.user_name.toLowerCase().includes(q)) ||
        (r.reason && r.reason.toLowerCase().includes(q)) ||
        (r.user_id && r.user_id.toLowerCase().includes(q)) ||
        (r.reviewed_by && r.reviewed_by.toLowerCase().includes(q)),
    );
  }, [creditRequests, requestFilter, requestSearch]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={32} className="text-muted" />
      </div>
    );
  }

  // Access check
  if (!user?.isAdmin) {
    return (
      <div className="mx-auto max-w-xl py-20 px-4 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
          <Shield size={28} />
        </div>
        <h1 className="text-2xl font-bold text-main">Administrative Access Required</h1>
        <p className="mt-2 text-sm text-muted">
          Your account (<span className="font-mono text-main">{user?.email || 'unauthenticated'}</span>) does not have administrator privileges.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="primary" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-20 pt-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'error'
              ? 'border-red-500/40 bg-red-500/20 text-red-200'
              : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-sm">
                <Shield size={20} />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-main">Admin Console</h1>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                Superuser
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Signed in as <span className="font-mono font-medium text-main">{user.email}</span> • Real-time system governance
            </p>
          </div>

          <div className="flex items-center gap-2">
            {emergency.killSwitch && (
              <span className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-400 animate-pulse">
                <AlertTriangle size={14} /> Kill Switch Active
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (tab === 'overview') void loadOverview();
                if (tab === 'whitelist') void loadWhitelist();
                if (tab === 'promo-codes') void loadPromoCodes();
                if (tab === 'credit-requests') void loadCreditRequests();
                if (tab === 'accounts') void loadUsers();
                if (tab === 'emergency') void loadEmergency();
                if (tab === 'audit') void loadAuditLogs();
                showToast('Refreshed data');
              }}
              title="Refresh Current View"
            >
              <RefreshCw size={14} /> Refresh
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setTab('emergency')}
            >
              <Power size={14} /> Emergency Controls
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 border-b border-border pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'whitelist', label: 'Whitelist Access', icon: Users, badge: overview?.whitelist?.count },
            { id: 'promo-codes', label: 'Promo Codes', icon: Ticket, badge: overview?.promoCodes?.activeCodes },
            { id: 'credit-requests', label: 'Credit Requests', icon: Clock, badge: overview?.creditRequests?.pendingCount },
            { id: 'accounts', label: 'Accounts & Balances', icon: DollarSign, badge: overview?.users?.total },
            { id: 'emergency', label: 'Emergency Functions', icon: AlertTriangle, alert: emergency.killSwitch || emergency.consumptionPaused },
            { id: 'audit', label: 'Audit Logs', icon: FileText },
          ].map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as Tab)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer border-0 ${
                  active
                    ? 'bg-panel text-main shadow-sm'
                    : 'bg-transparent text-muted hover:bg-panel-hover hover:text-main'
                }`}
              >
                <Icon size={16} className={t.alert ? 'text-red-400' : active ? 'text-accent' : 'text-muted'} />
                <span>{t.label}</span>
                {t.badge !== undefined && (
                  <span className="rounded-full bg-border/60 px-2 py-0.5 text-xs font-mono font-medium text-muted">
                    {t.badge}
                  </span>
                )}
                {t.alert && (
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* System Status Banner */}
            <div
              className={`rounded-xl border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                emergency.killSwitch || emergency.consumptionPaused
                  ? 'border-red-500/40 bg-red-500/10'
                  : 'border-emerald-500/30 bg-emerald-500/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    emergency.killSwitch || emergency.consumptionPaused
                      ? 'border-red-500/40 bg-red-500/20 text-red-400'
                      : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {emergency.killSwitch || emergency.consumptionPaused ? (
                    <AlertTriangle size={20} />
                  ) : (
                    <CheckCircle size={20} />
                  )}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-main">
                    {emergency.killSwitch
                      ? 'EMERGENCY KILL SWITCH ENGAGED'
                      : emergency.consumptionPaused
                        ? 'API Consumption Paused (Maintenance)'
                        : 'System Operational — All Gateways Active'}
                  </h3>
                  <p className="text-xs text-muted">
                    Whitelist Enforcement: <strong className="text-main">{whitelistEnforced ? 'ACTIVE (Private Preview)' : 'DISABLED (Open Access)'}</strong> • Active Sessions: <strong className="text-main">{overview?.users?.activeSessions ?? '...'}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setTab('whitelist')}
                >
                  Manage Whitelist
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setTab('emergency')}
                >
                  System Controls
                </Button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted">
                    Total Users
                  </span>
                  <Users size={18} className="text-accent" />
                </div>
                <div className="mt-3 text-2xl font-bold font-mono text-main">
                  {loadingOverview ? <Spinner size={20} /> : overview?.users?.total ?? 0}
                </div>
                <p className="mt-1 text-xs text-muted">
                  <span className="text-emerald-400 font-medium">{overview?.users?.activeSessions ?? 0}</span> active sessions currently
                </p>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted">
                    Total Float Held
                  </span>
                  <DollarSign size={18} className="text-emerald-400" />
                </div>
                <div className="mt-3 text-2xl font-bold font-mono text-main">
                  {loadingOverview ? <Spinner size={20} /> : `$${(overview?.credits?.totalFloatUsdc ?? 0).toFixed(2)}`}
                </div>
                <p className="mt-1 text-xs text-muted">
                  USDC custodial credit float across all accounts
                </p>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted">
                    Total Consumed
                  </span>
                  <CreditCard size={18} className="text-blue-400" />
                </div>
                <div className="mt-3 text-2xl font-bold font-mono text-main">
                  {loadingOverview ? <Spinner size={20} /> : `$${(overview?.credits?.totalSpentUsdc ?? 0).toFixed(2)}`}
                </div>
                <p className="mt-1 text-xs text-muted">
                  All-time credits spent on API calls
                </p>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted">
                    Promo Redemptions
                  </span>
                  <Ticket size={18} className="text-amber-400" />
                </div>
                <div className="mt-3 text-2xl font-bold font-mono text-main">
                  {loadingOverview ? <Spinner size={20} /> : overview?.promoCodes?.totalRedemptions ?? 0}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Across <span className="text-main font-medium">{overview?.promoCodes?.activeCodes ?? 0}</span> promo codes created
                </p>
              </Card>
            </div>

            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-main flex items-center gap-2">
                  <Users size={16} className="text-accent" /> Whitelist Access Control
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {whitelistEnforced
                    ? 'Only email addresses added to the whitelist can authenticate and use the platform.'
                    : 'Whitelist enforcement is disabled. Any Google, Magic link, or OTP user can sign in.'}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-main">
                    {overview?.whitelist?.count ?? 0} accounts whitelisted
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={handleToggleWhitelistEnforce}>
                      {whitelistEnforced ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => { setTab('whitelist'); setShowAddWhitelistModal(true); }}>
                      <Plus size={14} /> Add
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-semibold text-main flex items-center gap-2">
                  <Ticket size={16} className="text-amber-400" /> Promo Codes
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Create single-use or campaign promo codes for users to receive free credits on their top-up screen.
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-main">
                    {overview?.promoCodes?.activeCodes ?? 0} active codes
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setTab('promo-codes')}>
                      View Codes
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => { setTab('promo-codes'); setShowCreatePromoModal(true); }}>
                      <Plus size={14} /> Create
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-main flex items-center gap-2">
                    <Clock size={16} className="text-amber-400" /> Credit Requests
                  </h3>
                  {overview?.creditRequests && overview.creditRequests.pendingCount > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400 animate-pulse">
                      {overview.creditRequests.pendingCount} pending
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Review and grant credit requests from users who have already claimed initial test credits.
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-main">
                    {overview?.creditRequests?.totalCount ?? 0} total ({overview?.creditRequests?.pendingCount ?? 0} pending)
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => setTab('credit-requests')}>
                      Review Requests
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: WHITELIST */}
        {tab === 'whitelist' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                    whitelistEnforced
                      ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      : 'border border-amber-500/40 bg-amber-500/10 text-amber-400'
                  }`}
                >
                  {whitelistEnforced ? <Lock size={12} /> : <Unlock size={12} />}
                  {whitelistEnforced ? 'Enforcement ON' : 'Enforcement OFF (Open)'}
                </span>
                <span className="text-xs text-muted">
                  {whitelist.length} account{whitelist.length === 1 ? '' : 's'} on access list
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleToggleWhitelistEnforce}
                >
                  {whitelistEnforced ? 'Turn OFF Whitelist' : 'Turn ON Whitelist'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowAddWhitelistModal(true)}
                >
                  <Plus size={14} /> Add Account
                </Button>
              </div>
            </div>

            {/* Whitelist Search */}
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={whitelistSearch}
                onChange={e => setWhitelistSearch(e.target.value)}
                placeholder="Search whitelisted emails or notes..."
                className="w-full rounded-lg border border-border bg-panel py-2 pl-10 pr-4 text-sm text-main outline-none focus:border-main"
              />
            </div>

            {/* Whitelist Table */}
            <Card className="overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    <Th>Email Address</Th>
                    <Th>Notes / Label</Th>
                    <Th>Added By</Th>
                    <Th>Date Added</Th>
                    <Th className="text-right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {whitelistLoading ? (
                    <tr>
                      <Td colSpan={5} className="py-12 text-center">
                        <Spinner size={24} className="text-muted" />
                      </Td>
                    </tr>
                  ) : filteredWhitelist.length === 0 ? (
                    <TdEmpty colSpan={5}>
                      {whitelistSearch ? 'No whitelisted accounts matching search' : 'No whitelisted emails yet. Add accounts using the button above.'}
                    </TdEmpty>
                  ) : (
                    filteredWhitelist.map(item => (
                      <tr key={item.email} className="hover:bg-panel-hover/50 transition-colors">
                        <Td mono className="font-medium text-main">
                          {item.email}
                        </Td>
                        <Td className="text-muted">
                          {item.notes || '—'}
                        </Td>
                        <Td className="text-xs text-muted font-mono">
                          {item.addedBy || 'admin'}
                        </Td>
                        <Td className="text-xs text-muted">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </Td>
                        <Td className="text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveWhitelist(item.email)}
                            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-transparent border-0 cursor-pointer p-1"
                            title="Remove from whitelist"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card>
          </div>
        )}

        {/* TAB 3: PROMO CODES */}
        {tab === 'promo-codes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-main">Promo Codes</h3>
                <p className="text-xs text-muted">Codes redeemable in the dashboard for credit top-ups</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowCreatePromoModal(true)}>
                <Plus size={14} /> New Promo Code
              </Button>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Credit Value</Th>
                    <Th>Description</Th>
                    <Th>Redemptions / Limit</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {promoLoading ? (
                    <tr>
                      <Td colSpan={6} className="py-12 text-center">
                        <Spinner size={24} className="text-muted" />
                      </Td>
                    </tr>
                  ) : promoCodes.length === 0 ? (
                    <TdEmpty colSpan={6}>No promo codes created yet</TdEmpty>
                  ) : (
                    promoCodes.map(code => (
                      <tr key={code.code} className="hover:bg-panel-hover/50 transition-colors">
                        <Td mono className="font-bold text-main">
                          {code.code}
                        </Td>
                        <Td className="font-mono text-emerald-400 font-semibold">
                          +${code.amountUsdc.toFixed(2)}
                        </Td>
                        <Td className="text-muted text-xs">
                          {code.description}
                        </Td>
                        <Td className="font-mono text-xs text-muted">
                          {code.redemptionCount} / {code.maxRedemptions ?? 'Unlimited'}
                        </Td>
                        <Td>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                              code.active
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                            }`}
                          >
                            {code.active ? 'Active' : 'Paused'}
                          </span>
                        </Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleTogglePromoActive(code)}
                              className="cursor-pointer border-0 bg-transparent text-xs text-muted hover:text-main p-1"
                            >
                              {code.active ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePromo(code.code)}
                              className="cursor-pointer border-0 bg-transparent text-xs text-red-400 hover:text-red-300 p-1"
                              title="Delete code"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card>
          </div>
        )}

        {/* TAB: CREDIT REQUESTS */}
        {tab === 'credit-requests' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-main">Credit Requests</h3>
                  {overview?.creditRequests && overview.creditRequests.pendingCount > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                      {overview.creditRequests.pendingCount} Pending
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  Review, approve, or reject user requests for additional testing credits
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Filter Pills */}
                <div className="flex rounded-lg border border-border bg-panel p-0.5 text-xs font-medium">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setRequestFilter(s);
                        void loadCreditRequests(s);
                      }}
                      className={`cursor-pointer rounded-md px-2.5 py-1 capitalize transition-colors ${
                        requestFilter === s
                          ? 'bg-main text-bg font-semibold'
                          : 'text-muted hover:text-main'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative flex-1 sm:w-64">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={requestSearch}
                    onChange={e => setRequestSearch(e.target.value)}
                    placeholder="Search user, reason..."
                    className="w-full rounded-lg border border-border bg-panel py-1.5 pl-8 pr-3 text-xs text-main placeholder-muted outline-none focus:border-main"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => loadCreditRequests(requestFilter)}
                  disabled={requestsLoading}
                  title="Refresh requests"
                >
                  <RefreshCw size={13} className={requestsLoading ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Current Balance</Th>
                    <Th>Requested Amount</Th>
                    <Th>Intent & Reason</Th>
                    <Th>Status</Th>
                    <Th>Submitted</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {requestsLoading ? (
                    <tr>
                      <Td colSpan={7} className="py-12 text-center">
                        <Spinner size={24} className="text-muted" />
                      </Td>
                    </tr>
                  ) : filteredCreditRequests.length === 0 ? (
                    <TdEmpty colSpan={7}>
                      {requestSearch
                        ? 'No credit requests match your search'
                        : requestFilter === 'pending'
                        ? 'No pending credit requests at this time'
                        : 'No credit requests found'}
                    </TdEmpty>
                  ) : (
                    filteredCreditRequests.map(req => (
                      <tr key={req.id} className="hover:bg-panel-hover/50 transition-colors">
                        <Td>
                          <div className="flex flex-col">
                            <span className="font-medium text-main text-xs">{req.user_name || req.user_email || 'User'}</span>
                            <span className="text-[11px] font-mono text-muted">{req.user_email || req.user_id}</span>
                          </div>
                        </Td>
                        <Td mono className="text-xs text-muted">
                          ${req.current_balance.toFixed(2)}
                        </Td>
                        <Td mono className="font-semibold text-emerald-400 text-xs">
                          ${req.amount_usdc.toFixed(2)}
                        </Td>
                        <Td className="max-w-xs text-xs text-muted">
                          <p className="line-clamp-2 text-main/90" title={req.reason || undefined}>
                            {req.reason || '—'}
                          </p>
                        </Td>
                        <Td>
                          {req.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                              <Clock size={11} /> Pending
                            </span>
                          )}
                          {req.status === 'approved' && (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20 w-fit">
                                <Check size={11} /> Approved
                              </span>
                              {req.reviewed_by && (
                                <span className="text-[10px] text-muted font-mono truncate max-w-[120px]" title={`By ${req.reviewed_by}`}>
                                  by {req.reviewed_by}
                                </span>
                              )}
                            </div>
                          )}
                          {req.status === 'rejected' && (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-400 border border-red-500/20 w-fit">
                                <X size={11} /> Rejected
                              </span>
                              {req.admin_note && (
                                <span className="text-[10px] text-muted truncate max-w-[140px]" title={req.admin_note}>
                                  {req.admin_note}
                                </span>
                              )}
                            </div>
                          )}
                        </Td>
                        <Td className="text-xs text-muted whitespace-nowrap">
                          {new Date(req.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Td>
                        <Td className="text-right">
                          {req.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveRequest(req)}
                                disabled={actioningRequestId === req.id}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 px-2.5 py-1 text-xs font-semibold cursor-pointer border border-emerald-500/30 transition-colors disabled:opacity-50"
                                title="Approve and grant credits"
                              >
                                {actioningRequestId === req.id ? (
                                  <Spinner size={11} />
                                ) : (
                                  <>
                                    <Check size={12} /> Approve
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenRejectModal(req)}
                                disabled={actioningRequestId === req.id}
                                className="inline-flex items-center gap-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-400 px-2.5 py-1 text-xs font-semibold cursor-pointer border border-red-500/30 transition-colors disabled:opacity-50"
                                title="Reject request"
                              >
                                <X size={12} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted font-mono">—</span>
                          )}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card>
          </div>
        )}

        {/* TAB 4: ACCOUNTS & BALANCES */}
        {tab === 'accounts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-main">Authenticated Accounts</h3>
                <p className="text-xs text-muted">
                  Total {usersTotal} registered user account{usersTotal === 1 ? '' : 's'}
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={usersSearch}
                  onChange={e => {
                    setUsersSearch(e.target.value);
                    void loadUsers(e.target.value);
                  }}
                  placeholder="Search email, name or ID..."
                  className="w-full rounded-lg border border-border bg-panel py-1.5 pl-9 pr-3 text-xs text-main outline-none focus:border-main"
                />
              </div>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    <Th>User Account</Th>
                    <Th>Balance</Th>
                    <Th>Total Spent</Th>
                    <Th>Total Recharged</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <Td colSpan={7} className="py-12 text-center">
                        <Spinner size={24} className="text-muted" />
                      </Td>
                    </tr>
                  ) : users.length === 0 ? (
                    <TdEmpty colSpan={7}>No users found</TdEmpty>
                  ) : (
                    users.map(u => (
                      <tr key={u.id} className="hover:bg-panel-hover/50 transition-colors">
                        <Td>
                          <div className="flex items-center gap-2.5">
                            {u.avatarUrl ? (
                              <Image
                                src={u.avatarUrl}
                                alt=""
                                width={28}
                                height={28}
                                className="h-7 w-7 rounded-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-panel border border-border text-xs font-semibold text-main">
                                {u.email.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-main text-sm">{u.email}</div>
                              <div className="text-[11px] font-mono text-muted">{u.id.slice(0, 16)}...</div>
                            </div>
                          </div>
                        </Td>
                        <Td className="font-mono font-bold text-main">
                          ${u.balance.toFixed(2)}
                        </Td>
                        <Td className="font-mono text-xs text-muted">
                          ${u.totalSpent.toFixed(2)}
                        </Td>
                        <Td className="font-mono text-xs text-emerald-400">
                          +${u.totalRecharged.toFixed(2)}
                        </Td>
                        <Td>
                          {u.isSuspended ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                              <UserX size={11} /> Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                              <UserCheck size={11} /> Active
                            </span>
                          )}
                        </Td>
                        <Td className="text-xs text-muted">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedUserId(u.id);
                                void loadUserDetails(u.id);
                              }}
                            >
                              Details
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleOpenAdjust(u)}
                            >
                              Adjust
                            </Button>
                            <Button
                              size="sm"
                              variant={u.isSuspended ? 'secondary' : 'danger'}
                              onClick={() => handleToggleSuspendUser(u)}
                            >
                              {u.isSuspended ? 'Unfreeze' : 'Freeze'}
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card>
          </div>
        )}

        {/* TAB 5: EMERGENCY FUNCTIONS */}
        {tab === 'emergency' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                  <AlertTriangle size={22} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-red-400">Emergency & Governance Operations</h3>
                  <p className="text-xs text-muted">
                    These controls immediately affect all platform execution, on-chain transactions, and user traffic.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 border-red-500/30">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-main flex items-center gap-2">
                    <Power size={18} className="text-red-400" /> Emergency Kill Switch
                  </h4>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                      emergency.killSwitch
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {emergency.killSwitch ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Instantly halts all HTTP 402 gasless payment execution and API calls across the platform. Use only during active protocol compromise or emergency maintenance.
                </p>
                <div className="mt-5">
                  <Button
                    variant={emergency.killSwitch ? 'secondary' : 'danger'}
                    className="w-full"
                    onClick={() => handleToggleEmergency('emergency_kill_switch', !emergency.killSwitch)}
                  >
                    {emergency.killSwitch ? 'Disengage Kill Switch' : 'Engage Kill Switch Now'}
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-main flex items-center gap-2">
                    <Clock size={18} className="text-amber-400" /> Pause API Consumption
                  </h4>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                      emergency.consumptionPaused
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {emergency.consumptionPaused ? 'PAUSED' : 'LIVE'}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Pauses the `/api/consume` route with HTTP 503 Maintenance response. Allows dashboard management and balance top-ups while pausing automated agent consumption.
                </p>
                <div className="mt-5">
                  <Button
                    variant={emergency.consumptionPaused ? 'primary' : 'secondary'}
                    className="w-full"
                    onClick={() => handleToggleEmergency('api_consumption_paused', !emergency.consumptionPaused)}
                  >
                    {emergency.consumptionPaused ? 'Resume API Consumption' : 'Pause API Consumption'}
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-main flex items-center gap-2">
                    <Lock size={18} className="text-blue-400" /> Whitelist Enforcement
                  </h4>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                      whitelistEnforced
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {whitelistEnforced ? 'ENFORCED' : 'OPEN ACCESS'}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Enforces that only whitelisted email addresses can log into the platform. When off, any user can create an account and access the dashboard.
                </p>
                <div className="mt-5">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handleToggleWhitelistEnforce}
                  >
                    {whitelistEnforced ? 'Disable Whitelist Enforcement' : 'Enable Whitelist Enforcement'}
                  </Button>
                </div>
              </Card>

              <Card className="p-5 border-red-500/40 bg-red-500/5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-red-400 flex items-center gap-2">
                    <AlertTriangle size={18} /> Panic: Revoke All Sessions
                  </h4>
                  <span className="text-xs font-mono text-muted">Security</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Terminates all active user sessions across the entire system immediately. Your current admin session will be preserved.
                </p>
                <div className="mt-5">
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => setShowPanicModal(true)}
                  >
                    Panic Revoke All Sessions
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 6: AUDIT LOGS */}
        {tab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-main">Administrative Audit Log</h3>
                <p className="text-xs text-muted">Every administrative operation is recorded immutably</p>
              </div>
              <Button variant="secondary" size="sm" onClick={loadAuditLogs}>
                <RefreshCw size={14} /> Refresh
              </Button>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    <Th>Timestamp</Th>
                    <Th>Admin / Action</Th>
                    <Th>Entity</Th>
                    <Th>Details</Th>
                  </tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr>
                      <Td colSpan={4} className="py-12 text-center">
                        <Spinner size={24} className="text-muted" />
                      </Td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <TdEmpty colSpan={4}>No audit logs recorded yet</TdEmpty>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-panel-hover/50 transition-colors">
                        <Td className="text-xs text-muted whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </Td>
                        <Td>
                          <span className="font-mono text-xs font-medium text-main">
                            {log.action}
                          </span>
                        </Td>
                        <Td className="text-xs font-mono text-muted">
                          {log.entityType}: {log.entityId}
                        </Td>
                        <Td className="text-xs font-mono text-muted max-w-xs truncate">
                          {log.details || '—'}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card>
          </div>
        )}
      </div>

      {/* MODAL: ADD WHITELIST */}
      {showAddWhitelistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-main">Add Account to Whitelist</h3>
            <p className="mt-1 text-xs text-muted">
              Whitelisted accounts can sign in via Google, Magic Link, or OTP.
            </p>
            <form onSubmit={handleAddWhitelist} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Email Address(es)
                </label>
                <textarea
                  rows={3}
                  value={newEmailInput}
                  onChange={e => setNewEmailInput(e.target.value)}
                  placeholder="Enter email or multiple emails separated by commas or newlines..."
                  required
                  className="w-full rounded-lg border border-border bg-panel p-3 text-sm font-mono text-main outline-none focus:border-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={newEmailNotes}
                  onChange={e => setNewEmailNotes(e.target.value)}
                  placeholder="e.g. Core team, Beta partner, Investor"
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-main outline-none focus:border-main"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddWhitelistModal(false)}
                  disabled={submittingWhitelist}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submittingWhitelist}>
                  {submittingWhitelist ? <Spinner size={16} /> : 'Add to Whitelist'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: CREATE PROMO CODE */}
      {showCreatePromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-main">Create Promo Code</h3>
            <p className="mt-1 text-xs text-muted">
              Users can redeem this code in their credit top-up screen.
            </p>
            <form onSubmit={handleCreatePromo} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Promo Code
                </label>
                <input
                  type="text"
                  value={newPromoCode}
                  onChange={e => setNewPromoCode(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME10"
                  required
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 font-mono text-sm uppercase text-main outline-none focus:border-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Credit Amount ($ USDC)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1000"
                  value={newPromoAmount}
                  onChange={e => setNewPromoAmount(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-main outline-none focus:border-main"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={newPromoDesc}
                  onChange={e => setNewPromoDesc(e.target.value)}
                  placeholder="e.g. $10 Welcome Credit"
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-main outline-none focus:border-main"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    Max Uses (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newPromoMax}
                    onChange={e => setNewPromoMax(e.target.value)}
                    placeholder="Unlimited"
                    className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-main outline-none focus:border-main"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newPromoExpiry}
                    onChange={e => setNewPromoExpiry(e.target.value)}
                    className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-main outline-none focus:border-main"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreatePromoModal(false)}
                  disabled={submittingPromo}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submittingPromo}>
                  {submittingPromo ? <Spinner size={16} /> : 'Create Promo Code'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: ADJUST USER CREDITS */}
      {showAdjustModal && adjustTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-main">Adjust Account Balance</h3>
            <p className="mt-1 text-xs text-muted">
              User: <span className="font-mono text-main">{adjustTargetUser.email}</span> (Current: ${adjustTargetUser.balance.toFixed(2)})
            </p>
            <form onSubmit={handleSubmitAdjust} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Adjustment Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('credit')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold cursor-pointer ${
                      adjustType === 'credit'
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                        : 'border-border bg-panel text-muted'
                    }`}
                  >
                    + Grant Credit
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('debit')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold cursor-pointer ${
                      adjustType === 'debit'
                        ? 'border-red-500/50 bg-red-500/20 text-red-400'
                        : 'border-border bg-panel text-muted'
                    }`}
                  >
                    - Deduct Credit
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Amount ($ USDC)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="10000"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-main outline-none focus:border-main font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Reason for Adjustment
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  required
                  placeholder="e.g. VIP test grant, Refund for error, Hackathon bonus"
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-main outline-none focus:border-main"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAdjustModal(false)}
                  disabled={submittingAdjust}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submittingAdjust}>
                  {submittingAdjust ? <Spinner size={16} /> : 'Apply Adjustment'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: USER DETAILS */}
      {selectedUserId && userDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-main">{userDetails.user.email}</h3>
                  {userDetails.flags.isSuspended && (
                    <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                      Suspended
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono text-muted">ID: {userDetails.user.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="cursor-pointer border-0 bg-transparent text-sm text-muted hover:text-main"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-5 py-4 pr-1">
              {/* Balances & quick stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-panel p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted">Current Float</div>
                  <div className="mt-1 text-lg font-bold font-mono text-emerald-400">
                    ${userDetails.balances.currentCredits.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-panel p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted">Total Spent</div>
                  <div className="mt-1 text-lg font-bold font-mono text-main">
                    ${userDetails.balances.totalSpent.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-panel p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted">Total Recharged</div>
                  <div className="mt-1 text-lg font-bold font-mono text-main">
                    ${userDetails.balances.totalRecharged.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Custodial Wallets */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                  Custodial Chain Wallets
                </h4>
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between rounded bg-panel p-2">
                    <span className="text-muted">Algorand:</span>
                    <span className="text-main">{userDetails.wallets.algorand || 'Not provisioned'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-panel p-2">
                    <span className="text-muted">EVM (Base/Sepolia):</span>
                    <span className="text-main">{userDetails.wallets.evm || 'Not provisioned'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-panel p-2">
                    <span className="text-muted">Solana:</span>
                    <span className="text-main">{userDetails.wallets.solana || 'Not provisioned'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-panel p-2">
                    <span className="text-muted">Stellar:</span>
                    <span className="text-main">{userDetails.wallets.stellar || 'Not provisioned'}</span>
                  </div>
                </div>
              </div>

              {/* Active Sessions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Active Sessions ({userDetails.activeSessions.length})
                  </h4>
                  {userDetails.activeSessions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRevokeUserSessions(userDetails.user.id, userDetails.user.email)}
                      className="text-xs text-red-400 hover:text-red-300 bg-transparent border-0 cursor-pointer p-0"
                    >
                      Revoke all user sessions
                    </button>
                  )}
                </div>
                {userDetails.activeSessions.length === 0 ? (
                  <p className="text-xs text-muted">No active sessions</p>
                ) : (
                  <div className="space-y-1 text-xs">
                    {userDetails.activeSessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between rounded bg-panel px-3 py-1.5 font-mono text-muted">
                        <span className="truncate max-w-sm">{s.user_agent || 'Unknown client'}</span>
                        <span>Expires: {new Date(s.expires_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Transactions */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                  Recent Credit Transactions
                </h4>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Type</Th>
                        <Th>Amount</Th>
                        <Th>Balance After</Th>
                        <Th>Description</Th>
                        <Th>Date</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {userDetails.transactions.length === 0 ? (
                        <TdEmpty colSpan={5}>No transactions recorded</TdEmpty>
                      ) : (
                        userDetails.transactions.map(t => (
                          <tr key={t.id}>
                            <Td className="text-xs font-mono font-semibold">
                              {t.kind}
                            </Td>
                            <Td className={`text-xs font-mono font-bold ${t.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {t.amount >= 0 ? '+' : ''}${t.amount.toFixed(2)}
                            </Td>
                            <Td className="text-xs font-mono text-muted">
                              ${t.balance_after.toFixed(2)}
                            </Td>
                            <Td className="text-xs text-muted max-w-xs truncate">
                              {t.description || t.reference || '—'}
                            </Td>
                            <Td className="text-xs text-muted whitespace-nowrap">
                              {new Date(t.created_at).toLocaleDateString()}
                            </Td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
              <Button
                variant={userDetails.flags.isSuspended ? 'secondary' : 'danger'}
                size="sm"
                onClick={() => handleToggleSuspendUser({
                  id: userDetails.user.id,
                  email: userDetails.user.email,
                  name: userDetails.user.name,
                  avatarUrl: userDetails.user.avatarUrl,
                  emailVerified: userDetails.user.emailVerified,
                  authProviders: userDetails.user.authProviders,
                  publisherId: userDetails.user.publisherId,
                  balance: userDetails.balances.currentCredits,
                  totalSpent: userDetails.balances.totalSpent,
                  totalRecharged: userDetails.balances.totalRecharged,
                  isSuspended: userDetails.flags.isSuspended,
                  suspensionReason: userDetails.flags.suspensionReason,
                  createdAt: userDetails.user.createdAt,
                  lastLoginAt: userDetails.user.lastLoginAt,
                })}
              >
                {userDetails.flags.isSuspended ? 'Reactivate Account' : 'Freeze / Suspend Account'}
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleOpenAdjust({
                      id: userDetails.user.id,
                      email: userDetails.user.email,
                      name: userDetails.user.name,
                      avatarUrl: userDetails.user.avatarUrl,
                      emailVerified: userDetails.user.emailVerified,
                      authProviders: userDetails.user.authProviders,
                      publisherId: userDetails.user.publisherId,
                      balance: userDetails.balances.currentCredits,
                      totalSpent: userDetails.balances.totalSpent,
                      totalRecharged: userDetails.balances.totalRecharged,
                      isSuspended: userDetails.flags.isSuspended,
                      suspensionReason: userDetails.flags.suspensionReason,
                      createdAt: userDetails.user.createdAt,
                      lastLoginAt: userDetails.user.lastLoginAt,
                    });
                  }}
                >
                  Adjust Balance
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedUserId(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: REJECT CREDIT REQUEST */}
      {showRejectModal && rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-red-400">
                <X size={18} />
                <h3 className="text-base font-semibold text-main">Reject Credit Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="text-muted hover:text-main cursor-pointer border-0 bg-transparent text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="mt-4 space-y-4">
              <div className="rounded-lg bg-panel p-3 border border-border text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted">User:</span>
                  <span className="font-mono text-main">{rejectingRequest.user_email || rejectingRequest.user_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Requested Amount:</span>
                  <span className="font-mono font-bold text-main">${rejectingRequest.amount_usdc.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted">User&apos;s Intent & Reason:</span>
                  <p className="mt-1 text-main italic bg-bg/50 p-2 rounded border border-border/50">
                    &ldquo;{rejectingRequest.reason || 'No intent provided'}&rdquo;
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Rejection Reason / Note (Optional)
                </label>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="e.g. Allocation limit reached, please re-apply next week"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-xs text-main placeholder-muted outline-none focus:border-main resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowRejectModal(false)}
                  disabled={submittingReject}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={submittingReject}
                >
                  {submittingReject ? <Spinner size={14} /> : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: PANIC SESSIONS CONFIRM */}
      {showPanicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <Card className="w-full max-w-md p-6 border-red-500/50">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">Emergency Session Revocation</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Are you sure you want to invalidate <strong className="text-main">all active user sessions</strong> across the platform?
            </p>
            <p className="mt-2 text-xs text-muted">
              All currently logged-in users will immediately be logged out and forced to re-authenticate. Your current admin session will be preserved.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowPanicModal(false)}
                disabled={panicLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handlePanicRevoke}
                disabled={panicLoading}
              >
                {panicLoading ? <Spinner size={16} /> : 'Yes, Revoke All Sessions'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
