"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const immutable_1 = require("immutable");
const lodash_1 = require("lodash");
const coerceValueType = (value) => {
    if (!immutable_1.Map.isMap(value) && !immutable_1.List.isList(value) && (lodash_1.isObject(value) || lodash_1.isArray(value))) {
        return immutable_1.fromJS(value);
    }
    return value;
};
exports.WarixStateActions = {
    set: (value) => {
        return {
            type: "@@set" /* SET */,
            payload: {
                value
            }
        };
    },
    setIn: (path, value) => {
        return {
            type: "@@set-in" /* SET_IN */,
            payload: { path, value: coerceValueType(value) }
        };
    },
    patch: (path, value) => {
        return {
            type: "@@patch" /* PATCH */,
            payload: { path, value: coerceValueType(value) }
        };
    },
    apply: (path, operation) => {
        return {
            type: "@@apply" /* APPLY */,
            payload: { path, operation }
        };
    },
    listPush: (path, items) => {
        return {
            type: "@@list-push" /* LIST_PUSH */,
            payload: { path, items: items.map(x => coerceValueType(x)) }
        };
    },
    listPop: (path) => {
        return {
            type: "@@list-pop" /* LIST_POP */,
            payload: { path }
        };
    },
    listShift: (path) => {
        return {
            type: "@@list-shift" /* LIST_SHIFT */,
            payload: { path }
        };
    },
    listUnshift: (path, items) => {
        return {
            type: "@@list-unshift" /* LIST_UNSHIFT */,
            payload: { path, items: items.map(x => coerceValueType(x)) }
        };
    },
    listSplice: (path, index, deleteCount = 0, items = []) => {
        return {
            type: "@@list-splice" /* LIST_SPLICE */,
            payload: {
                path,
                index,
                deleteCount,
                items: items.map(x => coerceValueType(x))
            }
        };
    },
    listSort: (path, compareFn) => {
        return {
            type: "@@list-sort" /* LIST_SORT */,
            payload: {
                path,
                compareFn
            }
        };
    }
};
//# sourceMappingURL=warix.state-actions.js.map