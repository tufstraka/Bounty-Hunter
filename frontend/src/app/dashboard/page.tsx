'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { api, Bounty } from '@/lib/api';
import { MOCK_BOUNTIES, MOCK_STATS, simulateDelay } from '@/lib/mockData';
import { Coins, CheckCircle, Clock, ExternalLink, TrendingUp, Sparkles, AlertCircle, ArrowUpRight, Wallet, GitPullRequest, Trophy, Target, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserStats {
  totalClaimed: number;
  totalEarned: number;
  repositoriesContributed: number;
  memberSince: string;
}

export default function DashboardPage() {
  const { user, loading, isDemo } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDemo]);

  const loadData = async () => {
    if (isDemo) {
      await simulateDelay(500);
      setStats(MOCK_STATS);
      const userBounties = MOCK_BOUNTIES.filter(b =>
        b.solver === user?.githubLogin || b.status === 'active'
      ).slice(0, 10);
      setBounties(userBounties as Bounty[]);
      setLoadingData(false);
      return;
    }

    try {
      const [statsData, bountiesData] = await Promise.all([
        api.getMyStats(),
        api.getMyBounties({ limit: 10 }),
      ]);
      setStats(statsData);
      setBounties(bountiesData.bounties || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 
            flex items-center justify-center animate-pulse shadow-lg">
            <Target className="w-7 h-7 text-white" />
          </div>
          <p className="text-gray-500 animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active': 
        return { 
          className: 'bg-secondary-50 text-secondary-700 border border-secondary-200', 
          icon: Target 
        };
      case 'claimed': 
        return { 
          className: 'bg-green-50 text-green-700 border border-green-200', 
          icon: CheckCircle 
        };
      case 'pending': 
        return { 
          className: 'bg-primary-50 text-primary-700 border border-primary-200', 
          icon: Clock 
        };
      case 'cancelled': 
        return { 
          className: 'bg-gray-100 text-gray-600 border border-gray-200', 
          icon: AlertCircle 
        };
      default: 
        return { 
          className: 'bg-gray-100 text-gray-600 border border-gray-200', 
          icon: Target 
        };
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              {user.avatarUrl ? (
                <Image 
                  src={user.avatarUrl} 
                  alt={user.name || user.githubLogin} 
                  width={56} 
                  height={56} 
                  className="rounded-xl ring-2 ring-gray-100 shadow-sm" 
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 
                  flex items-center justify-center text-white text-xl font-semibold shadow-md">
                  {user.githubLogin[0].toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome back, {user.name?.split(' ')[0] || user.githubLogin}
                </h1>
                <p className="text-gray-500 mt-0.5">Here&apos;s your bounty activity</p>
              </div>
            </div>
            
            <Link href="/bounties" className="btn-primary self-start md:self-auto">
              <Sparkles className="w-4 h-4" />
              <span>Find Bounties</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Earned */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100
            hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <Coins className="w-5 h-5 text-primary-600" />
              </div>
              {!loadingData && stats && stats.totalEarned > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full 
                  bg-green-100 text-green-700 text-xs font-medium">
                  <TrendingUp className="w-3 h-3" />
                  Earning
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {loadingData ? '—' : stats?.totalEarned?.toFixed(0) || '0'}
            </div>
            <p className="text-gray-500 text-sm mt-1">MNEE Earned</p>
          </div>

          {/* Bounties Completed */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100
            hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-secondary-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {loadingData ? '—' : stats?.totalClaimed || 0}
            </div>
            <p className="text-gray-500 text-sm mt-1">Completed</p>
          </div>

          {/* Projects Helped */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100
            hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
                <GitPullRequest className="w-5 h-5 text-accent-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {loadingData ? '—' : stats?.repositoriesContributed || 0}
            </div>
            <p className="text-gray-500 text-sm mt-1">Projects</p>
          </div>

          {/* Time Hunting */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100
            hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-900">
              {loadingData ? '—' : stats?.memberSince ? formatDistanceToNow(new Date(stats.memberSince)) : 'New'}
            </div>
            <p className="text-gray-500 text-sm mt-1">Time Hunting</p>
          </div>
        </div>

        {/* Wallet Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
              <Wallet className="w-4.5 h-4.5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Payment Wallet</h2>
              <p className="text-sm text-gray-500">Where your bounties land</p>
            </div>
          </div>
          
          {user.mneeAddress ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 
              p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">MNEE Address</p>
                  <p className="font-mono text-gray-800 text-sm truncate">{user.mneeAddress}</p>
                </div>
              </div>
              <Link href="/settings" className="btn-secondary text-sm flex-shrink-0">
                Update
              </Link>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-primary-50 border border-primary-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-primary-900">No wallet connected</p>
                    <p className="text-sm text-primary-700">Add your MNEE address to receive payments</p>
                  </div>
                </div>
                <Link href="/settings" className="btn-primary text-sm flex-shrink-0">
                  <Wallet className="w-4 h-4" />
                  Add Wallet
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Bounty History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent-100 flex items-center justify-center">
                  <Trophy className="w-4.5 h-4.5 text-accent-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Bounty History</h2>
                  <p className="text-sm text-gray-500">Your recent activity</p>
                </div>
              </div>
              <Link href="/bounties" className="inline-flex items-center gap-1.5 text-primary-600 
                hover:text-primary-700 font-medium text-sm transition-colors group">
                Browse all
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 
                  group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>

          {loadingData ? (
            <div className="p-12 text-center">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center 
                mx-auto mb-3 animate-pulse">
                <Zap className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">Loading bounties...</p>
            </div>
          ) : bounties.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center 
                mx-auto mb-4">
                <Target className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No bounties yet</h3>
              <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
                Start hunting! Find an issue to fix and earn your first bounty.
              </p>
              <Link href="/bounties" className="btn-primary">
                <Sparkles className="w-4 h-4" />
                Explore Bounties
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider 
                      px-6 py-3 bg-gray-50/50">Repository</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider 
                      px-6 py-3 bg-gray-50/50">Issue</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider 
                      px-6 py-3 bg-gray-50/50">Reward</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider 
                      px-6 py-3 bg-gray-50/50">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider 
                      px-6 py-3 bg-gray-50/50">When</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider 
                      px-6 py-3 bg-gray-50/50"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bounties.map((bounty) => {
                    const statusConfig = getStatusConfig(bounty.status);
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <tr key={bounty.bountyId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <GitPullRequest className="w-4 h-4 text-gray-500" />
                            </div>
                            <span className="font-medium text-gray-900 truncate max-w-[200px]">
                              {bounty.repository.split('/')[1] || bounty.repository}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <a 
                            href={bounty.issueUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 
                              font-medium transition-colors"
                          >
                            #{bounty.issueId}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-baseline gap-1">
                            <span className="font-semibold text-gray-900">
                              {bounty.claimedAmount || bounty.currentAmount}
                            </span>
                            <span className="text-xs text-gray-500">MNEE</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full 
                            text-xs font-medium ${statusConfig.className}`}>
                            <StatusIcon className="w-3 h-3" />
                            {bounty.status.charAt(0).toUpperCase() + bounty.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-500">
                            {bounty.claimedAt
                              ? formatDistanceToNow(new Date(bounty.claimedAt), { addSuffix: true })
                              : formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: true })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {bounty.pullRequestUrl && (
                            <a 
                              href={bounty.pullRequestUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center 
                                text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}