import { Subject } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { List } from 'immutable';
import {
    combinePaths, ensureArray,
    IWarixReducerHandler, IWarixStateAction, WarixState, WarixStateActionReducer, WarixStateDataReducer } from './include';

export class WarixStateProxy {
    private instanceHandlers: IWarixReducerHandler[] = [];
    private terminator$: Subject<void>;

    public get source$() {
        return this.owner.select(this.basePath).pipe(takeUntil(this.terminator$));
    }

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

    constructor(private readonly owner: WarixState, private readonly basePath: string[]) {
        this.terminator$ = new Subject<void>();
    }

    public dispatch(action: string, payload: any): this;
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

    public complete() {
        this.instanceHandlers.forEach(x => x.remove());
        this.terminator$.next();
        this.terminator$.complete();
    }

    public registerPreProcessor(forType: string, reducer: WarixStateActionReducer): IWarixReducerHandler {
        const handler = this.owner.registerPreProcessor(forType, reducer);
        this.instanceHandlers.push(handler);
        return handler;
    }

    public registerGlobalPreProcessor(reducer: WarixStateActionReducer): IWarixReducerHandler {
        return this.registerPreProcessor('*', reducer);
    }

    public registerProcessor(forType: string, reducer: WarixStateDataReducer): IWarixReducerHandler {
        const handler = this.owner.registerProcessor(forType, reducer);
        this.instanceHandlers.push(handler);
        return handler;
    }

    public registerGlobalProcessor(reducer: WarixStateDataReducer): IWarixReducerHandler {
        return this.registerProcessor('*', reducer);
    }

    public peek() {
        return this.owner.peekKey(this.basePath);
    }

    public peekKey(path: string | string[]) {
        return this.owner.peekKey(combinePaths(this.basePath, path));
    }

    public select<T = any>(path: string | string[]) {
        return this.owner.select<T>(combinePaths(this.basePath, path)).pipe(takeUntil(this.terminator$));
    }

    public selectMap<T = any, M = any>(path: string | string[], mapping: (value: T) => M) {
        return this.select(path).pipe(map(x => mapping(x))).pipe(takeUntil(this.terminator$));
    }

    public on(actionType: string) {
        return this.actions$.pipe(filter(x => x.type === actionType));
    }

    public set(value: any) {
        this.owner.setIn(this.basePath, value);
        return this;
    }

    public setIn(path: string | string[], value: any) {
        this.owner.setIn(combinePaths(this.basePath, path), value);
        return this;
    }

    public patch(value: any) {
        this.owner.patch(this.basePath, value);
        return this;
    }

    public patchIn(path: string | string[], value: any) {
        this.owner.patch(combinePaths(this.basePath, path), value);
        return this;
    }

    public apply(operation: (value: any) => any) {
        this.owner.apply(this.basePath, operation);
        return this;
    }

    public applyIn(path: string | string[], operation: (value: any) => any) {
        this.owner.apply(combinePaths(this.basePath, path), operation);
        return this;
    }

    public delete(key: string) {
        this.owner.delete(this.basePath, key);
        return this;
    }

    public deleteIn(path: string | string[], key: string) {
        this.owner.delete(combinePaths(this.basePath, path), key);
        return this;
    }

    public listPush(items: any[]) {
        this.owner.listPush(this.basePath, items);
        return this;
    }

    public listPushIn(path: string | string[], items: any[]) {
        this.owner.listPush(combinePaths(this.basePath, path), items);
        return this;
    }

    public listPop() {
        this.owner.listPop(this.basePath);
        return this;
    }

    public listPopIn(path: string | string[]) {
        this.owner.listPop(combinePaths(this.basePath, path));
        return this;
    }

    public listShift() {
        this.owner.listShift(this.basePath);
        return this;
    }

    public listShiftIn(path: string | string[]) {
        this.owner.listShift(combinePaths(this.basePath, path));
        return this;
    }

    public listUnshift(items: any[]) {
        this.owner.listUnshift(this.basePath, items);
        return this;
    }

    public listUnshiftIn(path: string | string[], items: any[]) {
        this.owner.listUnshift(combinePaths(this.basePath, path), items);
        return this;
    }

    public listSplice(index: number, deleteCount = 0, items = []) {
        this.owner.listSplice(this.basePath, index, deleteCount, items);
        return this;
    }

    public listSpliceIn(path: string | string[], index: number, deleteCount = 0, items = []) {
        this.owner.listSplice(combinePaths(this.basePath, path), index, deleteCount, items);
        return this;
    }

    public listSort<T = any>(compareFn?: (a: T, b: T) => number) {
        this.owner.listSort(this.basePath, compareFn);
    }

    public listSortIn<T = any>(path: string | string[], compareFn?: (a: T, b: T) => number) {
        this.owner.listSort(combinePaths(this.basePath, path), compareFn);
    }

    public listFilter<T = any>(filterFn: (item: T, index: number, list: List<T>) => boolean) {
        this.owner.listFilter(this.basePath, filterFn);
        return this;
    }

    public listFilterIn<T = any>(path: string | string[], filterFn: (item: T, index: number, list: List<T>) => boolean) {
        this.owner.listFilter(combinePaths(this.basePath, path), filterFn);
        return this;
    }

    public subHandler(path: string | string[]) {
        return this.owner.subHandler(combinePaths(this.basePath, path));
    }
}
