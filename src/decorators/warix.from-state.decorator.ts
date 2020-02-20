import { GLOBAL_SYMBOL } from '../warix.state';

/**
 * Creates a get/set accesor to the provided path from the owning object WarixState or WarixStateProxy
 * @param path Path to be selected from WarixState or WarixStateProxy
 */
export function FromState(path: string | string[]): any {
    return (target: any, key: string | symbol) => {
        return {
            get() {
                return window[GLOBAL_SYMBOL].peekKey(path);
            },
            set(value: any) {
                window[GLOBAL_SYMBOL].setIn(path, value);
            }
        };
    };
}
