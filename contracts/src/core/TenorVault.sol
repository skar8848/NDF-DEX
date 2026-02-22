// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TenorVault — Passive liquidity vault (TLP token)
/// @notice Inspired by Hyperliquid's HLP and GMX's GLP. Depositors receive TLP shares
///         proportional to their USDC deposit. Share price increases as fee revenue flows in.
contract TenorVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public owner;

    // Configuration
    uint256 public depositCap;          // Max total USDC in vault (0 = unlimited)
    uint256 public withdrawalDelay;     // Seconds to wait after requesting withdraw (default 24h)
    uint256 public managementFeeBps;    // Annual management fee (basis points)
    uint256 public performanceFeeBps;   // Performance fee on profits (basis points)

    // Withdrawal requests
    struct WithdrawRequest {
        uint256 shares;
        uint256 requestTime;
    }
    mapping(address => WithdrawRequest) public withdrawRequests;

    // Tracking
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    event Deposited(address indexed user, uint256 usdcAmount, uint256 sharesReceived);
    event WithdrawRequested(address indexed user, uint256 shares, uint256 executeAfter);
    event WithdrawExecuted(address indexed user, uint256 sharesBurned, uint256 usdcReceived);
    event WithdrawCancelled(address indexed user, uint256 shares);

    modifier onlyOwner() {
        require(msg.sender == owner, "TenorVault: not owner");
        _;
    }

    uint256 private constant DEAD_SHARES = 1000;

    constructor(address _usdc) ERC20("Tenor LP", "TLP") {
        usdc = IERC20(_usdc);
        owner = msg.sender;
        withdrawalDelay = 24 hours;
    }

    // ─── Deposit ─────────────────────────────────────────────────

    /// @notice Deposit USDC and receive TLP shares
    function deposit(uint256 usdcAmount) external nonReentrant {
        require(usdcAmount > 0, "TenorVault: zero amount");

        uint256 vaultBalance = usdc.balanceOf(address(this));
        if (depositCap > 0) {
            require(vaultBalance + usdcAmount <= depositCap, "TenorVault: cap exceeded");
        }

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        uint256 shares;
        uint256 supply = totalSupply();
        if (supply == 0 || vaultBalance == 0) {
            // First deposit: 1 TLP = 1 USDC (both 6 decimals internally but TLP has 18)
            shares = usdcAmount * 1e12; // Scale from 6 to 18 decimals
            // Mint dead shares to prevent first-depositor inflation attack
            _mint(address(1), DEAD_SHARES);
        } else {
            shares = usdcAmount * supply / vaultBalance;
        }

        _mint(msg.sender, shares);
        totalDeposited += usdcAmount;

        emit Deposited(msg.sender, usdcAmount, shares);
    }

    // ─── Withdraw (two-step) ─────────────────────────────────────

    /// @notice Request a withdrawal (starts delay timer, locks shares in vault)
    function requestWithdraw(uint256 shares) external {
        require(shares > 0, "TenorVault: zero shares");
        require(balanceOf(msg.sender) >= shares, "TenorVault: insufficient shares");
        require(withdrawRequests[msg.sender].shares == 0, "TenorVault: pending request exists");

        // Lock shares by transferring to vault (prevents transfer/dump during delay)
        _transfer(msg.sender, address(this), shares);

        withdrawRequests[msg.sender] = WithdrawRequest({
            shares: shares,
            requestTime: block.timestamp
        });

        emit WithdrawRequested(msg.sender, shares, block.timestamp + withdrawalDelay);
    }

    /// @notice Execute a pending withdrawal after delay has passed
    function executeWithdraw() external nonReentrant {
        WithdrawRequest memory req = withdrawRequests[msg.sender];
        require(req.shares > 0, "TenorVault: no pending request");
        require(block.timestamp >= req.requestTime + withdrawalDelay, "TenorVault: delay not met");

        uint256 vaultBalance = usdc.balanceOf(address(this));
        uint256 supply = totalSupply();
        uint256 usdcAmount = req.shares * vaultBalance / supply;

        delete withdrawRequests[msg.sender];

        // Burn shares from vault (they were locked here during requestWithdraw)
        _burn(address(this), req.shares);

        if (usdcAmount > 0) {
            usdc.safeTransfer(msg.sender, usdcAmount);
        }
        totalWithdrawn += usdcAmount;

        emit WithdrawExecuted(msg.sender, req.shares, usdcAmount);
    }

    /// @notice Cancel a pending withdrawal request (returns locked shares)
    function cancelWithdraw() external {
        WithdrawRequest memory req = withdrawRequests[msg.sender];
        require(req.shares > 0, "TenorVault: no pending request");
        uint256 shares = req.shares;
        delete withdrawRequests[msg.sender];

        // Return locked shares from vault back to user
        _transfer(address(this), msg.sender, shares);

        emit WithdrawCancelled(msg.sender, shares);
    }

    // ─── View Functions ──────────────────────────────────────────

    /// @notice Current price of 1 TLP share in USDC (scaled to 1e18)
    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return usdc.balanceOf(address(this)) * 1e18 / (supply / 1e12);
    }

    /// @notice Total USDC value of the vault
    function totalValue() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // ─── Admin ───────────────────────────────────────────────────

    function setDepositCap(uint256 _cap) external onlyOwner {
        depositCap = _cap;
    }

    function setWithdrawalDelay(uint256 _delay) external onlyOwner {
        require(_delay <= 7 days, "TenorVault: delay too long");
        withdrawalDelay = _delay;
    }

    function setFees(uint256 _managementBps, uint256 _performanceBps) external onlyOwner {
        require(_managementBps <= 500, "TenorVault: mgmt fee too high"); // max 5%
        require(_performanceBps <= 3000, "TenorVault: perf fee too high"); // max 30%
        managementFeeBps = _managementBps;
        performanceFeeBps = _performanceBps;
    }

    /// @notice Vault manager can approve OrderBook to use vault USDC for market making
    function approveTrading(address orderBook, uint256 amount) external onlyOwner {
        usdc.approve(orderBook, amount);
    }
}
