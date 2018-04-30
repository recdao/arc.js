import { BigNumber } from "bignumber.js";
import { Address, Hash } from "./commonTypes";
import { VotingMachineService } from "./votingMachineService";
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

  constructor(private web3EventService: Web3EventService) {

  }

  /**
   * Returns an EntityFetcherFactory for fetching proposal-related events.  Can take any EventFetcherFactory
   * whose event args supply `_proposalId`.  Returns events as a promise of `TProposal`.  You must supply an
   * `EventFetcherFactory` for fetching the events and a callback to transform `TEventArgs` to a promise of `TProposal`.
   * @type TEventArgs The type of the `args` object in the event.
   * @type TProposal The type of object returned as a transformation of the `args` information in each event.
   * @param proposalsEventFetcher Event fetcher to use to get or watch the event that supplies `TEventArgs`.
   * @param transformEventCallback Returns Promise of `TProposal` given `TEventArgs` for the event.  If it
   * returns `undefined` then no entity is returned for that event, so this is a programatic way in which events
   * can be filtered.
   */
  public getProposalEvents<TProposal, TEventArgs extends EventHasPropertyId = EventHasPropertyId>(
    proposalsEventFetcher: EventFetcherFactory<TEventArgs>,
    transformEventCallback: TransformEventCallback<TProposal, TEventArgs>)
    : EntityFetcherFactory<TProposal, TEventArgs> {

    if (!transformEventCallback) {
      throw new Error("transformEventCallback must be supplied");
    }

    if (!proposalsEventFetcher) {
      throw new Error("proposalsEventFetcher must be supplied");
    }

    return this.web3EventService.createEntityFetcherFactory<TProposal, TEventArgs>(
      proposalsEventFetcher,
      (args: TEventArgs): Promise<TProposal> => {
        return transformEventCallback(args);
      });
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
