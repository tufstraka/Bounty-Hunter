'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api } from '@/lib/api';

// Types for the Web3 context
interface WalletInfo {
  address: string;
  balance: string;
  chainId: number;
  chainName: string;
}

interface Web3ContextType {
  isBlockchainMode: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  walletInfo: WalletInfo | null;
  error: string | null;
  address: string | null;
  balance: string | null;
  chainId: number | null;
  chainName: string | null;
  // Methods
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  formatAddress: (address: string) => string;
  getAddressPattern: () => { type: string; pattern: string; example: string; regex: RegExp };
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

const MNEE_TOKEN = {
  address: '0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF',
  symbol: 'MNEE',
  decimals: 18,
};

// Supported networks
const NETWORKS: Record<number, { name: string; rpcUrl: string; blockExplorer: string; nativeCurrency: { name: string; symbol: string; decimals: number } }> = {
  1: {
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  11155111: {
    name: 'Sepolia Testnet',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  },
};

// Map network names to chain IDs
const NETWORK_NAME_TO_CHAIN_ID: Record<string, number> = {
  mainnet: 1,
  sepolia: 11155111,
  goerli: 5,
  localhost: 31337,
};

const STORAGE_KEY = 'web3_connected';

export function Web3Provider({ children }: { children: ReactNode }) {
  const [isBlockchainMode, setIsBlockchainMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetChainId, setTargetChainId] = useState<number>(11155111); // Default to Sepolia

  // Check if blockchain mode is enabled from environment and get target network
  useEffect(() => {
    const blockchainMode = process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';
    setIsBlockchainMode(blockchainMode);
    
    // Get target network from environment (default to sepolia)
    const networkName = process.env.NEXT_PUBLIC_ETHEREUM_NETWORK || 'sepolia';
    const chainId = NETWORK_NAME_TO_CHAIN_ID[networkName.toLowerCase()] || 11155111;
    setTargetChainId(chainId);
  }, []);

  // Helper to get chain name
  const getChainName = (chainId: number): string => {
    return NETWORKS[chainId]?.name || `Chain ${chainId}`;
  };

  // Format address for display
  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get address pattern based on mode
  const getAddressPattern = useCallback(() => {
    if (isBlockchainMode) {
      return {
        type: 'Ethereum',
        pattern: '0x followed by 40 hex characters',
        example: '0x742d35Cc6634C0532925a3b844Bc9e7595f1c123',
        regex: /^0x[a-fA-F0-9]{40}$/,
      };
    }
    return {
      type: 'Bitcoin-style (MNEE)',
      pattern: 'Starts with 1 or 3, 25-34 alphanumeric characters',
      example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      regex: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    };
  }, [isBlockchainMode]);

  // Update wallet info
  const updateWalletInfo = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    try {
      const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
      if (accounts.length === 0) {
        setIsConnected(false);
        setWalletInfo(null);
        return;
      }

      const address = accounts[0];
      const chainIdHex = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      const chainId = parseInt(chainIdHex, 16);
      const balanceHex = (await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      })) as string;
      const balance = (parseInt(balanceHex, 16) / 1e18).toFixed(4);

      setWalletInfo({
        address,
        balance,
        chainId,
        chainName: getChainName(chainId),
      });
      setIsConnected(true);
    } catch (err) {
      console.error('Failed to update wallet info:', err);
    }
  }, []);

  // Sync wallet address to backend database
  const syncWalletToBackend = useCallback(async (address: string) => {
    try {
      // Check if user is authenticated (has session token)
      const token = api.getToken();
      if (!token) {
        console.log('[Web3] User not authenticated, skipping wallet sync to backend');
        return;
      }

      console.log(`[Web3] Syncing wallet address to backend: ${address}`);
      await api.updateProfile({ mneeAddress: address });
      console.log('[Web3] Wallet address synced to backend successfully');
    } catch (err) {
      // Don't throw - just log the error. User might not be authenticated
      console.warn('[Web3] Failed to sync wallet to backend:', err);
    }
  }, []);

  // Connect wallet and automatically switch to target network
  const connect = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('Please install MetaMask or another Web3 wallet');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request account access
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      
      // Check current chain and switch to target network if needed
      const chainIdHex = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      const currentChainId = parseInt(chainIdHex, 16);
      
      if (currentChainId !== targetChainId) {
        console.log(`Switching from chain ${currentChainId} to target chain ${targetChainId} (${NETWORKS[targetChainId]?.name || 'Unknown'})`);
        await switchToTargetNetwork();
      }
      
      await updateWalletInfo();
      
      // Sync wallet address to backend if user is authenticated
      if (accounts.length > 0) {
        await syncWalletToBackend(accounts[0]);
      }
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  // Switch to target network (configured via NEXT_PUBLIC_ETHEREUM_NETWORK)
  const switchToTargetNetwork = async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const hexChainId = `0x${targetChainId.toString(16)}`;
    const network = NETWORKS[targetChainId];

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (err: unknown) {
      // If chain not added (error code 4902), try to add it
      const error = err as { code?: number };
      if (error.code === 4902 && network) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: network.name,
                rpcUrls: [network.rpcUrl],
                blockExplorerUrls: [network.blockExplorer],
                nativeCurrency: network.nativeCurrency,
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
          throw addError;
        }
      } else {
        throw err;
      }
    }
  };

  // Disconnect wallet
  const disconnect = () => {
    setIsConnected(false);
    setWalletInfo(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Switch network
  const switchNetwork = async (chainId: number) => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const hexChainId = `0x${chainId.toString(16)}`;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (err: unknown) {
      // If chain not added, try to add it
      const error = err as { code?: number };
      if (error.code === 4902 && NETWORKS[chainId]) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: NETWORKS[chainId].name,
                rpcUrls: [NETWORKS[chainId].rpcUrl],
                blockExplorerUrls: [NETWORKS[chainId].blockExplorer],
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
        }
      }
    }
  };

  // Listen for account and chain changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        disconnect();
      } else {
        updateWalletInfo();
        // Also sync the new account to backend
        syncWalletToBackend(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      updateWalletInfo();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Check if already connected
    const wasConnected = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';
    if (wasConnected) {
      updateWalletInfo();
    }

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [updateWalletInfo]);

  return (
    <Web3Context.Provider
      value={{
        isBlockchainMode,
        isConnected,
        isConnecting,
        walletInfo,
        error,
        // Convenience properties derived from walletInfo
        address: walletInfo?.address ?? null,
        balance: walletInfo?.balance ?? null,
        chainId: walletInfo?.chainId ?? null,
        chainName: walletInfo?.chainName ?? null,
        // Methods
        connect,
        disconnect,
        switchNetwork,
        formatAddress,
        getAddressPattern,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}

// Type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

// Export constants
export { MNEE_TOKEN, NETWORKS };