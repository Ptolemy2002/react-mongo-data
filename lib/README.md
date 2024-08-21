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
            - `equals` (Function): A function that will be used to compare the values of the property. If not provided, the values will be compared using the `comparePropertyValues` static method. The function takes one argument, the value to be compared, and returns `true` if the values are considered equal, `false` otherwise.
            - `validate` (Function): A function that will be used to validate the value of the property. If not provided, the value will always be considered valid after verifying the type. The function takes one argument, the value to be validated, and returns `true` if the value is valid, `false` otherwise.
    - Returns: None
- `removeProperty` - Removes a property from the instance. If the property is not defined or conflicts with an existing variable, an `Error` is thrown.
    - Arguments:
        - `name` (String): The name of the property to be removed.
    - Returns: None

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