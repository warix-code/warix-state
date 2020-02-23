import { Subject, Observable } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { Map, List } from 'immutable';
import { combinePaths, ensureArray } from './warix.state-utils';
import { IWarixReducerHandler, IWarixSelectSettings, IWarixStateAction, WarixStateActionReducer, WarixStateDataReducer, IWarixAsyncReducerHandler } from './interfaces';
import { WarixState } from './include';

export class WarixStateProxy {
    private instanceHandlers: IWarixReducerHandler[] = [];
    private terminator$: Subject<void>;

    /**
     * Observable to the underlying value of the key in the state at the rootPath of the proxy
     */
    public get source$() {
        return this.owner.select(this.basePath).pipe(takeUntil(this.terminator$));
    }

    /**
     * Observable to the actions dispatched that affect the state at the rootPath of the proxy
     */
    public get actions$() {
        return this.owner.actions$.pipe(
            filter(x => {
                if (x && x.payload && x.payload.path) {
                    return ensureArray(x.payload.path).join('.').startsWith(this.basePath.join('.'));
                }
                return false;
            }),
            takeUntil(this.terminator$)
        );
    }

    /**
     * Absolute path in the state for the proxy
     */
    public get rootPath() {
        return this.basePath.slice(0);
    }

    constructor(private readonly owner: WarixState, private readonly basePath: string[]) {
        this.terminator$ = new Subject<void>();
    }

    /**
     * Dispatches a new action relative to the proxy to the pre-processors and processors in order to modify the state
     * @param action Type of action
     * @param payload Payload of the action
     */
    public dispatch(action: string, payload: any): this;
    /**
     * Dispatches a new action relative to the proxy to the pre-processors and processors in order to modify the state
     * @param action Action
     */
    public dispatch(action: IWarixStateAction): this;
    public dispatch() {
        let action: IWarixStateAction;
        if (arguments.length === 2) {
            action = { type: arguments[0], payload: arguments[1] };
        } else {
            action = arguments[0];
        }

        if (action.payload) {
            action.payload.path = combinePaths(this.basePath, action.payload.path || []);
        }
        this.owner.dispatch(action);
        return this;
    }

    /**
     * Completes the underlying state observable and closes any subscriptions to it
     */
    public complete() {
        this.instanceHandlers.forEach(x => x.remove());
        this.terminator$.next();
        this.terminator$.complete();
    }

    /**
     * Registers a pre processor that may transform the dispatched action and will be removed once the proxy is completed
     * @param forType Type of actions
     * @param reducer Function that may transform the dispatched action
     */
    public registerPreProcessor(forType: string, reducer: WarixStateActionReducer): IWarixReducerHandler {
        const handler = this.owner.registerPreProcessor(forType, reducer);
        this.instanceHandlers.push(handler);
        return handler;
    }

    /**
     * Registers a global pre processor that may transform all dispatched actions and will be removed once the proxy is completed
     * @param reducer Function that may transform the dispatched action
     */
    public registerGlobalPreProcessor(reducer: WarixStateActionReducer): IWarixReducerHandler {
        return this.registerPreProcessor('*', reducer);
    }

    /**
     * Registers a processor that modifys the underlying state for the provided action type and will be removed once the proxy is completed
     * @param forType Type of action
     * @param reducer Function that modifies the underlysing state based on the action provided
     */
    public registerProcessor(forType: string, reducer: WarixStateDataReducer): IWarixReducerHandler {
        const handler = this.owner.registerProcessor(forType, reducer);
        this.instanceHandlers.push(handler);
        return handler;
    }

    /**
     * Registers a global processor that modifys the underlying state for all actions and will be removed once the proxy is completed
     * @param forType Type of action
     * @param reducer Function that modifies the underlysing state based on the action provided
     */
    public registerGlobalProcessor(reducer: WarixStateDataReducer): IWarixReducerHandler {
        return this.registerProcessor('*', reducer);
    }

    /**
     * Registers an async processor that provides an observable as a source for an asynchronus action.
     * The type name is used in conjuction of the modifiers ::START, ::NEXT, ::ERROR, ::COMPLETE whenever the observable
     * reaches any of its states as a dispatch action.
     * This handler will be removed once the proxy is completed
     * @param forType Type of action
     * @param handler Function that provides an observable that will be used for the async flow of the operation
     */
    public registerAsync<T = any>(forType: string, handler: (state: Map<string, any>, action: IWarixStateAction) => Observable<T>): IWarixAsyncReducerHandler<T> {
        const asyncHandler = this.owner.registerAsync(forType, handler);
        this.instanceHandlers.push(asyncHandler);
        return asyncHandler;
    }

    /**
     * Obtains the underlying value of the state at the rootPath of the proxy
     */
    public peek() {
        return this.owner.peekKey(this.basePath);
    }

    /**
     * Obtains the underlying value of a key in the state
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     */
    public peekKey<T = any>(path: string | string[]) {
        return this.owner.peekKey(combinePaths(this.basePath, path)) as T;
    }

    /**
     * Obtains an observable to the underlying value of a key in the state that will dispatch whenever the value changes
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     */
    public select<T = any, M = T>(path: string | string[], settings?: Partial<IWarixSelectSettings<T, M>>) {
        return this.owner.select<T, M>(combinePaths(this.basePath, path), settings).pipe(takeUntil(this.terminator$));
    }

    /**
     * Obtains an observable to the underlying value of a key in the state that will dispatch whenever the value changes.
     * If the value is a Map or a List, the value is flattened with its toJS method.
     * Flattening a immutable object can be an expensive operation, use with caution.
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     */
    public selectFlatten<T = any, M = T>(path: string | string[], settings?: Partial<IWarixSelectSettings<T, M>>) {
        return this.owner.selectFlatten<T, M>(combinePaths(this.basePath, path), settings).pipe(takeUntil(this.terminator$));
    }

    /**
     * Obtains an observable that will emit whenever the specifed action type is dispatched in the state if it is in the scope of the proxy
     * @param actionType Action type
     */
    public on(actionType: string) {
        return this.actions$.pipe(filter(x => x.type === actionType));
    }

    /**
     * Dispatches a SET-IN action that modifies the rootPath of the proxy in the underlying state
     * @param value New value to assign
     */
    public set(value: any) {
        this.owner.setIn(this.basePath, value);
        return this;
    }

    /**
     * Dispatches a SET-IN action that modifies a key of the underlying state
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param value New value to assign
     */
    public setIn(path: string | string[], value: any) {
        this.owner.setIn(combinePaths(this.basePath, path), value);
        return this;
    }

    /**
     * Dispatches a PATCH action that merges current value of the key at the rootPath of the proxy in the underlying state with the provided value
     * @param value Partial value to merge witht the current value
     */
    public patch(value: any) {
        this.owner.patch(this.basePath, value);
        return this;
    }

    /**
     * Dispatches a PATCH action that merges current value of a key in the underlying state with the provided value
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param value Partial value to merge witht the current value
     */
    public patchIn(path: string | string[], value: any) {
        this.owner.patch(combinePaths(this.basePath, path), value);
        return this;
    }

    /**
     * Dispatches an APPLY action that modifies the key at the rootPath of the proxy in the underlying state with the result of the provided operation
     * @param operation Function that provides the current key value and expects the new key value as a result
     */
    public apply(operation: (value: any) => any) {
        this.owner.apply(this.basePath, operation);
        return this;
    }

    /**
     * Dispatches an APPLY action that modifies a key in the underlying state with the result of the provided operation
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param operation Function that provides the current key value and expects the new key value as a result
     */
    public applyIn(path: string | string[], operation: (value: any) => any) {
        this.owner.apply(combinePaths(this.basePath, path), operation);
        return this;
    }

    /**
     * Dispatches a DELETE action that deletes the key at the rootPath of the proxy in the underlying state
     * @param key Key name
     */
    public delete(key: string) {
        this.owner.delete(this.basePath, key);
        return this;
    }

    /**
     * Dispatches a DELETE action that deletes a key in the underlying state
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param key Key name
     */
    public deleteIn(path: string | string[], key: string) {
        this.owner.delete(combinePaths(this.basePath, path), key);
        return this;
    }

    /**
     * Dispatches a LIST-PUSH action that performs a push operation in the List at the rootPath of the proxy
     * @param items Items to add at the end of the list
     */
    public listPush(items: any[]) {
        this.owner.listPush(this.basePath, items);
        return this;
    }

    /**
     * Dispatches a LIST-PUSH action that performs a push operation in the List at the provided path
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param items Items to add at the end of the list
     */
    public listPushIn(path: string | string[], items: any[]) {
        this.owner.listPush(combinePaths(this.basePath, path), items);
        return this;
    }

    /**
     * Dispatches a LIST-POP action that performs a pop operation in the List at the rootPath of the proxy
     */
    public listPop() {
        this.owner.listPop(this.basePath);
        return this;
    }

    /**
     * Dispatches a LIST-POP action that performs a pop operation in the List at the provided path
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     */
    public listPopIn(path: string | string[]) {
        this.owner.listPop(combinePaths(this.basePath, path));
        return this;
    }

    /**
     * Dispatches a LIST-SHIFT action that performs a shift operation in the List at the rootPath of the proxy
     */
    public listShift() {
        this.owner.listShift(this.basePath);
        return this;
    }

    /**
     * Dispatches a LIST-SHIFT action that performs a shift operation in the List at the provided path
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     */
    public listShiftIn(path: string | string[]) {
        this.owner.listShift(combinePaths(this.basePath, path));
        return this;
    }

    /**
     * Dispatches a LIST-UNSHIFT action that performs an unshift operation in the List at the rootPath of the proxy
     * @param items Items to add at the start of the list
     */
    public listUnshift(items: any[]) {
        this.owner.listUnshift(this.basePath, items);
        return this;
    }

    /**
     * Dispatches a LIST-UNSHIFT action that performs an unshift operation in the List at the provided path
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param items Items to add at the start of the list
     */
    public listUnshiftIn(path: string | string[], items: any[]) {
        this.owner.listUnshift(combinePaths(this.basePath, path), items);
        return this;
    }

    /**
     * Dispatches a LIST-SPLICE action that performs a splice operation in the List at the rootPath of the proxy
     * @param index Index to start the operation from
     * @param deleteCount Number of elements to delete
     * @param items Number of items to add at the provided index
     */
    public listSplice(index: number, deleteCount = 0, items = []) {
        this.owner.listSplice(this.basePath, index, deleteCount, items);
        return this;
    }

    /**
     * Dispatches a LIST-SPLICE action that performs a splice operation in the List at the provided path
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param index Index to start the operation from
     * @param deleteCount Number of elements to delete
     * @param items Number of items to add at the provided index
     */
    public listSpliceIn(path: string | string[], index: number, deleteCount = 0, items = []) {
        this.owner.listSplice(combinePaths(this.basePath, path), index, deleteCount, items);
        return this;
    }

    /**
     * Dispatches a LIST-SPLICE action that that is homologue to a splice operation with a deleteCount of 0 at the rootPath of the proxy
     * @param index Index to start the operation from
     * @param items Number of items to add at the provided index
     */
    public listInsert(index: number, items: any[]) {
        this.owner.listInsert(this.basePath, index, items);
        return this;
    }

    /**
     * Dispatches a LIST-SPLICE action that that is homologue to a splice operation with a deleteCount of 0
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param index Index to start the operation from
     * @param items Number of items to add at the provided index
     */
    public listInsertIn(path: string | string[], index: number, items: any[]) {
        this.owner.listInsert(combinePaths(this.basePath, path), index, items);
        return this;
    }

    /**
     * Dispatches a LIST-SPLICE action that that is homologue to a splice operation without inserting items at the rootPath of the proxy
     * @param index Index to start the operation from
     * @param deleteCount Number of elements to delete
     */
    public listRemoveAt(index: number, deleteCount = 1) {
        this.owner.listSplice(this.basePath, index, deleteCount);
        return this;
    }

    /**
     * Dispatches a LIST-SPLICE action that that is homologue to a splice operation without inserting items
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param index Index to start the operation from
     * @param deleteCount Number of elements to delete
     */
    public listRemoveAtIn(path: string | string[], index: number, deleteCount = 1) {
        this.owner.listSplice(combinePaths(this.basePath, path), index, deleteCount);
        return this;
    }

    /**
     * Dispatches a LIST-SPLICE action that that is homologue to a splice operation without inserting items at the index that matches the provided predicate
     * at the rootPath of the proxy
     * @param predicate Function that determines if an item in the list is the element to be deleted
     */
    public listRemoveFind<T = any>(predicate: (item: T, index: number, list: List<T>) => boolean, deleteCount = 1) {
        this.owner.listRemoveFind(this.basePath, predicate, deleteCount);
        return this;
    }

    /**
     * Dispatches a LIST-SPLICE action that that is homologue to a splice operation without inserting items at the index that matches the provided predicate
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param predicate Function that determines if an item in the list is the element to be deleted
     */
    public listRemoveFindIn<T = any>(path: string | string[], predicate: (item: T, index: number, list: List<T>) => boolean, deleteCount = 1) {
        this.owner.listRemoveFind(combinePaths(this.basePath, path), predicate, deleteCount);
        return this;
    }

    /**
     * Dispatches a LIST-SORT action that sorts a list at the rootPath of the proxy
     * @param compareFn Optional. Comparisson function
     */
    public listSort<T = any>(compareFn?: (a: T, b: T) => number) {
        this.owner.listSort(this.basePath, compareFn);
    }

    /**
     * Dispatches a LIST-SORT action that sorts a list at the specified path
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param compareFn Optional. Comparisson function
     */
    public listSortIn<T = any>(path: string | string[], compareFn?: (a: T, b: T) => number) {
        this.owner.listSort(combinePaths(this.basePath, path), compareFn);
    }

    /**
     * Dispatches a LIST-FILTER action that keeps only the items in the list where the filterFn evaluates to true at the rootPath of the proxy
     * @param filterFn Function that determines if the items should remain in the List
     */
    public listFilter<T = any>(filterFn: (item: T, index: number, list: List<T>) => boolean) {
        this.owner.listFilter(this.basePath, filterFn);
        return this;
    }

    /**
     * Dispatches a LIST-FILTER action that keeps only the items in the list where the filterFn evaluates to true
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     * @param filterFn Function that determines if the items should remain in the List
     */
    public listFilterIn<T = any>(path: string | string[], filterFn: (item: T, index: number, list: List<T>) => boolean) {
        this.owner.listFilter(combinePaths(this.basePath, path), filterFn);
        return this;
    }

    /**
     * Creates a proxy that is relative to the rootPath of the proxy
     * @see WarixStateProxy
     * @param path Relative path to the key in the state with respect of the proxy rootPath
     */
    public subHandler(path: string | string[]) {
        return this.owner.subHandler(combinePaths(this.basePath, path));
    }
}
