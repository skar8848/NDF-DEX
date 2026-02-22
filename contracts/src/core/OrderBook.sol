// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OrderLib} from "../libraries/OrderLib.sol";
import {MathLib} from "../libraries/MathLib.sol";
import {ForwardMarket} from "./ForwardMarket.sol";
import {PositionManager} from "./PositionManager.sol";

contract OrderBook is ReentrancyGuard {
    using SafeERC20 for IERC20;
    ForwardMarket public forwardMarket;
    PositionManager public positionManager;
    IERC20 public collateralToken; // USDC

    address public owner;
    address public feeCollector;
    uint256 public takerFeeBps;        // 10 = 0.10%
    uint256 public totalFeesCollected;

    uint256 private _nextOrderId = 1;

    // orderId => Order
    mapping(uint256 => OrderLib.Order) public orders;

    // marketId => array of open order IDs (LONG side = bids)
    mapping(uint256 => uint256[]) public bidOrderIds;
    // marketId => array of open order IDs (SHORT side = asks)
    mapping(uint256 => uint256[]) public askOrderIds;

    // trader => array of order IDs
    mapping(address => uint256[]) public userOrderIds;

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        uint256 indexed marketId,
        OrderLib.Side side,
        uint256 price,
        uint256 amount,
        uint256 collateral
    );
    event OrderMatched(
        uint256 indexed bidOrderId,
        uint256 indexed askOrderId,
        uint256 price,
        uint256 amount,
        uint256 positionIdLong,
        uint256 positionIdShort,
        uint256 takerFee
    );
    event OrderCancelled(uint256 indexed orderId, address indexed trader);
    event FeesCollected(uint256 indexed orderId, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "OrderBook: not owner");
        _;
    }

    constructor(address _forwardMarket, address _collateralToken, address _feeCollector, uint256 _takerFeeBps) {
        require(_takerFeeBps <= 1000, "OrderBook: fee too high"); // max 10%
        forwardMarket = ForwardMarket(_forwardMarket);
        collateralToken = IERC20(_collateralToken);
        owner = msg.sender;
        feeCollector = _feeCollector;
        takerFeeBps = _takerFeeBps;
    }

    function setTakerFee(uint256 _newBps) external onlyOwner {
        require(_newBps <= 1000, "OrderBook: fee too high");
        takerFeeBps = _newBps;
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "OrderBook: zero address");
        feeCollector = _feeCollector;
    }

    function setPositionManager(address _positionManager) external {
        require(address(positionManager) == address(0), "OrderBook: already set");
        positionManager = PositionManager(_positionManager);
    }

    function placeLimitOrder(
        uint256 marketId,
        OrderLib.Side side,
        uint256 price,
        uint256 amount
    ) external nonReentrant {
        OrderLib.MarketInfo memory market = forwardMarket.getMarket(marketId);
        require(!market.settled, "OrderBook: market settled");
        require(block.timestamp < market.expiration, "OrderBook: market expired");
        require(price > 0, "OrderBook: invalid price");
        require(amount > 0, "OrderBook: invalid amount");

        // Calculate required collateral: (amount * price_usd) / ltv_pct, in USDC 6 decimals
        uint256 collateral = amount * price / MathLib.PRICE_PRECISION
            * MathLib.COLLATERAL_PRECISION * MathLib.PERCENT_BASE / market.ltv;
        require(collateral >= market.minCollateral, "OrderBook: below min collateral");

        // Transfer collateral from trader
        collateralToken.safeTransferFrom(msg.sender, address(this), collateral);

        uint256 orderId = _nextOrderId++;
        orders[orderId] = OrderLib.Order({
            id: orderId,
            trader: msg.sender,
            marketId: marketId,
            side: side,
            price: price,
            amount: amount,
            filled: 0,
            collateral: collateral,
            timestamp: block.timestamp,
            status: OrderLib.OrderStatus.OPEN
        });

        userOrderIds[msg.sender].push(orderId);

        emit OrderPlaced(orderId, msg.sender, marketId, side, price, amount, collateral);

        // Try to match against opposite side
        _matchOrder(orderId);

        // If order still has remaining amount, add to book
        if (orders[orderId].filled < orders[orderId].amount) {
            if (side == OrderLib.Side.LONG) {
                bidOrderIds[marketId].push(orderId);
            } else {
                askOrderIds[marketId].push(orderId);
            }
        }
    }

    function placeMarketOrder(
        uint256 marketId,
        OrderLib.Side side,
        uint256 amount
    ) external nonReentrant {
        OrderLib.MarketInfo memory market = forwardMarket.getMarket(marketId);
        require(!market.settled, "OrderBook: market settled");
        require(block.timestamp < market.expiration, "OrderBook: market expired");
        require(amount > 0, "OrderBook: invalid amount");

        // For market orders, use a very high/low price to ensure execution
        uint256 price;
        if (side == OrderLib.Side.LONG) {
            price = type(uint256).max / 2; // willing to pay any price
        } else {
            price = 1; // willing to sell at any price
        }

        // Calculate collateral based on best available price or oracle price
        (uint256 oraclePrice,) = forwardMarket.oracle().getPrice(market.baseAsset);
        uint256 collateral = amount * oraclePrice * 2 / MathLib.PRICE_PRECISION
            * MathLib.COLLATERAL_PRECISION * MathLib.PERCENT_BASE / market.ltv;
        if (collateral < market.minCollateral) collateral = market.minCollateral;

        collateralToken.safeTransferFrom(msg.sender, address(this), collateral);

        uint256 orderId = _nextOrderId++;
        orders[orderId] = OrderLib.Order({
            id: orderId,
            trader: msg.sender,
            marketId: marketId,
            side: side,
            price: price,
            amount: amount,
            filled: 0,
            collateral: collateral,
            timestamp: block.timestamp,
            status: OrderLib.OrderStatus.OPEN
        });

        userOrderIds[msg.sender].push(orderId);
        emit OrderPlaced(orderId, msg.sender, marketId, side, price, amount, collateral);

        // Match immediately
        _matchOrder(orderId);

        // Refund unused collateral for market orders
        OrderLib.Order storage order = orders[orderId];
        if (order.filled < order.amount) {
            // Partially filled or unfilled - refund proportional collateral
            uint256 usedCollateral = order.collateral * order.filled / order.amount;
            uint256 refund = order.collateral - usedCollateral;
            order.collateral = usedCollateral;
            if (refund > 0) {
                collateralToken.safeTransfer(msg.sender, refund);
            }
            if (order.filled == 0) {
                order.status = OrderLib.OrderStatus.CANCELLED;
            } else {
                order.status = OrderLib.OrderStatus.PARTIALLY_FILLED;
            }
        }
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        OrderLib.Order storage order = orders[orderId];
        require(order.trader == msg.sender, "OrderBook: not your order");
        require(
            order.status == OrderLib.OrderStatus.OPEN || order.status == OrderLib.OrderStatus.PARTIALLY_FILLED,
            "OrderBook: cannot cancel"
        );

        // Refund remaining collateral
        uint256 usedCollateral = order.amount > 0 ? order.collateral * order.filled / order.amount : 0;
        uint256 refund = order.collateral - usedCollateral;
        order.collateral = usedCollateral;
        order.status = OrderLib.OrderStatus.CANCELLED;

        if (refund > 0) {
            collateralToken.safeTransfer(msg.sender, refund);
        }

        // Remove from order book arrays
        _removeFromBook(order.marketId, order.side, orderId);

        emit OrderCancelled(orderId, msg.sender);
    }

    function _matchOrder(uint256 incomingOrderId) internal {
        OrderLib.Order storage incoming = orders[incomingOrderId];
        uint256 marketId = incoming.marketId;
        bool isLong = incoming.side == OrderLib.Side.LONG;

        uint256[] storage oppositeIds = isLong ? askOrderIds[marketId] : bidOrderIds[marketId];

        uint256 remaining = incoming.amount - incoming.filled;

        for (uint256 i = 0; remaining > 0 && i < oppositeIds.length; i++) {
            uint256 restingId = oppositeIds[i];
            OrderLib.Order storage resting = orders[restingId];

            if (resting.status != OrderLib.OrderStatus.OPEN && resting.status != OrderLib.OrderStatus.PARTIALLY_FILLED) {
                continue;
            }

            // Check price crossing
            if (isLong ? incoming.price < resting.price : incoming.price > resting.price) {
                continue;
            }

            uint256 matchAmount = MathLib.min(remaining, resting.amount - resting.filled);
            remaining -= matchAmount;

            _executeMatch(incomingOrderId, restingId, resting.price, matchAmount, isLong);
        }

        // Clean up filled orders from book
        _cleanBook(marketId, isLong ? OrderLib.Side.SHORT : OrderLib.Side.LONG);
    }

    function _executeMatch(
        uint256 incomingId,
        uint256 restingId,
        uint256 matchPrice,
        uint256 matchAmount,
        bool incomingIsLong
    ) internal {
        uint256 longId = incomingIsLong ? incomingId : restingId;
        uint256 shortId = incomingIsLong ? restingId : incomingId;

        // Calculate collateral proportional to fill
        uint256 longCollat = orders[longId].collateral * matchAmount / (orders[longId].amount - orders[longId].filled);
        uint256 shortCollat = orders[shortId].collateral * matchAmount / (orders[shortId].amount - orders[shortId].filled);

        // Deduct taker fee from incoming order's collateral
        uint256 takerFee = _deductFee(incomingId, incomingIsLong ? longCollat : shortCollat);
        if (incomingIsLong) {
            longCollat -= takerFee;
        } else {
            shortCollat -= takerFee;
        }

        // Open positions & transfer collateral
        {
            uint256 mktId = orders[longId].marketId;
            positionManager.openPosition(mktId, orders[longId].trader, OrderLib.Side.LONG, matchPrice, matchAmount, longCollat);
            positionManager.openPosition(mktId, orders[shortId].trader, OrderLib.Side.SHORT, matchPrice, matchAmount, shortCollat);
            collateralToken.safeTransfer(address(positionManager), longCollat + shortCollat);
        }

        // Update fill amounts and collateral (use gross collateral for accounting)
        orders[incomingId].filled += matchAmount;
        orders[restingId].filled += matchAmount;
        orders[longId].collateral -= (longCollat + (incomingIsLong ? takerFee : 0));
        orders[shortId].collateral -= (shortCollat + (incomingIsLong ? 0 : takerFee));

        _updateOrderStatus(incomingId);
        _updateOrderStatus(restingId);

        emit OrderMatched(longId, shortId, matchPrice, matchAmount, 0, 0, takerFee);
    }

    function _deductFee(uint256 orderId, uint256 collat) internal returns (uint256 fee) {
        if (takerFeeBps == 0) return 0;
        fee = collat * takerFeeBps / 10000;
        if (fee > 0) {
            collateralToken.safeTransfer(feeCollector, fee);
            totalFeesCollected += fee;
            emit FeesCollected(orderId, fee);
        }
    }

    function _updateOrderStatus(uint256 orderId) internal {
        OrderLib.Order storage o = orders[orderId];
        if (o.filled == o.amount) {
            o.status = OrderLib.OrderStatus.FILLED;
        } else if (o.filled > 0) {
            o.status = OrderLib.OrderStatus.PARTIALLY_FILLED;
        }
    }

    function _removeFromBook(uint256 marketId, OrderLib.Side side, uint256 orderId) internal {
        uint256[] storage ids = side == OrderLib.Side.LONG ? bidOrderIds[marketId] : askOrderIds[marketId];
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == orderId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                return;
            }
        }
    }

    function _cleanBook(uint256 marketId, OrderLib.Side side) internal {
        uint256[] storage ids = side == OrderLib.Side.LONG ? bidOrderIds[marketId] : askOrderIds[marketId];
        uint256 i = 0;
        while (i < ids.length) {
            if (orders[ids[i]].status == OrderLib.OrderStatus.FILLED) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
            } else {
                i++;
            }
        }
    }

    function getOrderBook(uint256 marketId)
        external
        view
        returns (OrderLib.Order[] memory bids, OrderLib.Order[] memory asks)
    {
        // Count open bids
        uint256 bidCount = 0;
        for (uint256 i = 0; i < bidOrderIds[marketId].length; i++) {
            OrderLib.Order storage o = orders[bidOrderIds[marketId][i]];
            if (o.status == OrderLib.OrderStatus.OPEN || o.status == OrderLib.OrderStatus.PARTIALLY_FILLED) {
                bidCount++;
            }
        }

        // Count open asks
        uint256 askCount = 0;
        for (uint256 i = 0; i < askOrderIds[marketId].length; i++) {
            OrderLib.Order storage o = orders[askOrderIds[marketId][i]];
            if (o.status == OrderLib.OrderStatus.OPEN || o.status == OrderLib.OrderStatus.PARTIALLY_FILLED) {
                askCount++;
            }
        }

        bids = new OrderLib.Order[](bidCount);
        asks = new OrderLib.Order[](askCount);

        uint256 idx = 0;
        for (uint256 i = 0; i < bidOrderIds[marketId].length; i++) {
            OrderLib.Order storage o = orders[bidOrderIds[marketId][i]];
            if (o.status == OrderLib.OrderStatus.OPEN || o.status == OrderLib.OrderStatus.PARTIALLY_FILLED) {
                bids[idx++] = o;
            }
        }

        idx = 0;
        for (uint256 i = 0; i < askOrderIds[marketId].length; i++) {
            OrderLib.Order storage o = orders[askOrderIds[marketId][i]];
            if (o.status == OrderLib.OrderStatus.OPEN || o.status == OrderLib.OrderStatus.PARTIALLY_FILLED) {
                asks[idx++] = o;
            }
        }
    }

    function getOrder(uint256 orderId) external view returns (OrderLib.Order memory) {
        require(orders[orderId].id != 0, "OrderBook: order not found");
        return orders[orderId];
    }

    function getUserOrders(address user) external view returns (OrderLib.Order[] memory) {
        uint256[] storage ids = userOrderIds[user];
        OrderLib.Order[] memory result = new OrderLib.Order[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = orders[ids[i]];
        }
        return result;
    }
}
