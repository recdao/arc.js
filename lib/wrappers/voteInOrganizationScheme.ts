"use strict";
import { BigNumber } from "bignumber.js";
import { Address, DefaultSchemePermissions, Hash, SchemePermissions, SchemeWrapper } from "../commonTypes";
import {
  ArcTransactionDataResult,
  ArcTransactionProposalResult,
  StandardSchemeParams,
} from "../contractWrapperBase";
import { ContractWrapperFactory } from "../contractWrapperFactory";
import { ProposalGeneratorBase } from "../proposalGeneratorBase";
import { AvatarProposalSpecifier, ProposalService } from "../proposalService";
import { EventFetcherFactory, Web3EventService } from "../web3EventService";
import { ProposalDeletedEventResult, ProposalExecutedEventResult } from "./commonEventInterfaces";

export class VoteInOrganizationSchemeWrapper extends ProposalGeneratorBase implements SchemeWrapper {

  public name: string = "VoteInOrganizationScheme";
  public friendlyName: string = "Vote In Organization Scheme";
  public factory: ContractWrapperFactory<VoteInOrganizationSchemeWrapper> = VoteInOrganizationSchemeFactory;
  /**
   * Events
   */

  /* tslint:disable:max-line-length */
  public NewVoteProposal: EventFetcherFactory<NewVoteProposalEventResult> = this.createEventFetcherFactory<NewVoteProposalEventResult>("NewVoteProposal");
  public ProposalExecuted: EventFetcherFactory<ProposalExecutedEventResult> = this.createEventFetcherFactory<ProposalExecutedEventResult>("ProposalExecuted");
  public ProposalDeleted: EventFetcherFactory<ProposalDeletedEventResult> = this.createEventFetcherFactory<ProposalDeletedEventResult>("ProposalDeleted");
  public VoteOnBehalf: EventFetcherFactory<VoteOnBehalfEventResult> = this.createEventFetcherFactory<VoteOnBehalfEventResult>("VoteOnBehalf");
  /* tslint:enable:max-line-length */

  public async proposeVote(
    options: VoteInOrganizationProposeVoteConfig = {} as VoteInOrganizationProposeVoteConfig)
    : Promise<ArcTransactionProposalResult> {

    if (!options.avatar) {
      throw new Error("avatar is not defined");
    }

    if (!options.originalIntVote) {
      throw new Error("originalIntVote is not defined");
    }

    if (!options.originalProposalId) {
      throw new Error("originalProposalId is not defined");
    }

    this.logContractFunctionCall("VoteInOrganizationScheme.proposeVote", options);

    const txResult = await this.wrapTransactionInvocation("VoteInOrganizationScheme.proposeVote",
      options,
      () => {
        return this.contract.proposeVote(
          options.avatar,
          options.originalIntVote,
          options.originalProposalId
        );
      });

    return new ArcTransactionProposalResult(txResult.tx);
  }

  /**
   * Use proposalService to work with VoteInOrganizationScheme proposals.
   */
  public createProposalService(): ProposalService<VoteInOrganizationProposal> {
    return new ProposalService<VoteInOrganizationProposal>({
      contract: this.contract,
      convertToProposal:
        (proposalParams: Array<any>, opts: AvatarProposalSpecifier): VoteInOrganizationProposal =>
          this.convertProposalPropsArrayToObject(proposalParams, opts.proposalId),
      getProposal:
        (options: AvatarProposalSpecifier): Promise<Array<any>> =>
          this.contract.organizationsData(options.avatarAddress, options.proposalId),
      getVotingMachineAddress:
        (avatarAddress: Address): Promise<Address> => this.getVotingMachineAddress(avatarAddress),
      proposalsEventFetcher: this.NewVoteProposal,
    });
  }

  public async getVotingMachineAddress(avatarAddress: Address): Promise<Address> {
    return (await this.getSchemeParameters(avatarAddress)).votingMachineAddress;
  }

  public async setParameters(params: StandardSchemeParams): Promise<ArcTransactionDataResult<Hash>> {

    this.validateStandardSchemeParams(params);

    return super._setParameters(
      "VoteInOrganizationScheme.setParameters",
      params.voteParametersHash,
      params.votingMachineAddress
    );
  }

  public getDefaultPermissions(overrideValue?: SchemePermissions): SchemePermissions {
    // return overrideValue || Utils.numberToPermissionsString(DefaultSchemePermissions.VoteInOrganizationScheme);
    return (overrideValue || DefaultSchemePermissions.VoteInOrganizationScheme) as SchemePermissions;
  }

  public async getSchemePermissions(avatarAddress: Address): Promise<SchemePermissions> {
    return this._getSchemePermissions(avatarAddress);
  }

  public async getSchemeParameters(avatarAddress: Address): Promise<StandardSchemeParams> {
    return this._getSchemeParameters(avatarAddress);
  }

  public async getParameters(paramsHash: Hash): Promise<StandardSchemeParams> {
    const params = await this.getParametersArray(paramsHash);
    return {
      voteParametersHash: params[1],
      votingMachineAddress: params[0],
    };
  }

  private convertProposalPropsArrayToObject(propsArray: Array<any>, proposalId: Hash): VoteInOrganizationProposal {
    return {
      originalIntVote: propsArray[0],
      originalNumOfChoices: propsArray[2].toNumber(),
      originalProposalId: propsArray[1],
      proposalId,
    };
  }
}

export const VoteInOrganizationSchemeFactory =
  new ContractWrapperFactory(
    "VoteInOrganizationScheme",
    VoteInOrganizationSchemeWrapper,
    new Web3EventService());

export interface VoteOnBehalfEventResult {
  _params: Array<Hash>;
}

export interface VoteInOrganizationProposeVoteConfig {
  /**
   * Avatar whose voters are being given the chance to vote on the original proposal.
   */
  avatar: Address;
  /**
   * Address of the voting machine used by the original proposal.  The voting machine must
   * implement IntVoteInterface (as defined in Arc).
   */
  originalIntVote: string;
  /**
   * Address of the "original" proposal for which the DAO's vote will cast.
   */
  originalProposalId: string;
}

export interface VoteInOrganizationProposal {
  originalIntVote: Address;
  originalNumOfChoices: number;
  originalProposalId: Hash;
  proposalId: Hash;
}

export interface NewVoteProposalEventResult {
  /**
   * indexed
   */
  _avatar: Address;
  /**
   * indexed
   */
  _intVoteInterface: Address;
  _originalIntVote: Address;
  _originalProposalId: Hash;
  _originalNumOfChoices: BigNumber;
  /**
   * indexed
   */
  _proposalId: Hash;
}
