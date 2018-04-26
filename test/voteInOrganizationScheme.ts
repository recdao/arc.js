import { assert } from "chai";
import {
  AbsoluteVoteWrapper,
  Address,
  BinaryVoteResult,
  DecodedLogEntryEvent,
  fnVoid,
  Hash,
  VoteProposalEventResult
} from "../lib";
import { SchemeRegistrarFactory, SchemeRegistrarWrapper } from "../lib/wrappers/schemeRegistrar";
import { VoteInOrganizationProposal, VoteInOrganizationSchemeFactory } from "../lib/wrappers/voteInOrganizationScheme";
import * as helpers from "./helpers";

const createProposal =
  async (): Promise<{ proposalId: Hash, votingMachine: AbsoluteVoteWrapper, scheme: SchemeRegistrarWrapper }> => {

    const originalDao = await helpers.forgeDao({
      founders: [{
        address: accounts[0],
        reputation: web3.toWei(30),
        tokens: web3.toWei(100),
      },
      {
        address: accounts[1],
        reputation: web3.toWei(30),
        tokens: web3.toWei(100),
      }],
      name: "Original",
      schemes: [
        { name: "ContributionReward" }
        , {
          name: "SchemeRegistrar",
          votingMachineParams: {
            ownerVote: false,
          },
        },
      ],
      tokenName: "Tokens of Original",
      tokenSymbol: "ORG",
    });

    const schemeToDelete = (await originalDao.getSchemes("ContributionReward"))[0].address;
    assert.isOk(schemeToDelete);

    const schemeRegistrar =
      await helpers.getDaoScheme(originalDao, "SchemeRegistrar", SchemeRegistrarFactory) as SchemeRegistrarWrapper;
    assert.isOk(schemeRegistrar);
    /**
     * propose to remove ContributionReward.  It should get the ownerVote, then requiring just 30 more reps to execute.
     */
    const result = await schemeRegistrar.proposeToRemoveScheme(
      {
        avatar: originalDao.avatar.address,
        schemeAddress: schemeToDelete,
      });

    assert.isOk(result.proposalId);

    /**
     * get the voting machine that will be used to vote for this proposal
     */
    const votingMachine = await helpers.getSchemeVotingMachine(originalDao, schemeRegistrar) as AbsoluteVoteWrapper;

    assert.isOk(votingMachine);
    assert.isFalse(await helpers.voteWasExecuted(votingMachine, result.proposalId));

    return { proposalId: result.proposalId, votingMachine, scheme: schemeRegistrar };
  };

describe("VoteInOrganizationScheme", () => {
  let dao;
  let voteInOrganizationScheme;
  beforeEach(async () => {

    dao = await helpers.forgeDao({
      founders: [{
        address: accounts[0],
        reputation: web3.toWei(30),
        tokens: web3.toWei(100),
      },
      {
        address: accounts[1],
        reputation: web3.toWei(30),
        tokens: web3.toWei(100),
      },
      {
        address: accounts[2],
        reputation: web3.toWei(30),
        tokens: web3.toWei(100),
      },
      ],
      schemes: [
        {
          name: "VoteInOrganizationScheme",
          votingMachineParams: {
            ownerVote: false,
          },
        },
      ],
    });

    voteInOrganizationScheme = await helpers.getDaoScheme(
      dao,
      "VoteInOrganizationScheme",
      VoteInOrganizationSchemeFactory);

    assert.isOk(voteInOrganizationScheme);
  });

  it("can get proposed votes", async () => {

    /**
     * this is the proposal we'll vote on remotely
     */
    const originalProposalInfo = await createProposal();

    const options = {
      avatar: dao.avatar.address,
      originalIntVote: originalProposalInfo.votingMachine.address,
      originalProposalId: originalProposalInfo.proposalId,
    };

    const proposalInfo = await voteInOrganizationScheme.proposeVote(options);
    const proposalInfo2 = await voteInOrganizationScheme.proposeVote(options);

    const proposalService = voteInOrganizationScheme.createProposalService();

    const proposals = await proposalService.getProposals({ avatarAddress: dao.avatar.address });

    assert.equal(proposals.length, 2);

    assert.equal(
      proposals.filter(
        (p: VoteInOrganizationProposal) => p.proposalId === proposalInfo.proposalId).length,
      1,
      "first proposal not found");

    assert.equal(
      proposals.filter(
        (p: VoteInOrganizationProposal) => p.proposalId === proposalInfo2.proposalId).length,
      1,
      "second proposal not found");
  });

  it("proposeVote organization vote", async () => {

    /**
     * this is the proposal we'll vote on remotely
     */
    const proposalInfo = await createProposal();

    const options = {
      avatar: dao.avatar.address,
      originalIntVote: proposalInfo.votingMachine.address,
      originalProposalId: proposalInfo.proposalId,
    };

    const result = await voteInOrganizationScheme.proposeVote(options);

    assert.isOk(result);
    assert.isOk(result.tx);
    assert.isOk(result.proposalId);

    assert.equal(result.tx.logs.length, 1); // no other event
    assert.equal(result.tx.logs[0].event, "NewVoteProposal");

    const votingMachine = await helpers.getSchemeVotingMachine(dao, voteInOrganizationScheme);

    assert.isOk(votingMachine);

    /**
     * cast a vote using voteInOrganizationScheme's voting machine.
     */
    await helpers.vote(votingMachine, result.proposalId, 1, accounts[1]);
    await helpers.vote(votingMachine, result.proposalId, 1, accounts[2]);
    /**
     * confirm that a vote was cast by the original DAO's scheme
     */
    const originalVoteEvent = proposalInfo.votingMachine.contract.VoteProposal({}, { fromBlock: 0 });

    await new Promise(async (resolve: fnVoid): Promise<void> => {
      originalVoteEvent.get((err: Error, eventsArray: Array<DecodedLogEntryEvent<VoteProposalEventResult>>) => {

        const foundVoteProposalEvent = eventsArray.filter((e: DecodedLogEntryEvent<VoteProposalEventResult>) => {
          return e.args._proposalId === proposalInfo.proposalId;
        });

        if (foundVoteProposalEvent.length === 1) {
          const event = foundVoteProposalEvent[0];
          /**
           * expect a vote 'for'
           */
          assert.equal(event.args._vote, 1);
          /**
           * expect the vote to have been cast on behalf of the DAO
           */
          assert.equal(event.args._voter, dao.avatar.address, "wrong user voted");
        } else {
          assert(false, "proposal vote not found in original scheme");
        }
        resolve();
      });
    });
  });
});
