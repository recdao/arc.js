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
   * Note that the callback parameter of `EventFetcher.get` is optional; you
   * may alternatively obtain the promise of a `Array<TEventArgs>` from the return value
   * of `get`.
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
   * @param baseArgFilter arg filter to always merge into any supplied argFilter.
   */
  public createEventFetcherFactory<TEventArgs>(
    eventName: string,
    contractWrapper: HasContract,
    preProcessEvent?: PreProcessEventCallback<TEventArgs>,
    baseArgFilter: any = {}
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
        contractWrapper.contract[eventName](
          Object.assign(argFilter, baseArgFilter), filterObject, baseEventCallback);

      /**
       * return the fetcher
       */
      return {

        get(callback?: EventCallback<TEventArgs>): Promise<Array<TEventArgs>> {
          return new Promise<Array<TEventArgs>>(
            (resolve: (result: Array<TEventArgs>) => void, reject: (error: Error) => void): void => {
              baseEvent.get(
                (error: Error, log: DecodedLogEntryEvent<TEventArgs> | Array<DecodedLogEntryEvent<TEventArgs>>): void => {
                  if (error) {
                    return reject(error);
                  }
                  resolve(handleEvent(error, log, callback));
                });
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
   * Note that the callback parameter of `EntityFetcher.get` is optional; you
   * may alternatively obtain the promise of a `Array<TEntity>` from the return value
   * of `get`.
   * @param eventFetcherFactory
   * @param transformEventCallback Function to convert an instance of TEventArgs into
   * the promise of an instance of TEntity.  If it returns `undefined` then no entity
   * is returned for that event, so this is a programatic way in which events
   * can be filtered.
   * @param givenCallback Function that will be invoked upon the receipt of each event,
   * @param baseArgFilter arg filter to always merge into any supplied argFilter.
   */
  public createEntityFetcherFactory<TEntity, TEventArgs>(
    eventFetcherFactory: EventFetcherFactory<TEventArgs>,
    transformEventCallback: TransformEventCallback<TEntity, TEventArgs>,
    baseArgFilter: any = {}
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
        (error: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>, callback?: EntityCallback<TEntity>):
          Promise<Array<TEntity>> => {

          const promiseOfEntities: Promise<Array<TEntity>> =
            new Promise(
              async (resolve: (result: Array<TEntity>) => void, reject: (error: Error) => void): Promise<void> => {

                if (error) {
                  return reject(error);
                }
                const entities = new Array<TEntity>();
                // transform all the log entries into entities
                for (const event of log) {
                  const transformedEntity = await transformEventCallback(event.args);
                  if (typeof transformedEntity !== "undefined") {
                    entities.push(transformedEntity);
                  }
                }
                resolve(entities);
              });
          // invoke the given callback with the promise of an array of entities
          if (callback) {
            callback(error, promiseOfEntities);
          }
          return promiseOfEntities;
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
      const baseFetcher: EventFetcher<TEventArgs> = eventFetcherFactory(
        Object.assign(argFilter, baseArgFilter), filterObject, baseEventCallback);

      /**
       * return the fetcher
       */
      return {

        transformEventCallback,

        get(callback?: EntityCallback<TEntity>): Promise<Array<TEntity>> {
          return new Promise<Array<TEntity>>(
            (resolve: (result: Array<TEntity>) => void, reject: (error: Error) => void): void => {
              baseFetcher.get(async (error: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>): Promise<void> => {
                if (error) {
                  return reject(error);
                }
                resolve(await handleEvent(error, log, callback));
              });
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
   * Convert the EntityFetcherFactory<TEntitySrc, TEntityOriginalSrc> into an
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

    /**
     * replace the existing transformEventCallback with the new one that will invoke the old one
     */
    (fetcher.transformEventCallback as any) = async (entity: TEntityOriginalSrc): Promise<TEntityDest | undefined> => {
      const transformedEntity =
        await (fetcher.transformEventCallback(entity as TEntityOriginalSrc) as Promise<TEntitySrc | undefined>);
      if (typeof transformedEntity !== "undefined") {
        return transformEventCallback(transformedEntity) as Promise<TEntityDest | undefined>;
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
      callback?: EventCallback<TEventArgs>): Array<TEventArgs> => {

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
      // invoke callback if there is one
      if (callback) {
        callback(error, log);
      }
      // return array of args in any case
      return log.map((l: DecodedLogEntryEvent<TEventArgs>) => l.args);
    };
  }
}

type InternalEventCallback<TEventArgs> =
  (
    error: Error, log: DecodedLogEntryEvent<TEventArgs> | Array<DecodedLogEntryEvent<TEventArgs>>,
    callback: EventCallback<TEventArgs>
  ) => Array<TEventArgs>;

export type EventCallback<TEventArgs> = (error: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>) => void;
export interface EventPreProcessorReturn<TEventArgs> { error: Error; log: Array<DecodedLogEntryEvent<TEventArgs>>; }
export type PreProcessEventCallback<TEventArgs> =
  (error: Error, log: Array<DecodedLogEntryEvent<TEventArgs>>) => EventPreProcessorReturn<TEventArgs>;

export type TransformEventCallback<TDest, TSrc> = (args: TSrc) => Promise<TDest | undefined>;

/**
 * Function that returns an `EntityFetcher<TEntity>`.
 *
 * @type TEntity The type returns to the callback.
 */
export type EntityFetcherFactory<TDest, TSrc> =
  (
    /**
     * Arg values by which you wish to filter the web3 event logs, e.g.
     * `{'valueA': 1, 'valueB': [myFirstAddress, mySecondAddress]}`.
     *
     * Note this always applies to the underlying web3 event values
     * not to property values of transformed entities.
     */
    argsFilter?: any,
    /**
     * Web3 event filter options.  Typically something like `{ from: "latest" }`.
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

/**
 * Returned by EntityFetcherFactory<TDest, TSrc>.
 */
export interface EntityFetcher<TDest, TSrc> {
  transformEventCallback: TransformEventCallback<TDest, TSrc>;
  /**
   * Note that `callback` is optional -- you may alternatively obtain the promise
   * of a `Array<TEntity>` from the return value of `get`.
   */
  get: (callback?: EntityCallback<TDest>) => Promise<Array<TDest>>;
  watch: (callback: EntityCallback<TDest>) => void;
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
  /**
   * Note that `callback` is optional -- you may alternatively obtain the promise
   * of a `Array<TEventArgs>` from the return value of `get`.
   */
  get: (callback?: EventCallback<TEventArgs>) => Promise<Array<TEventArgs>>;
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
