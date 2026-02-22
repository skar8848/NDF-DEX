// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPriceOracle {
    function getPrice(string calldata asset) external view returns (uint256 price, uint256 timestamp);
    function setPrice(string calldata asset, uint256 price) external;
}
