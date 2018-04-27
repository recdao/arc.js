import { Address, HasContract, Hash } from "./commonTypes";
import { DecodedLogEntryEvent } from "./contractWrapperBase";
import { VotingMachineService, VotingMachineServiceFactory } from "./votingMachineService";
import { EventFetcherFactory, EventFetcherFilterObject } from "./web3EventService";

/**
 * A single instance of ProposalService provides services relating to a single
 * type of proposal (TProposal), for example a proposal to contribute rewards to a beneficiary.
 * When constructing a ProposalService we pass to the constructor a `ProposalMaker<TProposal, TEventArgs>`
 * that provides functions enabling ProposalService to do its job with respect to the given TProposal.
 * Note it is not scoped to a particular Avatar.
 */
export class ProposalService<TProposal, TEventArgs extends EventHasPropertyId = EventHasPropertyId> {

  /**
   * Instantiate ProposalService given a class that provides necessary helper methods
   * where TProposal is the type of an object that represents a proposal.
   * @param proposalMaker Any object that implements ProposalWrapper<TProposal>.
   */
  constructor(private proposalMaker: ProposalGenerator<TProposal, TEventArgs>) {
  }

  /**
   * Given the options, return the promise of an array of votable proposals of type TProposal.
   * @param options
   */
  public async getVotableProposals(options: GetVotableProposalsOptions<TProposal>): Promise<Array<TProposal>> {
    return this.getProposals(options, false);
  }

  /**
   * Given the options, return the promise of a proposal of type TProposal.
   * @param options In addition to properties in AvatarProposalSpecifier,
   * options may contain extra properties to assist in proposal creation
   */
  public async getProposal(options: AvatarProposalSpecifier): Promise<TProposal> {
    return this._getProposalFromEvent(options as AvatarProposalSpecifier & TEventArgs);
  }

  /**
   * Get a VotingMachineService for this instance of proposalService and
   * the given avatar.
   *
   * The voting machine should implement the `IntVoteInterface` Arc contract interface.
   */
  public async getVotingMachineService(avatarAddress: Address): Promise<VotingMachineService> {
    if (!avatarAddress) {
      throw new Error(`avatar is not defined`);
    }
    const votingMachineAddress = await this.proposalMaker.getVotingMachineAddress(avatarAddress);
    return VotingMachineServiceFactory.create(votingMachineAddress);
  }

  /**
   * Given the options, return the promise of an array of proposals of type TProposal.
   * @param options
   */
  public async getProposals(
    options: GetVotableProposalsOptions<TProposal>, watch: boolean = false
  ): Promise<Array<TProposal>> {

    options.eventArgsFilter = Object.assign(
      {}, options.avatarAddress ? { _avatar: options.avatarAddress } : {}, options.eventArgsFilter);
    options.eventFilterConfig = Object.assign({}, { fromBlock: 0 }, options.eventFilterConfig);

    const proposals = new Array<TProposal>();

    const eventFetcher =
      this.proposalMaker.proposalsEventFetcher(options.eventArgsFilter, options.eventFilterConfig);

    const getOrWatch = watch ? eventFetcher.watch : eventFetcher.get;

    return new Promise((resolve: (proposals: Array<TProposal>) => void, reject: (err: Error) => void): void => {
      getOrWatch(async (err: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>) => {
        if (err) {
          return reject(err);
        }
        for (const event of log) {
          const proposalId = event.args._proposalId;
          const proposal = await this._getProposalFromEvent(
            Object.assign({}, event.args, { avatarAddress: options.avatarAddress, proposalId }));
          if (options.perProposalCallback) {
            const stop = await options.perProposalCallback(proposal);
            if (stop) {
              if (watch) {
                eventFetcher.stopWatching();
              }
              break;
            }
          }
          proposals.push(proposal);
        }
        resolve(proposals);
      });
    });
  }

  /**
   * Given the options, return the promise of a proposal of type TProposal.
   * @param options In addition to properties in AvatarProposalSpecifier,
   * options must contain TEventArgs
   */
  private async _getProposalFromEvent(options: AvatarProposalSpecifier & TEventArgs): Promise<TProposal> {
    const proposalParamsArray = await this.proposalMaker.getProposal(options);
    return this.proposalMaker.convertToProposal(proposalParamsArray, options);
  }
}

export type PerProposalCallback<TProposal> = (proposal: TProposal) => void | Promise<boolean>;

export interface GetVotableProposalsOptions<TProposal> {
  /**
   * Optionally filter proposals by an avatar.
   */
  avatarAddress?: Address;
  /**
   * Optional callback invoked after obtaining each proposal.
   * Return nothing or a promise of whether to stop finding proposals at this point.
   */
  perProposalCallback?: PerProposalCallback<TProposal>;
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
}

export interface ProposalGenerator<TProposal, TEventArgs> {
  /**
   * Truffle contract used to talk directly to Arc contracts.
   */
  contract: HasContract;
  /**
   * Event fetcher to use for fetching all proposal creation events.
   */
  proposalsEventFetcher: EventFetcherFactory<any>;
  /**
   * Convert an array of proposal properties to an object.
   * Options will also contain all of the event args properties.
   */
  convertToProposal: (proposalParams: Array<any>, options: AvatarProposalSpecifier & TEventArgs) => TProposal;
  /**
   * Arc is inconsistent across contracts as to how to obtain a proposal, so
   * so we ask the caller who knows the specific contract to do it for us.
   * Options will also contain all of the event args properties.
   */
  getProposal: (options: AvatarProposalSpecifier & TEventArgs) => Promise<Array<any>>;
  /**
   * Returns VotingMachine address
   * @param avatarAddress
   */
  getVotingMachineAddress(avatarAddress: Address): Promise<Address>;
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

export interface GeneratesProposals<TProposal> {
  createProposalService(): ProposalService<TProposal>;
}
