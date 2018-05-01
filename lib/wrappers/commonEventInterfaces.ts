import { BigNumber } from "bignumber.js";
import { Address, Hash } from "../commonTypes";

export interface NewProposalEventResult {
  _numOfChoices: BigNumber;
  _paramsHash: Hash;
  /**
   * indexed
   */
  _proposalId: Hash;
  _proposer: Address;
  _avatar: Address;
}

/**
 * fired by voting machines
 */
export interface ExecuteProposalEventResult {
  /**
   * the vote choice that won.
   */
  _decision: BigNumber;
  /**
   * indexed
   */
  _proposalId: Hash;
  /**
   * The total reputation in the DAO at the time the proposal was executed
   */
  _totalReputation: BigNumber;
}

export interface VoteProposalEventResult {
  /**
   * indexed
   */
  _proposalId: Hash;
  _reputation: BigNumber;
  /**
   * The choice of vote
   */
  _vote: number;
  /**
   * indexed
   */
  _voter: Address;
}

export interface RedeemReputationEventResult {
  _amount: BigNumber;
  /**
   * indexed
   */
  _avatar: Address;
  /**
   * indexed
   */
  _beneficiary: Address;
  /**
   * indexed
   */
  _proposalId: Hash;
}

export interface ProposalDeletedEventResult {
  /**
   * indexed
   */
  _avatar: Address;
  /**
   * indexed
   */
  _proposalId: Hash;
}

/**
 * fired by schemes
 */
export interface ProposalExecutedEventResult {
  /**
   * indexed
   */
  _avatar: Address;
  _param: number;
  /**
   * indexed
   */
  _proposalId: Hash;
}
