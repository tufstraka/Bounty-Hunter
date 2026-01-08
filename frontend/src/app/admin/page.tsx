'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { api, Bounty, Metrics, User } from '@/lib/api';
import { MOCK_BOUNTIES, MOCK_USERS, MOCK_METRICS, simulateDelay } from '@/lib/mockData';
import { Coins, Users, Activity, Database, RefreshCw, AlertTriangle, Shield, Wallet, TrendingUp, Clock, Zap, Target, GitBranch, ExternalLink, Server, Award, Link2, Box } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AdminPage() {
  const { user, loading, isDemo } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [eligibleForEscalation, setEligibleForEscalation] = useState<Bounty[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [escalating, setEscalating] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDemo]);

  const loadData = async () => {
    setLoadingData(true);
    
    // Use mock data in demo mode
    if (isDemo) {
      await simulateDelay(500);
      setMetrics(MOCK_METRICS as Metrics);
      setBounties(MOCK_BOUNTIES.slice(0, 10) as Bounty[]);
      setUsers(MOCK_USERS as User[]);
      // Filter bounties eligible for escalation in demo
      const eligibleBounties = MOCK_BOUNTIES.filter(b => b.isEligibleForEscalation);
      setEligibleForEscalation(eligibleBounties as Bounty[]);
      setLoadingData(false);
      return;
    }

    try {
      const [metricsData, bountiesData, usersData, escalationData] = await Promise.all([
        api.getMetrics(),
        api.getAllBounties({ limit: 10 }),
        api.getAllUsers({ limit: 10 }),
        api.getEligibleForEscalation(),
      ]);
      setMetrics(metricsData);
      setBounties(bountiesData.bounties || []);
      setUsers(usersData.users || []);
      setEligibleForEscalation(escalationData);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleEscalation = async () => {
    setEscalating(true);
    
    // Simulate escalation in demo mode
    if (isDemo) {
      await simulateDelay(1500);
      alert(`Demo: ${eligibleForEscalation.length} bounties would be escalated`);
      setEscalating(false);
      return;
    }

    try {
      const result = await api.triggerEscalationCheck();
      alert(`Escalation complete: ${result.escalated} bounties escalated`);
      loadData();
    } catch (error) {
      console.error('Escalation failed:', error);
      alert('Escalation check failed');
    } finally {
      setEscalating(false);
    }
  };

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-grape-400 to-grape-600 flex items-center justify-center animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-warm-500 animate-pulse">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-grape-400 to-grape-600 flex items-center justify-center shadow-grape">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-warm-900">Admin Dashboard</h1>
              <p className="text-warm-500">System overview and management</p>
            </div>
          </div>
          <button onClick={loadData} className="btn-secondary self-start md:self-auto" disabled={loadingData}>
            <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          <div className="stat-card-ocean">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-ocean-400 to-ocean-600 flex items-center justify-center shadow-ocean">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="badge-active text-xs">Live</span>
            </div>
            <div className="text-3xl font-bold text-ocean-600">{loadingData ? '...' : metrics?.bounties.total || 0}</div>
            <p className="text-warm-500 text-sm mt-1">Total Bounties</p>
          </div>

          <div className="stat-card-honey">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-honey-400 to-honey-600 flex items-center justify-center shadow-honey">
                <Coins className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="bounty-amount text-3xl">{loadingData ? '...' : metrics?.tokens.locked.toFixed(0) || 0}</div>
            <p className="text-warm-500 text-sm mt-1">MNEE Locked</p>
          </div>

          <div className="stat-card-grape">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-grape-400 to-grape-600 flex items-center justify-center shadow-grape">
                <Target className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-grape-600">{loadingData ? '...' : metrics?.bounties.active || 0}</div>
            <p className="text-warm-500 text-sm mt-1">Active Bounties</p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-green-600">{loadingData ? '...' : metrics?.bounties.success_rate || '0%'}</div>
            <p className="text-warm-500 text-sm mt-1">Success Rate</p>
          </div>
        </div>

        {/* Escrow Contract Section - Show when blockchain mode is enabled */}
        {metrics?.escrow?.enabled && (
          <div className="glass-card p-6 mb-8 border-2 border-ocean-200 bg-gradient-to-r from-ocean-50/50 to-grape-50/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-400 to-ocean-600 flex items-center justify-center">
                <Box className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-warm-800">Escrow Contract</h2>
                <p className="text-sm text-warm-500">On-chain bounty funds</p>
              </div>
              <span className="ml-auto badge-active">On-Chain</span>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/80 border border-ocean-100">
                <p className="text-xs text-warm-500 uppercase tracking-wide font-medium mb-1">Contract Address</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-warm-800 text-sm truncate" title={metrics.escrow.contract_address || ''}>
                    {metrics.escrow.contract_address
                      ? `${metrics.escrow.contract_address.slice(0, 8)}...${metrics.escrow.contract_address.slice(-6)}`
                      : 'Not configured'}
                  </p>
                  {metrics.escrow.contract_address && (
                    <a
                      href={`https://sepolia.etherscan.io/address/${metrics.escrow.contract_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ocean-500 hover:text-ocean-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-ocean-100 to-grape-100 border border-ocean-200">
                <p className="text-xs text-warm-500 uppercase tracking-wide font-medium mb-1">Escrow Balance</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-ocean-700">{metrics.escrow.balance?.toFixed(2) || '0'}</span>
                  <span className="text-ocean-600 font-medium">MNEE</span>
                </div>
                <p className="text-xs text-warm-500 mt-1">Funds locked in active bounties</p>
              </div>
              
              <div className="p-4 rounded-xl bg-white/80 border border-ocean-100">
                <p className="text-xs text-warm-500 uppercase tracking-wide font-medium mb-1">On-Chain Bounties</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-grape-700">{metrics.bounties.on_chain || 0}</span>
                  <span className="text-warm-500 text-sm">bounties</span>
                </div>
                <p className="text-xs text-warm-500 mt-1">Owner-funded via smart contract</p>
              </div>
            </div>
            
            {metrics.escrow.error && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Error: {metrics.escrow.error}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legacy Wallet Section - Show when blockchain mode is disabled or as secondary info */}
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-honey-100 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-honey-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-warm-800">
                {metrics?.system.blockchain_mode ? 'Legacy MNEE Wallet' : 'Bot Wallet'}
              </h2>
              <p className="text-sm text-warm-500">
                {metrics?.system.blockchain_mode ? 'MNEE SDK wallet (for direct payments)' : 'System treasury status'}
              </p>
            </div>
            {!metrics?.system.blockchain_mode && (
              <span className="ml-auto text-xs text-warm-500 bg-warm-100 px-2 py-1 rounded">Off-chain mode</span>
            )}
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-warm-50 border border-warm-100">
              <p className="text-xs text-warm-500 uppercase tracking-wide font-medium mb-1">Wallet Address</p>
              <p className="font-mono text-warm-800 text-sm break-all">{metrics?.tokens.wallet_address || 'Loading...'}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-r from-honey-50 to-ocean-50 border border-honey-100">
              <p className="text-xs text-warm-500 uppercase tracking-wide font-medium mb-1">Available Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="bounty-amount text-3xl">{metrics?.tokens.wallet_balance?.toFixed(2) || '0'}</span>
                <span className="text-warm-500 font-medium">MNEE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Escalation Alert */}
        {eligibleForEscalation.length > 0 && (
          <div className="glass-card p-6 mb-8 border-2 border-grape-200 bg-gradient-to-r from-grape-50 to-honey-50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-grape-400 to-grape-600 flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-grape-800">
                    {eligibleForEscalation.length} Bounties Ready for Escalation
                  </h2>
                  <p className="text-sm text-grape-600">These bounties have been unclaimed long enough to increase their rewards</p>
                </div>
              </div>
              <button onClick={handleEscalation} disabled={escalating} className="btn-grape self-start md:self-auto">
                {escalating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Run Escalation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Data Panels */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Bounties */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-warm-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-ocean-100 flex items-center justify-center">
                    <GitBranch className="w-5 h-5 text-ocean-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-warm-800">Recent Bounties</h2>
                </div>
              </div>
            </div>
            
            {loadingData ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-xl skeleton mx-auto mb-3" />
                <div className="skeleton-text w-32 mx-auto" />
              </div>
            ) : (
              <div className="divide-y divide-warm-100">
                {bounties.map((bounty) => (
                  <div key={bounty.bountyId} className="p-4 hover:bg-warm-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-warm-100 flex items-center justify-center flex-shrink-0">
                          <GitBranch className="w-5 h-5 text-warm-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-warm-800 truncate">{bounty.repository.split('/')[1] || bounty.repository}</p>
                          <a href={bounty.issueUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-honey-600 hover:text-honey-700 flex items-center gap-1">
                            Issue #{bounty.issueId} <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="font-bold text-warm-800">{bounty.currentAmount} MNEE</div>
                        <span className={`badge-${bounty.status} text-xs`}>
                          {bounty.status.charAt(0).toUpperCase() + bounty.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Users */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-warm-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-grape-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-grape-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-warm-800">Recent Users</h2>
                </div>
              </div>
            </div>
            
            {loadingData ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-full skeleton mx-auto mb-3" />
                <div className="skeleton-text w-32 mx-auto" />
              </div>
            ) : (
              <div className="divide-y divide-warm-100">
                {users.map((u) => (
                  <div key={u.id} className="p-4 hover:bg-warm-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {u.avatarUrl ? (
                          <Image src={u.avatarUrl} alt={u.name || u.githubLogin} width={40} height={40} className="rounded-lg ring-2 ring-white shadow-sm" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-honey-400 to-honey-600 flex items-center justify-center text-white font-bold">
                            {u.githubLogin[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-warm-800 truncate">{u.name || u.githubLogin}</p>
                          <p className="text-xs text-warm-500">@{u.githubLogin}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-warm-800">{u.totalEarned?.toFixed(0) || 0}</span>
                          <span className="text-xs text-warm-500">MNEE</span>
                        </div>
                        {u.role === 'admin' && (
                          <span className="badge-pending text-xs">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Info */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-warm-100 flex items-center justify-center">
              <Server className="w-5 h-5 text-warm-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-warm-800">System Information</h2>
              <p className="text-sm text-warm-500">Backend health and statistics</p>
            </div>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-warm-50">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-warm-400" />
                <span className="text-xs text-warm-500 uppercase tracking-wide font-medium">Node Version</span>
              </div>
              <p className="font-mono text-warm-800">{metrics?.system.node_version || 'N/A'}</p>
            </div>
            
            <div className="p-4 rounded-xl bg-warm-50">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-warm-400" />
                <span className="text-xs text-warm-500 uppercase tracking-wide font-medium">Uptime</span>
              </div>
              <p className="font-mono text-warm-800">
                {metrics?.system.uptime ? `${Math.floor(metrics.system.uptime / 3600)}h ${Math.floor((metrics.system.uptime % 3600) / 60)}m` : 'N/A'}
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-warm-50">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-warm-400" />
                <span className="text-xs text-warm-500 uppercase tracking-wide font-medium">Total Claimed</span>
              </div>
              <p className="font-mono text-warm-800">{metrics?.tokens.claimed?.toFixed(2) || 0} MNEE</p>
            </div>
            
            <div className="p-4 rounded-xl bg-warm-50">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-warm-400" />
                <span className="text-xs text-warm-500 uppercase tracking-wide font-medium">Total Users</span>
              </div>
              <p className="font-mono text-warm-800">{users.length}+</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}