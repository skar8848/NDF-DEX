// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ForwardMarket} from "../src/core/ForwardMarket.sol";
import {OrderBook} from "../src/core/OrderBook.sol";
import {PositionManager} from "../src/core/PositionManager.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";
import {OrderLib} from "../src/libraries/OrderLib.sol";

contract OrderBookTest is Test {
    ForwardMarket public forwardMarket;
    OrderBook public orderBook;
    PositionManager public positionManager;
    MockOracle public oracle;
    MockUSDC public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    uint256 public marketId;

    function setUp() public {
        oracle = new MockOracle();
        usdc = new MockUSDC();
        forwardMarket = new ForwardMarket(address(oracle));
        orderBook = new OrderBook(address(forwardMarket), address(usdc), address(this), 10);
        positionManager = new PositionManager(
            address(forwardMarket), address(oracle), address(usdc), address(orderBook)
        );
        orderBook.setPositionManager(address(positionManager));
        forwardMarket.setAuthorized(address(orderBook), true);
        forwardMarket.setAuthorized(address(positionManager), true);

        // Create a market
        marketId = forwardMarket.createMarket("ETH", "USDC", block.timestamp + 30 days, 5000, 8000, 10e6);

        // Fund users
        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);

        // Approve
        vm.prank(alice);
        usdc.approve(address(orderBook), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(orderBook), type(uint256).max);
    }

    function test_placeLimitOrder() public {
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);

        // Check order exists
        OrderLib.Order memory order = orderBook.getOrder(1);
        assertEq(order.trader, alice);
        assertEq(order.price, 2500e8);
        assertEq(order.amount, 1);
        assertEq(order.filled, 0);
        assertTrue(order.side == OrderLib.Side.LONG);
    }

    function test_matchOrders() public {
        // Alice places a LONG limit order
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);

        // Bob places a SHORT limit order at the same price -> should match
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        // Both orders should be filled
        OrderLib.Order memory aliceOrder = orderBook.getOrder(1);
        OrderLib.Order memory bobOrder = orderBook.getOrder(2);
        assertEq(aliceOrder.filled, 1);
        assertEq(bobOrder.filled, 1);
        assertTrue(aliceOrder.status == OrderLib.OrderStatus.FILLED);
        assertTrue(bobOrder.status == OrderLib.OrderStatus.FILLED);

        // Positions should exist
        OrderLib.PositionInfo[] memory alicePositions = positionManager.getUserPositions(alice);
        assertEq(alicePositions.length, 1);
        assertTrue(alicePositions[0].side == OrderLib.Side.LONG);

        OrderLib.PositionInfo[] memory bobPositions = positionManager.getUserPositions(bob);
        assertEq(bobPositions.length, 1);
        assertTrue(bobPositions[0].side == OrderLib.Side.SHORT);
    }

    function test_partialFill() public {
        // Alice wants 3 contracts
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 3);

        // Bob only offers 1
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        OrderLib.Order memory aliceOrder = orderBook.getOrder(1);
        OrderLib.Order memory bobOrder = orderBook.getOrder(2);

        assertEq(aliceOrder.filled, 1);
        assertEq(aliceOrder.amount, 3);
        assertTrue(aliceOrder.status == OrderLib.OrderStatus.PARTIALLY_FILLED);
        assertTrue(bobOrder.status == OrderLib.OrderStatus.FILLED);
    }

    function test_cancelOrder() public {
        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);

        uint256 balanceAfterOrder = usdc.balanceOf(alice);
        assertTrue(balanceAfterOrder < balanceBefore); // collateral taken

        vm.prank(alice);
        orderBook.cancelOrder(1);

        OrderLib.Order memory order = orderBook.getOrder(1);
        assertTrue(order.status == OrderLib.OrderStatus.CANCELLED);

        // Collateral returned
        uint256 balanceAfterCancel = usdc.balanceOf(alice);
        assertEq(balanceAfterCancel, balanceBefore);
    }

    function test_orderBookView() public {
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);

        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2600e8, 2);

        (OrderLib.Order[] memory bids, OrderLib.Order[] memory asks) = orderBook.getOrderBook(marketId);
        assertEq(bids.length, 1);
        assertEq(asks.length, 1);
        assertEq(bids[0].price, 2500e8);
        assertEq(asks[0].price, 2600e8);
    }

    function test_noMatchDifferentPrices() public {
        // Long at 2400, Short at 2600 => no cross
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2400e8, 1);

        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2600e8, 1);

        OrderLib.Order memory aliceOrder = orderBook.getOrder(1);
        OrderLib.Order memory bobOrder = orderBook.getOrder(2);

        assertEq(aliceOrder.filled, 0);
        assertEq(bobOrder.filled, 0);
    }

    function test_priceCrossing() public {
        // Short resting at 2400
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2400e8, 1);

        // Long incoming at 2500 (willing to pay more) -> crosses at 2400 (resting price)
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);

        OrderLib.Order memory longOrder = orderBook.getOrder(2);
        assertEq(longOrder.filled, 1);

        // Position should be opened at resting price (2400)
        OrderLib.PositionInfo[] memory positions = positionManager.getUserPositions(alice);
        assertEq(positions[0].entryPrice, 2400e8);
    }
}
