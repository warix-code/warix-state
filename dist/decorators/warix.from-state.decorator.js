"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const warix_state_1 = require("../warix.state");
/**
 * Creates a get/set accesor to the provided path from the owning object WarixState or WarixStateProxy
 * @param path Path to be selected from WarixState or WarixStateProxy
 */
function FromState(path) {
    return (target, key) => {
        return {
            get() {
                return window[warix_state_1.GLOBAL_SYMBOL].peekKey(path);
            },
            set(value) {
                window[warix_state_1.GLOBAL_SYMBOL].setIn(path, value);
            }
        };
    };
}
exports.FromState = FromState;
//# sourceMappingURL=warix.from-state.decorator.js.map