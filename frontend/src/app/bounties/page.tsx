'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWeb3 } from '@/contexts/Web3Context';
import { api, Bounty } from '@/lib/api';
import { MOCK_BOUNTIES, simulateDelay } from '@/lib/mockData';
import {
  Search, ExternalLink, Clock, TrendingUp,
  Coins, Target, Sparkles, GitBranch, User, ChevronLeft,
  ChevronRight, Timer, ArrowUpRight, Filter, X, Plus, Wallet
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CreateBountyModal } from '@/components/CreateBountyModal';

// Helper function to truncate addresses for display
const truncateAddress = (address: string): string => {
  if (!address) return 'Unknown';
  // If it's an Ethereum address (0x...) or long address, truncate it
  if (address.length > 20) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
};

export default function BountiesPage() {
  const { isDemo, user } = useAuth();
  const { isBlockchainMode } = useWeb3();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create bounty modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIssueInput, setShowIssueInput] = useState(false);
  const [newBountyRepo, setNewBountyRepo] = useState('');
  const [newBountyIssue, setNewBountyIssue] = useState('');

  useEffect(() => {
    loadBounties();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, isDemo]);

  const loadBounties = async () => {
    setLoading(true);
    
    if (isDemo) {
      await simulateDelay(400);
      let filteredBounties = [...MOCK_BOUNTIES];
      
      if (statusFilter !== 'all') {
        filteredBounties = filteredBounties.filter(b => b.status === statusFilter);
      }
      
      const totalItems = filteredBounties.length;
      const pages = Math.ceil(totalItems / 12);
      const startIndex = (page - 1) * 12;
      const paginatedBounties = filteredBounties.slice(startIndex, startIndex + 12);
      
      setBounties(paginatedBounties as Bounty[]);
      setTotalPages(pages);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getAllBounties({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        limit: 12,
      });
      setBounties(data.bounties || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error('Failed to load bounties:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBounties = bounties.filter((bounty) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return bounty.repository.toLowerCase().includes(query) || bounty.issueId.toString().includes(query);
  });

  const getStatusConfig = (status: string, isEscalating?: boolean) => {
    if (status === 'active' && isEscalating) {
      return { 
        badge: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 text-xs font-medium border border-accent-100', 
        icon: Timer, 
        label: 'Escalating', 
        color: 'accent' 
      };
    }
    switch (status) {
      case 'active': 
        return { 
          badge: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-50 text-secondary-700 text-xs font-medium border border-secondary-100', 
          icon: Target, 
          label: 'Active', 
          color: 'secondary' 
        };
      case 'claimed': 
        return { 
          badge: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-100', 
          icon: Sparkles, 
          label: 'Claimed', 
          color: 'green' 
        };
      default: 
        return { 
          badge: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200', 
          icon: Target, 
          label: status, 
          color: 'gray' 
        };
    }
  };

  const handleOpenCreateModal = () => {
    setShowIssueInput(true);
    setNewBountyRepo('');
    setNewBountyIssue('');
  };

  const handleIssueInputSubmit = () => {
    if (!newBountyRepo || !newBountyIssue) return;
    // Validate repo format (owner/repo)
    if (!newBountyRepo.includes('/')) {
      alert('Please enter repository in format: owner/repo');
      return;
    }
    setShowIssueInput(false);
    setShowCreateModal(true);
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    setNewBountyRepo('');
    setNewBountyIssue('');
  };

  const handleBountySuccess = () => {
    loadBounties();
    handleModalClose();
  };

  return (
    <div className="min-h-screen pb-24 bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full 
                bg-secondary-100 text-secondary-700 text-sm font-medium mb-3">
                <Sparkles className="w-4 h-4" />
                Earn by fixing bugs
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                Explore Bounties
              </h1>
              <p className="text-gray-500">Find your next opportunity to earn MNEE</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                <div className="w-2 h-2 rounded-full bg-secondary-500 animate-pulse" />
                <span className="text-sm text-gray-600">
                  {filteredBounties.filter(b => b.status === 'active').length} active bounties
                </span>
              </div>
              
              {user && isBlockchainMode && (
                <button
                  onClick={handleOpenCreateModal}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span>Fund a Bounty</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search repositories or issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-200 
                  focus:border-gray-300 focus:ring-2 focus:ring-gray-100 
                  text-sm transition-all outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded 
                    hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Status Filter */}
            <div className="flex items-center gap-3">
              <Filter className="text-gray-400 w-4 h-4 hidden sm:block" />
              <div className="flex p-1 rounded-lg bg-gray-100">
                {['active', 'claimed', 'all'].map((status) => (
                  <button
                    key={status}
                    onClick={() => { setStatusFilter(status); setPage(1); }}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
                      ${statusFilter === status
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bounties Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-200 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-16 bg-gray-100 rounded-lg animate-pulse mb-4" />
                <div className="flex justify-between">
                  <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBounties.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <Target className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No bounties found</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm">
              {searchQuery 
                ? `No results for "${searchQuery}"` 
                : `No ${statusFilter !== 'all' ? statusFilter : ''} bounties at the moment`}
            </p>
            {(statusFilter !== 'all' || searchQuery) && (
              <button 
                onClick={() => { setStatusFilter('all'); setSearchQuery(''); }} 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 
                  text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredBounties.map((bounty) => {
                const statusConfig = getStatusConfig(bounty.status, bounty.isEligibleForEscalation);
                const hasEscalated = bounty.currentAmount > bounty.initialAmount;
                
                return (
                  <div
                    key={bounty.bountyId}
                    className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm
                      hover:shadow-md hover:border-gray-200 transition-all duration-200 group"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 
                          flex items-center justify-center
                          group-hover:scale-105 transition-transform duration-200">
                          <GitBranch className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {bounty.repository.split('/')[1] || bounty.repository}
                          </h3>
                          <p className="text-sm text-gray-500 truncate">
                            {bounty.repository.split('/')[0]}
                          </p>
                        </div>
                      </div>
                      <span className={statusConfig.badge}>
                        <statusConfig.icon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Issue Info */}
                    <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <a 
                          href={bounty.issueUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-1.5 text-primary-600 hover:text-primary-700 
                            font-medium text-sm transition-colors"
                        >
                          <span>Issue #{bounty.issueId}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                          <Clock className="w-3 h-3" />
                          <span>{formatDistanceToNow(new Date(bounty.createdAt), { addSuffix: false })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bounty Amount */}
                    <div className="mb-4">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                            Reward
                          </p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">
                              {bounty.currentAmount}
                            </span>
                            <span className="text-gray-500 text-sm font-medium">MNEE</span>
                          </div>
                        </div>
                        {hasEscalated && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md 
                            bg-green-50 text-green-700 text-xs font-medium border border-green-100">
                            <TrendingUp className="w-3 h-3" />
                            <span>+{bounty.currentAmount - bounty.initialAmount}</span>
                          </div>
                        )}
                      </div>
                      
                      {bounty.isEligibleForEscalation && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-accent-600 font-medium">
                          <Timer className="w-3 h-3" />
                          <span>Reward increasing soon</span>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="pt-4 border-t border-gray-100">
                      {bounty.status === 'active' ? (
                        <a
                          href={bounty.issueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 
                            rounded-lg bg-gray-900 text-white text-sm font-medium
                            hover:bg-gray-800 transition-colors group/btn"
                        >
                          <span>Claim Bounty</span>
                          <ArrowUpRight className="w-4 h-4 transition-transform 
                            group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                        </a>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0 flex-1">
                            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span
                              className="font-medium truncate"
                              title={bounty.solver || 'Unknown'}
                            >
                              {truncateAddress(bounty.solver || '')}
                            </span>
                          </div>
                          {bounty.pullRequestUrl && (
                            <a
                              href={bounty.pullRequestUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                border border-gray-200 text-gray-600 text-sm font-medium
                                hover:bg-gray-50 hover:border-gray-300 transition-colors flex-shrink-0"
                            >
                              View PR
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center
                    text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed 
                    transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-9 h-9 rounded-lg font-medium text-sm transition-all duration-200
                          ${page === pageNum
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && (
                    <span className="px-2 text-gray-400">...</span>
                  )}
                </div>
                
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center
                    text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed 
                    transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* How to Claim Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-16">
        <div className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-primary-100 flex items-center justify-center">
                <Coins className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">How to Claim a Bounty</h2>
                <p className="text-sm text-gray-500">Four simple steps to earning MNEE</p>
              </div>
            </div>
          </div>
          
          {/* Steps */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { num: 1, title: 'Find a bounty', desc: 'Browse active bounties and pick one you can fix' },
              { num: 2, title: 'Fix the bug', desc: 'Fork the repo and implement your solution' },
              { num: 3, title: 'Add your wallet', desc: 'Include your MNEE address in the PR description' },
              { num: 4, title: 'Get paid', desc: 'Once merged, payment is sent automatically' },
            ].map((step) => (
              <div key={step.num} className="relative">
                <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 
                  font-semibold text-sm flex items-center justify-center mb-3">
                  {step.num}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
          
          {/* Code example */}
          <div className="rounded-lg bg-gray-900 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/50 border-b border-gray-700/50">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
              <div className="w-3 h-3 rounded-full bg-green-400/80" />
              <span className="ml-auto text-gray-500 text-xs">Pull Request Description</span>
            </div>
            <div className="p-4 font-mono text-sm">
              <span className="text-gray-500"># Add this to your PR description:</span>
              <br />
              <span className="text-primary-400">MNEE:</span>{' '}
              <span className="text-secondary-400">1YourWalletAddressHere</span>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Input Modal */}
      {showIssueInput && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowIssueInput(false)}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
                <Wallet className="w-6 h-6 text-primary-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Fund a Bounty</h2>
              <p className="text-gray-500 text-sm mb-6">
                Enter the GitHub repository and issue number you want to fund
              </p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repository
                  </label>
                  <input
                    type="text"
                    value={newBountyRepo}
                    onChange={(e) => setNewBountyRepo(e.target.value)}
                    placeholder="owner/repo"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200
                      focus:border-primary-300 focus:ring-2 focus:ring-primary-100
                      outline-none transition-all"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    e.g., facebook/react or vercel/next.js
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issue Number
                  </label>
                  <input
                    type="number"
                    value={newBountyIssue}
                    onChange={(e) => setNewBountyIssue(e.target.value)}
                    placeholder="42"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200
                      focus:border-primary-300 focus:ring-2 focus:ring-primary-100
                      outline-none transition-all"
                    min="1"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowIssueInput(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200
                    text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleIssueInputSubmit}
                  disabled={!newBountyRepo || !newBountyIssue || parseInt(newBountyIssue) < 1}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Bounty Modal */}
      {newBountyRepo && newBountyIssue && (
        <CreateBountyModal
          isOpen={showCreateModal}
          onClose={handleModalClose}
          repository={newBountyRepo}
          issueId={parseInt(newBountyIssue)}
          issueUrl={`https://github.com/${newBountyRepo}/issues/${newBountyIssue}`}
          onSuccess={handleBountySuccess}
        />
      )}
    </div>
  );
}