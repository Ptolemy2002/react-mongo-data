# React Mongo Data
This library contains a class that was originally written to interact with a MongoDB api with React. You can load data into an instance and provide it as context. Then, consumers can access the data, modify it, and send server requests as needed. You are able to specify that you want to render only when certain properties change. This is achieved through my other library, [react-proxy-context](https://www.npmjs.com/package/@ptolemy2002/react-proxy-context).

Once the instance is created, it supports data validation, tracking of previous states, and loading. When a request is started, a promise is returned, but you may choose to ignore this and access the request variables that will tell you the status. The class also automatically creates an `AbortController` to allow cancellation at any time.

It is not recommended to use the class itself, but to create a subclass that registers all necessary properties on instantiation and defines a `create` static method for construction. [This](https://github.com/Ptolemy2002/react-mongo-data/blob/master/src/data/TestData.tsx) is an example of implementation.

Methods and properties beginning with an underscore are effectively private and thus not documented here.

The class is exported as default, so you can import it in one of the following ways:
```javascript
// ES6
import MongoData from '@ptolemy2002/react-mongo-data';
// CommonJS
const MongoData = require('@ptolemy2002/react-mongo-data');
```

## Type Reference
```typescript
import { ReactNode, MutableRefObject, MemoExoticComponent, FunctionComponent } from "react";
import { HookResultData } from "@ptolemy2002/react-hook-result";
import {
    Dependency, OnChangePropCallback, OnChangeReinitCallback,
    ProxyContext,
} from "@ptolemy2002/react-proxy-context";
import { MaybePromise, MaybeTransformer, PartialBy, ValueOf, ValueCondition, OptionalValueCondition } from "@ptolemy2002/ts-utils";

type SupportedMongoValue = (
    string | number | boolean | null | SupportedMongoValue[]
    | { [key: string]: SupportedMongoValue }
);

type SupportedDataValue = Exclude<
        SupportedMongoValue, any[] | { [key: string]: SupportedMongoValue }
    > | Date | SupportedDataValue[] | Set<SupportedDataValue> | { [key: string]: SupportedDataValue }
;

type Checkpoint<T> = {
    type: string,
    data: T
};

type CheckpointIndexOptions = { start?: number | null, includeCurrent?: boolean };
type CheckpointCountOptions = { max?: number, min?: number };

type DataTypeRecord = Record<string, SupportedDataValue>;
type MongoTypeRecord = Record<string, SupportedMongoValue>;
type RequestRecord = Record<string, (...args: any[]) => Promise<any>>;

type Property<
    DataType extends DataTypeRecord,
    MongoType extends MongoTypeRecord,
    Name extends Extract<keyof DataType, string> = Extract<keyof DataType, string>,
    MongoName extends Extract<keyof MongoType, string> = Extract<keyof MongoType, string>
> = {
    name: Name,
    mongoName: MongoName,
    current: DataType[Name],
    fromMongo: (value: MongoType[MongoName]) => DataType[Name],
    toMongo: (value: DataType[Name]) => MongoType[MongoName],
    initial: DataType[Name],
    get: (current: DataType[Name]) => DataType[Name],
    set: (value: DataType[Name]) => DataType[Name],
    readOnly: boolean,
    equals: (a: DataType[Name], b: DataType[Name]) => boolean,
    validate: (value: DataType[Name]) => boolean | string | string[]
};

type Request<
    Requests extends RequestRecord,
    Id extends Extract<keyof Requests, string> = Extract<keyof Requests, string>
> =
    Requests[Id] extends ((...args: any[]) => Promise<infer ReturnType>) ? {
        id: Id,
        undoOnFail: boolean,
        run: (ac: AbortController, ...args: Parameters<Requests[Id]>) => MaybePromise<ReturnType>,
        pre: (ac: AbortController, ...args: Parameters<Requests[Id]>) => MaybePromise<void>,
        post:
            (
                ac: AbortController,
                result: ReturnType,
                ...args: Parameters<Requests[Id]>
            ) => MaybePromise<void>
    } : never
;

type RequestTypeCondition<Requests extends RequestRecord> = ValueCondition<Extract<keyof Requests, string>>;

type Difference = {
    $set?: { [key: string]: SupportedMongoValue },
    $unset?: { [key: string]: "" },
    $push?: { [key: string]: { $each: SupportedMongoValue[] } },
    $pullAll?: { [key: string]: { $in: SupportedMongoValue[] } }
};

type MongoDataProviderProps<
    MT extends MongoTypeRecord,
    MD extends MongoData<any, MT, any>,
> = {
    children: ReactNode,
    value: MD | Partial<MT> | null,
    proxyRef?: MutableRefObject<MD | null>,
    onChangeProp?: OnChangePropCallback<MD | null>,
    onChangeReinit?: OnChangeReinitCallback<MD | null>,
    renderDeps?: any[]
};

type CompletedMongoData<
    DataType extends DataTypeRecord,
    MongoType extends MongoTypeRecord,
    Requests extends RequestRecord
> = MongoData<DataType, MongoType, Requests> & DataType & Requests;
```

## Classes
The following classes are available in the library:

### MongoData<DataType extends DataTypeRecord, MongoType extends MongoTypeRecord, Requests extends RequestRecord>
#### Description
This is the class that is provided by the library. It contains methods to interact with a MongoDB api and manage the data that is loaded. `DataType` is a type containing all custom properties (that depend on mongo in some form) that you want to define for the instance. `MongoType` is a type containing all properties that will be stored in the MongoDB database. `Requests` is a type containing all request types that you want to define for the instance.

#### Static Properties
- `_defaultDependencies` (`(keyof MongoData<any, any, any>)[]`) - An array containing the default dependencies for a component consuming an instance of this class as context. The default is `["requestInProgress", "requestFailed", "requestAborted", "requestError", "checkpointIndex"]`. It is heavily recommended to define in your subclass a static `defaultDependencies` property of type `Dependency<CompletedCustomData>[]` that extends this one and adds any additional dependencies that should be included.

#### Member Properties
- `lastRequest` (`Extract<keyof Requests, string> | null`) - The type of the last (or current) request that has been made by the instance.
- `requestInProgress` (`boolean`) - `true` if a request is currently in progress, `false` otherwise.
- `requestFailed` (`boolean`) - `true` if the last request failed, `false` otherwise.
- `requestAborted` (`boolean`) - `true` if the last request was aborted, `false` otherwise.
- `requestError` (`any`) - The error that was thrown by the last request, or `null` if no error was thrown, the request is still in progress, or no request has been made yet.
- `requestPromise` (`Promise<ReturnType<ValueOf<Requests>>> | null`) - The promise of the currently running request, or `null` if no request is in progress.
- `abortController` (`AbortController | null`) - The `AbortController` instance that is used to cancel the current request, or `null` if no request is in progress.
- `checkpoints` (`Checkpoint<MongoType>[]`) - An array of the previous states that have been saved with checkpoints.
- `checkpointIndex` (`number`) - The index of the current state in the `checkpoints` array. Used to help with the `undo` and `redo` methods. If you attempt to set this to a value outside the bounds of the array, a `RangeError` is thrown.
- `properties` (`Property<DataType, MongoType>[]`) - An array containing information on each property that has been defined for this instance.
- `requestTypes` (`Request<Requests>[]`) - An array containing information on each request type that has been defined for this instance.

In addition, every time a property or requestType is defined, an object property is created that you can get and set just like any other property. For example, you can access the `name` property by using `instance.name` if defined.

#### Static Methods
- `_useContext<<DataType extends DataTypeRecord, MongoType extends MongoTypeRecord, Requests extends RequestRecord, MD extends CompletedMongoData<DataType, MongoType, Requests> = CompletedMongoData<DataType, MongoType, Requests>>` - A hook that consumes the context specified via [react-proxy-context](https://www.npmjs.com/package/@ptolemy2002/react-proxy-context).
    - Arguments:
        - `context` (`ProxyContext<MD | null>`) - The context to consume.
        - `dataClass` (`new () => MD`) - The class to use for the data.
        - `deps` (`Dependency<MD>[] | null`) - An array of dependencies to listen to, passed directly to `useProxyContext`. By default, this is `MongoData._defaultDependencies`.
        - `onChangeProp?` (`OnChangePropCallback<MD | null>`) - The `onChangeProp` callback to pass to `useProxyContext`.
        - `onChangeReinit?` (`OnChangeReinitCallback<MD | null>`) - The `onChangeReinit` callback to pass to `useProxyContext`.
        - `listenReinit?` (`boolean`) - Whether to listen to full reassignments of the context and re-render when they occur. Default is `true`.
    - Returns: `HookResultData<{data: MD | null, set: (value: MD | Partial<MongoType> | null) => void}, readonly [MD | null, (value: MD | Partial<MongoType> | null) => void]>` - The result of the hook, containing the data and set function. The set function can be used to update the context with a new instance, `null`, or a partial object that will be merged with the default values of a new instance.
- `_useContextNonNullable` - Variant of `useContext` that explicitly checks for a null value and throws an error if one is found.
    - Arguments: Same as `_useContext`
    - Returns: `HookResultData<{data: MD, set: (value: MD | Partial<MongoType> | null) => MD | null}, readonly [MD, (value: MD | Partial<MongoType>) => MD | null]>` - The result of the hook, containing the data and set function. The set function can be used to update the context with a new instance or a partial object that will be merged with the default values of a new instance.
- `createProvider<DataType extends DataTypeRecord, MongoType extends MongoTypeRecord, Requests extends RequestRecord, MD extends CompletedMongoData<DataType, MongoType, Requests> = CompletedMongoData<DataType, MongoType, Requests>>` - Creates a provider component that provides an instance of the `MongoData` class to its children via [react-proxy-context](https://www.npmjs.com/package/@ptolemy2002/react-proxy-context).
    - Arguments:
        - `contextClass` (`ProxyContext<MD | null>`) - The class to use for the context.
        - `dataClass` (`new () => MD`) - The class to use for the data.
    - Returns: `MemoExoticComponent<FunctionComponent<MongoDataProviderProps<MongoType, MD>>>` - The provider component.  Documentation for the props can be found in [react-proxy-context](https://www.npmjs.com/package/@ptolemy2002/react-proxy-context).
- `comparePropertyValues<T extends SupportedDataValue>` - Compares two values and returns `true` if they are considered equal, `false` otherwise. This is used by the `equals` property of the `Property` class.
    - Arguments:
        - `a` (`T`): The first value to compare.
        - `b` (`T`): The second value to compare.
    - Returns:
        - Boolean - `true` if the values are considered equal, `false` otherwise.

#### Member Methods
- `defineProperty<DK extends Extract<keyof DataType, string>, MK extends Extract<keyof MongoType, string>>` - Defines a property to be included within the JSON representation of the object. If the property is already defined or the name conflicts with an existing variable, an `Error` is thrown. After the property is defined, it can be accessed and modified like any other property.
    - Arguments:
        - `name` (`DK`): The name of the property. This is what you will use to access the property on the instance.
        - `args` (`Omit<PartialBy<Omit<Property<DataType, MongoType, DK, MK>, "name">, "get" | "set" | "equals" | "validate" | "readOnly">, "current">`): Additional arguments
            - `mongoName` (`MK`): The name of the property in the MongoDB database. This is what the key will be in the JSON representation of the object.
            - `fromMongo` (`(value: MongoType[MongoName]) => DataType[Name]`): A function that will be used to convert the properties value from its JSON representation to the value that will be stored in the instance.
            - `toMongo` (`(value: DataType[Name]) => MongoType[MongoName]`): A function that will be used to convert the properties value from the value that is stored in the instance to its JSON representation.
            - `initial` (`DataType[Name]`): The initial value of the property.
            - `get?` (`(current: DataType[Name]) => DataType[Name]`): A function that will be used to get the value of the property. If not provided, the value will be returned as is.
            - `set?` (`(value: DataType[Name]) => DataType[Name]`): A function that will be used to set the value of the property. If not provided, the value will be set as is.
            - `readOnly?` (`boolean`): If `true`, the property will be read-only. If you attempt to set the value of the property, an `Error` will be thrown. If not provided, the property will be read-write. Defaults to `false`.
            - `equals?` (`(a: DataType[Name], b: DataType[Name]) => boolean`): A function that will be used to compare the values of the property. If not provided, the values will be compared using the `comparePropertyValues` static method.
            - `validate` (`(value: DataType[Name]) => boolean | string | string[]`): A function that will be used to validate the value of the property. If not provided, the value will always be considered valid after verifying the type. The function takes one argument, the value to be validated, and returns `true` if the value is valid, `false` if it is not and there is no error message, a `string` if it is not and there is an error message, or a `string[]` if there are multiple error messages. By default, this always returns `true`.
    - Returns: The same instance you called the method on.
- `removeProperty` - Removes a property from the instance. If the property is not defined or conflicts with an existing variable, an `Error` is thrown.
    - Arguments:
        - `name` (`Extract<keyof DataType, string>`): The name of the property to be removed.
    - Returns: The same instance you called the method on.
- `updateProp<K extends Extract<keyof DataType, string>>` - Updates the value of a property. This is necessary with dates, lists, sets, and objects, because it will clone them, allowing the `ProxyContext` system to detect changes. Throws an `Error` if the property is not defined or is read-only while the `setReadOnly` flag is `false`.
    - Arguments:
        - `name` (`K`): The name of the property to be updated.
        - `value` (`MaybeTransformer<DataType[K], [DataType[K]]> | ((value: DataType[K]) => void)`): Either the value to set or a function that will be used to update the value of the property. The function takes one argument, the cloned value of the property, and returns the updated value. If this function returns `undefined`, the value will simply be set to the clone, therefore you can use mutations to update in place insread of returning a new object if you wish. Nested clonable values are also cloned during this operation.
        - `setReadOnly` (`boolean`): If `true`, the property will be set, even if it is read-only. If `false`, an `Error` will be thrown if the property is read-only. Defaults to `false`.
    - Returns: (`DataType[K]`) The updated value of the property.
- `dataNameFromMongo` - Returns the name of the property in the instance that corresponds to the specified name in the MongoDB database.
    - Arguments:
        - `name` (`Extract<keyof MongoType, string>`): The name of the property in the MongoDB database.
    - Returns:
        - `Extract<keyof DataType, string>` - The name of the property in the instance that corresponds to the specified name in the MongoDB database.
- `isDirty` - Returns `true` if any of the defined properties have been changed since the last checkpoint of the specified type, `false` otherwise. If the checkpoint is not found, the function will return `true`.
    - Arguments:
        - `type` (`OptionalValueCondition<string>`): The type of checkpoint to compare against. If `null`, the last checkpoint will be used. The search will start from the current checkpoint. By default, this is `null`.
    - Returns:
        - `boolean` - `true` if any of the defined properties have been changed since the last checkpoint of the specified type, `false` otherwise. If the checkpoint is not found, the function will return `true`.
- `toJSON` - Returns an object that represents the instance in JSON format. This will include all properties that have been defined and their values, converted with the `toMongo` functions. The values will be cloned, so you don't have to do that yourself.
    - Arguments: None
    - Returns:
        - `MongoType` - An object that represents the instance in JSON format.
- `fromJSON` - Takes an object that represents the instance in JSON format and sets the properties of the instance to the values in the object. This will include all properties that have been defined and their values, converted with the `fromMongo` functions. If a property is not defined in the provided `data` it will remain unchanged. Throws an `Error` if a property is read-only while the `setReadOnly` flag is `false`.
    - Arguments:
        - `data` (`Partial<MongoType>`): An object that represents part or all of the instance in JSON format.
        - `setReadOnly` (`boolean`): If `true`, the properties will be set, even if they are read-only. If `false`, an `Error` will be thrown if a property is read-only. Defaults to `false`.
    - Returns: The same instance you called the method on.
- `jsonEquals` - Takes an object that represents the instance in JSON format and returns `true` if the values of the properties are considered equal, `false` otherwise. This will include all properties that have been defined and their values, converted with the `fromMongo` functions if they exist. If a property is not defined in the provided `data` it will be ignored.
    - Arguments:
        - `data` (`Partial<MongoType>`): An object that represents part or all of the instance in JSON format.
    - Returns:
        - `boolean` - `true` if the values of the properties are considered equal, `false` otherwise.
- `difference` - Calculates the difference between the current state of the instance and the state it was at the last checkpoint of the specified type or the state represented by the `previous` argument if specified. The return value is formatted to be provided directly to MongoDB's `update` method to update the document.
    - Arguments:
        - `args` (Object): An object containing the arguments
            - `type?` (`OptionalValueCondition<string>`): The type of checkpoint to compare against. If `null`, the last checkpoint will be used. The search will start from the current checkpoint. By default, this is `null`.
            - `previous?` (`MongoType | null`): An object that represents the instance in JSON format. If provided, the difference will be calculated between the current state of the instance and the state represented by this object and the `type` argument will be ignored. By default, this is `null`.
    - Returns:
        - `Difference` - An object that represents the difference between the current state of the instance and the state it was at the last checkpoint of the specified type or the state represented by the `previous` argument if specified.
            - May have any of the following keys (if any of these are not applicable, they will not be included):
                - `$set` - An object containing the properties that have been set since the last checkpoint.
                - `$unset` - An object with keys that represent the properties that have been unset since the last checkpoint. This is not an array even though the values don't matter, as MongoDB requires it to be an object.
                - `$push` - An object containing the properties that have had values pushed to them since the last checkpoint. The values are arrays of the values that have been pushed. Only `Set` properties are applicable to this.
                - `$pullAll` - An object containing the properties that have had values removed from them since the last checkpoint. The values are arrays of the values that have been removed. Only `Set` properties are applicable to this.
- `currentCheckpoint` - Returns the checkpoint that the current instance is on.
    - Arguments: None
    - Returns:
        - `Checkpoint<MongoType> | null` - The checkpoint that the current instance is on, or `null` if no checkpoints exist.
- `lastCheckpointIndex` - Returns the index of the last checkpoint of the specified type or the last checkpoint if the type is not provided.
    - Arguments:
        - `type` (`OptionalValueCondition<string>`): The type of checkpoint to find the index of. If `null`, the last checkpoint will be used. By default, this is `null`.
        - `args` (`CheckpointIndexOptions`): Additional arguments
            - `start` (`number`): The index to start searching from. If not provided, the search will start from the last checkpoint.
            - `includeCurrent` (`boolean`): If `true` and `start` is not provided, the search will include the current checkpoint. Otherwise, the search will start from the checkpoint before the current one.
    - Returns:
        - Number - The index of the last checkpoint of the specified type or the last checkpoint if the type is not provided. `-1` is returned if no checkpoint of the specified type is found.
- `nextCheckpointIndex` - Returns the index of the next checkpoint of the specified type or the next checkpoint if the type is not provided.
    - Arguments:
        - `type` (`OptionalValueCondition<string>`): The type of checkpoint to find the index of. If `null`, the next checkpoint will be used. By default, this is `null`.
        - `args` (Object): Additional arguments
            - `start` (`number`): The index to start searching from. If not provided, the search will start from the current checkpoint.
            - `includeCurrent` (`boolean`): If `true` and `start` is not provided, the search will include the current checkpoint. Otherwise, the search will start from the checkpoint after the current one.
    - Returns:
        - `number` - The index of the next checkpoint of the specified type or just the next checkpoint if the type is not provided. `-1` is returned if no checkpoint of the specified type is found.
- `lastCheckpoint` - Like `lastCheckpointIndex`, but returns the actual checkpoint object or `null` if not found.
- `nextCheckpoint` - Like `nextCheckpointIndex`, but returns the actual checkpoint object or `null` if not found.
- `countCheckpoints` - Returns the number of checkpoints of the specified type in the specified range.
    - Arguments:
        - `type` (`OptionalValueCondition<string>`): The type of checkpoint to count. If `null`, all checkpoints will be counted.
        - `args` (`CheckpointCountOptions`): Additional arguments
            - `min` (`number`): The minimum index to count from. If not provided, the count will start from the first checkpoint.
            - `max` (`number`): The maximum index to count to. If not provided, the count will go to the last checkpoint.
    - Returns:
        - `number` - The number of checkpoints of the specified type in the specified range.
- `undo` - Restores the instance to the state it was at the last checkpoint of the specified type. This will also add a checkpoint of type "undo" with the current state of the object so that you can perform a redo correctly.
    - Arguments:
        - `steps` (`number`): The number of steps to undo. If not provided, the instance will be restored to the last checkpoint of the specified type. If the type is not provided, the instance will be restored to the last checkpoint. The function will stop early and throw an `Error` if it reaches the beginning of the history.
        - `type` (`OptionalValueCondition<string>`): The type of checkpoint to restore the instance to. If `null`, the last checkpoint will be used. By default, this is `null`.
    - Returns: The same instance you called the method on.
- `redo` - Restores the instance to the state it is at the next checkpoint of the specified type. This only applies if the `stateIndex` is currently less than the index of the last checkpoint of the specified type.
    - Arguments:
        - `steps` (`number`): The number of steps to redo. If not provided, the instance will be restored to the next checkpoint of the specified type. If the type is not provided, the instance will be restored to the next checkpoint. The function will stop early and throw an `Error` if it reaches the end of the history.
        - `type` (`OptionalValueCondition<string>`): The type of checkpoint to restore the instance to. If `null`, the next checkpoint will be used. By default, this is `null`.
    - Returns: The same instance you called the method on.
- `revert` - Shortcut for `undo(1, type)`
    - Arguments:
        - `type` (`OptionalValueCondition<string>`): The type of checkpoint to restore the instance to. If `null`, the last checkpoint will be used. By default, this is `null`.
    - Returns: The same instance you called the method on.
- `checkpoint` - Creates a checkpoint of the specified type. The checkpoint will have the current state of the instance stored in it.
    - Arguments:
        - `type` (`string`): The type of checkpoint to create. By default, this is `manual`.
    - Returns: The same instance you called the method on.
- `removeCheckpoint` - Removes the checkpoint at the specified index, adjusting the `checkpointIndex` if necessary. If the index is out of bounds, a `RangeError` is thrown. If the checkpoint removed is the current checkpoint, the `checkpointIndex` will refer to the checkpoint immediately after it, or the last available checkpoint if it was the last checkpoint. If the removal results in an empty history, the `checkpointIndex` will be set to `0`.
    - Arguments:
        - `index` (`number`): The index of the checkpoint to remove.
    - Returns: The same instance you called the method on.
- `clone` - Returns a new instance of the same class with the same properties and values. The new instance will have one `initial` checkpoint. It is recommended to override this method in a subclass to ensure that the new instance is of the correct type.
    - Arguments: None
    - Returns: A new instance of the same class with the same properties and values.
- `defineRequestType<<Id extends Extract<keyof Requests, string>>` - Defines a request type to be used with the instance. If the request type is already defined or the name conflicts with an existing variable, an `Error` is thrown. When you set the gnerated property, that value will override the `run` function.
    - Arguments:
        - `id` (`Id`): The id of the request type. This is what you will use to access the request type on the instance.
        - `run` (`Request<Requests, Id>["run"]`): A function that will be used to run the request. The function can take any number of arguments, but the first argument will always be an `AbortController` instance for use with handling cancellation.
        - `args` (`Partial<Pick<Request<Requests, Id>, "pre" | "post" | "undoOnFail">>`): Additional arguments
            - `pre` (`(ac: AbortController, ...args: Parameters<Requests[Id]>) => MaybePromise<void>`): A function that will be run before the request is made. The function can take any number of arguments, but the first argument will always be an `AbortController` instance for use with handling cancellation.
            - `post` (`(ac: AbortController, result: ReturnType, ...args: Parameters<Requests[Id]>) => MaybePromise<void>`): A function that will be run after the request is made. The function can take any number of arguments, but the first argument will always be an `AbortController` instance for use with handling cancellation.
    - Returns: The same instance you called the method on.
- `removeRequestType` - Removes a request type from the instance. If the request type is not defined or conflicts with an existing variable, an `Error` is thrown.
    - Arguments:
        - `id` (`Extract<keyof Requests, string>`): The id of the request type to be removed.
    - Returns: The same instance you called the method on.
- `request<K extends Extract<keyof Requests, string>>` - Allows you to manually run the request with the specified id instead of directly calling the generated property's value. Throws an `Error` if the request type is not defined, or if a request is already in progress. If the request fails, any changes to the instance made during that request will be reverted. This can be prevented by setting the `undoOnFail` property of the request type to `false`.
    - Arguments:
        - `id` (`K`): The id of the request type to run.
        - `...args` (`Parameters<Requests[K]>`): The arguments to pass to the request type's `run` function. Note that one additional argument will always be provided, an `AbortController` instance for use with handling cancellation.
    - Returns (`Promise<ReturnType<Requests[K]>>`): A promise that will resolve when the request is complete or reject if the request fails.
- `hasLastRequest` - Returns `true` if the last request was of the specified type, `false` otherwise.
    - Arguments:
        - `type` (`RequestTypeCondition<Requests>`): The type of request to check for. If `null` or `undefined`, the function will return `true` if any last request exists.
    - Returns:
        - `boolean` - `true` if the last request was of the specified type, `false` otherwise.
- `hasInProgressRequest` - Returns `true` if a request is currently in progress and matches the specified type, `false` otherwise.
    - Arguments:
        - `type` (`RequestTypeCondition<Requests>`): The type of request to check for. If `null` or `undefined`, the function will return `true` if any request is currently in progress.
    - Returns:
        - `boolean` - `true` if a request is currently in progress and matches the specified type, `false` otherwise.
- `hasFailedRequest` - Returns `true` if the last request failed and matches the specified type, `false` otherwise.
    - Arguments:
        - `type` (`RequestTypeCondition<Requests>`): The type of request to check for. If `null` or `undefined`, the function will return `true` if any last request failed.
    - Returns:
        - `boolean` - `true` if the last request failed and matches the specified type, `false` otherwise.
- `hasSuccessfulRequest` - Returns `true` if the last request was successful and matches the specified type, `false` otherwise.
    - Arguments:
        - `type` (`RequestTypeCondition<Requests>`): The type of request to check for. If `null` or `undefined`, the function will return `true` if any last request was successful.
    - Returns:
        - `boolean` - `true` if the last request was successful and matches the specified type, `false` otherwise.
- `hasAbortedRequest` - Returns `true` if the last request was aborted and matches the specified type, `false` otherwise.
    - Arguments:
        - `type` (`RequestTypeCondition<Requests>`): The type of request to check for. If `null` or `undefined`, the function will return `true` if any last request was aborted.
    - Returns:
        - `boolean` - `true` if the last request was aborted and matches the specified type, `false` otherwise.
- `abortRequest` - Signals an abort for the current request of the specified type if it is in progress. Otherwise, does nothing. Note that this will only work correctly if you implement the `AbortController` provided to your request function.
    - Arguments:
        - `type` (`RequestTypeCondition<Requests>`): The type of request to abort. If `null` or `undefined`, the function will abort any request that is currently in progress.
    - Returns: The same instance you called the method on.

## Peer Dependencies
These should be installed in order to use the library, as npm does not automatically add peer dependencies to your project.
- `@ptolemy2002/js-utils^3.0.2`
- `@ptolemy2002/list-object-utils^3.0.0`
- `@ptolemy2002/react-hook-result^2.2.1`
- `@ptolemy2002/react-proxy-context^2.0.1`
- `@ptolemy2002/react-utils^3.0.0`
- `@ptolemy2002/ts-utils^2.0.0`
- `is-callable^1.2.7`
- `lodash.clonedeep^4.5.0`
- `react^18.3.1`
- `react-dom^18.3.1`

## Commands
The following commands exist in the project:

- `npm run uninstall` - Uninstalls all dependencies for the library
- `npm run reinstall` - Uninstalls and then Reinstalls all dependencies for the library
- `npm run example-uninstall` - Uninstalls all dependencies for the example app
- `npm run example-install` - Installs all dependencies for the example app
- `npm run example-reinstall` - Uninstalls and then Reinstalls all dependencies for the example app
- `npm run example-start` - Starts the example app after building the library
- `npm run build` - Builds the library
- `npm run release` - Publishes the library to npm without changing the version
- `npm run release-patch` - Publishes the library to npm with a patch version bump
- `npm run release-minor` - Publishes the library to npm with a minor version bump
- `npm run release-major` - Publishes the library to npm with a major version bump