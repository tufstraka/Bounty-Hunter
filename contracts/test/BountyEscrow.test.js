const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("BountyEscrow", function () {
  // Test fixtures
  async function deployFixture() {
    const [admin, oracle, creator, solver, feeRecipient, other] = await ethers.getSigners();

    // Deploy mock MNEE token
    const MockToken = await ethers.getContractFactory("MockERC20");
    const mneeToken = await MockToken.deploy("MNEE Token", "MNEE", 18);
    await mneeToken.waitForDeployment();

    // Deploy BountyEscrow
    const BountyEscrow = await ethers.getContractFactory("BountyEscrow");
    const escrow = await BountyEscrow.deploy(
      await mneeToken.getAddress(),
      admin.address,
      oracle.address,
      feeRecipient.address
    );
    await escrow.waitForDeployment();

    // Mint tokens for testing
    const initialBalance = ethers.parseEther("10000");
    await mneeToken.mint(creator.address, initialBalance);
    await mneeToken.mint(admin.address, initialBalance);

    // Approve escrow contract
    await mneeToken.connect(creator).approve(await escrow.getAddress(), ethers.MaxUint256);
    await mneeToken.connect(admin).approve(await escrow.getAddress(), ethers.MaxUint256);

    return { escrow, mneeToken, admin, oracle, creator, solver, feeRecipient, other };
  }

  describe("Deployment", function () {
    it("Should set the correct MNEE token address", async function () {
      const { escrow, mneeToken } = await loadFixture(deployFixture);
      expect(await escrow.mneeToken()).to.equal(await mneeToken.getAddress());
    });

    it("Should set the correct admin role", async function () {
      const { escrow, admin } = await loadFixture(deployFixture);
      const ADMIN_ROLE = await escrow.ADMIN_ROLE();
      expect(await escrow.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should set the correct oracle role", async function () {
      const { escrow, oracle } = await loadFixture(deployFixture);
      const ORACLE_ROLE = await escrow.ORACLE_ROLE();
      expect(await escrow.hasRole(ORACLE_ROLE, oracle.address)).to.be.true;
    });

    it("Should set default configuration", async function () {
      const { escrow } = await loadFixture(deployFixture);
      expect(await escrow.minBountyAmount()).to.equal(ethers.parseEther("1"));
      expect(await escrow.maxBountyAmount()).to.equal(ethers.parseEther("1000000"));
      expect(await escrow.platformFeeBps()).to.equal(250);
    });

    it("Should revert with zero address", async function () {
      const [admin, oracle] = await ethers.getSigners();
      const BountyEscrow = await ethers.getContractFactory("BountyEscrow");
      
      await expect(
        BountyEscrow.deploy(ethers.ZeroAddress, admin.address, oracle.address, admin.address)
      ).to.be.revertedWithCustomError(BountyEscrow, "InvalidConfiguration");
    });
  });

  describe("Create Bounty", function () {
    it("Should create a bounty successfully", async function () {
      const { escrow, mneeToken, creator } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("100");
      const maxAmount = ethers.parseEther("300");
      
      await expect(
        escrow.connect(creator).createBounty(
          "owner/repo",
          1,
          "https://github.com/owner/repo/issues/1",
          amount,
          maxAmount,
          0
        )
      ).to.emit(escrow, "BountyCreated")
        .withArgs(1, creator.address, "owner/repo", 1, amount, maxAmount);
      
      const bounty = await escrow.getBounty(1);
      expect(bounty.creator).to.equal(creator.address);
      expect(bounty.initialAmount).to.equal(amount);
      expect(bounty.currentAmount).to.equal(amount);
      expect(bounty.status).to.equal(0); // Active
    });

    it("Should transfer tokens to escrow", async function () {
      const { escrow, mneeToken, creator } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("100");
      const balanceBefore = await mneeToken.balanceOf(creator.address);
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        1,
        "https://github.com/owner/repo/issues/1",
        amount,
        ethers.parseEther("300"),
        0
      );
      
      const balanceAfter = await mneeToken.balanceOf(creator.address);
      expect(balanceBefore - balanceAfter).to.equal(amount);
      expect(await mneeToken.balanceOf(await escrow.getAddress())).to.equal(amount);
    });

    it("Should reject duplicate bounties for same issue", async function () {
      const { escrow, creator } = await loadFixture(deployFixture);
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        1,
        "https://github.com/owner/repo/issues/1",
        ethers.parseEther("100"),
        ethers.parseEther("300"),
        0
      );
      
      await expect(
        escrow.connect(creator).createBounty(
          "owner/repo",
          1,
          "https://github.com/owner/repo/issues/1",
          ethers.parseEther("50"),
          ethers.parseEther("150"),
          0
        )
      ).to.be.revertedWithCustomError(escrow, "BountyAlreadyExists");
    });

    it("Should reject bounty below minimum amount", async function () {
      const { escrow, creator } = await loadFixture(deployFixture);
      
      await expect(
        escrow.connect(creator).createBounty(
          "owner/repo",
          1,
          "https://github.com/owner/repo/issues/1",
          ethers.parseEther("0.5"),
          ethers.parseEther("1.5"),
          0
        )
      ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });
  });

  describe("Escalate Bounty", function () {
    it("Should escalate bounty by creator", async function () {
      const { escrow, creator } = await loadFixture(deployFixture);
      
      const initialAmount = ethers.parseEther("100");
      const additionalAmount = ethers.parseEther("50");
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        1,
        "https://github.com/owner/repo/issues/1",
        initialAmount,
        ethers.parseEther("300"),
        0
      );
      
      await expect(
        escrow.connect(creator).escalateBounty(1, additionalAmount)
      ).to.emit(escrow, "BountyEscalated")
        .withArgs(1, initialAmount, initialAmount + additionalAmount, 1);
      
      const bounty = await escrow.getBounty(1);
      expect(bounty.currentAmount).to.equal(initialAmount + additionalAmount);
      expect(bounty.escalationCount).to.equal(1);
    });

    it("Should reject escalation beyond max amount", async function () {
      const { escrow, creator } = await loadFixture(deployFixture);
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        1,
        "https://github.com/owner/repo/issues/1",
        ethers.parseEther("100"),
        ethers.parseEther("150"),
        0
      );
      
      await expect(
        escrow.connect(creator).escalateBounty(1, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(escrow, "MaxAmountExceeded");
    });
  });

  describe("Release Bounty", function () {
    it("Should release bounty to solver with correct fee", async function () {
      const { escrow, mneeToken, creator, oracle, solver, feeRecipient } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("100");
      await escrow.connect(creator).createBounty(
        "owner/repo",
        1,
        "https://github.com/owner/repo/issues/1",
        amount,
        ethers.parseEther("300"),
        0
      );
      
      const expectedFee = amount * BigInt(250) / BigInt(10000); // 2.5%
      const expectedSolverAmount = amount - expectedFee;
      
      await expect(
        escrow.connect(oracle).releaseBounty(
          1,
          solver.address,
          "solver-github",
          "https://github.com/owner/repo/pull/2"
        )
      ).to.emit(escrow, "BountyClaimed")
        .withArgs(1, solver.address, "solver-github", expectedSolverAmount, expectedFee, "https://github.com/owner/repo/pull/2");
      
      expect(await mneeToken.balanceOf(solver.address)).to.equal(expectedSolverAmount);
      expect(await mneeToken.balanceOf(feeRecipient.address)).to.equal(expectedFee);
      
      const bounty = await escrow.getBounty(1);
      expect(bounty.status).to.equal(1); // Claimed
      expect(bounty.solver).to.equal(solver.address);
    });

    it("Should reject release from non-oracle", async function () {
      const { escrow, creator, solver, other } = await loadFixture(deployFixture);
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        1,
        "https://github.com/owner/repo/issues/1",
        ethers.parseEther("100"),
        ethers.parseEther("300"),
        0
      );
      
      await expect(
        escrow.connect(other).releaseBounty(1, solver.address, "solver", "https://github.com/pull/1")
      ).to.be.reverted;
    });

    it("Should reject release with zero address solver", async function () {
      const { escrow, creator, oracle } = await loadFixture(deployFixture);
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        1,
        "https://github.com/owner/repo/issues/1",
        ethers.parseEther("100"),
        ethers.parseEther("300"),
        0
      );
      
      await expect(
        escrow.connect(oracle).releaseBounty(1, ethers.ZeroAddress, "solver", "https://github.com/pull/1")
      ).to.be.revertedWithCustomError(escrow, "InvalidSolverAddress");
    });
  });

  describe("Cancel Bounty", function () {
    it("Should cancel bounty and refund creator", async function () {
      const { escrow, mneeToken, creator } = await loadFixture(deployFixture);
      
      const amount = ethers.parseEther("100");
      const balanceBefore = await mneeToken.balanceOf(creator.address);
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        1,
        "https://github.com/owner/repo/issues/1",
        amount,
        ethers.parseEther("300"),
        0
      );
      
      await expect(
        escrow.connect(creator).cancelBounty(1)
      ).to.emit(escrow, "BountyCancelled")
        .withArgs(1, creator.address, amount);
      
      const balanceAfter = await mneeToken.balanceOf(creator.address);
      expect(balanceAfter).to.equal(balanceBefore);
      
      const bounty = await escrow.getBounty(1);
      expect(bounty.status).to.equal(2); // Cancelled
    });

    it("Should reject cancel from non-creator", async function () {
      const { escrow, creator, other } = await loadFixture(deployFixture);
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        1,
        "https://github.com/owner/repo/issues/1",
        ethers.parseEther("100"),
        ethers.parseEther("300"),
        0
      );
      
      await expect(
        escrow.connect(other).cancelBounty(1)
      ).to.be.revertedWithCustomError(escrow, "UnauthorizedCaller");
    });
  });

  describe("Query Functions", function () {
    it("Should get bounty by issue", async function () {
      const { escrow, creator } = await loadFixture(deployFixture);
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        42,
        "https://github.com/owner/repo/issues/42",
        ethers.parseEther("100"),
        ethers.parseEther("300"),
        0
      );
      
      const bounty = await escrow.getBountyByIssue("owner/repo", 42);
      expect(bounty.issueId).to.equal(42);
    });

    it("Should get creator bounties", async function () {
      const { escrow, creator } = await loadFixture(deployFixture);
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        1,
        "https://github.com/owner/repo/issues/1",
        ethers.parseEther("100"),
        ethers.parseEther("300"),
        0
      );
      
      await escrow.connect(creator).createBounty(
        "owner/repo",
        2,
        "https://github.com/owner/repo/issues/2",
        ethers.parseEther("50"),
        ethers.parseEther("150"),
        0
      );
      
      const bountyIds = await escrow.getCreatorBounties(creator.address);
      expect(bountyIds.length).to.equal(2);
      expect(bountyIds[0]).to.equal(1);
      expect(bountyIds[1]).to.equal(2);
    });
  });

  describe("Admin Functions", function () {
    it("Should update configuration", async function () {
      const { escrow, admin, feeRecipient } = await loadFixture(deployFixture);
      
      const newMin = ethers.parseEther("5");
      const newMax = ethers.parseEther("500000");
      const newFee = 500;
      
      await expect(
        escrow.connect(admin).updateConfig(newMin, newMax, newFee, feeRecipient.address)
      ).to.emit(escrow, "ConfigUpdated")
        .withArgs(newMin, newMax, newFee, feeRecipient.address);
      
      expect(await escrow.minBountyAmount()).to.equal(newMin);
      expect(await escrow.maxBountyAmount()).to.equal(newMax);
      expect(await escrow.platformFeeBps()).to.equal(newFee);
    });

    it("Should pause and unpause", async function () {
      const { escrow, admin, creator } = await loadFixture(deployFixture);
      
      await escrow.connect(admin).pause();
      
      await expect(
        escrow.connect(creator).createBounty(
          "owner/repo",
          1,
          "https://github.com/owner/repo/issues/1",
          ethers.parseEther("100"),
          ethers.parseEther("300"),
          0
        )
      ).to.be.reverted;
      
      await escrow.connect(admin).unpause();
      
      await expect(
        escrow.connect(creator).createBounty(
          "owner/repo",
          1,
          "https://github.com/owner/repo/issues/1",
          ethers.parseEther("100"),
          ethers.parseEther("300"),
          0
        )
      ).to.not.be.reverted;
    });
  });
});