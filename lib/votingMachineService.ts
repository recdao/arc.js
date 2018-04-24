import { BigNumber } from "bignumber.js";
import { Address, Hash } from "./commonTypes";
import { ArcTransactionResult, TransactionReceiptTruffle } from "./contractWrapperBase";

export class VotingMachineService {

  /**
   * Instantiate VotingMachineService
   * @param contract Any object that implements IntVoteInterface.
   */
  constructor(private contract: IntVoteInterface) {
  }

  public async propose(numOfChoices: number,
                       proposalParameters: Hash,
                       avatar: Address,
                       execute: ExecutableFunction): Promise<ArcTransactionResult> {
    return new ArcTransactionResult(await this.contract.propose(numOfChoices, proposalParameters, avatar, execute));
  }

  public async cancelProposal(proposalId: Hash): Promise<ArcTransactionResult> {
    return new ArcTransactionResult(await this.contract.cancelProposal(proposalId));
  }
  public async ownerVote(proposalId: Hash, vote: number, voter: Address): Promise<ArcTransactionResult> {
    return new ArcTransactionResult(await this.contract.ownerVote(proposalId, vote, voter));
  }
  public async vote(proposalId: Hash, vote: number): Promise<ArcTransactionResult> {
    return new ArcTransactionResult(await this.contract.vote(proposalId, vote));
  }
  public async voteWithSpecifiedAmounts(
    proposalId: Hash,
    vote: number,
    rep: BigNumber): Promise<ArcTransactionResult> {

    // tokens, the last parameter, is ignored
    return new ArcTransactionResult(
      await this.contract.voteWithSpecifiedAmounts(proposalId, vote, rep, new BigNumber(0)));
  }
  public async cancelVote(proposalId: Hash): Promise<ArcTransactionResult> {
    return new ArcTransactionResult(await this.contract.cancelVote(proposalId));
  }
  public async getNumberOfChoices(proposalId: Hash): Promise<number> {
    return (await this.contract.getNumberOfChoices(proposalId)).toNumber();
  }
  public async isVotable(proposalId: Hash): Promise<boolean> {
    return await this.contract.isVotable(proposalId);
  }
  public async voteStatus(proposalId: Hash, choice: number): Promise<BigNumber> {
    return await this.contract.voteStatus(proposalId, choice);
  }
  public async isAbstainAllow(): Promise<boolean> {
    return await this.contract.isAbstainAllow();
  }
}

export type ExecutableFunction = (proposalId: number, avatar: Address, vote: number) => Promise<ArcTransactionResult>;

export interface ExecutableInterface {
  execute: ExecutableFunction;
}

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
