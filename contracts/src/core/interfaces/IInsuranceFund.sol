// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IInsuranceFund {
    event Deposit(address indexed from, uint256 amount);
    event ShortfallCovered(uint256 indexed positionId, uint256 amount);
    event PartialCover(uint256 indexed positionId, uint256 requested, uint256 covered);

    function deposit(uint256 amount) external;
    function coverShortfall(uint256 positionId, uint256 amount) external returns (uint256 covered);
    function getBalance() external view returns (uint256);
    function getFundHealth() external view returns (uint256 balance, uint256 totalCovered, uint256 totalDeposited);
}
