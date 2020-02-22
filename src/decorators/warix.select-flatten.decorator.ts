import { GLOBAL_SYMBOL } from '../warix.state';
import { isNil } from 'lodash';
import { Map, List } from 'immutable';
/**
 * Selects an observable to the provided path from the owning object WarixState, if the object is an immutable List or Map, the object is flatten
 * with the toJS method of the immutable object. Flattening an immutable object can be an expensive operation if the value changes constantly,
 * use with caution
 * @param path Path to be selected from WarixState or WarixStateProxy
 */
export function SelectFlatten(path: string | string[]): any {
    return (target: any, key: string | symbol) => {
        const ownerKey = Symbol();
        return {
            get() {
                if (isNil(this[ownerKey])) {
                    this[ownerKey] = window[GLOBAL_SYMBOL].selectMap(path, (v) => {
                        if (Map.isMap(v)) {
                            return v.toJS();
                        } else if (List.isList(v)) {
                            return v.toJS();
                        }
                        return v;
                    });
                }
                return this[ownerKey];
            }
        };
    };
}
