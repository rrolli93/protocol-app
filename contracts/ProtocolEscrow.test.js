// ─────────────────────────────────────────────────────────────
//  PROTOCOL — ProtocolEscrow Hardhat Tests
//  Run: npx hardhat test
// ─────────────────────────────────────────────────────────────

const { expect }       = require("chai");
const { ethers }       = require("hardhat");
const { time }         = require("@nomicfoundation/hardhat-network-helpers");

// ─── Helpers ─────────────────────────────────────────────────
const USDC_DECIMALS  = 6n;
const usdc           = (amount) => BigInt(amount) * 10n ** USDC_DECIMALS; // e.g. usdc(10) = 10_000_000

const PROTOCOL_FEE_BPS  = 750n;   // 7.5%
const BPS_DENOMINATOR   = 10_000n;

// Encode a hex string as bytes32 (simulating a Supabase UUID)
function toBytes32(str) {
  return ethers.encodeBytes32String(str).slice(0, 66).padEnd(66, "0");
}

// ─────────────────────────────────────────────────────────────
describe("ProtocolEscrow", function () {
  // ── Fixtures / shared state ──────────────────────────────
  let escrow;
  let mockUSDC;
  let owner, oracle, alice, bob, carol;

  const CHALLENGE_ID   = toBytes32("test-challenge-001");
  const STAKE_AMOUNT   = usdc(10);   // 10 USDC
  const DURATION_SECS  = 7 * 24 * 60 * 60; // 7 days

  // Deploy a minimal ERC-20 mock for USDC
  async function deployMockUSDC(deployer) {
    const MockERC20 = await ethers.getContractFactory("MockERC20", deployer);
    const token = await MockERC20.deploy("USD Coin", "USDC", 6);
    await token.waitForDeployment();
    return token;
  }

  // Deploy ProtocolEscrow pointed at mock USDC
  async function deployEscrow(usdcAddress, ownerAddress) {
    const ProtocolEscrow = await ethers.getContractFactory("ProtocolEscrow");
    const c = await ProtocolEscrow.deploy(usdcAddress, ownerAddress);
    await c.waitForDeployment();
    return c;
  }

  before(async function () {
    [owner, oracle, alice, bob, carol] = await ethers.getSigners();

    mockUSDC = await deployMockUSDC(owner);
    escrow   = await deployEscrow(await mockUSDC.getAddress(), owner.address);

    // Mint USDC to participants
    await mockUSDC.mint(alice.address, usdc(1000));
    await mockUSDC.mint(bob.address,   usdc(1000));
    await mockUSDC.mint(carol.address, usdc(1000));
  });

  // ─────────────────────────────────────────────────────────
  describe("createChallenge()", function () {
    it("should allow owner to create a challenge", async function () {
      const endsAt = (await time.latest()) + DURATION_SECS;

      await expect(
        escrow.connect(owner).createChallenge(
          CHALLENGE_ID,
          STAKE_AMOUNT,
          endsAt,
          oracle.address
        )
      )
        .to.emit(escrow, "ChallengeCreated")
        .withArgs(CHALLENGE_ID, STAKE_AMOUNT, endsAt, oracle.address);

      const [stakeAmount, _endsAt, _oracle, status] = await escrow.getChallenge(CHALLENGE_ID);
      expect(stakeAmount).to.equal(STAKE_AMOUNT);
      expect(_oracle).to.equal(oracle.address);
      expect(status).to.equal(0); // ChallengeStatus.Created
    });

    it("should revert if non-owner tries to create", async function () {
      const otherChallengeId = toBytes32("other-challenge-001");
      const endsAt = (await time.latest()) + DURATION_SECS;

      await expect(
        escrow.connect(alice).createChallenge(
          otherChallengeId, STAKE_AMOUNT, endsAt, oracle.address
        )
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("should revert if challenge already exists", async function () {
      const endsAt = (await time.latest()) + DURATION_SECS;
      await expect(
        escrow.connect(owner).createChallenge(
          CHALLENGE_ID, STAKE_AMOUNT, endsAt, oracle.address
        )
      ).to.be.revertedWith("ProtocolEscrow: challenge already exists");
    });

    it("should revert if endsAt is in the past", async function () {
      const pastEnd = (await time.latest()) - 1;
      await expect(
        escrow.connect(owner).createChallenge(
          toBytes32("past-challenge"), STAKE_AMOUNT, pastEnd, oracle.address
        )
      ).to.be.revertedWith("ProtocolEscrow: endsAt in the past");
    });
  });

  // ─────────────────────────────────────────────────────────
  describe("deposit()", function () {
    it("should allow alice to deposit and become a participant", async function () {
      // Approve escrow to spend Alice's USDC
      await mockUSDC.connect(alice).approve(await escrow.getAddress(), STAKE_AMOUNT);

      const aliceBalanceBefore = await mockUSDC.balanceOf(alice.address);

      await expect(escrow.connect(alice).deposit(CHALLENGE_ID))
        .to.emit(escrow, "Deposited")
        .withArgs(CHALLENGE_ID, alice.address, STAKE_AMOUNT);

      const aliceBalanceAfter = await mockUSDC.balanceOf(alice.address);
      expect(aliceBalanceBefore - aliceBalanceAfter).to.equal(STAKE_AMOUNT);

      // Challenge status should now be Active
      const [, , , status, totalDeposited] = await escrow.getChallenge(CHALLENGE_ID);
      expect(status).to.equal(1); // ChallengeStatus.Active
      expect(totalDeposited).to.equal(STAKE_AMOUNT);

      // Alice should be in participants
      const participants = await escrow.getParticipants(CHALLENGE_ID);
      expect(participants).to.include(alice.address);

      expect(await escrow.hasDeposited(CHALLENGE_ID, alice.address)).to.be.true;
    });

    it("should allow bob to deposit as second participant", async function () {
      await mockUSDC.connect(bob).approve(await escrow.getAddress(), STAKE_AMOUNT);

      await expect(escrow.connect(bob).deposit(CHALLENGE_ID))
        .to.emit(escrow, "Deposited")
        .withArgs(CHALLENGE_ID, bob.address, STAKE_AMOUNT);

      const [, , , , totalDeposited, participantCount] = await escrow.getChallenge(CHALLENGE_ID);
      expect(totalDeposited).to.equal(STAKE_AMOUNT * 2n);
      expect(participantCount).to.equal(2n);
    });

    it("should revert if alice tries to deposit again (double-deposit)", async function () {
      await mockUSDC.connect(alice).approve(await escrow.getAddress(), STAKE_AMOUNT);
      await expect(
        escrow.connect(alice).deposit(CHALLENGE_ID)
      ).to.be.revertedWith("ProtocolEscrow: already deposited");
    });

    it("should revert if no approval given", async function () {
      await expect(
        escrow.connect(carol).deposit(CHALLENGE_ID)
      ).to.be.reverted; // ERC20 insufficient allowance
    });
  });

  // ─────────────────────────────────────────────────────────
  describe("settleChallenge() — 1 winner (alice), 1 loser (bob)", function () {
    let aliceBalanceBefore;
    let ownerBalanceBefore;
    let endsAt;

    before(async function () {
      // Record balances before settlement
      aliceBalanceBefore = await mockUSDC.balanceOf(alice.address);
      ownerBalanceBefore = await mockUSDC.balanceOf(owner.address);

      // Fast-forward past challenge end time
      const [, _endsAt] = await escrow.getChallenge(CHALLENGE_ID);
      endsAt = _endsAt;
      await time.increaseTo(Number(endsAt) + 1);
    });

    it("should revert if non-oracle tries to settle", async function () {
      await expect(
        escrow.connect(alice).settleChallenge(
          CHALLENGE_ID, [alice.address], [bob.address]
        )
      ).to.be.revertedWith("ProtocolEscrow: caller is not oracle");
    });

    it("should revert if participant count mismatches", async function () {
      await expect(
        escrow.connect(oracle).settleChallenge(
          CHALLENGE_ID,
          [alice.address, bob.address],  // 2 winners but 0 losers = 2 total ≠ actual 2 participants (correct count but wrong split — test with 3 total)
          [carol.address]                // carol never deposited, so total = 3 ≠ 2
        )
      ).to.be.revertedWith("ProtocolEscrow: participant count mismatch");
    });

    it("should settle correctly: alice wins, bob loses", async function () {
      const totalPot    = STAKE_AMOUNT * 2n;
      const fee         = (totalPot * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
      const remaining   = totalPot - fee;
      const winnerPayout = remaining; // 1 winner gets everything

      await expect(
        escrow.connect(oracle).settleChallenge(
          CHALLENGE_ID,
          [alice.address],   // winners
          [bob.address]      // losers
        )
      )
        .to.emit(escrow, "Settled")
        .withArgs(
          CHALLENGE_ID,
          [alice.address],
          winnerPayout,
          fee,
          owner.address
        );

      // ── Assert winner received correct payout ──────────
      const aliceBalanceAfter = await mockUSDC.balanceOf(alice.address);
      // Alice paid 10 USDC to enter, gets winnerPayout back
      // Net change = winnerPayout - STAKE_AMOUNT
      const aliceNet = aliceBalanceAfter - aliceBalanceBefore;

      // Total pot = 20 USDC. Fee = 7.5% = 1.5 USDC. Winner gets 18.5 USDC.
      // Alice staked 10, so she nets +8.5 USDC.
      expect(aliceNet).to.equal(winnerPayout - STAKE_AMOUNT);

      // ── Assert protocol fee went to owner ──────────────
      const ownerBalanceAfter = await mockUSDC.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(fee);

      // ── Assert challenge is now Settled ────────────────
      const [, , , status] = await escrow.getChallenge(CHALLENGE_ID);
      expect(status).to.equal(2); // ChallengeStatus.Settled
    });

    it("should revert if trying to settle again", async function () {
      await expect(
        escrow.connect(oracle).settleChallenge(
          CHALLENGE_ID, [alice.address], [bob.address]
        )
      ).to.be.revertedWith("ProtocolEscrow: challenge not active");
    });
  });

  // ─────────────────────────────────────────────────────────
  describe("emergencyRefund()", function () {
    const REFUND_CHALLENGE_ID = toBytes32("refund-challenge-001");

    before(async function () {
      // Create a fresh challenge for the refund test
      const endsAt = (await time.latest()) + DURATION_SECS;
      await escrow.connect(owner).createChallenge(
        REFUND_CHALLENGE_ID, STAKE_AMOUNT, endsAt, oracle.address
      );

      // Alice and Bob deposit
      await mockUSDC.connect(alice).approve(await escrow.getAddress(), STAKE_AMOUNT);
      await escrow.connect(alice).deposit(REFUND_CHALLENGE_ID);

      await mockUSDC.connect(bob).approve(await escrow.getAddress(), STAKE_AMOUNT);
      await escrow.connect(bob).deposit(REFUND_CHALLENGE_ID);
    });

    it("should revert if non-owner tries to refund", async function () {
      await expect(
        escrow.connect(alice).emergencyRefund(REFUND_CHALLENGE_ID)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("should refund all participants and emit Refunded", async function () {
      const aliceBalanceBefore = await mockUSDC.balanceOf(alice.address);
      const bobBalanceBefore   = await mockUSDC.balanceOf(bob.address);

      await expect(
        escrow.connect(owner).emergencyRefund(REFUND_CHALLENGE_ID)
      )
        .to.emit(escrow, "Refunded")
        .withArgs(REFUND_CHALLENGE_ID, STAKE_AMOUNT * 2n, 2n);

      // Both participants get their stake back
      const aliceBalanceAfter = await mockUSDC.balanceOf(alice.address);
      const bobBalanceAfter   = await mockUSDC.balanceOf(bob.address);

      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(STAKE_AMOUNT);
      expect(bobBalanceAfter   - bobBalanceBefore).to.equal(STAKE_AMOUNT);

      // Status should be Refunded
      const [, , , status] = await escrow.getChallenge(REFUND_CHALLENGE_ID);
      expect(status).to.equal(3); // ChallengeStatus.Refunded
    });

    it("should revert if trying to refund twice", async function () {
      await expect(
        escrow.connect(owner).emergencyRefund(REFUND_CHALLENGE_ID)
      ).to.be.revertedWith("ProtocolEscrow: already refunded");
    });
  });

  // ─────────────────────────────────────────────────────────
  describe("Pause / Unpause", function () {
    it("should prevent deposits when paused", async function () {
      const pausedChallengeId = toBytes32("pause-challenge-001");
      const endsAt = (await time.latest()) + DURATION_SECS;
      await escrow.connect(owner).createChallenge(
        pausedChallengeId, STAKE_AMOUNT, endsAt, oracle.address
      );

      await escrow.connect(owner).pause();

      await mockUSDC.connect(carol).approve(await escrow.getAddress(), STAKE_AMOUNT);
      await expect(
        escrow.connect(carol).deposit(pausedChallengeId)
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");

      await escrow.connect(owner).unpause();
    });
  });

  // ─────────────────────────────────────────────────────────
  describe("Fee calculation — sanity checks", function () {
    it("should calculate 7.5% fee correctly for various pot sizes", function () {
      const cases = [
        { pot: usdc(100), expectedFee: usdc(7) + 500000n }, // 7.5 USDC
        { pot: usdc(200), expectedFee: usdc(15) },
        { pot: usdc(1),   expectedFee: 75000n },             // 0.075 USDC
      ];

      for (const { pot, expectedFee } of cases) {
        const fee = (pot * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        expect(fee).to.equal(expectedFee);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────
//  MockERC20 contract (place in contracts/mocks/MockERC20.sol)
// ─────────────────────────────────────────────────────────────
//
//  // SPDX-License-Identifier: MIT
//  pragma solidity ^0.8.20;
//  import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
//
//  contract MockERC20 is ERC20 {
//    uint8 private _decimals;
//    constructor(string memory name, string memory symbol, uint8 decimals_)
//      ERC20(name, symbol) { _decimals = decimals_; }
//    function decimals() public view override returns (uint8) { return _decimals; }
//    function mint(address to, uint256 amount) external { _mint(to, amount); }
//  }
