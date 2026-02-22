// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceOracle} from "./PriceOracle.sol";

contract MockOracle is IPriceOracle {
    address public owner;

    // asset name => price (8 decimals, like Chainlink)
    mapping(string => uint256) private prices;
    mapping(string => uint256) private timestamps;

    event PriceUpdated(string indexed asset, uint256 price, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "MockOracle: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        // Set default prices (8 decimals)
        _setPrice("ETH", 2500e8);
        _setPrice("BTC", 65000e8);
        _setPrice("AVAX", 25e8);
    }

    function setPrice(string calldata asset, uint256 price) external onlyOwner {
        _setPrice(asset, price);
    }

    function setBatchPrices(string[] calldata assets, uint256[] calldata _prices) external onlyOwner {
        require(assets.length == _prices.length, "MockOracle: length mismatch");
        for (uint256 i = 0; i < assets.length; i++) {
            _setPrice(assets[i], _prices[i]);
        }
    }

    function getPrice(string calldata asset) external view returns (uint256 price, uint256 timestamp) {
        price = prices[asset];
        require(price > 0, "MockOracle: price not set");
        timestamp = timestamps[asset];
    }

    function _setPrice(string memory asset, uint256 price) internal {
        prices[asset] = price;
        timestamps[asset] = block.timestamp;
        emit PriceUpdated(asset, price, block.timestamp);
    }
}
