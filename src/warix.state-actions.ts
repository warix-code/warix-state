import { fromJS, List, Map } from 'immutable';
import { isArray, isObject } from 'lodash';
import { IWarixStateAction, WarixStateActionType } from './include';

const coerceValueType = (value: any) => {
    if (!Map.isMap(value) && !List.isList(value) && (isObject(value) || isArray(value))) {
        return fromJS(value);
    }
    return value;
};

export const WarixStateActions = {
    /**
     * Creates a set operation
     * @param value New state
     */
    set: (value: Map<string, any>): IWarixStateAction => {
        return {
            type: WarixStateActionType.SET,
            payload: {
                value
            }
        };
    },
    /**
     * Creates a set-in opperation
     * @param path Path in the state to assign
     * @param value New value
     */
    setIn: (path: string | string[], value: any): IWarixStateAction => {
        return {
            type: WarixStateActionType.SET_IN,
            payload: { path, value: coerceValueType(value) }
        };
    },
    /**
     * Creates a patch operation
     * @param path Path in the state to patch
     * @param value Patch value
     */
    patch: (path: string | string[], value: any): IWarixStateAction => {
        return {
            type: WarixStateActionType.PATCH,
            payload: { path, value: coerceValueType(value) }
        };
    },
    /**
     * Creates a apply operation
     * @param path Path in the state to apply the operation to
     * @param operation Function that takes the current value and expects a single value to assign
     */
    apply: (path: string | string[], operation: (value: any) => any): IWarixStateAction => {
        return {
            type: WarixStateActionType.APPLY,
            payload: { path, operation }
        };
    },
    /**
     * Creates a delete operation
     * @param path Path in the state where the key will be deleted
     * @param key Name of the key do be deleted
     */
    delete: (path: string | string[], key: string): IWarixStateAction => {
        return {
            type: WarixStateActionType.DELETE,
            payload: { path, key }
        };
    },
    /**
     * Creates a list-push operation
     * @param path Path to the list in the state to perform the operation on
     * @param items Items to add at the end of the list
     */
    listPush: (path: string | string[], items: any[]): IWarixStateAction => {
        return {
            type: WarixStateActionType.LIST_PUSH,
            payload: { path, items: items.map(x => coerceValueType(x)) }
        };
    },
    /**
     * Creates a list-pop operation
     * @param path Path to the list in the state to perform the operation on
     */
    listPop: (path: string | string[]): IWarixStateAction => {
        return {
            type: WarixStateActionType.LIST_POP,
            payload: { path }
        };
    },
    /**
     * Creates a list-shift operation
     * @param path Path to the list in the state to perform the operation on
     */
    listShift: (path: string | string[]): IWarixStateAction => {
        return {
            type: WarixStateActionType.LIST_SHIFT,
            payload: { path }
        };
    },
    /**
     * Creates a list-unshift operation
     * @param path Path to the list in the state to perform the operation on
     * @param items Items to add at the start of the list
     */
    listUnshift: (path: string | string[], items: any[]): IWarixStateAction => {
        return {
            type: WarixStateActionType.LIST_UNSHIFT,
            payload: { path, items: items.map(x => coerceValueType(x)) }
        };
    },
    /**
     * Creates a list-splice operation
     * @param path Path to the list in the state to perform the operation on
     * @param index Index from where to start the splice operation
     * @param deleteCount Number of items to remove
     * @param items Items to add at the provided index of the list
     */
    listSplice: (path: string | string[], index: number, deleteCount = 0, items: any[] = []): IWarixStateAction => {
        return {
            type: WarixStateActionType.LIST_SPLICE,
            payload: {
                path,
                index,
                deleteCount,
                items: items.map(x => coerceValueType(x))
            }
        };
    },
    /**
     * Creates a list-sort operation
     * @param path Path to the list in the state to perform the operation on
     * @param compareFn Optional compare function used in the sort comparisson
     */
    listSort: <T = any>(path: string | string[], compareFn?: (a: T, b: T) => number): IWarixStateAction => {
        return {
            type: WarixStateActionType.LIST_SORT,
            payload: {
                path,
                compareFn
            }
        };
    },
    /**
     * Create e list-filter operation
     * @param path Path to the list in the state to perform the operation on
     * @param filterFn Function that determines which elements to keep, if return is falsey, the element is not kept
     */
    listFilter: <T = any>(path: string | string[], filterFn: (item: T, index: number, list: List<T>) => boolean): IWarixStateAction => {
        return {
            type: WarixStateActionType.LIST_FILTER,
            payload: { path, filterFn }
        };
    }
};
