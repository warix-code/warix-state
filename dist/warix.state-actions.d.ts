import { Map } from 'immutable';
import { IWarixStateAction } from './include';
export declare const WarixStateActions: {
    set: (value: Map<string, any>) => IWarixStateAction;
    setIn: (path: string | string[], value: any) => IWarixStateAction;
    patch: (path: string | string[], value: any) => IWarixStateAction;
    apply: (path: string | string[], operation: (value: any) => any) => IWarixStateAction;
    listPush: (path: string | string[], items: any[]) => IWarixStateAction;
    listPop: (path: string | string[]) => IWarixStateAction;
    listShift: (path: string | string[]) => IWarixStateAction;
    listUnshift: (path: string | string[], items: any[]) => IWarixStateAction;
    listSplice: (path: string | string[], index: number, deleteCount?: number, items?: any[]) => IWarixStateAction;
    listSort: <T = any>(path: string | string[], compareFn?: (a: T, b: T) => number) => IWarixStateAction;
};
