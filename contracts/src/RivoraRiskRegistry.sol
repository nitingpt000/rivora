// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import {Tier} from "./RivoraTypes.sol";

/**
 * Signed underwriting assessments.
 *
 * The underwriting engine runs offchain — it reads a revenue history no
 * contract can see. What must be onchain is the *commitment*: which limit was
 * recommended, on what evidence, by whom, and when it expires. Without that,
 * a limit increase is an unattributable state change.
 *
 * EIP-712 rather than a raw hash, so a signer sees structured fields in their
 * wallet instead of an opaque blob, and so a signature for one deployment
 * cannot be replayed against another — the domain separator binds chain id and
 * contract address.
 *
 * Three replay defences, each closing a different hole:
 *  - `nonce`, monotonic per borrower, stops the same assessment being
 *    submitted twice.
 *  - `validUntil`, so a stale favourable assessment cannot be held and
 *    submitted after conditions worsen.
 *  - the EIP-712 domain, so a signature cannot cross chains or contracts.
 */
contract RivoraRiskRegistry is AccessControl, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant UNDERWRITER_ROLE = keccak256("UNDERWRITER_ROLE");

    struct RiskAssessment {
        bytes32 borrowerId;
        uint256 riskScore;
        uint256 recommendedLimit;
        Tier tier;
        /// Hash of the evidence bundle. The bundle itself stays offchain; this
        /// is what makes it tamper-evident.
        bytes32 evidenceHash;
        uint256 validUntil;
        uint256 nonce;
    }

    bytes32 private constant ASSESSMENT_TYPEHASH = keccak256(
        "RiskAssessment(bytes32 borrowerId,uint256 riskScore,uint256 recommendedLimit,uint8 tier,bytes32 evidenceHash,uint256 validUntil,uint256 nonce)"
    );

    /// Latest accepted assessment per borrower.
    mapping(bytes32 borrowerId => RiskAssessment) private _latest;
    /// Next expected nonce per borrower.
    mapping(bytes32 borrowerId => uint256) public nonces;
    /// Full history, for reconstructing how a limit was reached.
    mapping(bytes32 borrowerId => RiskAssessment[]) private _history;

    event AssessmentRecorded(
        bytes32 indexed borrowerId,
        address indexed underwriter,
        uint256 riskScore,
        uint256 recommendedLimit,
        bytes32 evidenceHash,
        uint256 nonce
    );

    error AssessmentExpired(uint256 validUntil, uint256 nowTs);
    error InvalidNonce(uint256 expected, uint256 received);
    error UnauthorizedUnderwriter(address signer);
    error NoAssessment(bytes32 borrowerId);
    error ScoreOutOfRange(uint256 riskScore);

    constructor(address admin) EIP712("RivoraRiskRegistry", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * Records an assessment signed by an authorised underwriter.
     *
     * Deliberately callable by anyone holding a valid signature: the authority
     * is the signature, not the sender. That lets the borrower pay the gas to
     * submit their own limit increase without the underwriting key ever
     * touching a hot wallet.
     */
    function submitAssessment(RiskAssessment calldata assessment, bytes calldata signature)
        external
    {
        if (assessment.riskScore > 100) revert ScoreOutOfRange(assessment.riskScore);

        // Assessment validity is measured in hours. A validator able to nudge
        // the timestamp by seconds gains nothing, and the alternative — a
        // block-number deadline — is worse, because block times vary and the
        // underwriter signs a wall-clock expiry.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > assessment.validUntil) {
            revert AssessmentExpired(assessment.validUntil, block.timestamp);
        }

        uint256 expected = nonces[assessment.borrowerId];
        if (assessment.nonce != expected) {
            revert InvalidNonce(expected, assessment.nonce);
        }

        address signer = _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        ASSESSMENT_TYPEHASH,
                        assessment.borrowerId,
                        assessment.riskScore,
                        assessment.recommendedLimit,
                        uint8(assessment.tier),
                        assessment.evidenceHash,
                        assessment.validUntil,
                        assessment.nonce
                    )
                )
            ).recover(signature);

        if (!hasRole(UNDERWRITER_ROLE, signer)) revert UnauthorizedUnderwriter(signer);

        nonces[assessment.borrowerId] = expected + 1;
        _latest[assessment.borrowerId] = assessment;
        _history[assessment.borrowerId].push(assessment);

        emit AssessmentRecorded(
            assessment.borrowerId,
            signer,
            assessment.riskScore,
            assessment.recommendedLimit,
            assessment.evidenceHash,
            assessment.nonce
        );
    }

    /**
     * The current assessment, if it has not expired.
     *
     * Reverts on an expired one rather than returning it, so a caller cannot
     * accidentally extend credit on stale underwriting by forgetting to check
     * `validUntil`.
     */
    function latestAssessment(bytes32 borrowerId) external view returns (RiskAssessment memory) {
        RiskAssessment memory assessment = _latest[borrowerId];
        if (assessment.validUntil == 0) revert NoAssessment(borrowerId);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > assessment.validUntil) {
            revert AssessmentExpired(assessment.validUntil, block.timestamp);
        }
        return assessment;
    }

    /// Non-reverting variant, for surfaces that want to display a stale value
    /// with an explicit staleness marker rather than an error.
    function peekAssessment(bytes32 borrowerId)
        external
        view
        returns (RiskAssessment memory assessment, bool valid)
    {
        assessment = _latest[borrowerId];
        // forge-lint: disable-next-line(block-timestamp)
        valid = assessment.validUntil != 0 && block.timestamp <= assessment.validUntil;
    }

    function assessmentCount(bytes32 borrowerId) external view returns (uint256) {
        return _history[borrowerId].length;
    }

    function assessmentAt(bytes32 borrowerId, uint256 index)
        external
        view
        returns (RiskAssessment memory)
    {
        return _history[borrowerId][index];
    }

    /// Exposed so an offchain signer can build the exact digest to sign.
    function hashAssessment(RiskAssessment calldata assessment) external view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ASSESSMENT_TYPEHASH,
                    assessment.borrowerId,
                    assessment.riskScore,
                    assessment.recommendedLimit,
                    uint8(assessment.tier),
                    assessment.evidenceHash,
                    assessment.validUntil,
                    assessment.nonce
                )
            )
        );
    }
}
