// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OrderLib} from "../libraries/OrderLib.sol";

interface IOrderBook {
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        uint256 indexed marketId,
        OrderLib.Side side,
        uint256 price,
        uint256 amount
    );
    event OrderMatched(
        uint256 indexed buyOrderId, uint256 indexed sellOrderId, uint256 price, uint256 amount
    );
    event OrderCancelled(uint256 indexed orderId);

    function placeLimitOrder(uint256 marketId, OrderLib.Side side, uint256 price, uint256 amount) external;
    function placeMarketOrder(uint256 marketId, OrderLib.Side side, uint256 amount) external;
    function cancelOrder(uint256 orderId) external;
    function getOrderBook(uint256 marketId)
        external
        view
        returns (OrderLib.Order[] memory bids, OrderLib.Order[] memory asks);
    function getOrder(uint256 orderId) external view returns (OrderLib.Order memory);
}
