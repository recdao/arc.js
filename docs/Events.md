# Events

Arc.js offers two types of event systems:  [Pub/Sub](#pubsubevents) and [Web3](web3events).  The Pub/Sub system enables you to subscribe to various events published by Arc.js itself.  The Web3 system enables you to get and watch events as they originate from Arc contracts.

The Web3 events system also contains a hybrid of the two systems, enabling you to watch a Web3 event by subscribing to a Pub/Sub event.

<a name="pubsubevents"></a>
## Arc.js Pub/Sub Events

The [PubSubEventService](api/classes/PubSubEventService) provides a Pub/Sub event system that enables you to subscribe to various events published by Arc.js.

Two uses of the Pub/Sub system are 1) to track transactions as they complete (see more in [Transactions](Transactions)), and 2) as an alternate means of watching events in the  Web3 event system using the `subscribe` function implemented by [EventFetcher](api/interfaces/EventFetcher/) and [EntityFetcher](api/interfaces/EntityFetcher/).

The following section describes how to subscribe to events.

<a name="subscribing"></a>
### Subscribing to Events
You specify the event to which you want to subscribe using a string called the event "topic".

Event topics may be hierachically scoped by levels separated by periods ('.'). So for example: 
   
   - "A.B.C" subscribes to all "A.B.C" events
   - "A.B" subscribes to all events prefixed by "A.B"
   - "A" subscribes to all events prefixed by "A"

Use `PubSubEventService` like this:

```javascript
const subscription = PubSubEventService.subscribe("aTopic", (topic, payload) =>
{
  console.log(`received event ${topic}` with: ${payload.[someImportantProperty]});
})
```

You can subscribe to multiple events at once by passing the topics in an array:

```javascript
const subscription = PubSubEventService.subscribe(
  ["aTopic 1", "aTopic 2"], (topic, payload) =>
{
  console.log(`received event ${topic}` with: ${payload.[someImportantProperty]});
})
```


When you are done, be sure to unsubscribe to the event(s) or you risk memory leaks and excessive CPU usage:

```javascript
subscription.unsubscribe();
```

Or unsubscribe by topic: 

```javascript
PubSubEventService.unsubscribe("aTopic");
```

Or by the callback you passed in when you subscribed:

```javascript
PubSubEventService.unsubscribe(aCallback);
```

<a name="web3events"></a>
## Arc Web3 Events

We refer to "Web3 events" as the events that originate from Arc contracts and are served up by Web3. (see the [Web3 documentation on contract events](https://github.com/ethereum/wiki/wiki/JavaScript-API#contract-events)).

Arc.js exposes Web3 events in an format virtually the same as Web3, but with enhancements, or alternatively as entities that are simpler to use and may provide more information and functionality than the raw event.

<a name="almostrawevents"></a>
### Enhanced Web3 Events
Every Arc contract wrapper in Arc.js exposes all of the events fired by the wrapped contract, making them look just like the events as exposed by [Web3](https://github.com/ethereum/wiki/wiki/JavaScript-API#contract-events), so you can get, watch and filter these events in the same way you would using Web3 or Truffle.

Arc.js enhances these events in several ways:

- If you are using TypeScript then the event data supplied to your callback will by typed, so you will see suggestions and errors in Intellisense and the TypeScript compiler.
- The callback to `get` is invoked once for the entire array of fired events, always returning an array.  The callback to `watch` is invoked once for each value, always returning the event.
- The `get` method directly returns a promise of an array containing every event fetched, bypassing the need for a callback.
- Optionally you can use `subscribe` instead of `watch` to use the Pub/Sub event mechanism as an alternate means of watching events as they fire. See [Pub/Sub Web3 Events](#pubsubweb3).
- You need not worry about duplicate events, Arc.js eliminates them.  (Duplicate events can occur while the chain is in the process of settling down, a feature that can be suppressed if desired).

This enhanced event functionality is provided by [Web3EventService.createEventFetcherFactory(...)](api/classes/Web3EventService#createEventFetcherFactory) which returns an [EventFetcherFactory](api/README/#eventfetcherfactory) function which returns an [EventFetcher](api/interfaces/eventfetcher) which gives you the `get`, `watch` and `subscribe` methods.

Here is an example of the above flow, resulting in calling `get` without a callback to get all `ChangeUpgradeSchemeProposal` events pertaining to a given DAO:

```javascript
const web3EventService = new Web3EventService();

const eventFetcherFactory = 
web3EventService.createEventFetcherFactory(upgradeContract.contract.ChangeUpgradeSchemeProposal);

const eventFetcher = eventFetcherFactory(
  { _avatar: [someAddress] }, { fromBlock: 0});

const events = await eventFetcher.get();

events.forEach((event) => { console.log(`proposal id: ${event._proposalId}`); } );
```

All of Arc.js contract wrappers already provide an `EventFetcherFactory` method for each of the Arc events in the contract they wrap.  So the code example given above becomes simpler:

```javascript
const eventFetcher = upgradeScheme.ChangeUpgradeSchemeProposal(
  { _avatar: [someAddress] }, { fromBlock: 0});

const events = await eventFetcher.get();

events.forEach((event) => { console.log(`proposal id: ${event._proposalId}`); } );
```

### Entities for Web3 Events
You can use [Web3EventService](api/classes/Web3EventService) to turn any [EventFetcherFactory](api/README/#eventfetcherfactory) into an [EntityFetcherFactory](api/README/#entityfetcherfactory) providing cleaner and potentially richer entities than what you get from Web3 and [EventFetcherFactory](api/README/#eventfetcherfactory).

The [EntityFetcherFactory](api/README/#entityfetcherfactory) creates an [EntityFetcher](api/interfaces/entityfetcher) which gives you the `get`, `watch` and `subscribe` methods.

Making extensive use of this feature, [Proposal-related events](Proposals#proposalevents) return custom object types ("entities") instead of the raw information returned by the enhanced Web3 events.

Here is how you can turn `ChangeUpgradeSchemeProposal` into an `EntityFetcherFactory` whose events give you an object with a single `avatarAddress` property:

```javascript
const entityFetcherFactory = web3EventService.createEntityFetcherFactory(
  upgradeScheme.ChangeUpgradeSchemeProposal,
  async (args): Promise => {
    return Promise.resolve({ avatarAddress: args._avatar });
  });

const eventFetcher = entityFetcherFactory({}, { fromBlock: 0});

eventFetcher.watch(
  (error, event) => { 
    if (!error) {
      console.log(`avatarAddress: ${entity.avatarAddress}`); 
    }
);
```

When you are done with fetching these events you can stop watching:

```javascript
eventFetcher.stopWatching();
```

!!! note
    You can "pipe" one `EntityFetcherFactory` to another using the [Web3EventService.pipeEntityFetcherFactory](api/classes/Web3EventService#pipeEntityFetcherFactory), chaining transformations of one entity type to another.

<a name="pubsubweb3"></a>
### Pub/Sub Web3 Events

Both `EventFetcher` and `EntityFetcher` provide a `subscribe` function enables you specify the topic of a Pub/Sub event that will be published whenever the underlying Web3 event is fired.

When you specify the topic for a subscription you are effectively creating your own Pub/Sub event.  You have  wide flexibility in how you scope the handling of events across different Arc.js contract wrappers and events, including
leveraging the hierarchical structure that you can build into your topic strings.

Further, any number of code components can use [PubSubEventService.subscribe](/api/classes/PubSubEventService#subscribe) to subscribe to the same Pub/Sub event using the same topic.  You just have to have called `EntityFetcher.subscribe` once to initiate the fetching of the Web3 event and subsequent publishing to the given Pub/Sub topic.

See more about how to use Pub/Sub events [here](#subscribing).

## Comparing Enhanced Web3 with Entity Event Fetchers
Enhanced Web3 ([EventFetcherFactory](api/README/#eventfetcherfactory)) and entity ([EntityFetcherFactory](api/README/#entityfetcherfactory)) events each have relative pros and cons.  

Enhanced Web3 events give you all of the information that Web3 provides about an event.

Entity events only give you the entity, but the entity can contain any information you want, including everything from the raw information from the Web3 event.

Otherwise there is little difference between the two.   They both enjoy the enhancments provided by Arc.js.

!!! note
    If you prefer to use the unenhanced events supplied by Web3 via Truffle, you can access them via the contract handler property `contract`, which is the original [Truffle contract](http://truffleframework.com/docs/getting_started/contracts).
