"use strict";
import * as BigNumber from "bignumber.js";
import { promisify } from "es6-promisify";
import { Address, DefaultSchemePermissions, Hash, SchemePermissions, SchemeWrapper } from "../commonTypes";
import { ConfigService } from "../configService";
import {
  ArcTransactionDataResult,
  ArcTransactionProposalResult,
  ArcTransactionResult,
  ContractWrapperBase,
  StandardSchemeParams,
  TransactionReceiptTruffle,
} from "../contractWrapperBase";
import { ContractWrapperFactory } from "../contractWrapperFactory";
import { AvatarProposalSpecifier, ProposalService } from "../proposalService";
import { TransactionService } from "../transactionService";
import { Utils } from "../utils";
import { EventFetcherFactory } from "../web3EventService";
import { ProposalExecutedEventResult } from "./commonEventInterfaces";

export class VestingSchemeWrapper extends ContractWrapperBase implements SchemeWrapper {

  public name: string = "VestingScheme";
  public friendlyName: string = "Vesting Scheme";
  public factory: ContractWrapperFactory<VestingSchemeWrapper> = VestingSchemeFactory;
  /**
   * Events
   */

  /* tslint:disable:max-line-length */
  public ProposalExecuted: EventFetcherFactory<ProposalExecutedEventResult> = this.createEventFetcherFactory<ProposalExecutedEventResult>("ProposalExecuted");
  public AgreementProposal: EventFetcherFactory<AgreementProposalEventResult> = this.createEventFetcherFactory<AgreementProposalEventResult>("AgreementProposal");
  public NewVestedAgreement: EventFetcherFactory<NewVestedAgreementEventResult> = this.createEventFetcherFactory<NewVestedAgreementEventResult>("NewVestedAgreement");
  public SignToCancelAgreement: EventFetcherFactory<SignToCancelAgreementEventResult> = this.createEventFetcherFactory<SignToCancelAgreementEventResult>("SignToCancelAgreement");
  public RevokeSignToCancelAgreement: EventFetcherFactory<RevokeSignToCancelAgreementEventResult> = this.createEventFetcherFactory<RevokeSignToCancelAgreementEventResult>("RevokeSignToCancelAgreement");
  public AgreementCancel: EventFetcherFactory<AgreementCancelEventResult> = this.createEventFetcherFactory<AgreementCancelEventResult>("AgreementCancel");
  public Collect: EventFetcherFactory<CollectEventResult> = this.createEventFetcherFactory<CollectEventResult>("Collect");
  /* tslint:enable:max-line-length */

  /**
   * see CreateVestingAgreementConfig
   */
  private defaultCreateOptions: Partial<CommonVestingAgreementConfig> = {
    startingBlock: null,
  };

  /**
   * Propose a new vesting agreement
   * @param {ProposeVestingAgreementConfig} options
   */
  public async propose(
    options: ProposeVestingAgreementConfig = {} as ProposeVestingAgreementConfig)
    : Promise<ArcTransactionProposalResult> {
    /**
     * see ProposeVestingAgreementConfig
     */
    options = Object.assign({}, this.defaultCreateOptions, options);

    if (!options.avatar) {
      throw new Error("avatar is not defined");
    }

    await this.validateCreateParams(options);

    this.logContractFunctionCall("VestingScheme.proposeVestingAgreement", options);

    const web3 = await Utils.getWeb3();

    const txResult = await this.wrapTransactionInvocation("VestingScheme.propose",
      options,
      async () => {
        return this.contract.proposeVestingAgreement(
          options.beneficiaryAddress,
          options.returnOnCancelAddress,
          options.startingBlock,
          web3.toBigNumber(options.amountPerPeriod),
          options.periodLength,
          options.numOfAgreedPeriods,
          options.cliffInPeriods,
          options.signaturesReqToCancel,
          options.signers,
          options.avatar
        );
      });

    return new ArcTransactionProposalResult(txResult.tx);
  }

  /**
   * Create a new vesting agreement
   * @param {CreateVestingAgreementConfig} options
   */
  public async create(
    options: CreateVestingAgreementConfig = {} as CreateVestingAgreementConfig)
    : Promise<ArcTransactionAgreementResult> {
    /**
     * See these properties in CreateVestingAgreementConfig
     */
    options = Object.assign({}, this.defaultCreateOptions, options);

    await this.validateCreateParams(options);

    if (!options.token) {
      throw new Error("token is not defined");
    }

    const web3 = await Utils.getWeb3();

    const amountPerPeriod = web3.toBigNumber(options.amountPerPeriod);
    const autoApproveTransfer = ConfigService.get("autoApproveTokenTransfers");
    const eventTopic = "txReceipts.VestingScheme.create";

    const txReceiptEventPayload = TransactionService.publishKickoffEvent(
      eventTopic,
      options,
      1 + (autoApproveTransfer ? 1 : 0));

    let tx;
    /**
     * approve immediate transfer of the given tokens from currentAccount to the VestingScheme
     */
    if (autoApproveTransfer) {
      const token = await (await Utils.requireContract("StandardToken")).at(options.token) as any;
      tx = await token.approve(this.address, amountPerPeriod.mul(options.numOfAgreedPeriods));
      TransactionService.publishTxEvent(eventTopic, txReceiptEventPayload, tx);
    }

    this.logContractFunctionCall("VestingScheme.createVestedAgreement", options);

    tx = await this.contract.createVestedAgreement(
      options.token,
      options.beneficiaryAddress,
      options.returnOnCancelAddress,
      options.startingBlock,
      amountPerPeriod,
      options.periodLength,
      options.numOfAgreedPeriods,
      options.cliffInPeriods,
      options.signaturesReqToCancel,
      options.signers
    );

    TransactionService.publishTxEvent(eventTopic, txReceiptEventPayload, tx);

    return new ArcTransactionAgreementResult(tx);
  }

  /**
   * Sign to cancel a vesting agreement
   * @param {SignToCancelVestingAgreementConfig} options
   */
  public async signToCancel(
    options: SignToCancelVestingAgreementConfig = {} as SignToCancelVestingAgreementConfig)
    : Promise<ArcTransactionResult> {

    if (options.agreementId === null) {
      throw new Error("agreementId is not defined");
    }

    this.logContractFunctionCall("VestingScheme.signToCancelAgreement", options);

    return this.wrapTransactionInvocation("VestingScheme.signToCancel",
      options,
      () => {
        return this.contract.signToCancelAgreement(options.agreementId);
      });
  }

  /**
   * Revoke vote for cancelling a vesting agreement
   * @param {RevokeSignToCancelVestingAgreementConfig} options
   */
  public async revokeSignToCancel(
    options: RevokeSignToCancelVestingAgreementConfig = {} as RevokeSignToCancelVestingAgreementConfig)
    : Promise<ArcTransactionResult> {

    if (options.agreementId === null) {
      throw new Error("agreementId is not defined");
    }

    this.logContractFunctionCall("VestingScheme.revokeSignToCancelAgreement", options);

    return this.wrapTransactionInvocation("VestingScheme.revokeSignToCancel",
      options,
      () => {
        return this.contract.revokeSignToCancelAgreement(options.agreementId);
      });
  }

  /**
   * Collects for a beneficiary, according to the agreement
   * @param {CollectVestingAgreementConfig} options
   */
  public async collect(
    options: CollectVestingAgreementConfig = {} as CollectVestingAgreementConfig)
    : Promise<ArcTransactionResult> {

    if (options.agreementId === null) {
      throw new Error("agreementId is not defined");
    }

    this.logContractFunctionCall("VestingScheme.collect", options);

    return this.wrapTransactionInvocation("VestingScheme.collect",
      options,
      () => {
        return this.contract.collect(options.agreementId);
      });
  }

  /**
   * Use proposalService to work with VestingScheme proposals.
   */
  public createProposalService(): ProposalService<Agreement> {
    return new ProposalService<Agreement>({
      contract: this.contract,
      convertToProposal:
        (proposalParams: Array<any>, opts: AvatarProposalSpecifier): Agreement =>
          this.convertProposalPropsArrayToObject(proposalParams, opts.proposalId),
      getProposal:
        (options: AvatarProposalSpecifier): Promise<Array<any>> =>
          this.contract.organizationsData(options.avatarAddress, options.proposalId),
      getVotingMachineAddress:
        (avatarAddress: Address): Promise<Address> => this.getVotingMachineAddress(avatarAddress),
      proposalsEventFetcher: this.AgreementProposal,
    });
  }

  public async getVotingMachineAddress(avatarAddress: Address): Promise<Address> {
    return (await this.getSchemeParameters(avatarAddress)).votingMachineAddress;
  }

  public async setParameters(params: StandardSchemeParams): Promise<ArcTransactionDataResult<Hash>> {

    this.validateStandardSchemeParams(params);

    return super._setParameters(
      "VestingScheme.setParameters",
      params.voteParametersHash,
      params.votingMachineAddress
    );
  }

  public getDefaultPermissions(overrideValue?: SchemePermissions): SchemePermissions {
    // return overrideValue || Utils.numberToPermissionsString(DefaultSchemePermissions.VestingScheme);
    return (overrideValue || DefaultSchemePermissions.VestingScheme) as SchemePermissions;
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

  private async validateCreateParams(options: CommonVestingAgreementConfig): Promise<void> {

    if (!options.beneficiaryAddress) {
      throw new Error("beneficiary address is not set");
    }

    if (!options.returnOnCancelAddress) {
      throw new Error("returnOnCancelAddress is not set");
    }

    if (!Number.isInteger(options.signaturesReqToCancel) || (options.signaturesReqToCancel <= 0)) {
      throw new Error("signaturesReqToCancel must be greater than zero");
    }

    if (!Array.isArray(options.signers)) {
      throw new Error("signers is not set");
    }

    if (options.signers.length < 1) {
      throw new Error("the number of signers must be greater than 0");
    }

    if (options.signaturesReqToCancel > options.signers.length) {
      throw new Error("the number of signatures required to cancel cannpt be greater than the number of signers");
    }

    if (!Number.isInteger(options.periodLength) || (options.periodLength <= 0)) {
      throw new Error("periodLength must be greater than zero");
    }

    const web3 = await Utils.getWeb3();

    if (await web3.toBigNumber(options.amountPerPeriod).lte(0)) {
      throw new Error("amountPerPeriod must be greater than zero");
    }

    if (!Number.isInteger(options.numOfAgreedPeriods) || (options.numOfAgreedPeriods <= 0)) {
      throw new Error("numOfAgreedPeriods must be greater than zero");
    }

    if (!Number.isInteger(options.cliffInPeriods) || (options.cliffInPeriods < 0)) {
      throw new Error("cliffInPeriods must be greater than or equal to zero");
    }

    if ((typeof options.startingBlock === "undefined") || (options.startingBlock === null)) {
      options.startingBlock = await promisify(web3.eth.getBlockNumber)().then((bn: number) => bn);
    }

    if (!Number.isInteger(options.startingBlock) || (options.startingBlock < 0)) {
      throw new Error("startingBlock must be greater than or equal to zero");
    }
  }

  private convertProposalPropsArrayToObject(propsArray: Array<any>, proposalId: Hash): Agreement {
    return {
      amountPerPeriod: propsArray[4],
      beneficiaryAddress: propsArray[1],
      cliffInPeriods: propsArray[7],
      collectedPeriods: propsArray[9],
      numOfAgreedPeriods: propsArray[6],
      periodLength: propsArray[5],
      returnOnCancelAddress: propsArray[2],
      signaturesReqToCancel: propsArray[8],
      startingBlock: propsArray[3],
      tokenAddress: propsArray[0],
      proposalId: proposalId
    };
  }
}

export class ArcTransactionAgreementResult extends ArcTransactionResult {

  public agreementId: number;

  constructor(tx: TransactionReceiptTruffle) {
    super(tx);
    this.agreementId = this.getValueFromTx("_agreementId").toNumber();
  }
}

export const VestingSchemeFactory = new ContractWrapperFactory("VestingScheme", VestingSchemeWrapper);

export interface AgreementProposalEventResult {
  /**
   * indexed
   */
  _avatar: Address;
  _proposalId: Hash;
}

export interface NewVestedAgreementEventResult {
  /**
   * indexed
   */
  _agreementId: BigNumber.BigNumber;
}

export interface SignToCancelAgreementEventResult {
  /**
   * indexed
   */
  _agreementId: BigNumber.BigNumber;
  /**
   * indexed
   */
  _signer: Address;
}

export interface RevokeSignToCancelAgreementEventResult {
  /**
   * indexed
   */
  _agreementId: BigNumber.BigNumber;
  /**
   * indexed
   */
  _signer: Address;
}

export interface AgreementCancelEventResult {
  /**
   * indexed
   */
  _agreementId: BigNumber.BigNumber;
}

export interface CollectEventResult {
  /**
   * indexed
   */
  _agreementId: BigNumber.BigNumber;
}

export interface CommonVestingAgreementConfig {
  /**
   * Address of the recipient of the proposed agreement.
   */
  beneficiaryAddress: Address;
  /**
   * Where to send the tokens in case of cancellation
   */
  returnOnCancelAddress: Address;
  /**
   * Optional ethereum block number at which the agreement starts.
   * Default is the current block number.
   * Must be greater than or equal to zero.
   */
  startingBlock?: number;
  /**
   * The number of tokens to pay per period.
   * Period is calculated as (number of blocks / periodLength).
   * Should be expressed in Wei.
   * Must be greater than zero.
   */
  amountPerPeriod: BigNumber.BigNumber | string;
  /**
   * number of blocks in a period.
   * Must be greater than zero.
   */
  periodLength: number;
  /**
   * maximum number of periods that can be paid out.
   * Must be greater than zero.
   */
  numOfAgreedPeriods: number;
  /**
   * The minimum number of periods that must pass before the beneficiary
   * may collect tokens under the agreement.
   * Must be greater than or equal to zero.
   */
  cliffInPeriods: number;
  /**
   * The number of signatures required to cancel agreement.
   * See signToCancel.
   */
  signaturesReqToCancel: number;
  /**
   * An array of addresses of those who will be allowed to sign to cancel an agreement.
   * The length of this array must be greater than or equal to signaturesReqToCancel.
   */
  signers: Array<Address>;
}

export interface CreateVestingAgreementConfig extends CommonVestingAgreementConfig {
  /**
   * The address of the token that will be used to pay for the creation of the agreement.
   * The caller (msg.Sender) must have the funds to pay in that token.
   */
  token: string;
}

export interface ProposeVestingAgreementConfig extends CommonVestingAgreementConfig {
  /**
   * The address of the avatar in which the proposal is being be made.
   */
  avatar: Address;
}

export interface SignToCancelVestingAgreementConfig {
  /**
   * the agreementId
   */
  agreementId: number;
}

export interface RevokeSignToCancelVestingAgreementConfig {
  /**
   * the agreementId
   */
  agreementId: number;
}

export interface CollectVestingAgreementConfig {
  /**
   * the agreementId
   */
  agreementId: number;
}

export interface GetAgreementParams {
  /**
   * The address of the avatar
   */
  avatar: Address;
  /**
   * Optional agreement Id
   */
  agreementId?: number;
}

export interface Agreement {
  amountPerPeriod: BigNumber.BigNumber;
  beneficiaryAddress: Address;
  cliffInPeriods: BigNumber.BigNumber;
  collectedPeriods: BigNumber.BigNumber;
  numOfAgreedPeriods: BigNumber.BigNumber;
  periodLength: BigNumber.BigNumber;
  returnOnCancelAddress: Address;
  signaturesReqToCancel: BigNumber.BigNumber;
  startingBlock: BigNumber.BigNumber;
  tokenAddress: Address;
  proposalId: Hash;
}
