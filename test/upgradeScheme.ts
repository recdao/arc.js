import { assert } from "chai";
import { BinaryVoteResult } from "../lib";
import { Utils } from "../lib/utils";
import { UpgradeSchemeFactory, UpgradeSchemeWrapper } from "../lib/wrappers/upgradeScheme";
import * as helpers from "./helpers";

describe("UpgradeScheme", () => {
  let avatar;
  let Controller;
  let DAOToken;
  let Avatar;
  let Reputation;

  beforeEach(async () => {

    Controller = await Utils.requireContract("Controller");
    DAOToken = await Utils.requireContract("DAOToken");
    Avatar = await Utils.requireContract("Avatar");
    Reputation = await Utils.requireContract("Reputation");

    const token = await DAOToken.new("TEST", "TST", 0);
    // set up a reputation system
    const reputation = await Reputation.new();
    avatar = await Avatar.new("name", token.address, reputation.address);
  });

  it("can get upgraded UpgradeSchemes", async () => {

    const dao = await helpers.forgeDao();

    const upgradeScheme =
      await helpers.getDaoScheme(dao, "UpgradeScheme", UpgradeSchemeFactory) as UpgradeSchemeWrapper;

    const newUpgradeScheme = await UpgradeSchemeFactory.new();

    assert.isFalse(
      await dao.isSchemeRegistered(newUpgradeScheme.address),
      "new scheme is already registered into the controller"
    );
    assert.isTrue(
      await dao.isSchemeRegistered(upgradeScheme.address),
      "original scheme is not registered into the controller"
    );

    const result = await upgradeScheme.proposeUpgradingScheme({
      avatar: dao.avatar.address,
      scheme: newUpgradeScheme.address,
      schemeParametersHash: await dao.controller.getSchemeParameters(upgradeScheme.address, dao.avatar.address),
    });

    const proposalId = result.proposalId;

    const proposalService = upgradeScheme.proposalServiceUpgradeUpgradeScheme;

    const proposals = await proposalService.getProposals({ avatarAddress: dao.avatar.address });

    assert.equal(proposals.length, 1);

    const proposal = proposals[0];
    assert.equal(proposal.proposalId, proposalId);
  });

  it("proposeController javascript wrapper should change controller", async () => {
    const dao = await helpers.forgeDao();

    const upgradeScheme =
      await helpers.getDaoScheme(dao, "UpgradeScheme", UpgradeSchemeFactory) as UpgradeSchemeWrapper;
    const newController = await Controller.new(avatar.address);

    assert.equal(
      await dao.controller.newControllers(dao.avatar.address),
      helpers.NULL_ADDRESS,
      "there is already a new controller"
    );

    const result = await upgradeScheme.proposeController({
      avatar: dao.avatar.address,
      controller: newController.address,
    });

    // newUpgradeScheme.registerDao(dao.avatar.address);

    const proposalId = result.proposalId;

    const votingMachine = await helpers.getSchemeVotingMachine(dao, upgradeScheme);
    await helpers.vote(votingMachine, proposalId, 1, accounts[1]);

    // now the ugprade should have been executed
    assert.equal(await dao.controller.newControllers(dao.avatar.address), newController.address);

    // avatar, token and reputation ownership shold have been transferred to the new controller
    assert.equal(await dao.token.owner(), newController.address);
    assert.equal(await dao.reputation.owner(), newController.address);
    assert.equal(await dao.avatar.owner(), newController.address);
  });

  it("controller upgrade should work as expected", async () => {

    const dao = await helpers.forgeDao();

    const upgradeScheme =
      await helpers.getDaoScheme(dao, "UpgradeScheme", UpgradeSchemeFactory) as UpgradeSchemeWrapper;

    // the dao has not been upgraded yet, so newController is the NULL address
    assert.equal(await dao.controller.newControllers(dao.avatar.address), helpers.NULL_ADDRESS);

    // we create a new controller to which to upgrade
    const newController = await Controller.new(avatar.address);

    const result = await upgradeScheme.proposeController({
      avatar: dao.avatar.address,
      controller: newController.address,
    }
    );

    const proposalId = result.proposalId;
    // now vote with the majority for the proposal
    const votingMachine = await helpers.getSchemeVotingMachine(dao, upgradeScheme);
    await helpers.vote(votingMachine, proposalId, 1, accounts[1]);

    // now the ugprade should have been executed
    assert.equal(
      await dao.controller.newControllers(dao.avatar.address),
      newController.address
    );

    // avatar, token and reputation ownership shold have been transferred to the new controller
    assert.equal(await dao.token.owner(), newController.address);
    assert.equal(await dao.reputation.owner(), newController.address);
    assert.equal(await dao.avatar.owner(), newController.address);

    // TODO: we also want to reflect this upgrade in our Controller object!
  });

  it("proposeUpgradingScheme javascript wrapper should change upgrade scheme", async () => {
    const dao = await helpers.forgeDao();

    const upgradeScheme =
      await helpers.getDaoScheme(dao, "UpgradeScheme", UpgradeSchemeFactory) as UpgradeSchemeWrapper;

    const newUpgradeScheme = await UpgradeSchemeFactory.new();

    assert.isFalse(
      await dao.isSchemeRegistered(newUpgradeScheme.address),
      "new scheme is already registered into the controller"
    );
    assert.isTrue(
      await dao.isSchemeRegistered(upgradeScheme.address),
      "original scheme is not registered into the controller"
    );

    const result = await upgradeScheme.proposeUpgradingScheme({
      avatar: dao.avatar.address,
      scheme: newUpgradeScheme.address,
      schemeParametersHash: await dao.controller.getSchemeParameters(upgradeScheme.address, dao.avatar.address),
    });

    const proposalId = result.proposalId;

    const votingMachine = await helpers.getSchemeVotingMachine(dao, upgradeScheme);
    await helpers.vote(votingMachine, proposalId, 1, accounts[1]);

    assert.isTrue(
      await dao.isSchemeRegistered(newUpgradeScheme.address),
      "new scheme is not registered into the controller"
    );
  });

  it("proposeUpgradingScheme javascript wrapper should modify the modifying scheme", async () => {
    const dao = await helpers.forgeDao();

    const upgradeScheme =
      await helpers.getDaoScheme(dao, "UpgradeScheme", UpgradeSchemeFactory) as UpgradeSchemeWrapper;

    assert.isTrue(
      await dao.isSchemeRegistered(upgradeScheme.address),
      "upgrade scheme is not registered into the controller"
    );

    const result = await upgradeScheme.proposeUpgradingScheme({
      avatar: dao.avatar.address,
      scheme: upgradeScheme.address,
      schemeParametersHash: helpers.SOME_HASH,
    });

    const proposalId = result.proposalId;

    const votingMachine = await helpers.getSchemeVotingMachine(dao, upgradeScheme);
    await helpers.vote(votingMachine, proposalId, 1, accounts[1]);

    assert.isTrue(
      await dao.isSchemeRegistered(upgradeScheme.address),
      "upgrade scheme is no longer registered into the controller"
    );

    assert.equal(
      await dao.controller.getSchemeParameters(upgradeScheme.address, dao.avatar.address),
      helpers.SOME_HASH,
      "parameters were not updated"
    );
  });
});
