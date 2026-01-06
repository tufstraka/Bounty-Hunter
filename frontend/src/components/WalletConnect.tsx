'use client';

import { useState } from 'react';
import { useWeb3, NETWORKS } from '@/contexts/Web3Context';
import { 
  Wallet, 
  ChevronDown, 
  ExternalLink, 
  Copy, 
  Check, 
  Power, 
  RefreshCw,
  AlertTriangle,
  Zap,
  Link2
} from 'lucide-react';

interface WalletConnectProps {
  variant?: 'full' | 'compact' | 'minimal';
  className?: string;
}

export default function WalletConnect({ variant = 'full', className = '' }: WalletConnectProps) {
  const { 
    isBlockchainMode, 
    isConnected, 
    isConnecting, 
    walletInfo, 
    error, 
    connect, 
    disconnect,
    formatAddress 
  } = useWeb3();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  // Don't render if not in blockchain mode
  if (!isBlockchainMode) return null;

  const copyAddress = () => {
    if (walletInfo?.address) {
      navigator.clipboard.writeText(walletInfo.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getBlockExplorer = () => {
    if (!walletInfo) return null;
    const network = NETWORKS[walletInfo.chainId];
    if (!network) return null;
    return `${network.blockExplorer}/address/${walletInfo.address}`;
  };

  // Minimal variant - just an icon button
  if (variant === 'minimal') {
    return (
      <button
        onClick={isConnected ? () => setShowDropdown(!showDropdown) : connect}
        disabled={isConnecting}
        className={`relative p-2 rounded-xl transition-all ${
          isConnected 
            ? 'bg-gradient-to-br from-grape-100 to-ocean-100 text-grape-700 hover:shadow-md' 
            : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
        } ${className}`}
        aria-label={isConnected ? 'Wallet connected' : 'Connect wallet'}
      >
        {isConnecting ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : isConnected ? (
          <>
            <Wallet className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
          </>
        ) : (
          <Link2 className="w-5 h-5" />
        )}
      </button>
    );
  }

  // Compact variant - button with address
  if (variant === 'compact') {
    if (!isConnected) {
      return (
        <button
          onClick={connect}
          disabled={isConnecting}
          className={`btn-grape text-sm py-2 ${className}`}
        >
          {isConnecting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </>
          )}
        </button>
      );
    }

    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-grape-50 to-ocean-50 border border-grape-200 hover:border-grape-300 transition-all"
        >
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm font-medium text-warm-700">{formatAddress(walletInfo?.address || '')}</span>
          <ChevronDown className={`w-4 h-4 text-warm-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <WalletDropdown
            walletInfo={walletInfo}
            onCopy={copyAddress}
            copied={copied}
            onDisconnect={disconnect}
            onClose={() => setShowDropdown(false)}
            blockExplorerUrl={getBlockExplorer()}
          />
        )}
      </div>
    );
  }

  // Full variant - complete card with all info
  return (
    <div className={`glass-card p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-grape-400 to-grape-600 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-warm-800">Ethereum Wallet</h3>
          <p className="text-sm text-warm-500">
            {isConnected ? 'Connected' : 'Connect to receive payments'}
          </p>
        </div>
        {isConnected && (
          <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Active
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isConnected && walletInfo ? (
        <div className="space-y-4">
          {/* Address */}
          <div className="p-4 rounded-xl bg-warm-50 border border-warm-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-warm-500 uppercase tracking-wide font-medium">Address</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={copyAddress}
                  className="p-1.5 rounded-lg hover:bg-warm-200 transition-colors"
                  aria-label="Copy address"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-warm-400" />}
                </button>
                {getBlockExplorer() && (
                  <a
                    href={getBlockExplorer()!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-warm-200 transition-colors"
                    aria-label="View on block explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-warm-400" />
                  </a>
                )}
              </div>
            </div>
            <p className="font-mono text-sm text-warm-700 break-all">{walletInfo.address}</p>
          </div>

          {/* Balance & Network */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-ocean-50 to-ocean-100 border border-ocean-200">
              <span className="text-xs text-ocean-600 uppercase tracking-wide font-medium">ETH Balance</span>
              <p className="font-bold text-ocean-700 mt-1">{walletInfo.balance} ETH</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-grape-50 to-grape-100 border border-grape-200">
              <span className="text-xs text-grape-600 uppercase tracking-wide font-medium">Network</span>
              <p className="font-bold text-grape-700 mt-1 truncate" title={walletInfo.chainName}>
                {walletInfo.chainName}
              </p>
            </div>
          </div>

          {/* Supported indicator */}
          {walletInfo.chainId === 1 || walletInfo.chainId === 11155111 ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200">
              <Zap className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">Network supported for MNEE payments</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-700">Switch to Ethereum Mainnet for payments</span>
            </div>
          )}

          {/* Disconnect */}
          <button
            onClick={disconnect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-warm-200 text-warm-600 hover:bg-warm-50 transition-colors"
          >
            <Power className="w-4 h-4" />
            <span>Disconnect Wallet</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-warm-600">
            Connect your Ethereum wallet to receive bounty payments in MNEE tokens on the blockchain.
          </p>
          
          <button
            onClick={connect}
            disabled={isConnecting}
            className="btn-grape w-full justify-center"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet</span>
              </>
            )}
          </button>

          <p className="text-xs text-warm-400 text-center">
            Supports MetaMask and WalletConnect compatible wallets
          </p>
        </div>
      )}
    </div>
  );
}

// Dropdown component for compact variant
interface WalletDropdownProps {
  walletInfo: { address: string; balance: string; chainName: string } | null;
  onCopy: () => void;
  copied: boolean;
  onDisconnect: () => void;
  onClose: () => void;
  blockExplorerUrl: string | null;
}

function WalletDropdown({ 
  walletInfo, 
  onCopy, 
  copied, 
  onDisconnect, 
  onClose,
  blockExplorerUrl 
}: WalletDropdownProps) {
  if (!walletInfo) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-gray-200 shadow-xl p-4 z-50 animate-scale-in origin-top-right">
        <div className="space-y-3">
          {/* Address */}
          <div className="p-3 rounded-xl bg-warm-50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-warm-500 font-medium">Address</span>
              <button 
                onClick={onCopy}
                className="text-xs text-grape-600 hover:text-grape-700 flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="font-mono text-xs text-warm-600 truncate">{walletInfo.address}</p>
          </div>

          {/* Balance & Network */}
          <div className="flex items-center justify-between px-1">
            <div>
              <span className="text-xs text-warm-500">Balance</span>
              <p className="font-semibold text-warm-800">{walletInfo.balance} ETH</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-warm-500">Network</span>
              <p className="font-semibold text-warm-800">{walletInfo.chainName}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-warm-100 flex items-center gap-2">
            {blockExplorerUrl && (
              <a
                href={blockExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-warm-100 text-warm-600 hover:bg-warm-200 text-sm transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Explorer
              </a>
            )}
            <button
              onClick={onDisconnect}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm transition-colors"
            >
              <Power className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </>
  );
}