// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAUSD is ERC20 {
    constructor() ERC20("Mock AUSD", "AUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function faucet() external {
        _mint(msg.sender, 10_000 * 10 ** decimals());
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
