// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ForwardMarket} from "../src/core/ForwardMarket.sol";
import {OrderBook} from "../src/core/OrderBook.sol";
import {PositionManager} from "../src/core/PositionManager.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";
import {OrderLib} from "../src/libraries/OrderLib.sol";

contract ClosePositionTest is Test {
    ForwardMarket public forwardMarket;
    OrderBook public orderBook;
    PositionManager public positionManager;
    MockOracle public oracle;
    MockUSDC public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public keeper = address(0xBEEF);
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

        // Fund accounts
        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        vm.prank(alice);
        usdc.approve(address(orderBook), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(orderBook), type(uint256).max);

        // Fund protocol pool
        usdc.mint(address(positionManager), 1_000_000e6);

        // Set initial oracle price
        oracle.setPrice("ETH", 2500e8);
    }

    function _createMatchedPositions() internal returns (uint256 longPosId, uint256 shortPosId) {
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1);
        longPosId = 1;
        shortPosId = 2;
    }

    // ─── closePosition by trader ─────────────────────────────────────

    function test_closePositionByTrader() public {
        (uint256 longPosId,) = _createMatchedPositions();

        // Price goes up → long is in profit
        oracle.setPrice("ETH", 2700e8);

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        positionManager.closePosition(longPosId, 0);

        uint256 aliceAfter = usdc.balanceOf(alice);

        // Position should be closed
        OrderLib.PositionInfo memory pos = positionManager.getPosition(longPosId);
        assertFalse(pos.isOpen);

        // Alice should have received collateral + profit
        // PnL = (2700 - 2500) * 1 * 1e6 / 1e8 = 200e6
        assertTrue(aliceAfter > aliceBefore);
    }

    function test_closePositionByTrader_atLoss() public {
        (uint256 longPosId,) = _createMatchedPositions();

        // Price goes down → long is at loss
        oracle.setPrice("ETH", 2300e8);

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        positionManager.closePosition(longPosId, 0);

        uint256 aliceAfter = usdc.balanceOf(alice);

        OrderLib.PositionInfo memory pos = positionManager.getPosition(longPosId);
        assertFalse(pos.isOpen);

        // Alice gets collateral minus loss
        assertTrue(aliceAfter > aliceBefore); // still gets some back
    }

    // ─── closePosition by keeper (TP) ────────────────────────────────

    function test_closePositionByKeeper_TP() public {
        (uint256 longPosId,) = _createMatchedPositions();

        // Set TP at 2800
        vm.prank(alice);
        positionManager.setTPSL(longPosId, 2800e8, 0);

        // Price hits TP
        oracle.setPrice("ETH", 2850e8);

        uint256 aliceBefore = usdc.balanceOf(alice);

        // Keeper triggers close
        vm.prank(keeper);
        positionManager.closePosition(longPosId, 0);

        uint256 aliceAfter = usdc.balanceOf(alice);

        OrderLib.PositionInfo memory pos = positionManager.getPosition(longPosId);
        assertFalse(pos.isOpen);
        assertTrue(aliceAfter > aliceBefore);
    }

    // ─── closePosition by keeper (SL) ────────────────────────────────

    function test_closePositionByKeeper_SL() public {
        (uint256 longPosId,) = _createMatchedPositions();

        // Set SL at 2200
        vm.prank(alice);
        positionManager.setTPSL(longPosId, 0, 2200e8);

        // Price hits SL
        oracle.setPrice("ETH", 2100e8);

        // Keeper triggers close
        vm.prank(keeper);
        positionManager.closePosition(longPosId, 0);

        OrderLib.PositionInfo memory pos = positionManager.getPosition(longPosId);
        assertFalse(pos.isOpen);
    }

    // ─── Keeper cannot close if TP/SL not triggered ──────────────────

    function test_revert_keeperCloseNotTriggered() public {
        (uint256 longPosId,) = _createMatchedPositions();

        // Set TP at 3000, SL at 2000
        vm.prank(alice);
        positionManager.setTPSL(longPosId, 3000e8, 2000e8);

        // Price is 2500 — neither triggered
        oracle.setPrice("ETH", 2500e8);

        vm.prank(keeper);
        vm.expectRevert("PositionManager: TP/SL not triggered");
        positionManager.closePosition(longPosId, 0);
    }

    function test_revert_keeperCloseNoTPSL() public {
        (uint256 longPosId,) = _createMatchedPositions();

        // No TP/SL set at all
        vm.prank(keeper);
        vm.expectRevert("PositionManager: TP/SL not triggered");
        positionManager.closePosition(longPosId, 0);
    }

    // ─── setTPSL validations ─────────────────────────────────────────

    function test_setTPSL_validations() public {
        (uint256 longPosId,) = _createMatchedPositions();

        // TP must be above entry for long
        vm.prank(alice);
        vm.expectRevert("PositionManager: TP must be above entry for long");
        positionManager.setTPSL(longPosId, 2000e8, 0);

        // SL must be below entry for long
        vm.prank(alice);
        vm.expectRevert("PositionManager: SL must be below entry for long");
        positionManager.setTPSL(longPosId, 0, 3000e8);

        // Valid TP/SL should work
        vm.prank(alice);
        positionManager.setTPSL(longPosId, 3000e8, 2000e8);

        OrderLib.TPSLOrder memory tpsl = positionManager.getTPSL(longPosId);
        assertEq(tpsl.takeProfitPrice, 3000e8);
        assertEq(tpsl.stopLossPrice, 2000e8);
    }

    function test_setTPSL_short_validations() public {
        (, uint256 shortPosId) = _createMatchedPositions();

        // TP must be below entry for short
        vm.prank(bob);
        vm.expectRevert("PositionManager: TP must be below entry for short");
        positionManager.setTPSL(shortPosId, 3000e8, 0);

        // SL must be above entry for short
        vm.prank(bob);
        vm.expectRevert("PositionManager: SL must be above entry for short");
        positionManager.setTPSL(shortPosId, 0, 2000e8);

        // Valid: TP below entry, SL above entry
        vm.prank(bob);
        positionManager.setTPSL(shortPosId, 2000e8, 3000e8);

        OrderLib.TPSLOrder memory tpsl = positionManager.getTPSL(shortPosId);
        assertEq(tpsl.takeProfitPrice, 2000e8);
        assertEq(tpsl.stopLossPrice, 3000e8);
    }

    function test_setTPSL_onlyTrader() public {
        (uint256 longPosId,) = _createMatchedPositions();

        vm.prank(keeper);
        vm.expectRevert("PositionManager: not your position");
        positionManager.setTPSL(longPosId, 3000e8, 2000e8);
    }

    // ─── Counterparty stays open ─────────────────────────────────────

    function test_counterpartyStaysOpen() public {
        (uint256 longPosId, uint256 shortPosId) = _createMatchedPositions();

        oracle.setPrice("ETH", 2700e8);

        // Alice closes her long position
        vm.prank(alice);
        positionManager.closePosition(longPosId, 0);

        // Alice's position is closed
        OrderLib.PositionInfo memory alicePos = positionManager.getPosition(longPosId);
        assertFalse(alicePos.isOpen);

        // Bob's counterparty position is still open
        OrderLib.PositionInfo memory bobPos = positionManager.getPosition(shortPosId);
        assertTrue(bobPos.isOpen);
    }

    // ─── Position enumeration ────────────────────────────────────────

    function test_openPositionTracking() public {
        _createMatchedPositions();

        assertEq(positionManager.getOpenPositionCount(), 2);

        uint256[] memory ids = positionManager.getOpenPositionIds(0, 10);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_openPositionRemoval() public {
        (uint256 longPosId,) = _createMatchedPositions();

        assertEq(positionManager.getOpenPositionCount(), 2);

        oracle.setPrice("ETH", 2700e8);

        vm.prank(alice);
        positionManager.closePosition(longPosId, 0);

        assertEq(positionManager.getOpenPositionCount(), 1);

        uint256[] memory ids = positionManager.getOpenPositionIds(0, 10);
        assertEq(ids.length, 1);
        assertEq(ids[0], 2); // bob's position remains
    }

    function test_openPositionPagination() public {
        // Create 3 pairs of positions
        _createMatchedPositions(); // IDs 1, 2
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 1);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 1); // IDs 3, 4

        assertEq(positionManager.getOpenPositionCount(), 4);

        // Page 1: offset=0, limit=2
        uint256[] memory page1 = positionManager.getOpenPositionIds(0, 2);
        assertEq(page1.length, 2);

        // Page 2: offset=2, limit=2
        uint256[] memory page2 = positionManager.getOpenPositionIds(2, 2);
        assertEq(page2.length, 2);

        // Page 3: offset=4 → empty
        uint256[] memory page3 = positionManager.getOpenPositionIds(4, 2);
        assertEq(page3.length, 0);
    }

    // ─── Short TP/SL trigger tests ───────────────────────────────────

    function test_closePositionByKeeper_shortTP() public {
        (, uint256 shortPosId) = _createMatchedPositions();

        // Set TP at 2200 for short (profit when price drops)
        vm.prank(bob);
        positionManager.setTPSL(shortPosId, 2200e8, 0);

        // Price drops below TP
        oracle.setPrice("ETH", 2100e8);

        vm.prank(keeper);
        positionManager.closePosition(shortPosId, 0);

        OrderLib.PositionInfo memory pos = positionManager.getPosition(shortPosId);
        assertFalse(pos.isOpen);
    }

    function test_closePositionByKeeper_shortSL() public {
        (, uint256 shortPosId) = _createMatchedPositions();

        // Set SL at 2800 for short (loss when price goes up)
        vm.prank(bob);
        positionManager.setTPSL(shortPosId, 0, 2800e8);

        // Price goes above SL
        oracle.setPrice("ETH", 2900e8);

        vm.prank(keeper);
        positionManager.closePosition(shortPosId, 0);

        OrderLib.PositionInfo memory pos = positionManager.getPosition(shortPosId);
        assertFalse(pos.isOpen);
    }

    // ─── Edge cases ──────────────────────────────────────────────────

    function test_revert_closeAlreadyClosed() public {
        (uint256 longPosId,) = _createMatchedPositions();

        vm.prank(alice);
        positionManager.closePosition(longPosId, 0);

        vm.prank(alice);
        vm.expectRevert("PositionManager: position closed");
        positionManager.closePosition(longPosId, 0);
    }

    function test_revert_closeSettledMarket() public {
        (uint256 longPosId,) = _createMatchedPositions();

        // Settle the market
        vm.warp(expiry + 1);
        oracle.setPrice("ETH", 2700e8);
        forwardMarket.settleMarket(marketId);

        vm.prank(alice);
        vm.expectRevert("PositionManager: use settlePosition");
        positionManager.closePosition(longPosId, 0);
    }

    // ─── Partial close ────────────────────────────────────────────────

    function _createLargeMatchedPositions() internal returns (uint256 longPosId, uint256 shortPosId) {
        vm.prank(alice);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.LONG, 2500e8, 10);
        vm.prank(bob);
        orderBook.placeLimitOrder(marketId, OrderLib.Side.SHORT, 2500e8, 10);
        longPosId = 1;
        shortPosId = 2;
    }

    function test_partialClose() public {
        (uint256 longPosId,) = _createLargeMatchedPositions();

        OrderLib.PositionInfo memory posBefore = positionManager.getPosition(longPosId);
        uint256 originalSize = posBefore.size;
        uint256 originalCollateral = posBefore.collateral;

        oracle.setPrice("ETH", 2700e8);

        // Close half the position
        uint256 halfSize = originalSize / 2;
        vm.prank(alice);
        positionManager.closePosition(longPosId, halfSize);

        // Position should still be open with reduced size
        OrderLib.PositionInfo memory posAfter = positionManager.getPosition(longPosId);
        assertTrue(posAfter.isOpen);
        assertEq(posAfter.size, originalSize - halfSize);
        assertEq(posAfter.collateral, originalCollateral - (originalCollateral * halfSize / originalSize));

        // Still tracked as open
        assertEq(positionManager.getOpenPositionCount(), 2);
    }

    function test_partialClose_thenFullClose() public {
        (uint256 longPosId,) = _createLargeMatchedPositions();

        OrderLib.PositionInfo memory posBefore = positionManager.getPosition(longPosId);
        uint256 halfSize = posBefore.size / 2;

        oracle.setPrice("ETH", 2700e8);

        // Close half
        vm.prank(alice);
        positionManager.closePosition(longPosId, halfSize);
        assertTrue(positionManager.getPosition(longPosId).isOpen);

        // Close remaining (0 = full close of whatever's left)
        vm.prank(alice);
        positionManager.closePosition(longPosId, 0);
        assertFalse(positionManager.getPosition(longPosId).isOpen);

        // Removed from open list
        assertEq(positionManager.getOpenPositionCount(), 1);
    }

    function test_revert_closeSizeExceedsPosition() public {
        (uint256 longPosId,) = _createMatchedPositions();

        OrderLib.PositionInfo memory pos = positionManager.getPosition(longPosId);

        vm.prank(alice);
        vm.expectRevert("PositionManager: close size exceeds position");
        positionManager.closePosition(longPosId, pos.size + 1);
    }
}
