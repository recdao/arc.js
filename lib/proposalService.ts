import { BigNumber } from "bignumber.js";
import { Address, Hash } from "./commonTypes";
import { VotingMachineService } from "./votingMachineService";
import {
  EntityFetcherFactory,
  EventFetcherFactory,
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

  constructor(private web3EventService: Web3EventService) {

  }

  /**
   * Returns an EntityFetcherFactory for fetching proposal-related events.  Can take any EventFetcherFactory
   * whose event args supply `_proposalId`.  Returns events as a promise of `TProposal`.  You must supply an
   * `EventFetcherFactory` for fetching the events and a callback to transform `TEventArgs` to a promise of `TProposal`.
   * @type TEventArgs The type of the `args` object in the event.
   * @type TProposal The type of object returned as a transformation of the `args` information in each event.
   * @param options
   */
  public getProposalEvents<TProposal, TEventArgs extends EventHasPropertyId = EventHasPropertyId>(
    options: GetProposalEventsOptions<TProposal, TEventArgs>)
    : EntityFetcherFactory<TProposal, TEventArgs> {

    if (!options.transformEventCallback) {
      throw new Error("transformEventCallback must be supplied");
    }

    if (!options.proposalsEventFetcher) {
      throw new Error("proposalsEventFetcher must be supplied");
    }

    const votableOnly = !!options.votableOnly;
    if (votableOnly && !options.votingMachineService) {
      throw new Error("votingMachineService must be supplied when votableOnly is true");
    }

    return this.web3EventService.createEntityFetcherFactory<TProposal, TEventArgs>(
      options.proposalsEventFetcher,
      async (args: TEventArgs): Promise<TProposal> => {

        let isVotable = true;

        if (votableOnly) {
          isVotable = await options.votingMachineService.isVotable(args._proposalId);
        }
        return isVotable ? options.transformEventCallback(args) : Promise.resolve(undefined);
      },
      options.baseArgFilter);
  }

  /**
   * Returns promise of an EntityFetcherFactory for fetching votable proposals from the
   * voting machine given by the address.  The proposals are returned as promises of instances
   * of `VotableProposal`.
   *
   * @param votingMachineAddress
   */
  public getVotableProposals(votingMachineService: VotingMachineService):
    EntityFetcherFactory<VotableProposal, NewProposalEventResult> {

    return this.web3EventService.createEntityFetcherFactory<VotableProposal, NewProposalEventResult>(
      votingMachineService.VotableProposals,
      (args: NewProposalEventResult): Promise<VotableProposal> => {
        return Promise.resolve(
          {
            avatarAddress: args._avatar,
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
  public getExecutedProposals(votingMachineService: VotingMachineService):
    EntityFetcherFactory<ExecutedProposal, ExecuteProposalEventResult> {

    return this.web3EventService.createEntityFetcherFactory<ExecutedProposal, ExecuteProposalEventResult>(
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
}

// export type PerProposalCallback<TProposal> = (proposal: TProposal) => void | Promise<boolean>;

export interface EventHasPropertyId {
  _proposalId: Hash;
}

// export interface AvatarProposalSpecifier {
//   /**
//    * The avatar under which the proposal was created
//    */
//   avatarAddress: Address;
//   /**
//    * The desired proposalId
//    */
//   proposalId: Hash;
//   /**
//    * Extra properties
//    */
//   [x: string]: any;
// }

export interface VotableProposal {
  numOfChoices: number;
  paramsHash: Hash;
  proposalId: Hash;
  proposerAddress: Address;
  avatarAddress: Address;
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

export interface GetProposalEventsOptions<TProposal, TEventArgs extends EventHasPropertyId = EventHasPropertyId> {
  /**
   * Event fetcher to use to get or watch the event that supplies `TEventArgs`.
   */
  proposalsEventFetcher: EventFetcherFactory<TEventArgs>;
  /**
   * Returns Promise of `TProposal` given `TEventArgs` for the event.  Return of `undefined` will be ignored, not
   * passed-on to the caller.
   */
  transformEventCallback: TransformEventCallback<TProposal, TEventArgs>;
  /**
   * Optional to filter events on the given filter, like `{ _avatar: [anAddress] }`.
   * This will be merged with any filter that the caller provides when creating the EntityFetcher.
   */
  baseArgFilter?: any;
  /**
   * True to only return votable proposals.  Default is false.
   */
  votableOnly?: boolean;
  /**
   * You must supply this if `votableOnly` is true. Otherwise is ignored.
   */
  votingMachineService?: VotingMachineService;
}
