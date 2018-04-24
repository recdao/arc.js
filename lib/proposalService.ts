import { Address, Hash, BinaryVoteResult } from './commonTypes';
import { BigNumber } from 'bignumber.js';

export class ProposalService<TProposal> {

  public getProposals<TService>(options: GetProposalsOptions): Promise<Array<TProposal>> {

  }

  public getProposal(options: ProposalSpecifier): Promise<TProposal> {

  }

  public getVotingMachine(options: ProposalSpecifier): Promise<Address> {

  }

  public getCurrentVoteStatus(options: ProposalSpecifier): Promise<Array<BigNumber>> {
    const proposal = await this.getProposal
  }
}

export interface GetProposalsOptions {
  /**
   * The avatar under which the proposals were created
   */
  avatar: Address;
  /**
   * Optionally filter on the given proposalId
   */
  proposalId?: Hash;
  /**
   * optional callback 
   */
}

export interface ProposalSpecifier {
  /**
   * The avatar under which the proposal was created
   */
  avatar: Address;
  /**
   * The desired proposalId
   */
  proposalId: Hash;
}
