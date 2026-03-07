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

    // Multi-collateral support
    mapping(address => bool) public supportedCollateral;
    address[] public supportedTokenList;
    mapping(uint256 => address) public orderCollateral; // orderId → token used

    address public owner;

    // ─── Fee Configuration ───────────────────────────────────────
    address public feeCollector;
    uint256 public takerFeeBps;        // e.g. 5 = 0.05%
    uint256 public makerFeeBps;        // maker rebate bps (paid TO maker)
    bool public makerRebateEnabled;

    // Fee split (must sum to 10000)
    uint256 public protocolFeeBps;     // e.g. 3000 = 30% of net fees → feeCollector
    uint256 public insuranceFeeBps;    // e.g. 1000 = 10% of net fees → insuranceFund
    // remainder (10000 - protocol - insurance) → lpVault

    address public insuranceFund;
    address public lpVault;

    // Builder code system (Hyperliquid-inspired)
    mapping(address => address) public builderOf;    // trader → builder
    mapping(address => uint256) public builderFeeBps; // builder → bps of taker fee
    mapping(address => bool) public registeredBuilder;

    // Fee tracking
    uint256 public totalFeesCollected;
    uint256 public totalProtocolFees;
    uint256 public totalInsuranceFees;
    uint256 public totalBuilderFees;
    uint256 public totalMakerRebates;

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
    event FeesDistributed(
        uint256 indexed orderId,
        uint256 takerFee,
        uint256 makerRebate,
        uint256 protocolFee,
        uint256 insuranceFee,
        uint256 builderFee,
        uint256 lpFee
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "OrderBook: not owner");
        _;
    }

    constructor(address _forwardMarket, address _feeCollector, uint256 _takerFeeBps) {
        require(_takerFeeBps <= 1000, "OrderBook: fee too high"); // max 10%
        forwardMarket = ForwardMarket(_forwardMarket);
        owner = msg.sender;
        feeCollector = _feeCollector;
        takerFeeBps = _takerFeeBps;

        // Default fee split: 30% protocol, 10% insurance, 60% LP
        protocolFeeBps = 3000;
        insuranceFeeBps = 1000;
    }

    function addSupportedCollateral(address token) external onlyOwner {
        require(!supportedCollateral[token], "OrderBook: already supported");
        supportedCollateral[token] = true;
        supportedTokenList.push(token);
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokenList;
    }

    // ─── Admin: Fee Configuration ────────────────────────────────

    function setTakerFee(uint256 _newBps) external onlyOwner {
        require(_newBps <= 1000, "OrderBook: fee too high");
        takerFeeBps = _newBps;
    }

    function setMakerFee(uint256 _newBps, bool _rebateEnabled) external onlyOwner {
        require(_newBps <= 500, "OrderBook: maker fee too high");
        makerFeeBps = _newBps;
        makerRebateEnabled = _rebateEnabled;
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "OrderBook: zero address");
        feeCollector = _feeCollector;
    }

    function setFeeSplit(uint256 _protocolBps, uint256 _insuranceBps) external onlyOwner {
        require(_protocolBps + _insuranceBps <= 10000, "OrderBook: split exceeds 100%");
        protocolFeeBps = _protocolBps;
        insuranceFeeBps = _insuranceBps;
    }

    function setInsuranceFund(address _fund) external onlyOwner {
        insuranceFund = _fund;
    }

    function setLPVault(address _vault) external onlyOwner {
        lpVault = _vault;
    }

    function registerBuilder(address _builder, uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 5000, "OrderBook: builder fee too high"); // max 50% of taker fee
        registeredBuilder[_builder] = true;
        builderFeeBps[_builder] = _feeBps;
    }

    function setBuilderForTrader(address _trader, address _builder) external {
        require(msg.sender == _trader || msg.sender == owner, "OrderBook: not authorized");
        require(registeredBuilder[_builder] || _builder == address(0), "OrderBook: builder not registered");
        builderOf[_trader] = _builder;
    }

    function setPositionManager(address _positionManager) external onlyOwner {
        require(address(positionManager) == address(0), "OrderBook: already set");
        positionManager = PositionManager(_positionManager);
    }

    // ─── Order Placement ─────────────────────────────────────────

    function placeLimitOrder(
        uint256 marketId,
        OrderLib.Side side,
        uint256 price,
        uint256 amount,
        address token
    ) external nonReentrant {
        _placeLimitOrderInternal(marketId, side, price, amount, OrderLib.TimeInForce.GTC, token);
    }

    function placeLimitOrderAdvanced(
        uint256 marketId,
        OrderLib.Side side,
        uint256 price,
        uint256 amount,
        OrderLib.TimeInForce tif,
        address token
    ) external nonReentrant {
        _placeLimitOrderInternal(marketId, side, price, amount, tif, token);
    }

    function _placeLimitOrderInternal(
        uint256 marketId,
        OrderLib.Side side,
        uint256 price,
        uint256 amount,
        OrderLib.TimeInForce tif,
        address token
    ) internal {
        require(supportedCollateral[token], "OrderBook: unsupported collateral");
        OrderLib.MarketInfo memory market = forwardMarket.getMarket(marketId);
        require(!market.settled, "OrderBook: market settled");
        require(block.timestamp < market.expiration, "OrderBook: market expired");
        require(price > 0, "OrderBook: invalid price");
        require(amount > 0, "OrderBook: invalid amount");

        // POST_ONLY: revert if order would match
        if (tif == OrderLib.TimeInForce.POST_ONLY) {
            require(!_wouldMatch(marketId, side, price), "OrderBook: would match (post-only)");
        }

        // FOK: pre-check available liquidity
        if (tif == OrderLib.TimeInForce.FOK) {
            uint256 available = _checkAvailableLiquidity(marketId, side, price);
            require(available >= amount, "OrderBook: insufficient liquidity (FOK)");
        }

        // Calculate required collateral
        uint256 collateral = amount * price / MathLib.PRICE_PRECISION
            * MathLib.COLLATERAL_PRECISION * MathLib.PERCENT_BASE / market.ltv;
        require(collateral >= market.minCollateral, "OrderBook: below min collateral");

        // Transfer collateral from trader
        IERC20(token).safeTransferFrom(msg.sender, address(this), collateral);

        uint256 orderId = _nextOrderId++;
        orderCollateral[orderId] = token;
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
            status: OrderLib.OrderStatus.OPEN,
            timeInForce: tif
        });

        userOrderIds[msg.sender].push(orderId);

        emit OrderPlaced(orderId, msg.sender, marketId, side, price, amount, collateral);

        // Try to match against opposite side
        _matchOrder(orderId);

        OrderLib.Order storage order = orders[orderId];

        // Handle IOC: cancel remaining unfilled portion
        if (tif == OrderLib.TimeInForce.IOC && order.filled < order.amount) {
            uint256 usedCollateral = order.amount > 0 ? order.collateral * order.filled / order.amount : 0;
            uint256 refund = order.collateral - usedCollateral;
            order.collateral = usedCollateral;
            if (order.filled == 0) {
                order.status = OrderLib.OrderStatus.CANCELLED;
            } else {
                order.status = OrderLib.OrderStatus.FILLED;
            }
            if (refund > 0) {
                IERC20(token).safeTransfer(msg.sender, refund);
            }
            return; // Don't add to book
        }

        // If order still has remaining amount, add to book (GTC and POST_ONLY)
        if (order.filled < order.amount) {
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
        uint256 amount,
        address token
    ) external nonReentrant {
        require(supportedCollateral[token], "OrderBook: unsupported collateral");
        OrderLib.MarketInfo memory market = forwardMarket.getMarket(marketId);
        require(!market.settled, "OrderBook: market settled");
        require(block.timestamp < market.expiration, "OrderBook: market expired");
        require(amount > 0, "OrderBook: invalid amount");

        // For market orders, use a very high/low price to ensure execution
        uint256 price;
        if (side == OrderLib.Side.LONG) {
            price = type(uint256).max / 2;
        } else {
            price = 1;
        }

        // Calculate collateral based on best available price or oracle price
        (uint256 oraclePrice,) = forwardMarket.oracle().getPrice(market.baseAsset);
        uint256 collateral = amount * oraclePrice * 2 / MathLib.PRICE_PRECISION
            * MathLib.COLLATERAL_PRECISION * MathLib.PERCENT_BASE / market.ltv;
        if (collateral < market.minCollateral) collateral = market.minCollateral;

        IERC20(token).safeTransferFrom(msg.sender, address(this), collateral);

        uint256 orderId = _nextOrderId++;
        orderCollateral[orderId] = token;
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
            status: OrderLib.OrderStatus.OPEN,
            timeInForce: OrderLib.TimeInForce.IOC
        });

        userOrderIds[msg.sender].push(orderId);
        emit OrderPlaced(orderId, msg.sender, marketId, side, price, amount, collateral);

        // Match immediately
        _matchOrder(orderId);

        // Refund unused collateral for market orders
        OrderLib.Order storage order = orders[orderId];
        if (order.filled < order.amount) {
            uint256 usedCollateral = order.collateral * order.filled / order.amount;
            uint256 refund = order.collateral - usedCollateral;
            order.collateral = usedCollateral;
            if (refund > 0) {
                IERC20(token).safeTransfer(msg.sender, refund);
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
            IERC20(orderCollateral[orderId]).safeTransfer(msg.sender, refund);
        }

        // Remove from order book arrays
        _removeFromBook(order.marketId, order.side, orderId);

        emit OrderCancelled(orderId, msg.sender);
    }

    // ─── Matching Engine ─────────────────────────────────────────

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

        // Process fees (taker = incoming, maker = resting)
        uint256 takerCollat = incomingIsLong ? longCollat : shortCollat;
        (uint256 netTakerFee, uint256 makerRebate) = _processFees(incomingId, restingId, takerCollat);

        if (incomingIsLong) {
            longCollat -= netTakerFee;
        } else {
            shortCollat -= netTakerFee;
        }

        // Maker rebate: add to resting order's collateral going to position
        if (makerRebate > 0) {
            if (incomingIsLong) {
                shortCollat += makerRebate;
            } else {
                longCollat += makerRebate;
            }
        }

        // Open positions & transfer collateral
        _openMatchedPositions(longId, shortId, matchPrice, matchAmount, longCollat, shortCollat);

        // Update fill amounts
        orders[incomingId].filled += matchAmount;
        orders[restingId].filled += matchAmount;

        // Update collateral: deduct what was used for this match
        _updateMatchedCollateral(incomingId, restingId, longCollat, shortCollat, netTakerFee, makerRebate, incomingIsLong);

        _updateOrderStatus(incomingId);
        _updateOrderStatus(restingId);

        emit OrderMatched(longId, shortId, matchPrice, matchAmount, 0, 0, netTakerFee);
    }

    function _openMatchedPositions(
        uint256 longId,
        uint256 shortId,
        uint256 matchPrice,
        uint256 matchAmount,
        uint256 longCollat,
        uint256 shortCollat
    ) internal {
        uint256 mktId = orders[longId].marketId;
        address longToken = orderCollateral[longId];
        address shortToken = orderCollateral[shortId];
        positionManager.openPosition(mktId, orders[longId].trader, OrderLib.Side.LONG, matchPrice, matchAmount, longCollat, longToken);
        positionManager.openPosition(mktId, orders[shortId].trader, OrderLib.Side.SHORT, matchPrice, matchAmount, shortCollat, shortToken);
        IERC20(longToken).safeTransfer(address(positionManager), longCollat);
        IERC20(shortToken).safeTransfer(address(positionManager), shortCollat);
    }

    function _updateMatchedCollateral(
        uint256 incomingId,
        uint256 restingId,
        uint256 longCollat,
        uint256 shortCollat,
        uint256 netTakerFee,
        uint256 makerRebate,
        bool incomingIsLong
    ) internal {
        if (incomingIsLong) {
            orders[incomingId].collateral -= (longCollat + netTakerFee);
            orders[restingId].collateral -= (shortCollat - makerRebate);
        } else {
            orders[incomingId].collateral -= (shortCollat + netTakerFee);
            orders[restingId].collateral -= (longCollat - makerRebate);
        }
    }

    // ─── Fee Processing ──────────────────────────────────────────

    function _processFees(
        uint256 takerId,
        uint256 /* makerId */,
        uint256 takerCollat
    ) internal returns (uint256 netTakerFee, uint256 makerRebate) {
        IERC20 feeToken = IERC20(orderCollateral[takerId]);
        if (takerFeeBps == 0) return (0, 0);

        // 1. Calculate taker fee
        uint256 grossTakerFee = takerCollat * takerFeeBps / 10000;

        // 2. Calculate maker rebate
        makerRebate = 0;
        if (makerRebateEnabled && makerFeeBps > 0) {
            makerRebate = takerCollat * makerFeeBps / 10000;
            if (makerRebate > grossTakerFee) makerRebate = grossTakerFee;
        }

        // 3. Net fee to distribute
        uint256 netFee = grossTakerFee - makerRebate;
        netTakerFee = grossTakerFee; // Total deducted from taker (includes rebate portion)

        if (netFee == 0) {
            totalMakerRebates += makerRebate;
            totalFeesCollected += grossTakerFee;
            return (netTakerFee, makerRebate);
        }

        // 4. Builder fee (portion of net fee)
        uint256 builderFee = 0;
        address builder = builderOf[orders[takerId].trader];
        if (builder != address(0) && registeredBuilder[builder] && builderFeeBps[builder] > 0) {
            builderFee = netFee * builderFeeBps[builder] / 10000;
            if (builderFee > 0) {
                feeToken.safeTransfer(builder, builderFee);
                totalBuilderFees += builderFee;
            }
        }

        uint256 remaining = netFee - builderFee;

        // 5. Split remaining: protocol / insurance / LP
        uint256 protocolFee = remaining * protocolFeeBps / 10000;
        uint256 insurFee = remaining * insuranceFeeBps / 10000;
        uint256 lpFee = remaining - protocolFee - insurFee;

        // All fees fall back to feeCollector if specific destination not set
        if (protocolFee > 0) {
            if (feeCollector != address(0)) {
                feeToken.safeTransfer(feeCollector, protocolFee);
            }
            totalProtocolFees += protocolFee;
        }
        if (insurFee > 0) {
            address insurDest = insuranceFund != address(0) ? insuranceFund : feeCollector;
            if (insurDest != address(0)) {
                feeToken.safeTransfer(insurDest, insurFee);
            }
            totalInsuranceFees += insurFee;
        }
        if (lpFee > 0) {
            address lpDest = lpVault != address(0) ? lpVault : feeCollector;
            if (lpDest != address(0)) {
                feeToken.safeTransfer(lpDest, lpFee);
            }
        }

        totalFeesCollected += grossTakerFee;
        totalMakerRebates += makerRebate;

        emit FeesDistributed(takerId, grossTakerFee, makerRebate, protocolFee, insurFee, builderFee, lpFee);

        return (netTakerFee, makerRebate);
    }

    // ─── Advanced Order Helpers ──────────────────────────────────

    function _wouldMatch(uint256 marketId, OrderLib.Side side, uint256 price) internal view returns (bool) {
        bool isLong = side == OrderLib.Side.LONG;
        uint256[] storage oppositeIds = isLong ? askOrderIds[marketId] : bidOrderIds[marketId];

        for (uint256 i = 0; i < oppositeIds.length; i++) {
            OrderLib.Order storage resting = orders[oppositeIds[i]];
            if (resting.status != OrderLib.OrderStatus.OPEN && resting.status != OrderLib.OrderStatus.PARTIALLY_FILLED) {
                continue;
            }
            if (isLong ? price >= resting.price : price <= resting.price) {
                return true;
            }
        }
        return false;
    }

    function _checkAvailableLiquidity(uint256 marketId, OrderLib.Side side, uint256 price) internal view returns (uint256) {
        bool isLong = side == OrderLib.Side.LONG;
        uint256[] storage oppositeIds = isLong ? askOrderIds[marketId] : bidOrderIds[marketId];
        uint256 total = 0;

        for (uint256 i = 0; i < oppositeIds.length; i++) {
            OrderLib.Order storage resting = orders[oppositeIds[i]];
            if (resting.status != OrderLib.OrderStatus.OPEN && resting.status != OrderLib.OrderStatus.PARTIALLY_FILLED) {
                continue;
            }
            if (isLong ? price >= resting.price : price <= resting.price) {
                total += resting.amount - resting.filled;
            }
        }
        return total;
    }

    // ─── Internal Helpers ────────────────────────────────────────

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

    // ─── View Functions ──────────────────────────────────────────

    function getOrderBook(uint256 marketId)
        external
        view
        returns (OrderLib.Order[] memory bids, OrderLib.Order[] memory asks)
    {
        uint256 bidCount = 0;
        for (uint256 i = 0; i < bidOrderIds[marketId].length; i++) {
            OrderLib.Order storage o = orders[bidOrderIds[marketId][i]];
            if (o.status == OrderLib.OrderStatus.OPEN || o.status == OrderLib.OrderStatus.PARTIALLY_FILLED) {
                bidCount++;
            }
        }

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

    function getFeeConfig() external view returns (
        uint256 _takerFeeBps,
        uint256 _makerFeeBps,
        bool _makerRebateEnabled,
        uint256 _protocolFeeBps,
        uint256 _insuranceFeeBps,
        uint256 _lpFeeBps
    ) {
        uint256 lpBps = 10000 - protocolFeeBps - insuranceFeeBps;
        return (takerFeeBps, makerFeeBps, makerRebateEnabled, protocolFeeBps, insuranceFeeBps, lpBps);
    }

    function getFeeTotals() external view returns (
        uint256 _totalFeesCollected,
        uint256 _totalProtocolFees,
        uint256 _totalInsuranceFees,
        uint256 _totalBuilderFees,
        uint256 _totalMakerRebates
    ) {
        return (totalFeesCollected, totalProtocolFees, totalInsuranceFees, totalBuilderFees, totalMakerRebates);
    }
}
