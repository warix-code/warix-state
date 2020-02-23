import { Map, List } from 'immutable';
import { Subscription, Observable } from 'rxjs';

export interface IKeyed<T = any> {
    [ key: string ]: T;
}

export interface IWarixStateMinimal {
    dispatch(action: string, payload: any): IWarixStateMinimal;
    dispatch(action: IWarixStateAction): IWarixStateMinimal;
    peek(): Map<string, any>;
    peekKey<T = any>(path: string | string[]): T;
    set(value: Map<string, any>): IWarixStateMinimal;
    setIn(path: string | string[], value: any): IWarixStateMinimal;
    patch(path: string | string[], value: any): IWarixStateMinimal;
    apply(path: string | string[], value: any): IWarixStateMinimal;
    delete(path: string | string[], value: any): IWarixStateMinimal;
    listPush(path: string | string[], items: any[]): IWarixStateMinimal;
    listPop(path: string | string[]): IWarixStateMinimal;
    listShift(path: string | string[]): IWarixStateMinimal;
    listUnshift(path: string | string[], items: any[]): IWarixStateMinimal;
    listSplice(path: string | string[], index: number, deleteCount: number, items: any[]): IWarixStateMinimal;
    listInsert(path: string | string[], index: number, items: any[]): IWarixStateMinimal;
    listRemoveAt(path: string | string[], index: number, deleteCount: number): IWarixStateMinimal;
    listRemoveFind<T = any>(path: string | string[], predicate: (item: T, index: number, list: List<T>) => boolean, deleteCount: number): IWarixStateMinimal;
    listSort<T = any>(path: string | string[], compareFn?: (a: T, b: T) => number): IWarixStateMinimal;
    listFilter<T = any>(path: string | string[], filterFn: (item: T, index: number, list: List<T>) => boolean): IWarixStateMinimal;
}

export interface IWarixStateAction {
    /**
     * Unique action type name
     */
    type: string;
    /**
     * Payload of the action
     */
    payload: any;
}

export interface IWarixStateReducerResult<X> {
    /**
     * Result of the reduction
     */
    value: X;
    /**
     * When true, no further reductions will be performed
     */
    stopPropagation: boolean;
}

export type WarixStateActionReducer = (state: Map<string, any>, action: IWarixStateAction) => IWarixStateAction | IWarixStateReducerResult<IWarixStateAction>;

export type WarixStateDataReducer = (state: Map<string, any>, action: IWarixStateAction) => Map<string, any> | IWarixStateReducerResult<Map<string, any>>;

export interface IWarixStateReducerEntry<X> {
    forType: string;
    paused: boolean;
    reducer(state: Map<string, any>, action: IWarixStateAction): X | IWarixStateReducerResult<X>;
}

export interface IWarixReducerHandler {
    /**
     * Get is the reducer is paused
     */
    readonly isPaused: boolean;
    /**
     * Pauses the reducer
     */
    pause(): IWarixReducerHandler;
    /**
     * Resumes the reducer
     */
    resume(): IWarixReducerHandler;
    /**
     * Removes the reducer from the WarixState or WarixStateProxy
     */
    remove(): void;
}

export interface IWarixAsyncReducerHandler<T = any> extends IWarixReducerHandler {
    /**
     * Registers a preProcessor callback used when the async provider reaches the next state
     */
    onNext(callback: (value: T) => IWarixStateAction): IWarixAsyncReducerHandler<T>;
    /**
     * Registers a preProcessor callback used when the async provider reaches the error state
     */
    onError(callback: (error: any) => IWarixStateAction): IWarixAsyncReducerHandler<T>;
    /**
     * Registers a preProcessor callback used when the async provider reaches the complete state
     */
    onComplete(callback: () => IWarixStateAction): IWarixAsyncReducerHandler<T>;
    /**
     * Registers a preProcessor callback used when the async provider is initialized (on subscription started)
     */
    onStart(callback: () => IWarixStateAction): IWarixAsyncReducerHandler<T>;
    /**
     * Subscribes to an observable that when it emits, the async handler action is dispatched with the observable data
     * as the action payload
     * @param source Source of the trigger that also provides the action payload
     */
    trigger(source: Observable<any>): Subscription;
}

export interface IWarixStatePostAction {
    /**
     * Initial underlying state before the current action is performed
     */
    initialState: Map<string, any>;
    /**
     * Final underlying state after the current action is performed
     */
    finalState: Map<string, any>;
    /**
     * Action received by the reduction process
     */
    initialAction: IWarixStateAction;
    /**
     * Action transformed by the WarixState preProcessors
     */
    executedAction: IWarixStateAction;
}

export interface IWarixSelectSettings<T = any, M = T> {
    /**
     * Emits a value from the source Observable only after a particular time span has passed without another source emission.
     */
    debounceTime: number;
    /**
     * Filter applied to the value before the mapping operation if any
     */
    preFilter: (value: T) => boolean;
    /**
     * Transforms the selection result into another type / value
     */
    map: (value: T, state: IWarixStateMinimal) => M;
    /**
     * Filter applied to the value after the mapping operation if any
     */
    postFilter: (value: M) => boolean;
}