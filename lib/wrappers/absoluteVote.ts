"use strict";
import { Address, Hash, VoteConfig } from "../commonTypes";

import {
  ArcTransactionDataResult,
  ArcTransactionResult,
  ContractWrapperBase
} from "../contractWrapperBase";
import { ContractWrapperFactory } from "../contractWrapperFactory";
import { ProposalService, VotableProposal } from "../proposalService";
import { VotingMachineService } from "../votingMachineService";
import { EntityFetcherFactory, EventFetcherFactory, Web3EventService } from "../web3EventService";
import {
  NewProposalEventResult,
  VoteProposalEventResult,
  VotingMachineExecuteProposalEventResult
} from "./commonEventInterfaces";

export class AbsoluteVoteWrapper extends ContractWrapperBase {

  public name: string = "AbsoluteVote";
  public friendlyName: string = "Absolute Vote";
  public factory: ContractWrapperFactory<AbsoluteVoteWrapper> = AbsoluteVoteFactory;

  /**
   * Events
   */

  public NewProposal: EventFetcherFactory<NewProposalEventResult>;
  public CancelProposal: EventFetcherFactory<CancelProposalEventResult>;
  public ExecuteProposal: EventFetcherFactory<VotingMachineExecuteProposalEventResult>;
  public VoteProposal: EventFetcherFactory<VoteProposalEventResult>;
  public CancelVoting: EventFetcherFactory<CancelVotingEventResult>;

  /**
   * Vote on a proposal
   * @param {VoteConfig} options
   * @returns Promise<ArcTransactionResult>
   */
  public async vote(options: VoteConfig = {} as VoteConfig): Promise<ArcTransactionResult> {

    const defaults = {
      onBehalfOf: null,
    };

    options = Object.assign({}, defaults, options) as VoteConfig;

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    if (!Number.isInteger(options.vote) || (options.vote < 0) || (options.vote > 2)) {
      throw new Error("vote is not valid");
    }

    this.logContractFunctionCall("AbsoluteVote.vote", options);

    return this.wrapTransactionInvocation("AbsoluteVote.vote",
      options,
      () => {
        return this.contract.vote(
          options.proposalId,
          options.vote,
          options.onBehalfOf ? { from: options.onBehalfOf } : undefined
        );
      });
  }

  /**
   * EntityFetcherFactory for votable proposals.
   * @param avatarAddress
   */
  public get VotableProposals():
    EntityFetcherFactory<VotableProposal, NewProposalEventResult> {

    const votingMachineService = new VotingMachineService(
      this.contract,
      this.address,
      this.web3EventService);

    const proposalService = new ProposalService(this.web3EventService);

    /**
     * TODO:  If we can't get events into IntVoteInterface, when we'll have to
     * adapt AbsoluteVote.NewProposal.  (Note GenesisProtocol is already doing it
     * that way.)
     */
    return proposalService.getVotableProposals(votingMachineService);
  }

  public async setParameters(params: AbsoluteVoteParams): Promise<ArcTransactionDataResult<Hash>> {

    params = Object.assign({},
      {
        ownerVote: true,
        votePerc: 50,
      },
      params);

    if (!params.reputation) {
      throw new Error("reputation must be set");
    }

    return super._setParameters(
      "AbsoluteVote.setParameters",
      params.reputation,
      params.votePerc,
      params.ownerVote
    );
  }

  public async getParameters(paramsHash: Hash): Promise<AbsoluteVoteParamsResult> {
    const params = await this.getParametersArray(paramsHash);
    return {
      ownerVote: params[2],
      reputation: params[0],
      votePerc: params[1].toNumber(),
    };
  }

  protected hydrated(): void {
    /* tslint:disable:max-line-length */
    this.NewProposal = this.createEventFetcherFactory<NewProposalEventResult>(this.contract.NewProposal);
    this.CancelProposal = this.createEventFetcherFactory<CancelProposalEventResult>(this.contract.CancelProposal);
    this.ExecuteProposal = this.createEventFetcherFactory<VotingMachineExecuteProposalEventResult>(this.contract.ExecuteProposal);
    this.VoteProposal = this.createEventFetcherFactory<VoteProposalEventResult>(this.contract.VoteProposal);
    this.CancelVoting = this.createEventFetcherFactory<CancelVotingEventResult>(this.contract.CancelVoting);
    /* tslint:enable:max-line-length */
  }
}

export const AbsoluteVoteFactory =
  new ContractWrapperFactory("AbsoluteVote", AbsoluteVoteWrapper, new Web3EventService());

export interface CancelProposalEventResult {
  /**
   * indexed
   */
  _proposalId: Hash;
}

export interface CancelVotingEventResult {
  /**
   * indexed
   */
  _proposalId: Hash;
  _voter: Address;
}

export interface AbsoluteVoteParams {
  ownerVote?: boolean;
  reputation: string;
  votePerc?: number;
}

export interface AbsoluteVoteParamsResult {
  ownerVote: boolean;
  reputation: string;
  votePerc: number;
}
