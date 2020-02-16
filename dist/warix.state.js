"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const immutable_1 = require("immutable");
const lodash_1 = require("lodash");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const include_1 = require("./include");
exports.GLOBAL_SYMBOL = Symbol('WARIX::STATE');
class WarixState {
    constructor(initialState) {
        this.preProcessors = [];
        this.processors = [];
        this.validateSingleInstance();
        this.dispatcher$ = new rxjs_1.Subject();
        this.state$ = new rxjs_1.BehaviorSubject(undefined);
        this.postAction$ = new rxjs_1.Subject();
        this.initScanner(initialState || immutable_1.fromJS({}));
        window[exports.GLOBAL_SYMBOL] = this;
    }
    get source$() {
        return this.state$.asObservable();
    }
    get actions$() {
        return this.dispatcher$.asObservable();
    }
    get postActions$() {
        return this.postAction$.asObservable();
    }
    validateSingleInstance() {
        if (window[exports.GLOBAL_SYMBOL]) {
            throw new Error(`An Warix state has already been defined, only a single instance can be defined per execution`);
        }
    }
    coerceValueType(value) {
        if (!immutable_1.Map.isMap(value) && !immutable_1.List.isList(value) && (lodash_1.isObject(value) || lodash_1.isArray(value))) {
            return immutable_1.fromJS(value);
        }
        return value;
    }
    getList(state, path) {
        const list = state.getIn(path);
        if (lodash_1.isNil(list)) {
            return immutable_1.List();
        }
        else {
            if (!immutable_1.List.isList(list)) {
                throw new Error(`List operations can only be performed in list types. Expected List<any> but found ${typeof (list)}::${list}`);
            }
            return list;
        }
    }
    reduceAction(state, action) {
        let result = action;
        for (const r of this.preProcessors) {
            if (r.paused === false && (r.forType === result.type || r.forType === '*')) {
                const current = r.reducer(state, result);
                if (include_1.isReducerResult(current)) {
                    result = current.value;
                    if (current.stopPropagation) {
                        return result;
                    }
                }
                else {
                    result = current;
                }
            }
        }
        return result;
    }
    reduceData(state, action) {
        let result = state;
        for (const r of this.processors) {
            if (r.paused === false && (r.forType === action.type || r.forType === '*')) {
                const current = r.reducer(result, action);
                if (include_1.isReducerResult(current)) {
                    result = current.value;
                    if (current.stopPropagation) {
                        return result;
                    }
                }
                else {
                    result = current;
                }
            }
        }
        return result;
    }
    initScanner(intialState) {
        const fnDispatchPost = (post) => {
            setTimeout(() => {
                this.postAction$.next(post);
            }, 1);
        };
        rxjs_1.merge(new rxjs_1.Subject().pipe(operators_1.startWith(intialState)), this.dispatcher$)
            .pipe(operators_1.scan((accumulator, action) => {
            const nextAction = this.reduceAction(accumulator, action);
            const nextState = this.reduceData(accumulator, nextAction);
            fnDispatchPost({ executedAction: nextAction, finalState: nextState, initialAction: action, initialState: accumulator });
            return nextState;
        })).subscribe(x => this.state$.next(x));
        return this.initDefaultHandlers();
    }
    initDefaultHandlers() {
        this.registerProcessor("@@set" /* SET */, (s, a) => a.payload.value);
        this.registerProcessor("@@set-in" /* SET_IN */, (s, a) => {
            return s.setIn(include_1.resolvePath(include_1.ensureArray(a.payload.path)), a.payload.value);
        });
        this.registerProcessor("@@patch" /* PATCH */, (s, a) => {
            return s.mergeDeepIn(include_1.resolvePath(include_1.ensureArray(a.payload.path)), a.payload.value);
        });
        this.registerProcessor("@@apply" /* APPLY */, (s, a) => {
            const path = include_1.resolvePath(include_1.ensureArray(a.payload.path));
            const current = s.getIn(path);
            return s.setIn(path, a.payload.operation(current));
        });
        this.registerProcessor("@@list-pop" /* LIST_POP */, (s, a) => {
            const path = include_1.resolvePath(include_1.ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.pop());
        });
        this.registerProcessor("@@list-push" /* LIST_PUSH */, (s, a) => {
            const path = include_1.resolvePath(include_1.ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.push(...a.payload.items));
        });
        this.registerProcessor("@@list-shift" /* LIST_SHIFT */, (s, a) => {
            const path = include_1.resolvePath(include_1.ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.shift());
        });
        this.registerProcessor("@@list-splice" /* LIST_SPLICE */, (s, a) => {
            const path = include_1.resolvePath(include_1.ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.splice(a.payload.index, a.payload.deleteCount, ...a.payload.items));
        });
        this.registerProcessor("@@list-unshift" /* LIST_UNSHIFT */, (s, a) => {
            const path = include_1.resolvePath(include_1.ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.unshift(...a.payload.items));
        });
        this.registerProcessor("@@list-sort" /* LIST_SORT */, (s, a) => {
            const path = include_1.resolvePath(include_1.ensureArray(a.payload.path));
            const list = this.getList(s, path);
            return s.setIn(path, list.sort(a.payload.compareFn));
        });
        return this;
    }
    complete() {
        this.postAction$.complete();
        this.dispatcher$.complete();
        this.state$.complete();
    }
    registerPreProcessor(forType, reducer) {
        const entry = { forType, reducer, paused: false };
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
    registerGlobalPreProcessor(reducer) {
        return this.registerPreProcessor('*', reducer);
    }
    registerProcessor(forType, reducer) {
        const entry = { forType, reducer, paused: false };
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
    registerGlobalProcessor(reducer) {
        return this.registerProcessor('*', reducer);
    }
    dispatch() {
        if (arguments.length === 2) {
            this.dispatcher$.next({ type: arguments[0], payload: arguments[1] });
        }
        else {
            this.dispatcher$.next(arguments[0]);
        }
        return this;
    }
    peek() {
        return this.state$.value;
    }
    peekKey(key) {
        return this.state$.value.getIn(include_1.resolvePath(include_1.ensureArray(key)));
    }
    select(path) {
        return this.source$.pipe(operators_1.map(x => x.getIn(include_1.resolvePath(include_1.ensureArray(path)))), operators_1.distinctUntilChanged());
    }
    selectMap(path, mapping) {
        return this.select(path).pipe(operators_1.map(x => mapping(x)));
    }
    on(actionType) {
        return this.actions$.pipe(operators_1.filter(x => x.type === actionType));
    }
    set(value) {
        this.dispatcher$.next(include_1.WarixStateActions.set(value));
        return this;
    }
    setIn(path, value) {
        this.dispatcher$.next(include_1.WarixStateActions.setIn(path, value));
        return this;
    }
    patch(path, value) {
        this.dispatcher$.next(include_1.WarixStateActions.patch(path, value));
    }
    apply(path, operation) {
        this.dispatcher$.next(include_1.WarixStateActions.apply(path, operation));
        return this;
    }
    listPush(path, items) {
        this.dispatcher$.next(include_1.WarixStateActions.listPush(path, items));
        return this;
    }
    listPop(path) {
        this.dispatcher$.next(include_1.WarixStateActions.listPop(path));
        return this;
    }
    listShift(path) {
        this.dispatcher$.next(include_1.WarixStateActions.listShift(path));
        return this;
    }
    listUnshift(path, items) {
        this.dispatcher$.next(include_1.WarixStateActions.listUnshift(path, items));
        return this;
    }
    listSplice(path, index, deleteCount = 0, items = []) {
        this.dispatcher$.next(include_1.WarixStateActions.listSplice(path, index, deleteCount, items));
        return this;
    }
    listSort(path, compareFn) {
        this.dispatcher$.next(include_1.WarixStateActions.listSort(path, compareFn));
        return this;
    }
    subHandler(path) {
        return new include_1.WarixStateProxy(this, include_1.ensureArray(path));
    }
}
exports.WarixState = WarixState;
//# sourceMappingURL=warix.state.js.map