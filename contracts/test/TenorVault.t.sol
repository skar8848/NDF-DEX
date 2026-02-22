// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {TenorVault} from "../src/core/TenorVault.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";

contract TenorVaultTest is Test {
    TenorVault public vault;
    MockUSDC public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
        vault = new TenorVault(address(usdc));
        vault.setWithdrawalDelay(1 hours); // Shorter for tests

        usdc.mint(alice, 100_000e6);
        usdc.mint(bob, 100_000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_deposit() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        uint256 expectedShares = 1000e6 * 1e12;
        uint256 deadShares = 1000; // DEAD_SHARES minted to address(1) on first deposit
        assertEq(vault.totalSupply(), expectedShares + deadShares);
        assertEq(vault.balanceOf(alice), expectedShares);
        assertEq(usdc.balanceOf(address(vault)), 1000e6);
    }

    function test_sharePrice_initial() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        // Initial share price should be ~1e18 (1 USDC per TLP)
        // Tiny deviation due to dead shares (1000 wei)
        uint256 price = vault.sharePrice();
        assertTrue(price >= 999999999999999999 && price <= 1e18, "Share price should be ~1e18");
    }

    function test_sharePrice_increases() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        // Simulate fee revenue flowing in (direct transfer)
        usdc.mint(address(vault), 100e6); // 10% profit

        uint256 price = vault.sharePrice();
        // Should be ~1.1e18
        assertTrue(price > 1e18, "Share price should increase");
        assertTrue(price <= 1.11e18, "Share price should be ~1.1");
    }

    function test_withdraw_delay() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.requestWithdraw(shares);

        // Shares should be locked in vault now, not with alice
        assertEq(vault.balanceOf(alice), 0);

        // Try to execute immediately → should fail
        vm.prank(alice);
        vm.expectRevert("TenorVault: delay not met");
        vault.executeWithdraw();

        // Wait for delay
        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(alice);
        vault.executeWithdraw();

        assertEq(vault.balanceOf(alice), 0);
        // Alice gets back almost all USDC (tiny amount stays due to dead shares rounding)
        assertTrue(usdc.balanceOf(alice) >= 99_999_999999, "Alice should get back ~all USDC");
    }

    function test_depositCap() public {
        vault.setDepositCap(500e6);

        vm.prank(alice);
        vault.deposit(500e6);

        vm.prank(bob);
        vm.expectRevert("TenorVault: cap exceeded");
        vault.deposit(1e6);
    }

    function test_multiDepositor() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        vm.prank(bob);
        vault.deposit(1000e6);

        // Dead shares (1000) only minted on first deposit
        uint256 deadShares = 1000;
        uint256 aliceShares = vault.balanceOf(alice);
        uint256 bobShares = vault.balanceOf(bob);
        assertTrue(aliceShares > 0 && bobShares > 0, "Both should have shares");
        // Bob gets slightly fewer shares due to dead shares dilution, but negligible
        assertTrue(vault.totalSupply() > 2000e6 * 1e12, "Total should include dead shares");
    }

    function test_profitFlow() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        // Simulate revenue
        usdc.mint(address(vault), 200e6);

        // Bob deposits at higher share price
        vm.prank(bob);
        vault.deposit(1200e6); // ~Same shares as alice (since vault now has 1200 USDC)

        uint256 aliceShares = vault.balanceOf(alice);
        uint256 bobShares = vault.balanceOf(bob);
        // Should be approximately equal (tiny diff from dead shares)
        assertTrue(aliceShares > 0 && bobShares > 0, "Both should have shares");
        // Difference should be negligible (< 0.001%)
        uint256 diff = aliceShares > bobShares ? aliceShares - bobShares : bobShares - aliceShares;
        assertTrue(diff * 100000 / aliceShares < 1, "Shares should be approx equal");

        // Vault should have 2400 USDC now
        assertEq(usdc.balanceOf(address(vault)), 2400e6);
    }

    function test_cancelWithdraw() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.requestWithdraw(shares);

        // Shares locked in vault during delay
        assertEq(vault.balanceOf(alice), 0);

        vm.prank(alice);
        vault.cancelWithdraw();

        // Should get shares back
        assertEq(vault.balanceOf(alice), shares);
    }

    function test_withdrawWithProfit() public {
        vm.prank(alice);
        vault.deposit(1000e6);

        // Simulate 50% profit
        usdc.mint(address(vault), 500e6);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.requestWithdraw(shares);

        vm.warp(block.timestamp + 1 hours + 1);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        vault.executeWithdraw();
        uint256 aliceAfter = usdc.balanceOf(alice);

        // Should get back ~1500 USDC (original + profit, minus tiny dead shares rounding)
        uint256 received = aliceAfter - aliceBefore;
        assertTrue(received >= 1499_999999 && received <= 1500e6, "Should get ~1500 USDC");
    }
}
