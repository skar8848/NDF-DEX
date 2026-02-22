// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OrderLib} from "../libraries/OrderLib.sol";
import {IPriceOracle} from "../oracle/PriceOracle.sol";
import {IForwardMarket} from "../interfaces/IForwardMarket.sol";

contract ForwardMarket is IForwardMarket {
    address public owner;
    IPriceOracle public oracle;

    uint256 private _nextMarketId = 1;
    mapping(uint256 => OrderLib.MarketInfo) public markets;
    uint256[] public marketIds;

    modifier onlyOwner() {
        require(msg.sender == owner, "ForwardMarket: not owner");
        _;
    }

    constructor(address _oracle) {
        owner = msg.sender;
        oracle = IPriceOracle(_oracle);
    }

    function createMarket(
        string calldata baseAsset,
        string calldata quoteAsset,
        uint256 expiration,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 minCollateral
    ) external onlyOwner returns (uint256 marketId) {
        return _createMarket(baseAsset, quoteAsset, expiration, ltv, liquidationThreshold, minCollateral, OrderLib.SettlementType.CASH, address(0));
    }

    function createPhysicalMarket(
        string calldata baseAsset,
        string calldata quoteAsset,
        uint256 expiration,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 minCollateral,
        address underlyingToken
    ) external onlyOwner returns (uint256 marketId) {
        require(underlyingToken != address(0), "ForwardMarket: zero underlying");
        return _createMarket(baseAsset, quoteAsset, expiration, ltv, liquidationThreshold, minCollateral, OrderLib.SettlementType.PHYSICAL, underlyingToken);
    }

    function _createMarket(
        string calldata baseAsset,
        string calldata quoteAsset,
        uint256 expiration,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 minCollateral,
        OrderLib.SettlementType settlementType,
        address underlyingToken
    ) internal returns (uint256 marketId) {
        require(expiration > block.timestamp, "ForwardMarket: expiration in past");
        require(ltv > 0 && ltv <= 10000, "ForwardMarket: invalid ltv");
        require(liquidationThreshold > 0 && liquidationThreshold <= 10000, "ForwardMarket: invalid threshold");

        marketId = _nextMarketId++;

        markets[marketId] = OrderLib.MarketInfo({
            id: marketId,
            baseAsset: baseAsset,
            quoteAsset: quoteAsset,
            expiration: expiration,
            ltv: ltv,
            liquidationThreshold: liquidationThreshold,
            minCollateral: minCollateral,
            settlePrice: 0,
            settled: false,
            totalLongOI: 0,
            totalShortOI: 0,
            settlementType: settlementType,
            underlyingToken: underlyingToken
        });

        marketIds.push(marketId);

        emit MarketCreated(marketId, baseAsset, quoteAsset, expiration);
    }

    function settleMarket(uint256 marketId) external onlyOwner {
        OrderLib.MarketInfo storage market = markets[marketId];
        require(market.id != 0, "ForwardMarket: market not found");
        require(!market.settled, "ForwardMarket: already settled");
        require(block.timestamp >= market.expiration, "ForwardMarket: not expired");

        (uint256 price,) = oracle.getPrice(market.baseAsset);
        market.settlePrice = price;
        market.settled = true;

        emit MarketSettled(marketId, price);
    }

    function getMarket(uint256 marketId) external view returns (OrderLib.MarketInfo memory) {
        require(markets[marketId].id != 0, "ForwardMarket: market not found");
        return markets[marketId];
    }

    function getActiveMarkets() external view returns (OrderLib.MarketInfo[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < marketIds.length; i++) {
            if (!markets[marketIds[i]].settled) {
                activeCount++;
            }
        }

        OrderLib.MarketInfo[] memory active = new OrderLib.MarketInfo[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < marketIds.length; i++) {
            if (!markets[marketIds[i]].settled) {
                active[idx++] = markets[marketIds[i]];
            }
        }
        return active;
    }

    function getAllMarkets() external view returns (OrderLib.MarketInfo[] memory) {
        OrderLib.MarketInfo[] memory all = new OrderLib.MarketInfo[](marketIds.length);
        for (uint256 i = 0; i < marketIds.length; i++) {
            all[i] = markets[marketIds[i]];
        }
        return all;
    }

    function marketCount() external view returns (uint256) {
        return marketIds.length;
    }

    function updateOI(uint256 marketId, OrderLib.Side side, uint256 amount, bool isIncrease) external {
        require(authorized[msg.sender], "ForwardMarket: not authorized");
        OrderLib.MarketInfo storage market = markets[marketId];
        require(market.id != 0, "ForwardMarket: market not found");

        if (side == OrderLib.Side.LONG) {
            if (isIncrease) {
                market.totalLongOI += amount;
            } else {
                market.totalLongOI -= amount;
            }
        } else {
            if (isIncrease) {
                market.totalShortOI += amount;
            } else {
                market.totalShortOI -= amount;
            }
        }
    }

    // Allow OrderBook/PositionManager to call updateOI
    mapping(address => bool) public authorized;

    function setAuthorized(address addr, bool status) external onlyOwner {
        authorized[addr] = status;
    }
}
