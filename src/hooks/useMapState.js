import { useState } from "react";

export const useMapState = () => {
  const [mapState, setMapState] = useState({
    savedRoutes: [],
    nextNumber: 1,
    selectedType: null,
    showModal: false,
    selectedPoint: null,
    rightClickMarker: null,
    fiberLines: [],
    imageIcons: [],
    showSavedRoutes: false,
    // savedPolylines: [],
    savedPolylines: JSON.parse(localStorage.getItem("savedPolylines")) || [],
    savedIcons: JSON.parse(localStorage.getItem("savedIcons")) || [],
    selectedLine: null,
    selectedLineId: null,
    isSavedRoutesEditable: false,
    selectedLineForActions: null,
    lineActionPosition: null,
    exactClickPosition: null,
    selectedWaypoint: null,
    waypointActionPosition: null,
    selectedWaypointInfo: null,
  });

  return { mapState, setMapState };
};