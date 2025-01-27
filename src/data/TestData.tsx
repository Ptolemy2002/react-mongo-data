import MongoData, { SupportedMongoValue } from "@ptolemy2002/react-mongo-data";
import { createProxyContext, Dependency, OnChangePropCallback, OnChangeReinitCallback } from "@ptolemy2002/react-proxy-context";
import { CompletedMongoData } from "lib/main";
import { zodValidateWithErrors } from "@ptolemy2002/regex-utils";
import { z } from "zod";

export type TestDataType = {
    wildcard: SupportedMongoValue;
    readOnly: SupportedMongoValue;
    customProperty: string;
    string: string;
    nullableString: string | null;
    email: string;
    number: number;
    integer: number;
    boolean: boolean;
    nullValue: null;
    date: Date;
    list: SupportedMongoValue[];
    set: Set<SupportedMongoValue>;
    object: Record<string, SupportedMongoValue>;
};

export type TestMongoType = Omit<
    TestDataType, 
     "readOnly" | "customProperty" | "nullableString" | "nullValue" | "set" | "date"
> & {
    read_only: SupportedMongoValue;
    custom_property: string;
    nullable_string: string | null;
    null_value: null;
    date: string;
    set: SupportedMongoValue[];
};

export type TestRequests = {
    testRequest: () => Promise<{success: boolean}>;
    testRequestWithError: () => Promise<never>;
};

export type CompletedTestData = CompletedMongoData<TestDataType, TestMongoType, TestRequests> & TestData;

export default class TestData extends MongoData<TestDataType, TestMongoType, TestRequests> {
    _customProperty = "";

    static defaultDependencies: Dependency<CompletedTestData>[] = [
        ...MongoData._defaultDependencies,
        "wildcard",
        "readOnly",
        "customProperty",
        "string",
        "nullableString",
        "email",
        "number",
        "integer",
        "boolean",
        "nullValue",
        "date",
        "list",
        "set",
        "object"
    ];

    static Context = createProxyContext<CompletedTestData | null>("TestContext");
    static Provider = MongoData.createProvider<TestDataType, TestMongoType, TestRequests, CompletedTestData>(
        TestData.Context,
        TestData as unknown as new () => CompletedTestData
    );

    static useContext(
        deps: Dependency<CompletedTestData>[] = TestData.defaultDependencies,
        onChangeProp?: OnChangePropCallback<CompletedTestData | null>,
        onChangeReinit?: OnChangeReinitCallback<CompletedTestData | null>
    ) {
        return MongoData._useContext<
            TestDataType, TestMongoType, TestRequests, CompletedTestData
        >(
            TestData.Context,
            TestData as unknown as new () => CompletedTestData,
            deps,
            onChangeProp,
            onChangeReinit
        )
    }

    static useContextNonNullable(
        deps: Dependency<CompletedTestData>[] = TestData.defaultDependencies,
        onChangeProp?: OnChangePropCallback<CompletedTestData | null>,
        onChangeReinit?: OnChangeReinitCallback<CompletedTestData | null>
    ) {
        // We're expecting an error here because the type
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return MongoData._useContextNonNullable<
            TestDataType, TestMongoType, TestRequests, CompletedTestData
        >(
            TestData.Context,
            TestData as unknown as new () => CompletedTestData,
            deps,
            onChangeProp,
            onChangeReinit
        );       
    }

    // We use this create method instead of a constructor to allow for
    // adding the properties and request types in a fluent way.
    // constructors don't allow for different return types.
    static create() {
        return (new TestData() as CompletedTestData).checkpoint("initial");
    }

    // Manually implement clone to ensure that the correct type is returned
    clone() {
        return super.clone() as CompletedTestData;
    }

    constructor() {
        super();

        this.defineProperty("wildcard", {
            mongoName: "wildcard",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: null
        });

        this.defineProperty("readOnly", {
            mongoName: "read_only",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: null,
            readOnly: true
        });

        this.defineProperty("customProperty", {
            mongoName: "custom_property",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            get: () => this._customProperty,
            set: (value) => this._customProperty = value,
            initial: ""
        });

        this.defineProperty("string", {
            mongoName: "string",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: ""
        });

        this.defineProperty("nullableString", {
            mongoName: "nullable_string",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: null
        });

        this.defineProperty("email", {
            mongoName: "email",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: "test@test.com",
            validate: zodValidateWithErrors(z.string().email({message: "Invalid email"}))
        });

        this.defineProperty("number", {
            mongoName: "number",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: 0
        });

        this.defineProperty("integer", {
            mongoName: "integer",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: 0,
            validate: zodValidateWithErrors(z.number().int({message: "Not an integer"}))
        });

        this.defineProperty("boolean", {
            mongoName: "boolean",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: false
        });

        this.defineProperty("nullValue", {
            mongoName: "null_value",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: null
        });

        this.defineProperty("date", {
            mongoName: "date",
            toMongo: (value) => value.toISOString(),
            fromMongo: (value) => new Date(value),
            initial: new Date()
        });

        this.defineProperty("list", {
            mongoName: "list",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: []
        });

        this.defineProperty("set", {
            mongoName: "set",
            toMongo: (value) => Array.from(value),
            fromMongo: (value) => new Set(value),
            initial: new Set()
        });

        this.defineProperty("object", {
            mongoName: "object",
            toMongo: (value) => value,
            fromMongo: (value) => value,
            initial: {}
        });

        this.defineRequestType("testRequest", async function(this: CompletedTestData) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.number++;
            console.log("run-testRequest", this.number);
            return { success: true };
        }, {
            pre: () => console.log("pre-testRequest"),
            post: () => console.log("post-testRequest")
        });

        this.defineRequestType("testRequestWithError", async function(this: CompletedTestData) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.number++;
            console.log("run-testRequestWithError", this.number);
            await new Promise(resolve => setTimeout(resolve, 1000));
            throw new Error("testRequestWithError");
        }, {
            pre: () => console.log("pre-testRequestWithError"),
            post: () => console.log("post-testRequestWithError")
        });
    }
}