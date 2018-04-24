import { BigNumber } from "bignumber.js";
import { Address, HasContract, Hash } from "./commonTypes";
import { ArcTransactionResult, DecodedLogEntryEvent } from "./contractWrapperBase";
import { IntVoteInterface, VotingMachineService } from "./votingMachineService";
import { EventFetcherFactory, EventFetcherFilterObject } from "./web3EventService";

export class ProposalService<TProposal, TEventArgs extends EventHasPropertyId = EventHasPropertyId> {

  private votingMachineService: VotingMachineService;

  /**
   * Instantiate ProposalService given a class that provides helper methods and
   * where TProposal is the type of an object that represents a proposal.
   * @param wrapperClass Any object that implements ProposalWrapper<TProposal>.
   */
  constructor(private wrapperClass: ProposalWrapper<TProposal, TEventArgs>) {
    this.votingMachineService = new VotingMachineService(this.wrapperClass.contract);
  }

  /**
   * Given the options, return the promise of an array of proposals of type TProposal.
   * @param options
   */
  public async getProposals(options: GetProposalsOptions<TProposal>): Promise<Array<TProposal>> {

    const defaults = {
      eventFilterConfig: { fromBlock: 0 },
    };

    options = Object.assign({}, defaults, options);

    if (!options.avatar) {
      throw new Error("avatar address is not defined");
    }

    const proposals = new Array<TProposal>();

    const eventFetcher =
      this.wrapperClass.proposalsEventFetcher({ _avatar: options.avatar }, options.eventFilterConfig);

    return new Promise((resolve: (proposals: Array<TProposal>) => void, reject: (err: Error) => void): void => {
      eventFetcher.get(async (err: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>) => {
        if (err) {
          return reject(err);
        }
        for (const event of log) {
          const proposalId = event.args._proposalId;
          const proposal = await this._getProposalFromEvent(
            Object.assign({}, event.args, { avatar: options.avatar, proposalId }));
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
   * Given the options, return the promise of a proposal of type TProposal.
   * @param options In addition to properties in AvatarProposalSpecifier,
   * options may contain extra properties to assist in proposal creation
   */
  public async getProposal(options: AvatarProposalSpecifier): Promise<TProposal> {
    return this._getProposalFromEvent(options as AvatarProposalSpecifier & TEventArgs);
  }

  /**
   * Return an array of counts of each vote.  For straight Abstain and Yes and No votes,
   * you can use the values of the `BinaryVoteResult` enum to dereference the array.
   * @param proposalId
   */
  public async getCurrentVoteStatus(proposalId: Hash): Promise<Array<BigNumber>> {

    let numChoices = await this.getNumberOfChoices(proposalId);
    const abstainAllowed = await this.isAbstainAllow();
    // when abstaining is not allowed, numChoices doesn't include it, but we always return it here, even if always zero
    if (!abstainAllowed) {
      ++numChoices;
    }

    const voteTotals = new Array<BigNumber>(numChoices);

    for (let choice = 0; choice < numChoices; ++choice) {
      const voteTotal = await this.votingMachineService.voteStatus(proposalId, choice);
      voteTotals[choice] = voteTotal;
    }

    return voteTotals;
  }

  /**
   * Cancel the given proposal
   * @param proposalId
   */
  public async cancelProposal(proposalId: Hash): Promise<ArcTransactionResult> {
    return this.votingMachineService.cancelProposal(proposalId);
  }
  /**
   * Vote on behalf of the owner of the proposal, ie the agent that created it.
   * @param proposalId
   * @param vote What to vote
   * @param voter The owner
   */
  public async ownerVote(proposalId: Hash, vote: number, voter: Address): Promise<ArcTransactionResult> {
    return this.votingMachineService.ownerVote(proposalId, vote, voter);
  }
  /**
   * Vote on behalf of msgSender
   * @param proposalId
   * @param vote
   */
  public async vote(proposalId: Hash, vote: number): Promise<ArcTransactionResult> {
    return this.votingMachineService.vote(proposalId, vote);
  }

  /**
   * Vote specified reputation amount
   * @param proposalId
   * @param vote
   * @param rep
   * @param token
   */
  public async voteWithSpecifiedAmounts(
    proposalId: Hash,
    vote: number,
    rep: BigNumber): Promise<ArcTransactionResult> {
    return this.votingMachineService.voteWithSpecifiedAmounts(proposalId, vote, rep);
  }

  /**
   * Cancel voting on the proposal.
   * @param proposalId
   */
  public async cancelVote(proposalId: Hash): Promise<ArcTransactionResult> {
    return this.votingMachineService.cancelVote(proposalId);
  }

  /**
   * Get the number of voting choices allowed by the proposal.
   * @param proposalId
   */
  public async getNumberOfChoices(proposalId: Hash): Promise<number> {
    return (await this.votingMachineService.getNumberOfChoices(proposalId));
  }

  /**
   * Get whether the proposal is in a state where it can be voted-upon.
   * @param proposalId
   */
  public async isVotable(proposalId: Hash): Promise<boolean> {
    return await this.votingMachineService.isVotable(proposalId);
  }

  /**
   * Get the number of votes currently cast on the given choice.
   * @param proposalId
   * @param choice
   */
  public async voteStatus(proposalId: Hash, choice: number): Promise<BigNumber> {
    return await this.votingMachineService.voteStatus(proposalId, choice);
  }

  /**
   * get whether voters are allowed to cast an abstaining vote.
   */
  public async isAbstainAllow(): Promise<boolean> {
    return await this.votingMachineService.isAbstainAllow();
  }

  /**
   * Given the options, return the promise of a proposal of type TProposal.
   * @param options In addition to properties in AvatarProposalSpecifier,
   * options must contain TEventArgs
   */
  private async _getProposalFromEvent(options: AvatarProposalSpecifier & TEventArgs): Promise<TProposal> {
    const proposalParamsArray = await this.wrapperClass.getProposal(options);
    return this.wrapperClass.convertToProposal(proposalParamsArray, options);
  }

}

export type PerProposalCallback<TProposal> = (proposal: TProposal) => void | Promise<boolean>;

export interface GetProposalsOptions<TProposal> {
  /**
   * The avatar under which the proposals were created
   */
  avatar: Address;
  /**
   * Optional callback invoked after obtaining each proposal.
   * Return nothing or a promise of whether to stop finding proposals at this point.
   */
  perProposalCallback?: PerProposalCallback<TProposal>;
  /**
   * optional filter parameters.  Default is { fromBlock: 0 }
   */
  eventFilterConfig?: EventFetcherFilterObject;
}

export interface AvatarProposalSpecifier {
  /**
   * The avatar under which the proposal was created
   */
  avatar: Address;
  /**
   * The desired proposalId
   */
  proposalId: Hash;
  /**
   * Extra properties
   */
  [x: string]: any;
}

export interface ProposalWrapper<TProposal, TEventArgs> {
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
   * Event fetcher to use for fetching all proposal creation events.
   */
  proposalsEventFetcher: EventFetcherFactory<any>;
  /**
   * Truffle contract used to talk directly to Arc contracts.
   */
  contract: HasContract & IntVoteInterface;
}

export interface EventHasPropertyId {
  _proposalId: Hash;
}
