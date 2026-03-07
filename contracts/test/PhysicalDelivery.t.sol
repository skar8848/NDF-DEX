// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ForwardMarket} from "../src/core/ForwardMarket.sol";
import {OrderBook} from "../src/core/OrderBook.sol";
import {PositionManager} from "../src/core/PositionManager.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";
import {MockWETH} from "../src/tokens/MockWETH.sol";
import {OrderLib} from "../src/libraries/OrderLib.sol";

contract PhysicalDeliveryTest is Test {
    ForwardMarket public forwardMarket;
    OrderBook public orderBook;
    PositionManager public positionManager;
    MockOracle public oracle;
    MockUSDC public usdc;
    MockWETH public weth;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    uint256 public cashMarketId;
    uint256 public physicalMarketId;
    uint256 public expiry;

    function setUp() public {
        oracle = new MockOracle();
        usdc = new MockUSDC();
        weth = new MockWETH();
        forwardMarket = new ForwardMarket(address(oracle));
        orderBook = new OrderBook(address(forwardMarket), address(this), 10);
        orderBook.addSupportedCollateral(address(usdc));
        positionManager = new PositionManager(
            address(forwardMarket), address(oracle), address(orderBook)
        );
        orderBook.setPositionManager(address(positionManager));
        forwardMarket.setAuthorized(address(orderBook), true);
        forwardMarket.setAuthorized(address(positionManager), true);

        expiry = block.timestamp + 10 minutes;

        // Create cash market (NDF)
        cashMarketId = forwardMarket.createMarket("ETH", "USDC", expiry, 5000, 8000, 10e6);

        // Create physical delivery market
        physicalMarketId = forwardMarket.createPhysicalMarket(
            "ETH", "USDC", expiry, 5000, 8000, 10e6, address(weth)
        );

        // Fund traders with USDC
        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        vm.prank(alice);
        usdc.approve(address(orderBook), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(orderBook), type(uint256).max);

        // Fund PositionManager with USDC (protocol pool) and WETH (delivery pool)
        usdc.mint(address(positionManager), 1_000_000e6);
        weth.mint(address(positionManager), 100e18); // 100 WETH for delivery

        // Set oracle price
        oracle.setPrice("ETH", 2500e8);
    }

    function test_physicalMarketCreated() public view {
        OrderLib.MarketInfo memory market = forwardMarket.getMarket(physicalMarketId);
        assertEq(uint8(market.settlementType), uint8(OrderLib.SettlementType.PHYSICAL));
        assertEq(market.underlyingToken, address(weth));
    }

    function test_cashMarketStillCash() public view {
        OrderLib.MarketInfo memory market = forwardMarket.getMarket(cashMarketId);
        assertEq(uint8(market.settlementType), uint8(OrderLib.SettlementType.CASH));
        assertEq(market.underlyingToken, address(0));
    }

    function test_physicalDelivery_longReceivesWETH() public {
        // Alice goes long, Bob goes short on PHYSICAL market
        vm.prank(alice);
        orderBook.placeLimitOrder(physicalMarketId, OrderLib.Side.LONG, 2500e8, 2, address(usdc));
        vm.prank(bob);
        orderBook.placeLimitOrder(physicalMarketId, OrderLib.Side.SHORT, 2500e8, 2, address(usdc));

        // Warp to expiry and settle
        vm.warp(expiry + 1);
        oracle.setPrice("ETH", 2600e8); // price went up
        forwardMarket.settleMarket(physicalMarketId);

        uint256 aliceWethBefore = weth.balanceOf(alice);
        uint256 aliceUsdcBefore = usdc.balanceOf(alice);

        // Settle alice (long) — should receive WETH
        positionManager.settlePosition(1);

        uint256 aliceWethAfter = weth.balanceOf(alice);
        uint256 aliceUsdcAfter = usdc.balanceOf(alice);

        // Alice should have received 2 WETH (2 contracts = 2 underlying units)
        assertEq(aliceWethAfter - aliceWethBefore, 2e18, "Long should receive 2 WETH");

        // Alice also gets back some USDC collateral (collateral minus forward price cost)
        console.log("Alice USDC change:", aliceUsdcAfter - aliceUsdcBefore);
        console.log("Alice WETH received:", (aliceWethAfter - aliceWethBefore) / 1e18);
    }

    function test_physicalDelivery_shortReceivesUSDC() public {
        // Alice goes long, Bob goes short on PHYSICAL market
        vm.prank(alice);
        orderBook.placeLimitOrder(physicalMarketId, OrderLib.Side.LONG, 2500e8, 1, address(usdc));
        vm.prank(bob);
        orderBook.placeLimitOrder(physicalMarketId, OrderLib.Side.SHORT, 2500e8, 1, address(usdc));

        vm.warp(expiry + 1);
        oracle.setPrice("ETH", 2400e8); // price dropped — short profits
        forwardMarket.settleMarket(physicalMarketId);

        uint256 bobWethBefore = weth.balanceOf(bob);
        uint256 bobUsdcBefore = usdc.balanceOf(bob);

        // Settle bob (short)
        positionManager.settlePosition(2);

        uint256 bobWethAfter = weth.balanceOf(bob);
        uint256 bobUsdcAfter = usdc.balanceOf(bob);

        // Short should NOT receive WETH, only USDC
        assertEq(bobWethAfter, bobWethBefore, "Short should NOT receive WETH");
        assertTrue(bobUsdcAfter > bobUsdcBefore, "Short should receive USDC payout");
        console.log("Bob USDC payout:", bobUsdcAfter - bobUsdcBefore);
    }

    function test_cashSettlement_unchanged() public {
        // Same flow but on CASH market — should behave as before
        vm.prank(alice);
        orderBook.placeLimitOrder(cashMarketId, OrderLib.Side.LONG, 2500e8, 1, address(usdc));
        vm.prank(bob);
        orderBook.placeLimitOrder(cashMarketId, OrderLib.Side.SHORT, 2500e8, 1, address(usdc));

        vm.warp(expiry + 1);
        oracle.setPrice("ETH", 3000e8);
        forwardMarket.settleMarket(cashMarketId);

        uint256 aliceWethBefore = weth.balanceOf(alice);
        uint256 aliceUsdcBefore = usdc.balanceOf(alice);

        positionManager.settlePosition(1);

        uint256 aliceWethAfter = weth.balanceOf(alice);
        uint256 aliceUsdcAfter = usdc.balanceOf(alice);

        // Cash settlement: long receives USDC, NOT WETH
        assertEq(aliceWethAfter, aliceWethBefore, "Cash settlement should NOT send WETH");
        assertTrue(aliceUsdcAfter > aliceUsdcBefore, "Cash settlement should send USDC profit");
    }

    function test_revert_physicalMarketZeroUnderlying() public {
        vm.expectRevert("ForwardMarket: zero underlying");
        forwardMarket.createPhysicalMarket("ETH", "USDC", expiry + 1 days, 5000, 8000, 10e6, address(0));
    }
}
