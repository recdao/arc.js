import { BigNumber } from "bignumber.js";
import { Address, Hash } from "./commonTypes";
import { ArcTransactionResult, TransactionReceiptTruffle } from "./contractWrapperBase";
import { Utils } from "./utils";

/**
 * Instantiate a VotingMachineService given the address of any contract
 * that implements the `IntVoteInterface` Arc contract interface.
 */
export class VotingMachineServiceFactory {
  /**
   * Create a new VotingMachineService given a voting machine address
   * @param votingMachineAddress
   */
  public static async create(votingMachineAddress: Address): Promise<VotingMachineService> {
    const contract = await Utils.requireContract("IntVoteInterface");
    return new VotingMachineService(await contract.at(votingMachineAddress));
  }
}

/**
 * Provides the services of any voting machine that implements the `IntVoteInterface`
 * Arc contract interface.  VotingMachineService implements `IntVoteInterface`
 * straight except when transactions are generated then we return `Promise<ArcTransactionResult>`
 * instead of `Promise<TransactionReceiptTruffle>`.
 */
export class VotingMachineService {

  /**
   * Instantiate VotingMachineService given the voting machine's address.
   *
   * @param votingMachineAddress Address of any contract that implements
   * Arc's `IntVoteInterface`.
   */
  constructor(private contract: IntVoteInterface) {
  }

  public async propose(
    numOfChoices: number,
    proposalParameters: Hash,
    avatarAddress: Address,
    execute: ExecutableFunction): Promise<ArcTransactionResult> {

    if (!avatarAddress) {
      throw new Error(`avatar is not defined`);
    }
    if (!proposalParameters) {
      throw new Error(`proposalParameters is not defined`);
    }

    if (!execute) {
      throw new Error(`execute is not defined`);
    }

    if (typeof numOfChoices !== "number") {
      throw new Error(`numOfChoices must be a number`);
    }

    return new ArcTransactionResult(
      await this.contract.propose(numOfChoices, proposalParameters, avatarAddress, execute));
  }

  public async cancelProposal(proposalId: Hash): Promise<ArcTransactionResult> {
    if (!proposalId) {
      throw new Error(`proposalId is not defined`);
    }
    return new ArcTransactionResult(await this.contract.cancelProposal(proposalId));
  }

  public async ownerVote(proposalId: Hash, vote: number, voterAddress: Address): Promise<ArcTransactionResult> {
    if (!proposalId) {
      throw new Error(`proposalId is not defined`);
    }
    this.validateVote(vote);
    if (!voterAddress) {
      throw new Error(`voterAddress is not defined`);
    }
    return new ArcTransactionResult(await this.contract.ownerVote(proposalId, vote, voterAddress));
  }

  public async vote(proposalId: Hash, vote: number): Promise<ArcTransactionResult> {
    if (!proposalId) {
      throw new Error(`proposalId is not defined`);
    }
    this.validateVote(vote);
    return new ArcTransactionResult(await this.contract.vote(proposalId, vote));
  }

  public async voteWithSpecifiedAmounts(
    proposalId: Hash,
    vote: number,
    rep: BigNumber): Promise<ArcTransactionResult> {

    if (!proposalId) {
      throw new Error(`proposalId is not defined`);
    }
    this.validateVote(vote);
    // tokens, the last parameter, is ignored
    return new ArcTransactionResult(
      await this.contract.voteWithSpecifiedAmounts(proposalId, vote, rep, new BigNumber(0)));
  }

  public async cancelVote(proposalId: Hash): Promise<ArcTransactionResult> {
    if (!proposalId) {
      throw new Error(`proposalId is not defined`);
    }
    return new ArcTransactionResult(await this.contract.cancelVote(proposalId));
  }

  public async getNumberOfChoices(proposalId: Hash): Promise<number> {
    if (!proposalId) {
      throw new Error(`proposalId is not defined`);
    }
    return (await this.contract.getNumberOfChoices(proposalId)).toNumber();
  }

  public async isVotable(proposalId: Hash): Promise<boolean> {
    if (!proposalId) {
      throw new Error(`proposalId is not defined`);
    }
    return await this.contract.isVotable(proposalId);
  }

  public async voteStatus(proposalId: Hash, vote: number): Promise<BigNumber> {
    if (!proposalId) {
      throw new Error(`proposalId is not defined`);
    }
    this.validateVote(vote);
    return await this.contract.voteStatus(proposalId, vote);
  }

  public async isAbstainAllow(): Promise<boolean> {
    return await this.contract.isAbstainAllow();
  }

  private validateVote(vote: number): void {
    if ((typeof vote !== "number") || (vote < 0)) {
      throw new Error(`vote must be a number greater than or equal to zero`);
    }
  }
}

export type ExecutableFunction = (proposalId: number, avatar: Address, vote: number) => Promise<ArcTransactionResult>;

export interface ExecutableInterface {
  execute: ExecutableFunction;
}

/**
 * The Arc contract `IntVoteInterface`.
 */
export interface IntVoteInterface extends ExecutableInterface {
  propose(numOfChoices: number,
          proposalParameters: Hash,
          avatar: Address,
          execute: ExecutableFunction): Promise<TransactionReceiptTruffle>;
  cancelProposal(proposalId: Hash): Promise<TransactionReceiptTruffle>;
  ownerVote(proposalId: Hash, vote: number, voter: Address): Promise<TransactionReceiptTruffle>;
  vote(proposalId: Hash, vote: number): Promise<TransactionReceiptTruffle>;
  voteWithSpecifiedAmounts(
    proposalId: Hash,
    vote: number,
    rep: BigNumber,
    token: BigNumber): Promise<TransactionReceiptTruffle>;
  cancelVote(proposalId: Hash): Promise<TransactionReceiptTruffle>;
  getNumberOfChoices(proposalId: Hash): Promise<BigNumber>;
  isVotable(proposalId: Hash): boolean;
  voteStatus(proposalId: Hash, choice: number): Promise<BigNumber>;
  isAbstainAllow(): Promise<boolean>;
}
