// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * USDC stand-in for tests.
 *
 * Six decimals, matching the ERC-20 interface on Arc. Testing against an
 * 18-decimal default would hide precision bugs that only appear at the real
 * scale — a rounding error invisible at 1e18 is a whole cent at 1e6.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
