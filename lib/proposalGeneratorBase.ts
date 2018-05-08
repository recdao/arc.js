import { Address } from "./commonTypes";
import { ContractWrapperBase } from "./contractWrapperBase";
import { ContractWrapperFactory } from "./contractWrapperFactory";
import { ProposalService } from "./proposalService";
import { VotingMachineBase, VotingMachineFactory } from "./votingMachineBase";
import { Web3EventService } from "./web3EventService";

export abstract class ProposalGeneratorBase extends ContractWrapperBase {
  protected proposalService: ProposalService;
  protected votingMachineFactory: ContractWrapperFactory<VotingMachineBase>;

  constructor(solidityContract: any, web3EventService: Web3EventService) {
    super(solidityContract, web3EventService);
    this.proposalService = new ProposalService(web3EventService);
    this.votingMachineFactory = VotingMachineFactory;
  }

  public async getVotingMachineAddress(avatarAddress: Address): Promise<Address> {
    return (await this._getSchemeParameters(avatarAddress)).votingMachineAddress;
  }

  public async getVotingMachine(avatarAddress: Address): Promise<VotingMachineBase> {
    const votingMachineAddress = await this.getVotingMachineAddress(avatarAddress);
    return this.votingMachineFactory.at(votingMachineAddress);
  }

  // public async getProposalVotingMachine(
  //   avatarAddress: Address,
  //   proposalId: Hash): Promise<ProposalVotingMachine> {

  //   const factory = new ProposalVotingMachineFactory(this.web3EventService);
  //   const votingMachineAddress = await this.getVotingMachineAddress(avatarAddress);
  //   return factory.create(votingMachineAddress, proposalId);
  // }
}
