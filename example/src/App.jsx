import { useRef } from "react";
import TestData from "src/data/TestData";

function App() {
    const proxyRef = useRef();

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
    const [testData] = TestData.useContext();
    window.testData = testData;

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
    const [testData] = TestData.useContext();

    return (
        <div>
            <button onClick={() => testData.checkpoint()}>Checkpoint</button>
            <button onClick={() => testData.undo()}>Undo</button>
            <button onClick={() => testData.redo()}>Redo</button>
        </div>
    );
}