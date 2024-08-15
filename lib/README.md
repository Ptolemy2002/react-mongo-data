# React Mongo Data
This library contains a class that was originally written to interact with a MongoDB api with React. You can load data into an instance and provide it as context. Then, consumers can access the data, modify it, and send server requests as needed. You are able to specify that you want to render only when certain properties change. This is achieved through my other library, [react-proxy-context](https://www.npmjs.com/package/@ptolemy2002/react-proxy-context).

Once the instance is created, it supports data validation, tracking of previous states, and loading. When a request is started, a promise is returned, but you may choose to ignore this and access the request variables that will tell you the status. The class also automatically creates an `AbortController` to allow cancellation at any time.

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