"use strict";
import { assert } from "chai";
import { DefaultSchemePermissions } from "../lib/commonTypes";
import { ConfigService } from "../lib/configService";
import { InitializeArcJs } from "../lib/index";
import { PubSubEventService } from "../lib/pubSubEventService";
import { TestWrapperFactory } from "../lib/test/wrappers/testWrapper";
import { Utils } from "../lib/utils";
import { WrapperService } from "../lib/wrapperService";
import "./helpers";

describe("InitializeArcJs", () => {

  describe("PubSub events", () => {
    it("topicSubsumes works", async () => {
      let testId = 0;

      /* tslint:disable:max-line-length */
      assert.isTrue(PubSubEventService.isTopicSpecifiedBy("*", "foo"), `test failed: ${++testId}`);
      assert.isTrue(PubSubEventService.isTopicSpecifiedBy(["*"], "foo"), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy([], ""), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy([""], ""), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy("", ""), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy("", "foo"), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy("foobar", "foo"), `test failed: ${++testId}`);
      assert.isTrue(PubSubEventService.isTopicSpecifiedBy("foo", "foo"), `test failed: ${++testId}`);
      assert.isTrue(PubSubEventService.isTopicSpecifiedBy("foo.bar", "foo.bar"), `test failed: ${++testId}`);
      assert.isTrue(PubSubEventService.isTopicSpecifiedBy("foo", "foo.bar"), `test failed: ${++testId}`);
      assert.isTrue(PubSubEventService.isTopicSpecifiedBy("foo", "foo.bar.test"), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy("foo", "foobar.test"), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy("foobar", "foo.bar"), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy("foo.bar", "foo"), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy("foo.bar.test", "foo"), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy("foo.bar.", "foo"), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy("foo.bar.", "foo."), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy("foo.bar", "foo."), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy(["flank", "foo"], "bar"), `test failed: ${++testId}`);
      assert.isTrue(PubSubEventService.isTopicSpecifiedBy(["foo", "bar"], "bar"), `test failed: ${++testId}`);
      assert.isTrue(PubSubEventService.isTopicSpecifiedBy(["bar", "foo"], "bar"), `test failed: ${++testId}`);
      assert.isFalse(PubSubEventService.isTopicSpecifiedBy(["barn", "foo.bar", "flank"], "bar"), `test failed: ${++testId}`);
      assert.isTrue(PubSubEventService.isTopicSpecifiedBy(["barn", "foo", "flank"], "foo.bar"), `test failed: ${++testId}`);
      /* tslint:enable:max-line-length */
    });
  });

  it("Proper error when no web3", async () => {

    const web3 = await Utils.getWeb3();
    const providerUrl = ConfigService.get("providerUrl");
    let exceptionRaised = false;
    try {
      (Utils as any).web3 = undefined;
      (global as any).web3 = undefined;
      ConfigService.set("providerUrl", "sdfkjh");
      await InitializeArcJs();
    } catch (ex) {
      exceptionRaised = ex.message.includes("Utils.getWeb3: web3 is not connected to a net");
    }
    (global as any).web3 = web3;
    ConfigService.set("providerUrl", providerUrl);
    assert(exceptionRaised, "proper exception was not raised");
  });
});

describe("ContractWrapperBase", () => {
  it("can call getDefaultAccount", async () => {
    const defaultAccount = accounts[0];
    const defaultAccountAsync = await Utils.getDefaultAccount();
    assert(defaultAccount === defaultAccountAsync);
  });

  it("Must have sane inheritance", async () => {
    let scheme;

    assert.isOk(TestWrapperFactory, "TestWrapperWrapper is not defined");
    assert.isOk(TestWrapperFactory.deployed, "TestWrapperWrapper.deployed is not defined");
    scheme = await TestWrapperFactory.deployed();
    assert.equal(scheme.foo(), "bar");
    assert.equal(scheme.aMethod(), "abc");
    assert.equal(
      (await scheme.setParameters({})).result,
      "0xfc844154428d1b1c6806ceacdd3ed0974cc02c30983036bc5db6b5aed2fa394b"
    );
    assert.equal(scheme.getDefaultPermissions(), DefaultSchemePermissions.MinimumPermissions);

    scheme = await TestWrapperFactory.at(WrapperService.wrappers.AbsoluteVote.address);
    assert.equal(scheme.foo(), "bar");
    assert.equal(scheme.aMethod(), "abc");

    assert.isOk(scheme.factory);
    assert.isOk(scheme.factory.at);

    const newScheme = await scheme.factory.new();
    assert(newScheme);
    assert(newScheme.name === "AbsoluteVote");
    assert(newScheme.address !== scheme.address);
  });
});
