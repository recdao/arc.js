import { BigNumber } from "bignumber.js";
import { Address, HasContract, Hash } from "./commonTypes";
import { ArcTransactionResult } from "./contractWrapperBase";
import { Utils } from "./utils";
import { IntVoteInterface, VotingMachineService } from "./votingMachineService";

/**
 * Instantiate a VotingMachineService given the address of any contract
 * that implements the `IntVoteInterface` Arc contract interface.
 */
export class ProposalVotingMachineServiceFactory {
  /**
   * Create a new VotingMachineService given a voting machine address
   * @param votingMachineAddress
   */
  public static async create(votingMachineAddress: Address, proposalId: Hash): Promise<ProposalVotingMachineService> {
    const contract = await Utils.requireContract("IntVoteInterface");
    return new ProposalVotingMachineService(await contract.at(votingMachineAddress), proposalId);
  }
}

/**
 * Provides the services of any voting machine that implements the `IntVoteInterface`
 * Arc contract interface.  VotingMachineService implements `IntVoteInterface`
 * straight except when transactions are generated then we return `Promise<ArcTransactionResult>`
 * instead of `Promise<TransactionReceiptTruffle>`.
 */
export class ProposalVotingMachineService extends VotingMachineService implements HasContract {
  /**
   * Instantiate VotingMachineService given the voting machine's address.
   *
   * @param votingMachineAddress Address of any contract that implements
   * Arc's `IntVoteInterface`.
   */
  constructor(public contract: IntVoteInterface, public proposalId: Hash) {
    super(contract);
  }

  /**
   * Cancel the given proposal
   * @param proposalId
   */
  public async cancelProposal(): Promise<ArcTransactionResult> {
    return super.cancelProposal(this.proposalId);
  }
  /**
   * Vote on behalf of the owner of the proposal, ie the agent that created it.
   * @param proposalId
   * @param vote What to vote
   * @param voter The owner
   */
  public async ownerVote(vote: number, voterAddress: Address): Promise<ArcTransactionResult> {
    return super.ownerVote(vote, voterAddress, this.proposalId);
  }
  /**
   * Vote on behalf of msgSender
   * @param proposalId
   * @param vote
   */
  public async vote(vote: number): Promise<ArcTransactionResult> {
    return super.vote(vote, this.proposalId);
  }

  /**
   * Vote specified reputation amount
   * @param proposalId
   * @param vote
   * @param rep
   * @param token
   */
  public async voteWithSpecifiedAmounts(vote: number, reputation: BigNumber): Promise<ArcTransactionResult> {
    return super.voteWithSpecifiedAmounts(vote, reputation, this.proposalId);
  }

  /**
   * Cancel voting on the proposal.
   * @param proposalId
   */
  public async cancelVote(): Promise<ArcTransactionResult> {
    return super.cancelVote(this.proposalId);
  }

  /**
   * Get the number of voting choices allowed by the proposal.
   * @param proposalId
   */
  public async getNumberOfChoices(): Promise<number> {
    return super.getNumberOfChoices(this.proposalId);
  }

  /**
   * Get whether the proposal is in a state where it can be voted-upon.
   * @param proposalId
   */
  public async isVotable(): Promise<boolean> {
    return super.isVotable(this.proposalId);
  }

  /**
   * Get the number of votes currently cast on the given choice.
   * @param proposalId
   * @param vote
   */
  public async voteStatus(vote: number): Promise<BigNumber> {
    return super.voteStatus(vote, this.proposalId);
  }

  /**
   * Attempt to execute the given proposal vote.
   * @param proposalId
   */
  public async execute(): Promise<ArcTransactionResult> {
    return super.execute(this.proposalId);
  }
}
