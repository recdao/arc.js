# Events

Arc.js offers two types of event systems:  [Pub/Sub](#pubsubevents) and [Web3](web3events).  The Pub/Sub system enables you to subscribe to various events published by Arc.js.  The Web3 system enables you to get and watch events as they originate from Arc contracts and are served up by Web3.

The Web3 events system also has a hybrid of the two, enabling you to watch a Web3 event by subscribing to a Pub/Sub event.

<a name="web3events"></a>
## Arc Web3 Events

We refer to "Web3 events" as the events that originate from Arc contracts and are served up by Web3. (see the [Web3 documentation on contract events](https://github.com/ethereum/wiki/wiki/JavaScript-API#contract-events)).

Arc.js exposes Web3 events in an "almost raw" format virtually the same as Web3, or alternatively as entities that are simpler to use and may provide more information and functionality than the raw event.

<a name="almostrawevents"></a>
### Almost Raw Web3 Events
Every Arc contract wrapper exposes all of the events that it fires, making them look just like the events as exposed by [Web3](https://github.com/ethereum/wiki/wiki/JavaScript-API#contract-events), so you can get, watch and filter these events in the same way you would do using Web3 or Truffle.

And Arc.js provides several advantageous differences:

- If you are using TypeScript then the event data supplied to your callback will by typed, so you will see suggestions and errors in Intellisense and the TypeScript compiler.
- The callback to `get` is invoked once for the entire array of fired events.  The callback to `watch` is invoked once for each value.
- The `get` method directly returns a promise of an array containing every event fetched, bypassing the need for a callback.
- Optionally you can use `subscribe` instead of `watch` to use the Pub/Sub event mechanism as an alternate means of watching events as they fire.  You provide your own name for each subscription, effectifely creating your own Pub/Sub event and giving you some flexibility in how you scope your event handling across event types and schemes.
- You need not worry about duplicate events as Arc.js eliminates them.  (Duplicate events can occur while the chain is in the process of settling down, a feature that can be suppressed if desired).


!!! info
    This "raw" event functionality is provided by Arc.js's [EventFetcherFactory](api/README/#eventfetcherfactory) class and the [Web3EventService](api/classes/Web3EventService).

### Entities for Web3 Events
You can use Arc.js's [Web3EventService](api/classes/Web3EventService) to turn any ["almost raw" event](#almostrawevents) into an [EntityFetcherFactory](api/README/#entityfetcherfactory) that provides cleaner and potentially richer entities than what you get from Web3.

[Proposal-related events](Proposals#proposalevents) make extensive use of this feature, returning custom object types ("entities") instead of the raw Web3 information.

!!! note
    You can "pipe" one `EntityFetcherFactory` to another using the [Web3EventService](api/classes/Web3EventService), chaining transformations of one entity type to another.

### Comparing Almost Raw with Entity Event Fetchers
Almost raw ([EventFetcherFactory](api/README/#eventfetcherfactory)) and entity ([EntityFetcherFactory](api/README/#entityfetcherfactory)) events each have relative pros and cons.  

"Almost raw" events give you all of the information that Web3 provides about an event.

Entity events only give you the entity, but the entity can contain any information you want, including everything from the raw information from the Web3 event.  That is up to the programmer.

Otherwise there is little difference between the two.   They both have the advantages provided by Arc.js.

!!! note
    If you prefer to use the truly-raw events supplied by Web3 and Truffle, you can access them via the contract handler property `contract`, which is the original [Truffle contract](http://truffleframework.com/docs/getting_started/contracts).

<a name="pubsubevents"></a>
## Arc.js Pub/Sub Events

Arc.js has a Pub/Sub event system accessible using the [PubSubEventService](api/classes/PubSubEventService). The Pub/Sub event system enables you to subscribe to various events published by Arc.js.

For example, the Pub/Sub system is used to enable you to track transactions as they complete.  See more in [Transactions](Transactions).  It is also used as an alternate means of watching events in the  Web3 event system using the `subscribe` function implemented by [EventFetcher](api/interfaces/EventFetcher/) and [EntityFetcher](api/interfaces/EntityFetcher/).

The following section describes how to subscribe to events.

### Subscribing to Events
You specify the event to which you want to subscribe using a string as an event specifier (or in the code, the event "topic").

Event specifiers are hierachical. So for example: 
   
   - "txReceipts" subscribes to all events published with that prefix (which in this case means those using [TransactionService](api/classes/TransactionService))
   - "txReceipts.[ContractName]" subscribes to all "txReceipts" events published by the "ContractName]Wrapper" class
   - "txReceipts.[ContractName].[functionName]" subscribes to all "txReceipts" events published by the given function in the "[ContractName]Wrapper" class

!!! note
    The Web3EventService `subscribe` function lets you supply
    your own event names when you subscribe to Web3 events.  In the case you are effectively creating your own
    Pub/Sub event and can name it however you want.  It will still respect the hierarchical rules described above.
