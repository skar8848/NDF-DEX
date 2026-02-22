// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OrderLib} from "../libraries/OrderLib.sol";
import {MathLib} from "../libraries/MathLib.sol";
import {ForwardMarket} from "./ForwardMarket.sol";
import {IPriceOracle} from "../oracle/PriceOracle.sol";

contract PositionManager {
    ForwardMarket public forwardMarket;
    IPriceOracle public oracle;
    IERC20 public collateralToken;
    address public orderBook;

    uint256 private _nextPositionId = 1;

    mapping(uint256 => OrderLib.PositionInfo) public positions;
    mapping(address => uint256[]) public userPositionIds;

    // TP/SL orders per position
    mapping(uint256 => OrderLib.TPSLOrder) public tpslOrders;

    // Open position enumeration for keeper
    uint256[] public allOpenPositionIds;
    mapping(uint256 => uint256) private _openPositionIndex; // positionId => index+1 (0 means not in list)

    uint256 public constant LIQUIDATION_BONUS = 500; // 5% bonus for liquidators

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
    event PositionLiquidated(uint256 indexed positionId, address indexed liquidator, int256 pnl);
    event PositionSettled(uint256 indexed positionId, int256 pnl);
    event CollateralAdded(uint256 indexed positionId, uint256 amount);
    event CollateralRemoved(uint256 indexed positionId, uint256 amount);
    event TPSLUpdated(uint256 indexed positionId, uint256 tp, uint256 sl);
    event PositionClosedEarly(uint256 indexed positionId, uint256 closePrice, int256 pnl, address closer);

    modifier onlyOrderBook() {
        require(msg.sender == orderBook, "PositionManager: not orderbook");
        _;
    }

    constructor(address _forwardMarket, address _oracle, address _collateralToken, address _orderBook) {
        forwardMarket = ForwardMarket(_forwardMarket);
        oracle = IPriceOracle(_oracle);
        collateralToken = IERC20(_collateralToken);
        orderBook = _orderBook;
    }

    function openPosition(
        uint256 marketId,
        address trader,
        OrderLib.Side side,
        uint256 entryPrice,
        uint256 size,
        uint256 collateral
    ) external onlyOrderBook returns (uint256 positionId) {
        positionId = _nextPositionId++;

        positions[positionId] = OrderLib.PositionInfo({
            id: positionId,
            trader: trader,
            marketId: marketId,
            side: side,
            entryPrice: entryPrice,
            size: size,
            collateral: collateral,
            timestamp: block.timestamp,
            isOpen: true
        });

        userPositionIds[trader].push(positionId);

        // Track open position for keeper enumeration
        allOpenPositionIds.push(positionId);
        _openPositionIndex[positionId] = allOpenPositionIds.length; // index+1

        // Update open interest
        forwardMarket.updateOI(marketId, side, size, true);

        emit PositionOpened(positionId, trader, marketId, side, entryPrice, size, collateral);
    }

    // ─── TP/SL ───────────────────────────────────────────────────────

    function setTPSL(uint256 positionId, uint256 tp, uint256 sl) external {
        OrderLib.PositionInfo storage pos = positions[positionId];
        require(pos.isOpen, "PositionManager: position closed");
        require(pos.trader == msg.sender, "PositionManager: not your position");

        bool isLong = pos.side == OrderLib.Side.LONG;

        // Validate TP/SL directions
        if (tp > 0) {
            if (isLong) {
                require(tp > pos.entryPrice, "PositionManager: TP must be above entry for long");
            } else {
                require(tp < pos.entryPrice, "PositionManager: TP must be below entry for short");
            }
        }
        if (sl > 0) {
            if (isLong) {
                require(sl < pos.entryPrice, "PositionManager: SL must be below entry for long");
            } else {
                require(sl > pos.entryPrice, "PositionManager: SL must be above entry for short");
            }
        }

        tpslOrders[positionId] = OrderLib.TPSLOrder({takeProfitPrice: tp, stopLossPrice: sl});

        emit TPSLUpdated(positionId, tp, sl);
    }

    function getTPSL(uint256 positionId) external view returns (OrderLib.TPSLOrder memory) {
        return tpslOrders[positionId];
    }

    // ─── Close Position (Early Exit) ─────────────────────────────────

    function closePosition(uint256 positionId) external {
        OrderLib.PositionInfo storage pos = positions[positionId];
        require(pos.isOpen, "PositionManager: position closed");

        OrderLib.MarketInfo memory market = forwardMarket.getMarket(pos.marketId);
        require(!market.settled, "PositionManager: use settlePosition");

        (uint256 markPrice,) = oracle.getPrice(market.baseAsset);
        bool isLong = pos.side == OrderLib.Side.LONG;

        // If caller is NOT the trader, they must be a keeper triggering TP/SL
        if (msg.sender != pos.trader) {
            OrderLib.TPSLOrder memory tpsl = tpslOrders[positionId];
            bool tpTriggered = tpsl.takeProfitPrice > 0
                && (isLong ? markPrice >= tpsl.takeProfitPrice : markPrice <= tpsl.takeProfitPrice);
            bool slTriggered = tpsl.stopLossPrice > 0
                && (isLong ? markPrice <= tpsl.stopLossPrice : markPrice >= tpsl.stopLossPrice);
            require(tpTriggered || slTriggered, "PositionManager: TP/SL not triggered");
        }

        // Calculate PnL at mark price
        int256 pnl = MathLib.calculatePnL(pos.entryPrice, markPrice, pos.size, isLong);

        // Close position
        pos.isOpen = false;
        _removeFromOpenList(positionId);

        // Update open interest
        forwardMarket.updateOI(pos.marketId, pos.side, pos.size, false);

        // Calculate payout (from protocol pool)
        uint256 payout;
        if (pnl >= 0) {
            payout = pos.collateral + uint256(pnl);
            uint256 balance = collateralToken.balanceOf(address(this));
            if (payout > balance) payout = balance;
        } else {
            uint256 loss = MathLib.abs(pnl);
            payout = pos.collateral > loss ? pos.collateral - loss : 0;
        }

        if (payout > 0) {
            collateralToken.transfer(pos.trader, payout);
        }

        emit PositionClosedEarly(positionId, markPrice, pnl, msg.sender);
    }

    // ─── Position Enumeration ────────────────────────────────────────

    function getOpenPositionIds(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256 total = allOpenPositionIds.length;
        if (offset >= total) return new uint256[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = allOpenPositionIds[offset + i];
        }
        return result;
    }

    function getOpenPositionCount() external view returns (uint256) {
        return allOpenPositionIds.length;
    }

    // ─── Existing Functions ──────────────────────────────────────────

    function addCollateral(uint256 positionId, uint256 amount) external {
        OrderLib.PositionInfo storage pos = positions[positionId];
        require(pos.isOpen, "PositionManager: position closed");
        require(pos.trader == msg.sender, "PositionManager: not your position");

        collateralToken.transferFrom(msg.sender, address(this), amount);
        pos.collateral += amount;

        emit CollateralAdded(positionId, amount);
    }

    function removeCollateral(uint256 positionId, uint256 amount) external {
        OrderLib.PositionInfo storage pos = positions[positionId];
        require(pos.isOpen, "PositionManager: position closed");
        require(pos.trader == msg.sender, "PositionManager: not your position");
        require(pos.collateral >= amount, "PositionManager: insufficient collateral");

        // Check health factor after removal
        OrderLib.MarketInfo memory market = forwardMarket.getMarket(pos.marketId);
        (uint256 markPrice,) = oracle.getPrice(market.baseAsset);

        uint256 newCollateral = pos.collateral - amount;
        uint256 health = MathLib.calculateHealthFactor(
            newCollateral, pos.entryPrice, markPrice, pos.size, market.liquidationThreshold, pos.side == OrderLib.Side.LONG
        );
        require(health >= MathLib.PERCENT_BASE, "PositionManager: would be liquidatable");

        pos.collateral = newCollateral;
        collateralToken.transfer(msg.sender, amount);

        emit CollateralRemoved(positionId, amount);
    }

    function liquidate(uint256 positionId) external {
        OrderLib.PositionInfo storage pos = positions[positionId];
        require(pos.isOpen, "PositionManager: position closed");

        OrderLib.MarketInfo memory market = forwardMarket.getMarket(pos.marketId);
        require(!market.settled, "PositionManager: use settlePosition");

        (uint256 markPrice,) = oracle.getPrice(market.baseAsset);

        uint256 health = MathLib.calculateHealthFactor(
            pos.collateral, pos.entryPrice, markPrice, pos.size, market.liquidationThreshold, pos.side == OrderLib.Side.LONG
        );
        require(health < MathLib.PERCENT_BASE, "PositionManager: not liquidatable");

        // Calculate PnL
        int256 pnl =
            MathLib.calculatePnL(pos.entryPrice, markPrice, pos.size, pos.side == OrderLib.Side.LONG);

        // Close position
        pos.isOpen = false;
        _removeFromOpenList(positionId);

        // Update open interest
        forwardMarket.updateOI(pos.marketId, pos.side, pos.size, false);

        // Liquidator gets a bonus from the remaining collateral
        uint256 liquidatorBonus = pos.collateral * LIQUIDATION_BONUS / MathLib.PERCENT_BASE;
        uint256 remaining;

        if (pnl >= 0) {
            remaining = pos.collateral;
        } else {
            uint256 loss = MathLib.abs(pnl);
            remaining = pos.collateral > loss ? pos.collateral - loss : 0;
        }

        if (liquidatorBonus > remaining) liquidatorBonus = remaining;
        uint256 traderRefund = remaining - liquidatorBonus;

        if (liquidatorBonus > 0) {
            collateralToken.transfer(msg.sender, liquidatorBonus);
        }
        if (traderRefund > 0) {
            collateralToken.transfer(pos.trader, traderRefund);
        }

        emit PositionLiquidated(positionId, msg.sender, pnl);
    }

    function settlePosition(uint256 positionId) external {
        OrderLib.PositionInfo storage pos = positions[positionId];
        require(pos.isOpen, "PositionManager: position closed");

        OrderLib.MarketInfo memory market = forwardMarket.getMarket(pos.marketId);
        require(market.settled, "PositionManager: market not settled");

        // Calculate PnL at settlement price
        int256 pnl =
            MathLib.calculatePnL(pos.entryPrice, market.settlePrice, pos.size, pos.side == OrderLib.Side.LONG);

        pos.isOpen = false;
        _removeFromOpenList(positionId);

        // Update open interest
        forwardMarket.updateOI(pos.marketId, pos.side, pos.size, false);

        // Calculate payout
        uint256 payout;
        if (pnl >= 0) {
            payout = pos.collateral + uint256(pnl);
            // Cap payout at available collateral in contract
            uint256 balance = collateralToken.balanceOf(address(this));
            if (payout > balance) payout = balance;
        } else {
            uint256 loss = MathLib.abs(pnl);
            payout = pos.collateral > loss ? pos.collateral - loss : 0;
        }

        if (payout > 0) {
            collateralToken.transfer(pos.trader, payout);
        }

        emit PositionSettled(positionId, pnl);
    }

    function getPosition(uint256 positionId) external view returns (OrderLib.PositionInfo memory) {
        require(positions[positionId].id != 0, "PositionManager: not found");
        return positions[positionId];
    }

    function getUserPositions(address user) external view returns (OrderLib.PositionInfo[] memory) {
        uint256[] storage ids = userPositionIds[user];
        OrderLib.PositionInfo[] memory result = new OrderLib.PositionInfo[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = positions[ids[i]];
        }
        return result;
    }

    function getUserOpenPositions(address user) external view returns (OrderLib.PositionInfo[] memory) {
        uint256[] storage ids = userPositionIds[user];
        uint256 openCount = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (positions[ids[i]].isOpen) openCount++;
        }

        OrderLib.PositionInfo[] memory result = new OrderLib.PositionInfo[](openCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (positions[ids[i]].isOpen) {
                result[idx++] = positions[ids[i]];
            }
        }
        return result;
    }

    function getHealthFactor(uint256 positionId) external view returns (uint256) {
        OrderLib.PositionInfo storage pos = positions[positionId];
        require(pos.isOpen, "PositionManager: position closed");

        OrderLib.MarketInfo memory market = forwardMarket.getMarket(pos.marketId);
        (uint256 markPrice,) = oracle.getPrice(market.baseAsset);

        return MathLib.calculateHealthFactor(
            pos.collateral, pos.entryPrice, markPrice, pos.size, market.liquidationThreshold, pos.side == OrderLib.Side.LONG
        );
    }

    // ─── Internal ────────────────────────────────────────────────────

    function _removeFromOpenList(uint256 positionId) internal {
        uint256 indexPlusOne = _openPositionIndex[positionId];
        if (indexPlusOne == 0) return; // not in list

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = allOpenPositionIds.length - 1;

        if (index != lastIndex) {
            uint256 lastId = allOpenPositionIds[lastIndex];
            allOpenPositionIds[index] = lastId;
            _openPositionIndex[lastId] = indexPlusOne; // same slot
        }

        allOpenPositionIds.pop();
        delete _openPositionIndex[positionId];
    }
}
