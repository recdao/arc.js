"use strict";
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

export class UpgradeSchemeWrapper extends ProposalGeneratorBase implements SchemeWrapper {

  public name: string = "UpgradeScheme";
  public friendlyName: string = "Upgrade Scheme";
  public factory: ContractWrapperFactory<UpgradeSchemeWrapper> = UpgradeSchemeFactory;
  /**
   * Events
   */

  /* tslint:disable:max-line-length */
  public NewUpgradeProposal: EventFetcherFactory<NewUpgradeProposalEventResult> = this.createEventFetcherFactory<NewUpgradeProposalEventResult>("NewUpgradeProposal");
  public ChangeUpgradeSchemeProposal: EventFetcherFactory<ChangeUpgradeSchemeProposalEventResult> = this.createEventFetcherFactory<ChangeUpgradeSchemeProposalEventResult>("ChangeUpgradeSchemeProposal");
  public ProposalExecuted: EventFetcherFactory<ProposalExecutedEventResult> = this.createEventFetcherFactory<ProposalExecutedEventResult>("ProposalExecuted");
  public ProposalDeleted: EventFetcherFactory<ProposalDeletedEventResult> = this.createEventFetcherFactory<ProposalDeletedEventResult>("ProposalDeleted");
  /* tslint:enable:max-line-length */

  /*******************************************
   * proposeController
   */
  public async proposeController(
    options: ProposeControllerParams = {} as ProposeControllerParams)
    : Promise<ArcTransactionProposalResult> {

    if (!options.avatar) {
      throw new Error("avatar address is not defined");
    }

    if (!options.controller) {
      throw new Error("controller address is not defined");
    }

    this.logContractFunctionCall("UpgradeScheme.proposeUpgrade", options);

    const txResult = await this.wrapTransactionInvocation("UpgradeScheme.proposeController",
      options,
      () => {
        return this.contract.proposeUpgrade(
          options.avatar,
          options.controller
        );
      });

    return new ArcTransactionProposalResult(txResult.tx);
  }

  /********************************************
   * proposeUpgradingScheme
   */
  public async proposeUpgradingScheme(
    options: ProposeUpgradingSchemeParams = {} as ProposeUpgradingSchemeParams)
    : Promise<ArcTransactionProposalResult> {

    if (!options.avatar) {
      throw new Error("avatar address is not defined");
    }

    if (!options.scheme) {
      throw new Error("scheme is not defined");
    }

    if (!options.schemeParametersHash) {
      throw new Error("schemeParametersHash is not defined");
    }

    this.logContractFunctionCall("UpgradeScheme.proposeUpgradingScheme", options);

    const txResult = await this.wrapTransactionInvocation("UpgradeScheme.proposeUpgradingScheme",
      options,
      () => {
        return this.contract.proposeChangeUpgradingScheme(
          options.avatar,
          options.scheme,
          options.schemeParametersHash
        );
      });

    return new ArcTransactionProposalResult(txResult.tx);
  }

  public async setParameters(params: StandardSchemeParams): Promise<ArcTransactionDataResult<Hash>> {

    this.validateStandardSchemeParams(params);

    return super._setParameters(
      "UpgradeScheme.setParameters",
      params.voteParametersHash,
      params.votingMachineAddress
    );
  }

  public async getVotingMachineAddress(avatarAddress: Address): Promise<Address> {
    return (await this.getSchemeParameters(avatarAddress)).votingMachineAddress;
  }

  public getDefaultPermissions(overrideValue?: SchemePermissions): SchemePermissions {
    // return overrideValue || Utils.numberToPermissionsString(DefaultSchemePermissions.UpgradeScheme);
    return (overrideValue || DefaultSchemePermissions.UpgradeScheme) as SchemePermissions;
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
      voteParametersHash: params[0],
      votingMachineAddress: params[1],
    };
  }

  /**
   * Use proposalServiceUpgradeUpgradeScheme to work with proposals to change the upgrade scheme.
   */
  public createProposalServiceUpgradeUpgradeScheme(): ProposalService<UpgradeSchemeProposal> {
    return new ProposalService<UpgradeSchemeProposal>({
      contract: this.contract,
      convertToProposal:
        (proposalParams: Array<any>, opts: AvatarProposalSpecifier): UpgradeSchemeProposal =>
          this.convertProposalPropsArrayToObject(proposalParams, opts.proposalId),
      getProposal:
        (options: AvatarProposalSpecifier): Promise<Array<any>> =>
          this.contract.organizationsProposals(options.avatarAddress, options.proposalId),
      getVotingMachineAddress:
        (avatarAddress: Address): Promise<Address> => this.getVotingMachineAddress(avatarAddress),
      proposalsEventFetcher: this.ChangeUpgradeSchemeProposal,
    });
  }

  /**
   * Use proposalServiceUpgradeController to work with proposals to change the controller.
   */
  public createProposalServiceUpgradeController(): ProposalService<UpgradeSchemeProposal> {
    return new ProposalService<UpgradeSchemeProposal>({
      contract: this.contract,
      convertToProposal:
        (proposalParams: Array<any>, opts: AvatarProposalSpecifier): UpgradeSchemeProposal =>
          this.convertProposalPropsArrayToObject(proposalParams, opts.proposalId),
      getProposal:
        (options: AvatarProposalSpecifier): Promise<Array<any>> =>
          this.contract.organizationsProposals(options.avatarAddress, options.proposalId),
      getVotingMachineAddress:
        (avatarAddress: Address): Promise<Address> => this.getVotingMachineAddress(avatarAddress),
      proposalsEventFetcher: this.NewUpgradeProposal,
    });
  }

  private convertProposalPropsArrayToObject(propsArray: Array<any>, proposalId: Hash): UpgradeSchemeProposal {
    return {
      paramsUpgradingScheme: propsArray[1],
      proposalId,
      proposalType: propsArray[2].toNumber(),
      upgradeContractAddress: propsArray[0],
    };
  }
}

export const UpgradeSchemeFactory =
  new ContractWrapperFactory("UpgradeScheme", UpgradeSchemeWrapper, new Web3EventService());

export interface NewUpgradeProposalEventResult {
  /**
   * indexed
   */
  _avatar: Address;
  /**
   * indexed
   */
  _intVoteInterface: Address;
  _newController: Address;
  /**
   * indexed
   */
  _proposalId: Hash;
}

export interface ChangeUpgradeSchemeProposalEventResult {
  /**
   * indexed
   */
  _avatar: Address;
  /**
   * indexed
   */
  _intVoteInterface: Address;
  _params: Hash;
  /**
   * indexed
   */
  _proposalId: Hash;
  _newUpgradeScheme: Address;
}

export interface ProposeUpgradingSchemeParams {
  /**
   * avatar address
   */
  avatar: Address;
  /**
   *  upgrading scheme address
   */
  scheme: string;
  /**
   * hash of the parameters of the upgrading scheme. These must be already registered with the new scheme.
   */
  schemeParametersHash: string;
}

export interface ProposeControllerParams {
  /**
   * avatar address
   */
  avatar: Address;
  /**
   *  controller address
   */
  controller: string;
}

export enum UpgradeSchemeProposalType {
  Controller = 1,
  UpgradeScheme = 2,
}

export interface UpgradeSchemeProposal {
  /**
   * Either a controller or an upgrade scheme.
   */
  upgradeContractAddress: Address;
  paramsUpgradingScheme: Hash;
  proposalType: UpgradeSchemeProposalType;
  proposalId: Hash;
}
