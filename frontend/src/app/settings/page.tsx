'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useWeb3 } from '@/contexts/Web3Context';
import WalletConnect from '@/components/WalletConnect';
import { api } from '@/lib/api';
import { simulateDelay } from '@/lib/mockData';
import { Save, User, Wallet, Shield, CheckCircle, AlertCircle, ExternalLink, Coins, Trophy, Calendar, Sparkles, RefreshCw, Eye, Hexagon, ArrowRight, Link as LinkIcon } from 'lucide-react';

export default function SettingsPage() {
  const { user, loading, refreshUser, isDemo } = useAuth();
  const { address: ethereumAddress, isConnected, balance: ethBalance, isBlockchainMode } = useWeb3();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mneeAddress, setMneeAddress] = useState('');
  const [ethereumAddressInput, setEthereumAddressInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setMneeAddress(user.mneeAddress || '');
      setEthereumAddressInput((user as any).ethereumAddress || '');
    }
  }, [user]);

  // Auto-fill Ethereum address when wallet connects
  useEffect(() => {
    if (isConnected && ethereumAddress && !ethereumAddressInput) {
      setEthereumAddressInput(ethereumAddress);
    }
  }, [isConnected, ethereumAddress, ethereumAddressInput]);

  const useConnectedWallet = () => {
    if (ethereumAddress) {
      setEthereumAddressInput(ethereumAddress);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // In demo mode, simulate saving without API call
    if (isDemo) {
      await simulateDelay(800);
      setMessage({ type: 'info', text: 'Demo mode: Changes would be saved in a real account.' });
      setTimeout(() => setMessage(null), 5000);
      setSaving(false);
      return;
    }

    try {
      const profileData: any = {
        name: name || undefined,
        email: email || undefined,
        mneeAddress: mneeAddress || undefined,
      };
      
      // Include Ethereum address if in blockchain mode
      if (isBlockchainMode && ethereumAddressInput) {
        profileData.ethereumAddress = ethereumAddressInput;
      }
      
      await api.updateProfile(profileData);
      await refreshUser();
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-honey-400 to-honey-600 flex items-center justify-center animate-pulse">
            <User className="w-8 h-8 text-white" />
          </div>
          <p className="text-warm-500 animate-pulse">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt={user.name || user.githubLogin} width={72} height={72} className="rounded-2xl ring-4 ring-white shadow-glass" />
            ) : (
              <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-honey-400 to-honey-600 flex items-center justify-center text-white text-3xl font-bold shadow-honey">
                {user.githubLogin[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-warm-900">Account Settings</h1>
              <p className="text-warm-500">Manage your profile and payment preferences</p>
            </div>
          </div>
        </div>

        {/* Demo Mode Notice */}
        {isDemo && (
          <div className="mb-6 p-4 rounded-xl flex items-center gap-3 bg-gradient-to-r from-grape-50 to-ocean-50 border border-grape-200">
            <Eye className="w-5 h-5 text-grape-500 flex-shrink-0" />
            <div>
              <span className="font-medium text-grape-800">Demo Mode</span>
              <span className="text-grape-600 ml-2">Changes won&apos;t be saved to a real account.</span>
            </div>
          </div>
        )}

        {/* Success/Error/Info Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-slide-down ${
            message.type === 'success'
              ? 'bg-gradient-to-r from-green-50 to-ocean-50 border border-green-200 text-green-800'
              : message.type === 'info'
              ? 'bg-gradient-to-r from-ocean-50 to-grape-50 border border-ocean-200 text-ocean-800'
              : 'bg-gradient-to-r from-red-50 to-honey-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            ) : message.type === 'info' ? (
              <Eye className="w-5 h-5 text-ocean-500 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Section */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-ocean-100 flex items-center justify-center">
                <User className="w-5 h-5 text-ocean-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-warm-800">Profile Information</h2>
                <p className="text-sm text-warm-500">How you appear to others</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="label">GitHub Username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={user.githubLogin}
                    disabled
                    className="input bg-warm-50 text-warm-500 cursor-not-allowed"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="badge-active text-xs">Verified</span>
                  </div>
                </div>
                <p className="text-xs text-warm-400 mt-1.5">Connected via GitHub OAuth</p>
              </div>

              <div>
                <label className="label">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your display name"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input"
                />
                <p className="text-xs text-warm-400 mt-1.5">Used for notifications only</p>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-honey-100 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-honey-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-warm-800">Payment Settings</h2>
                  <p className="text-sm text-warm-500">Where you receive your earnings</p>
                </div>
              </div>
              
              {/* Payment Mode Indicator */}
              {isBlockchainMode ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-grape-100 to-ocean-100 border border-grape-200/50">
                  <Hexagon className="w-4 h-4 text-grape-500" />
                  <span className="text-xs font-medium text-grape-700">Blockchain Mode</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-honey-100 border border-honey-200/50">
                  <Coins className="w-4 h-4 text-honey-500" />
                  <span className="text-xs font-medium text-honey-700">MNEE SDK</span>
                </div>
              )}
            </div>

            {/* MNEE Wallet Address (for non-blockchain mode) */}
            {!isBlockchainMode && (
              <>
                <div>
                  <label className="label">MNEE Wallet Address</label>
                  <input
                    type="text"
                    value={mneeAddress}
                    onChange={(e) => setMneeAddress(e.target.value)}
                    placeholder="1YourMneeAddressHere..."
                    className="input font-mono"
                  />
                  <p className="text-xs text-warm-400 mt-1.5">
                    Bounty payments are sent automatically to this address
                  </p>
                </div>

                {!mneeAddress && (
                  <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-honey-50 to-honey-100 border border-honey-200">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-honey-200 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-honey-700" />
                      </div>
                      <div>
                        <p className="font-medium text-honey-800 mb-1">Wallet Required</p>
                        <p className="text-sm text-honey-700 mb-3">
                          Add your MNEE wallet address to receive bounty payments.
                        </p>
                        <a
                          href="https://mnee.io"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-honey-700 hover:text-honey-800"
                        >
                          Create a wallet at mnee.io
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {mneeAddress && (
                  <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-green-50 to-ocean-50 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-green-800">Wallet Connected</p>
                        <p className="text-sm text-green-600">Ready to receive payments</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Ethereum Wallet Address (for blockchain mode) */}
            {isBlockchainMode && (
              <>
                {/* Wallet Connection Section */}
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-grape-50/50 to-ocean-50/50 border border-grape-200/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Hexagon className="w-5 h-5 text-grape-500" />
                      <span className="font-medium text-grape-800">Connect Your Wallet</span>
                    </div>
                    {isConnected && ethBalance && (
                      <div className="text-sm text-grape-600">
                        Balance: <span className="font-mono font-semibold">{parseFloat(ethBalance).toFixed(4)} MNEE</span>
                      </div>
                    )}
                  </div>
                  <WalletConnect variant="full" />
                </div>

                <div>
                  <label className="label">Ethereum Wallet Address</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ethereumAddressInput}
                      onChange={(e) => setEthereumAddressInput(e.target.value)}
                      placeholder="0x..."
                      className="input font-mono flex-1"
                    />
                    {isConnected && ethereumAddress && ethereumAddress !== ethereumAddressInput && (
                      <button
                        type="button"
                        onClick={useConnectedWallet}
                        className="px-4 py-2 rounded-xl bg-grape-100 hover:bg-grape-200 text-grape-700 font-medium text-sm transition-colors flex items-center gap-2"
                      >
                        <LinkIcon className="w-4 h-4" />
                        Use Connected
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-warm-400 mt-1.5">
                    MNEE token payments on Ethereum are sent to this address
                  </p>
                </div>

                {!ethereumAddressInput && !isConnected && (
                  <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-grape-50 to-ocean-50 border border-grape-200">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-grape-200 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-grape-700" />
                      </div>
                      <div>
                        <p className="font-medium text-grape-800 mb-1">Wallet Required</p>
                        <p className="text-sm text-grape-700 mb-3">
                          Connect your Ethereum wallet or enter your address to receive bounty payments in MNEE tokens.
                        </p>
                        <a
                          href="https://metamask.io"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-grape-700 hover:text-grape-800"
                        >
                          Get MetaMask wallet
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {ethereumAddressInput && (
                  <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-green-50 to-grape-50 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-green-800">Ethereum Wallet Set</p>
                        <p className="text-sm text-green-600 font-mono truncate">{ethereumAddressInput}</p>
                      </div>
                      {isConnected && ethereumAddress === ethereumAddressInput && (
                        <span className="px-2 py-1 rounded-lg bg-grape-100 text-grape-700 text-xs font-medium">
                          Connected
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Token Info */}
                <div className="mt-4 p-4 rounded-xl bg-warm-50 border border-warm-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Coins className="w-5 h-5 text-honey-500" />
                    <span className="font-medium text-warm-800">MNEE Token (ERC-20)</span>
                  </div>
                  <p className="text-sm text-warm-600 mb-2">
                    Payments are made in MNEE tokens on the Ethereum network.
                  </p>
                  <a
                    href="https://etherscan.io/token/0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-grape-600 hover:text-grape-700"
                  >
                    View on Etherscan
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </>
            )}
          </div>

          {/* Account Stats */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-grape-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-grape-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-warm-800">Account Overview</h2>
                <p className="text-sm text-warm-500">Your stats and achievements</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-warm-50">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-warm-400" />
                  <span className="text-xs text-warm-500 uppercase tracking-wide font-medium">Role</span>
                </div>
                <p className="font-semibold text-warm-800 capitalize">{user.role}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-warm-50">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-warm-400" />
                  <span className="text-xs text-warm-500 uppercase tracking-wide font-medium">Member Since</span>
                </div>
                <p className="font-semibold text-warm-800">
                  {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-br from-honey-50 to-honey-100">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4 text-honey-500" />
                  <span className="text-xs text-warm-500 uppercase tracking-wide font-medium">Earned</span>
                </div>
                <p className="font-bold text-honey-700">{user.totalEarned?.toFixed(0) || 0} MNEE</p>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-br from-ocean-50 to-ocean-100">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-ocean-500" />
                  <span className="text-xs text-warm-500 uppercase tracking-wide font-medium">Claimed</span>
                </div>
                <p className="font-bold text-ocean-700">{user.bountiesClaimed || 0} bounties</p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <p className="text-sm text-warm-500">
              <Sparkles className="w-4 h-4 inline mr-1" />
              Changes are saved to your profile
            </p>
            <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}