// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BountyEscrow
 * @author FixFlow Team
 * @notice Escrow contract for automated bounty payments using MNEE ERC-20 token
 * @dev Releases funds to developers when CI tests pass. The bot acts as an oracle.
 * 
 * MNEE Token (Ethereum): 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF
 */
contract BountyEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable mneeToken;
    uint256 public nextBountyId;
    uint256 public minBountyAmount;
    uint256 public maxBountyAmount;
    uint256 public platformFeeBps;
    address public feeRecipient;

    enum BountyStatus { Active, Claimed, Cancelled, Expired }

    struct Bounty {
        uint256 id;
        address creator;
        uint256 initialAmount;
        uint256 currentAmount;
        uint256 maxAmount;
        string repository;
        uint256 issueId;
        string issueUrl;
        BountyStatus status;
        address solver;
        string solverGithubLogin;
        string pullRequestUrl;
        uint256 createdAt;
        uint256 claimedAt;
        uint256 expiresAt;
        uint8 escalationCount;
    }

    mapping(uint256 => Bounty) public bounties;
    mapping(bytes32 => uint256) public issueToBountyId;
    mapping(address => uint256[]) public creatorBounties;
    mapping(address => uint256[]) public solverBounties;

    event BountyCreated(uint256 indexed bountyId, address indexed creator, string repository, uint256 issueId, uint256 amount, uint256 maxAmount);
    event BountyEscalated(uint256 indexed bountyId, uint256 oldAmount, uint256 newAmount, uint8 escalationCount);
    event BountyClaimed(uint256 indexed bountyId, address indexed solver, string solverGithubLogin, uint256 amount, uint256 platformFee, string pullRequestUrl);
    event BountyCancelled(uint256 indexed bountyId, address indexed creator, uint256 refundedAmount);
    event BountyExpired(uint256 indexed bountyId, uint256 refundedAmount);
    event ConfigUpdated(uint256 minBountyAmount, uint256 maxBountyAmount, uint256 platformFeeBps, address feeRecipient);

    error InvalidAmount();
    error BountyNotFound();
    error BountyNotActive();
    error BountyAlreadyExists();
    error UnauthorizedCaller();
    error InvalidSolverAddress();
    error MaxAmountExceeded();
    error TransferFailed();
    error InvalidConfiguration();

    constructor(address _mneeToken, address _admin, address _oracle, address _feeRecipient) {
        if (_mneeToken == address(0) || _admin == address(0) || _oracle == address(0)) {
            revert InvalidConfiguration();
        }
        
        mneeToken = IERC20(_mneeToken);
        feeRecipient = _feeRecipient;
        minBountyAmount = 1e18;
        maxBountyAmount = 1_000_000e18;
        platformFeeBps = 250;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(ORACLE_ROLE, _oracle);
        
        nextBountyId = 1;
    }

    function createBounty(
        string calldata repository,
        uint256 issueId,
        string calldata issueUrl,
        uint256 amount,
        uint256 maxAmount,
        uint256 expiresAt
    ) external whenNotPaused nonReentrant returns (uint256 bountyId) {
        if (amount < minBountyAmount || amount > maxBountyAmount) revert InvalidAmount();
        if (maxAmount < amount || maxAmount > maxBountyAmount) revert InvalidAmount();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidAmount();
        
        bytes32 issueHash = keccak256(abi.encodePacked(repository, issueId));
        if (issueToBountyId[issueHash] != 0) revert BountyAlreadyExists();
        
        bountyId = nextBountyId++;
        
        bounties[bountyId] = Bounty({
            id: bountyId,
            creator: msg.sender,
            initialAmount: amount,
            currentAmount: amount,
            maxAmount: maxAmount,
            repository: repository,
            issueId: issueId,
            issueUrl: issueUrl,
            status: BountyStatus.Active,
            solver: address(0),
            solverGithubLogin: "",
            pullRequestUrl: "",
            createdAt: block.timestamp,
            claimedAt: 0,
            expiresAt: expiresAt,
            escalationCount: 0
        });
        
        issueToBountyId[issueHash] = bountyId;
        creatorBounties[msg.sender].push(bountyId);
        
        mneeToken.safeTransferFrom(msg.sender, address(this), amount);
        
        emit BountyCreated(bountyId, msg.sender, repository, issueId, amount, maxAmount);
    }

    function escalateBounty(uint256 bountyId, uint256 additionalAmount) external whenNotPaused nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.id == 0) revert BountyNotFound();
        if (bounty.status != BountyStatus.Active) revert BountyNotActive();
        if (bounty.creator != msg.sender && !hasRole(ORACLE_ROLE, msg.sender)) revert UnauthorizedCaller();
        
        uint256 newAmount = bounty.currentAmount + additionalAmount;
        if (newAmount > bounty.maxAmount) revert MaxAmountExceeded();
        
        bounty.currentAmount = newAmount;
        bounty.escalationCount++;
        
        if (additionalAmount > 0) {
            mneeToken.safeTransferFrom(msg.sender, address(this), additionalAmount);
        }
        
        emit BountyEscalated(bountyId, bounty.currentAmount - additionalAmount, newAmount, bounty.escalationCount);
    }

    function releaseBounty(
        uint256 bountyId,
        address solver,
        string calldata solverGithubLogin,
        string calldata pullRequestUrl
    ) external onlyRole(ORACLE_ROLE) whenNotPaused nonReentrant {
        if (solver == address(0)) revert InvalidSolverAddress();
        
        Bounty storage bounty = bounties[bountyId];
        if (bounty.id == 0) revert BountyNotFound();
        if (bounty.status != BountyStatus.Active) revert BountyNotActive();
        
        bounty.status = BountyStatus.Claimed;
        bounty.solver = solver;
        bounty.solverGithubLogin = solverGithubLogin;
        bounty.pullRequestUrl = pullRequestUrl;
        bounty.claimedAt = block.timestamp;
        
        solverBounties[solver].push(bountyId);
        
        uint256 platformFee = (bounty.currentAmount * platformFeeBps) / 10000;
        uint256 solverAmount = bounty.currentAmount - platformFee;
        
        mneeToken.safeTransfer(solver, solverAmount);
        if (platformFee > 0 && feeRecipient != address(0)) {
            mneeToken.safeTransfer(feeRecipient, platformFee);
        }
        
        emit BountyClaimed(bountyId, solver, solverGithubLogin, solverAmount, platformFee, pullRequestUrl);
    }

    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.id == 0) revert BountyNotFound();
        if (bounty.status != BountyStatus.Active) revert BountyNotActive();
        if (bounty.creator != msg.sender && !hasRole(ADMIN_ROLE, msg.sender)) revert UnauthorizedCaller();
        
        bounty.status = BountyStatus.Cancelled;
        uint256 refundAmount = bounty.currentAmount;
        
        mneeToken.safeTransfer(bounty.creator, refundAmount);
        
        emit BountyCancelled(bountyId, bounty.creator, refundAmount);
    }

    function claimExpiredBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.id == 0) revert BountyNotFound();
        if (bounty.status != BountyStatus.Active) revert BountyNotActive();
        if (bounty.expiresAt == 0 || block.timestamp < bounty.expiresAt) revert BountyNotActive();
        
        bounty.status = BountyStatus.Expired;
        uint256 refundAmount = bounty.currentAmount;
        
        mneeToken.safeTransfer(bounty.creator, refundAmount);
        
        emit BountyExpired(bountyId, refundAmount);
    }

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return bounties[bountyId];
    }

    function getBountyByIssue(string calldata repository, uint256 issueId) external view returns (Bounty memory) {
        bytes32 issueHash = keccak256(abi.encodePacked(repository, issueId));
        uint256 bountyId = issueToBountyId[issueHash];
        return bounties[bountyId];
    }

    function getCreatorBounties(address creator) external view returns (uint256[] memory) {
        return creatorBounties[creator];
    }

    function getSolverBounties(address solver) external view returns (uint256[] memory) {
        return solverBounties[solver];
    }

    function updateConfig(
        uint256 _minBountyAmount,
        uint256 _maxBountyAmount,
        uint256 _platformFeeBps,
        address _feeRecipient
    ) external onlyRole(ADMIN_ROLE) {
        if (_minBountyAmount == 0 || _maxBountyAmount < _minBountyAmount) revert InvalidConfiguration();
        if (_platformFeeBps > 1000) revert InvalidConfiguration();
        
        minBountyAmount = _minBountyAmount;
        maxBountyAmount = _maxBountyAmount;
        platformFeeBps = _platformFeeBps;
        feeRecipient = _feeRecipient;
        
        emit ConfigUpdated(_minBountyAmount, _maxBountyAmount, _platformFeeBps, _feeRecipient);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyRole(ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}