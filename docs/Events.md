# Events

Arc.js offers two types of event systems:  [Web3](web3events) and [Pub/Sub](#pubsubevents).  The Pub/Sub system enables you to subscribe to miscellaneous events published by Arc.js.  The Web3 system enables you to get and watch events as they originate from Arc contracts and then are packaged into JavaScript by Web3.

<a name="web3events"></a>
## Arc Web3 Events

We refer to "Web3 events" as the events that originate from Arc contracts and then are packaged into JavaScript by Web3 (see the [Web3 documentation on contract events](https://github.com/ethereum/wiki/wiki/JavaScript-API#contract-events)).  You can get, watch and filter these events.

Arc.js exposes Web3 events in an "almost raw" format virtually the same as Web3, or as entities that are simpler to use and may provide more information and functionality than the raw event.

<a name="almostrawevents"></a>
### Almost Raw Events
For every Arc contract that fires events and is wrapped by Arc.js, the Arc.js wrapper exposes the events, making them look just like the events as exposed by [Web3](https://github.com/ethereum/wiki/wiki/JavaScript-API#contract-events) and [Truffle contracts](http://truffleframework.com/docs/getting_started/contracts), but with several advantages:

1. If you are using TypeScript then the event arguments (`event.args`) will by typed, so you will see suggestions and errors in Intellisense and the TypeScript compiler.
2. With Truffle, the callback to `get` or `watch` may or may not receive an array of events.  Sometimes it can be a single event.  The Arc.js wrapper always gives you an array.
3. Arc.js eliminates duplicate events that can occur while the chain is in the process of settling down (a feature that can be suppressed if desired).
4. The `get` method returns a promise of an array of `event.args`, bypassing the need for a callback if `args` is all the information you
need about the event.

!!! info
    This "raw" event functionality is provided by Arc.js's [EventFetcherFactory](api/README/#eventfetcherfactory) class and the [Web3EventService](api/classes/Web3EventService).

### Entities for Events
You can get cleaner and simpler Web3 events using Arc.js's [Web3EventService](api/classes/Web3EventService) to turn any ["almost raw" event](#almostrawevents) into an [EntityFetcherFactory](api/README/#entityfetcherfactory) that provides cleaner and potentially richer entities instead of the leaner and more awkward Web3 `event.args` syntax.

One example of this, from [ContributionRewardWrapper](api/classes/ContributionRewardWrapper), is a function that returns a promise of an [EntityFetcherFactory](api/README/#entityfetcherfactory) that turns `event.args` from the [NewContributionProposal event](api/classes/ContributionRewardWrapper#NewContributionProposal) into a [ContributionProposal](api/interfaces/ContributionProposal) entity (object or interface).

!!! info
    Look here to find out more about [how to use proposal-related events](Proposals).

!!! tip
    You can also "pipe" one `EntityFetcherFactory` to another using the [Web3EventService](api/classes/Web3EventService), chaining one entity type to another.

### Comparing Almost Raw with Entity Event Fetchers
Almost raw ([EventFetcherFactory](api/README/#eventfetcherfactory)) and entity ([EntityFetcherFactory](api/README/#entityfetcherfactory)) events each have relative pros and cons.  

"Almost raw" events give you all of the information that Web3 provides about an event.

Entity events only give you the entity, but the entity can contain any information you want, including everything from the raw information from the Web3 event.  That is up to the programmer.

Otherwise there is little difference between the two.  They both have all of the advantages of the [EventFetcherFactory](api/README/#eventfetcherfactory).

<a name="pubsubevents"></a>
## Arc.js Pub/Sub Events

Arc.js has a Pub/Sub event system accessible using the [PubSubEventService](api/classes/PubSubEventService). The Pub/Sub event system enables you to subscribe to miscellaneous events published by Arc.js.  The following section describes how to subscribe to events.

!!! info
    The [PubSubEventService](api/classes/PubSubEventService) is extensively used for tracking transactions as they complete.  See more in [Transactions](Transactions).


### Subscribing to Events
You can specify the event to which you want to subscribe using a string as an event specifier (or in the code, the event "topic").  The event specifier typically incorporates an Arc contract name which will map to events published by a wrapper class for that contract.  For example, the event specifier "txReceipts.DaoCreator" refers to "txReceipts" events published by [DaoCreatorWrapper](api/classes/DaoCreatorWrapper) (using the [TransactionService](api/classes/TransactionService)).

!!! note
    There are a couple of exceptions when a specific contract is not involved, namely with `DAO.new` and `ContractWrapper.setParameters` (the latter covers all calls to [ContractWrapperBase.setParameters](api/classes/ContractWrapperBase#setParameters) from all of the wrappers).

Event specifiers are hierachical. So for example: 
   
   - "txReceipts" subscribes to all events published with that prefix (which in this case means those using [TransactionService](api/classes/TransactionService))
   - "txReceipts.[ContractName]" subscribes to all "txReceipts" events published by the "ContractName]Wrapper" class
   - "txReceipts.[ContractName].[functionName]" subscribes to all "txReceipts" events published by the given function in the "[ContractName]Wrapper" class
