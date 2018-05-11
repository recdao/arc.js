import { assert } from "chai";
import { DefaultSchemePermissions } from "../lib/commonTypes";
import { Utils } from "../lib/utils";
import {
  SchemeRegistrarFactory,
  SchemeRegistrarProposalType,
  SchemeRegistrarWrapper
} from "../lib/wrappers/schemeRegistrar";
import { UpgradeSchemeFactory, UpgradeSchemeWrapper } from "../lib/wrappers/upgradeScheme";
import * as helpers from "./helpers";

describe("SchemeRegistrar", () => {

  it("can add scheme with voteToRemove parameters ", async () => {
    const voteParamsArray = [helpers.SOME_ADDRESS, 33, true];

    // see AbsoluteVote Parameters struct
    const voteParamsHash = Utils.keccak256(
      ["address", "uint", "bool"],
      voteParamsArray);

    const dao = await helpers.forgeDao({
      schemes: [{
        additionalParams: {
          voteRemoveParametersHash: voteParamsHash,
        },
        name: "SchemeRegistrar",
      }],
    });

    const schemeRegistrar =
      await helpers.getDaoScheme(dao, "SchemeRegistrar", SchemeRegistrarFactory) as SchemeRegistrarWrapper;
    assert.isOk(schemeRegistrar);

    const votingMachine = await helpers.getSchemeVotingMachine(dao, schemeRegistrar);

    await votingMachine.contract.setParameters(voteParamsArray[0], voteParamsArray[1], voteParamsArray[2]);

    assert.equal(
      await votingMachine.contract.getParametersHash(voteParamsArray[0], voteParamsArray[1], voteParamsArray[2]),
      voteParamsHash, "voting machine params hash was not correctly computed");

    const voteParams = await votingMachine.getParameters(voteParamsHash);

    assert.equal(voteParams.reputation, helpers.SOME_ADDRESS);
    assert.equal(voteParams.votePerc, 33);
    assert.equal(voteParams.ownerVote, true);

    const schemeParams = await schemeRegistrar.getSchemeParameters(dao.avatar.address);

    assert.equal(schemeParams.voteRemoveParametersHash, voteParamsHash, "hash was not persisted correctly");
  });

  it("proposeToAddModifyScheme javascript wrapper should add new scheme", async () => {

    const dao = await helpers.forgeDao();

    const wrappers = helpers.contractsForTest();

    const schemeRegistrar =
      await helpers.getDaoScheme(dao, "SchemeRegistrar", SchemeRegistrarFactory) as SchemeRegistrarWrapper;
    const contributionReward = await dao.getSchemes("ContributionReward");
    assert.equal(contributionReward.length, 0, "scheme is already present");

    const contributionRewardAddress =
      wrappers.ContributionReward.address;

    assert.isFalse(
      await dao.isSchemeRegistered(contributionRewardAddress),
      "scheme is registered into the controller"
    );

    const result = await schemeRegistrar.proposeToAddModifyScheme({
      avatar: dao.avatar.address,
      schemeAddress: contributionRewardAddress,
      schemeName: "ContributionReward",
      schemeParametersHash: Utils.NULL_HASH,
    });

    const proposalId = result.proposalId;

    const votingMachine = await helpers.getSchemeVotingMachine(dao, schemeRegistrar);
    await helpers.vote(votingMachine, proposalId, 1, accounts[1]);

    assert.isTrue(
      await dao.isSchemeRegistered(contributionRewardAddress),
      "scheme is not registered into the controller"
    );
  });

  it("proposeToAddModifyScheme javascript wrapper should modify existing scheme", async () => {
    const dao = await helpers.forgeDao();

    const schemeRegistrar =
      await helpers.getDaoScheme(dao, "SchemeRegistrar", SchemeRegistrarFactory) as SchemeRegistrarWrapper;
    const upgradeScheme = await dao.getSchemes("SchemeRegistrar");
    assert.equal(upgradeScheme.length, 1, "scheme is not present");

    const modifiedSchemeAddress = upgradeScheme[0].address;

    const result = await schemeRegistrar.proposeToAddModifyScheme({
      avatar: dao.avatar.address,
      schemeAddress: modifiedSchemeAddress,
      schemeName: "SchemeRegistrar",
      schemeParametersHash: Utils.NULL_HASH,
    });

    const proposalId = result.proposalId;

    const votingMachine = await helpers.getSchemeVotingMachine(dao, schemeRegistrar);
    await helpers.vote(votingMachine, proposalId, 1, accounts[1]);

    assert.isTrue(
      await dao.isSchemeRegistered(modifiedSchemeAddress),
      "scheme is not registered into the controller"
    );

    const paramsHash = await dao.controller.getSchemeParameters(modifiedSchemeAddress, dao.avatar.address);

    assert.equal(paramsHash, Utils.NULL_HASH, "parameters hash is not correct");
  });

  it("proposeToRemoveScheme javascript wrapper should remove scheme", async () => {
    const dao = await helpers.forgeDao();

    const schemeRegistrar =
      await helpers.getDaoScheme(dao, "SchemeRegistrar", SchemeRegistrarFactory) as SchemeRegistrarWrapper;
    // schemeRegistrar can't remove a scheme with greater permissions that it has
    const removedScheme = schemeRegistrar;

    const result = await schemeRegistrar.proposeToRemoveScheme({
      avatar: dao.avatar.address,
      schemeAddress: removedScheme.address,
    });

    const proposalId = result.proposalId;

    const votingMachine = await helpers.getSchemeVotingMachine(dao, schemeRegistrar);
    await helpers.vote(votingMachine, proposalId, 1, accounts[1]);

    assert.isFalse(
      await dao.isSchemeRegistered(removedScheme.address),
      "scheme is still registered into the controller"
    );
  });

  it("can get proposals", async () => {

    const dao = await helpers.forgeDao();

    const schemeRegistrar =
      await helpers.getDaoScheme(dao, "SchemeRegistrar", SchemeRegistrarFactory) as SchemeRegistrarWrapper;

    const upgradeScheme =
      await helpers.getDaoScheme(dao, "UpgradeScheme", UpgradeSchemeFactory) as UpgradeSchemeWrapper;

    const removedScheme = upgradeScheme;

    let result = await schemeRegistrar.proposeToRemoveScheme({
      avatar: dao.avatar.address,
      schemeAddress: removedScheme.address,
    });

    const proposalToRemoveId = result.proposalId;

    const contributionReward = await dao.getSchemes("ContributionReward");
    assert.equal(contributionReward.length, 0, "scheme is already present");

    const wrappers = helpers.contractsForTest();
    const contributionRewardAddress = wrappers.ContributionReward.address;

    assert.isFalse(
      await dao.isSchemeRegistered(contributionRewardAddress),
      "scheme is registered into the controller"
    );

    result = await schemeRegistrar.proposeToAddModifyScheme({
      avatar: dao.avatar.address,
      permissions: DefaultSchemePermissions.ContributionReward,
      schemeAddress: contributionRewardAddress,
      schemeName: "ContributionReward",
      schemeParametersHash: Utils.NULL_HASH,
    });

    const proposalToAddId = result.proposalId;

    const proposalsNew =
      await schemeRegistrar.createProposalServiceNewSchemes().getProposals({ avatarAddress: dao.avatar.address });

    assert.equal(proposalsNew.length, 1, "Should have found 1 proposals");
    assert(proposalsNew[0].proposalId === proposalToAddId, "proposalToAddId not found");
    assert.equal(proposalsNew[0].proposalType, SchemeRegistrarProposalType.Add);
    assert.equal(proposalsNew[0].permissions, DefaultSchemePermissions.ContributionReward);

    const proposalsRemove =
      await schemeRegistrar.createProposalServiceRemoveSchemes().getProposals({ avatarAddress: dao.avatar.address });

    assert.equal(proposalsRemove.length, 1, "Should have found 1 proposals");
    assert(proposalsRemove[0].proposalId === proposalToRemoveId, "proposalToRemoveId not found");
    assert.equal(proposalsRemove[0].proposalType, SchemeRegistrarProposalType.Remove);
  });
});
