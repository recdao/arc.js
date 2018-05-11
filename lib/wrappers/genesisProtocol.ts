"use strict";
import { BigNumber } from "bignumber.js";
import {
  Address,
  BinaryVoteResult,
  DefaultSchemePermissions,
  Hash,
  SchemePermissions,
  SchemeWrapper,
} from "../commonTypes";
import { ConfigService } from "../configService";
import {
  ArcTransactionDataResult,
  ArcTransactionResult
} from "../contractWrapperBase";
import { ContractWrapperFactory, IContractWrapperFactory } from "../contractWrapperFactory";
import { ProposalService } from "../proposalService";
import { TransactionService } from "../transactionService";
import { Utils } from "../utils";
import { OwnerVoteOptions, ProposalIdOption, IntVoteInterfaceWrapper } from "./intVoteInterface";
import { EntityFetcherFactory, EventFetcherFactory, Web3EventService } from "../web3EventService";
import {
  NewProposalEventResult,
  RedeemReputationEventResult,
  VoteProposalEventResult,
  VotingMachineExecuteProposalEventResult,
} from "./commonEventInterfaces";

export class GenesisProtocolWrapper extends IntVoteInterfaceWrapper implements SchemeWrapper {

  public name: string = "GenesisProtocol";
  public friendlyName: string = "Genesis Protocol";
  public factory: IContractWrapperFactory<GenesisProtocolWrapper> = GenesisProtocolFactory;
  /**
   * Events
   */

  public NewProposal: EventFetcherFactory<NewProposalEventResult>;
  public ExecuteProposal: EventFetcherFactory<GenesisProtocolExecuteProposalEventResult>;
  public VoteProposal: EventFetcherFactory<VoteProposalEventResult>;
  public Stake: EventFetcherFactory<StakeEventResult>;
  public Redeem: EventFetcherFactory<RedeemEventResult>;
  public RedeemReputation: EventFetcherFactory<RedeemReputationEventResult>;

  /**
   * Stake some tokens on the final outcome matching this vote.
   *
   * A transfer of tokens from the staker to this GenesisProtocol scheme
   * is automatically approved and executed on the token with which
   * this GenesisProtocol scheme was deployed.
   *
   * @param {StakeConfig} options
   * @returns Promise<ArcTransactionResult>
   */
  public async stake(options: StakeConfig = {} as StakeConfig): Promise<ArcTransactionResult> {

    const defaults = {
      onBehalfOf: null,
    };

    options = Object.assign({}, defaults, options) as StakeConfig;

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this._validateVote(options.vote, options.proposalId);

    const web3 = await Utils.getWeb3();
    const amount = web3.toBigNumber(options.amount);

    if (amount.lte(0)) {
      throw new Error("amount must be > 0");
    }

    const autoApproveTransfer = ConfigService.get("autoApproveTokenTransfers");

    const eventTopic = "txReceipts.GenesisProtocol.stake";

    const txReceiptEventPayload = TransactionService.publishKickoffEvent(
      eventTopic,
      options,
      1 + (autoApproveTransfer ? 1 : 0));

    let tx;
    /**
     * approve immediate transfer of staked tokens from onBehalfOf to this scheme
     */
    if (autoApproveTransfer) {

      const token = await
        (await Utils.requireContract("StandardToken")).at(await this.contract.stakingToken()) as any;

      tx = await token.approve(this.address,
        amount,
        { from: options.onBehalfOf ? options.onBehalfOf : await Utils.getDefaultAccount() });

      TransactionService.publishTxEvent(eventTopic, txReceiptEventPayload, tx);
    }

    this.logContractFunctionCall("GenesisProtocol.stake", options);

    tx = await this.contract.stake(
      options.proposalId,
      options.vote,
      amount,
      options.onBehalfOf ? {
        from: options.onBehalfOf ? options.onBehalfOf :
          await Utils.getDefaultAccount(),
      } : undefined
    );

    TransactionService.publishTxEvent(eventTopic, txReceiptEventPayload, tx);

    return new ArcTransactionResult(tx);
  }

  /**
   * Redeem any tokens and reputation that are due the beneficiary from the outcome of the proposal.
   * @param {RedeemConfig} options
   * @returns Promise<ArcTransactionResult>
   */
  public async redeem(options: RedeemConfig = {} as RedeemConfig): Promise<ArcTransactionResult> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    if (!options.beneficiaryAddress) {
      throw new Error("beneficiaryAddress is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.redeem", options);

    return this.wrapTransactionInvocation("GenesisProtocol.redeem",
      options,
      () => {
        return this.contract.redeem(
          options.proposalId,
          options.beneficiaryAddress
        );
      });
  }

  /**
   * Return whether a proposal should be shifted to the boosted phase.
   * @param {ShouldBoostConfig} options
   * @returns Promise<boolean>
   */
  public async shouldBoost(options: ShouldBoostConfig = {} as ShouldBoostConfig): Promise<boolean> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.shouldBoost", options);

    return this.contract.shouldBoost(options.proposalId);
  }

  /**
   * Return the current proposal score.
   * @param {GetScoreConfig} options
   * @returns Promise<BigNumber>
   */
  public async getScore(options: GetScoreConfig = {} as GetScoreConfig): Promise<BigNumber> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.score", options);

    // TODO:  convert to a number?
    return this.contract.score(options.proposalId);
  }

  /**
   * Return the threshold that is required by a proposal to it shift it into boosted state.
   * The computation depends on the current number of boosted proposals in the DAO
   * as well as the GenesisProtocol parameters thresholdConstA and thresholdConstB.
   * @param {GetThresholdConfig} options
   */
  public getThreshold(options: GetThresholdConfig = {} as GetThresholdConfig): Promise<BigNumber.BigNumber> {

    if (!options.avatar) {
      throw new Error("avatar is not defined");
    }

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.threshold", options);

    return this.contract.threshold(options.proposalId, options.avatar);
  }

  /**
   * Return the token amount to which the given staker is entitled in the event that the proposal is approved.
   * @param {GetRedeemableTokensStakerConfig} opts
   * @returns Promise<BigNumber>
   */
  public async getRedeemableTokensStaker(
    options: GetRedeemableTokensStakerConfig = {} as GetRedeemableTokensStakerConfig)
    : Promise<BigNumber> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    if (!options.beneficiaryAddress) {
      throw new Error("beneficiaryAddress is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.getRedeemableTokensStaker", options);

    return this.contract.getRedeemableTokensStaker(
      options.proposalId,
      options.beneficiaryAddress
    );
  }

  /**
   * Return the reputation amount to which the proposal proposer is entitled in the event that the proposal is approved.
   * @param {GetRedeemableReputationProposerConfig} options
   * @returns Promise<BigNumber>
   */
  public async getRedeemableReputationProposer(
    options: GetRedeemableReputationProposerConfig = {} as GetRedeemableReputationProposerConfig)
    : Promise<BigNumber> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.getRedeemableReputationProposer", options);

    return this.contract.getRedeemableReputationProposer(options.proposalId);
  }

  /**
   * Return the token amount to which the voter is entitled in the event that the proposal is approved.
   * @param {GetRedeemableTokensVoterConfig} options
   * @returns Promise<BigNumber>
   */
  public async getRedeemableTokensVoter(
    options: GetRedeemableTokensVoterConfig = {} as GetRedeemableTokensVoterConfig)
    : Promise<BigNumber> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    if (!options.beneficiaryAddress) {
      throw new Error("beneficiaryAddress is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.getRedeemableTokensVoter", options);

    return this.contract.getRedeemableTokensVoter(
      options.proposalId,
      options.beneficiaryAddress
    );
  }

  /**
   * Return the reputation amount to which the voter is entitled in the event that the proposal is approved.
   * @param {GetRedeemableReputationVoterConfig} options
   * @returns Promise<BigNumber>
   */
  public async getRedeemableReputationVoter(
    options: GetRedeemableReputationVoterConfig = {} as GetRedeemableReputationVoterConfig)
    : Promise<BigNumber> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    if (!options.beneficiaryAddress) {
      throw new Error("beneficiaryAddress is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.getRedeemableReputationVoter", options);

    return this.contract.getRedeemableReputationVoter(
      options.proposalId,
      options.beneficiaryAddress);
  }

  /**
   * Return the reputation amount to which the staker is entitled in the event that the proposal is approved.
   * @param {GetRedeemableReputationStakerConfig} options
   * @returns Promise<BigNumber>
   */
  public async getRedeemableReputationStaker(
    options: GetRedeemableReputationStakerConfig = {} as GetRedeemableReputationStakerConfig)
    : Promise<BigNumber> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    if (!options.beneficiaryAddress) {
      throw new Error("beneficiaryAddress is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.getRedeemableReputationStaker", options);

    return this.contract.getRedeemableReputationStaker(
      options.proposalId,
      options.beneficiaryAddress
    );
  }

  /**
   * Return the vote and the amount of reputation of the voter committed to this proposal
   * @param {GetVoterInfoResult} options
   * @returns Promise<GetVoterInfoResult>
   */
  public async getVoterInfo(
    options: GetVoterInfoConfig = {} as GetVoterInfoConfig)
    : Promise<GetVoterInfoResult> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    if (!options.voter) {
      throw new Error("voter is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.voteInfo", options);

    const result = await this.contract.voteInfo(
      options.proposalId,
      options.voter
    );

    return {
      reputation: result[1],
      vote: result[0].toNumber(),
    };
  }

  /**
   * Returns the reputation currently voted on the given choice.
   * @param {GetVoteStatusConfig} options
   * @returns Promise<BigNumber>
   */
  public async getVoteStatus(
    options: GetVoteStatusConfig = {} as GetVoteStatusConfig)
    : Promise<BigNumber> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this._validateVote(options.vote, options.proposalId);

    this.logContractFunctionCall("GenesisProtocol.voteStatus", options);
    /**
     * an array of number counts for each vote choice
     */
    return this.contract.voteStatus(
      options.proposalId,
      options.vote
    );
  }

  /**
   * Return the total votes, total staked, voter stakes and staker stakes for a given proposal
   * @param {GetProposalStatusConfig} options
   * @returns Promise<GetProposalStatusResult>
   */
  public async getProposalStatus(
    options: GetProposalStatusConfig = {} as GetProposalStatusConfig)
    : Promise<GetProposalStatusResult> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.proposalStatus", options);

    const result = await this.contract.proposalStatus(
      options.proposalId
    );

    return {
      totalStaked: result[2],
      totalStakerStakes: result[1],
      totalVoterStakes: result[3],
      totalVotes: result[0],
    };
  }

  /**
   * Return the DAO avatar address under which the proposal was made
   * @param {GetProposalAvatarConfig} options
   * @returns Promise<string>
   */
  public async getProposalAvatar(
    options: GetProposalAvatarConfig = {} as GetProposalAvatarConfig
  ): Promise<string> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.proposalAvatar", options);

    return this.contract.proposalAvatar(options.proposalId);
  }

  /**
   * Return the score threshold params for the given DAO.
   * @param {GetScoreThresholdParamsConfig} options
   * @returns Promise<GetScoreThresholdParamsResult>
   */
  public async getScoreThresholdParams(
    options: GetScoreThresholdParamsConfig = {} as GetScoreThresholdParamsConfig)
    : Promise<GetScoreThresholdParamsResult> {

    if (!options.avatar) {
      throw new Error("avatar is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.scoreThresholdParams", options);

    const result = await this.contract.scoreThresholdParams(options.avatar);

    return {
      thresholdConstA: result[0],
      thresholdConstB: result[1].toNumber(),
    };
  }

  /**
   * Return the vote and stake amount for a given proposal and staker.
   * @param {GetStakerInfoConfig} options
   * @returns Promise<GetStakerInfoResult>
   */
  public async getStakerInfo(
    options: GetStakerInfoConfig = {} as GetStakerInfoConfig)
    : Promise<GetStakerInfoResult> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    if (!options.staker) {
      throw new Error("staker is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.staker", options);

    const result = await this.contract.staker(
      options.proposalId,
      options.staker
    );

    return {
      stake: result[1],
      vote: result[0].toNumber(),
    };
  }

  /**
   * Return the amount stakes behind a given proposal and vote.
   * @param {GetVoteStakeConfig} options
   * @returns Promise<BigNumber>
   */
  public async getVoteStake(
    options: GetVoteStakeConfig = {} as GetVoteStakeConfig)
    : Promise<BigNumber> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this._validateVote(options.vote, options.proposalId);

    this.logContractFunctionCall("GenesisProtocol.voteStake", options);

    return this.contract.voteStake(
      options.proposalId,
      options.vote
    );
  }

  /**
   * Return the winningVote for a given proposal.
   * @param {GetWinningVoteConfig} options
   * @returns Promise<number>
   */
  public async getWinningVote(
    options: GetWinningVoteConfig = {} as GetWinningVoteConfig)
    : Promise<number> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.winningVote", options);

    const winningVote = await this.contract.winningVote(options.proposalId);

    return winningVote.toNumber();
  }

  /**
   * Return the current state of a given proposal.
   * @param {GetStateConfig} options
   * @returns Promise<number>
   */
  public async getState(options: GetStateConfig = {} as GetStateConfig): Promise<ProposalState> {

    if (!options.proposalId) {
      throw new Error("proposalId is not defined");
    }

    this.logContractFunctionCall("GenesisProtocol.state", options);

    const state = await this.contract.state(options.proposalId);

    return state.toNumber();
  }

  /**
   * EntityFetcherFactory for votable GenesisProtocolProposal.
   * @param avatarAddress
   */
  public get VotableGenesisProtocolProposals():
    EntityFetcherFactory<GenesisProtocolProposal, NewProposalEventResult> {

    const proposalService = new ProposalService(this.web3EventService);

    return proposalService.getProposalEvents({
      proposalsEventFetcher: this.NewProposal,
      transformEventCallback: async (args: NewProposalEventResult): Promise<GenesisProtocolProposal> => {
        return this.getProposal(args._proposalId);
      },
      votableOnly: true,
      votingMachine: this,
    });
  }

  /**
   * Cancel the given proposal
   * @param options
   */
  public async cancelProposal(options: ProposalIdOption): Promise<ArcTransactionResult> {
    throw new Error("GenesisProtocol does not support cancelProposal");
  }

  public async ownerVote(options: OwnerVoteOptions): Promise<ArcTransactionResult> {
    throw new Error("GenesisProtocol does not support ownerVote");
  }

  public async cancelVote(options: ProposalIdOption): Promise<ArcTransactionResult> {
    throw new Error("GenesisProtocol does not support cancelVote");
  }

  /**
   * EntityFetcherFactory for executed ExecutedGenesisProposal.
   * The Arc GenesisProtocol contract retains the original proposal struct after execution.
   * @param avatarAddress
   */
  public get ExecutedProposals():
    EntityFetcherFactory<ExecutedGenesisProposal, GenesisProtocolExecuteProposalEventResult> {

    return this.web3EventService
      .createEntityFetcherFactory<ExecutedGenesisProposal, GenesisProtocolExecuteProposalEventResult>(
        this.ExecuteProposal,
        async (args: GenesisProtocolExecuteProposalEventResult): Promise<ExecutedGenesisProposal> => {
          const proposal = await this.getProposal(args._proposalId);
          return Object.assign(proposal, {
            decision: args._decision.toNumber(),
            executionState: args._executionState.toNumber(),
            totalReputation: args._totalReputation,
          });
        });
  }

  public async getProposal(proposalId: Hash): Promise<GenesisProtocolProposal> {
    const proposalParams = await this.contract.proposals(proposalId);
    return this.convertProposalPropsArrayToObject(proposalParams, proposalId);
  }

  /**
   * Set the contract parameters.
   * @param {GenesisProtocolParams} params
   * @returns parameters hash
   */
  public async setParameters(params: GenesisProtocolParams): Promise<ArcTransactionDataResult<Hash>> {

    params = Object.assign({},
      await GetDefaultGenesisProtocolParameters(),
      params);

    // in Wei
    const web3 = await Utils.getWeb3();
    const maxEthValue = web3.toBigNumber(10).pow(26);

    const proposingRepRewardConstA = web3.toBigNumber(params.proposingRepRewardConstA);

    if (proposingRepRewardConstA.lt(0)) {
      throw new Error("proposingRepRewardConstA must be greater than or equal to 0");
    }

    if (proposingRepRewardConstA.gt(maxEthValue)) {
      throw new Error(`proposingRepRewardConstA must be less than ${maxEthValue}`);
    }

    const proposingRepRewardConstB = params.proposingRepRewardConstB || 0;

    if ((proposingRepRewardConstB < 0) || (proposingRepRewardConstB > 100)) {
      throw new Error("proposingRepRewardConstB must be greater than or equal to 0 and less than or equal to 100");
    }

    const thresholdConstA = web3.toBigNumber(params.thresholdConstA);

    if (thresholdConstA.lt(0)) {
      throw new Error("thresholdConstA must be greater than or equal to 0");
    }

    if (thresholdConstA.gt(maxEthValue)) {
      throw new Error(`thresholdConstA must be less than ${maxEthValue}`);
    }

    const thresholdConstB = web3.toBigNumber(params.thresholdConstB);

    if (thresholdConstB.lte(0)) {
      throw new Error("thresholdConstB must be greater than 0");
    }

    /**
     * thresholdConstB is a number, and is not supposed to be in Wei (unlike the other
     * params checked above), but we check this condition anyways as not everyone
     * may be using the type checking of TypeScript, and it is a condition in the Solidity code.
     */
    if (thresholdConstB.gt(maxEthValue)) {
      throw new Error(`thresholdConstB must be less than ${maxEthValue}`);
    }

    const preBoostedVoteRequiredPercentage = params.preBoostedVoteRequiredPercentage || 0;

    if ((preBoostedVoteRequiredPercentage <= 0) || (preBoostedVoteRequiredPercentage > 100)) {
      throw new Error("preBoostedVoteRequiredPercentage must be greater than 0 and less than or equal to 100");
    }

    const stakerFeeRatioForVoters = params.stakerFeeRatioForVoters || 0;

    if ((stakerFeeRatioForVoters < 0) || (stakerFeeRatioForVoters > 100)) {
      throw new Error("stakerFeeRatioForVoters must be greater than or equal to 0 and less than or equal to 100");
    }

    const votersGainRepRatioFromLostRep = params.votersGainRepRatioFromLostRep || 0;

    if ((votersGainRepRatioFromLostRep < 0) || (votersGainRepRatioFromLostRep > 100)) {
      throw new Error("votersGainRepRatioFromLostRep must be greater than or equal to 0 and less than or equal to 100");
    }

    const votersReputationLossRatio = params.votersReputationLossRatio || 0;

    if ((votersReputationLossRatio < 0) || (votersReputationLossRatio > 100)) {
      throw new Error("votersReputationLossRatio must be greater than or equal to  0 and less than or equal to 100");
    }

    return super._setParameters(
      "GenesisProtocol.setParameters",
      [
        preBoostedVoteRequiredPercentage,
        params.preBoostedVotePeriodLimit,
        params.boostedVotePeriodLimit,
        thresholdConstA,
        thresholdConstB,
        params.minimumStakingFee,
        params.quietEndingPeriod,
        proposingRepRewardConstA,
        proposingRepRewardConstB,
        stakerFeeRatioForVoters,
        votersReputationLossRatio,
        votersGainRepRatioFromLostRep,
      ]
    );
  }

  public async getVotingMachineAddress(avatarAddress: Address): Promise<Address> {
    return Promise.resolve(this.address);
  }

  public getDefaultPermissions(overrideValue?: SchemePermissions): SchemePermissions {
    // return overrideValue || Utils.numberToPermissionsString(DefaultSchemePermissions.GenesisProtocol);
    return (overrideValue || DefaultSchemePermissions.GenesisProtocol) as SchemePermissions;
  }

  public async getSchemePermissions(avatarAddress: Address): Promise<SchemePermissions> {
    return this._getSchemePermissions(avatarAddress);
  }

  public async getSchemeParameters(avatarAddress: Address): Promise<GenesisProtocolParams> {
    return this._getSchemeParameters(avatarAddress);
  }

  public async getParameters(paramsHash: Hash): Promise<GenesisProtocolParams> {
    const params = await this.getParametersArray(paramsHash);
    return {
      boostedVotePeriodLimit: params[2].toNumber(),
      minimumStakingFee: params[5].toNumber(),
      preBoostedVotePeriodLimit: params[1].toNumber(),
      preBoostedVoteRequiredPercentage: params[0].toNumber(),
      proposingRepRewardConstA: params[7],
      proposingRepRewardConstB: params[8],
      quietEndingPeriod: params[6].toNumber(),
      stakerFeeRatioForVoters: params[9].toNumber(),
      thresholdConstA: params[3],
      thresholdConstB: params[4].toNumber(),
      votersGainRepRatioFromLostRep: params[11].toNumber(),
      votersReputationLossRatio: params[10].toNumber(),
    };
  }

  protected hydrated(): void {
    /* tslint:disable:max-line-length */
    this.NewProposal = this.createEventFetcherFactory<NewProposalEventResult>(this.contract.NewProposal);
    this.ExecuteProposal = this.createEventFetcherFactory<GenesisProtocolExecuteProposalEventResult>(this.contract.ExecuteProposal);
    this.VoteProposal = this.createEventFetcherFactory<VoteProposalEventResult>(this.contract.VoteProposal);
    this.Stake = this.createEventFetcherFactory<StakeEventResult>(this.contract.Stake);
    this.Redeem = this.createEventFetcherFactory<RedeemEventResult>(this.contract.Redeem);
    this.RedeemReputation = this.createEventFetcherFactory<RedeemReputationEventResult>(this.contract.RedeemReputation);
    /* tslint:enable:max-line-length */
  }

  private convertProposalPropsArrayToObject(proposalArray: Array<any>, proposalId: Hash): GenesisProtocolProposal {
    return {
      avatarAddress: proposalArray[0],
      boostedPhaseTime: proposalArray[7],
      currentBoostedVotePeriodLimit: proposalArray[12],
      executable: proposalArray[2],
      lostReputation: proposalArray[5],
      numOfChoices: proposalArray[1].toNumber(),
      paramsHash: proposalArray[13],
      proposalId,
      proposer: proposalArray[11],
      state: proposalArray[9],
      submittedTime: proposalArray[6],
      totalVotes: proposalArray[3],
      votersStakes: proposalArray[4],
      winningVote: proposalArray[10],
    };
  }
}

/**
 * defined just to add good type checking
 */
export class GenesisProtocolFactoryType extends ContractWrapperFactory<GenesisProtocolWrapper> {
  /**
   * Migrate a new instance of GenesisProtocol.
   * @param stakingTokenAddress The token that will be used when staking.  Typically
   * is the token of the DAO that is going to use this GenesisProtocol.
   */
  public async new(stakingTokenAddress: Address): Promise<GenesisProtocolWrapper> {
    return super.new(stakingTokenAddress);
  }
}

export const GenesisProtocolFactory =
  new GenesisProtocolFactoryType(
    "GenesisProtocol",
    GenesisProtocolWrapper,
    new Web3EventService()) as GenesisProtocolFactoryType;

export interface StakeEventResult {
  _amount: BigNumber;
  /**
   * indexed
   */
  _proposalId: Hash;
  _vote: number;
  /**
   * indexed
   */
  _voter: Address;
}

export interface RedeemEventResult {
  _amount: BigNumber;
  /**
   * indexed
   */
  _beneficiary: Address;
  /**
   * indexed
   */
  _proposalId: Hash;
}

export interface GenesisProtocolParams {
  /**
   * The percentage of the absolute vote that must be exceeded to result in a win.
   * Must be between 0 and 100.
   * Default is 50.
   */
  preBoostedVoteRequiredPercentage: number;
  /**
   * The time limit in seconds for a proposal to be in an absolute voting mode.
   * Default is 5184000 (two months).
   */
  preBoostedVotePeriodLimit: number;
  /**
   * The time limit in seconds for a proposal to be in an relative voting mode.
   * Default is 604800 (one week).
   */
  boostedVotePeriodLimit: number;
  /**
   * Constant A in the threshold calculation,in Wei. See [[GenesisProtocolWrapper.getThreshold]].
   * Default is 2, converted to Wei
   */
  thresholdConstA: BigNumber | string;
  /**
   * Constant B in the threshold calculation. See [[GenesisProtocolWrapper.getThreshold]].
   * Default is 10
   */
  thresholdConstB: number;
  /**
   * A floor on the staking fee which is normally computed using [[GenesisProtocolParams.stakerFeeRatioForVoters]].
   * Default is 0
   */
  minimumStakingFee: number;
  /**
   * The duration of the quietEndingPeriod, in seconds.
   * Default is 7200 (two hours)
   */
  quietEndingPeriod: number;
  /**
   * Constant A in the calculation of the proposer's reward, in Wei
   * See [[GenesisProtocolWrapper.getRedeemableReputationProposer]].
   * Default is 5, converted to Wei.
   */
  proposingRepRewardConstA: BigNumber | string;
  /**
   * Constant B in the calculation of the proposer's reward.
   * See [[GenesisProtocolWrapper.getRedeemableReputationProposer]].
   * Must be between 0 and 100.
   * Default is 1.
   */
  proposingRepRewardConstB: number;
  /**
   * The percentage of a stake that is given to all voters.
   * Voters (pre and during boosting period) share this amount in proportion to their reputation.
   * Must be between 0 and 100.
   * Default is 1.
   */
  stakerFeeRatioForVoters: number;
  /**
   * The percentage of lost reputation, in proportion to voters' reputation.
   * Must be between 0 and 100.
   * Default is 80
   */
  votersGainRepRatioFromLostRep: number;
  /**
   * The percentage of reputation that is lost by pre-booster voters.
   * Must be between 0 and 100.
   * Default is 1
   */
  votersReputationLossRatio: number;
}

export interface GetVoterInfoResult {
  vote: number;
  reputation: BigNumber;
}

export interface GetProposalStatusResult {
  /**
   * Amount of reputation voted
   */
  totalVotes: BigNumber;
  /**
   * Number of staked tokens currently redeemable by stakers
   */
  totalStakerStakes: BigNumber;
  /**
   * Total number of staked tokens currently redeemable by everyone
   */
  totalStaked: BigNumber;
  /**
   * Number of staked tokens set aside and redeemable for all voters (via the staking fee)
   */
  totalVoterStakes: BigNumber;
}

export interface GetScoreThresholdParamsResult {
  thresholdConstA: BigNumber;
  thresholdConstB: number;
}

export interface GetStakerInfoResult {
  vote: number;
  stake: BigNumber;
}

export interface StakeConfig {
  /**
   * token amount to stake on the outcome resulting in this vote, in Wei
   */
  amount: BigNumber | string;
  /**
   * stake on behalf of this agent
   */
  onBehalfOf?: Address;
  /**
   * unique hash of proposal index
   */
  proposalId: string;
  /**
   * the choice of vote. Can be 1 (YES) or 2 (NO).
   */
  vote: number;
}

export interface RedeemConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
  /**
   * agent to whom to award the proposal payoffs
   */
  beneficiaryAddress: Address;
}

export interface ShouldBoostConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
}

export interface GetScoreConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
}

export interface GetThresholdConfig {
  /**
   * the DAO's avatar address
   */
  avatar: Address;
  /**
   * unique hash of proposal index
   */
  proposalId: string;
}

/**
 * return the amount of tokens to which the staker will be entitled as an outcome of the proposal
 */
export interface GetRedeemableTokensStakerConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
  /**
   * the staker
   */
  beneficiaryAddress: Address;
}

/**
 * return the amount of reputation to which the proposer will be entitled as an outcome of the proposal
 */
export interface GetRedeemableReputationProposerConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
}

/**
 * return the amount of tokens to which the voter will be entitled as an outcome of the proposal
 */
export interface GetRedeemableTokensVoterConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
  /**
   * the voter
   */
  beneficiaryAddress: Address;
}

/**
 * return the amount of reputation to which the voter will be entitled as an outcome of the proposal
 */
export interface GetRedeemableReputationVoterConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
  /**
   * the voter
   */
  beneficiaryAddress: Address;
}

/**
 * return the amount of reputation to which the staker will be entitled as an outcome of the proposal
 */
export interface GetRedeemableReputationStakerConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
  /**
   * the staker
   */
  beneficiaryAddress: Address;
}

export interface GetVoterInfoConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
  voter: string;
}

export interface GetProposalStatusConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
}

export interface GetTotalReputationSupplyConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
}

export interface GetProposalAvatarConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
}

export interface GetScoreThresholdParamsConfig {
  /**
   * the DAO's avatar address
   */
  avatar: Address;
}

export interface GetStakerInfoConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
  /**
   * address of the staking agent
   */
  staker: string;
}

export interface GetVoteStakeConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
  /**
   * the choice of vote. Can be 1 (YES) or 2 (NO).
   */
  vote: number;
}

export interface GetWinningVoteConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
}

export interface GetStateConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
}

export enum ExecutionState {
  None = 0,
  PreBoostedTimeOut = 1,
  PreBoostedBarCrossed = 2,
  BoostedTimeOut = 3,
  BoostedBarCrossed = 4,
}

export interface GenesisProtocolExecuteProposalEventResult extends VotingMachineExecuteProposalEventResult {
  /**
   * _executionState.toNumber() will give you a value from the enum `ExecutionState`
   */
  _executionState: BigNumber;
}

export enum ProposalState {
  None,
  Closed,
  Executed,
  PreBoosted,
  Boosted,
  QuietEndingPeriod,
}

export const GetDefaultGenesisProtocolParameters = async (): Promise<GenesisProtocolParams> => {
  const web3 = await Utils.getWeb3();
  return {
    boostedVotePeriodLimit: 604800, // 1 week
    minimumStakingFee: 0,
    preBoostedVotePeriodLimit: 5184000, // 2 months
    preBoostedVoteRequiredPercentage: 50,
    proposingRepRewardConstA: web3.toWei(5),
    proposingRepRewardConstB: 1,
    quietEndingPeriod: 7200, // Two hours
    stakerFeeRatioForVoters: 1,
    thresholdConstA: web3.toWei(2),
    thresholdConstB: 10,
    votersGainRepRatioFromLostRep: 80,
    votersReputationLossRatio: 1,
  };
};

export interface ExecutedGenesisProposal extends GenesisProtocolProposal {
  decision: BinaryVoteResult;
  /**
   * total reputation in the DAO at the time the proposal is created in the voting machine
   */
  totalReputation: BigNumber;
  executionState: ExecutionState;
}

export interface GenesisProtocolProposal {
  avatarAddress: Address;
  /**
   * in seconds
   */
  boostedPhaseTime: number;
  /**
   * in seconds
   */
  currentBoostedVotePeriodLimit: number;
  executable: Address;
  lostReputation: BigNumber;
  numOfChoices: number;
  paramsHash: Hash;
  proposalId: Hash;
  proposer: Address;
  state: ProposalState;
  /**
   * in seconds
   */
  submittedTime: number;
  totalVotes: BigNumber;
  votersStakes: BigNumber;
  winningVote: number;
}

export interface GetVoteStatusConfig {
  /**
   * unique hash of proposal index
   */
  proposalId: string;
  /**
   * the choice of vote, like 1 (YES) or 2 (NO).
   */
  vote: number;
}
