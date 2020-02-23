import { GLOBAL_SYMBOL } from '../warix.state';
import { isNil } from 'lodash';
import { IWarixSelectSettings } from '../interfaces';

/**
 * Selects an observable to the provided path from the owning object WarixState
 * @param path Path to be selected from WarixState or WarixStateProxy
 */
export function Select<T = any, M = T>(path: string | string[], settings?: Partial<IWarixSelectSettings<T, M>>): any {
    return (target: any, key: string | symbol) => {
        const ownerKey = Symbol();
        return {
            get() {
                if (isNil(this[ownerKey])) {
                    this[ownerKey] = window[GLOBAL_SYMBOL].select(path, settings);
                }
                return this[ownerKey];
            }
        };
    };
}
