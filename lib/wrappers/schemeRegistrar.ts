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

export class SchemeRegistrarWrapper extends ProposalGeneratorBase implements SchemeWrapper {

  public name: string = "SchemeRegistrar";
  public friendlyName: string = "Scheme Registrar";
  public factory: ContractWrapperFactory<SchemeRegistrarWrapper> = SchemeRegistrarFactory;
  /**
   * Events
   */

  /* tslint:disable:max-line-length */
  public NewSchemeProposal: EventFetcherFactory<NewSchemeProposalEventResult> = this.createEventFetcherFactory<NewSchemeProposalEventResult>("NewSchemeProposal");
  public RemoveSchemeProposal: EventFetcherFactory<RemoveSchemeProposalEventResult> = this.createEventFetcherFactory<RemoveSchemeProposalEventResult>("RemoveSchemeProposal");
  public ProposalExecuted: EventFetcherFactory<ProposalExecutedEventResult> = this.createEventFetcherFactory<ProposalExecutedEventResult>("ProposalExecuted");
  public ProposalDeleted: EventFetcherFactory<ProposalDeletedEventResult> = this.createEventFetcherFactory<ProposalDeletedEventResult>("ProposalDeleted");
  /* tslint:enable:max-line-length */

  public async proposeToAddModifyScheme(
    options: ProposeToAddModifySchemeParams = {} as ProposeToAddModifySchemeParams)
    : Promise<ArcTransactionProposalResult> {
    /**
     * Note that explicitly supplying any property with a value of undefined will prevent the property
     * from taking on its default value (weird behavior of default-options).
     *
     */
    const defaults = {
      permissions: null,
      schemeName: null,
    };

    options = Object.assign({}, defaults, options);

    if (!options.avatar) {
      throw new Error("avatar is not defined");
    }

    if (!options.schemeAddress) {
      throw new Error("schemeAddress is not defined");
    }

    if (!options.schemeParametersHash) {
      throw new Error("schemeParametersHash is not defined");
    }

    /**
     * throws an Error if not valid, yields 0 if null or undefined
     */
    let permissions: SchemePermissions;

    if (options.schemeName) {
      /**
       * then we are adding/removing an Arc scheme and can get and check its permissions.
       */
      permissions = options.permissions || SchemePermissions[options.schemeName];

      if (permissions > this.getDefaultPermissions()) {
        throw new Error(
          "SchemeRegistrar cannot work with schemes having greater permissions than its own"
        );
      }
    } else {
      permissions = options.permissions;

      if (!permissions) {
        throw new Error(
          "permissions is not defined; it is required for non-Arc schemes (where schemeName is undefined)"
        );
      }
    }

    this.logContractFunctionCall("SchemeRegistrar.proposeScheme", options);

    const txResult = await this.wrapTransactionInvocation("SchemeRegistrar.proposeToAddModifyScheme",
      options,
      () => {
        return this.contract.proposeScheme(
          options.avatar,
          options.schemeAddress,
          options.schemeParametersHash,
          SchemePermissions.toString(permissions)
        );
      });

    return new ArcTransactionProposalResult(txResult.tx);
  }

  public async proposeToRemoveScheme(
    options: ProposeToRemoveSchemeParams = {} as ProposeToRemoveSchemeParams)
    : Promise<ArcTransactionProposalResult> {

    if (!options.avatar) {
      throw new Error("avatar is not defined");
    }

    if (!options.schemeAddress) {
      throw new Error("schemeAddress address is not defined");
    }

    this.logContractFunctionCall("SchemeRegistrar.proposeToRemoveScheme", options);

    const txResult = await this.wrapTransactionInvocation("SchemeRegistrar.proposeToRemoveScheme",
      options,
      () => {
        return this.contract.proposeToRemoveScheme(
          options.avatar,
          options.schemeAddress
        );
      });

    return new ArcTransactionProposalResult(txResult.tx);
  }

  public async setParameters(params: SchemeRegistrarParams): Promise<ArcTransactionDataResult<Hash>> {

    this.validateStandardSchemeParams(params);

    return super._setParameters(
      "SchemeRegistrar.setParameters",
      params.voteParametersHash,
      params.voteRemoveParametersHash ? params.voteRemoveParametersHash : params.voteParametersHash,
      params.votingMachineAddress
    );
  }

  public async getVotingMachineAddress(avatarAddress: Address): Promise<Address> {
    return (await this.getSchemeParameters(avatarAddress)).votingMachineAddress;
  }

  public getDefaultPermissions(overrideValue?: SchemePermissions): SchemePermissions {
    // return overrideValue || Utils.numberToPermissionsString(DefaultSchemePermissions.SchemeRegistrar);
    return (overrideValue || DefaultSchemePermissions.SchemeRegistrar) as SchemePermissions;
  }

  public async getSchemePermissions(avatarAddress: Address): Promise<SchemePermissions> {
    return this._getSchemePermissions(avatarAddress);
  }

  public async getSchemeParameters(avatarAddress: Address): Promise<SchemeRegistrarParams> {
    return this._getSchemeParameters(avatarAddress);
  }

  public async getParameters(paramsHash: Hash): Promise<SchemeRegistrarParams> {
    const params = await this.getParametersArray(paramsHash);
    return {
      voteParametersHash: params[0],
      voteRemoveParametersHash: params[1],
      votingMachineAddress: params[2],
    };
  }

  /**
   * Use proposalServiceNewSchemes to work with proposals to add schemes.
   */
  public createProposalServiceNewSchemes(): ProposalService<SchemeRegistrarProposal> {
    return new ProposalService<SchemeRegistrarProposal>({
      contract: this.contract,
      convertToProposal:
        (proposalParams: Array<any>, opts: AvatarProposalSpecifier): SchemeRegistrarProposal =>
          this.convertProposalPropsArrayToObject(proposalParams, opts.proposalId),
      getProposal:
        (options: AvatarProposalSpecifier): Promise<Array<any>> =>
          this.contract.organizationsProposals(options.avatarAddress, options.proposalId),
      getVotingMachineAddress:
        (avatarAddress: Address): Promise<Address> => this.getVotingMachineAddress(avatarAddress),
      proposalsEventFetcher: this.NewSchemeProposal,
    });
  }

  /**
   * Use proposalServiceRemoveSchemes to work with proposals to add schemes.
   */
  public createProposalServiceRemoveSchemes(): ProposalService<SchemeRegistrarProposal> {
    return new ProposalService<SchemeRegistrarProposal>({
      contract: this.contract,
      convertToProposal:
        (proposalParams: Array<any>, opts: AvatarProposalSpecifier): SchemeRegistrarProposal =>
          this.convertProposalPropsArrayToObject(proposalParams, opts.proposalId),
      getProposal:
        (options: AvatarProposalSpecifier): Promise<Array<any>> =>
          this.contract.organizationsProposals(options.avatarAddress, options.proposalId),
      getVotingMachineAddress:
        (avatarAddress: Address): Promise<Address> => this.getVotingMachineAddress(avatarAddress),
      proposalsEventFetcher: this.RemoveSchemeProposal,
    });
  }

  private convertProposalPropsArrayToObject(propsArray: Array<any>, proposalId: Hash): SchemeRegistrarProposal {
    return {
      parametersHash: propsArray[1],
      permissions: SchemePermissions.fromString(propsArray[3]),
      proposalId,
      proposalType: propsArray[2].toNumber(),
      schemeAddress: propsArray[0],
    };
  }
}

export const SchemeRegistrarFactory =
  new ContractWrapperFactory("SchemeRegistrar", SchemeRegistrarWrapper, new Web3EventService());

export interface NewSchemeProposalEventResult {
  /**
   * indexed
   */
  _avatar: Address;
  /**
   * indexed
   */
  _intVoteInterface: Address;
  _isRegistering: boolean;
  _parametersHash: Hash;
  /**
   * indexed
   */
  _proposalId: Hash;
  _scheme: Address;
}

export interface RemoveSchemeProposalEventResult {
  /**
   * indexed
   */
  _avatar: Address;
  /**
   * indexed
   */
  _intVoteInterface: Address;
  /**
   * indexed
   */
  _proposalId: Hash;
  _scheme: Address;
}

export interface ProposeToAddModifySchemeParams {
  /**
   * avatar address
   */
  avatar: Address;
  /**
   * Optional scheme address.  Supply this if you are submitting a non-Arc scheme
   * or wish to use a different Arc scheme than the default.  In the latter case, you must
   * also supply the schemeName.
   */
  schemeAddress?: Address;
  /**
   * Scheme name, like "SchemeRegistrar" or "ContributionReward".
   * Not required if you are registering a non-arc scheme.
   */
  schemeName?: string | null;
  /**
   * Fash of scheme parameters. These must be already registered with the new scheme.
   */
  schemeParametersHash: string;
  /**
   * Optionally supply values from SchemePermissions or DefaultSchemePermissions.
   *
   * This value is manditory for non-Arc schemes.
   *
   * For Arc schemes the default is taken from DefaultSchemePermissions
   * for the scheme given by schemeName.
   */
  permissions?: SchemePermissions | null;
}

export interface ProposeToRemoveSchemeParams {
  /**
   * avatar address
   */
  avatar: Address;
  /**
   *  the address of the global constraint to remove
   */
  schemeAddress: string;
}

export interface SchemeRegistrarParams extends StandardSchemeParams {
  /**
   * Optional hash of voting machine parameters to use when voting on a
   * proposal to unregister a scheme that is being registered.
   *
   * Default is the value of voteParametersHash.
   */
  voteRemoveParametersHash?: Hash;
}

export enum SchemeRegistrarProposalType {
  Add = 1,
  Remove = 2,
}

export interface SchemeRegistrarProposal {
  schemeAddress: Address;
  parametersHash: Hash;
  proposalType: SchemeRegistrarProposalType;
  permissions: SchemePermissions;
  proposalId: Hash;
}
