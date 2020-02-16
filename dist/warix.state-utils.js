"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
exports.isReducerResult = (value) => {
    return value && lodash_1.isObject(value) && 'value' in value && 'stopPropagation' in value;
};
exports.ensureArray = (v) => lodash_1.isString(v) ? v.split('.') : v;
exports.combinePaths = (a, b) => [...exports.ensureArray(a), ...exports.ensureArray(b)];
exports.resolvePath = (path) => {
    const current = [];
    path.forEach(pp => {
        if (pp === '~') {
            current.length = 0;
        }
        else if (pp === '..') {
            current.pop();
        }
        else if (pp !== '.') {
            current.push(pp);
        }
    });
    return current;
};
//# sourceMappingURL=warix.state-utils.js.map