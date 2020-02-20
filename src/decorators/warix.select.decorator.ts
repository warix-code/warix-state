import { GLOBAL_SYMBOL } from '../warix.state';
import { isNil } from 'lodash';
/**
 * Selects an observable to the provided path from the owning object WarixState
 * @param path Path to be selected from WarixState or WarixStateProxy
 */
export function Select(path: string | string[]): any {
    return (target: any, key: string | symbol) => {
        const ownerKey = Symbol();
        return {
            get() {
                if (isNil(this[ownerKey])) {
                    this[ownerKey] = window[GLOBAL_SYMBOL].select(path);
                }
                return this[ownerKey];
            }
        };
    };
}
