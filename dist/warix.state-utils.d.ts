import { IWarixStateReducerResult } from './include';
export declare const isReducerResult: <X>(value: any) => value is IWarixStateReducerResult<X>;
export declare const ensureArray: (v: string | string[]) => string[];
export declare const combinePaths: (a: string | string[], b: string | string[]) => string[];
export declare const resolvePath: (path: string[]) => string[];
