import { Address, ContractWrapperBase } from ".";
import { ProposalService } from "./proposalService";
import { VotingMachineService, VotingMachineServiceFactory } from "./votingMachineService";
import { Web3EventService } from "./web3EventService";

export abstract class ProposalGeneratorBase extends ContractWrapperBase {
  protected proposalService: ProposalService;
  protected votingMachineServiceFactory: VotingMachineServiceFactory;

  constructor(solidityContract: any, web3EventService: Web3EventService) {
    super(solidityContract, web3EventService);
    this.proposalService = new ProposalService(web3EventService);
    this.votingMachineServiceFactory = new VotingMachineServiceFactory(web3EventService);
  }

  public abstract async getVotingMachineAddress(avatarAddress: Address): Promise<Address>;

  public async getVotingMachineService(avatarAddress: Address): Promise<VotingMachineService> {
    const votingMachineAddress = await this.getVotingMachineAddress(avatarAddress);
    return await this.votingMachineServiceFactory.create(votingMachineAddress);
  }
}
