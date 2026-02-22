// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/tokens/MockUSDC.sol";
import {MockWETH} from "../src/tokens/MockWETH.sol";
import {MockOracle} from "../src/oracle/MockOracle.sol";
import {ChainlinkOracle} from "../src/oracle/ChainlinkOracle.sol";
import {ForwardMarket} from "../src/core/ForwardMarket.sol";
import {OrderBook} from "../src/core/OrderBook.sol";
import {PositionManager} from "../src/core/PositionManager.sol";

contract DeployScript is Script {
    address constant CHAINLINK_ETH_USD = 0x86d67c3D38D2bCeE722E601025C25a575021c6EA;
    address constant CHAINLINK_BTC_USD = 0x31CF013A08c6Ac228C94551d535d5BAfE19c602a;
    address constant CHAINLINK_AVAX_USD = 0x5498BB86BC934c8D34FDA08E81D444153d0D06aD;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        bool useChainlink = vm.envOr("USE_CHAINLINK", false);
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Tokens
        MockUSDC usdc = new MockUSDC();
        MockWETH weth = new MockWETH();
        console.log("MockUSDC:", address(usdc));
        console.log("MockWETH:", address(weth));

        // 2. Oracle
        address oracleAddr = _deployOracle(useChainlink);

        // 3. Core contracts
        ForwardMarket fm = new ForwardMarket(oracleAddr);
        OrderBook ob = new OrderBook(address(fm), address(usdc), deployer, 10);
        PositionManager pm = new PositionManager(address(fm), oracleAddr, address(usdc), address(ob));

        ob.setPositionManager(address(pm));
        fm.setAuthorized(address(ob), true);
        fm.setAuthorized(address(pm), true);

        console.log("ForwardMarket:", address(fm));
        console.log("OrderBook:", address(ob));
        console.log("PositionManager:", address(pm));

        // 4. Cash markets
        _createCashMarkets(fm);

        // 5. Physical delivery markets
        _createPhysicalMarkets(fm, address(weth));

        // 6. Fund pools
        usdc.mint(address(pm), 1_000_000e6);
        weth.mint(address(pm), 1000e18);
        console.log("Funded: 1M USDC + 1000 WETH to PositionManager");

        vm.stopBroadcast();
    }

    function _deployOracle(bool useChainlink) internal returns (address) {
        if (useChainlink) {
            ChainlinkOracle o = new ChainlinkOracle();
            o.registerFeed("ETH", CHAINLINK_ETH_USD);
            o.registerFeed("BTC", CHAINLINK_BTC_USD);
            o.registerFeed("AVAX", CHAINLINK_AVAX_USD);
            console.log("ChainlinkOracle:", address(o));
            return address(o);
        } else {
            MockOracle o = new MockOracle();
            console.log("MockOracle:", address(o));
            return address(o);
        }
    }

    function _createCashMarkets(ForwardMarket fm) internal {
        uint256 m1 = fm.createMarket("ETH", "USDC", block.timestamp + 30 days, 8000, 8500, 10e6);
        console.log("Cash ETH/USDC (30d) ID:", m1);

        uint256 m2 = fm.createMarket("BTC", "USDC", block.timestamp + 30 days, 8000, 8500, 10e6);
        console.log("Cash BTC/USDC (30d) ID:", m2);

        uint256 m3 = fm.createMarket("AVAX", "USDC", block.timestamp + 7 days, 8000, 8500, 5e6);
        console.log("Cash AVAX/USDC (7d) ID:", m3);
    }

    function _createPhysicalMarkets(ForwardMarket fm, address weth) internal {
        uint256 m4 = fm.createPhysicalMarket("ETH", "USDC", block.timestamp + 10 minutes, 8000, 8500, 10e6, weth);
        console.log("Physical ETH/USDC (10min) ID:", m4);

        uint256 m5 = fm.createPhysicalMarket("ETH", "USDC", block.timestamp + 1 hours, 8000, 8500, 10e6, weth);
        console.log("Physical ETH/USDC (1h) ID:", m5);
    }
}
