import { BigNumber } from "bignumber.js";
import { Address, Hash } from "./commonTypes";
import { VotingMachineServiceFactory } from "./votingMachineService";
import {
  EntityFetcherFactory,
  EventFetcherFactory,
  EventFetcherFilterObject,
  TransformEventCallback,
  Web3EventService
} from "./web3EventService";
import { ExecuteProposalEventResult, NewProposalEventResult } from "./wrappers/commonEventInterfaces";

/**
 * A single instance of ProposalService provides services relating to a single
 * type of proposal (TProposal), for example a proposal to contribute rewards to a beneficiary.
 * When constructing a ProposalService we pass to the constructor a `ProposalMaker<TProposal, TEventArgs>`
 * that provides functions enabling ProposalService to do its job with respect to the given TProposal.
 * Note it is not scoped to a particular Avatar.
 */
export class ProposalService {

  /**
   * Returns an EntityFetcherFactory for fetching proposal-related events.  Can take any EventFetcherFactory
   * whose event args supply `_proposalId`.  Returns events as a promise of `TProposal`.  You must supply an
   * `EventFetcherFactory` for fetching the events and a callback to transform `TEventArgs` to a promise of `TProposal`.
   * @type TEventArgs The type of the `args` object in the event.
   * @type TProposal The type of object returned as a transformation of the `args` information in each event.
   * @param options
   */
  public ProposalEvents<TProposal, TEventArgs extends EventHasPropertyId = EventHasPropertyId>(
    options: GetSchemeProposalsOptions<TProposal, TEventArgs>): EntityFetcherFactory<TProposal> {

    this.validateGetProposalOptions(options);

    if (!options.transformEventCallback) {
      throw new Error("transformEventCallback must be supplied");
    }

    if (!options.proposalsEventFetcher) {
      throw new Error("proposalsEventFetcher must be supplied");
    }

    return Web3EventService.createEntityFetcherFactory<TProposal, TEventArgs>(
      options.proposalsEventFetcher,
      (args: TEventArgs): Promise<TProposal> => {
        return options.transformEventCallback(args);
      });
  }

  /**
   * Returns promise of an EntityFetcherFactory for fetching votable proposals from the
   * voting machine given by the address.  The proposals are returned as promises of instances
   * of `VotableProposal`.
   *
   * @param votingMachineAddress
   */
  public async VotableProposals(votingMachineAddress: Address): Promise<EntityFetcherFactory<VotableProposal>> {

    const votingMachineService = await VotingMachineServiceFactory.create(votingMachineAddress);

    return Web3EventService.createEntityFetcherFactory<VotableProposal, NewProposalEventResult>(
      votingMachineService.VotableProposals,
      (args: NewProposalEventResult): Promise<VotableProposal> => {
        return Promise.resolve(
          {
            numOfChoices: args._numOfChoices.toNumber(),
            paramsHash: args._paramsHash,
            proposalId: args._proposalId,
            proposerAddress: args._proposer,
          }
        );
      });
  }

  /**
   * Returns promise of an EntityFetcherFactory for fetching executed proposals from the
   * voting machine given by the address.  The proposals are returned as promises of instances
   * of `ExecutedProposal`.
   *
   * @param votingMachineAddress
   */
  public async ExecutedProposals(votingMachineAddress: Address): Promise<EntityFetcherFactory<ExecutedProposal>> {

    const votingMachineService = await VotingMachineServiceFactory.create(votingMachineAddress);

    return Web3EventService.createEntityFetcherFactory<ExecutedProposal, ExecuteProposalEventResult>(
      votingMachineService.ExecuteProposal,
      (args: ExecuteProposalEventResult): Promise<ExecutedProposal> => {
        return Promise.resolve(
          {
            decision: args._decision.toNumber(),
            proposalId: args._proposalId,
            totalReputation: args._totalReputation,
          }
        );
      });
  }

  private validateGetProposalOptions<TProposal>(options: GetProposalsOptions<TProposal>): void {

    if (!options.callback) {
      throw new Error("callback must be supplied");
    }

    options.eventArgsFilter = Object.assign(
      {}, options.avatarAddress ? { _avatar: options.avatarAddress } : {}, options.eventArgsFilter);

    options.eventFilterConfig = Object.assign({}, { fromBlock: 0 }, options.eventFilterConfig);
  }
}

export type PerProposalCallback<TProposal> = (proposal: TProposal) => void | Promise<boolean>;

export interface GetProposalsOptions<TProposal> {
  /**
   * Optional avatar address.
   */
  avatarAddress?: Address;
  /**
   * Optional to watch.  Default is get.
   */
  watch?: boolean;
  /**
   * Optional event filter.  Default is { fromBlock: 0 }
   */
  eventFilterConfig?: EventFetcherFilterObject;
  /**
   * Optional event argument filter, like `{ _proposalId: [someHash] }`.
   * If `options.avatarAddress` is set then `{ _avatar: options.avatarAddress }` is
   * automatically added.
   */
  eventArgsFilter?: any;
  /**
   * Callback to be invoked after obtaining each proposal.
   * Return nothing or a promise of whether to stop finding proposals at this point.
   */
  callback: PerProposalCallback<TProposal>;
}

export interface GetVotableProposalsOptions extends GetProposalsOptions<VotableProposal> {
}

export interface EventHasPropertyId {
  _proposalId: Hash;
}

export interface AvatarProposalSpecifier {
  /**
   * The avatar under which the proposal was created
   */
  avatarAddress: Address;
  /**
   * The desired proposalId
   */
  proposalId: Hash;
  /**
   * Extra properties
   */
  [x: string]: any;
}

export interface VotableProposal {
  numOfChoices: number;
  paramsHash: Hash;
  proposalId: Hash;
  proposerAddress: Address;
}

export interface ExecutedProposal {
  /**
   * the vote choice that won.
   */
  decision: number;
  /**
   * The id of the proposal that was executed.
   */
  proposalId: Hash;
  /**
   * The total reputation in the DAO at the time the proposal was executed
   */
  totalReputation: BigNumber;
}

export interface GetSchemeProposalsOptions<TProposal, TEventArgs> extends GetProposalsOptions<TProposal> {
  /**
   * Returns Promise of `TProposal` given the event args for the event and an AvatarProposalSpecifier.
   */
  transformEventCallback: TransformEventCallback<TProposal, TEventArgs>;
  /**
   * Event fetcher to use to get or watch the event that supplies `TEventArgs`.
   */
  proposalsEventFetcher: EventFetcherFactory<TEventArgs>;
}
