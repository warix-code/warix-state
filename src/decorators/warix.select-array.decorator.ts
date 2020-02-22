import { GLOBAL_SYMBOL } from '../warix.state';
import { isNil } from 'lodash';
import { List } from 'immutable';

/**
 * Selects an observable to the provided array path from the owning object WarixState. The resulting list is transformed to its Array representation.
 * This is a shallow operation, deep immutable elements will not be transformed, if a deep transformation is expected use the @see SelectFlatten decorator instead
 * @param path Path to be selected from WarixState or WarixStateProxy
 */
export function SelectArray(path: string | string[]): any {
    return (target: any, key: string | symbol) => {
        const ownerKey = Symbol();
        return {
            get() {
                if (isNil(this[ownerKey])) {
                    this[ownerKey] = window[GLOBAL_SYMBOL].selectMap(path, (v: any) => List.isList(v) ? v.toArray() : v);
                }
                return this[ownerKey];
            }
        };
    };
}
