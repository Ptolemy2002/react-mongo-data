# React Mongo Data
This library contains a class that was originally written to interact with a MongoDB api with React. You can load data into an instance and provide it as context. Then, consumers can access the data, modify it, and send server requests as needed. You are able to specify that you want to render only when certain properties change. This is achieved through my other library, [react-proxy-context](https://www.npmjs.com/package/@ptolemy2002/react-proxy-context).

Once the instance is created, it supports data validation, tracking of previous states, and loading. When a request is started, a promise is returned, but you may choose to ignore this and access the request variables that will tell you the status. The class also automatically creates an `AbortController` to allow cancellation at any time.

It is not recommended to use the class itself, but to create a subclass that registers all necessary properties on instantiation and defines a `creatFromJSON` static method for construction. [This](https://github.com/Ptolemy2002/react-mongo-data/blob/master/example/src/data/TestData.jsx) is an example of implementation.

Methods and properties beginning with an underscore are effectively private and thus not documented here.

The class is exported as default, so you can import it in one of the following ways:
```
// ES6
import MongoData from '@ptolemy2002/react-mongo-data';
// CommonJS
const MongoData = require('@ptolemy2002/react-mongo-data');
```

## Classes
The following classes are available in the library:

### MongoData
#### Description
This is the class that is provided by the library. It contains methods to interact with a MongoDB api and manage the data that is loaded.

#### Static Properties
- `defaultDependencies` - An array containing the default dependencies for a component consuming an instance of this class as context. The default is `["requestInProgress", "requestFailed", "requestAborted", "requestError", "stateIndex"]`.

#### Member Properties
- `lastRequest` - The type of the last (or current) request that has been made by the instance. The valid request types are defined by what was defined using the `defineRequestType` method.
- `requestInProgress` - `true` if a request is currently in progress, `false` otherwise.
- `requestFailed` - `true` if the last request failed, `false` otherwise.
- `requestAborted` - `true` if the last request was aborted, `false` otherwise.
- `requestError` - The error that was thrown by the last request, or `null` if no error was thrown, the request is still in progress, or no request has been made yet.
- `requestPromise` - The promise of the currently running request, or `null` if no request is in progress.
- `abortController` - The `AbortController` instance that is used to cancel the current request, or `null` if no request is in progress.
- `previousStates` - An array of the previous states that have been saved with checkpoints.
- `stateIndex` - The index of the current state in the `previousStates` array. Used to help with the `undo` and `redo` methods. If you attempt to set this to a value outside the bounds of the array, a `RangeError` is thrown.
- `properties` - An object containing information on each property that has been defined for this instance. The keys are the names of each property.
- `requestTypes` - An object containing information on each request type that has been defined for this instance. The keys are the names of each request type.

In addition, every time a property or requestType is defined, an object property is created that you can get and set just like any other property. For example, you can access the `name` property by using `instance.name` if defined.

#### Static Methods
- `verifyPropertyType` - Taking a type and a value, this method returns `true` if the value is of the specified type, `false` otherwise.
    - Arguments:
        - `type` (String?): The type to be tested. The types that are supported are `string`, `number`, `boolean`, `object`, `list`, `set`, `date`, and `null`. If the type ends with `?`, the value can be `null` or `undefined` as well. If the type is `null` or `undefined`, it will be treated as an "any" type and the test will always return `true`.
        - `value` (Any): The value to be tested.
    - Returns:
        - Boolean - `true` if the value is of the specified type, `false` otherwise.
- `getType` - Taking a value, this method determines the type of it.
    - Arguments:
        - `value` (Any): The value to be tested.
    - Returns:
        - String - The type of the value. The types that are supported are `string`, `number`, `boolean`, `object`, `list`, `date`, and `null`. Note that this method never returns `set`, as this is merely an instruction for comparison and validation purposes. Sets are treated as lists.
- `comparePropertyValues` - Taking a type and two values, this method returns `true` if the values are considered equal, `false` otherwise.
    - Arguments:
        - `type` (String): The type to be tested. The types that are supported are `string`, `number`, `boolean`, `object`, `list`, `set`, `date`, and `null`. If the type ends with `?`, the value can be `null` or `undefined` as well. If the type is `null` or `undefined`, it will be treated as an "any" type and the test will be run based on the detected type of the first value (detected with the `getType` static method). Note that, if the type is `set`, the ordering of the values does not matter.
        - `a` (Any): The first value to be compared.
        - `b` (Any): The second value to be compared.
    - Returns:
        - Boolean - `true` if the values are considered equal, `false` otherwise.

#### Member Methods
- `defineProperty` - Defines a property to be included within the JSON representation of the object. If the property is already defined or the name conflicts with an existing variable, an `Error` is thrown. After the property is defined, it can be accessed and modified like any other property.
    - Arguments:
        - `name` (String): The name of the property. This is what you will use to access the property on the instance.
        - `args` (Object): Additional arguments
            - `mongoName` (String): The name of the property in the MongoDB database. This is what the key will be in the JSON representation of the object. If not provided, the `name` argument will be used.
            - `type` (String): The type of the property. The types that are supported are `string`, `number`, `boolean`, `object`, `list`, `set`, `date`, and `null`. If the type ends with `?`, the value can be `null` or `undefined` as well. If the type is unspecified, `null`, or `undefined`, it will be treated as an "any" type.
            - `fromMongo` (Function): A function that will be used to convert the properties value from its JSON representation to the value that will be stored in the instance. If not provided, the value will be stored as is (except for `date` types, which will be converted to `Date` objects from strings). The function takes only one argument, the value to be converted, and returns the converted value.
            - `toMongo` (Function): A function that will be used to convert the properties value from the value that is stored in the instance to its JSON representation. If not provided, the value will be stored as is. The function takes only one argument, the value to be converted, and returns the converted value.
            - `initial` (Any): The initial value of the property. If not provided, the value will be `null`.
            - `get` (Function): A function that will be used to get the value of the property. If not provided, the value will be returned as is. The function takes no arguments and returns the value of the property.
            - `set` (Function): A function that will be used to set the value of the property. If not provided, the value will be set as is. The function takes one argument, the value to be set, and returns the value that will be stored in the instance.
            - `readOnly` (Boolean): If `true`, the property will be read-only. If you attempt to set the value of the property, an `Error` will be thrown. If not provided, the property will be read-write.
            - `equals` (Function): A function that will be used to compare the values of the property. If not provided, the values will be compared using the `comparePropertyValues` static method. The function takes two arguments, the current value of the property and the value to be compared, and returns `true` if the values are considered equal, `false` otherwise.
            - `validate` (Function): A function that will be used to validate the value of the property. If not provided, the value will always be considered valid after verifying the type. The function takes one argument, the value to be validated, and returns `true` if the value is valid, `false` otherwise.
    - Returns: The same instance you called the method on.
- `removeProperty` - Removes a property from the instance. If the property is not defined or conflicts with an existing variable, an `Error` is thrown.
    - Arguments:
        - `name` (String): The name of the property to be removed.
    - Returns: The same instance you called the method on.
- `updateProperty` - Updates the value of a property. This is necessary with dates, lists, sets, and objects, because it will clone them, allowing the `ProxyContext` system to detect changes. Throws an `Error` if the property is not defined or is read-only while the `setReadOnly` flag is `false`.
    - Arguments:
        - `name` (String): The name of the property to be updated.
        - `callback` (Function): A function that will be used to update the value of the property. The function takes one argument, the cloned value of the property, and returns the updated value. If this function returns `undefined`, the value will simply be set to the clone, therefore you can use mutations to update in place insread of returning a new object if you wish.
        - `setReadOnly` (Boolean): If `true`, the property will be set, even if it is read-only. If `false`, an `Error` will be thrown if the property is read-only. Defaults to `false`.
    - Returns: The updated value of the property.
- `propertyNameFromMongo` - Returns the name of the property in the instance that corresponds to the specified name in the MongoDB database.
    - Arguments:
        - `mongoName` (String): The name of the property in the MongoDB database.
    - Returns:
        - String - The name of the property in the instance that corresponds to the specified name in the MongoDB database.
- `isDirty` - Returns `true` if any of the defined properties have been changed since the last checkpoint of the specified type, `false` otherwise. If the checkpoint is not found, the function will return `true`.
    - Arguments:
        - `type` (String | String[] | null): The type of checkpoint to compare against. If `null`, the last checkpoint will be used. If the type is an array, the last checkpoint of any of the specified types will be used. The search will start from the current checkpoint.
    - Returns:
        - Boolean - `true` if any of the defined properties have been changed since the last checkpoint of the specified type, `false` otherwise. If the checkpoint is not found, the function will return `true`.
- `toJSON` - Returns an object that represents the instance in JSON format. This will include all properties that have been defined and their values, converted with the `toMongo` functions if they exist.
    - Arguments: None
    - Returns:
        - Object - An object that represents the instance in JSON format.
- `fromJSON` - Takes an object that represents the instance in JSON format and sets the properties of the instance to the values in the object. This will include all properties that have been defined and their values, converted with the `fromMongo` functions if they exist. If a property is not defined in the provided `data` it will remain unchanged. Throws an `Error` if a property is read-only while the `setReadOnly` flag is `false`.
    - Arguments:
        - `data` (Object): An object that represents the instance in JSON format.
        - `setReadOnly` (Boolean): If `true`, the properties will be set, even if they are read-only. If `false`, an `Error` will be thrown if a property is read-only. Defaults to `false`.
    - Returns: The same instance you called the method on.
- `jsonEquals` - Takes an object that represents the instance in JSON format and returns `true` if the values of the properties are considered equal, `false` otherwise. This will include all properties that have been defined and their values, converted with the `fromMongo` functions if they exist. If a property is not defined in the provided `data` it will be ignored.
    - Arguments:
        - `data` (Object): An object that represents the instance in JSON format.
    - Returns:
        - Boolean - `true` if the values of the properties are considered equal, `false` otherwise.
- `difference` - Calculates the difference between the current state of the instance and the state it was at the last checkpoint of the specified type or the state represented by the `previous` argument if specified. The return value is formatted to be provided directly to MongoDB's `update` method to update the document.
    - Arguments:
        - `args` (Object): An object containing the arguments
            - `type` (String | String[] | null): The type of checkpoint to compare against. If `null`, the last checkpoint will be used. If the type is an array, the last checkpoint of any of the specified types will be used. The search will start from the current checkpoint.
            - `previous` (Object): An object that represents the instance in JSON format. If provided, the difference will be calculated between the current state of the instance and the state represented by this object and the `type` argument will be ignored.
    - Returns:
        - Object - An object that represents the difference between the current state of the instance and the state it was at the last checkpoint of the specified type or the state represented by the `previous` argument if specified.
            - May have any of the following keys (if any of these are not applicable, they will not be included):
                - `$set` - An object containing the properties that have been set since the last checkpoint.
                - `$unset` - An object with keys that represent the properties that have been unset since the last checkpoint. This is not an array even though the values don't matter, as MongoDB requires it to be an object.
                - `$push` - An object containing the properties that have had values pushed to them since the last checkpoint. The values are arrays of the values that have been pushed. Only `set` properties are applicable to this.
                - `$pullAll` - An object containing the properties that have had values removed from them since the last checkpoint. The values are arrays of the values that have been removed. Only `set` properties are applicable to this.
- `currentCheckpoint` - Returns the checkpoint that the current instance is on.
    - Arguments: None
    - Returns:
        - Object - An object that represents a checkpoint.
            - `type` (String): The type of the checkpoint.
            - `data` (Object): An object that represents the instance in JSON format.
- `checkpointTypeMatches` - Returns `true` if the checkpoint provided matches the type provided, `false` otherwise.
    - Arguments:
        - `checkpoint` (Object): An object that represents a checkpoint.
        - `type` (String | String[] | null): The type to compare the checkpoint to. If null, any type will match. If the type is an array, the function will return `true` if the checkpoint matches any of the types in the array.
    - Returns:
        - Boolean - `true` if the checkpoint provided matches the type provided, `false` otherwise.
- `lastCheckpointIndex` - Returns the index of the last checkpoint of the specified type or the last checkpoint if the type is not provided.
    - Arguments:
        - `type` (String | String[] | null): The type of checkpoint to find the index of. If `null`, the last checkpoint will be used. If the type is an array, the last checkpoint of any of the specified types will be used.
        - `args` (Object): Additional arguments
            - `start` (Number): The index to start searching from. If not provided, the search will start from the last checkpoint.
            - `includeCurrent` (Boolean): If `true` and `start` is not provided, the search will include the current checkpoint. Otherwise, the search will start from the checkpoint before the current one.
    - Returns:
        - Number - The index of the last checkpoint of the specified type or the last checkpoint if the type is not provided. `-1` is returned if no checkpoint of the specified type is found.
- `nextCheckpointIndex` - Returns the index of the next checkpoint of the specified type or the next checkpoint if the type is not provided.
    - Arguments:
        - `type` (String | String[] | null): The type of checkpoint to find the index of. If `null`, the next checkpoint will be used. If the type is an array, the next checkpoint of any of the specified types will be used.
        - `args` (Object): Additional arguments
            - `start` (Number): The index to start searching from. If not provided, the search will start from the last checkpoint.
            - `includeCurrent` (Boolean): If `true` and `start` is not provided, the search will include the current checkpoint. Otherwise, the search will start from the checkpoint after the current one.
    - Returns:
        - Number - The index of the next checkpoint of the specified type or just the next checkpoint if the type is not provided. `-1` is returned if no checkpoint of the specified type is found.
- `lastCheckpoint` - Like `lastCheckpointIndex`, but returns the actual checkpoint object or `null` if not found.
- `nextCheckpoint` - Like `nextCheckpointIndex`, but returns the actual checkpoint object or `null` if not found.
- `countCheckpoints` - Returns the number of checkpoints of the specified type in the specified range.
    - Arguments:
        - `type` (String | String[] | null): The type of checkpoint to count. If `null`, all checkpoints will be counted. If the type is an array, the function will count the checkpoints of any of the specified types.
        - `args` (Object): Additional arguments
            - `min` (Number): The minimum index to count from. If not provided, the count will start from the first checkpoint.
            - `max` (Number): The maximum index to count to. If not provided, the count will go to the last checkpoint.
    - Returns:
        - Number - The number of checkpoints of the specified type in the specified range.
- `undo` - Restores the instance to the state it was at the last checkpoint of the specified type. This will also add a checkpoint of type "undo" with the current state of the object so that you can perform a redo correctly.
    - Arguments:
        - `steps` (Number): The number of steps to undo. If not provided, the instance will be restored to the last checkpoint of the specified type. If the type is not provided, the instance will be restored to the last checkpoint. The function will stop early if it reaches the beginning of the history.
        - `type` (String | String[] | null): The type of checkpoint to restore the instance to. If `null`, the last checkpoint will be used. If the type is an array, the last checkpoint of any of the specified types will be used.
    - Returns: The same instance you called the method on.
- `redo` - Restores the instance to the state it is at the next checkpoint of the specified type. This only applies if the `stateIndex` is currently less than the index of the last checkpoint of the specified type.
    - Arguments:
        - `steps` (Number): The number of steps to redo. If not provided, the instance will be restored to the next checkpoint of the specified type. If the type is not provided, the instance will be restored to the next checkpoint. The function will stop early if it reaches the end of the history.
        - `type` (String | String[] | null): The type of checkpoint to restore the instance to. If `null`, the last checkpoint will be used. If the type is an array, the last checkpoint of any of the specified types will be used.
    - Returns: The same instance you called the method on.
- `revert` - Shortcut for `undo(1, type)`
    - Arguments:
        - `type` (String | String[] | null): The type of checkpoint to restore the instance to. If `null`, the last checkpoint will be used. If the type is an array, the last checkpoint of any of the specified types will be used.
    - Returns: The same instance you called the method on.
- `checkpoint` - Creates a checkpoint of the specified type. The checkpoint will have the current state of the instance stored in it.
    - Arguments:
        - `type` (String): The type of checkpoint to create. By default, this is `manual`.
    - Returns: The same instance you called the method on.
- `removeCheckpoint` - Removes the checkpoint at the specified index, adjusting the `stateIndex` if necessary. If the index is out of bounds, a `RangeError` is thrown. If the checkpoint removed is the current checkpoint, the `stateIndex` will refer to the checkpoint immediately after it, or the last available checkpoint if it was the last checkpoint. If the removal results in an empty history, the `stateIndex` will be set to `0`.
    - Arguments:
        - `index` (Number): The index of the checkpoint to remove.
    - Returns: The same instance you called the method on.
- `clone` - Returns a new instance of the same class with the same properties and values. The new instance will not have any checkpoints. This is a deep clone, so the properties will be cloned as well when possible.
    - Arguments: None
    - Returns: A new instance of the same class with the same properties and values.
- `defineRequestType` - Defines a request type to be used with the instance. If the request type is already defined or the name conflicts with an existing variable, an `Error` is thrown. When you set the gnerated property, that value will override the `run` function.
    - Arguments:
        - `id` (String): The id of the request type. This is what you will use to access the request type on the instance.
        - `run` (Function): A function that will be used to run the request. The function can take any number of arguments, but the last argument will always be an `AbortController` instance for use with handling cancellation.
        - `args` (Object): Additional arguments
            - `pre` (Function): A function that will be run before the request is made. The function can take any number of arguments, but the last argument will always be an `AbortController` instance for use with handling cancellation.
            - `post` (Function): A function that will be run after the request is made. The function can take any number of arguments, but the last argument will always be an `AbortController` instance for use with handling cancellation.
    - Returns: The same instance you called the method on.
- `removeRequestType` - Removes a request type from the instance. If the request type is not defined or conflicts with an existing variable, an `Error` is thrown.
    - Arguments:
        - `id` (String): The id of the request type to be removed.
    - Returns: The same instance you called the method on.
- `request` - Allows you to manually run the request with the specified id instead of directly calling the generated property's value. Throws an `Error` if the request type is not defined.
    - Arguments:
        - `id` (String): The id of the request type to run.
        - `...args` (Any[]): The arguments to pass to the request type's `run` function. Note that one additional argument will always be provided, an `AbortController` instance for use with handling cancellation.
    - Returns: A promise that will resolve when the request is complete or reject if the request fails.
- `hasLastRequest` - Returns `true` if the last request was of the specified type, `false` otherwise.
    - Arguments:
        - `type` (String | String[] | null | undefined): The type of request to check for. If `null` or `undefined`, the function will return `true` if any last request exists. If the type is an array, the function will return `true` if the last request was of any of the specified types.
    - Returns:
        - Boolean - `true` if the last request was of the specified type, `false` otherwise.
- `hasInProgressRequest` - Returns `true` if a request is currently in progress and matches the specified type, `false` otherwise.
    - Arguments:
        - `type` (String | String[] | null | undefined): The type of request to check for. If `null` or `undefined`, the function will return `true` if any request is in progress. If the type is an array, the function will return `true` if any request is in progress and matches any of the specified types.
    - Returns:
        - Boolean - `true` if a request is currently in progress and matches the specified type, `false` otherwise.
- `hasFailedRequest` - Returns `true` if the last request failed and matches the specified type, `false` otherwise.
    - Arguments:
        - `type` (String | String[] | null | undefined): The type of request to check for. If `null` or `undefined`, the function will return `true` if any last request failed. If the type is an array, the function will return `true` if the last request failed and matches any of the specified types.
    - Returns:
        - Boolean - `true` if the last request failed and matches the specified type, `false` otherwise.
- `hasSuccessfulRequest` - Returns `true` if the last request was successful and matches the specified type, `false` otherwise.
    - Arguments:
        - `type` (String | String[] | null | undefined): The type of request to check for. If `null` or `undefined`, the function will return `true` if any last request was successful. If the type is an array, the function will return `true` if the last request was successful and matches any of the specified types.
    - Returns:
        - Boolean - `true` if the last request was successful and matches the specified type, `false` otherwise.
- `hasAbortedRequest` - Returns `true` if the last request was aborted and matches the specified type, `false` otherwise.
    - Arguments:
        - `type` (String | String[] | null | undefined): The type of request to check for. If `null` or `undefined`, the function will return `true` if any last request was aborted. If the type is an array, the function will return `true` if the last request was aborted and matches any of the specified types.
    - Returns:
        - Boolean - `true` if the last request was aborted and matches the specified type, `false` otherwise.
- `abortRequest` - Signals an abort for the current request of the specified type if it is in progress. Otherwise, does nothing. Note that this will only work correctly if you implement the `AbortController` provided to your request function.
    - Arguments:
        - `type` (String | String[] | null | undefined): The type of request to abort. If `null` or `undefined`, the function will abort any request that is in progress. If the type is an array, the function will abort any request that is in progress and matches any of the specified types.
    - Returns: The same instance you called the method on.

### Components
The following components are available in the library:

- `MongoData.Provider` - This is a component that provides an instance of the `MongoData` class to its children via [react-proxy-context](https://www.npmjs.com/package/@ptolemy2002/react-proxy-context). It is recommended to override this for any subclass so that the `contextClass` and `dataClass` don't have to be specified.
    - Props:
        - `value` (MongoData | Object): The instance or data to initialize the value with. If an object is provided, a new instance will be constructed using `createFromJSON`. Otherwise, the instance will be used as is.
        - `contextClass` (Class): The class to use for the context.
        - `dataClass` (Class): The class to use for the data.
        - `onChange` (Function): A function that is called whenever the context is changed. The first parameter is the property that was changed (null if it was reassignment), the second parameter is the current value of the context, and the third parameter is the previous value of the context. This is useful for listening to changes in the provider's parent component.
        - `proxyRef` (Object): A ref object that is assigned the proxy object of the context. This is useful for accessing the proxy object directly by the provider's parent component.
    - Returns: The children of the component, wrapped in the context provider.

### Hooks
The following hooks are available in the library:

- `MongoData.useContext` - This is a hook that consumes the context specified via [react-proxy-context](https://www.npmjs.com/package/@ptolemy2002/react-proxy-context). It is recommended to override this for any subclass so that the `contextClass` and `dataClass` don't have to be specified.
    - Arguments:
        - `contextClass` (Class): The class to use for the context.
        - `dataClass` (Class): The class to use for the data.
        - `deps` (Array): An array of dependencies to listen to. If any of these properties on the context change, the hook will re-render. If this is falsy, any mutation will trigger a re-render. You can also specify a function that returns a boolean to determine whether to re-render (provided with the same arguments as `onChange` would be and a 4th argument that is the current value of the context).
        - `onChange` (Function): A function that is called whenever the context is changed. The first parameter is the property that was changed (null if it was reassignment), the second parameter is the current value of the property, and the third parameter is the previous value of the property. This is useful for listening to changes in the provider's parent component.
        - `listenReinit` (Boolean): Whether to listen to full reassignments of the context and re-render when they occur. Default is `true`.

## Meta
This is a React Library Created by Ptolemy2002's [cra-template-react-library](https://www.npmjs.com/package/@ptolemy2002/cra-template-react-library) template in combination with [create-react-app](https://www.npmjs.com/package/create-react-app). It contains methods of building and publishing your library to npm.
For now, the library makes use of React 18 and does not use TypeScript.

## Peer Dependencies
These should be installed in order to use the library, as npm does not automatically add peer dependencies to your project.
- @types/react: ^18.3.3
- @types/react-dom: ^18.3.0
- react: ^18.3.1
- react-dom: ^18.3.1

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