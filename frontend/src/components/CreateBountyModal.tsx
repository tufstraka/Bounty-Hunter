'use client';

import { useState, useEffect } from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { api, FundingInfo } from '@/lib/api';
import { X, Wallet, Loader2, AlertCircle, CheckCircle, ExternalLink, Coins } from 'lucide-react';
import { ethers, BrowserProvider, Contract } from 'ethers';

interface CreateBountyModalProps {
  isOpen: boolean;
  onClose: () => void;
  repository: string;
  issueId: number;
  issueUrl?: string;
  onSuccess?: (bounty: unknown) => void;
}

// ERC20 ABI for MNEE token
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// BountyEscrow ABI
const BOUNTY_ESCROW_ABI = [
  'function createBounty(string repository, uint256 issueId, string issueUrl, uint256 amount, uint256 maxAmount, uint256 expiresAt) returns (uint256)',
  'event BountyCreated(uint256 indexed bountyId, address indexed creator, string repository, uint256 issueId, uint256 amount, uint256 maxAmount)',
];

type Step = 'input' | 'approve' | 'create' | 'success';

export function CreateBountyModal({
  isOpen,
  onClose,
  repository,
  issueId,
  issueUrl,
  onSuccess,
}: CreateBountyModalProps) {
  const { isConnected, isBlockchainMode, address, connect } = useWeb3();
  
  const [step, setStep] = useState<Step>('input');
  const [amount, setAmount] = useState('50');
  const [maxAmount, setMaxAmount] = useState('150');
  const [fundingInfo, setFundingInfo] = useState<FundingInfo | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [tokenSymbol, setTokenSymbol] = useState<string>('MNEE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [createdBountyId, setCreatedBountyId] = useState<string | null>(null);

  // Fetch funding info and token balance
  useEffect(() => {
    if (isOpen && isBlockchainMode) {
      loadFundingInfo();
    }
  }, [isOpen, isBlockchainMode]);

  useEffect(() => {
    if (isOpen && isConnected && address && fundingInfo) {
      loadTokenBalance();
    }
  }, [isOpen, isConnected, address, fundingInfo]);

  const loadFundingInfo = async () => {
    try {
      const info = await api.getFundingInfo();
      setFundingInfo(info);
    } catch (err) {
      console.error('Failed to load funding info:', err);
      setError('Failed to load funding configuration');
    }
  };

  const loadTokenBalance = async () => {
    if (!address || !fundingInfo?.mneeTokenAddress || typeof window === 'undefined' || !window.ethereum) return;

    try {
      const provider = new BrowserProvider(window.ethereum);
      const tokenContract = new Contract(fundingInfo.mneeTokenAddress, ERC20_ABI, provider);
      
      const [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(address),
        tokenContract.decimals(),
        tokenContract.symbol(),
      ]);
      
      setTokenBalance(ethers.formatUnits(balance, decimals));
      setTokenSymbol(symbol);
    } catch (err) {
      console.error('Failed to load token balance:', err);
    }
  };

  const checkAndApprove = async () => {
    if (!address || !fundingInfo?.escrowContractAddress || !fundingInfo?.mneeTokenAddress) return;
    if (typeof window === 'undefined' || !window.ethereum) return;

    setIsLoading(true);
    setError(null);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new Contract(fundingInfo.mneeTokenAddress, ERC20_ABI, signer);
      
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);
      
      // Check current allowance
      const currentAllowance = await tokenContract.allowance(address, fundingInfo.escrowContractAddress);
      
      if (currentAllowance < amountWei) {
        setStep('approve');
        
        // Request approval for max amount (or large amount)
        const tx = await tokenContract.approve(fundingInfo.escrowContractAddress, ethers.MaxUint256);
        await tx.wait();
      }
      
      // Proceed to create bounty
      await createBounty();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve tokens';
      setError(errorMessage);
      setStep('input');
    } finally {
      setIsLoading(false);
    }
  };

  const createBounty = async () => {
    if (!address || !fundingInfo?.escrowContractAddress) return;
    if (typeof window === 'undefined' || !window.ethereum) return;

    setIsLoading(true);
    setStep('create');
    setError(null);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const escrowContract = new Contract(fundingInfo.escrowContractAddress, BOUNTY_ESCROW_ABI, signer);
      const tokenContract = new Contract(fundingInfo.mneeTokenAddress, ERC20_ABI, provider);
      
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);
      const maxAmountWei = ethers.parseUnits(maxAmount, decimals);
      
      // Create bounty on-chain
      const tx = await escrowContract.createBounty(
        repository,
        issueId,
        issueUrl || `https://github.com/${repository}/issues/${issueId}`,
        amountWei,
        maxAmountWei,
        0 // No expiration
      );
      
      setTxHash(tx.hash);
      const receipt = await tx.wait();
      
      // Parse the BountyCreated event
      let onChainBountyId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = escrowContract.interface.parseLog(log);
          if (parsed?.name === 'BountyCreated') {
            onChainBountyId = parsed.args.bountyId.toString();
            break;
          }
        } catch {
          // Not our event
        }
      }
      
      setCreatedBountyId(onChainBountyId);
      
      // Record the bounty in our backend
      const [owner, repo] = repository.split('/');
      await api.recordOnChainBounty(owner, repo, {
        issueId,
        issueUrl: issueUrl || `https://github.com/${repository}/issues/${issueId}`,
        amount: parseFloat(amount),
        maxAmount: parseFloat(maxAmount),
        transactionHash: tx.hash,
        onChainBountyId: onChainBountyId ? parseInt(onChainBountyId) : undefined,
        creatorWalletAddress: address,
      });
      
      setStep('success');
      if (onSuccess) {
        onSuccess({ bountyId: onChainBountyId, transactionHash: tx.hash });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create bounty';
      setError(errorMessage);
      setStep('input');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('input');
    setError(null);
    setTxHash(null);
    setCreatedBountyId(null);
    onClose();
  };

  if (!isOpen) return null;

  const insufficientBalance = parseFloat(tokenBalance) < parseFloat(amount);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in-up">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
              <Coins className="w-6 h-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {step === 'success' ? 'Bounty Created!' : 'Fund a Bounty'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {repository} #{issueId}
            </p>
          </div>

          {/* Content based on step */}
          {step === 'input' && (
            <div className="space-y-4">
              {!isConnected ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Connect your wallet to fund this bounty</p>
                  <button
                    onClick={connect}
                    className="btn-primary"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : (
                <>
                  {/* Wallet info */}
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Your Balance</span>
                      <span className="font-semibold text-gray-900">
                        {parseFloat(tokenBalance).toFixed(2)} {tokenSymbol}
                      </span>
                    </div>
                  </div>

                  {/* Amount input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bounty Amount
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary-300 
                          focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                        min="1"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                        {tokenSymbol}
                      </span>
                    </div>
                  </div>

                  {/* Max amount input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Amount (for escalation)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary-300 
                          focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                        min={amount}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                        {tokenSymbol}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      The bounty can escalate up to this amount if unclaimed
                    </p>
                  </div>

                  {/* Insufficient balance warning */}
                  {insufficientBalance && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Insufficient balance</p>
                        <p className="text-xs text-red-600">
                          You need at least {amount} {tokenSymbol} to fund this bounty
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    onClick={checkAndApprove}
                    disabled={isLoading || insufficientBalance || !amount}
                    className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      `Fund Bounty (${amount} ${tokenSymbol})`
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {step === 'approve' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Approving {tokenSymbol}</h3>
              <p className="text-sm text-gray-500">
                Please confirm the approval transaction in your wallet
              </p>
            </div>
          )}

          {step === 'create' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Creating Bounty</h3>
              <p className="text-sm text-gray-500 mb-4">
                Please confirm the transaction in your wallet
              </p>
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                >
                  View transaction
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Bounty Created!</h3>
              <p className="text-sm text-gray-500 mb-4">
                Your bounty of {amount} {tokenSymbol} has been funded on-chain
              </p>
              
              {createdBountyId && (
                <p className="text-xs text-gray-400 mb-4">
                  Bounty ID: #{createdBountyId}
                </p>
              )}
              
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200
                    text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  View on Etherscan
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              
              <button
                onClick={handleClose}
                className="w-full btn-primary mt-6"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateBountyModal;