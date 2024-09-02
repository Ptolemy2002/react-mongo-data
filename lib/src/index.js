import { isNullOrUndefined, loadExtension, ext_hasProperty } from '@ptolemy2002/js-utils';
import isCallable from "is-callable";
import { listsEqual, objectsEqual, listDifference, objectDifference, flattenKeys } from '@ptolemy2002/list-object-utils';
import { ProxyContextProvider, useProxyContext } from "@ptolemy2002/react-proxy-context";
import React, { useCallback, useRef } from 'react';

loadExtension("hasProperty", ext_hasProperty, Object);
export default class MongoData {
    lastRequest = null;
    requestInProgress = false;
    requestFailed = false;
    requestAborted = false;
    requestError = null;
    requestPromise = null;
    abortController = null;

    previousStates = [];
    _stateIndex = 0;

    properties = {};
    requestTypes = {};
    _setReadOnly = false;

    get stateIndex() {
        return this._stateIndex;
    }

    set stateIndex(value) {
        if ((value === 0 && this.previousStates.length === 0) || (value >= 0 && value < this.previousStates.length)) {
            this._stateIndex = value;
        } else {
            throw new RangeError(`State index ${value} is out of range. Min: 0, Max: ${this.previousStates.length - 1}`);
        }
    }

    static defaultDependencies = ["requestInProgress", "requestFailed", "requestAborted", "requestError", "stateIndex"];

    static verifyPropertyType(value, type) {
        if (isNullOrUndefined(type)) return true;
        if (type?.endsWith("?")) {
            if (isNullOrUndefined(value)) return true;

            type = type.slice(0, -1);
        }

        // Sets will be represented by arrays, but repeated values will be automatically removed
        if (type === "list" || type === "set") return Array.isArray(value);
        else if (type === "object") return typeof value === "object" && !Array.isArray(value);
        else if (type === "date") return value instanceof Date;
        else if (type === "number") return typeof value === "number";
        else if (type === "string") return typeof value === "string";
        else if (type === "boolean") return typeof value === "boolean";
        else if (type === "null") return value === null;

        throw new TypeError(`Unrecognized Property Type: ${type}`);
    }

    static getType(value) {
        if (isNullOrUndefined(value)) return "null";
        if (Array.isArray(value)) return "list";
        if (value instanceof Date) return "date";
        if (typeof value === "object") return "object";
        if (typeof value === "number") return "number";
        if (typeof value === "string") return "string";
        if (typeof value === "boolean") return "boolean";
    }

    static comparePropertyValues(type, a, b) {
        if (isNullOrUndefined(type)) return this.comparePropertyValues(MongoData.getType(a), a, b);

        if (type?.endsWith("?")) {
            if (isNullOrUndefined(a) && isNullOrUndefined(b)) return true;
            if (isNullOrUndefined(a) || isNullOrUndefined(b)) return false;
            type = type.slice(0, -1);
        } else if (isNullOrUndefined(a) || isNullOrUndefined(b)) {
            return isNullOrUndefined(a) && isNullOrUndefined(b);
        }

        if (type === "set") {
            b = [...b];
            return a.size === b.size && a.every(value => b.includes(value));
        } else if (type === "list") {
            return listsEqual(a, b);
        } else if (type === "object") {
            return objectsEqual(a, b);
        } else if (type === "date") {
            return a?.getTime() === b?.getTime();
        } else {
            return a === b;
        }
    }

    defineProperty(name, {
        mongoName = name,
        type,
        fromMongo = (
            type?.startsWith("date") ? (
                x => x ? new Date(x) : null
            ) : (
                x => x
            )
        ),
        toMongo = x => x,
        initial = null,
        get,
        set= x => x,
        readOnly = false,
        equals,
        validate = x => true,
    }={}) {
        if (this.properties[name] || this.hasProperty(name)) {
            throw new Error(`Property "${name}" is already defined or conflicts with a variable this object uses.`);
        }

        let value = Object.freeze(isNullOrUndefined(initial) ? (isCallable(get) ? get() : null) : initial);
        this.properties[name] = Object.freeze({
            mongoName, fromMongo, toMongo,

            get: isCallable(get) ? get : () => value,
            set: (x) => {
                value = Object.freeze(isCallable(set) ? set(x) : x);
                return value;
            },
            equals: isCallable(equals) ? (x) => equals(value, x) : (x) => MongoData.comparePropertyValues(type, value, x),
            
            type, validate, readOnly
        });

        Object.defineProperty(this, name, {
            get() {
                return this._prop(name);
            },

            set(value) {
                this._prop(name, value);
            }
        });
        return this;
    }

    removeProperty(name) {
        if (!this.properties[name]) {
            throw new Error(`Property ${name} is not defined.`);
        }
        delete this.properties[name];
        delete this[name];
        return this;
    }

    _prop(name, value, setReadOnly=false) {
        try {
            if (setReadOnly) this._setReadOnly = true;
            const property = this.properties[name];
            if (!property) throw new Error(`Property ${name} is not defined.`);

            if (value === undefined) {
                return property.get();
            } else {
                if (property.readOnly && !this._setReadOnly) throw new Error(`Property ${name} is read-only.`);
                if (property.type?.startsWith("set")) value = [...new Set(value)];

                if (!MongoData.verifyPropertyType(value, property.type)) {
                    throw new TypeError(`Invalid value for property ${name}: Expected type ${property.type}`);
                }
                
                const validateResult = property.validate(value);
                if (validateResult !== true) {
                    throw new TypeError(`Invalid value for property ${name}${validateResult ? `: ${validateResult}` : ""}`);
                }

                return property.set(value);
            }
        } finally {
            if (setReadOnly) this._setReadOnly = false;
        }
    }

    // This is necessary to detect changes for list and object properties. Since the proxy only detects the top-level properties of this object,
    // We need to reassign the same prop to a clone of the object.
    updateProperty(name, callback=() => {}, setReadOnly=false) {
        try {
            if (setReadOnly) this._setReadOnly = true;
            const property = this.properties[name];
            if (!property) throw new Error(`Property ${name} is not defined.`);
            if (property.readOnly && !this._setReadOnly) throw new Error(`Property ${name} is read-only.`);

            const prev = property.get();
            const type = 
                (property.type?.endsWith("?") ? property.type.slice(0, -1) : property.type)
                ?? MongoData.getType(prev)
            ;

            let value;
            if (type === "list" || type === "set") {
                value = prev && [...prev];
            } else if (type === "object") {
                value = prev && {...prev};
            } else if (type === "date") {
                value = prev && (new Date(prev.getTime()));
            } else {
                value = prev;
            }

            const newValue = callback(value);
            this[name] = newValue === undefined ? value : newValue;
            return this[name];
        } finally {
            if (setReadOnly) this._setReadOnly = false;
        }
    }

    propertyNameFromMongo(mongoName) {
        return Object.keys(this.properties).find(name => this.properties[name].mongoName === mongoName);
    }

    isDirty(type=null) {
        const lastCheckpoint = this.lastCheckpoint(type, {includeCurrent: true});
        if (isNullOrUndefined(lastCheckpoint)) return true;
        return !this.jsonEquals(lastCheckpoint.data);
    }

    toJSON() {
        const result = {};
        Object.keys(this.properties).forEach(name => {
            const property = this.properties[name];
            const value = property.toMongo(property.get());
            const type = property.type?.endsWith("?") ? property.type.slice(0, -1) : property.type;

            if (type === "set") {
                // Remove repeated values
                result[property.mongoName] = [...new Set(value)];
            } else if (type === "list") {
                result[property.mongoName] = [...value];
            } else if (type === "object") {
                result[property.mongoName] = {...value};
            } else if (type === "date") {
                result[property.mongoName] =  value?.toISOString();
            } else {
                result[property.mongoName] = value;
            }
        });

        return result;
    }

    fromJSON(data, setReadOnly=false) {
        try {
            if (setReadOnly) this._setReadOnly = true;
            if (isNullOrUndefined(data)) return this;
            Object.keys(this.properties).forEach(name => {
                const property = this.properties[name];
                const type = property.type?.endsWith("?") ? property.type.slice(0, -1) : property.type;
                if (property.readOnly && !setReadOnly) return;

                if (data.hasProperty(property.mongoName)) {
                    const value = property.fromMongo(data[property.mongoName]);
                    if (!MongoData.verifyPropertyType(value, property.type)) throw new TypeError(`Invalid value returned by fromMongo for property ${name}: ${value}`);
                    
                    if (type === "date" && typeof value === "string") {
                        this[name] = value ? new Date(value) : null;
                    } else {
                        this[name] = value;
                    }
                }
            });

            return this;
        } finally {
            if (setReadOnly) this._setReadOnly = false;
        }
    }

    jsonEquals(data) {
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const name = this.propertyNameFromMongo(keys[i]);
            const property = this.properties[name];
            const value = property.fromMongo(data[keys[i]]);
            if (!property.equals(value)) return false;
        }

        return true;
    }

    difference({type=null, previous=null}={}) {
        if (isNullOrUndefined(previous)) previous = this.lastCheckpoint(type, {includeCurrent: true}) ?? {data: {}};

        let result = {
            $set: {},
            $unset: {},
            $push: {},
            $pullAll: {}
        };

        Object.keys(this.properties).forEach(name => {
            const property = this.properties[name]; 
            const prevValue = property.fromMongo(previous.data[property.mongoName]);
            const type = property.type?.endsWith("?") ? property.type.slice(0, -1) : property.type;

            if (!property.equals(prevValue)) {
                if (isNullOrUndefined(property.get())) {
                    if (!isNullOrUndefined(prevValue)) result.$set[property.mongoName] = null;
                } else if (type === "list" || type === "object") {
                    const differenceFn = type === "list" ? listDifference : objectDifference;
                    const diff = flattenKeys(differenceFn(prevValue, property.get()), name + ".");

                    Object.keys(diff).forEach(key => {
                        if (diff[key] === undefined) {
                            result.$unset[key] = "";
                            delete diff[key];
                        }
                    });

                    if (Object.keys(diff).length > 0) result.$set = {...result.$set, ...diff};
                } else if (type === "set") {
                    const newValues = [];
                    const removedValues = [];

                    property.get().forEach(value => {
                        const type = MongoData.getType(value);
                        if (!prevValue?.some(v => MongoData.comparePropertyValues(type, property.get(), v))) newValues.push(value);
                    });

                    prevValue?.forEach(value => {
                        const type = MongoData.getType(value);
                        if (!(
                            property.get() ? 
                                property.get().some(v => MongoData.comparePropertyValues(type, v, value))
                            : null
                        )) removedValues.push(value);
                    });

                    if (newValues.length > 0) result.$push[property.mongoName] = {$each: newValues};
                    if (removedValues.length > 0) result.$pullAll[property.mongoName] = {$in: removedValues};
                } else if (type === "date") {
                    result.$set[property.mongoName] = property.get() ? property.get().toISOString() : null;
                } else {
                    result.$set[property.mongoName] = property.get();
                }
            }
        });

        // Remove empty keys from the result
        Object.keys(result).forEach(key => {
            if (Object.keys(result[key]).length === 0) delete result[key];
        });

        return result;
    }

    currentCheckpoint() {
        return this.previousStates[this.stateIndex] ?? null;
    }

    checkpointTypeMatches(checkpoint, type) {
        if (isNullOrUndefined(type)) return true;
        if (Array.isArray(type)) return type.includes(checkpoint.type);
        return checkpoint.type === type;
    }

    lastCheckpointIndex(type=null, {start=null, includeCurrent=false}={}) {
        start = start ?? this.stateIndex - (+!includeCurrent);
        for (let i = start; i >= 0; i--) {
            if (this.checkpointTypeMatches(this.previousStates[i], type)) return i;
        }

        return -1;
    }

    nextCheckpointIndex(type=null, {start=null, includeCurrent=false}={}) {
        start = start ?? this.stateIndex + (+!includeCurrent);
        for (let i = start; i < this.previousStates.length; i++) {
            if (this.checkpointTypeMatches(this.previousStates[i], type)) return i;
        }

        return -1;
    }

    lastCheckpoint(type=null, args) {
        const index = this.lastCheckpointIndex(type, args);
        if (index === -1) return null;
        return this.previousStates[index];
    }

    nextCheckpoint(type=null, args) {
        const index = this.nextCheckpointIndex(type, args);
        if (index === -1) return null;
        return this.previousStates[index];
    }

    countCheckpoints(type=null, { max=Infinity - 1, min=0}={}) {
        if (isNullOrUndefined(type)) return this.previousStates.length;

        let count = 0;
        for (let i = min; i < Math.min(this.previousStates.length, max + 1); i++) {
            if (this.checkpointTypeMatches(this.previousStates[i], type)) count++;
        }

        return count;
    }

    undo(steps = 1, type=null) {
        if (this.countCheckpoints(type, {max: this.stateIndex}) === 0) return this;

        let index = this.stateIndex;
        for (let i = 0; i < steps; i++) {
            if (index === 0) break; // Cannot undo past the first checkpoint
            index = this.lastCheckpointIndex(type, {start: index - 1});
            if (index === -1) throw new Error("Invalid State: Cannot find last checkpoint at step " + i);
        }
        
        // Creaate a checkpoint for the current state so that it can be redone correctly.
        this.checkpoint("undo");

        this.stateIndex = index;
        const current = this.currentCheckpoint();
        if (!isNullOrUndefined(current)) this.fromJSON(current.data);

        return this;
    }

    redo(steps = 1, type=null) {
        if (this.countCheckpoints(type, {min: this.stateIndex + 1}) === 0) return this;

        let index = this.stateIndex;
        for (let i = 0; i < steps; i++) {
            if (index === this.previousStates.length - 1) break; // Cannot redo past the last checkpoint
            index = this.nextCheckpointIndex(type, {start: index + 1});
            if (index === -1) throw new Error("Invalid State: Cannot find next checkpoint at step " + i);
        }

        this.stateIndex = index;
        const current = this.currentCheckpoint();
        if (!isNullOrUndefined(current)) this.fromJSON(current.data);

        return this;
    }

    revert(type=null) {
        return this.undo(1, type);
    }

    checkpoint(type="manual") {
        if (this.stateIndex < this.previousStates.length - 1) {
            this.previousStates = this.previousStates.slice(0, this.stateIndex + 1);
        }

        const checkpoint = {type, data: this.toJSON()};
        this.previousStates.push(checkpoint);
        this.stateIndex = this.previousStates.length - 1;

        return this;
    }

    removeCheckpoint(index) {
        if (index < 0 || index >= this.previousStates.length) {
            throw new RangeError(`Checkpoint index ${index} is out of range. Min: 0, Max: ${this.previousStates.length - 1}`);
        }

        this.previousStates.splice(index, 1);
        if (this.stateIndex > index) this.stateIndex--;
        if (this.stateIndex >= this.previousStates.length) this.stateIndex = this.previousStates.length - (1 - +!this.previousStates.length);

        const current = this.currentCheckpoint();
        if (!isNullOrUndefined(current)) this.fromJSON(current.data);
        return this;
    }

    clone() {
        return this.constructor.createFromJSON(this.toJSON());
    }

    _initRequest(type) {
        this.lastRequest = type;
        this.requestInProgress = true;
        this.requestFailed = false;
        this.requestAborted = false;
        this.requestError = null;
        return this;
    }

    _requestSuccess(type) {
        this.checkpoint(type);
        this.requestInProgress = false;
        this.requestFailed = false;
        this.requestAborted = false;
        this.requestError = null;
        this.abortController = null;
        this.requestPromise = null;
        return this;
    }

    _requestFailed(err) {
        this.requestError = err;
        this.requestFailed = true;
        this.requestInProgress = false;
        this.requestAborted = false;
        this.abortController = null;
        this.requestPromise = null;
        return this;
    }

    defineRequestType(id, run=() => {}, {
        pre = () => {},
        post = () => {},
    }={}) {
        if (this.requestTypes[id] || this.hasProperty(id)) {
            throw new Error(`Request Type ${id} is already defined or conflicts with a variable this object uses.`);
        }

        this.requestTypes[id] = {
            run: async (...args) => run(...args),
            pre: async (...args) => pre(...args),
            post: async (...args) => post(...args)
        };

        Object.defineProperty(this, id, {
            get() {
                return function(...args) {
                    return this.request(id, ...args);
                }
            },

            set(value) {
                this.requestTypes[id].run = async (...args) => value(...args);
            }
        });

        return this;
    }

    removeRequestType(id) {
        if (!this.requestTypes[id])
            throw new Error(`Request Type ${id} is not defined.`);
        delete this.requestTypes[id];
        delete this[id];
    }

    request(id, ...args) {
        if (!this.requestTypes[id]) throw new Error(`Request type ${id} is not defined.`);

        const request = this.requestTypes[id];

        if (this.hasInProgressRequest(id)) {
            console.warn(`Attempted to start request ${id} while a request of the same type was already in progress. Ignoring...`);
            return this;
        } else if (this.hasInProgressRequest()) {
            throw new Error(`Attempted to start request ${id} while another request was in progress. This is not supported.`);
        }
        
        const ac = new AbortController();
        const run = request.pre(...args, ac)
            .then(() => this._initRequest(id))
            .then(() => request.run(...args, ac))
            .then(() => {
                this._requestSuccess(id);
            })
            .catch(err => {
                this._requestFailed(err);
                throw err;
            })
            .finally(() => request.post(...args, ac));

        this.requestPromise = run;
        this.abortController = ac;

        return this.requestPromise;
    }

    hasLastRequest(type) {
        if (type === undefined) return !isNullOrUndefined(this.lastRequest);
        if (Array.isArray(type)) return type.includes(this.lastRequest);
        return this.lastRequest === type;
    }

    hasInProgressRequest(type) {
        return this.requestInProgress && this.hasLastRequest(type);
    }

    hasFailedRequest(type) {
        return this.requestFailed && this.hasLastRequest(type);
    }

    hasSuccessfulRequest(type) {
        return !this.requestFailed && this.hasLastRequest(type);
    }

    hasAbortedRequest(type) {
        return this.requestAborted && this.hasLastRequest(type);
    }

    abortRequest(type) {
        if (this.hasInProgressRequest(type) && this.abortController) {
            this.abortController.abort();
            this.abortController = null;
            this.requestInProgress = false;
            this.requestAborted = true;
        }
    }
}

function valueToInstance(dataClass, value) {
    if (typeof value === "object" && value !== null &&  !(value instanceof dataClass)) {
        return dataClass.createFromJSON(value);
    } else {
        return value;
    }
}

MongoData.useContext = function useDataContext(contextClass, dataClass, deps, onChange, listenReinit=true) {
    const [value, _setValue] = useProxyContext(contextClass, deps, onChange, listenReinit);
    const setValue = useCallback((v) => _setValue(valueToInstance(dataClass, v)), [_setValue]);
    return [value, setValue];
}

MongoData.Provider = function DataProvider({children, contextClass, dataClass, value, proxyRef, onChange, ...props}) {
    const valueRef = useRef();
    if (valueRef.current === undefined) { // Initialize the valueRef
        valueRef.current = valueToInstance(dataClass, value);
    }

    return (
        <ProxyContextProvider {...props} value={valueRef.current} contextClass={contextClass} proxyRef={valueRef} onChange={(...args) => {
            const [p] = args;
            if (p === null) {
                proxyRef && (proxyRef.current = valueRef.current);
            }
            
            if (isCallable(onChange)) onChange(...args);
        }}>
            {children}
        </ProxyContextProvider>
    );
}