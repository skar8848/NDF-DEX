// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ForwardMarket} from "../src/core/ForwardMarket.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {OrderLib} from "../src/libraries/OrderLib.sol";

contract ForwardMarketTest is Test {
    ForwardMarket public market;
    MockOracle public oracle;

    address public owner = address(this);
    address public alice = address(0xA11CE);

    function setUp() public {
        oracle = new MockOracle();
        market = new ForwardMarket(address(oracle));
    }

    function test_createMarket() public {
        uint256 expiry = block.timestamp + 30 days;
        uint256 id = market.createMarket("ETH", "USDC", expiry, 5000, 8000, 10e6);

        assertEq(id, 1);
        assertEq(market.marketCount(), 1);

        OrderLib.MarketInfo memory m = market.getMarket(1);
        assertEq(keccak256(bytes(m.baseAsset)), keccak256("ETH"));
        assertEq(keccak256(bytes(m.quoteAsset)), keccak256("USDC"));
        assertEq(m.expiration, expiry);
        assertEq(m.ltv, 5000);
        assertEq(m.liquidationThreshold, 8000);
        assertEq(m.minCollateral, 10e6);
        assertFalse(m.settled);
    }

    function test_createMultipleMarkets() public {
        uint256 expiry = block.timestamp + 30 days;
        market.createMarket("ETH", "USDC", expiry, 5000, 8000, 10e6);
        market.createMarket("BTC", "USDC", expiry, 5000, 8000, 10e6);
        market.createMarket("AVAX", "USDC", expiry + 7 days, 5000, 8000, 5e6);

        assertEq(market.marketCount(), 3);

        OrderLib.MarketInfo[] memory active = market.getActiveMarkets();
        assertEq(active.length, 3);
    }

    function test_settleMarket() public {
        uint256 expiry = block.timestamp + 30 days;
        market.createMarket("ETH", "USDC", expiry, 5000, 8000, 10e6);

        // Fast-forward past expiry
        vm.warp(expiry + 1);

        // Set settlement price
        oracle.setPrice("ETH", 3000e8);

        market.settleMarket(1);

        OrderLib.MarketInfo memory m = market.getMarket(1);
        assertTrue(m.settled);
        assertEq(m.settlePrice, 3000e8);
    }

    function test_revert_settleBeforeExpiry() public {
        uint256 expiry = block.timestamp + 30 days;
        market.createMarket("ETH", "USDC", expiry, 5000, 8000, 10e6);

        vm.expectRevert("ForwardMarket: not expired");
        market.settleMarket(1);
    }

    function test_revert_settleAlreadySettled() public {
        uint256 expiry = block.timestamp + 30 days;
        market.createMarket("ETH", "USDC", expiry, 5000, 8000, 10e6);

        vm.warp(expiry + 1);
        market.settleMarket(1);

        vm.expectRevert("ForwardMarket: already settled");
        market.settleMarket(1);
    }

    function test_revert_expirationInPast() public {
        vm.expectRevert("ForwardMarket: expiration in past");
        market.createMarket("ETH", "USDC", block.timestamp - 1, 5000, 8000, 10e6);
    }

    function test_revert_invalidLtv() public {
        vm.expectRevert("ForwardMarket: invalid ltv");
        market.createMarket("ETH", "USDC", block.timestamp + 30 days, 0, 8000, 10e6);
    }

    function test_getActiveMarketsAfterSettle() public {
        uint256 expiry = block.timestamp + 30 days;
        market.createMarket("ETH", "USDC", expiry, 5000, 8000, 10e6);
        market.createMarket("BTC", "USDC", expiry, 5000, 8000, 10e6);

        vm.warp(expiry + 1);
        oracle.setPrice("ETH", 3000e8);
        market.settleMarket(1);

        OrderLib.MarketInfo[] memory active = market.getActiveMarkets();
        assertEq(active.length, 1);
        assertEq(active[0].id, 2);
    }
}
