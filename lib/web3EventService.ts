import { DecodedLogEntryEvent, LogTopic } from "web3";
import { HasContract, Hash } from "./commonTypes";

export class Web3EventService {
  /**
   * Returns a function that creates an EventFetcher<TEventArgs>.
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
   * @type TEventArgs - name of the event args (EventResult) interface, like NewProposalEventResult
   * @param eventName - Name of the event like "NewProposal"
   * @param preProcessEvent - optionally supply this to modify the err and log arguments before they are
   * passed to the `get`/`watch` callback.
   */
  public createEventFetcherFactory<TEventArgs>(
    eventName: string,
    contractWrapper: HasContract,
    preProcessEvent?: PreProcessEventCallback<TEventArgs>
  ): EventFetcherFactory<TEventArgs> {

    if (!eventName) {
      throw new Error("eventName was not supplied");
    }
    if (!contractWrapper) {
      throw new Error("contractWrapper was not supplied");
    }
    /**
     * This is the function that returns the EventFetcher<TEventArgs>
     * argFilter - Optional event argument filter, like `{ _proposalId: [someHash] }`.
     * filterObject - Optional event filter.  Default is `{ fromBlock: "latest" }`
     * callback
     */
    return (
      argFilter: any,
      filterObject: EventFetcherFilterObject,
      givenCallback?: EventCallback<TEventArgs>
    ): EventFetcher<TEventArgs> => {

      const handleEvent = this.createEventHandler(
        filterObject.suppressDups,
        preProcessEvent);

      let baseEventCallback: EventCallback<TEventArgs>;

      if (givenCallback) {
        baseEventCallback =
          (error: Error, log: DecodedLogEntryEvent<TEventArgs> | Array<DecodedLogEntryEvent<TEventArgs>>): void => {
            handleEvent(error, log, givenCallback);
          };
      }

      /**
       * If `givenCallback` is defined then this will start watching immediately using `baseEventCallback`.
       * Otherwise `baseEventCallback` will here be undefined and caller must use `get` and `watch`.
       */
      const baseEvent: EventFetcher<TEventArgs> =
        contractWrapper.contract[eventName](argFilter, filterObject, baseEventCallback);

      /**
       * return the fetcher
       */
      return {

        get(callback?: EventCallback<TEventArgs>): void {
          baseEvent.get(
            (error: Error, log: DecodedLogEntryEvent<TEventArgs> | Array<DecodedLogEntryEvent<TEventArgs>>) => {

              handleEvent(error, log, callback);
            });
        },

        watch(callback?: EventCallback<TEventArgs>): void {
          baseEvent.watch(
            (error: Error, log: DecodedLogEntryEvent<TEventArgs> | Array<DecodedLogEntryEvent<TEventArgs>>) => {

              handleEvent(error, log, callback);
            });
        },

        stopWatching(): void {
          baseEvent.stopWatching();
        },
      };
    };
  }

  /**
   * Converts a `EventFetcherFactory<TEventArgs>` into a
   * `EntityFetcherFactory<TEntity, TEventArgs>`.  So whenever a web3 event
   * is received by the given `EventFetcherFactory`, we transform the `log` array, each of whose
   * items contains `args` of type `TEventArgs`, into `Array<TEntities>`.
   * @param eventFetcherFactory
   * @param transformEventCallback Function to convert an instance of TEventArgs into
   * the promise of an instance of TEntity.  If it returns `undefined` then no entity
   * is returned for that event, so this is a programatic way in which events
   * can be filtered.
   * @param givenCallback Function that will be invoked upon the receipt of each event,
   * accepting the promise of an array of TEntity.
   */
  public createEntityFetcherFactory<TEntity, TEventArgs>(
    eventFetcherFactory: EventFetcherFactory<TEventArgs>,
    transformEventCallback: TransformEventCallback<TEntity, TEventArgs>
  ): EntityFetcherFactory<TEntity, TEventArgs> {

    if (!eventFetcherFactory) {
      throw new Error("eventFetcherFactory was not supplied");
    }

    if (!transformEventCallback) {
      throw new Error("transformEventCallback was not supplied");
    }

    return (
      argFilter: any,
      filterObject: EventFetcherFilterObject,
      givenCallback?: EntityCallback<TEntity>
    ): EntityFetcher<TEntity, TEventArgs> => {

      // handler that takes the events and issues givenCallback appropriately
      const handleEvent =
        (error: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>, callback: EntityCallback<TEntity>): void => {

          const promiseOfEntities: Promise<Array<TEntity>> =
            new Promise(
              async (resolve: (result: Array<TEntity>) => void, reject: (error: Error) => void): Promise<void> => {

                const entities = new Array<TEntity>();
                if (!!error) {
                  // transform all the log entries into entities
                  log.forEach(async (event: DecodedLogEntryEvent<TEventArgs>): Promise<void> => {
                    const promise = transformEventCallback(event.args);
                    if (promise) {
                      entities.push(await promise);
                    }
                  });
                  resolve(entities);
                } else {
                  reject(error);
                }
              });
          // invoke the given callback with the promise of an array of entities
          callback(error, promiseOfEntities);
        };

      let baseEventCallback: EventCallback<TEventArgs>;

      if (givenCallback) {
        baseEventCallback =
          (error: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>): void => {
            handleEvent(error, log, givenCallback);
          };
      }

      /**
       * If `givenCallback` is defined then this will start watching immediately using `baseEventCallback`.
       * Otherwise `baseEventCallback` will here be undefined and caller must use `get` and `watch`.
       */
      const baseFetcher: EventFetcher<TEventArgs> = eventFetcherFactory(argFilter, filterObject, baseEventCallback);

      /**
       * return the fetcher
       */
      return {

        transformEventCallback,

        get(callback?: EntityCallback<TEntity>): void {
          baseFetcher.get((error: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>) => {
            handleEvent(error, log, callback);
          });
        },

        watch(callback?: EntityCallback<TEntity>): void {
          baseFetcher.watch((error: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>) => {
            handleEvent(error, log, callback);
          });
        },

        stopWatching(): void {
          baseFetcher.stopWatching();
        },
      };
    };
  }

  /**
   * Convert the EntityFetcherFactory<TEntitySrc, any> into an
   * EntityFetcherFactory<TEntityDest, TEntitySrc>.
   *
   * @param entityFetcherFactory
   * @param transformEventCallback
   */
  public pipeEntityFetcherFactory<TEntityDest, TEntitySrc, TEntityOriginalSrc>(
    entityFetcherFactory: EntityFetcherFactory<TEntitySrc, TEntityOriginalSrc>,
    transformEventCallback: TransformEventCallback<TEntityDest, TEntitySrc>
  ): EntityFetcherFactory<TEntityDest, TEntitySrc> {

    const fetcher = entityFetcherFactory();

    // `anys` are to satisfy the compiler
    fetcher.transformEventCallback = async (entity: any): Promise<any> => {
      const promise = fetcher.transformEventCallback(entity as TEntityOriginalSrc) as Promise<TEntitySrc> | void;
      if (promise) {
        return transformEventCallback(await promise) as Promise<TEntityDest> | void;
      }
    };

    return entityFetcherFactory as EntityFetcherFactory<any, any>;
  }

  /**
   * Returns a function that we will use internally to handle each event
   * @param suppressDups
   * @param preProcessEvent
   */
  private createEventHandler<TEventArgs>(
    suppressDups: boolean,
    preProcessEvent?: PreProcessEventCallback<TEventArgs>): InternalEventCallback<TEventArgs> {

    let receivedEvents: Set<Hash>;

    if (!!suppressDups) {
      receivedEvents = new Set<Hash>();
    }

    return (
      error: Error,
      log: DecodedLogEntryEvent<TEventArgs> | Array<DecodedLogEntryEvent<TEventArgs>>,
      callback?: EventCallback<TEventArgs>): void => {

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
        log = log.filter((evt: DecodedLogEntryEvent<TEventArgs>) => {
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
  }
}

type InternalEventCallback<TEventArgs> =
  (
    error: Error, log: DecodedLogEntryEvent<TEventArgs> | Array<DecodedLogEntryEvent<TEventArgs>>,
    callback: EventCallback<TEventArgs>
  ) => void;

export type EventCallback<TEventArgs> = (error: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>) => void;
export interface EventPreProcessorReturn<TEventArgs> { error: Error; log: Array<DecodedLogEntryEvent<TEventArgs>>; }
export type PreProcessEventCallback<TEventArgs> =
  (error: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>) => EventPreProcessorReturn<TEventArgs>;

export type TransformEventCallback<TDest, TSrc> = (args: TSrc) => Promise<TDest> | void;

/**
 * Function that returns an `EntityFetcher<TEntity>`.
 *
 * @type TEntity The type returns to the callback.
 */
export type EntityFetcherFactory<TDest, TSrc> =
  (
    /**
     * Values by which you wish to filter the logs, e.g.
     * `{'valueA': 1, 'valueB': [myFirstAddress, mySecondAddress]}`.
     *
     * Note this applies to the underlying web3 event values, not to the transformed entities.
     */
    argsFilter?: any,
    /**
     * Additional filter options.  Typically something like `{ from: "latest" }`.
     * Note if you don't want Arc.js to suppress duplicate events, set `suppressDups` to false.
     */
    filterObject?: EventFetcherFilterObject,
    /**
     * Optional callback to immediately start start watching.
     * Without this you will call `get` or `watch`.
     */
    callback?: EntityCallback<TDest>
  ) => EntityFetcher<TDest, TSrc>;

export type EntityCallback<TEntity> = (error: Error, log: Promise<Array<TEntity>>) => void;

export type EntityFetcherHandler<TEntity> = (callback: EntityCallback<TEntity>) => void;

/**
 * Returned by EntityFetcherFactory<TDest, TSrc>.
 */
export interface EntityFetcher<TDest, TSrc> {
  transformEventCallback: TransformEventCallback<TDest, TSrc>;
  get: EntityFetcherHandler<TDest>;
  watch: EntityFetcherHandler<TDest>;
  stopWatching(): void;
}

/**
 * Function that returns an `EventFetcher<TEventArgs>`.
 *
 * @type TEventArgs The type of the `args` object.
 */
export type EventFetcherFactory<TEventArgs> =
  (
    /**
     * Values by which you wish to filter the logs, e.g.
     * `{'valueA': 1, 'valueB': [myFirstAddress, mySecondAddress]}`.
     */
    argsFilter?: any,
    /**
     * Additional filter options.  Typically something like `{ from: "latest" }`.
     * Note if you don't want Arc.js to suppress duplicate events, set `suppressDups` to false.
     */
    filterObject?: EventFetcherFilterObject,
    /**
     * Optional callback to immediately start start watching.
     * Without this you will call `get` or `watch`.
     */
    callback?: EventCallback<TEventArgs>
  ) => EventFetcher<TEventArgs>;

export type EventFetcherHandler<TEventArgs> = (callback: EventCallback<TEventArgs>) => void;

/**
 * Returned by EventFetcherFactory<TEventArgs>.
 * See web3 documentation article for more information about events:
 * https://github.com/ethereum/wiki/wiki/JavaScript-API#contract-events
 *
 * @type TEventArgs The type of the `args` object.
 */
export interface EventFetcher<TEventArgs> {
  get: EventFetcherHandler<TEventArgs>;
  watch: EventFetcherHandler<TEventArgs>;
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
