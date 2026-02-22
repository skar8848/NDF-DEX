// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OrderLib} from "../libraries/OrderLib.sol";

interface IForwardMarket {
    event MarketCreated(uint256 indexed marketId, string baseAsset, string quoteAsset, uint256 expiration);
    event MarketSettled(uint256 indexed marketId, uint256 settlePrice);

    function createMarket(
        string calldata baseAsset,
        string calldata quoteAsset,
        uint256 expiration,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 minCollateral
    ) external returns (uint256 marketId);

    function settleMarket(uint256 marketId) external;
    function getMarket(uint256 marketId) external view returns (OrderLib.MarketInfo memory);
    function getActiveMarkets() external view returns (OrderLib.MarketInfo[] memory);
    function marketCount() external view returns (uint256);
}
