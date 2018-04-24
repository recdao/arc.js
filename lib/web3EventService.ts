import { DecodedLogEntryEvent, LogTopic } from "web3";
import { HasContract, Hash } from "./commonTypes";

export class Web3EventService {
  /**
   * Returns a function that creates an EventFetcher<TArgs>.
   * For subclasses to use to create their event handlers.
   * This is identical to what you get with Truffle, except that
   * the result param of the callback is always guaranteed to be an array.
   *
   * Example:
   *
   *    public NewProposal = this.eventWrapperFactory<NewProposalEventResult>("NewProposal");
   *    const event = NewProposal(...);
   *    event.get(...).
   *
   * @type TArgs - name of the event args (EventResult) interface, like NewProposalEventResult
   * @param eventName - Name of the event like "NewProposal"
   */
  public static createEventFetcherFactory<TArgs>(
    eventName: string,
    contractWrapper: HasContract): EventFetcherFactory<TArgs> {

    /**
     * This is the function that returns the EventFetcher<TArgs>
     * @param argFilter
     * @param filterObject
     * @param callback
     */
    const eventFetcherFactory: EventFetcherFactory<TArgs> = (
      argFilter: any,
      filterObject: EventFetcherFilterObject,
      rootCallback?: EventCallback<TArgs>
    ): EventFetcher<TArgs> => {

      let baseEvent: EventFetcher<TArgs>;
      let receivedEvents: Set<Hash>;

      if (!!filterObject.suppressDups) {
        receivedEvents = new Set<Hash>();
      }

      const handleEvent = (
        error: any,
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
       * if callback is set then this will start watching immediately,
       * otherwise caller must use `get` and `watch`
       */
      const wrapperRootCallback: EventCallback<TArgs> | undefined = rootCallback ?
        (error: any, log: DecodedLogEntryEvent<TArgs> | Array<DecodedLogEntryEvent<TArgs>>): void => {
          if (!!error) {
            log = [];
          } else if (!Array.isArray(log)) {
            log = [log];
          }
          rootCallback(error, log);
        } : undefined;

      baseEvent = contractWrapper.contract[eventName](argFilter, filterObject, wrapperRootCallback);

      return eventFetcher;
    };

    return eventFetcherFactory;
  }
}

export type EventCallback<TArgs> =
  (
    err: Error,
    log: Array<DecodedLogEntryEvent<TArgs>>
  ) => void;

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

export type EventFetcherHandler<TArgs> =
  (
    callback: EventCallback<TArgs>
  ) => void;

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
  /**
   * filter on args properties
   */
  [x: string]: any;
}
