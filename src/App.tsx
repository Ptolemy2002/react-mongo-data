import { useRef } from "react";
import TestData, { CompletedTestData } from "./data/TestData";

function App() {
    const proxyRef = useRef<CompletedTestData | null>(null);

    return (
        <div className="App">
            <TestData.Provider value={{}} proxyRef={proxyRef}>
                <h1>Test Data</h1>
                <Display />
                <Controller />
            </TestData.Provider>
        </div>
    );
}

export default App;

function Display() {
    const [_testData] = TestData.useContext();
    // Remove the null case, as it doesn't apply here.
    const testData = _testData!;

    (window as any).testData = testData;    

    return (
        <div>
            <p>
                Use window.testData in the console to modify the data.
            </p>

            <h3>Current</h3>
            <pre>{JSON.stringify(testData.toJSON(), null, 2)}</pre>

            <h3>Difference</h3>
            <pre>{JSON.stringify(testData.difference(), null, 2)}</pre>

            <h3>Stats</h3>
            <p>
                Dirty: {testData.isDirty() ? "Yes" : "No"}
            </p>
        </div>
    );
}

function Controller() {
    const [_testData] = TestData.useContext();
    // Remove the null case, as it doesn't apply here.
    const testData = _testData!;

    return (
        <div>
            <button onClick={() => testData.checkpoint()}>Checkpoint</button>
            <button onClick={() => testData.undo()}>Undo</button>
            <button onClick={() => testData.redo()}>Redo</button>
        </div>
    );
}