import { GLOBAL_SYMBOL } from '../warix.state';
import { isNil } from 'lodash';
import { List } from 'immutable';

/**
 * Selects an observable to the provided array path from the owning object WarixState. The resulting list is transforme to its Array representation
 * @param path Path to be selected from WarixState or WarixStateProxy
 */
export function SelectArray(path: string | string[]): any {
    return (target: any, key: string | symbol) => {
        const ownerKey = Symbol();
        return {
            get() {
                if (isNil(this[ownerKey])) {
                    this[ownerKey] = window[GLOBAL_SYMBOL].selectMap(path, (v: List<any>) => v.toArray());
                }
                return this[ownerKey];
            }
        };
    };
}
