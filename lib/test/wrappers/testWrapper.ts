"use strict";
import { DefaultSchemePermissions, Hash, SchemePermissions } from "../../commonTypes";
import { ArcTransactionDataResult, ContractWrapperBase } from "../../contractWrapperBase";
import { ContractWrapperFactory } from "../../contractWrapperFactory";
import { Web3EventService } from "../../web3EventService";
import { AbsoluteVoteParams } from "../../wrappers/absoluteVote";

export class TestWrapperWrapper extends ContractWrapperBase {

  public name: string = "AbsoluteVote";
  public friendlyName: string = "Test Wrapper";
  public factory: ContractWrapperFactory<TestWrapperWrapper> = TestWrapperFactory;

  public foo(): string {
    return "bar";
  }

  public aMethod(): string {
    return "abc";
  }

  public async setParameters(params: AbsoluteVoteParams): Promise<ArcTransactionDataResult<Hash>> {
    params = Object.assign({},
      {
        ownerVote: true,
        reputation: "0x1000000000000000000000000000000000000000",
        votePerc: 50,
      },
      params);

    return super._setParameters(
      "AbsoluteVote.setParameters",
      params.reputation,
      params.votePerc,
      params.ownerVote
    );
  }

  public getDefaultPermissions(overrideValue?: SchemePermissions): SchemePermissions {
    return (overrideValue || DefaultSchemePermissions.MinimumPermissions) as SchemePermissions;
  }
}

export const TestWrapperFactory =
  new ContractWrapperFactory("AbsoluteVote", TestWrapperWrapper, new Web3EventService());
