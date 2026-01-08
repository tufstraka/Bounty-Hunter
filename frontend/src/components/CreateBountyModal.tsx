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
  'function mneeToken() view returns (address)',
  'function minBountyAmount() view returns (uint256)',
  'function maxBountyAmount() view returns (uint256)',
  'function paused() view returns (bool)',
  'function getBountyByIssue(string repository, uint256 issueId) view returns (tuple(uint256 id, address creator, uint256 initialAmount, uint256 currentAmount, uint256 maxAmount, string repository, uint256 issueId, string issueUrl, uint8 status, address solver, string solverGithubLogin, string pullRequestUrl, uint256 createdAt, uint256 claimedAt, uint256 expiresAt, uint8 escalationCount))',
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
  const [actualTokenAddress, setActualTokenAddress] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [tokenSymbol, setTokenSymbol] = useState<string>('MNEE');
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [minBounty, setMinBounty] = useState<string>('1');
  const [maxBounty, setMaxBounty] = useState<string>('1000000');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [bountyExists, setBountyExists] = useState<boolean>(false);
  const [contractPaused, setContractPaused] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [createdBountyId, setCreatedBountyId] = useState<string | null>(null);

  // Fetch funding info and token balance
  useEffect(() => {
    console.log('[CreateBounty] Modal opened:', { isOpen, isBlockchainMode, repository, issueId });
    if (isOpen) {
      // Always try to load funding info when modal is open
      // The modal needs this info to function, regardless of isBlockchainMode flag
      loadFundingInfo();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isConnected && address && fundingInfo) {
      loadTokenBalance();
    }
  }, [isOpen, isConnected, address, fundingInfo]);

  const loadFundingInfo = async () => {
    console.log('[CreateBounty] Loading funding info...');
    try {
      const info = await api.getFundingInfo();
      console.log('[CreateBounty] Funding info received:', info);
      setFundingInfo(info);
      
      // Query the actual token address from the escrow contract
      if (info.escrowContractAddress && typeof window !== 'undefined' && window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const escrowContract = new Contract(info.escrowContractAddress, BOUNTY_ESCROW_ABI, provider);
        
        try {
          const [tokenAddr, minAmount, maxAmount, isPaused] = await Promise.all([
            escrowContract.mneeToken(),
            escrowContract.minBountyAmount(),
            escrowContract.maxBountyAmount(),
            escrowContract.paused(),
          ]);
          
          setActualTokenAddress(tokenAddr);
          setMinBounty(ethers.formatUnits(minAmount, 18));
          setMaxBounty(ethers.formatUnits(maxAmount, 18));
          setContractPaused(isPaused);
          
          console.log('[CreateBounty] Contract token address:', tokenAddr);
          console.log('[CreateBounty] Min bounty:', ethers.formatUnits(minAmount, 18));
          console.log('[CreateBounty] Max bounty:', ethers.formatUnits(maxAmount, 18));
          console.log('[CreateBounty] Contract paused:', isPaused);
          
          // Check if bounty already exists for this issue
          await checkBountyExists(escrowContract);
        } catch (contractErr) {
          console.warn('Failed to query escrow contract:', contractErr);
          // Fall back to API-provided address
          setActualTokenAddress(info.mneeTokenAddress);
        }
      }
    } catch (err) {
      console.error('[CreateBounty] Failed to load funding info:', err);
      setError('Failed to load funding configuration');
    }
  };

  const checkBountyExists = async (escrowContract: Contract) => {
    setIsChecking(true);
    try {
      const existingBounty = await escrowContract.getBountyByIssue(repository, issueId);
      // If bounty exists and has a non-zero ID, it already exists
      const exists = existingBounty && existingBounty.id && existingBounty.id > BigInt(0);
      setBountyExists(exists);
      if (exists) {
        console.log('[CreateBounty] Bounty already exists:', existingBounty);
        setError(`A bounty already exists for this issue (ID: ${existingBounty.id.toString()})`);
      }
    } catch (err) {
      // If the call fails, the bounty doesn't exist (returns empty struct)
      console.log('[CreateBounty] No existing bounty found for this issue');
      setBountyExists(false);
    } finally {
      setIsChecking(false);
    }
  };

  const loadTokenBalance = async () => {
    const tokenAddr = actualTokenAddress || fundingInfo?.mneeTokenAddress;
    if (!address || !tokenAddr || typeof window === 'undefined' || !window.ethereum) return;

    try {
      const provider = new BrowserProvider(window.ethereum);
      const tokenContract = new Contract(tokenAddr, ERC20_ABI, provider);
      
      const [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(address),
        tokenContract.decimals(),
        tokenContract.symbol(),
      ]);
      
      setTokenBalance(ethers.formatUnits(balance, decimals));
      setTokenDecimals(Number(decimals));
      setTokenSymbol(symbol);
      
      console.log('[CreateBounty] Token balance:', ethers.formatUnits(balance, decimals), symbol);
    } catch (err) {
      console.error('Failed to load token balance:', err);
    }
  };

  // Reload balance when actualTokenAddress changes
  useEffect(() => {
    if (isOpen && isConnected && address && actualTokenAddress) {
      loadTokenBalance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualTokenAddress]);

  const checkAndApprove = async () => {
    console.log('[CreateBounty] checkAndApprove called');
    const tokenAddr = actualTokenAddress || fundingInfo?.mneeTokenAddress;
    console.log('[CreateBounty] Configuration:', {
      address,
      escrowContractAddress: fundingInfo?.escrowContractAddress,
      tokenAddr,
      amount,
      maxAmount
    });
    if (!address || !fundingInfo?.escrowContractAddress || !tokenAddr) {
      console.error('[CreateBounty] Missing configuration:', { address, escrowContractAddress: fundingInfo?.escrowContractAddress, tokenAddr });
      setError('Missing configuration. Please refresh and try again.');
      return;
    }
    if (typeof window === 'undefined' || !window.ethereum) return;

    // Pre-checks
    if (contractPaused) {
      setError('The bounty contract is currently paused. Please try again later.');
      return;
    }

    if (bountyExists) {
      setError('A bounty already exists for this issue. You cannot create another one.');
      return;
    }

    // Validate amount against contract limits
    const amountNum = parseFloat(amount);
    const maxAmountNum = parseFloat(maxAmount);
    const minBountyNum = parseFloat(minBounty);
    const maxBountyNum = parseFloat(maxBounty);

    if (amountNum < minBountyNum) {
      setError(`Minimum bounty amount is ${minBounty} ${tokenSymbol}`);
      return;
    }
    if (amountNum > maxBountyNum) {
      setError(`Maximum bounty amount is ${maxBounty} ${tokenSymbol}`);
      return;
    }
    if (maxAmountNum < amountNum) {
      setError('Max amount must be greater than or equal to initial amount');
      return;
    }
    if (maxAmountNum > maxBountyNum) {
      setError(`Maximum amount cannot exceed ${maxBounty} ${tokenSymbol}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new Contract(tokenAddr, ERC20_ABI, signer);
      
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);
      
      // Check token balance first
      const balance = await tokenContract.balanceOf(address);
      if (balance < amountWei) {
        setError(`Insufficient ${tokenSymbol} balance. You have ${ethers.formatUnits(balance, decimals)} but need ${amount}`);
        setIsLoading(false);
        return;
      }
      
      // Check current allowance
      const currentAllowance = await tokenContract.allowance(address, fundingInfo.escrowContractAddress);
      console.log('[CreateBounty] Current allowance:', ethers.formatUnits(currentAllowance, decimals));
      
      if (currentAllowance < amountWei) {
        setStep('approve');
        console.log('[CreateBounty] Requesting approval for escrow:', fundingInfo.escrowContractAddress);
        
        // Request approval for max amount (or large amount)
        const tx = await tokenContract.approve(fundingInfo.escrowContractAddress, ethers.MaxUint256);
        console.log('[CreateBounty] Approval tx:', tx.hash);
        await tx.wait();
        console.log('[CreateBounty] Approval confirmed');
      }
      
      // Proceed to create bounty
      await createBounty();
    } catch (err: unknown) {
      console.error('[CreateBounty] Approval error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve tokens';
      // Clean up error message
      if (errorMessage.includes('user rejected')) {
        setError('Transaction was rejected');
      } else {
        setError(errorMessage.slice(0, 200));
      }
      setStep('input');
    } finally {
      setIsLoading(false);
    }
  };

  const createBounty = async () => {
    const tokenAddr = actualTokenAddress || fundingInfo?.mneeTokenAddress;
    if (!address || !fundingInfo?.escrowContractAddress || !tokenAddr) return;
    if (typeof window === 'undefined' || !window.ethereum) return;

    setIsLoading(true);
    setStep('create');
    setError(null);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const escrowContract = new Contract(fundingInfo.escrowContractAddress, BOUNTY_ESCROW_ABI, signer);
      const tokenContract = new Contract(tokenAddr, ERC20_ABI, provider);
      
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);
      const maxAmountWei = ethers.parseUnits(maxAmount, decimals);
      
      console.log('[CreateBounty] Creating bounty:', {
        repository,
        issueId,
        amount: amount,
        maxAmount: maxAmount,
        amountWei: amountWei.toString(),
        maxAmountWei: maxAmountWei.toString(),
        escrowAddress: fundingInfo.escrowContractAddress,
        tokenAddress: tokenAddr,
      });
      
      // Create bounty on-chain
      const tx = await escrowContract.createBounty(
        repository,
        issueId,
        issueUrl || `https://github.com/${repository}/issues/${issueId}`,
        amountWei,
        maxAmountWei,
        0 // No expiration
      );
      
      console.log('[CreateBounty] Transaction submitted:', tx.hash);
      setTxHash(tx.hash);
      const receipt = await tx.wait();
      console.log('[CreateBounty] Transaction confirmed');
      
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
      try {
        await api.recordOnChainBounty(owner, repo, {
          issueId,
          issueUrl: issueUrl || `https://github.com/${repository}/issues/${issueId}`,
          amount: parseFloat(amount),
          maxAmount: parseFloat(maxAmount),
          transactionHash: tx.hash,
          onChainBountyId: onChainBountyId ? parseInt(onChainBountyId) : undefined,
          creatorWalletAddress: address,
        });
      } catch (backendErr) {
        // Don't fail if backend recording fails - the on-chain tx is what matters
        console.warn('[CreateBounty] Failed to record in backend:', backendErr);
      }
      
      setStep('success');
      if (onSuccess) {
        onSuccess({ bountyId: onChainBountyId, transactionHash: tx.hash });
      }
    } catch (err: unknown) {
      console.error('[CreateBounty] Creation error:', err);
      let errorMessage = 'Failed to create bounty';
      
      if (err instanceof Error) {
        // Parse common errors
        if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (err.message.includes('BountyAlreadyExists')) {
          errorMessage = 'A bounty already exists for this issue';
        } else if (err.message.includes('InvalidAmount')) {
          errorMessage = `Invalid amount. Must be between ${minBounty} and ${maxBounty} ${tokenSymbol}`;
        } else if (err.message.includes('insufficient')) {
          errorMessage = 'Insufficient token balance or allowance';
        } else {
          errorMessage = err.message.slice(0, 200);
        }
      }
      
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

                  {/* Bounty exists warning */}
                  {bountyExists && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Bounty already exists</p>
                        <p className="text-xs text-yellow-700">
                          A bounty has already been created for this issue on-chain.
                          You cannot create another one.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Contract paused warning */}
                  {contractPaused && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Contract paused</p>
                        <p className="text-xs text-yellow-700">
                          The bounty contract is currently paused. Please try again later.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    onClick={checkAndApprove}
                    disabled={isLoading || isChecking || insufficientBalance || !amount || bountyExists || contractPaused}
                    className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </span>
                    ) : isChecking ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Checking...
                      </span>
                    ) : bountyExists ? (
                      'Bounty Already Exists'
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
                  href={`https://${fundingInfo?.network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/tx/${txHash}`}
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
                  href={`https://${fundingInfo?.network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/tx/${txHash}`}
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