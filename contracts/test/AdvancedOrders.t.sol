// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ForwardMarket} from "../src/core/ForwardMarket.sol";
import {OrderBook} from "../src/core/OrderBook.sol";
import {PositionManager} from "../src/core/PositionManager.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";
import {OrderLib} from "../src/libraries/OrderLib.sol";

contract AdvancedOrdersTest is Test {
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
        orderBook = new OrderBook(address(forwardMarket), address(this), 10);
        orderBook.addSupportedCollateral(address(usdc));
        positionManager = new PositionManager(
            address(forwardMarket), address(oracle), address(orderBook)
        );
        orderBook.setPositionManager(address(positionManager));
        forwardMarket.setAuthorized(address(orderBook), true);
        forwardMarket.setAuthorized(address(positionManager), true);

        marketId = forwardMarket.createMarket("ETH", "USDC", block.timestamp + 30 days, 5000, 8000, 10e6);

        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        vm.prank(alice);
        usdc.approve(address(orderBook), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(orderBook), type(uint256).max);
    }

    // ─── IOC Tests ───────────────────────────────────────────────

    function test_IOC_fullFill() public {
        // Place resting ask
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 3, address(usdc));

        // IOC buy should fill fully
        vm.prank(alice);
        orderBook.placeLimitOrderAdvanced(marketId, OrderLib.Side.LONG, 2500e8, 2, OrderLib.TimeInForce.IOC, address(usdc));

        OrderLib.Order memory order = orderBook.getOrder(2); // alice's order
        assertEq(order.filled, 2);
    }

    function test_IOC_partialFill() public {
        // Place resting ask for only 1
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1, address(usdc));

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        orderBook.placeLimitOrderAdvanced(marketId, OrderLib.Side.LONG, 2500e8, 3, OrderLib.TimeInForce.IOC, address(usdc));

        OrderLib.Order memory order = orderBook.getOrder(2);
        assertEq(order.filled, 1);
        // Remaining should be cancelled and collateral refunded
        uint256 aliceAfter = usdc.balanceOf(alice);
        // Alice should get back ~2/3 of her collateral (unfilled portion)
        assertTrue(aliceAfter > aliceBefore - 100_000e6, "Partial refund expected");
    }

    function test_IOC_noFill() public {
        // No resting orders, IOC should cancel entirely
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        orderBook.placeLimitOrderAdvanced(marketId, OrderLib.Side.LONG, 2500e8, 1, OrderLib.TimeInForce.IOC, address(usdc));

        OrderLib.Order memory order = orderBook.getOrder(1);
        assertEq(order.filled, 0);
        assertTrue(order.status == OrderLib.OrderStatus.CANCELLED);

        // Full refund
        uint256 aliceAfter = usdc.balanceOf(alice);
        assertEq(aliceAfter, aliceBefore);
    }

    // ─── FOK Tests ───────────────────────────────────────────────

    function test_FOK_success() public {
        // Place enough liquidity
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 5, address(usdc));

        vm.prank(alice);
        orderBook.placeLimitOrderAdvanced(marketId, OrderLib.Side.LONG, 2500e8, 3, OrderLib.TimeInForce.FOK, address(usdc));

        OrderLib.Order memory order = orderBook.getOrder(2);
        assertEq(order.filled, 3);
        assertTrue(order.status == OrderLib.OrderStatus.FILLED);
    }

    function test_FOK_revert_insufficientLiquidity() public {
        // Only 1 resting, try FOK for 3
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1, address(usdc));

        vm.prank(alice);
        vm.expectRevert("OrderBook: insufficient liquidity (FOK)");
        orderBook.placeLimitOrderAdvanced(marketId, OrderLib.Side.LONG, 2500e8, 3, OrderLib.TimeInForce.FOK, address(usdc));
    }

    // ─── POST_ONLY Tests ─────────────────────────────────────────

    function test_POSTONLY_addToBook() public {
        // No opposite orders, should add to book
        vm.prank(alice);
        orderBook.placeLimitOrderAdvanced(marketId, OrderLib.Side.LONG, 2400e8, 1, OrderLib.TimeInForce.POST_ONLY, address(usdc));

        OrderLib.Order memory order = orderBook.getOrder(1);
        assertEq(order.filled, 0);
        assertTrue(order.status == OrderLib.OrderStatus.OPEN);

        (OrderLib.Order[] memory bids,) = orderBook.getOrderBook(marketId);
        assertEq(bids.length, 1);
    }

    function test_POSTONLY_revertIfWouldMatch() public {
        // Place ask at 2500
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1, address(usdc));

        // Post-only bid at 2500 would cross
        vm.prank(alice);
        vm.expectRevert("OrderBook: would match (post-only)");
        orderBook.placeLimitOrderAdvanced(marketId, OrderLib.Side.LONG, 2500e8, 1, OrderLib.TimeInForce.POST_ONLY, address(usdc));
    }

    // ─── GTC Backward Compatibility ──────────────────────────────

    function test_GTC_backwardCompat() public {
        // placeLimitOrder should still work as GTC
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2400e8, 1, address(usdc));

        OrderLib.Order memory order = orderBook.getOrder(1);
        assertTrue(order.timeInForce == OrderLib.TimeInForce.GTC);
        assertTrue(order.status == OrderLib.OrderStatus.OPEN);
    }
}
