// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ForwardMarket} from "../src/core/ForwardMarket.sol";
import {OrderBook} from "../src/core/OrderBook.sol";
import {PositionManager} from "../src/core/PositionManager.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";
import {OrderLib} from "../src/libraries/OrderLib.sol";

contract FeeSystemTest is Test {
    ForwardMarket public forwardMarket;
    OrderBook public orderBook;
    PositionManager public positionManager;
    MockOracle public oracle;
    MockUSDC public usdc;

    address public feeCollector = address(0xFEE);
    address public insurance = address(0x1115);
    address public vault = address(0x7A01);
    address public builder = address(0xB01D);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    uint256 public marketId;

    function setUp() public {
        oracle = new MockOracle();
        usdc = new MockUSDC();
        forwardMarket = new ForwardMarket(address(oracle));
        orderBook = new OrderBook(address(forwardMarket), address(usdc), feeCollector, 10); // 0.10% taker fee
        positionManager = new PositionManager(
            address(forwardMarket), address(oracle), address(usdc), address(orderBook)
        );
        orderBook.setPositionManager(address(positionManager));
        forwardMarket.setAuthorized(address(orderBook), true);
        forwardMarket.setAuthorized(address(positionManager), true);

        // Configure fee system
        orderBook.setInsuranceFund(insurance);
        orderBook.setLPVault(vault);

        marketId = forwardMarket.createMarket("ETH", "USDC", block.timestamp + 30 days, 5000, 8000, 10e6);

        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        vm.prank(alice);
        usdc.approve(address(orderBook), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(orderBook), type(uint256).max);
    }

    function test_takerFeeDeducted() public {
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        assertTrue(orderBook.totalFeesCollected() > 0);
    }

    function test_makerRebate() public {
        orderBook.setMakerFee(2, true); // 0.02% rebate

        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        assertTrue(orderBook.totalMakerRebates() > 0);
    }

    function test_feeSplit_protocolInsuranceLp() public {
        // Default split: 30% protocol, 10% insurance, 60% LP
        uint256 insuranceBefore = usdc.balanceOf(insurance);
        uint256 vaultBefore = usdc.balanceOf(vault);
        uint256 feeCollBefore = usdc.balanceOf(feeCollector);

        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        uint256 protocolFees = usdc.balanceOf(feeCollector) - feeCollBefore;
        uint256 insuranceFees = usdc.balanceOf(insurance) - insuranceBefore;
        uint256 lpFees = usdc.balanceOf(vault) - vaultBefore;

        assertTrue(protocolFees > 0, "Protocol should get fees");
        assertTrue(insuranceFees > 0, "Insurance should get fees");
        assertTrue(lpFees > 0, "LP vault should get fees");
        assertTrue(protocolFees > insuranceFees, "Protocol share > insurance share");
    }

    function test_builderCode() public {
        orderBook.registerBuilder(builder, 1000); // 10% of taker fees
        // Bob is the taker (his order comes in second and matches)
        vm.prank(bob);
        orderBook.setBuilderForTrader(bob, builder);

        uint256 builderBefore = usdc.balanceOf(builder);

        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        uint256 builderAfter = usdc.balanceOf(builder);
        assertTrue(builderAfter > builderBefore, "Builder should receive fees");
        assertTrue(orderBook.totalBuilderFees() > 0);
    }

    function test_zeroFee() public {
        orderBook.setTakerFee(0);

        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        assertEq(orderBook.totalFeesCollected(), 0);
    }

    function test_setFee_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert("OrderBook: not owner");
        orderBook.setTakerFee(20);
    }

    function test_getFeeConfig() public view {
        (uint256 taker, uint256 maker, bool rebate, uint256 protocol, uint256 ins, uint256 lp) = orderBook.getFeeConfig();
        assertEq(taker, 10);
        assertEq(maker, 0);
        assertFalse(rebate);
        assertEq(protocol, 3000);
        assertEq(ins, 1000);
        assertEq(lp, 6000);
    }

    function test_getFeeTotals() public {
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        (uint256 total, uint256 protocol, uint256 ins, uint256 bld, uint256 rebates) = orderBook.getFeeTotals();
        assertTrue(total > 0);
        assertTrue(protocol > 0);
        assertTrue(ins > 0);
        assertEq(bld, 0); // no builder set
        assertEq(rebates, 0); // rebate not enabled
    }
}
