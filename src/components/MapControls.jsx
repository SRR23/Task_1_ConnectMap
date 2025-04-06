


import React from "react";

const MapControls = ({
  resetMap,
  saveRoute,
  togglePreviousRoutes,
  showSavedRoutes,
  toggleSavedRoutesEditability,
  isSavedRoutesEditable,
}) => (
  <div className="map-controls">
    <button onClick={resetMap}>Reset Map</button>
    <button onClick={saveRoute}>Save Route</button>
    <button onClick={togglePreviousRoutes}>
      {showSavedRoutes ? "Hide Previous Routes" : "Show Previous Routes"}
    </button>
    {showSavedRoutes && (
      <button onClick={toggleSavedRoutesEditability}>
        {isSavedRoutesEditable
          ? "Disable Editing Saved Routes"
          : "Enable Editing Saved Routes"}
      </button>
    )}
  </div>
);

export default MapControls;
