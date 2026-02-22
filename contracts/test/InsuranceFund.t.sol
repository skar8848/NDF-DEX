// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ForwardMarket} from "../src/core/ForwardMarket.sol";
import {OrderBook} from "../src/core/OrderBook.sol";
import {PositionManager} from "../src/core/PositionManager.sol";
import {InsuranceFund} from "../src/core/InsuranceFund.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";
import {OrderLib} from "../src/libraries/OrderLib.sol";

contract InsuranceFundTest is Test {
    ForwardMarket public forwardMarket;
    OrderBook public orderBook;
    PositionManager public positionManager;
    InsuranceFund public insuranceFund;
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

        insuranceFund = new InsuranceFund(address(usdc));
        insuranceFund.setPositionManager(address(positionManager));
        positionManager.setInsuranceFund(address(insuranceFund));

        marketId = forwardMarket.createMarket("ETH", "USDC", block.timestamp + 30 days, 5000, 8000, 10e6);

        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        vm.prank(alice);
        usdc.approve(address(orderBook), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(orderBook), type(uint256).max);
    }

    function test_deposit() public {
        usdc.mint(address(this), 1000e6);
        usdc.approve(address(insuranceFund), 1000e6);
        insuranceFund.deposit(1000e6);

        assertEq(insuranceFund.getBalance(), 1000e6);
        (uint256 balance, uint256 covered, uint256 deposited) = insuranceFund.getFundHealth();
        assertEq(balance, 1000e6);
        assertEq(covered, 0);
        assertEq(deposited, 1000e6);
    }

    function test_deposit_revertZero() public {
        vm.expectRevert("InsuranceFund: zero amount");
        insuranceFund.deposit(0);
    }

    function test_coverShortfall_onlyPositionManager() public {
        usdc.mint(address(insuranceFund), 1000e6);

        vm.prank(alice);
        vm.expectRevert("InsuranceFund: not position manager");
        insuranceFund.coverShortfall(1, 500e6);
    }

    function test_coverShortfall_fullCover() public {
        usdc.mint(address(this), 1000e6);
        usdc.approve(address(insuranceFund), 1000e6);
        insuranceFund.deposit(1000e6);

        // Simulate cover call from PM
        vm.prank(address(positionManager));
        uint256 covered = insuranceFund.coverShortfall(1, 500e6);

        assertEq(covered, 500e6);
        assertEq(insuranceFund.getBalance(), 500e6);
        assertEq(insuranceFund.totalCovered(), 500e6);
    }

    function test_coverShortfall_partialCover() public {
        usdc.mint(address(this), 100e6);
        usdc.approve(address(insuranceFund), 100e6);
        insuranceFund.deposit(100e6);

        vm.prank(address(positionManager));
        uint256 covered = insuranceFund.coverShortfall(1, 500e6);

        assertEq(covered, 100e6);
        assertEq(insuranceFund.getBalance(), 0);
    }

    function test_coverShortfall_emptyFund() public {
        vm.prank(address(positionManager));
        uint256 covered = insuranceFund.coverShortfall(1, 500e6);
        assertEq(covered, 0);
    }

    function test_setPositionManager_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert("InsuranceFund: not owner");
        insuranceFund.setPositionManager(address(0x1234));
    }

    function test_e2e_insuranceCoverOnSettlement() public {
        // Fund the insurance fund
        usdc.mint(address(this), 10_000e6);
        usdc.approve(address(insuranceFund), 10_000e6);
        insuranceFund.deposit(10_000e6);

        // Create positions
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);

        // Warp to expiry, price goes way up (long profits a lot)
        vm.warp(block.timestamp + 31 days);
        oracle.setPrice("ETH", 5000e8);
        forwardMarket.settleMarket(marketId);

        uint256 aliceBefore = usdc.balanceOf(alice);
        positionManager.settlePosition(1);
        uint256 aliceAfter = usdc.balanceOf(alice);

        // Alice should get a payout (long profited)
        assertTrue(aliceAfter > aliceBefore, "Alice should profit from settlement");
    }
}
