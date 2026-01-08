const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy a Test ERC20 Token for testing purposes on testnets
 *
 * This deploys a MockERC20 token that can be used instead of the real MNEE token
 * for testing the BountyEscrow contract on Sepolia or other testnets.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           Test MNEE Token Deployment                       ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Prevent mainnet deployment
  if (network.name === "mainnet") {
    console.error("❌ Cannot deploy test token to mainnet!");
    console.error("   Use the real MNEE token: 0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF");
    process.exit(1);
  }

  // Token configuration
  const tokenName = "Test MNEE";
  const tokenSymbol = "tMNEE";
  const decimals = 18;
  const initialSupply = ethers.parseUnits("1000000000", decimals); // 1 billion tokens

  console.log("📋 Token Configuration:");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  Name:           ", tokenName);
  console.log("  Symbol:         ", tokenSymbol);
  console.log("  Initial Supply: ", ethers.formatUnits(initialSupply, decimals), tokenSymbol);
  console.log("  Decimals:       ", decimals);
  console.log("─────────────────────────────────────────────────────────────\n");

  // Deploy MockERC20 (constructor takes name, symbol, decimals)
  console.log("📦 Deploying MockERC20 token...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy(tokenName, tokenSymbol, decimals);

  console.log("⏳ Waiting for deployment confirmation...");
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log("\n✅ Test Token deployed successfully!");
  console.log("   Address:", tokenAddress);

  // Mint initial supply to deployer
  console.log("\n📦 Minting initial supply to deployer...");
  const mintTx = await token.mint(deployer.address, initialSupply);
  await mintTx.wait();
  console.log("✅ Minted", ethers.formatUnits(initialSupply, decimals), tokenSymbol, "to", deployer.address);

  // Wait for confirmations
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n⏳ Waiting for 3 block confirmations...");
    await token.deploymentTransaction().wait(3);
    console.log("   Confirmed!");
  }

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentPath = path.join(deploymentsDir, `${network.name}.json`);
  
  let existingDeployment = {};
  if (fs.existsSync(deploymentPath)) {
    existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  }
  
  const deployment = {
    ...existingDeployment,
    testToken: tokenAddress,
    testTokenDeployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentPath);

  // Print next steps
  console.log("\n📋 Next Steps:");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("1. Add to your .env file:");
  console.log(`   MNEE_TOKEN_ADDRESS=${tokenAddress}`);
  console.log("");
  console.log("2. Deploy the BountyEscrow contract:");
  console.log(`   npm run deploy:${network.name}`);
  console.log("");
  console.log("3. To get test tokens for an address:");
  console.log(`   The deployer has ${ethers.formatUnits(initialSupply, 18)} ${tokenSymbol}`);
  console.log("─────────────────────────────────────────────────────────────\n");

  return {
    tokenAddress,
    tokenName,
    tokenSymbol,
    initialSupply: initialSupply.toString()
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });