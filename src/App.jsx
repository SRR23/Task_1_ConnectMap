import MapLayout from "./layout/MapLayout";
import Map from "./pages/Map";

function App() {
  return (
    <>
      <MapLayout content={<Map />} />
    </>
  );
}

export default App;
