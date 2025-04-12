import { useCallback, useState, version } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

import { protocol } from "@tx3/mydapp";

function App() {
  const [quantity, setQuantity] = useState(0);

  const onClick = useCallback(async () => {
    const tx = protocol.transferAdaTx({
      quantity: 0,
      quantity2: 0,
      receiver: "",
      sender: "",
    });

    protocol.transferNftTx({
      name: "test",
    });

    console.log(tx);
  }, [quantity]);

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <button onClick={onClick}>transfer ADA</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
