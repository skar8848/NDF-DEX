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
    // Chainlink Fuji price feed addresses
    address constant CHAINLINK_ETH_USD = 0x86d67c3D38D2bCeE722E601025C25a575021c6EA;
    address constant CHAINLINK_BTC_USD = 0x31CF013A08c6Ac228C94551d535d5BAfE19c602a;
    address constant CHAINLINK_AVAX_USD = 0x5498BB86BC934c8D34FDA08E81D444153d0D06aD;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Check whether to deploy with Chainlink oracle (default: false)
        bool useChainlink = vm.envOr("USE_CHAINLINK", false);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Mock Tokens
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        MockWETH weth = new MockWETH();
        console.log("MockWETH deployed at:", address(weth));

        // 2. Deploy Oracle (Chainlink or Mock depending on env var)
        address oracleAddr;

        if (useChainlink) {
            ChainlinkOracle chainlinkOracle = new ChainlinkOracle();
            oracleAddr = address(chainlinkOracle);

            // Register Fuji Chainlink price feeds
            chainlinkOracle.registerFeed("ETH", CHAINLINK_ETH_USD);
            chainlinkOracle.registerFeed("BTC", CHAINLINK_BTC_USD);
            chainlinkOracle.registerFeed("AVAX", CHAINLINK_AVAX_USD);

            console.log("ChainlinkOracle deployed at:", oracleAddr);
            console.log("  ETH/USD feed:", CHAINLINK_ETH_USD);
            console.log("  BTC/USD feed:", CHAINLINK_BTC_USD);
            console.log("  AVAX/USD feed:", CHAINLINK_AVAX_USD);
        } else {
            MockOracle mockOracle = new MockOracle();
            oracleAddr = address(mockOracle);
            console.log("MockOracle deployed at:", oracleAddr);
        }

        // 3. Deploy ForwardMarket
        ForwardMarket forwardMarket = new ForwardMarket(oracleAddr);
        console.log("ForwardMarket deployed at:", address(forwardMarket));

        // 4. Deploy OrderBook
        OrderBook orderBook = new OrderBook(address(forwardMarket), address(usdc));
        console.log("OrderBook deployed at:", address(orderBook));

        // 5. Deploy PositionManager
        PositionManager positionManager =
            new PositionManager(address(forwardMarket), oracleAddr, address(usdc), address(orderBook));
        console.log("PositionManager deployed at:", address(positionManager));

        // 6. Link contracts
        orderBook.setPositionManager(address(positionManager));
        forwardMarket.setAuthorized(address(orderBook), true);
        forwardMarket.setAuthorized(address(positionManager), true);

        // 7. Create initial markets
        // ETH/USDC Forward - 30 days
        uint256 ethMarket = forwardMarket.createMarket(
            "ETH", "USDC", block.timestamp + 30 days, 8000, 8500, 10e6
        );
        console.log("ETH/USDC Market created, ID:", ethMarket);

        // BTC/USDC Forward - 30 days
        uint256 btcMarket = forwardMarket.createMarket(
            "BTC", "USDC", block.timestamp + 30 days, 8000, 8500, 10e6
        );
        console.log("BTC/USDC Market created, ID:", btcMarket);

        // AVAX/USDC Forward - 7 days
        uint256 avaxMarket = forwardMarket.createMarket(
            "AVAX", "USDC", block.timestamp + 7 days, 8000, 8500, 5e6
        );
        console.log("AVAX/USDC Market created, ID:", avaxMarket);

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Avalanche Fuji (43113)");
        console.log("Oracle type:", useChainlink ? "Chainlink" : "Mock");
        console.log("MockUSDC:", address(usdc));
        console.log("MockWETH:", address(weth));
        console.log("Oracle:", oracleAddr);
        console.log("ForwardMarket:", address(forwardMarket));
        console.log("OrderBook:", address(orderBook));
        console.log("PositionManager:", address(positionManager));
    }
}
