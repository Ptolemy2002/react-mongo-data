import MongoData from "@ptolemy2002/react-mongo-data";
import { createProxyContext } from "@ptolemy2002/react-proxy-context";
import { zodValidate } from "@ptolemy2002/regex-utils";
import { z } from "zod";

export default class TestData extends MongoData {
    static defaultDependencies = [
        "wildcard", "readOnly", "customProperty", "string", "nullableString", "email", "number", "integer",
        "boolean", "nullValue", "date", "list", "set", "object",
        ...super.defaultDependencies
    ];

    _customProperty = "";

    constructor() {
        super();

        this.defineProperty("wildcard", {
            type: null
        });

        this.defineProperty("readOnly", {
            type: null,
            mongoName: "read_only",
            readOnly: true
        });

        this.defineProperty("customProperty", {
            type: "string",
            initial: "",
            mongoName: "custom_property",
            get: () => this._customProperty,
            set: value => this._customProperty = value
        });

        this.defineProperty("string", {
            type: "string",
            initial: "abc123"
        });

        this.defineProperty("nullableString", {
            mongoName: "nullable_string",
            type: "string?"
        });

        this.defineProperty("email", {
            type: "string",
            initial: "test@test.com",
            validate: zodValidate(z.string().email({ message: "Invalid email address" }))
        });

        this.defineProperty("number", {
            type: "number",
            initial: 0
        });

        this.defineProperty("integer", {
            type: "number",
            validate: zodValidate(z.number().int({ message: "Not an integer" })),
            initial: 0
        });

        this.defineProperty("boolean", {
            type: "boolean",
            initial: false
        });

        this.defineProperty("nullValue", {
            type: "null",
            mongoName: "null_value"
        });

        this.defineProperty("date", {
            type: "date",
            initial: new Date()
        });

        this.defineProperty("list", {
            type: "list",
            initial: [1, 2, 3]
        });

        this.defineProperty("set", {
            type: "set",
            initial: [1, 2, 3]
        });

        this.defineProperty("object", {
            type: "object",
            initial: { a: 1, b: 2, c: 3 }
        });

        this.defineRequestType("testRequest", async function () {
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.number++;
            console.log("run-testRequest", this.number);
            return { success: true };
        }, {
            pre: () => console.log("pre-testRequest"),
            post: () => console.log("post-testRequest")
        });

        this.defineRequestType("testRequestWithError", async function() {
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

    static createFromJSON(data) {
        const result = new TestData();
        result.fromJSON(data, true).checkpoint();

        return result;
    }
}

const TestContext = createProxyContext(undefined, "TestData");
TestData.Context = TestContext;

function useTestContext(deps=TestData.defaultDependencies) {
    return MongoData.useContext(TestContext, TestData, deps);
}
TestData.useContext = useTestContext;

function TestDataProvider({children, value, ...props}) {
    return (
        <MongoData.Provider {...props} contextClass={TestContext} dataClass={TestData} value={value}>
            {children}
        </MongoData.Provider>
    );
}
TestData.Provider = TestDataProvider;
