# Working with Proposals and Schemes

The ability to create proposals, vote one's reputation and stake one's reputation and tokens on an outcome of a vote are fundamental to promoting coherence and collaboration within and between DAOs in the DAOstack ecosystem.

!!! info
    Refer here for more [about DAOs in Arc.js](Daos) and [about DAOstack's vision for a DAO ecosystem](https://daostack.io/).

<a name="schemes"></a>
## Schemes

Schemes are public-facing contracts that any agent can use to interact with the DAOstack ecosystem and individual DAOs. You can use schemes for various tasks like creating a new DAO ([DaoCreatorWrapper](api/classes/DaoCreatorWrapper)), running an ICO (`SimpleICO`) or managing a DAO registry (`OrganizationRegister`).

!!! note
    `SimpleICO` and `OrganizationRegister` do not yet have [wrapper classes](Wrappers) in Arc.js.

Often we use schemes for working with proposals. Any scheme that works with proposals must be registered with a DAO's controller.  Schemes can be registered both when you [create the DAO](Daos#creatingDAOs) and afterwards using the [SchemeRegistrar](api/classes/SchemeRegistrarWrapper).  


!!! info "More Information about Schemes"
    - [All the schemes wrapped in Arc.js](Wrappers#wrappersByContractType)
    - [Obtaining a list of schemes registered with a DAO](Daos#gettingDaoSchemes)
    - [Universal Schemes in Arc](https://daostack.github.io/arc/contracts/universalSchemes/README/)
    

## Proposals
[More on Proposals to Come]

## Voting Machines

Voting Machines play an integral part in promoting coherence and collaboration within and between DAOs in the DAOstack ecosystem.  Which voting machine you choose to use for your DAO or DAO scheme, and how you configure it, can profoundly affect emergent qualities of your organization.

!!! tip
    You can find more information about Arc voting machines here in the [Arc documentation](https://daostack.github.io/arc/contracts/VotingMachines/README/).

Currently Arc.js wraps two Arc voting machines: [AbsoluteVote](/api/classes/AbsoluteVote) and [GenesisProtocol](/api/classes/GenesisProtocol).  While each of these voting machines have their own individual API, they both implement a common Arc interface called `IntVoteInterface`.  Accordingly, the Arc.js voting machine contract wrapper classes implement a common base class called [IntVoteInterfaceWrapper](/api/classes/IntVoteInterfaceWrapper).

`IntVoteInterfaceWrapper` is a contract wrapper in its own right.  It wraps the `IntVoteInterface` contract.  Thus, like any other contract wrapper, you can instantiate it using a factory class, in this case [VotingMachineWrapperFactory]()
