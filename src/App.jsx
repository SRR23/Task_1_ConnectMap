

// import Polygon4 from "./practice/Polygon4";


// function App() {
//   return (
//     <>
      
//       <Polygon4 />
      
//     </>
//   );
// }

// export default App;


import React from "react";
import MapLayout from "./layout/MapLayout";
import Map from "./pages/Map";

function App() {
  const { sidebar, content } = Map(); // Map now returns an object with sidebar and content
  return <MapLayout sidebar={sidebar} content={content} />;
}

export default App;
