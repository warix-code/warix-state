import { IWarixReducerHandler, IWarixStateAction, WarixState, WarixStateActionReducer, WarixStateDataReducer } from './include';
export declare class WarixStateProxy {
    private readonly owner;
    private readonly basePath;
    private instanceHandlers;
    private terminator$;
    readonly source$: import("rxjs").Observable<any>;
    readonly actions$: import("rxjs").Observable<IWarixStateAction>;
    constructor(owner: WarixState, basePath: string[]);
    dispatch(action: string, payload: any): this;
    dispatch(action: IWarixStateAction): this;
    complete(): void;
    registerPreProcessor(forType: string, reducer: WarixStateActionReducer): IWarixReducerHandler;
    registerGlobalPreProcessor(reducer: WarixStateActionReducer): IWarixReducerHandler;
    registerProcessor(forType: string, reducer: WarixStateDataReducer): IWarixReducerHandler;
    registerGlobalProcessor(reducer: WarixStateDataReducer): IWarixReducerHandler;
    peek(): any;
    peekKey(path: string | string[]): any;
    select<T = any>(path: string | string[]): import("rxjs").Observable<T>;
    selectMap<T = any, M = any>(path: string | string[], mapping: (value: T) => M): import("rxjs").Observable<M>;
    on(actionType: string): import("rxjs").Observable<IWarixStateAction>;
    set(value: any): this;
    setIn(path: string | string[], value: any): this;
    patch(value: any): this;
    patchIn(path: string | string[], value: any): this;
    apply(operation: (value: any) => any): this;
    applyIn(path: string | string[], operation: (value: any) => any): this;
    listPush(items: any[]): this;
    listPushIn(path: string | string[], items: any[]): this;
    listPop(): this;
    listPopIn(path: string | string[]): this;
    listShift(): this;
    listShiftIn(path: string | string[]): this;
    listUnshift(items: any[]): this;
    listUnshiftIn(path: string | string[], items: any[]): this;
    listSplice(index: number, deleteCount?: number, items?: any[]): this;
    listSpliceIn(path: string | string[], index: number, deleteCount?: number, items?: any[]): this;
    listSort<T = any>(compareFn?: (a: T, b: T) => number): void;
    listSortIn<T = any>(path: string | string[], compareFn?: (a: T, b: T) => number): void;
    subHandler(path: string | string[]): WarixStateProxy;
}
