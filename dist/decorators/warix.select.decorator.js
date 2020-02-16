"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const warix_state_1 = require("../warix.state");
const lodash_1 = require("lodash");
/**
 * Selects an observable to the provided path from the owning object WarixState
 * @param path Path to be selected from WarixState or WarixStateProxy
 */
function Select(path) {
    return (target, key) => {
        const ownerKey = Symbol();
        return {
            get() {
                if (lodash_1.isNil(this[ownerKey])) {
                    this[ownerKey] = window[warix_state_1.GLOBAL_SYMBOL].select(path);
                }
                return this[ownerKey];
            }
        };
    };
}
exports.Select = Select;
//# sourceMappingURL=warix.select.decorator.js.map