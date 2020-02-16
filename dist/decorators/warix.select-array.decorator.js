"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const warix_state_1 = require("../warix.state");
const lodash_1 = require("lodash");
/**
 * Selects an observable to the provided array path from the owning object WarixState. The resulting list is transforme to its Array representation
 * @param path Path to be selected from WarixState or WarixStateProxy
 */
function SelectArray(path) {
    return (target, key) => {
        const ownerKey = Symbol();
        return {
            get() {
                if (lodash_1.isNil(this[ownerKey])) {
                    this[ownerKey] = window[warix_state_1.GLOBAL_SYMBOL].selectMap(path, (v) => v.toArray());
                }
                return this[ownerKey];
            }
        };
    };
}
exports.SelectArray = SelectArray;
//# sourceMappingURL=warix.select-array.decorator.js.map