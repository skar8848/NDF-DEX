// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CollateralManager} from "../src/core/CollateralManager.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";
import {MockWETH} from "../src/tokens/MockWETH.sol";

contract MultiCollateralTest is Test {
    CollateralManager public cm;
    MockOracle public oracle;
    MockUSDC public usdc;
    MockWETH public weth;

    address public alice = address(0xA11CE);

    function setUp() public {
        oracle = new MockOracle();
        usdc = new MockUSDC();
        weth = new MockWETH();
        cm = new CollateralManager(address(oracle));

        // Add collateral tokens
        cm.addCollateralToken(address(weth), "ETH", 18, 1000); // 10% haircut
        cm.addCollateralToken(address(usdc), "USDC_PRICE", 6, 0);  // 0% haircut

        // Set USDC price to $1 (for testing USDC as collateral)
        oracle.setPrice("USDC_PRICE", 1e8);

        // Fund alice
        weth.mint(alice, 10e18);
        usdc.mint(alice, 10_000e6);

        vm.startPrank(alice);
        weth.approve(address(cm), type(uint256).max);
        usdc.approve(address(cm), type(uint256).max);
        vm.stopPrank();
    }

    function test_deposit() public {
        vm.prank(alice);
        cm.depositCollateral(address(weth), 1e18);

        assertEq(cm.deposits(alice, address(weth)), 1e18);
    }

    function test_haircut() public {
        // ETH at $2500, 10% haircut → effective value = $2250 per ETH
        vm.prank(alice);
        cm.depositCollateral(address(weth), 1e18);

        uint256 valueUSD = cm.getCollateralValueUSD(alice);
        // 1 ETH * $2500 * 90% = $2250 in USDC (6 decimals)
        assertEq(valueUSD, 2250e6);
    }

    function test_multiToken() public {
        vm.startPrank(alice);
        cm.depositCollateral(address(weth), 1e18);    // $2500 * 90% = $2250
        cm.depositCollateral(address(usdc), 1000e6);   // $1000 * 100% = $1000
        vm.stopPrank();

        uint256 totalValue = cm.getCollateralValueUSD(alice);
        assertEq(totalValue, 3250e6); // $2250 + $1000
    }

    function test_withdraw() public {
        vm.prank(alice);
        cm.depositCollateral(address(weth), 2e18);

        vm.prank(alice);
        cm.withdrawCollateral(address(weth), 1e18);

        assertEq(cm.deposits(alice, address(weth)), 1e18);
        assertEq(weth.balanceOf(alice), 9e18); // started with 10, deposited 2, withdrew 1
    }

    function test_unsupported_revert() public {
        address randomToken = address(0x1234);

        vm.prank(alice);
        vm.expectRevert("CollateralManager: unsupported token");
        cm.depositCollateral(randomToken, 100);
    }

    function test_getDeposit() public {
        vm.prank(alice);
        cm.depositCollateral(address(weth), 1e18);

        (uint256 balance, uint256 valueUSD) = cm.getDeposit(alice, address(weth));
        assertEq(balance, 1e18);
        assertEq(valueUSD, 2250e6);
    }
}
