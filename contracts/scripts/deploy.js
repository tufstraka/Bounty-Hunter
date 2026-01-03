const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // MNEE Token address on Ethereum mainnet
  const MNEE_TOKEN_MAINNET = "0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF";
  
  // For testnet/local, use the env variable or deploy a mock
  const mneeTokenAddress = process.env.MNEE_TOKEN_ADDRESS || MNEE_TOKEN_MAINNET;
  const oracleAddress = process.env.ORACLE_ADDRESS || deployer.address;
  const feeRecipientAddress = process.env.FEE_RECIPIENT_ADDRESS || deployer.address;

  console.log("\nDeployment parameters:");
  console.log("- MNEE Token:", mneeTokenAddress);
  console.log("- Admin:", deployer.address);
  console.log("- Oracle:", oracleAddress);
  console.log("- Fee Recipient:", feeRecipientAddress);

  // Deploy BountyEscrow
  const BountyEscrow = await ethers.getContractFactory("BountyEscrow");
  const escrow = await BountyEscrow.deploy(
    mneeTokenAddress,
    deployer.address,   // admin
    oracleAddress,      // oracle (bot)
    feeRecipientAddress // fee recipient
  );

  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  console.log("\n✓ BountyEscrow deployed to:", escrowAddress);

  // Log verification command
  console.log("\nTo verify on Etherscan, run:");
  console.log(`npx hardhat verify --network ${network.name} ${escrowAddress} "${mneeTokenAddress}" "${deployer.address}" "${oracleAddress}" "${feeRecipientAddress}"`);

  // Return deployment info
  return {
    escrow: escrowAddress,
    mneeToken: mneeTokenAddress,
    admin: deployer.address,
    oracle: oracleAddress,
    feeRecipient: feeRecipientAddress
  };
}

main()
  .then((result) => {
    console.log("\nDeployment successful!");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });