// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library MathLib {
    uint256 internal constant PRICE_PRECISION = 1e8; // 8 decimals for prices
    uint256 internal constant COLLATERAL_PRECISION = 1e6; // 6 decimals for USDC
    uint256 internal constant PERCENT_BASE = 1e4; // 100% = 10000

    /// @notice Calculate PnL in collateral token units (6 decimals)
    /// @param entryPrice Price at entry (8 decimals)
    /// @param exitPrice Price at exit (8 decimals)
    /// @param size Number of contracts
    /// @param isLong True if long position
    /// @return PnL in collateral units (6 decimals, signed)
    function calculatePnL(
        uint256 entryPrice,
        uint256 exitPrice,
        uint256 size,
        bool isLong
    ) internal pure returns (int256) {
        int256 priceDiff;
        if (isLong) {
            priceDiff = int256(exitPrice) - int256(entryPrice);
        } else {
            priceDiff = int256(entryPrice) - int256(exitPrice);
        }
        // Convert from price precision to collateral precision
        return priceDiff * int256(size) * int256(COLLATERAL_PRECISION) / int256(PRICE_PRECISION);
    }

    /// @notice Calculate health factor for a position
    /// @dev Health < PERCENT_BASE means liquidatable
    /// @return Health factor (10000 = 100% = minimum healthy)
    function calculateHealthFactor(
        uint256 collateral,
        uint256 entryPrice,
        uint256 markPrice,
        uint256 size,
        uint256 liquidationThreshold,
        bool isLong
    ) internal pure returns (uint256) {
        int256 pnl = calculatePnL(entryPrice, markPrice, size, isLong);
        int256 equity = int256(collateral) + pnl;
        if (equity <= 0) return 0;

        // Maintenance margin based on entry price (constant, doesn't change with mark price)
        uint256 maintenanceMargin =
            size * entryPrice * liquidationThreshold * COLLATERAL_PRECISION / (PRICE_PRECISION * PERCENT_BASE);
        if (maintenanceMargin == 0) return type(uint256).max;

        return uint256(equity) * PERCENT_BASE / maintenanceMargin;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    function abs(int256 x) internal pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }
}
