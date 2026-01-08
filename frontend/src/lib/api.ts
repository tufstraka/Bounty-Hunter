const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface User {
  id: number;
  githubId: number;
  githubLogin: string;
  email: string | null;
  name: string;
  avatarUrl: string;
  role: 'user' | 'admin';
  mneeAddress: string | null;
  totalEarned: number;
  bountiesClaimed: number;
  createdAt: string;
  updatedAt: string;
}

export interface Bounty {
  bountyId: number;
  repository: string;
  issueId: number;
  issueUrl: string;
  initialAmount: number;
  currentAmount: number;
  maxAmount: number;
  status: 'active' | 'claimed' | 'cancelled';
  solver: string | null;
  claimedAmount: number | null;
  pullRequestUrl: string | null;
  escalationCount: number;
  createdAt: string;
  claimedAt: string | null;
  hoursElapsed: number;
  isEligibleForEscalation: boolean;
}

export interface Repository {
  repository: string;
  totalBounties: number;
  activeBounties: number;
  claimedBounties: number;
  totalLocked: number;
}

export interface ProjectSettings {
  id: number;
  repository: string;
  ownerGithubLogin: string;
  fundingMode: 'owner' | 'platform' | 'disabled';
  defaultBountyAmount: number;
  maxBountyAmount: number;
  autoCreateBounties: boolean;
  escalationEnabled: boolean;
  escalationSchedule: number[];
  escalationMultipliers: number[];
  fundingWalletAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FundingInfo {
  escrowContractAddress: string | null;
  mneeTokenAddress: string;
  useBlockchain: boolean;
  chainId: string;
  network: string;
}

export interface WalletNonce {
  nonce: string;
  timestamp: number;
  message: string;
}

export interface PaginatedResponse<T> {
  bounties?: T[];
  users?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface Metrics {
  bounties: {
    total: number;
    active: number;
    claimed: number;
    on_chain?: number;
    success_rate: string;
  };
  tokens: {
    locked: number;
    claimed: number;
    wallet_balance: number;
    wallet_address: string;
  };
  escrow?: {
    enabled: boolean;
    contract_address?: string | null;
    balance?: number;
    platform_fee_bps?: number;
    token_address?: string | null;
    error?: string | null;
    message?: string;
  };
  system: {
    uptime: number;
    memory: object;
    node_version: string;
    blockchain_mode?: boolean;
  };
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('session_token', token);
      } else {
        localStorage.removeItem('session_token');
      }
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('session_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth endpoints
  async getAuthUrl(): Promise<{ authUrl: string; state: string }> {
    return this.request('/api/user/auth/github');
  }

  async getCurrentUser(): Promise<User> {
    return this.request('/api/user/me');
  }

  async updateProfile(data: { mneeAddress?: string; name?: string; email?: string }): Promise<User> {
    return this.request('/api/user/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<void> {
    await this.request('/api/user/logout', { method: 'POST' });
    this.setToken(null);
  }

  // User bounties
  async getMyBounties(options: { status?: string; page?: number; limit?: number } = {}): Promise<PaginatedResponse<Bounty>> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.page) params.set('page', options.page.toString());
    if (options.limit) params.set('limit', options.limit.toString());
    return this.request(`/api/user/me/bounties?${params}`);
  }

  async getMyStats(): Promise<{
    totalClaimed: number;
    totalEarned: number;
    repositoriesContributed: number;
    memberSince: string;
  }> {
    return this.request('/api/user/me/stats');
  }

  async getMyRepositories(): Promise<{ repositories: Repository[] }> {
    return this.request('/api/user/me/repositories');
  }

  // Repository bounties
  async getRepositoryBounties(
    owner: string,
    repo: string,
    options: { status?: string; page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<Bounty>> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.page) params.set('page', options.page.toString());
    if (options.limit) params.set('limit', options.limit.toString());
    return this.request(`/api/user/repositories/${owner}/${repo}/bounties?${params}`);
  }

  // Public endpoints
  async getTopContributors(limit: number = 10): Promise<User[]> {
    return this.request(`/api/user/contributors?limit=${limit}`);
  }

  // Public bounties endpoint (no auth required)
  async getAllBounties(options: { status?: string; page?: number; limit?: number; repository?: string } = {}): Promise<PaginatedResponse<Bounty>> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.page) params.set('page', options.page.toString());
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.repository) params.set('repository', options.repository);
    return this.request(`/api/bounties/list?${params}`);
  }

  // Admin endpoints
  async getMetrics(): Promise<Metrics> {
    return this.request('/api/admin/metrics');
  }

  async getAdminBounties(options: { status?: string; page?: number; limit?: number; repository?: string } = {}): Promise<PaginatedResponse<Bounty>> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.page) params.set('page', options.page.toString());
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.repository) params.set('repository', options.repository);
    return this.request(`/api/admin/bounties?${params}`);
  }

  async getAllRepositories(): Promise<Repository[]> {
    return this.request('/api/admin/repositories');
  }

  async getAllUsers(options: { role?: string; page?: number; limit?: number } = {}): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams();
    if (options.role) params.set('role', options.role);
    if (options.page) params.set('page', options.page.toString());
    if (options.limit) params.set('limit', options.limit.toString());
    return this.request(`/api/user/admin/users?${params}`);
  }

  async updateUserRole(userId: number, role: 'user' | 'admin'): Promise<User> {
    return this.request(`/api/user/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async triggerEscalationCheck(): Promise<{ escalated: number }> {
    return this.request('/api/admin/escalation/check', { method: 'POST' });
  }

  async getEligibleForEscalation(): Promise<Bounty[]> {
    return this.request('/api/admin/escalation/eligible');
  }

  // Project settings endpoints
  async getProjectSettings(owner: string, repo: string): Promise<ProjectSettings> {
    return this.request(`/api/projects/${owner}/${repo}/settings`);
  }

  async updateProjectSettings(owner: string, repo: string, data: Partial<ProjectSettings>): Promise<ProjectSettings> {
    return this.request(`/api/projects/${owner}/${repo}/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getMyProjects(): Promise<{ projects: ProjectSettings[] }> {
    return this.request('/api/projects');
  }

  async getProjectBounties(owner: string, repo: string, options: { status?: string; page?: number; limit?: number } = {}): Promise<PaginatedResponse<Bounty>> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.page) params.set('page', options.page.toString());
    if (options.limit) params.set('limit', options.limit.toString());
    return this.request(`/api/projects/${owner}/${repo}/bounties?${params}`);
  }

  async getProjectStats(owner: string, repo: string): Promise<{
    totalBounties: number;
    activeBounties: number;
    claimedBounties: number;
    totalLocked: number;
    totalPaid: number;
  }> {
    return this.request(`/api/projects/${owner}/${repo}/stats`);
  }

  // Wallet linking
  async getWalletNonce(): Promise<WalletNonce> {
    return this.request('/api/projects/wallet-nonce');
  }

  async linkWallet(address: string, signature: string, message: string): Promise<{ success: boolean; message: string; ethereumAddress: string }> {
    return this.request('/api/projects/link-wallet', {
      method: 'POST',
      body: JSON.stringify({ address, signature, message }),
    });
  }

  // Funding info for on-chain bounty creation
  async getFundingInfo(): Promise<FundingInfo> {
    return this.request('/api/projects/funding-info');
  }

  // Record on-chain bounty
  async recordOnChainBounty(owner: string, repo: string, data: {
    issueId: number;
    issueUrl?: string;
    amount: number;
    maxAmount?: number;
    transactionHash: string;
    onChainBountyId?: number;
    creatorWalletAddress?: string;
  }): Promise<{ success: boolean; bounty: Bounty }> {
    return this.request(`/api/projects/${owner}/${repo}/bounties/on-chain`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();