const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// MNEE Token addresses
const MNEE_ADDRESSES = {
  mainnet: "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF",
  sepolia: null, // Will be set after deploying test token or from env
  localhost: null // Will be set after deploying test token
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║            FixFlow BountyEscrow Deployment                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Determine MNEE token address
  let mneeTokenAddress;
  
  if (process.env.MNEE_TOKEN_ADDRESS) {
    mneeTokenAddress = process.env.MNEE_TOKEN_ADDRESS;
    console.log("Using MNEE token from environment:", mneeTokenAddress);
  } else if (network.name === "mainnet") {
    mneeTokenAddress = MNEE_ADDRESSES.mainnet;
    console.log("Using mainnet MNEE token:", mneeTokenAddress);
  } else if (network.name === "sepolia" || network.name === "localhost" || network.name === "hardhat") {
    // For testnets, deploy a test token first
    console.log("⚠️  No MNEE token address provided for", network.name);
    console.log("   Deploy a test token first using: npm run deploy:test-token");
    console.log("   Then set MNEE_TOKEN_ADDRESS in your .env file\n");
    
    // Check if there's a deployment file with test token
    const deploymentPath = path.join(__dirname, `../deployments/${network.name}.json`);
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      if (deployment.testToken) {
        mneeTokenAddress = deployment.testToken;
        console.log("Found existing test token:", mneeTokenAddress);
      }
    }
    
    if (!mneeTokenAddress) {
      console.error("Error: MNEE_TOKEN_ADDRESS is required for testnet deployment");
      console.error("Run: npm run deploy:test-token -- --network", network.name);
      process.exit(1);
    }
  } else {
    console.error("Unknown network:", network.name);
    process.exit(1);
  }

  // Get configuration from environment
  const oracleAddress = process.env.ORACLE_ADDRESS || deployer.address;
  const feeRecipientAddress = process.env.FEE_RECIPIENT_ADDRESS || deployer.address;

  console.log("\n📋 Deployment Parameters:");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  MNEE Token:      ", mneeTokenAddress);
  console.log("  Admin:           ", deployer.address);
  console.log("  Oracle:          ", oracleAddress);
  console.log("  Fee Recipient:   ", feeRecipientAddress);
  console.log("─────────────────────────────────────────────────────────────\n");

  // Confirm deployment on mainnet
  if (network.name === "mainnet") {
    console.log("⚠️  MAINNET DEPLOYMENT - Please confirm in 5 seconds...");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Deploy BountyEscrow
  console.log("📦 Deploying BountyEscrow contract...");
  const BountyEscrow = await ethers.getContractFactory("BountyEscrow");
  const escrow = await BountyEscrow.deploy(
    mneeTokenAddress,
    deployer.address,
    oracleAddress,
    feeRecipientAddress
  );

  console.log("⏳ Waiting for deployment confirmation...");
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  console.log("\n✅ BountyEscrow deployed successfully!");
  console.log("   Address:", escrowAddress);

  // Wait for confirmations before verification
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n⏳ Waiting for 5 block confirmations...");
    await escrow.deploymentTransaction().wait(5);
    console.log("   Confirmed!");
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      BountyEscrow: escrowAddress,
      MNEEToken: mneeTokenAddress
    },
    roles: {
      admin: deployer.address,
      oracle: oracleAddress,
      feeRecipient: feeRecipientAddress
    },
    verification: {
      command: `npx hardhat verify --network ${network.name} ${escrowAddress} "${mneeTokenAddress}" "${deployer.address}" "${oracleAddress}" "${feeRecipientAddress}"`
    }
  };

  // Save to deployments folder
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentPath = path.join(deploymentsDir, `${network.name}.json`);
  
  // Merge with existing deployment if exists
  let existingDeployment = {};
  if (fs.existsSync(deploymentPath)) {
    existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  }
  
  const mergedDeployment = {
    ...existingDeployment,
    ...deploymentInfo,
    testToken: existingDeployment.testToken // Preserve test token address
  };
  
  fs.writeFileSync(deploymentPath, JSON.stringify(mergedDeployment, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentPath);

  // Print verification command
  console.log("\n📝 To verify on Etherscan, run:");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(deploymentInfo.verification.command);
  console.log("─────────────────────────────────────────────────────────────");

  // Print environment variables to add
  console.log("\n📋 Add to your .env files:");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`# ${network.name.toUpperCase()} Deployment`);
  console.log(`BOUNTY_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`MNEE_TOKEN_ADDRESS=${mneeTokenAddress}`);
  console.log("─────────────────────────────────────────────────────────────");

  console.log("\n🎉 Deployment complete!\n");

  return deploymentInfo;
}

main()
  .then((result) => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });