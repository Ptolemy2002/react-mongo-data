import { loadExtension, ext_hasProperty } from "@ptolemy2002/js-utils";
import { flattenKeys, listDifference, listsEqual, objectsEqual, objectDifference } from "@ptolemy2002/list-object-utils";
import { MaybePromise, MaybeTransformer, PartialBy, ValueOf, ValueCondition, OptionalValueCondition, valueConditionMatches } from "@ptolemy2002/ts-utils";
import {
    Dependency, useProxyContext, OnChangePropCallback, OnChangeReinitCallback,
    ProxyContext,
    createProxyContextProvider
} from "@ptolemy2002/react-proxy-context";
import isCallable from "is-callable";
import { ReactNode, MutableRefObject, useCallback, useImperativeHandle, useRef } from "react";
import HookResult, { HookResultData } from "@ptolemy2002/react-hook-result";
import { partialMemo } from "@ptolemy2002/react-utils";
import cloneDeep from "lodash.clonedeep";

loadExtension("hasProperty", ext_hasProperty, Object);

export type SupportedMongoValue = (
    string | number | boolean | null | SupportedMongoValue[]
    | { [key: string]: SupportedMongoValue }
);
export type SupportedDataValue = Exclude<
        SupportedMongoValue, any[] | { [key: string]: SupportedMongoValue }
    > | Date | SupportedDataValue[] | Set<SupportedDataValue> | { [key: string]: SupportedDataValue }
;

export type Checkpoint<T> = {
    type: string,
    data: T
};
export type CheckpointIndexOptions = { start?: number | null, includeCurrent?: boolean };
export type CheckpointCountOptions = { max?: number, min?: number };

export type DataTypeRecord = Record<string, SupportedDataValue>;
export type MongoTypeRecord = Record<string, SupportedMongoValue>;
export type RequestRecord = Record<string, (...args: any[]) => Promise<any>>;

export type Property<
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

export type Request<
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
export type RequestTypeCondition<Requests extends RequestRecord> = ValueCondition<Extract<keyof Requests, string>>;

export type Difference = {
    $set?: { [key: string]: SupportedMongoValue },
    $unset?: { [key: string]: "" },
    $push?: { [key: string]: { $each: SupportedMongoValue[] } },
    $pullAll?: { [key: string]: { $in: SupportedMongoValue[] } }
};

export type MongoDataProviderProps<
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

export type CompletedMongoData<
    DataType extends DataTypeRecord,
    MongoType extends MongoTypeRecord,
    Requests extends RequestRecord
> = MongoData<DataType, MongoType, Requests> & DataType & Requests;

export default class MongoData<
    DataType extends DataTypeRecord,
    MongoType extends MongoTypeRecord,
    Requests extends RequestRecord
> {
    lastRequest: Extract<keyof Requests, string> | null = null;
    requestInProgress = false;
    requestFailed = false;
    requestAborted = false;
    requestError: any = null;
    requestPromise: Promise<ReturnType<ValueOf<Requests>>> | null = null;
    abortController: AbortController | null = null;

    checkpoints: Checkpoint<MongoType>[] = [];

    _checkpointIndex = 0;
    get checkpointIndex() {
        return this._checkpointIndex;
    }

    set checkpointIndex(value) {
        if (
            (value === 0 && this.checkpoints.length === 0)
                || 
            (value >= 0 && value < this.checkpoints.length)
        ) {
            this._checkpointIndex = value;
        } else {
            throw new RangeError(
                `State index ${value} is out of range. Min: 0, Max: ${this.checkpoints.length - 1}`
            );
        }
    }

    properties: Property<DataType, MongoType>[] = [];
    requestTypes: Request<Requests>[] = [];
    _setReadOnly = false;

    // When overriding this, include keys of the DataType as well.
    protected static _defaultDependencies: (keyof MongoData<any, any, any>)[] = [
        "requestInProgress", "requestFailed", "requestAborted", "requestError", "checkpointIndex"
    ];

    protected static _useContext<
        DataType extends DataTypeRecord,
        MongoType extends MongoTypeRecord,
        Requests extends RequestRecord,
        MD extends CompletedMongoData<DataType, MongoType, Requests> = CompletedMongoData<DataType, MongoType, Requests>
    >(
        context: ProxyContext<MD | null>,
        dataClass: new () => MD,
        deps: Dependency<MD | null>[] | null = MongoData._defaultDependencies as unknown as Dependency<MD | null>[],
        onChangeProp?: OnChangePropCallback<MD | null>,
        onChangeReinit?: OnChangeReinitCallback<MD | null>,
        listenReinit = true
    ) {
        const [data, _setData] = useProxyContext(
            context,
            deps,
            onChangeProp as OnChangePropCallback<MD | null>,
            onChangeReinit as OnChangeReinitCallback<MD | null>,
            listenReinit
        );
        const set = useCallback((value: MD | Partial<MongoType> | null) => {
            if (typeof value === "object" && value !== null && !(value instanceof MongoData)) {
                return _setData(
                    new dataClass()
                        .fromJSON(value, true)
                        .checkpoint("initial")
                );
            } else {
                return _setData(value);
            }
        }, [_setData, dataClass]);

        return new HookResult({data, set}, ["data", "set"]) as HookResultData<
            {
                data: typeof data, set: typeof set
            },
            readonly [typeof data, typeof set]
        >;
    }

    protected static _useContextNonNullable<
        DataType extends DataTypeRecord,
        MongoType extends MongoTypeRecord,
        Requests extends RequestRecord,
        MD extends CompletedMongoData<DataType, MongoType, Requests> = CompletedMongoData<DataType, MongoType, Requests>
    >(
        context: ProxyContext<MD | null>,
        dataClass: new () => MD,
        deps: Dependency<MD | null>[] | null = MongoData._defaultDependencies as unknown as Dependency<MD>[],
        onChangeProp?: OnChangePropCallback<MD | null>,
        onChangeReinit?: OnChangeReinitCallback<MD | null>,
        listenReinit = true
    ) {
        const [data, set] = MongoData._useContext<DataType, MongoType, Requests, MD>(
            context, dataClass, deps, onChangeProp, onChangeReinit, listenReinit
        );

        if (data === null) throw new Error(`Expected ${context.name} to be non-null, but it was null`);
        return new HookResult({data, set}, ["data", "set"]) as HookResultData<
            {
                data: typeof data, set: typeof set
            },
            readonly [typeof data, typeof set]
        >;
    }

    protected static createProvider<
        DataType extends DataTypeRecord,
        MongoType extends MongoTypeRecord,
        Requests extends RequestRecord,
        MD extends CompletedMongoData<DataType, MongoType, Requests> = CompletedMongoData<DataType, MongoType, Requests>
    >(
        context: ProxyContext<MD | null>,
        dataClass: new () => MD
    ) {
        const Provider = createProxyContextProvider<MD | null>(context);

        return partialMemo(({
            children,
            value,
            proxyRef,
            onChangeProp,
            onChangeReinit,
            renderDeps
        }: MongoDataProviderProps<MongoType, MD>) => {
            const valueRef = useRef<MD | null | undefined>();
            useImperativeHandle(proxyRef, () => valueRef.current!, [valueRef]);

            if (valueRef.current === undefined) {
                if (typeof value === "object" && value !== null && !(value instanceof MongoData)) {
                    valueRef.current = new dataClass().fromJSON(value, true).checkpoint("initial") as MD;
                } else {
                    valueRef.current = value as MD;
                }
            }

            return (
                <Provider
                    value={valueRef.current!}
                    onChangeProp={onChangeProp}
                    onChangeReinit={onChangeReinit}
                    proxyRef={valueRef as MutableRefObject<MD | null>}
                    renderDeps={renderDeps}
                >
                    {children}
                </Provider>
            );
        }, 
            ["children", "proxyRef"],
            "MongoData.ProviderWrapper",
            true
        );
    }


    hasCustomProperty(name: string): name is Extract<keyof DataType, string> {
        return this.properties.some(
            (property) => property.name === name
        );
    }

    findProperty<K extends Extract<keyof DataType, string>>(
        name: K
    ): Property<DataType, MongoType, K> {
        if (!this.hasCustomProperty(name)) {
            throw new Error(`Property ${String(name)} does not exist.`);
        }

        return this.properties.find(
            (property) => 
                property.name === name 
        )! as unknown as Property<DataType, MongoType, K>;
    }


    hasRequestType(id: string): id is Extract<keyof Requests, string> {
        return this.requestTypes.some((requestType) => requestType.id === id);
    }

    findRequestType<Id extends Extract<keyof Requests, string>>(
        id: Id
    ): Request<Requests, Id> {
        if (!this.hasRequestType(id)) {
            throw new Error(`Request type ${String(id)} does not exist.`);
        }

        return this.requestTypes.find((requestType) => requestType.id === id) as Request<Requests, Id>;
    }

    public static comparePropertyValues<T extends SupportedDataValue>(a: T, b: T): boolean {
        if (a === null || b === null) return a === b;

        if (a instanceof Set && b instanceof Set) {
            if (a.size !== b.size) return false;
            return Array.from(a).every((value) => b.has(value));
        } else if (Array.isArray(a) && Array.isArray(b)) {
            return listsEqual(a, b);
        } else if (a instanceof Date && b instanceof Date) {
            return a.getTime() === b.getTime();
        } else if (typeof a === "object" && typeof b === "object") {
            return objectsEqual(a, b);
        }

        return a === b;
    }

    defineProperty<
        DK extends Extract<keyof DataType, string>,
        MK extends Extract<keyof MongoType, string>
    >(name: DK, {
        mongoName,

        // Assume the mongo values and data values are equivalent if not provided.
        // Typescript complains about this, which is why we do an unknown cast and then
        // manually specify the type.
        fromMongo,
        toMongo,
        initial,
        get = (current) => current,
        set = (value) => value,
        readOnly = false,
        equals = MongoData.comparePropertyValues,
        validate = () => true
    }: Omit<
        PartialBy<Omit<Property<DataType, MongoType, DK, MK>, "name">, 
            "get" | "set" | "equals" |
            "validate" | "readOnly"
        >, "current"
    >) {
        if (this.hasProperty(name) || this.hasCustomProperty(name)) {
            throw new Error(`Property ${String(name)} already exists.`);
        }

        const current = Object.freeze(initial);

        this.properties.push({
            name, mongoName,
            // Casting these to any, as Typescript does not understand
            // this is safe due to the fact that DataType and
            // MongoType are generics and might not share the same keys.
            current: current as any,
            initial: current as any,
            fromMongo: fromMongo as any,
            toMongo: toMongo as any,
            get: get as any,
            set: set as any,
            equals: equals as any,
            readOnly,
            validate: validate as any
        });

        Object.defineProperty(this, name, {
            get(this: MongoData<DataType, MongoType, Requests>) {
                return this.propGet(name);
            },

            set(
                this: MongoData<DataType, MongoType, Requests>,
                value: DataType[Extract<keyof DataType, string>]
            ) {
                this.propSet(name, value);
            }
        });

        return this;
    }

    defineRequestType<Id extends Extract<keyof Requests, string>>(
        id: Id,
        run: Request<Requests, Id>["run"],
        {
            undoOnFail = true,
            pre = async () => {},
            post = () => {}
        }: Partial<Pick<Request<Requests, Id>, "pre" | "post" | "undoOnFail">> = {}
    ) {
        if (this.hasRequestType(id)) {
            throw new Error(`Request type ${String(id)} already exists.`);
        }

        this.requestTypes.push({
            id,
            undoOnFail,
            run: async function (ac: AbortController, ...args: Parameters<Requests[Id]>) {
                return run.call(this, ac, ...args);
            },

            pre: async function (ac: AbortController, ...args: Parameters<Requests[Id]>) {
                pre.call(this, ac, ...args);
            },

            post: async function (
                ac: AbortController,
                result: ReturnType<Requests[Id]>,
                ...args: Parameters<Requests[Id]>
            ) {
                post.call(this, ac, result, ...args);
            }
        } as unknown as Request<Requests, Id>);

        Object.defineProperty(this, id, {
            get() {
                return function(
                    this: MongoData<DataType, MongoType, Requests>,
                    ...args: Parameters<Requests[Id]>
                ) {
                    return this.request(id, ...args);
                }
            },

            set(
                this: MongoData<DataType, MongoType, Requests>,
                value: Request<Requests, Id>["run"]
            ) {
                this.findRequestType(id).run = value;
            }
        });

        return this;
    }

    removeRequestType(id: Extract<keyof Requests, string>) {
        if (!this.hasRequestType(id))
            throw new Error(`Request Type ${id} is not defined.`);
        
        this.requestTypes = this.requestTypes.filter(
            (requestType) => requestType.id !== id
        );
        delete (this as any)[id];
        return this;
    }

    removeProperty(name: Extract<keyof DataType, string>) {
        if (!this.hasCustomProperty(name)) {
            throw new Error(`Property ${String(name)} does not exist.`);
        }

        this.properties = this.properties.filter(
            (property) => property.name !== name
        );
        delete (this as any)[name];
        return this;
    }

    propGet<K extends Extract<keyof DataType, string>>(
        name: K
    ): DataType[K] {
        const property = this.findProperty(name);
        return property.get(property!.current);
    }

    propSet<K extends Extract<keyof DataType, string>>(
        name: K,
        value: DataType[K],
        setReadOnly = false
    ): DataType[K] {
        try {
            if (setReadOnly) this._setReadOnly = true;
            const property = this.findProperty(name);

            if (property.readOnly && !this._setReadOnly) {
                throw new Error(`Property ${String(name)} is read-only.`);
            }

            const validateResult = property.validate(value);
            if (validateResult !== true) {
                throw new Error(
                    `Property ${String(name)} validation failed`
                    + (
                        typeof validateResult === "string" ? `: ${validateResult}`
                        : Array.isArray(validateResult) ? `: ${validateResult.join(", ")}`
                        : ""
                    )
                );
            }

            property.current = property.set(value);
            return property.current;
        } finally {
            this._setReadOnly = false;
        }
    }

    // This is necessary to detect changes for list and object properties.
    // Since the proxy only detects the top-level properties of this object,
    // We need to reassign the same prop to a clone of the object.
    updateProp<K extends Extract<keyof DataType, string>>(
        name: K,
        value: MaybeTransformer<DataType[K], [DataType[K]]> | ((value: DataType[K]) => void),
        setReadOnly = false
    ): DataType[K] {
        try {
            if (setReadOnly) this._setReadOnly = true;

            const property = this.findProperty(name);
            if (property.readOnly && !this._setReadOnly) {
                throw new Error(`Property ${String(name)} is read-only.`);
            }

            const prev = property.get(property.current);
            
            let newValue: DataType[K];
            if (prev instanceof Set) {
                newValue = new Set(cloneDeep(prev)) as DataType[K];
            } else if (Array.isArray(prev)) {
                newValue = cloneDeep(prev) as DataType[K];
            } else if (prev instanceof Date) {
                newValue = new Date(prev) as DataType[K];
            } else if (typeof prev === "object" && prev !== null) {
                newValue = cloneDeep(prev) as DataType[K];
            } else {
                newValue = prev;
            }

            if (isCallable(value)) {
                const result = value(newValue);
                newValue = result ?? newValue;
            } else {
                newValue = value;
            }

            (this as any)[name] = newValue;
            return newValue;
        } finally {
            this._setReadOnly = false;
        }
    }

    dataNameFromMongo(name: Extract<keyof MongoType, string>): Extract<keyof DataType, string> {
        const property = this.properties.find(
            (property) => property.mongoName === name
        );

        if (!property) {
            throw new Error(`Property with mongo name ${String(name)} does not exist.`);
        }

        return property.name as Extract<keyof DataType, string>;
    }

    isDirty(type: OptionalValueCondition<string> = null) {
        const lastCheckpoint = this.lastCheckpoint(type, {includeCurrent: true});
        if (lastCheckpoint === null) return true;
        return !this.jsonEquals(lastCheckpoint.data);
    }

    toJSON(): MongoType {
        return this.properties.reduce(
            (acc, property) => {
                const newValue = property.toMongo(property.current);
                
                if (Array.isArray(newValue)) {
                    acc[property.mongoName] = cloneDeep(newValue) as MongoType[Extract<keyof MongoType, string>];
                } else if (typeof newValue === "object" && newValue !== null) {
                    acc[property.mongoName] = cloneDeep(newValue) as MongoType[Extract<keyof MongoType, string>];
                } else if (newValue instanceof Set) {
                    acc[property.mongoName] = cloneDeep(newValue) as MongoType[Extract<keyof MongoType, string>];
                } else {
                    acc[property.mongoName] = newValue;
                }
                return acc;
            },
            {} as MongoType
        );
    }

    fromJSON(data: Partial<MongoType>, setReadOnly = false) {
        try {
            if (setReadOnly) this._setReadOnly = true;

            for (const [key, value] of Object.entries(data)) {
                const name = this.dataNameFromMongo(key as Extract<keyof MongoType, string>);
                this._setReadOnly = true;
                (this as any)[name] = this.findProperty(name).fromMongo(value);
            }
        } finally {
            this._setReadOnly = false;
        }

        return this;
    }

    jsonEquals(data: Partial<MongoType>): boolean {
        for (const [key, mongoValue] of Object.entries(data)) {
            const name = this.dataNameFromMongo(key as Extract<keyof MongoType, string>);
            const property = this.findProperty(name);
            const dataValue = property.fromMongo(
                mongoValue as MongoType[Extract<keyof MongoType, string>]
            );

            if (!property.equals(property.current, dataValue)) {
                return false;
            }
        }

        return true;
    }

    difference({type=null, previous=null}: {
        type?: OptionalValueCondition<string>,
        previous?: MongoType | null
    } = {}): Difference {
        if (!previous) {
            previous = this.lastCheckpoint(type, {includeCurrent: true})?.data ?? null;
            if (!previous) throw new Error("No previous data to compare to.");
        }

        let result: Difference = {
            $set: {},
            $unset: {},
            $push: {},
            $pullAll: {}
        };

        this.properties.forEach((property) => {
            const prevValue = property.fromMongo(previous[property.mongoName]);

            if (!property.equals(property.current, prevValue)) {
                if (property.get(property.current) === null) {
                    if (prevValue !== null) result.$set![
                        property.mongoName
                    ] = null as MongoType[Extract<keyof MongoType, string>];
                } else if (Array.isArray(property.current) && Array.isArray(prevValue)) {
                    const _diff = flattenKeys(
                        listDifference(
                            property.toMongo(prevValue) as any[],
                            property.toMongo(property.get(property.current)) as any[]
                        )!
                    )

                    const diff: Record<string, SupportedMongoValue> = Object.keys(_diff).reduce(
                        (acc, key) => {
                            acc[property.mongoName + "." + key] = _diff[key as keyof Object];
                            return acc;
                        },
                        {} as Record<string, SupportedMongoValue>
                    );

                    Object.entries(diff).forEach(([key, value]) => {
                        if (value === undefined) {
                            result.$unset![key] = "";
                            delete diff[key as keyof Object];
                        }
                    });

                    if (Object.keys(diff).length > 0) result.$set = {
                        ...result.$set,
                        ...diff
                    };
                } else if (property.current instanceof Set && prevValue instanceof Set) {
                    const newValues: SupportedMongoValue[] = [];
                    const removedValues: SupportedMongoValue[] = [];

                    const currentArray = [...(property.get(property.current) as unknown as Set<SupportedDataValue>)];
                    const prevArray = [...prevValue];

                    currentArray.forEach((_, i) => {
                        if (!prevArray.some(v => MongoData.comparePropertyValues(property.get(property.current), v)))
                            newValues.push((property.toMongo(property.current) as SupportedMongoValue[])[i]);
                    });

                    prevArray.forEach((value) => {
                        if (!(property.toMongo(property.current) as SupportedMongoValue[]).some(v => MongoData.comparePropertyValues(v, value)))
                            removedValues.push(value as SupportedMongoValue);
                    });

                    if (newValues.length > 0) result.$push![property.mongoName] = {$each: newValues};
                    if (removedValues.length > 0) result.$pullAll![property.mongoName] = {$in: removedValues};
                } else if (property.current instanceof Date && prevValue instanceof Date) {
                    if (property.current.getTime() !== prevValue.getTime()) {
                        result.$set![property.mongoName] = property.toMongo(property.current);
                    }
                } else if (typeof property.current === "object" && typeof prevValue === "object") {
                    const diff = flattenKeys(
                        objectDifference(
                            property.toMongo(prevValue) as any,
                            property.toMongo(property.current) as any
                        )!
                    );

                    Object.entries(diff).forEach(([key, value]) => {
                        if (value === undefined) {
                            result.$unset![key] = "";
                            delete diff[key as keyof Object];
                        }
                    });

                    if (Object.keys(diff).length > 0) result.$set = {...result.$set, ...diff};
                } else {
                    result.$set![property.mongoName] = property.toMongo(property.current);
                }
            }
        });

        // Remove empty keys from the result
        Object.keys(result).forEach((_key) => {
            const key = _key as keyof typeof result;
            if (Object.keys(result[key]!).length === 0) delete result[key];
        });

        return result;
    }

    currentCheckpoint(): Checkpoint<MongoType> | null {
        return this.checkpoints[this.checkpointIndex] ?? null;
    }

    checkpoint(type: string ="manual") {
        if (this.checkpointIndex < this.checkpoints.length - 1) {
            this.checkpoints = this.checkpoints.slice(0, this.checkpointIndex + 1);
        }

        const checkpoint = {type, data: this.toJSON()};
        this.checkpoints.push(checkpoint);
        this.checkpointIndex = this.checkpoints.length - 1;

        return this;
    }

    removeCheckpoint(index: number) {
        if (index < 0 || index >= this.checkpoints.length) {
            throw new RangeError(
                `Checkpoint index ${index} is out of range. Min: 0, `
                + `Max: ${this.checkpoints.length - 1}`
            );
        }

        this.checkpoints.splice(index, 1);
        if (this.checkpointIndex > index) this.checkpointIndex--;
        if (this.checkpointIndex >= this.checkpoints.length) {
            this.checkpointIndex = this.checkpoints.length - (1 - +!this.checkpoints.length);
        }

        const current = this.currentCheckpoint();
        if (current !== null) this.fromJSON(current.data);
        return this;
    }

    lastCheckpointIndex(type: OptionalValueCondition<string> = null, {
        start=null, includeCurrent=false
    }: CheckpointIndexOptions = {}): number {
        start = start ?? this.checkpointIndex - (+!includeCurrent);
        for (let i = start; i >= 0; i--) {
            if (valueConditionMatches(this.checkpoints[i].type, type)) return i;
        }

        return -1;
    }

    nextCheckpointIndex(type: OptionalValueCondition<string> = null, {
        start=null, includeCurrent=false
    }: CheckpointIndexOptions = {}): number {
        start = start ?? this.checkpointIndex + (+!includeCurrent);
        for (let i = start; i < this.checkpoints.length; i++) {
            if (valueConditionMatches(this.checkpoints[i].type, type)) return i;
        }

        return -1;
    }

    lastCheckpoint(
        type: OptionalValueCondition<string> = null, args: CheckpointIndexOptions = {}
    ): Checkpoint<MongoType> | null {
        const index = this.lastCheckpointIndex(type, args);
        if (index === -1) return null;
        return this.checkpoints[index];
    }

    nextCheckpoint(
        type: OptionalValueCondition<string> = null, args: CheckpointIndexOptions = {}
    ): Checkpoint<MongoType> | null {
        const index = this.nextCheckpointIndex(type, args);
        if (index === -1) return null;
        return this.checkpoints[index];
    }

    countCheckpoints(type: OptionalValueCondition<string> = null, {
        max=Infinity - 1, min=0
    }: CheckpointCountOptions = {}): number {
        if (type === null) return this.checkpoints.length - min;

        let count = 0;
        for (let i = min; i < Math.min(this.checkpoints.length, max + 1); i++) {
            if (valueConditionMatches(this.checkpoints[i].type, type)) count++;
        }

        return count;
    }

    undo(steps: number = 1, type: OptionalValueCondition<string> = null) {
        if (this.countCheckpoints(type, {max: this.checkpointIndex}) === 0) return this;
        const initialDirty = this.isDirty();

        let index = this.checkpointIndex;
        for (let i = 0; i < steps; i++) {
            if (index === 0) break; // Cannot undo past the first checkpoint
            index = this.lastCheckpointIndex(type, {start: index - +!initialDirty});
            if (index === -1) throw new Error("Invalid State: Cannot find last checkpoint at step " + i);
        }

        // Create a checkpoint for the current state so that it can be redone correctly.
        if (initialDirty) this.checkpoint("undo");

        this.checkpointIndex = index;
        const current = this.currentCheckpoint();
        if (current !== null) this.fromJSON(current.data);

        return this;
    }

    redo(steps: number = 1, type: OptionalValueCondition<string> = null) {
        if (this.countCheckpoints(type, {min: this.checkpointIndex + 1}) === 0) return this;

        let index = this.checkpointIndex;
        for (let i = 0; i < steps; i++) {
            if (index === this.checkpoints.length - 1) break; // Cannot redo past the last checkpoint
            index = this.nextCheckpointIndex(type, {start: index + 1});
            if (index === -1) throw new Error("Invalid State: Cannot find next checkpoint at step " + i);
        }

        this.checkpointIndex = index;
        const current = this.currentCheckpoint();
        if (current !== null) this.fromJSON(current.data);

        return this;
    }

    revert(type: OptionalValueCondition<string> = null) {
        return this.undo(1, type);
    }

    clone() {
        return new (this.constructor as any)().fromJSON(this.toJSON(), true).checkpoint("initial");
    }

    _initRequest(type: Extract<keyof Requests, string>) {
        this.lastRequest = type;
        this.requestInProgress = true;
        this.requestFailed = false;
        this.requestAborted = false;
        this.requestError = null;
        return this;
    }

    _requestSuccess(type: Extract<keyof Requests, string>) {
        this.checkpoint(type);
        this.requestInProgress = false;
        this.requestFailed = false;
        this.requestAborted = false;
        this.requestError = null;
        this.abortController = null;
        this.requestPromise = null;
        return this;
    }

    _requestFailed(err: any, type: Extract<keyof Requests, string>) {
        this.requestError = err;
        this.requestFailed = true;
        this.requestInProgress = false;
        this.requestAborted = false;
        this.abortController = null;
        this.requestPromise = null;
        if (this.findRequestType(type).undoOnFail) this.revert("pre-" + type);
        return this;
    }

    request<K extends Extract<keyof Requests, string>>(
        id: K,
        ...args: Parameters<Requests[K]>
    ): Promise<ReturnType<Requests[K]>> {
        const request = this.findRequestType(id);

        if (this.hasInProgressRequest(id)) {
            throw new Error(
                `Attempted to start request ${id} while a request of the same type was `
                + "already in progress. This is not supported."
            );
        } else if (this.hasInProgressRequest()) {
            throw new Error(
                `Attempted to start request ${id} while another request was in progress. `
                + "This is not supported."
            );
        }

        if (request.undoOnFail) this.checkpoint("pre-" + id);
        const ac = new AbortController();

        let promiseResult: ReturnType<Requests[K]>;
        const run = (async () => request.pre.call(this, ac, ...args))()
            .then(() => this._initRequest(id))
            .then(() => request.run.call(this, ac, ...args))
            .then((data) => {
                this._requestSuccess(id);
                promiseResult = data as ReturnType<Requests[K]>;
                return promiseResult;
            })
            .catch((err: any) => {
                this._requestFailed(err, id);
                throw err;
            })
            .finally(() => request.post.call(this, ac, promiseResult, ...args));
        
        this.requestPromise = run;
        this.abortController = ac;

        return this.requestPromise as Promise<ReturnType<Requests[K]>>;
    }

    hasLastRequest(type?: RequestTypeCondition<Requests>): boolean {
        if (type === undefined) return this.lastRequest !== null;
        if (this.lastRequest === null) return false;
        return valueConditionMatches(this.lastRequest, type);
    }

    hasInProgressRequest(type?: RequestTypeCondition<Requests>): boolean {
        return this.requestInProgress && this.hasLastRequest(type);
    }

    hasFailedRequest(type?: RequestTypeCondition<Requests>): boolean {
        return this.requestFailed && this.hasLastRequest(type);
    }

    hasSuccessfulRequest(type?: RequestTypeCondition<Requests>): boolean {
        return !this.requestFailed && this.hasLastRequest(type);
    }

    hasAbortedRequest(type?: RequestTypeCondition<Requests>): boolean {
        return this.requestAborted && this.hasLastRequest(type);
    }

    abortRequest(type?: RequestTypeCondition<Requests>) {
        if (this.hasInProgressRequest(type) && this.abortController) {
            this.abortController.abort();
            this.abortController = null;
            this.requestInProgress = false;
            this.requestAborted = true;
        }

        return this;
    }
}