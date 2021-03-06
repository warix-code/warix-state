import { fromJS, List, Map } from 'immutable';
import { isArray, isNil, isObject } from 'lodash';
import { BehaviorSubject, defer, merge, Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, scan, startWith, take } from 'rxjs/operators';
import { WarixStateProxy } from './include';
import { IKeyed, IWarixAsyncReducerHandler, IWarixReducerHandler, IWarixSelectSettings, IWarixStateAction, IWarixStatePostAction, IWarixStateReducerEntry, WarixStateActionReducer, WarixStateDataReducer, IWarixStateMinimal } from './interfaces';
import { WarixStateActionType } from './warix.state-action-type';
import { WarixStateActions } from './warix.state-actions';
import { ensureArray, isReducerResult, resolvePath } from './warix.state-utils';

interface IWarixAsyncProcessor {
    forType: string;
    paused: boolean;
    handler(state: Map<string, any>, action: IWarixStateAction): Observable<any>;
}

function onSubscribe<T>(action: () => void): (source: Observable<T>) =>  Observable<T> {
    return function inner(source: Observable<T>): Observable<T> {
        return defer(() => {
          action();
          return source;
        });
    };
}

export const GLOBAL_SYMBOL = Symbol('WARIX::STATE');

export class WarixState implements IWarixStateMinimal {
    private readonly dispatcher$: Subject<IWarixStateAction>;
    private readonly postAction$: Subject<IWarixStatePostAction>;
    private readonly state$: BehaviorSubject<Map<string, any>>;
    private readonly preProcessors: IWarixStateReducerEntry<IWarixStateAction>[] = [];
    private readonly processors: IWarixStateReducerEntry<Map<string, any>>[] = [];
    private readonly asyncProcessors: IWarixAsyncProcessor[] = [];

    /**
     * Observable to the underlying Map
     */
    public get source$() {
        return this.state$.asObservable();
    }

    /**
     * Observable to the dispatched actions
     */
    public get actions$() {
        return this.dispatcher$.asObservable();
    }

    /**
     * Observable to the executed actions
     */
    public get postActions$() {
        return this.postAction$.asObservable();
    }

    constructor(initialState?: IKeyed | Map<string, any>) {
        this.validateSingleInstance();
        this.dispatcher$ = new Subject<IWarixStateAction>();
        this.state$ = new BehaviorSubject<Map<string, any>>(undefined);
        this.postAction$ = new Subject<IWarixStatePostAction>();
        this.initScanner(
            initialState ? (Map.isMap(initialState) ? initialState : fromJS(initialState)) :
            fromJS({})
        );
        window[GLOBAL_SYMBOL] = this;
    }

    private validateSingleInstance() {
        if (!isNil(window) && window[GLOBAL_SYMBOL]) {
            throw new Error(`An Warix state has already been defined, only a single instance can be defined per execution`);
        }
    }

    private coerceValueTypeToImmutable(value: any) {
        if (!Map.isMap(value) && !List.isList(value) && (isObject(value) || isArray(value))) {
            return fromJS(value);
        }
        return value;
    }

    private getList(state: Map<string, any>, path: string[]) {
        const list = state.getIn(path);
        if (isNil(list)) {
            return List();
        } else {
            if (!List.isList(list)) {
                throw new Error(`List operations can only be performed in list types. Expected List<any> but found ${ typeof(list) }::${ list }`);
            }
            return list as List<any>;
        }
    }

    private reduceAction(state: Map<string, any>, action: IWarixStateAction) {
        let result = action;
        for (const r of this.preProcessors) {
            if (r.paused === false && (r.forType === result.type || r.forType === '*')) {
                const current = r.reducer(state, result);
                if (isReducerResult<IWarixStateAction>(current)) {
                    result = current.value;
                    if (current.stopPropagation) {
                        return result;
                    }
                } else {
                    result = current;
                }
            }
        }
        return result;
    }

    private reduceData(state: Map<string, any>, action: IWarixStateAction) {
        let result = state;
        for (const r of this.processors) {
            if (r.paused === false && (r.forType === action.type || r.forType === '*')) {
                const current = r.reducer(result, action);
                if (isReducerResult<Map<string, any>>(current)) {
                    result = current.value;
                    if (current.stopPropagation) {
                        return result;
                    }
                } else {
                    result = current;
                }
            }
        }
        return result;
    }

    private findAsyncProcessor(type: string) {
        return this.asyncProcessors.find(x => x.forType === type);
    }

    private handleAsyncProcessing(processor: IWarixAsyncProcessor, currentState: Map<string, any>, action: IWarixStateAction) {
        if (processor.paused) {
            return;
        }
        processor.handler(currentState, action).pipe(
            take(1),
            onSubscribe(() => this.dispatch(`${action.type}::START`, action.payload))
        ).subscribe(
            next => this.dispatch(`${ action.type }::NEXT`, next),
            error => this.dispatch(`${ action.type }::ERROR`, error),
            () => this.dispatch(`${ action.type }::COMPLETE`, null)
        );
    }

    private initScanner(intialState: Map<string, any>) {
        const fnDispatchPost = (post: IWarixStatePostAction) => {
            setTimeout(() => {
                this.postAction$.next(post);
            }, 1);
        };
        merge(new Subject().pipe(startWith(intialState)), this.dispatcher$)
            .pipe(
                scan((accumulator: Map<string, any>, action: IWarixStateAction) => {
                    const asyncProcessor = this.findAsyncProcessor(action.type);
                    if (!isNil(asyncProcessor)) {
                        this.handleAsyncProcessing(asyncProcessor, accumulator, action);
                        fnDispatchPost({ executedAction: null, finalState: accumulator, initialAction: action, initialState: accumulator });
                        return accumulator;
                    }
                    const nextAction = this.reduceAction(accumulator, action);
                    const nextState = this.reduceData(accumulator, nextAction);
                    fnDispatchPost({ executedAction: nextAction, finalState: nextState, initialAction: action, initialState: accumulator });
                    return nextState;
                })
            ).subscribe(x => this.state$.next(x));
        return this.initDefaultHandlers();
    }

    private initDefaultHandlers() {
        this.registerProcessor(WarixStateActionType.SET, (s, a) => a.payload.value);

        this.registerProcessor(WarixStateActionType.SET_IN, (s, a) => {
            return s.setIn(resolvePath(ensureArray(a.payload.path)), a.payload.value);
        });

        this.registerProcessor(WarixStateActionType.PATCH, (s, a) => {
            return s.mergeDeepIn(resolvePath(ensureArray(a.payload.path)), a.payload.value);
        });

        this.registerProcessor(WarixStateActionType.APPLY, (s, a) => {
            const path = resolvePath(ensureArray(a.payload.path));
            const current = s.getIn(path);
            return s.setIn(path, a.payload.operation(current));
        });

        this.registerProcessor(WarixStateActionType.DELETE, (s, a) => {
            const path = resolvePath(ensureArray(a.payload.path));
            const current = s.getIn(path) as Map<string, any>;
            return s.setIn(path, current.delete(a.payload.key));
        });

        this.registerProcessor(WarixStateActionType.LIST_FILTER, (s, a) => {
            const path = resolvePath(ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.filter(a.payload.filterFn));
        });

        this.registerProcessor(WarixStateActionType.LIST_POP, (s, a) => {
            const path = resolvePath(ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.pop());
        });

        this.registerProcessor(WarixStateActionType.LIST_PUSH, (s, a) => {
            const path = resolvePath(ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.push(...a.payload.items));
        });

        this.registerProcessor(WarixStateActionType.LIST_SHIFT, (s, a) => {
            const path = resolvePath(ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.shift());
        });

        this.registerProcessor(WarixStateActionType.LIST_SPLICE, (s, a) => {
            const path = resolvePath(ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.splice(a.payload.index, a.payload.deleteCount, ...a.payload.items));
        });

        this.registerProcessor(WarixStateActionType.LIST_UNSHIFT, (s, a) => {
            const path = resolvePath(ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.unshift(...a.payload.items));
        });

        this.registerProcessor(WarixStateActionType.LIST_SORT, (s, a) => {
            const path = resolvePath(ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.sort(a.payload.compareFn));
        });

        return this;
    }

    /**
     * Completes the underlying state observable and closes any subscriptions to it
     */
    public complete() {
        this.postAction$.complete();
        this.dispatcher$.complete();
        this.state$.complete();
    }

    /**
     * Registers a pre processor that may transform the dispatched action
     * @param forType Type of actions
     * @param reducer Function that may transform the dispatched action
     */
    public registerPreProcessor(forType: string, reducer: WarixStateActionReducer): IWarixReducerHandler {
        const entry: IWarixStateReducerEntry<IWarixStateAction> = { forType, reducer, paused: false };
        const handler = Object.defineProperties(Object.create(null), {
            isPaused: {
                get: () => entry.paused,
                enumerable: true,
                configurable: false
            }
        });

        handler.pause = () => {
            entry.paused = true;
            return handler;
        };
        handler.resume = () => {
            entry.paused = false;
            return handler;
        };
        handler.remove = () => {
            const index = this.preProcessors.indexOf(entry);
            if (index > -1) {
                this.preProcessors.splice(index, 1);
            }
        };
        this.preProcessors.unshift(entry);
        return handler;
    }

    /**
     * Registers a global pre processor that may transform all dispatched actions
     * @param reducer Function that may transform the dispatched action
     */
    public registerGlobalPreProcessor(reducer: WarixStateActionReducer): IWarixReducerHandler {
        return this.registerPreProcessor('*', reducer);
    }

    /**
     * Registers a processor that modifys the underlying state for the provided action type
     * @param forType Type of action
     * @param reducer Function that modifies the underlysing state based on the action provided
     */
    public registerProcessor(forType: string, reducer: WarixStateDataReducer): IWarixReducerHandler {
        const entry: IWarixStateReducerEntry<Map<string, any>> = { forType, reducer, paused: false };
        const handler = Object.defineProperties(Object.create(null), {
            isPaused: {
                get: () => entry.paused,
                enumerable: true,
                configurable: false
            }
        });

        handler.pause = () => {
            entry.paused = true;
            return handler;
        };
        handler.resume = () => {
            entry.paused = false;
            return handler;
        };
        handler.remove = () => {
            const index = this.processors.indexOf(entry);
            if (index > -1) {
                this.processors.splice(index, 1);
            }
        };
        this.processors.unshift(entry);
        return handler;
    }

    /**
     * Registers a global processor that modifys the underlying state for all actions
     * @param forType Type of action
     * @param reducer Function that modifies the underlying state based on the action provided
     */
    public registerGlobalProcessor(reducer: WarixStateDataReducer): IWarixReducerHandler {
        return this.registerProcessor('*', reducer);
    }

    /**
     * Registers an async processor that provides an observable as a source for an asynchronus action.
     * The type name is used in conjuction of the modifiers ::START, ::NEXT, ::ERROR, ::COMPLETE whenever the observable
     * reaches any of its states as a dispatch action.
     * @param forType Type of action
     * @param handler Function that provides an observable that will be used for the async flow of the operation
     */
    public registerAsync<T = any>(forType: string, handler: (state: Map<string, any>, action: IWarixStateAction) => Observable<T>): IWarixAsyncReducerHandler<T> {
        const current = this.findAsyncProcessor(forType);
        const internalHandlers: IWarixReducerHandler[] = [];
        if (!isNil) {
            throw Error(`A registration for an async processor witht the name ${ forType } has already been defined`);
        }
        const entry = { forType, handler, paused: false };

        const asyncHandler = Object.defineProperties(Object.create(null), {
            isPaused: {
                get: () => entry.paused,
                enumerable: true,
                configurable: false
            }
        });

        asyncHandler.pause = () => {
            entry.paused = true;
            return handler;
        };
        asyncHandler.resume = () => {
            entry.paused = false;
            return handler;
        };
        asyncHandler.remove = () => {
            const index = this.asyncProcessors.indexOf(entry);
            if (index > -1) {
                this.asyncProcessors.splice(index, 1);
                internalHandlers.forEach(h => h.remove());
            }
        };
        asyncHandler.onNext = (callback: (value: any) => IWarixStateAction) => {
            this.registerPreProcessor(`${ forType }::NEXT`, (s, a) => callback(a.payload));
            return asyncHandler;
        };
        asyncHandler.onError = (callback: (value: any) => IWarixStateAction) => {
            this.registerPreProcessor(`${ forType }::ERROR`, (s, a) => callback(a.payload));
            return asyncHandler;
        };
        asyncHandler.onComplete = (callback: () => IWarixStateAction) => {
            this.registerPreProcessor(`${ forType }::COMPLETE`, (s, a) => callback());
            return asyncHandler;
        };
        asyncHandler.onStart = (callback: () => IWarixStateAction) => {
            this.registerPreProcessor(`${ forType }::START`, (s, a) => callback());
            return asyncHandler;
        };
        asyncHandler.trigger = (caller: Observable<any>) => {
            return caller.subscribe(x => {
                this.dispatch(forType, x);
            });
        };
        this.asyncProcessors.push(entry);
        return asyncHandler;
    }

    /**
     * Dispatches a new action to the pre-processors and processors in order to modify the state
     * @param action Type of action
     * @param payload Payload of the action
     */
    public dispatch(action: string, payload: any): this;
    /**
     * Dispatches a new action to the pre-processors and processors in order to modify the state
     * @param action Action
     */
    public dispatch(action: IWarixStateAction): this;
    public dispatch() {
        if (arguments.length === 2) {
            this.dispatcher$.next({ type: arguments[0], payload: arguments[1] });
        } else {
            this.dispatcher$.next(arguments[0]);
        }
        return this;
    }

    /**
     * Obtains the underlying value of the state
     */
    public peek() {
        return this.state$.value;
    }

    /**
     * Obtains the underlying value of a key in the state
     * @param key Absolute path to the key in the state
     */
    public peekKey<T = any>(key: string | string[]) {
        return this.state$.value.getIn(resolvePath(ensureArray(key))) as T;
    }

    /**
     * Obtains an observable to the underlying value of a key in the state that will dispatch whenever the value changes
     * @param key Absolute path to the key in the state
     */
    public select<T = any, M = T>(path: string | string[], settings?: Partial<IWarixSelectSettings<T, M>>) {
        let currentSelect = this.source$.pipe(map(x => x.getIn(resolvePath(ensureArray(path)))), distinctUntilChanged());
        if (settings) {
            if (!isNil(settings.debounceTime) && settings.debounceTime > 0) {
                currentSelect = currentSelect.pipe(debounceTime(settings.debounceTime));
            }
            if (!isNil(settings.preFilter)) {
                currentSelect = currentSelect.pipe(filter(settings.preFilter));
            }
            if (!isNil(settings.map)) {
                currentSelect = currentSelect.pipe(map(mx => settings.map(mx, this)));
            }
            if (!isNil(settings.postFilter)) {
                currentSelect = currentSelect.pipe(filter(settings.postFilter));
            }
        }
        return currentSelect as Observable<M>;
    }

    /**
     * Obtains an observable to the underlying value of a key in the state that will dispatch whenever the value changes.
     * If the value is a Map or a List, the value is flattened with its toJS method.
     * Flattening a immutable object can be an expensive operation, use with caution.
     * @param path Absolute path to the key in the state
     */
    public selectFlatten<T = any, M = T>(path: string | string[], settings?: Partial<IWarixSelectSettings<T, M>>) {
        let currentSelect = this.source$.pipe(
            map(x => x.getIn(resolvePath(ensureArray(path)))),
            map(x => Map.isMap(x) ? x.toJS() : List.isList(x) ? x.toJS() : x),
            distinctUntilChanged()
        );
        if (settings) {
            if (!isNil(settings.debounceTime) && settings.debounceTime > 0) {
                currentSelect = currentSelect.pipe(debounceTime(settings.debounceTime));
            }
            if (!isNil(settings.preFilter)) {
                currentSelect = currentSelect.pipe(filter(settings.preFilter));
            }
            if (!isNil(settings.map)) {
                currentSelect = currentSelect.pipe(map(mx => settings.map(mx, this)));
            }
            if (!isNil(settings.postFilter)) {
                currentSelect = currentSelect.pipe(filter(settings.postFilter));
            }
        }
        return currentSelect as Observable<M>;
    }

    /**
     * Obtains an observable that will emit whenever the specifed action type is dispatched in the state
     * @param actionType Action type
     */
    public on(actionType: string) {
        return this.actions$.pipe(filter(x => x.type === actionType || actionType === '*'));
    }

    /**
     * Dispatches a SET action that modifies the underlying state to the provided value
     * @param value New state value
     */
    public set(value: Map<string, any>) {
        this.dispatcher$.next(WarixStateActions.set(value));
        return this;
    }

    /**
     * Dispatches a SET-IN action that modifies a key in the underlying state
     * @param path Absolute path to the key in the state
     * @param value New value to assign
     */
    public setIn(path: string | string[], value: any) {
        this.dispatcher$.next(WarixStateActions.setIn(path, value));
        return this;
    }

    /**
     * Dispatches a PATCH action that merges current value of a key in the underlying state witht the provided value
     * @param path Absolute path to the key in the state
     * @param value Partial value to merge witht the current value
     */
    public patch(path: string | string[], value: any) {
        this.dispatcher$.next(WarixStateActions.patch(path, value));
        return this;
    }

    /**
     * Dispatches an APPLY action that modifies a key in the underlying state with the result of the provided operation
     * @param path Absolute path to the key in the state
     * @param operation Function that provides the current key value and expects the new key value as a result
     */
    public apply(path: string | string[], operation: (value: any) => any) {
        this.dispatcher$.next(WarixStateActions.apply(path, operation));
        return this;
    }

    /**
     * Dispatches a DELETE action that deletes a key in the underlying state
     * @param path Absolute path to the key in the state
     * @param key Key name
     */
    public delete(path: string | string[], key: string) {
        this.dispatcher$.next(WarixStateActions.delete(path, key));
        return this;
    }

    /**
     * Dispatches a LIST-PUSH action that performs a push operation in the List at the provided path
     * @param path Absolute path to the key in the state
     * @param items Items to add at the end of the list
     */
    public listPush(path: string | string[], items: any[]) {
        this.dispatcher$.next(WarixStateActions.listPush(path, items));
        return this;
    }

    /**
     * Dispatches a LIST-POP action that performs a pop operation in the List at the provided path
     * @param path Absolute path to the key in the state
     */
    public listPop(path: string | string[]) {
        this.dispatcher$.next(WarixStateActions.listPop(path));
        return this;
    }

    /**
     * Dispatches a LIST-SHIFT action that performs a shift operation in the List at the provided path
     * @param path Absolute path to the key in the state
     */
    public listShift(path: string | string[]) {
        this.dispatcher$.next(WarixStateActions.listShift(path));
        return this;
    }

    /**
     * Dispatches a LIST-UNSHIFT action that performs an unshift operation in the List at the provided path
     * @param path Absolute path to the key in the state
     * @param items Items to add at the start of the list
     */
    public listUnshift(path: string | string[], items: any[]) {
        this.dispatcher$.next(WarixStateActions.listUnshift(path, items));
        return this;
    }

    /**
     * Dispatches a LIST-SPLICE action that performs a splice operation in the List at the provided path
     * @param path Absolute path to the key in the state
     * @param index Index to start the operation from
     * @param deleteCount Number of elements to delete
     * @param items Number of items to add at the provided index
     */
    public listSplice(path: string | string[], index: number, deleteCount = 0, items: any[] = []) {
        this.dispatcher$.next(WarixStateActions.listSplice(path, index, deleteCount, items));
        return this;
    }

    /**
     * Dispatches a LIST-SPLICE action that that is homologue to a splice operation with a deleteCount of 0
     * @param path Absolute path to the key in the state
     * @param index Index to start the operation from
     * @param items Number of items to add at the provided index
     */
    public listInsert(path: string | string[], index: number, items: any[]) {
        return this.listSplice(path, index, 0, items);
    }

    /**
     * Dispatches a LIST-SPLICE action that that is homologue to a splice operation without inserting items
     * @param path Absolute path to the key in the state
     * @param index Index to start the operation from
     * @param deleteCount Number of elements to delete
     */
    public listRemoveAt(path: string | string[], index: number, deleteCount = 1) {
        return this.listSplice(path, index, deleteCount);
    }

    /**
     * Dispatches a LIST-SPLICE action that that is homologue to a splice operation without inserting items at the index that matches the provided predicate
     * @param path Absolute path to the key in the state
     * @param predicate Function that determines if an item in the list is the element to be deleted
     */
    public listRemoveFind<T = any>(path: string | string[], predicate: (item: T, index: number, list: List<T>) => boolean, deleteCount = 1) {
        const list = this.getList(this.peek(), ensureArray(path)) as List<T>;
        const index = list.findIndex(predicate);
        if (index > -1) {
            return this.listRemoveAt(path, index, deleteCount);
        }
        return this;
    }

    /**
     * Dispatches a LIST-SORT action that sorts a list at the specified path
     * @param path Absolute path to the key in the state
     * @param compareFn Optional. Comparisson function
     */
    public listSort<T = any>(path: string | string[], compareFn?: (a: T, b: T) => number) {
        this.dispatcher$.next(WarixStateActions.listSort(path, compareFn));
        return this;
    }

    /**
     * Dispatches a LIST-FILTER action that keeps only the items in the list where the filterFn evaluates to true
     * @param path Absolute path to the key in the state
     * @param filterFn Function that determines if the items should remain in the List
     */
    public listFilter<T = any>(path: string | string[], filterFn: (item: T, index: number, list: List<T>) => boolean) {
        this.dispatcher$.next(WarixStateActions.listFilter(path, filterFn));
        return this;
    }

    /**
     * Creates a proxy that is relative to the provided state
     * @see WarixStateProxy
     * @param path Absolute path to the key in the state
     */
    public subHandler(path: string | string[]) {
        return new WarixStateProxy(this, ensureArray(path));
    }
}
