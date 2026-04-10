// ─────────────────────────────────────────────────────────────
//  PROTOCOL — Hardhat Deploy Script
//  Network: Base Sepolia Testnet
//  Usage:   npx hardhat run scripts/deploy.js --network base-sepolia
// ─────────────────────────────────────────────────────────────
//
// hardhat.config.js must include:
//
//   require("@nomicfoundation/hardhat-toolbox");
//   require("dotenv").config();
//
//   module.exports = {
//     solidity: "0.8.20",
//     networks: {
//       "base-sepolia": {
//         url: "https://sepolia.base.org",
//         accounts: [process.env.DEPLOYER_PRIVATE_KEY],
//         chainId: 84532,
//       },
//     },
//     etherscan: {
//       apiKey: {
//         "base-sepolia": process.env.BASESCAN_API_KEY,
//       },
//       customChains: [
//         {
//           network: "base-sepolia",
//           chainId: 84532,
//           urls: {
//             apiURL:  "https://api-sepolia.basescan.org/api",
//             browserURL: "https://sepolia.basescan.org",
//           },
//         },
//       ],
//     },
//   };
//

const { ethers } = require("hardhat");

// ─── Config ──────────────────────────────────────────────────

// Base Sepolia testnet USDC (Circle's official test deployment)
// If Circle hasn't deployed on Sepolia yet, deploy a mock ERC-20 first.
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Base Mainnet USDC (for reference — do NOT use on testnet)
// const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  PROTOCOL — ProtocolEscrow Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Network  : Base Sepolia (chainId 84532)`);
  console.log(`  Deployer : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance  : ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error("Deployer has no ETH. Fund via https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
  }

  console.log(`  USDC addr: ${USDC_BASE_SEPOLIA}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── Deploy ────────────────────────────────────────────────
  console.log("\n⏳ Deploying ProtocolEscrow...");
  const ProtocolEscrow = await ethers.getContractFactory("ProtocolEscrow");
  const escrow = await ProtocolEscrow.deploy(
    USDC_BASE_SEPOLIA,
    deployer.address   // initialOwner — receives protocol fees
  );

  await escrow.waitForDeployment();
  const contractAddress = await escrow.getAddress();

  console.log(`\n✅ ProtocolEscrow deployed at: ${contractAddress}`);

  // ── Verify ────────────────────────────────────────────────
  console.log("\n⏳ Waiting 5 confirmations before verifying on Basescan...");
  const deployTx = escrow.deploymentTransaction();
  if (deployTx) {
    await deployTx.wait(5);
  }

  try {
    console.log("⏳ Verifying on Basescan...");
    const { run } = require("hardhat");
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [USDC_BASE_SEPOLIA, deployer.address],
    });
    console.log("✅ Verified on Basescan");
  } catch (err) {
    if (err.message.includes("Already Verified")) {
      console.log("ℹ️  Contract already verified");
    } else {
      console.warn("⚠️  Verification failed:", err.message);
      console.warn("   Run manually:");
      console.warn(`   npx hardhat verify --network base-sepolia ${contractAddress} "${USDC_BASE_SEPOLIA}" "${deployer.address}"`);
    }
  }

  // ── Summary ───────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  DEPLOYMENT SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Contract : ${contractAddress}`);
  console.log(`  Owner    : ${deployer.address}`);
  console.log(`  USDC     : ${USDC_BASE_SEPOLIA}`);
  console.log(`  Fee      : 7.5% (750 bps)`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📋 Add to your .env:");
  console.log(`   PROTOCOL_ESCROW_ADDRESS=${contractAddress}`);
  console.log(`   USDC_ADDRESS=${USDC_BASE_SEPOLIA}`);
  console.log(`   NETWORK=base-sepolia\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
