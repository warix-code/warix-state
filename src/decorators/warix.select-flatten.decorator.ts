import { GLOBAL_SYMBOL } from '../warix.state';
import { isNil } from 'lodash';
import { Map, List } from 'immutable';
import { IWarixSelectSettings } from '../interfaces';

/**
 * Selects an observable to the provided path from the owning object WarixState, if the object is an immutable List or Map, the object is flatten
 * with the toJS method of the immutable object. Flattening an immutable object can be an expensive operation if the value changes constantly,
 * use with caution
 * @param path Path to be selected from WarixState or WarixStateProxy
 */
export function SelectFlatten<T = any, M = T>(path: string | string[], settings?: Partial<IWarixSelectSettings<T, M>>): any {
    return (target: any, key: string | symbol) => {
        const ownerKey = Symbol();
        return {
            get() {
                if (isNil(this[ownerKey])) {
                    this[ownerKey] = window[GLOBAL_SYMBOL].selectFlatten(path, settings);
                }
                return this[ownerKey];
            }
        };
    };
}
