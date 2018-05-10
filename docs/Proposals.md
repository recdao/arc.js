# Working with Proposals and Schemes

The ability to create proposals, vote one's reputation and stake one's reputation and tokens on an outcome of a vote are fundamental to promoting coherence and collaboration within and between DAOs in the DAOstack ecosystem.

!!! info
    Refer here for more [about DAOs in Arc.js](Daos) and [about DAOstack's vision for a DAO ecosystem](https://daostack.io/).

It all starts with "scheme" contracts that generate proposals and supply a voting machine for each proposal.

<a name="schemes"></a>
## Schemes

Schemes are public-facing contracts that any agent can use to interact with the DAOstack ecosystem and individual DAOs. You can use schemes for various tasks like creating a new DAO ([DaoCreatorWrapper](api/classes/DaoCreatorWrapper)), running an ICO (`SimpleICO`) or managing a DAO registry (`OrganizationRegister`).

!!! note
    `SimpleICO` and `OrganizationRegister` do not yet have [wrapper classes](Wrappers) in Arc.js.

Some schemes are specifically designed to generate proposals.

!!! note
    Any scheme that works with proposals must be registered with a DAO's controller, which is done either when you [create the DAO](Daos#creatingDAOs) or afterwards using the [SchemeRegistrar](api/classes/SchemeRegistrarWrapper).

!!! info
    More information about schemes:

    - [All the schemes wrapped in Arc.js](Wrappers#wrappersByContractType)
    - [Obtaining a list of schemes registered with a DAO](Daos#gettingDaoSchemes)
    - [Universal Schemes in Arc](https://daostack.github.io/arc/contracts/universalSchemes/README/)
    

## Proposals
Proposals are emergent ideas in a DAO.  They manifest in reality when a proposal-generating scheme is used to submit the idea to a vote, and if the proposed idea receives enough votes according to the rules and parameters of the voting machine associated with the scheme (see [Voting Machines](#votingmachines)).

The following table describes the various proposals one can create from scheme wrappers in Arc.js:

<a name="proposalschemestable"></a>

Proposal | Scheme Wrapper Class | Scheme Method
---------|----------|---------
 Propose to reward an agent for contributions to the DAO | ContributionRewardWrapper | proposeContributionReward
 Propose to add or modify a global constraint | GlobalConstraintRegistrarWrapper | proposeToAddModifyGlobalConstraint
 Propose to remove a global constraint | GlobalConstraintRegistrarWrapper | proposeToRemoveGlobalConstraint
 Propose to add or modify a scheme | SchemeRegistrarWrapper | proposeToAddModifyScheme
 Propose to remove a scheme | SchemeRegistrarWrapper | proposeToRemoveScheme
 Propose an alternative Controller for the DAO | UpgradeSchemeWrapper | proposeController
 Propse an alternative UpgradeScheme | UpgradeSchemeWrapper | proposeUpgradingScheme
 Propose a vesting agreement | VestingSchemeWrapper | propose
 Propose to vote for any proposal in another DAO | VoteInOrganizationSchemeWrapper | proposeVote

Each of the scheme methods listed in the table above returns a promise of an [ArcTransactionProposalResult](/api/classes/ArcTransactionProposalResult) that will contain:

- `proposalId` - a Hash value that uniquely identifies a proposal, used to identify proposals everywhere where we refer to a proposal.
- `votingMachine` - the voting machine for the proposal, as an [IntVoteInterfaceWrapper](/api/classes/IntVoteInterfaceWrapper), facilitating operations such as voting on the proposal. (see [Voting Machines](#votingmachines)).

You may find yourself wanting to keep track of proposals as they are being created and executed; see "Proposal Events" below.

!!! info
    A proposal is "executed" when the voting process concludes.

<a name="proposalevents"></a>
### Proposal Events

Each scheme responsible for creating proposals provides `EventFetcherFactory`'s for tracking important events during a proposal's lifecycle (see [the table above](#proposalschemestable)).  These events come straight from the wrapped Arc contract.

Each such scheme also contains `EntityFetcherFactory`'s for tracking a proposal's lifecycle, including:

- A method, for each proposal type, that returns an `EntityFetcherFactory` for proposals that are still votable.  The fetched entity will contain information about the proposal, plus an instance of [IntVoteInterfaceWrapper](/api/classes/IntVoteInterfaceWrapper) for the proposal's voting machine, facilitating operations such as voting on the proposal.

- A method called `getExecutedProposals` that returns an `EntityFetcherFactory` for executed proposals.  Some of the schemes provide additional information in the fetched entity, where additional information is available.  

!!! Info
    See [Enhanced Web3 Events](Events#almostrawevents) and [Entities for Web3 Events](Events#entityevents) for more information about these event-fetching interfaces.

A proposal will never manifest in reality unless it receives sufficient support through a voting process, hence voting machines.

<a name="votingmachines"></a>
## Voting Machines

Voting machines play an integral part in promoting coherence and collaboration within and between DAOs in the DAOstack ecosystem.  Which voting machine you choose to use for your DAO or DAO scheme, and how you configure it, can profoundly affect the emergent qualities of your organization.

!!! tip
    Find more information about Arc voting machines in the [Arc documentation](https://daostack.github.io/arc/contracts/VotingMachines/README/).

Arc.js wraps two Arc voting machines: [AbsoluteVote](/api/classes/AbsoluteVoteWrapper) and [GenesisProtocol](/api/classes/GenesisProtocolWrapper).  While each of these voting machines have their own individual API, they both implement a common Arc interface called `IntVoteInterface`.  Accordingly, the Arc.js voting machine contract wrapper classes implement a common base class called [IntVoteInterfaceWrapper](/api/classes/IntVoteInterfaceWrapper).

!!! note
    Arc has another voting machine contract called `QuorumVote` that Arc.js does not yet wrap.
    
Every proposal-generating scheme has an associated voting machine with appropriate configurations for the scheme.  Every proposal created by the scheme will use the scheme's voting machine.  You can obtain the voting machine for   any proposal-generating scheme using the scheme's `getVotingMachine` method, returned as an [IntVoteInterfaceWrapper](/api/classes/IntVoteInterfaceWrapper).

You will also encounter [IntVoteInterfaceWrapper](/api/classes/IntVoteInterfaceWrapper) in [ArcTransactionProposalResult](/api/classes/ArcTransactionProposalResult), returned by [every method that creates a proposal](#proposalschemestable), and in the events that proposal-generating schemes provide to [track votable proposals](#proposalevents).
