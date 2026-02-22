// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OrderLib} from "../libraries/OrderLib.sol";

interface IPositionManager {
    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        uint256 indexed marketId,
        OrderLib.Side side,
        uint256 entryPrice,
        uint256 size,
        uint256 collateral
    );
    event PositionClosed(uint256 indexed positionId, int256 pnl);
    event PositionLiquidated(uint256 indexed positionId, address liquidator);
    event PositionSettled(uint256 indexed positionId, int256 pnl);
    event CollateralAdded(uint256 indexed positionId, uint256 amount);
    event CollateralRemoved(uint256 indexed positionId, uint256 amount);

    function getPosition(uint256 positionId) external view returns (OrderLib.PositionInfo memory);
    function getUserPositions(address user) external view returns (OrderLib.PositionInfo[] memory);
    function addCollateral(uint256 positionId, uint256 amount) external;
    function removeCollateral(uint256 positionId, uint256 amount) external;
    function liquidate(uint256 positionId) external;
}
