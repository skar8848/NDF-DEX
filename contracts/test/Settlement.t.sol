// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ForwardMarket} from "../src/core/ForwardMarket.sol";
import {OrderBook} from "../src/core/OrderBook.sol";
import {PositionManager} from "../src/core/PositionManager.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";
import {OrderLib} from "../src/libraries/OrderLib.sol";

contract SettlementTest is Test {
    ForwardMarket public forwardMarket;
    OrderBook public orderBook;
    PositionManager public positionManager;
    MockOracle public oracle;
    MockUSDC public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    uint256 public marketId;
    uint256 public expiry;

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

        expiry = block.timestamp + 30 days;
        marketId = forwardMarket.createMarket("ETH", "USDC", expiry, 5000, 8000, 10e6);

        // Fund and approve
        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        vm.prank(alice);
        usdc.approve(address(orderBook), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(orderBook), type(uint256).max);
    }

    function test_settlementProfitLong() public {
        // Entry at 2500, settle at 3000 → long profits
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        // Warp to expiry and settle
        vm.warp(expiry + 1);
        oracle.setPrice("ETH", 3000e8);
        forwardMarket.settleMarket(marketId);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);

        // Settle alice's position (long)
        positionManager.settlePosition(1);
        // Settle bob's position (short)
        positionManager.settlePosition(2);

        uint256 aliceAfter = usdc.balanceOf(alice);
        uint256 bobAfter = usdc.balanceOf(bob);

        // Alice (long) should profit: (3000-2500)*1 = 500 USDC worth
        assertTrue(aliceAfter > aliceBefore);
        // Bob (short) should lose
        // Bob still gets back some collateral (collateral - loss)
    }

    function test_settlementProfitShort() public {
        // Entry at 2500, settle at 2000 → short profits
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        vm.warp(expiry + 1);
        oracle.setPrice("ETH", 2000e8);
        forwardMarket.settleMarket(marketId);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);

        positionManager.settlePosition(1);
        positionManager.settlePosition(2);

        uint256 aliceAfter = usdc.balanceOf(alice);
        uint256 bobAfter = usdc.balanceOf(bob);

        // Bob (short) should profit
        assertTrue(bobAfter > bobBefore);
    }

    function test_revert_settleBeforeMarketSettled() public {
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        vm.expectRevert("PositionManager: market not settled");
        positionManager.settlePosition(1);
    }

    function test_liquidation() public {
        // Create a high-leverage market (90% LTV, 90% liq threshold)
        uint256 leveragedMarketId =
            forwardMarket.createMarket("ETH", "USDC", expiry, 9000, 9000, 1e6);

        vm.prank(alice);
        orderBook.placeLimitOrder(leveragedMarketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(leveragedMarketId, OrderLib.Side.SHORT, 2500e8, 1);

        // Price drops significantly → long position becomes liquidatable
        // Collateral ≈ $2778, maintenance margin = $2250
        // At price $200, loss = $2300, equity = $478 < $2250
        oracle.setPrice("ETH", 200e8);

        // Anyone can liquidate
        address liquidator = address(0xDEAD);
        uint256 liqBefore = usdc.balanceOf(liquidator);

        vm.prank(liquidator);
        positionManager.liquidate(1);

        // Liquidator should receive bonus
        uint256 liqAfter = usdc.balanceOf(liquidator);
        assertTrue(liqAfter > liqBefore);

        // Position should be closed
        OrderLib.PositionInfo memory pos = positionManager.getPosition(1);
        assertFalse(pos.isOpen);
    }

    function test_addCollateral() public {
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        OrderLib.PositionInfo memory posBefore = positionManager.getPosition(1);

        vm.prank(alice);
        usdc.approve(address(positionManager), 1000e6);
        vm.prank(alice);
        positionManager.addCollateral(1, 1000e6);

        OrderLib.PositionInfo memory posAfter = positionManager.getPosition(1);
        assertEq(posAfter.collateral, posBefore.collateral + 1000e6);
    }
}
