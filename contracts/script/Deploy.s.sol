// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {RivoraCreditVault} from "../src/RivoraCreditVault.sol";
import {RivoraCreditManager} from "../src/RivoraCreditManager.sol";
import {RivoraRiskRegistry} from "../src/RivoraRiskRegistry.sol";

// Deploys the protocol contracts to Arc.
//
//   forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast
//
// Circle's Smart Contract Platform can deploy the same bytecode from its API,
// which is the path that keeps the deployer key inside Circle rather than in
// an environment variable. This script is the local equivalent, and is what
// produces the artefacts SCP would upload.
//
// The Revenue Router is *not* deployed here: there is one per borrower, minted
// at registration time, not at protocol deployment.
contract DeployScript is Script {
    // USDC's ERC-20 interface on Arc. A fixed precompile-style address, the
    // same on every Arc network. Six decimals through this interface, even
    // though the native gas token is the same USDC at eighteen.
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        address usdc = vm.envOr("USDC_ADDRESS", ARC_USDC);
        address admin = vm.envAddress("PROTOCOL_ADMIN");
        address underwriter = vm.envAddress("UNDERWRITER_ADDRESS");

        vm.startBroadcast();

        RivoraCreditVault vault = new RivoraCreditVault(IERC20(usdc), admin);
        RivoraRiskRegistry registry = new RivoraRiskRegistry(admin);
        RivoraCreditManager manager = new RivoraCreditManager(IERC20(usdc), vault, registry, admin);

        // The manager is the only contract that may move borrower funds, and
        // the underwriter is the only key whose signature the registry accepts.
        vault.grantRole(vault.CREDIT_MANAGER_ROLE(), address(manager));
        registry.grantRole(registry.UNDERWRITER_ROLE(), underwriter);

        vm.stopBroadcast();

        console.log("chainId          ", block.chainid);
        console.log("usdc             ", usdc);
        console.log("RivoraCreditVault", address(vault));
        console.log("RivoraRiskRegistry", address(registry));
        console.log("RivoraCreditManager", address(manager));
        console.log("");
        console.log("Record these in contracts/deployments/ and apps/api/.env");
    }
}
