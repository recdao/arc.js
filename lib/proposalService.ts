import { BigNumber } from "bignumber.js";
import { Address, HasContract, Hash } from "./commonTypes";
import { ArcTransactionResult, DecodedLogEntryEvent } from "./contractWrapperBase";
import { VotingMachineService, VotingMachineServiceFactory } from "./votingMachineService";
import { EventFetcher, EventFetcherFactory, EventFetcherFilterObject } from "./web3EventService";

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
  constructor(private proposalMaker: ProposalMaker<TProposal, TEventArgs>) {
  }

  /**
   * Given the options, return the promise of an array of proposals of type TProposal.
   * @param options
   */
  public async getProposals(options: GetProposalsOptions<TProposal>): Promise<Array<TProposal>> {

    options.eventArgsFilter = Object.assign({}, options.avatarAddress ? { _avatar: options.avatarAddress } : {}, options.eventArgsFilter);
    options.eventFilterConfig = Object.assign({}, { fromBlock: 0 }, options.eventFilterConfig);

    const proposals = new Array<TProposal>();

    const eventFetcher =
      this.proposalMaker.proposalsEventFetcher(options.eventArgsFilter, options.eventFilterConfig);

    return new Promise((resolve: (proposals: Array<TProposal>) => void, reject: (err: Error) => void): void => {
      eventFetcher.get(async (err: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>) => {
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
   * Given the options, watch the creation of proposals of type TProposal.  Use
   * `options.perProposalCallback` to receive each proposal.
   *
   * When you are done watching you can call `stopWatching` on the returned `EventFetcher<TEventArgs>`,
   * or return a Promise of `true` from `options.perProposalCallback`.
   *
   * @param options
   */
  public watchProposals(options: GetProposalsOptions<TProposal>): EventFetcher<TEventArgs> {

    const defaults = {
      eventArgsFilter: options.avatarAddress ? { _avatar: options.avatarAddress } : {},
      eventFilterConfig: { fromBlock: 0 },
    };

    options = Object.assign({}, defaults, options);

    const eventFetcher =
      this.proposalMaker.proposalsEventFetcher(options.eventArgsFilter, options.eventFilterConfig);

    eventFetcher.watch(async (err: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>) => {
      for (const event of log) {
        const proposalId = event.args._proposalId;
        const proposal = await this._getProposalFromEvent(
          Object.assign({}, event.args, { avatarAddress: options.avatarAddress, proposalId }));
        if (options.perProposalCallback) {
          const stop = await options.perProposalCallback(proposal);
          if (stop) {
            eventFetcher.stopWatching();
            break;
          }
        }
      }
    });

    return eventFetcher;
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
   * Return an array of the current counts of each vote choice on the proposal.
   * For straight Abstain, Yes and No votes you can use the values of the
   * `BinaryVoteResult` enum to dereference the array.  The Abstain vote
   * (in the zeroeth position) is always given even if the voting machine
   * does not allow abstentions.
   *
   * @param proposalId
   */
  public async getCurrentVoteStatus(options: AvatarProposalSpecifier): Promise<Array<BigNumber>> {

    const votingMachineService = await this.getVotingMachineService(options.avatarAddress);

    let numChoices = await votingMachineService.getNumberOfChoices(options.proposalId);
    const abstainAllowed = await votingMachineService.isAbstainAllow();
    // when abstaining is not allowed, numChoices doesn't include it, but we always return it here, even if always zero
    if (!abstainAllowed) {
      ++numChoices;
    }

    const voteTotals = new Array<BigNumber>(numChoices);

    for (let choice = 0; choice < numChoices; ++choice) {
      const voteTotal = await votingMachineService.voteStatus(options.proposalId, choice);
      voteTotals[choice] = voteTotal;
    }

    return voteTotals;
  }

  /**
   * Cancel the given proposal
   * @param proposalId
   */
  public async cancelProposal(options: AvatarProposalSpecifier): Promise<ArcTransactionResult> {
    const votingMachineService = await this.getVotingMachineService(options.avatarAddress);
    return votingMachineService.cancelProposal(options.proposalId);
  }
  /**
   * Vote on behalf of the owner of the proposal, ie the agent that created it.
   * @param proposalId
   * @param vote What to vote
   * @param voter The owner
   */
  public async ownerVote(options: OwnerVoteOptions): Promise<ArcTransactionResult> {
    const votingMachineService = await this.getVotingMachineService(options.avatarAddress);
    return votingMachineService.ownerVote(options.proposalId, options.vote, options.voter);
  }
  /**
   * Vote on behalf of msgSender
   * @param proposalId
   * @param vote
   */
  public async vote(options: VoteOptions): Promise<ArcTransactionResult> {
    const votingMachineService = await this.getVotingMachineService(options.avatarAddress);
    return votingMachineService.vote(options.proposalId, options.vote);
  }

  /**
   * Vote specified reputation amount
   * @param proposalId
   * @param vote
   * @param rep
   * @param token
   */
  public async voteWithSpecifiedAmounts(options: VoteWithSpecifiedAmountsOptions): Promise<ArcTransactionResult> {
    const votingMachineService = await this.getVotingMachineService(options.avatarAddress);
    return votingMachineService.voteWithSpecifiedAmounts(options.proposalId, options.vote, options.rep);
  }

  /**
   * Cancel voting on the proposal.
   * @param proposalId
   */
  public async cancelVote(options: AvatarProposalSpecifier): Promise<ArcTransactionResult> {
    const votingMachineService = await this.getVotingMachineService(options.avatarAddress);
    return votingMachineService.cancelVote(options.proposalId);
  }

  /**
   * Get the number of voting choices allowed by the proposal.
   * @param proposalId
   */
  public async getNumberOfChoices(options: AvatarProposalSpecifier): Promise<number> {
    const votingMachineService = await this.getVotingMachineService(options.avatarAddress);
    return (await votingMachineService.getNumberOfChoices(options.proposalId));
  }

  /**
   * Get whether the proposal is in a state where it can be voted-upon.
   * @param proposalId
   */
  public async isVotable(options: AvatarProposalSpecifier): Promise<boolean> {
    const votingMachineService = await this.getVotingMachineService(options.avatarAddress);
    return votingMachineService.isVotable(options.proposalId);
  }

  /**
   * Get the number of votes currently cast on the given choice.
   * @param proposalId
   * @param vote
   */
  public async voteStatus(options: VoteStatusOptions): Promise<BigNumber> {
    const votingMachineService = await this.getVotingMachineService(options.avatarAddress);
    return votingMachineService.voteStatus(options.proposalId, options.vote);
  }

  /**
   * get whether voters are allowed to cast an abstaining vote on these proposals.
   */
  public async isAbstainAllow(avatarAddress: Address): Promise<boolean> {
    const votingMachineService = await this.getVotingMachineService(avatarAddress);
    return votingMachineService.isAbstainAllow();
  }

  /**
   * Get a VotingMachineService given the address of any contract
   * that implements the `IntVoteInterface` Arc contract interface.
   */
  public async getVotingMachineService(avatarAddress: Address): Promise<VotingMachineService> {
    if (!avatarAddress) {
      throw new Error(`avatar is not defined`);
    }
    const votingMachineAddress = await this.proposalMaker.getVotingMachineAddress(avatarAddress);
    return VotingMachineServiceFactory.create(votingMachineAddress);
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

export interface GetProposalsOptions<TProposal> {
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

export interface ProposalMaker<TProposal, TEventArgs> {
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

export interface OwnerVoteOptions {
  avatarAddress: Address;
  proposalId: Hash;
  vote: number;
  voter: Address;
}

export interface VoteOptions {
  avatarAddress: Address;
  proposalId: Hash;
  vote: number;
}

export interface VoteWithSpecifiedAmountsOptions {
  avatarAddress: Address;
  proposalId: Hash;
  rep: BigNumber;
  vote: number;
}

export interface VoteStatusOptions {
  avatarAddress: Address;
  proposalId: Hash;
  vote: number;
}
