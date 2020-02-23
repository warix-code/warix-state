# Warix State

Warix State is an immutable state manager that follows lossely the flux pattern, although very similar in concept with Redux, WarixState prefers
common actions with specific payloads instead of specific actions with common payloads.

Warix State uses RxJs at its core to dispatch, modify and monitor the data, with ImmutabeJS for data handling and ensure immutability.

## Usage

The contructor for a warix state takes an optional Map&lt;string, any&gt; or {} as it initial state, if none is specified, the state is initialized
with an empty Immutable map

```typescript
const state = new WarixState({ foo: { bar: 1 } });
```

Dispatching actions can be done by either the dispatch method

```typescript
state.dispatch('actionType', actionPayload);
state.dispatch({ type: '', payload: null });
```

Or by one of the shortcut methods:
* set
* setIn
* apply
* patch
* listPush
* listPop
* listShift
* listUnshift
* listSplice
* listInsert
* listRemoveAt
* listRemoveFind
* listSort
* listFilter

## Paths

Paths to properties are specified either by an string array or by a dot delimeted pathing
```typescript
state.setIn([ 'foo', 'bar' ], 0);
state.setIn('foo.bar', 0);
```

Path resolution is possible witht the following operands
* __~__ Moves the current path to the root
* __..__ Moves the path up one level
* __.__ Keeps the path in the current level

> Path resolution can only be performed when the path is specified as an array

## Custom Actions

Actions in WarixState are considered of 3 types

### PreProcessors

Transform dispatched actions into another actions, useful when creating specific actions that execute common actions.
If the purpose is to increase a property current value by 1, one way of achieving this is by dispatching an apply action that performs the operation:

```typescript
state.apply('foo.bar', (currentValue: number) => currentValue + 1);
```

Another approach is to register a PreProcessor action *increase* that transforms the action into the apply operation:
```typescript
const increasePreHandler = state.registerPreProcessor('increase', (state, action) => {
    return WarixStateActions.apply(action.payload.path, (currentValue: number) => currentValue + action.payload.value);
});
```

Afterwards the *increase* action can be called directly
```typescript
state.dispatch('increase', { path: 'foo.bar', value: 1 });
```

### Processors

In charge of reducing the dispatched actions into actual state modifications, theay are executed after all PreProcessors have been applied
to the dispatched actions

```typescript
const actionHandler = state.registerProcessor('action', (state, action) => {
    return state.setIn(action.payload.path, action.payload.value);
});
```

### AsyncProcessors

Async processors are not executed immediatley, instead they are excuted when a provided observable emits one of its lifecycle values.

* __START__ Executed when the processor is first subscribed to the observable
* __NEXT__ Executed when the observable emits a next value
* __ERROR__ Executed when the observable throws an error
* __COMPLETE__ Executed when the observable is completed

> Due to the nature of observables, async processors are allways subscribed with the take(1) RxJs operator

Async processors registrations dispatch actions modified by the state the subscription is currently at. Consider an async preprocessor *load*, its emitted action type would be as follows :
```typescript
{ type: 'load::START', payload: null }
{ type: 'load::NEXT', payload: emittedValue }
{ type: 'load::ERROR', payload: error }
{ type: 'load::COMPLETE', payload: null }
```

> PreProcessors and Processors must be registered taking into account the actionType modifiers

```typescript
const asyncLoadHandler = state.registerAsync('load', (state, action) => someObservable$);
```

### Processor Handlers

All processors registration return a handler to it that allows for control over it, allowing it to pause / resume or remove the processor.
See [Interfaces](https://github.com/warix-code/warix-state/blob/master/src/interfaces.ts) for specifics

## SubStates

Since almost all actions on WarixState depends on specific paths, a subHandler or proxy can be created that transforms all actions executed on it to be localized to a given path

```typescript
const proxy = state.subHandler('some.really.deep.path.in.the.state');
```

Proxys provide the same functionality as WarixState but removing the need of specifing full paths for actions, since all actions are created based on the path of the proxy
```typescript
proxy.setIn('prop', value);
// is equivalent to
state.setIn('some.really.deep.path.in.the.state.prop', value);
```

Use path resolution in the proxy if properties of the upper levels are required

```typescript
proxy.select([ '~', 'some', 'really'])
```

> Path resolution can only be performed when the path is specified as an array

Processor registrations on a proxy (PreProcessor, Processor or AsyncProcessor) although registered globally, will be removed once the
**complete** method is called in the Proxy

## Monitoring (Reactivity)

To monitor specific properties of the state use one of the selection methods
* __select__: Obtains an observable to the underlying value of a key in the state that will dispatch whenever the value changes
* __selectMap__: Obtains an observable to the underlying value of a key in the state that will dispatch whenever the value changes.
    If the value is a Map or a List, the value is flattened with its toJS method.
    Flattening a immutable object can be an expensive operation, use with caution.
* __on__: Obtains an observable that will emit whenever the specifed action type is dispatched in the state

## Reading

When reading a value from the state sync, use one of the peek methods
* __peek__: Obtains the underlying value of the state
* __peekKey__: Obtains the underlying value of a key in the state

## Decorators
Decorators provide an easier selection of properties to the state
* @Select : Selects an observable to the provided path from the owning object WarixState

* @SelectFlatten: Selects an observable to the provided path from the owning object WarixState, if the object is an immutable List or Map, the object is flatten
with the toJS method of the immutable object. Flattening an immutable object can be an expensive operation if the value changes constantly,
use with caution

* @FromState: Creates a get/set accesor to the provided path from the owning object WarixState or WarixStateProxy

```typescript
@FromState('user.name') public userName: string;
@Select('user') public userData$: Observable<Map<string, any>>;
@SelectFlatten('user') public userDataFlat: Observable<any>;
```

> As well as the *select* and *selectFlatten* methods of WarixState, @Select and @SelectFlatten decorators can provide a second argument of type IWarixSelectSettings to fine tune the resulting observable