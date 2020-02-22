import { isObject, isString } from 'lodash';
import { IWarixStateReducerResult } from './interfaces';

/**
 * Validates that a value matches IWarixStateReducerResult signature
 * @param value Test value
 */
export const isReducerResult = <X>(value: any): value is IWarixStateReducerResult<X> => {
    return value && isObject(value) && 'value' in value && 'stopPropagation' in value;
};

/**
 * Esures that the  provided value is an array
 */
export const ensureArray = (v: string | string[]) => isString(v) ? v.split('.') : v;

/**
 * Combines 2 path definitions
 */
export const combinePaths = (a: string | string[], b: string | string[]) => [ ...ensureArray(a), ...ensureArray(b) ];

/**
 * Evaluates a path definition where:
 * ~ re roots the path.
 * .. Ups one level in the path.
 * . Remains in the same level of the  path.
 */
export const resolvePath = (path: string[]) => {
    const current: string[] = [];
    path.forEach(pp => {
        if (pp === '~') {
            current.length = 0;
        } else if (pp === '..') {
            current.pop();
        } else if (pp !== '.') {
            current.push(pp);
        }
    });
    return current;
};

/**
 * Generates a new unique id in the format ####-####-####-####-########
 */
export const newGUID = () => {
    const fnRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min)) + min;
    const segments: string[] = [ new Date().getTime().toString(16) ];
    while (segments.length < 4) {
        segments.unshift(fnRandom(0x1111, 0xFFFF).toString(16));
    }
    return segments.join('-');
};
