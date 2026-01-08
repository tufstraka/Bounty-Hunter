'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useWeb3 } from '@/contexts/Web3Context';
import { api, Repository } from '@/lib/api';
import { DEMO_REPOSITORIES, simulateDelay } from '@/lib/mockData';
import { FolderKanban, GitBranch, Coins, CheckCircle, Target, ExternalLink, Plus, ArrowUpRight, Sparkles, Settings, Wallet } from 'lucide-react';
import { CreateBountyModal } from '@/components/CreateBountyModal';

export default function ProjectsPage() {
  const { user, loading, isDemo } = useAuth();
  const { isBlockchainMode } = useWeb3();
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Create bounty modal state
  const [showCreateBountyModal, setShowCreateBountyModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [issueNumber, setIssueNumber] = useState('');
  const [showIssueInput, setShowIssueInput] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadRepositories();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDemo]);

  const loadRepositories = async () => {
    if (isDemo) {
      await simulateDelay(400);
      setRepositories(DEMO_REPOSITORIES as Repository[]);
      setLoadingData(false);
      return;
    }

    try {
      const data = await api.getMyRepositories();
      setRepositories(data.repositories || []);
    } catch (error) {
      console.error('Failed to load repositories:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateBounty = (repo: string) => {
    setSelectedRepo(repo);
    setShowIssueInput(true);
    setIssueNumber('');
  };

  const handleIssueSubmit = () => {
    if (!selectedRepo || !issueNumber) return;
    setShowIssueInput(false);
    setShowCreateBountyModal(true);
  };

  const handleModalClose = () => {
    setShowCreateBountyModal(false);
    setSelectedRepo(null);
    setIssueNumber('');
  };

  const handleBountySuccess = () => {
    // Refresh repository data to show updated bounty counts
    loadRepositories();
    handleModalClose();
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 
            flex items-center justify-center animate-pulse shadow-lg">
            <FolderKanban className="w-7 h-7 text-white" />
          </div>
          <p className="text-gray-500 animate-pulse">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full 
                bg-accent-100 text-accent-700 text-sm font-medium mb-3">
                <GitBranch className="w-4 h-4" />
                <span>Repositories</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">My Projects</h1>
              <p className="text-gray-500">Manage your repositories with FixFlow installed</p>
            </div>
            
            <a
              href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'bounty-hunter-bot'}/installations/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Repository</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {loadingData ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm animate-pulse">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-lg bg-gray-200" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-20 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="h-16 bg-gray-100 rounded-lg" />
                  <div className="h-16 bg-gray-100 rounded-lg" />
                  <div className="h-16 bg-gray-100 rounded-lg" />
                </div>
                <div className="h-10 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : repositories.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <FolderKanban className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No projects yet</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Install the FixFlow GitHub App on your repositories to start creating automated bounties.
            </p>
            <a
              href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'fix-flow'}/installations/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex"
            >
              <GitBranch className="w-5 h-5" />
              <span>Install GitHub App</span>
            </a>
            
            <div className="mt-10 p-5 rounded-xl bg-gray-50 border border-gray-200 text-left max-w-lg mx-auto">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-500" />
                How it works
              </h3>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs 
                    flex items-center justify-center font-semibold flex-shrink-0">1</span>
                  <span>Install the GitHub App on your repository</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs 
                    flex items-center justify-center font-semibold flex-shrink-0">2</span>
                  <span>Add the FixFlow workflow to your CI pipeline</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs 
                    flex items-center justify-center font-semibold flex-shrink-0">3</span>
                  <span>When tests fail, bounties are created automatically</span>
                </li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {repositories.map((repo, index) => (
              <div
                key={repo.repository}
                className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm
                  hover:shadow-md hover:border-gray-200 transition-all duration-200 group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 
                      flex items-center justify-center shadow-sm 
                      group-hover:scale-105 transition-transform duration-200">
                      <GitBranch className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {repo.repository.split('/')[1]}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{repo.repository.split('/')[0]}</p>
                    </div>
                  </div>
                  <a
                    href={`https://github.com/${repo.repository}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center 
                      text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="p-3 rounded-lg bg-gray-50 text-center">
                    <p className="text-xl font-bold text-gray-900">{repo.totalBounties}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Total</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary-50 text-center">
                    <p className="text-xl font-bold text-secondary-700">{repo.activeBounties}</p>
                    <p className="text-xs text-secondary-600 mt-0.5">Active</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 text-center">
                    <p className="text-xl font-bold text-green-700">{repo.claimedBounties}</p>
                    <p className="text-xs text-green-600 mt-0.5">Done</p>
                  </div>
                </div>

                {/* Locked Amount */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary-50 
                  border border-primary-100 mb-5">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-primary-600" />
                    <span className="text-sm text-primary-700 font-medium">Locked</span>
                  </div>
                  <span className="font-bold text-primary-700">
                    {repo.totalLocked?.toFixed(0) || 0} MNEE
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/bounties?repo=${repo.repository}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5
                      rounded-lg bg-gray-900 text-white text-sm font-medium
                      hover:bg-gray-800 transition-colors"
                  >
                    <Target className="w-4 h-4" />
                    <span>View Bounties</span>
                  </Link>
                  {isBlockchainMode && (
                    <button
                      onClick={() => handleCreateBounty(repo.repository)}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-lg
                        bg-primary-100 text-primary-600 hover:bg-primary-200
                        transition-colors"
                      title="Fund a Bounty"
                    >
                      <Wallet className="w-4 h-4" />
                    </button>
                  )}
                  <a
                    href={`https://github.com/${repo.repository}/settings/installations`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg
                      border border-gray-200 text-gray-500 hover:text-gray-700
                      hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add More Section */}
        {repositories.length > 0 && (
          <div className="mt-8">
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Add more repositories</h3>
                    <p className="text-sm text-gray-500">Extend FixFlow to your other projects</p>
                  </div>
                </div>
                <a
                  href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'fix-flow'}/installations/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary self-start sm:self-auto group"
                >
                  <span>Configure GitHub App</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform 
                    group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Issue Number Input Modal */}
      {showIssueInput && selectedRepo && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowIssueInput(false)}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Fund a Bounty</h2>
              <p className="text-gray-500 text-sm mb-6">
                Enter the GitHub issue number you want to fund for{' '}
                <span className="font-medium text-gray-700">{selectedRepo}</span>
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issue Number
                </label>
                <input
                  type="number"
                  value={issueNumber}
                  onChange={(e) => setIssueNumber(e.target.value)}
                  placeholder="e.g., 42"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200
                    focus:border-primary-300 focus:ring-2 focus:ring-primary-100
                    outline-none transition-all"
                  min="1"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-2">
                  Find the issue number in the URL: github.com/{selectedRepo}/issues/<span className="font-semibold text-primary-600">42</span>
                </p>
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
                  onClick={handleIssueSubmit}
                  disabled={!issueNumber || parseInt(issueNumber) < 1}
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
      {selectedRepo && issueNumber && (
        <CreateBountyModal
          isOpen={showCreateBountyModal}
          onClose={handleModalClose}
          repository={selectedRepo}
          issueId={parseInt(issueNumber)}
          issueUrl={`https://github.com/${selectedRepo}/issues/${issueNumber}`}
          onSuccess={handleBountySuccess}
        />
      )}
    </div>
  );
}