import { Address } from "./commonTypes";
import { ContractWrapperBase } from "./contractWrapperBase";
import { ContractWrapperFactory } from "./contractWrapperFactory";
import { ProposalService } from "./proposalService";
import { Web3EventService } from "./web3EventService";
import { IntVoteInterfaceFactory, IntVoteInterfaceWrapper } from "./wrappers/intVoteInterface";

export abstract class ProposalGeneratorBase extends ContractWrapperBase {
  protected proposalService: ProposalService;
  protected votingMachineFactory: ContractWrapperFactory<IntVoteInterfaceWrapper>;

  constructor(solidityContract: any, web3EventService: Web3EventService) {
    super(solidityContract, web3EventService);
    this.proposalService = new ProposalService(web3EventService);
    this.votingMachineFactory = IntVoteInterfaceFactory;
  }

  public async getVotingMachineAddress(avatarAddress: Address): Promise<Address> {
    return (await this._getSchemeParameters(avatarAddress)).votingMachineAddress;
  }

  public async getVotingMachine(avatarAddress: Address): Promise<IntVoteInterfaceWrapper> {
    const votingMachineAddress = await this.getVotingMachineAddress(avatarAddress);
    return this.votingMachineFactory.at(votingMachineAddress);
  }
}
