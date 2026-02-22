// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IInsuranceFund} from "./interfaces/IInsuranceFund.sol";

contract InsuranceFund is IInsuranceFund, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public collateralToken;
    address public owner;
    address public positionManager;

    uint256 public totalDeposited;
    uint256 public totalCovered;

    modifier onlyOwner() {
        require(msg.sender == owner, "InsuranceFund: not owner");
        _;
    }

    modifier onlyPositionManager() {
        require(msg.sender == positionManager, "InsuranceFund: not position manager");
        _;
    }

    constructor(address _collateralToken) {
        collateralToken = IERC20(_collateralToken);
        owner = msg.sender;
    }

    function setPositionManager(address _pm) external onlyOwner {
        positionManager = _pm;
    }

    /// @notice Deposit USDC into the insurance fund (anyone can deposit)
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "InsuranceFund: zero amount");
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        emit Deposit(msg.sender, amount);
    }

    /// @notice Called by PositionManager when settlement payout exceeds balance
    /// @return covered The actual amount covered (may be less than requested)
    function coverShortfall(uint256 positionId, uint256 amount) external nonReentrant onlyPositionManager returns (uint256 covered) {
        uint256 balance = collateralToken.balanceOf(address(this));
        if (balance == 0) return 0;

        covered = amount > balance ? balance : amount;
        collateralToken.safeTransfer(positionManager, covered);
        totalCovered += covered;

        if (covered < amount) {
            emit PartialCover(positionId, amount, covered);
        } else {
            emit ShortfallCovered(positionId, covered);
        }
    }

    function getBalance() external view returns (uint256) {
        return collateralToken.balanceOf(address(this));
    }

    function getFundHealth() external view returns (uint256 balance, uint256 _totalCovered, uint256 _totalDeposited) {
        balance = collateralToken.balanceOf(address(this));
        _totalCovered = totalCovered;
        _totalDeposited = totalDeposited;
    }
}
