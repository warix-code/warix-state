import { Map } from 'immutable';

export interface IWarixStateAction {
    type: string;
    payload: any;
}

export interface IWarixStateReducerResult<X> {
    value: X;
    stopPropagation: boolean;
}

export type WarixStateActionReducer = (state: Map<string, any>, action: IWarixStateAction) => IWarixStateAction | IWarixStateReducerResult<IWarixStateAction>;

export type WarixStateDataReducer = (state: Map<string, any>, action: IWarixStateAction) => Map<string, any> | IWarixStateReducerResult<Map<string, any>>;

export interface IWarixStateReducerEntry<X> {
    forType: string;
    paused: boolean;
    reducer(state: Map<string, any>, action: IWarixStateAction): X | IWarixStateReducerResult<X>;
}

export interface IWarixReducerHandler {
    readonly isPaused: boolean;
    pause(): IWarixReducerHandler;
    resume(): IWarixReducerHandler;
    remove(): void;
}

export interface IWarixStatePostAction {
    initialState: Map<string, any>;
    finalState: Map<string, any>;
    initialAction: IWarixStateAction;
    executedAction: IWarixStateAction;
}
