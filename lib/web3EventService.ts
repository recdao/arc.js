import { DecodedLogEntryEvent, LogTopic } from "web3";
import { HasContract, Hash } from "./commonTypes";

export class Web3EventService {
  /**
   * Returns a function that creates an EventFetcher<TArgs>.
   * For subclasses to use to create their event handlers.
   * This is identical to what you get with Truffle, except that
   * the result param of the callback is always guaranteed to be an array,
   * and duplicate events are removed.
   *
   * Example:
   *
   *    public NewProposal = Web3EventService.createEventFetcherFactory<NewProposalEventResult>("NewProposal");
   *    const event = NewProposal({}, { fromBlock: 0 });
   *    event.get(...).
   *
   * @type TArgs - name of the event args (EventResult) interface, like NewProposalEventResult
   * @param eventName - Name of the event like "NewProposal"
   * @param preProcessEvent - optionally supply this to modify the err and log arguments before they are
   * passed to the `get` an `watch` callbacks.
   */
  public static createEventFetcherFactory<TArgs>(
    eventName: string,
    contractWrapper: HasContract,
    preProcessEvent?: PreProcessEventCallback<TArgs>
  ): EventFetcherFactory<TArgs> {

    /**
     * This is the function that returns the EventFetcher<TArgs>
     * @param argFilter Optional event argument filter, like `{ _proposalId: [someHash] }`.
     * @param filterObject Optional event filter.  Default is `{ fromBlock: "latest" }`
     * @param callback
     */
    const eventFetcherFactory: EventFetcherFactory<TArgs> = (
      argFilter: any,
      filterObject: EventFetcherFilterObject,
      givenCallback?: EventCallback<TArgs>
    ): EventFetcher<TArgs> => {

      let baseEvent: EventFetcher<TArgs>;
      let receivedEvents: Set<Hash>;

      if (!!filterObject.suppressDups) {
        receivedEvents = new Set<Hash>();
      }

      const handleEvent = (
        error: Error,
        log: DecodedLogEntryEvent<TArgs> | Array<DecodedLogEntryEvent<TArgs>>,
        callback?: EventCallback<TArgs>): void => {

        /**
         * always provide an array
         */
        if (!!error) {
          log = [];
        } else if (!Array.isArray(log)) {
          log = [log];
        }

        /**
         * optionally prune duplicate events (see https://github.com/ethereum/web3.js/issues/398)
         */
        if (receivedEvents && log.length) {
          log = log.filter((evt: DecodedLogEntryEvent<TArgs>) => {
            if (!receivedEvents.has(evt.transactionHash)) {
              receivedEvents.add(evt.transactionHash);
              return true;
            } else {
              return false;
            }
          });
        }

        if (preProcessEvent) {
          const processedResult = preProcessEvent(error, log);
          error = processedResult.error;
          log = processedResult.log;
        }
        callback(error, log);
      };

      const eventFetcher: EventFetcher<TArgs> = {

        get(callback?: EventCallback<TArgs>): void {
          baseEvent.get((error: any, log: DecodedLogEntryEvent<TArgs> | Array<DecodedLogEntryEvent<TArgs>>) => {
            handleEvent(error, log, callback);
          });
        },

        watch(callback?: EventCallback<TArgs>): void {
          baseEvent.watch((error: any, log: DecodedLogEntryEvent<TArgs> | Array<DecodedLogEntryEvent<TArgs>>) => {
            handleEvent(error, log, callback);
          });
        },

        stopWatching(): void {
          baseEvent.stopWatching();
        },
      };
      /**
       * if callback is defined then start watching immediately using baseWrapperCallback.
       * Otherwise caller must use `get` and `watch` and baseWrapperCallback will be undefined as well
       */
      let baseEventCallback: EventCallback<TArgs>;

      if (givenCallback) {
        baseEventCallback =
          (error: any, log: DecodedLogEntryEvent<TArgs> | Array<DecodedLogEntryEvent<TArgs>>): void => {
            handleEvent(error, log, givenCallback);
          };
      }

      baseEvent = contractWrapper.contract[eventName](argFilter, filterObject, baseEventCallback);

      return eventFetcher;
    };

    return eventFetcherFactory;
  }
}

export type EventCallback<TArgs> = (error: Error, log: Array<DecodedLogEntryEvent<TArgs>>) => void;
export interface EventPreProcessorReturn<TArgs> { error: Error; log: Array<DecodedLogEntryEvent<TArgs>>; }
export type PreProcessEventCallback<TArgs> =
  (error: Error, log: Array<DecodedLogEntryEvent<TArgs>>) => EventPreProcessorReturn<TArgs>;

/**
 * The generic type of every handler function that returns an event.  See this
 * web3 documentation article for more information:
 * https://github.com/ethereum/wiki/wiki/JavaScript-API#contract-events
 *
 * argsFilter - contains the return values by which you want to filter the logs, e.g.
 * {'valueA': 1, 'valueB': [myFirstAddress, mySecondAddress]}
 * By default all filter  values are set to null which means that they will match
 * any event of given type sent from this contract.  Default is {}.
 *
 * filterObject - Additional filter options.  Typically something like { from: "latest" }.
 * Note if you don't want Arc.js to suppress duplicate events, set `suppressDups` to false.
 *
 * callback - (optional) If you pass a callback it will immediately
 * start watching.  Otherwise you will need to call .get or .watch.
 */
export type EventFetcherFactory<TArgs> =
  (
    argFilter: any,
    filterObject: EventFetcherFilterObject,
    callback?: EventCallback<TArgs>
  ) => EventFetcher<TArgs>;

export type EventFetcherHandler<TArgs> = (callback: EventCallback<TArgs>) => void;

/**
 * returned by EventFetcherFactory<TArgs> which is created by eventWrapperFactory.
 */
export interface EventFetcher<TArgs> {
  get: EventFetcherHandler<TArgs>;
  watch: EventFetcherHandler<TArgs>;
  stopWatching(): void;
}

/**
 * Haven't figured out how to export EventFetcherFilterObject that extends FilterObject from web3.
 * Maybe will be easier with web3 v1.0, perhaps using typescript's module augmentation feature.
 */

/**
 * Options supplied to `EventFetcherFactory` and thence to `get and `watch`.
 */
export interface EventFetcherFilterObject {
  fromBlock?: number | string;
  toBlock?: number | string;
  address?: string;
  topics?: Array<LogTopic>;
  /**
   * true to suppress duplicate events (see https://github.com/ethereum/web3.js/issues/398).
   * The default is true.
   */
  suppressDups?: boolean;
}
