// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library OrderLib {
    enum Side {
        LONG,
        SHORT
    }

    enum OrderStatus {
        OPEN,
        FILLED,
        PARTIALLY_FILLED,
        CANCELLED
    }

    struct Order {
        uint256 id;
        address trader;
        uint256 marketId;
        Side side;
        uint256 price; // 8 decimals
        uint256 amount; // number of contracts
        uint256 filled; // amount already filled
        uint256 collateral; // USDC locked (6 decimals)
        uint256 timestamp;
        OrderStatus status;
    }

    struct PositionInfo {
        uint256 id;
        address trader;
        uint256 marketId;
        Side side;
        uint256 entryPrice; // 8 decimals
        uint256 size; // number of contracts
        uint256 collateral; // USDC locked (6 decimals)
        uint256 timestamp;
        bool isOpen;
    }

    struct TPSLOrder {
        uint256 takeProfitPrice; // 8 decimals. 0 = not set
        uint256 stopLossPrice; // 8 decimals. 0 = not set
    }

    struct MarketInfo {
        uint256 id;
        string baseAsset; // e.g. "ETH"
        string quoteAsset; // e.g. "USDC"
        uint256 expiration; // timestamp
        uint256 ltv; // loan-to-value in basis points (e.g., 5000 = 50%)
        uint256 liquidationThreshold; // basis points (e.g., 8000 = 80%)
        uint256 minCollateral; // minimum collateral in USDC (6 decimals)
        uint256 settlePrice; // price at settlement (8 decimals)
        bool settled;
        uint256 totalLongOI; // total long open interest (contracts)
        uint256 totalShortOI; // total short open interest (contracts)
    }
}
