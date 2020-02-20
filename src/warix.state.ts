import { fromJS, List, Map } from 'immutable';
import { isArray, isNil, isObject } from 'lodash';
import { BehaviorSubject, merge, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, filter, map, scan, startWith } from 'rxjs/operators';
import { ensureArray, isReducerResult,
    IWarixReducerHandler, IWarixStateAction, IWarixStatePostAction, IWarixStateReducerEntry,
    resolvePath, WarixStateActionReducer, WarixStateActions, WarixStateActionType, WarixStateDataReducer, WarixStateProxy } from './include';

export const GLOBAL_SYMBOL = Symbol('WARIX::STATE');

export class WarixState {
    private readonly dispatcher$: Subject<IWarixStateAction>;
    private readonly postAction$: Subject<IWarixStatePostAction>;
    private readonly state$: BehaviorSubject<Map<string, any>>;
    private readonly preProcessors: IWarixStateReducerEntry<IWarixStateAction>[] = [];
    private readonly processors: IWarixStateReducerEntry<Map<string, any>>[] = [];

    public get source$() {
        return this.state$.asObservable();
    }

    public get actions$() {
        return this.dispatcher$.asObservable();
    }

    public get postActions$() {
        return this.postAction$.asObservable();
    }

    constructor(initialState?: Map<string, any>) {
        this.validateSingleInstance();
        this.dispatcher$ = new Subject<IWarixStateAction>();
        this.state$ = new BehaviorSubject<Map<string, any>>(undefined);
        this.postAction$ = new Subject<IWarixStatePostAction>();
        this.initScanner(initialState || fromJS({}));
        window[GLOBAL_SYMBOL] = this;
    }

    private validateSingleInstance() {
        if (window[GLOBAL_SYMBOL]) {
            throw new Error(`An Warix state has already been defined, only a single instance can be defined per execution`);
        }
    }

    private coerceValueType(value: any) {
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

    private initScanner(intialState: Map<string, any>) {
        const fnDispatchPost = (post: IWarixStatePostAction) => {
            setTimeout(() => {
                this.postAction$.next(post);
            }, 1);
        };
        merge(new Subject().pipe(startWith(intialState)), this.dispatcher$)
            .pipe(
                scan((accumulator: Map<string, any>, action: IWarixStateAction) => {
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

    public complete() {
        this.postAction$.complete();
        this.dispatcher$.complete();
        this.state$.complete();
    }

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
        this.preProcessors.push(entry);
        return handler;
    }

    public registerGlobalPreProcessor(reducer: WarixStateActionReducer): IWarixReducerHandler {
        return this.registerPreProcessor('*', reducer);
    }

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
        this.processors.push(entry);
        return handler;
    }

    public registerGlobalProcessor(reducer: WarixStateDataReducer): IWarixReducerHandler {
        return this.registerProcessor('*', reducer);
    }

    public dispatch(action: string, payload: any): this;
    public dispatch(action: IWarixStateAction): this;
    public dispatch() {
        if (arguments.length === 2) {
            this.dispatcher$.next({ type: arguments[0], payload: arguments[1] });
        } else {
            this.dispatcher$.next(arguments[0]);
        }
        return this;
    }

    public peek() {
        return this.state$.value;
    }

    public peekKey(key: string | string[]) {
        return this.state$.value.getIn(resolvePath(ensureArray(key)));
    }

    public select<T = any>(path: string | string[]) {
        return this.source$.pipe(
            map(x => x.getIn(resolvePath(ensureArray(path)))),
            distinctUntilChanged()
        ) as Observable<T>;
    }

    public selectMap<T = any, M = any>(path: string | string[], mapping: (value: T) => M) {
        return this.select(path).pipe(map(x => mapping(x)));
    }

    public on(actionType: string) {
        return this.actions$.pipe(filter(x => x.type === actionType));
    }

    public set(value: Map<string, any>) {
        this.dispatcher$.next(WarixStateActions.set(value));
        return this;
    }

    public setIn(path: string | string[], value: any) {
        this.dispatcher$.next(WarixStateActions.setIn(path, value));
        return this;
    }

    public patch(path: string | string[], value: any) {
        this.dispatcher$.next(WarixStateActions.patch(path, value));
    }

    public apply(path: string | string[], operation: (value: any) => any) {
        this.dispatcher$.next(WarixStateActions.apply(path, operation));
        return this;
    }

    public delete(path: string | string[], key: string) {
        this.dispatcher$.next(WarixStateActions.delete(path, key));
        return this;
    }

    public listPush(path: string | string[], items: any[]) {
        this.dispatcher$.next(WarixStateActions.listPush(path, items));
        return this;
    }

    public listPop(path: string | string[]) {
        this.dispatcher$.next(WarixStateActions.listPop(path));
        return this;
    }

    public listShift(path: string | string[]) {
        this.dispatcher$.next(WarixStateActions.listShift(path));
        return this;
    }

    public listUnshift(path: string | string[], items: any[]) {
        this.dispatcher$.next(WarixStateActions.listUnshift(path, items));
        return this;
    }

    public listSplice(path: string | string[], index: number, deleteCount = 0, items: any[] = []) {
        this.dispatcher$.next(WarixStateActions.listSplice(path, index, deleteCount, items));
        return this;
    }

    public listSort<T = any>(path: string | string[], compareFn?: (a: T, b: T) => number) {
        this.dispatcher$.next(WarixStateActions.listSort(path, compareFn));
        return this;
    }

    public listFilter<T = any>(path: string | string[], filterFn: (item: T, index: number, list: List<T>) => boolean) {
        this.dispatcher$.next(WarixStateActions.listFilter(path, filterFn));
        return this;
    }

    public subHandler(path: string | string[]) {
        return new WarixStateProxy(this, ensureArray(path));
    }
}
