"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const include_1 = require("./include");
class WarixStateProxy {
    constructor(owner, basePath) {
        this.owner = owner;
        this.basePath = basePath;
        this.instanceHandlers = [];
        this.terminator$ = new rxjs_1.Subject();
    }
    get source$() {
        return this.owner.select(this.basePath).pipe(operators_1.takeUntil(this.terminator$));
    }
    get actions$() {
        return this.owner.actions$.pipe(operators_1.filter(x => {
            if (x && x.payload && x.payload.path) {
                return include_1.ensureArray(x.payload.path).join('.').startsWith(this.basePath.join('.'));
            }
            return false;
        }), operators_1.takeUntil(this.terminator$));
    }
    dispatch() {
        let action;
        if (arguments.length === 2) {
            action = { type: arguments[0], payload: arguments[1] };
        }
        else {
            action = arguments[0];
        }
        if (action.payload) {
            action.payload.path = include_1.combinePaths(this.basePath, action.payload.path || []);
        }
        this.owner.dispatch(action);
        return this;
    }
    complete() {
        this.instanceHandlers.forEach(x => x.remove());
        this.terminator$.next();
        this.terminator$.complete();
    }
    registerPreProcessor(forType, reducer) {
        const handler = this.owner.registerPreProcessor(forType, reducer);
        this.instanceHandlers.push(handler);
        return handler;
    }
    registerGlobalPreProcessor(reducer) {
        return this.registerPreProcessor('*', reducer);
    }
    registerProcessor(forType, reducer) {
        const handler = this.owner.registerProcessor(forType, reducer);
        this.instanceHandlers.push(handler);
        return handler;
    }
    registerGlobalProcessor(reducer) {
        return this.registerProcessor('*', reducer);
    }
    peek() {
        return this.owner.peekKey(this.basePath);
    }
    peekKey(path) {
        return this.owner.peekKey(include_1.combinePaths(this.basePath, path));
    }
    select(path) {
        return this.owner.select(include_1.combinePaths(this.basePath, path)).pipe(operators_1.takeUntil(this.terminator$));
    }
    selectMap(path, mapping) {
        return this.select(path).pipe(operators_1.map(x => mapping(x))).pipe(operators_1.takeUntil(this.terminator$));
    }
    on(actionType) {
        return this.actions$.pipe(operators_1.filter(x => x.type === actionType));
    }
    set(value) {
        this.owner.setIn(this.basePath, value);
        return this;
    }
    setIn(path, value) {
        this.owner.setIn(include_1.combinePaths(this.basePath, path), value);
        return this;
    }
    patch(value) {
        this.owner.patch(this.basePath, value);
        return this;
    }
    patchIn(path, value) {
        this.owner.patch(include_1.combinePaths(this.basePath, path), value);
        return this;
    }
    apply(operation) {
        this.owner.apply(this.basePath, operation);
        return this;
    }
    applyIn(path, operation) {
        this.owner.apply(include_1.combinePaths(this.basePath, path), operation);
        return this;
    }
    listPush(items) {
        this.owner.listPush(this.basePath, items);
        return this;
    }
    listPushIn(path, items) {
        this.owner.listPush(include_1.combinePaths(this.basePath, path), items);
        return this;
    }
    listPop() {
        this.owner.listPop(this.basePath);
        return this;
    }
    listPopIn(path) {
        this.owner.listPop(include_1.combinePaths(this.basePath, path));
        return this;
    }
    listShift() {
        this.owner.listShift(this.basePath);
        return this;
    }
    listShiftIn(path) {
        this.owner.listShift(include_1.combinePaths(this.basePath, path));
        return this;
    }
    listUnshift(items) {
        this.owner.listUnshift(this.basePath, items);
        return this;
    }
    listUnshiftIn(path, items) {
        this.owner.listUnshift(include_1.combinePaths(this.basePath, path), items);
        return this;
    }
    listSplice(index, deleteCount = 0, items = []) {
        this.owner.listSplice(this.basePath, index, deleteCount, items);
        return this;
    }
    listSpliceIn(path, index, deleteCount = 0, items = []) {
        this.owner.listSplice(include_1.combinePaths(this.basePath, path), index, deleteCount, items);
        return this;
    }
    listSort(compareFn) {
        this.owner.listSort(this.basePath, compareFn);
    }
    listSortIn(path, compareFn) {
        this.owner.listSort(include_1.combinePaths(this.basePath, path), compareFn);
    }
    subHandler(path) {
        return this.owner.subHandler(include_1.combinePaths(this.basePath, path));
    }
}
exports.WarixStateProxy = WarixStateProxy;
//# sourceMappingURL=warix.state-proxy.js.map