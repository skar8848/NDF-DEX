// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPriceOracle} from "../oracle/PriceOracle.sol";

/// @title CollateralManager — Multi-collateral support with oracle-based USD valuation
/// @notice Accept WETH/WBTC/WAVAX as collateral with haircuts. USDC always 0% haircut.
contract CollateralManager is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct CollateralToken {
        address token;          // ERC20 address
        string priceAsset;      // Oracle asset name (e.g. "ETH")
        uint8 decimals;         // Token decimals
        uint256 haircutBps;     // Haircut in basis points (e.g. 1000 = 10%)
        bool supported;
    }

    IPriceOracle public oracle;
    address public owner;

    // Supported collateral tokens
    mapping(address => CollateralToken) public collateralTokens;
    address[] public supportedTokens;

    // trader => token => balance
    mapping(address => mapping(address => uint256)) public deposits;

    event CollateralDeposited(address indexed trader, address indexed token, uint256 amount);
    event CollateralWithdrawn(address indexed trader, address indexed token, uint256 amount);
    event TokenAdded(address indexed token, string priceAsset, uint256 haircutBps);

    modifier onlyOwner() {
        require(msg.sender == owner, "CollateralManager: not owner");
        _;
    }

    constructor(address _oracle) {
        oracle = IPriceOracle(_oracle);
        owner = msg.sender;
    }

    // ─── Admin ───────────────────────────────────────────────────

    function addCollateralToken(
        address token,
        string calldata priceAsset,
        uint8 tokenDecimals,
        uint256 haircutBps
    ) external onlyOwner {
        require(token != address(0), "CollateralManager: zero address");
        require(haircutBps <= 5000, "CollateralManager: haircut too high"); // max 50%
        require(!collateralTokens[token].supported, "CollateralManager: already added");

        collateralTokens[token] = CollateralToken({
            token: token,
            priceAsset: priceAsset,
            decimals: tokenDecimals,
            haircutBps: haircutBps,
            supported: true
        });
        supportedTokens.push(token);

        emit TokenAdded(token, priceAsset, haircutBps);
    }

    // ─── Deposit / Withdraw ──────────────────────────────────────

    function depositCollateral(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "CollateralManager: zero amount");
        require(collateralTokens[token].supported, "CollateralManager: unsupported token");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][token] += amount;

        emit CollateralDeposited(msg.sender, token, amount);
    }

    function withdrawCollateral(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "CollateralManager: zero amount");
        require(deposits[msg.sender][token] >= amount, "CollateralManager: insufficient balance");

        deposits[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, token, amount);
    }

    // ─── Valuation ───────────────────────────────────────────────

    /// @notice Get the total USD value of a trader's collateral (after haircuts), 6 decimals
    function getCollateralValueUSD(address trader) external view returns (uint256 totalUSD) {
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            uint256 balance = deposits[trader][token];
            if (balance == 0) continue;

            CollateralToken memory ct = collateralTokens[token];
            (uint256 price,) = oracle.getPrice(ct.priceAsset);

            // value = balance * price / 10^tokenDecimals / 10^priceDecimals * 10^usdcDecimals
            // = balance * price * 1e6 / 10^tokenDecimals / 1e8
            uint256 rawValue = balance * price * 1e6 / (10 ** ct.decimals) / 1e8;

            // Apply haircut
            uint256 haircutValue = rawValue * (10000 - ct.haircutBps) / 10000;
            totalUSD += haircutValue;
        }
    }

    /// @notice Get collateral details for a specific token for a trader
    function getDeposit(address trader, address token) external view returns (uint256 balance, uint256 valueUSD) {
        balance = deposits[trader][token];
        if (balance == 0) return (0, 0);

        CollateralToken memory ct = collateralTokens[token];
        if (!ct.supported) return (balance, 0);

        (uint256 price,) = oracle.getPrice(ct.priceAsset);
        uint256 rawValue = balance * price * 1e6 / (10 ** ct.decimals) / 1e8;
        valueUSD = rawValue * (10000 - ct.haircutBps) / 10000;
    }

    /// @notice Get all supported collateral tokens
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
}
