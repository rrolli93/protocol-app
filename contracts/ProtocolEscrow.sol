// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────
//  OpenZeppelin interfaces (import from node_modules in practice)
// ─────────────────────────────────────────────────────────────
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title  ProtocolEscrow
 * @notice USDC escrow for PROTOCOL fitness challenges on Base.
 *
 * Flow:
 *   1. Backend calls createChallenge() when a challenge is created in Supabase.
 *   2. Each participant calls deposit() — USDC is held in this contract.
 *   3. After challenge ends the oracle calls settleChallenge() with winner/loser
 *      lists. Winners split the pot minus a 7.5% protocol fee.
 *   4. Owner can call emergencyRefund() to return all stakes if needed.
 *
 * Base Mainnet USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 */
contract ProtocolEscrow is ReentrancyGuard, Ownable, Pausable {

    // ─── Constants ───────────────────────────────────────────
    /// @dev Fee expressed in basis points (750 = 7.5%)
    uint256 public constant PROTOCOL_FEE_BPS = 750;
    uint256 private constant BPS_DENOMINATOR  = 10_000;

    // ─── State Variables ─────────────────────────────────────
    IERC20 public immutable usdc;

    // ─── Enums ───────────────────────────────────────────────
    enum ChallengeStatus { Created, Active, Settled, Refunded }

    // ─── Structs ─────────────────────────────────────────────
    struct Challenge {
        uint256         stakeAmount;    // USDC amount each participant stakes (6 decimals)
        uint256         endsAt;         // Unix timestamp after which settlement is allowed
        address         oracle;         // Address authorised to call settleChallenge
        ChallengeStatus status;
        address[]       participants;   // All deposited addresses (ordered by deposit time)
        uint256         totalDeposited; // Running total of USDC held for this challenge
    }

    // ─── Storage ─────────────────────────────────────────────
    mapping(bytes32 => Challenge)                       private _challenges;
    /// @dev Tracks whether a specific address has already deposited
    mapping(bytes32 => mapping(address => bool))        private _hasDeposited;

    // ─── Events ──────────────────────────────────────────────
    event ChallengeCreated(
        bytes32 indexed challengeId,
        uint256 stakeAmount,
        uint256 endsAt,
        address indexed oracle
    );

    event Deposited(
        bytes32 indexed challengeId,
        address indexed participant,
        uint256 amount
    );

    event Settled(
        bytes32 indexed challengeId,
        address[] winners,
        uint256   winnerPayout,   // per-winner amount
        uint256   protocolFee,
        address   protocolOwner
    );

    event Refunded(
        bytes32 indexed challengeId,
        uint256 totalRefunded,
        uint256 participantCount
    );

    // ─── Constructor ─────────────────────────────────────────
    /**
     * @param usdcAddress  ERC-20 token used for staking (USDC on Base)
     * @param initialOwner Initial owner — receives protocol fees
     */
    constructor(address usdcAddress, address initialOwner)
        Ownable(initialOwner)
    {
        require(usdcAddress != address(0), "ProtocolEscrow: zero USDC address");
        usdc = IERC20(usdcAddress);
    }

    // ─────────────────────────────────────────────────────────
    //  External — Challenge Lifecycle
    // ─────────────────────────────────────────────────────────

    /**
     * @notice Register a new challenge. Called by the backend service account.
     * @param challengeId  Supabase UUID encoded as bytes32
     * @param stakeAmount  USDC amount (in 6-decimal units) each participant must stake
     * @param endsAt       Unix timestamp after which settlement may be called
     * @param oracle       Address authorised to settle this challenge
     */
    function createChallenge(
        bytes32 challengeId,
        uint256 stakeAmount,
        uint256 endsAt,
        address oracle
    ) external onlyOwner whenNotPaused {
        require(_challenges[challengeId].endsAt == 0, "ProtocolEscrow: challenge already exists");
        require(stakeAmount > 0,         "ProtocolEscrow: stake must be > 0");
        require(endsAt > block.timestamp, "ProtocolEscrow: endsAt in the past");
        require(oracle != address(0),    "ProtocolEscrow: zero oracle address");

        Challenge storage c = _challenges[challengeId];
        c.stakeAmount = stakeAmount;
        c.endsAt      = endsAt;
        c.oracle      = oracle;
        c.status      = ChallengeStatus.Created;

        emit ChallengeCreated(challengeId, stakeAmount, endsAt, oracle);
    }

    /**
     * @notice Join a challenge by depositing the required USDC stake.
     *         Caller must have approved this contract for at least stakeAmount.
     * @param challengeId  The challenge to join
     */
    function deposit(bytes32 challengeId)
        external
        nonReentrant
        whenNotPaused
    {
        Challenge storage c = _challenges[challengeId];

        require(c.endsAt != 0,                        "ProtocolEscrow: unknown challenge");
        require(c.status == ChallengeStatus.Created ||
                c.status == ChallengeStatus.Active,   "ProtocolEscrow: challenge not open");
        require(block.timestamp < c.endsAt,           "ProtocolEscrow: challenge has ended");
        require(!_hasDeposited[challengeId][msg.sender], "ProtocolEscrow: already deposited");

        _hasDeposited[challengeId][msg.sender] = true;
        c.participants.push(msg.sender);
        c.totalDeposited += c.stakeAmount;

        if (c.status == ChallengeStatus.Created) {
            c.status = ChallengeStatus.Active;
        }

        bool ok = usdc.transferFrom(msg.sender, address(this), c.stakeAmount);
        require(ok, "ProtocolEscrow: USDC transfer failed");

        emit Deposited(challengeId, msg.sender, c.stakeAmount);
    }

    /**
     * @notice Settle a challenge after it ends. Only callable by the oracle.
     *         Total pot = (winners + losers) * stakeAmount
     *         Protocol fee = 7.5% of total pot (sent to owner)
     *         Remaining pot split equally among winners.
     *
     * @param challengeId  The challenge to settle
     * @param winners      Addresses that met the challenge goal
     * @param losers       Addresses that failed (used to validate completeness)
     */
    function settleChallenge(
        bytes32   challengeId,
        address[] calldata winners,
        address[] calldata losers
    ) external nonReentrant whenNotPaused {
        Challenge storage c = _challenges[challengeId];

        require(c.endsAt != 0,                      "ProtocolEscrow: unknown challenge");
        require(msg.sender == c.oracle,              "ProtocolEscrow: caller is not oracle");
        require(c.status == ChallengeStatus.Active,  "ProtocolEscrow: challenge not active");
        require(block.timestamp >= c.endsAt,         "ProtocolEscrow: challenge still ongoing");
        require(winners.length + losers.length > 0,  "ProtocolEscrow: no participants provided");

        // Validate that the combined list matches deposited participants
        uint256 totalProvided = winners.length + losers.length;
        require(totalProvided == c.participants.length,
                "ProtocolEscrow: participant count mismatch");

        c.status = ChallengeStatus.Settled;

        uint256 totalPot     = c.totalDeposited;
        uint256 protocolFee  = (totalPot * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 remainingPot = totalPot - protocolFee;

        // Protocol fee → owner
        uint256 winnerPayout = 0;
        if (winners.length > 0) {
            winnerPayout = remainingPot / winners.length;
        }

        // Transfer protocol fee to owner
        if (protocolFee > 0) {
            bool feeOk = usdc.transfer(owner(), protocolFee);
            require(feeOk, "ProtocolEscrow: fee transfer failed");
        }

        // If no winners, remaining pot also goes to owner (edge case)
        if (winners.length == 0) {
            if (remainingPot > 0) {
                bool allToOwner = usdc.transfer(owner(), remainingPot);
                require(allToOwner, "ProtocolEscrow: remaining transfer failed");
            }
        } else {
            // Pay each winner
            for (uint256 i = 0; i < winners.length; i++) {
                require(winners[i] != address(0), "ProtocolEscrow: zero winner address");
                bool winOk = usdc.transfer(winners[i], winnerPayout);
                require(winOk, "ProtocolEscrow: winner transfer failed");
            }

            // Handle dust (rounding remainder) → owner
            uint256 dust = remainingPot - (winnerPayout * winners.length);
            if (dust > 0) {
                bool dustOk = usdc.transfer(owner(), dust);
                require(dustOk, "ProtocolEscrow: dust transfer failed");
            }
        }

        emit Settled(challengeId, winners, winnerPayout, protocolFee, owner());
    }

    /**
     * @notice Emergency refund — cancels a challenge and returns all stakes.
     *         Only callable by the contract owner.
     * @param challengeId  The challenge to refund
     */
    function emergencyRefund(bytes32 challengeId)
        external
        onlyOwner
        nonReentrant
    {
        Challenge storage c = _challenges[challengeId];

        require(c.endsAt != 0,                          "ProtocolEscrow: unknown challenge");
        require(c.status != ChallengeStatus.Settled,    "ProtocolEscrow: already settled");
        require(c.status != ChallengeStatus.Refunded,   "ProtocolEscrow: already refunded");

        c.status = ChallengeStatus.Refunded;

        uint256 count = c.participants.length;
        uint256 total = 0;

        for (uint256 i = 0; i < count; i++) {
            address participant = c.participants[i];
            if (participant != address(0)) {
                total += c.stakeAmount;
                bool ok = usdc.transfer(participant, c.stakeAmount);
                require(ok, "ProtocolEscrow: refund transfer failed");
            }
        }

        emit Refunded(challengeId, total, count);
    }

    // ─────────────────────────────────────────────────────────
    //  View Functions
    // ─────────────────────────────────────────────────────────

    /**
     * @notice Returns the full challenge struct (excluding dynamic arrays).
     */
    function getChallenge(bytes32 challengeId)
        external
        view
        returns (
            uint256         stakeAmount,
            uint256         endsAt,
            address         oracle,
            ChallengeStatus status,
            uint256         totalDeposited,
            uint256         participantCount
        )
    {
        Challenge storage c = _challenges[challengeId];
        return (
            c.stakeAmount,
            c.endsAt,
            c.oracle,
            c.status,
            c.totalDeposited,
            c.participants.length
        );
    }

    /**
     * @notice Returns the full participant address array for a challenge.
     */
    function getParticipants(bytes32 challengeId)
        external
        view
        returns (address[] memory)
    {
        return _challenges[challengeId].participants;
    }

    /**
     * @notice Check whether a specific address has deposited into a challenge.
     */
    function hasDeposited(bytes32 challengeId, address participant)
        external
        view
        returns (bool)
    {
        return _hasDeposited[challengeId][participant];
    }

    // ─────────────────────────────────────────────────────────
    //  Owner — Admin
    // ─────────────────────────────────────────────────────────

    /// @notice Pause all deposits and settlements (emergency stop).
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract.
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Update the oracle for a challenge (e.g. if backend rotates keys).
     */
    function updateOracle(bytes32 challengeId, address newOracle)
        external
        onlyOwner
    {
        require(newOracle != address(0), "ProtocolEscrow: zero oracle address");
        _challenges[challengeId].oracle = newOracle;
    }
}
