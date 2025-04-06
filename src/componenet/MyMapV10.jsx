import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  MarkerF,
  PolylineF,
  PolygonF,
} from "@react-google-maps/api";

import { Trash2, Plus, Edit2 } from "lucide-react"; // Import delete icon

const containerStyle = { width: "100%", height: "600px" };
const center = { lat: 23.685, lng: 90.3563 };

// Define libraries as a constant outside the component
const LIBRARIES = ["geometry"];

const mapStyles = [
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ visibility: "on" }, { color: "#2c3e50" }, { weight: 2 }],
  },
  {
    featureType: "poi",
    elementType: "all",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "all",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "landscape",
    elementType: "all",
    stylers: [{ visibility: "simplified" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ visibility: "simplified" }],
  },
  {
    featureType: "water",
    elementType: "all",
    stylers: [{ visibility: "off" }],
  },
];

const MyMapV10 = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES, // Add this line to include the geometry library
  });

  const fileInputRef = useRef(null);
  const mapRef = useRef();

  const iconImages = {
    BTS: "/img/BTS.png",
    Termination: "/img/Termination.png",
    Splitter: "/img/Splitter.png",
    ONU: "/img/ONU.png",
  };

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
    savedPolylines: [], // New field to store individually saved polylines
    selectedLine: null, // Added to track the selected line
    selectedLineId: null, // Added to track the selected line's unique ID
    isSavedRoutesEditable: false, // New state to control editability of saved route
    selectedLineForActions: null, // New state to track the line for floating actions
    lineActionPosition: null, // New state to track the position of line action window
    exactClickPosition: null, // New state to store exact click position
    selectedWaypoint: null,
    waypointActionPosition: null,
    selectedWaypointInfo: null, // To store line index, waypoint index, and whether it's a saved line

    // Polygon
    polygons: [], // Current unsaved polygons
    savedPolygons: [], // Saved polygons from localStorage
    isDrawingPolygon: false,
    currentPolygonPoints: [],
    showSavedPolygons: false, // Separate toggle for saved polygons
    polygonActionPosition: null, // Add this to initial state
    selectedPolygon: null,
    mousePosition: null, // Track mouse position for live line
    isPolygonClosed: false,
    mapRef: null, // Add mapRef to state
  });

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    setMapState((prev) => ({ ...prev, mapRef: map }));
    console.log("Map loaded");
  }, []);

  const togglePolygonDrawing = () => {
    setMapState((prevState) => ({
      ...prevState,
      isDrawingPolygon: !prevState.isDrawingPolygon,
      currentPolygonPoints: prevState.isDrawingPolygon
        ? []
        : prevState.currentPolygonPoints,
      mousePosition: null,
      isPolygonClosed: false,
      polygons: prevState.isDrawingPolygon ? [] : prevState.polygons, // Clear unsaved polygons when canceling
    }));
  };

  const isNearFirstPoint = (newPoint, firstPoint) => {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(newPoint.lat, newPoint.lng),
      new google.maps.LatLng(firstPoint.lat, firstPoint.lng)
    );
    return distance < 50; // Adjust this value as needed (in meters)
  };

  const handleMapClick = useCallback(
    (e) => {
      e.stop();
      if (!mapState.isDrawingPolygon || mapState.isPolygonClosed) return;

      const newPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };

      setMapState((prevState) => {
        const points = prevState.currentPolygonPoints;
        if (
          points.length >= 3 &&
          points[0] &&
          isNearFirstPoint(newPoint, points[0])
        ) {
          const closedPath = [...points, points[0]];
          const newPolygon = { id: `temp-${Date.now()}`, path: closedPath };

          // Automatically select the newly closed polygon
          return {
            ...prevState,
            isPolygonClosed: true,
            polygons: [...prevState.polygons, newPolygon],
            currentPolygonPoints: [],
            mousePosition: null,
            selectedPolygon: {
              polygon: newPolygon,
              index: prevState.polygons.length,
              isSaved: false,
            },
            polygonActionPosition: {
              x: e.domEvent.clientX,
              y: e.domEvent.clientY,
            },
          };
        }
        return { ...prevState, currentPolygonPoints: [...points, newPoint] };
      });
    },
    [mapState.isDrawingPolygon, mapState.isPolygonClosed]
  );


  const handleMarkerClick = (index) => {
    if (
      index !== 0 ||
      mapState.currentPolygonPoints.length < 3 ||
      mapState.isPolygonClosed
    )
      return;

    setMapState((prevState) => {
      const newPolygon = {
        id: `temp-${Date.now()}`,
        path: [
          ...prevState.currentPolygonPoints,
          prevState.currentPolygonPoints[0],
        ],
      };

      return {
        ...prevState,
        isPolygonClosed: true,
        mousePosition: null,
        polygons: [...prevState.polygons, newPolygon],
        currentPolygonPoints: [],
        selectedPolygon: {
          polygon: newPolygon,
          index: prevState.polygons.length,
          isSaved: false,
        },
        // Position at center of map since we don't have exact click coordinates
        polygonActionPosition: {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        },
      };
    });
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (
        !mapState.isDrawingPolygon ||
        mapState.currentPolygonPoints.length === 0 ||
        mapState.isPolygonClosed
      )
        return;

      setMapState((prevState) => ({
        ...prevState,
        mousePosition: {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        },
      }));
    },
    [
      mapState.isDrawingPolygon,
      mapState.currentPolygonPoints.length,
      mapState.isPolygonClosed,
    ]
  );

  const handlePointDrag = (index, e) => {
    setMapState((prevState) => {
      const updatedPoints = [...prevState.currentPolygonPoints];
      updatedPoints[index] = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };
      return {
        ...prevState,
        currentPolygonPoints: updatedPoints,
      };
    });
  };

  // Add new function to edit saved polygon
  const editPolygon = () => {
    if (!mapState.selectedPolygon || !mapState.selectedPolygon.isSaved) return;

    const { polygon } = mapState.selectedPolygon;

    setMapState((prevState) => ({
      ...prevState,
      isDrawingPolygon: true,
      currentPolygonPoints: [...polygon.path],
      isPolygonClosed: true,
      savedPolygons: prevState.savedPolygons.filter((p) => p.id !== polygon.id),
      selectedPolygon: null,
      polygonActionPosition: null,
    }));
  };

  const savePolygon = () => {
    if (mapState.currentPolygonPoints.length < 3 || !mapState.isPolygonClosed) {
      // Handle unsaved closed polygon
      if (mapState.polygons.length > 0) {
        const newPolygon = {
          id: `polygon-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          path: [...mapState.polygons[mapState.polygons.length - 1].path],
          createdAt: new Date().toISOString(),
        };

        const updatedSavedPolygons = [...mapState.savedPolygons, newPolygon];
        localStorage.setItem(
          "savedPolygons",
          JSON.stringify(updatedSavedPolygons)
        );

        setMapState((prevState) => ({
          ...prevState,
          savedPolygons: updatedSavedPolygons,
          polygons: [],
          selectedPolygon: null,
          polygonActionPosition: null,
        }));
      }
      return;
    }

    const newPolygon = {
      id: `polygon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      path: [...mapState.currentPolygonPoints],
      createdAt: new Date().toISOString(),
    };

    const updatedSavedPolygons = [...mapState.savedPolygons, newPolygon];
    localStorage.setItem("savedPolygons", JSON.stringify(updatedSavedPolygons));

    setMapState((prevState) => ({
      ...prevState,
      savedPolygons: updatedSavedPolygons,
      currentPolygonPoints: [],
      isDrawingPolygon: false,
      isPolygonClosed: false,
      mousePosition: null,
      polygons: [],
      selectedPolygon: null,
      polygonActionPosition: null,
    }));
  };

  const handlePolygonClick = (polygon, index, isSaved, e) => {
    e.domEvent.preventDefault();
    e.domEvent.stopPropagation();

    const x = e.domEvent.clientX;
    const y = e.domEvent.clientY;

    setMapState((prevState) => ({
      ...prevState,
      selectedPolygon: { polygon, index, isSaved },
      polygonActionPosition: { x, y },
      // Reset other action states to prevent overlap
      selectedLineForActions: null,
      lineActionPosition: null,
      exactClickPosition: null,
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
    }));
  };

  // Delete polygon
  const deletePolygon = () => {
    if (!mapState.selectedPolygon) return;

    const { polygon, index, isSaved } = mapState.selectedPolygon;

    if (isSaved) {
      const updatedSavedPolygons = mapState.savedPolygons.filter(
        (_, i) => i !== index
      );
      localStorage.setItem(
        "savedPolygons",
        JSON.stringify(updatedSavedPolygons)
      );

      setMapState((prevState) => ({
        ...prevState,
        savedPolygons: updatedSavedPolygons,
        selectedPolygon: null,
        polygonActionPosition: null,
      }));
    } else {
      setMapState((prevState) => ({
        ...prevState,
        polygons: prevState.polygons.filter((_, i) => i !== index),
        selectedPolygon: null,
        polygonActionPosition: null,
      }));
    }
  };

  // Toggle saved polygons
  const toggleSavedPolygons = () => {
    setMapState((prevState) => ({
      ...prevState,
      showSavedPolygons: !prevState.showSavedPolygons,
    }));
  };

  const handleMapRightClick = useCallback(
    (e) => {
      e.domEvent.preventDefault();
      const clickedPoint = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        number: mapState.nextNumber,
        x: e.domEvent.clientX,
        y: e.domEvent.clientY,
      };

      setMapState((prevState) => ({
        ...prevState,
        selectedPoint: clickedPoint,
        rightClickMarker: clickedPoint,
        showModal: true,
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      }));
    },
    [mapState.nextNumber]
  );

  const handleSelection = (type) => {
    const { selectedPoint, nextNumber } = mapState;
    setMapState((prevState) => ({
      ...prevState,
      selectedType: type,
      showModal: false,
      imageIcons: [
        ...prevState.imageIcons.filter(
          (icon) =>
            icon.lat !== selectedPoint.lat || icon.lng !== selectedPoint.lng
        ), // Remove existing icon at this position
        { ...selectedPoint, type, id: nextNumber }, // Add new icon with selected type
      ],
      nextNumber: nextNumber + 1,
      rightClickMarker: null, // Hide the right-click marker after placing the icon
    }));
  };

  const handleRightClickOnIcon = (icon) => {
    setMapState((prevState) => ({
      ...prevState,
      selectedPoint: icon,
      rightClickMarker: icon,
      showModal: true,
    }));
  };

  const handleLineClick = (line, index, isSavedLine = false, e) => {
    // Prevent default context menu
    if (e.domEvent) {
      e.domEvent.preventDefault();
    }

    if (
      !isSavedLine ||
      (mapState.showSavedRoutes &&
        (mapState.isSavedRoutesEditable || !isSavedLine))
    ) {
      // Get the exact latitude and longitude of the click
      const clickedLatLng = e.latLng;

      // Use clientX and clientY from the DOM event for screen positioning
      const x = e.domEvent.clientX;
      const y = e.domEvent.clientY;

      setMapState((prevState) => ({
        ...prevState,
        selectedLineForActions: {
          line,
          index,
          isSavedLine,
        },
        lineActionPosition: {
          lat: clickedLatLng.lat(),
          lng: clickedLatLng.lng(),
          x: x,
          y: y,
        },
        exactClickPosition: {
          lat: clickedLatLng.lat(),
          lng: clickedLatLng.lng(),
          x: x,
          y: y,
        },
        // Clear any waypoint selection when clicking on a line
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      }));
    }
  };

  // Modify existing methods to work with the new line action system
  const addWaypoint = () => {
    if (!mapState.selectedLineForActions) return;

    const { line, index, isSavedLine } = mapState.selectedLineForActions;

    setMapState((prevState) => {
      const updatedLines = isSavedLine
        ? prevState.savedPolylines
        : prevState.fiberLines;

      const updatedLinesWithWaypoint = updatedLines.map(
        (currentLine, currentIndex) => {
          if (currentIndex === index) {
            // Calculate midpoint logic remains the same
            const lastPoint =
              currentLine.waypoints && currentLine.waypoints.length > 0
                ? currentLine.waypoints[currentLine.waypoints.length - 1]
                : currentLine.to;

            const midpoint = {
              lat: (currentLine.from.lat + lastPoint.lat) / 2,
              lng: (currentLine.from.lng + lastPoint.lng) / 2,
            };

            const updatedWaypoints = currentLine.waypoints
              ? [...currentLine.waypoints, midpoint]
              : [midpoint];

            return {
              ...currentLine,
              waypoints: updatedWaypoints,
            };
          }
          return currentLine;
        }
      );

      // Update the correct state based on whether it's a saved or current line
      return {
        ...prevState,
        ...(isSavedLine
          ? { savedPolylines: updatedLinesWithWaypoint }
          : { fiberLines: updatedLinesWithWaypoint }),
        selectedLineForActions: null,
        lineActionPosition: null,
      };
    });
  };

  // Modified handleWaypointClick function to fix the modal display issue
  const handleWaypointClick = (
    lineIndex,
    waypointIndex,
    isSavedLine = false,
    waypoint,
    e
  ) => {
    // First, prevent the default behavior and stop propagation
    if (e && e.domEvent) {
      e.domEvent.preventDefault();
      e.domEvent.stopPropagation(); // Add this to stop event bubbling
    }

    console.log("Waypoint clicked:", { lineIndex, waypointIndex, waypoint });
    if (
      !isSavedLine ||
      (mapState.showSavedRoutes && mapState.isSavedRoutesEditable)
    ) {
      // Get screen coordinates
      const x = e && e.domEvent ? e.domEvent.clientX : 0;
      const y = e && e.domEvent ? e.domEvent.clientY : 0;

      // Update state with the selected waypoint information in a single update
      setMapState((prevState) => ({
        ...prevState,
        // Clear any other action windows first
        selectedLineForActions: null,
        lineActionPosition: null,
        exactClickPosition: null,
        showModal: false,
        // Then set waypoint selection info
        selectedWaypoint: waypoint,
        waypointActionPosition: {
          x: x,
          y: y,
        },
        selectedWaypointInfo: {
          lineIndex,
          waypointIndex,
          isSavedLine,
        },
      }));
    }
  };

  // Modify the removeSelectedWaypoint function to also remove associated icons
  const removeSelectedWaypoint = () => {
    if (!mapState.selectedWaypointInfo) return;

    const { lineIndex, waypointIndex, isSavedLine, isIcon, iconId } =
      mapState.selectedWaypointInfo;

    setMapState((prevState) => {
      // Determine which array to update (savedPolylines or fiberLines)
      const targetArray = isSavedLine
        ? prevState.savedPolylines
        : prevState.fiberLines;

      if (!targetArray[lineIndex] || !targetArray[lineIndex].waypoints) {
        return prevState;
      }

      // Get the waypoint that might have an associated icon
      const waypoint = targetArray[lineIndex].waypoints[waypointIndex];
      const iconToRemoveId = isIcon ? iconId : waypoint.iconId || null;

      // Create a new array with the selected waypoint removed
      const updatedLines = targetArray.map((line, idx) => {
        if (idx === lineIndex) {
          // Filter out the selected waypoint
          const updatedWaypoints = line.waypoints.filter(
            (_, wIdx) => wIdx !== waypointIndex
          );
          return {
            ...line,
            waypoints: updatedWaypoints,
          };
        }
        return line;
      });

      // Also remove any associated icon
      const updatedImageIcons = prevState.imageIcons.filter(
        (icon) => icon.id !== iconToRemoveId
      );

      // Update savedIcons if necessary
      const updatedSavedIcons = prevState.savedIcons
        ? prevState.savedIcons.filter((icon) => icon.id !== iconToRemoveId)
        : prevState.savedIcons;

      // If it's a saved line, update localStorage
      if (isSavedLine) {
        localStorage.setItem("savedPolylines", JSON.stringify(updatedLines));
        if (iconToRemoveId) {
          localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
        }
      }

      // Update the appropriate state
      return {
        ...prevState,
        ...(isSavedLine
          ? {
              savedPolylines: updatedLines,
              fiberLines: prevState.showSavedRoutes
                ? updatedLines
                : prevState.fiberLines,
              savedIcons: updatedSavedIcons,
            }
          : { fiberLines: updatedLines }),
        imageIcons: updatedImageIcons,
        // Clear the waypoint selection
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      };
    });
  };

  // Function to open device icon selection
  const openDeviceIconSelection = () => {
    // Trigger the hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // First, modify the handleFileSelection function to link the icon to the waypoint
  const handleFileSelection = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!mapState.selectedWaypointInfo) {
      alert("No waypoint selected!");
      return;
    }

    // Create a new icon at the waypoint's position
    const { lineIndex, waypointIndex, isSavedLine } =
      mapState.selectedWaypointInfo;
    const targetArray = isSavedLine
      ? mapState.savedPolylines
      : mapState.fiberLines;

    if (!targetArray[lineIndex] || !targetArray[lineIndex].waypoints) {
      alert("Could not find the selected waypoint");
      return;
    }

    const waypoint = targetArray[lineIndex].waypoints[waypointIndex];

    // Create a URL for the selected file
    const imageUrl = URL.createObjectURL(file);

    // Create a new icon with a reference to the waypoint
    const newIcon = {
      lat: waypoint.lat,
      lng: waypoint.lng,
      type: "Custom", // Use a designated type for custom icons
      id: `custom-icon-${Date.now()}`,
      imageUrl: imageUrl, // Store the custom image URL
      // Store references to the line and waypoint
      linkedTo: {
        lineIndex,
        waypointIndex,
        isSavedLine,
        waypointId: `waypoint-${lineIndex}-${waypointIndex}`, // Create a unique ID for the waypoint
      },
    };

    // Add the new icon to imageIcons
    setMapState((prevState) => {
      const updatedImageIcons = [...prevState.imageIcons, newIcon];

      // Also update savedIcons if appropriate
      let updatedSavedIcons = prevState.savedIcons || [];
      if (isSavedLine) {
        updatedSavedIcons = [...updatedSavedIcons, newIcon];
        localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
      }

      // Update the waypoint to reference this icon
      const updatedLines = isSavedLine
        ? prevState.savedPolylines.map((line, idx) => {
            if (idx === lineIndex && line.waypoints) {
              const updatedWaypoints = [...line.waypoints];
              // Add a reference to the icon ID in the waypoint
              updatedWaypoints[waypointIndex] = {
                ...updatedWaypoints[waypointIndex],
                iconId: newIcon.id,
              };
              return { ...line, waypoints: updatedWaypoints };
            }
            return line;
          })
        : prevState.fiberLines.map((line, idx) => {
            if (idx === lineIndex && line.waypoints) {
              const updatedWaypoints = [...line.waypoints];
              updatedWaypoints[waypointIndex] = {
                ...updatedWaypoints[waypointIndex],
                iconId: newIcon.id,
              };
              return { ...line, waypoints: updatedWaypoints };
            }
            return line;
          });

      // Update the appropriate state based on whether it's a saved or current line
      return {
        ...prevState,
        imageIcons: updatedImageIcons,
        savedIcons: updatedSavedIcons,
        ...(isSavedLine
          ? { savedPolylines: updatedLines }
          : { fiberLines: updatedLines }),
        // Clear the waypoint selection
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      };
    });
  };

  // Add a handler for icon click events
  const handleIconClick = (icon, e) => {
    if (e && e.domEvent) {
      e.domEvent.preventDefault();
      e.domEvent.stopPropagation();
    }

    // Check if this icon is linked to a waypoint
    if (icon.linkedTo) {
      const { lineIndex, waypointIndex, isSavedLine } = icon.linkedTo;

      const x = e && e.domEvent ? e.domEvent.clientX : 0;
      const y = e && e.domEvent ? e.domEvent.clientY : 0;

      setMapState((prevState) => ({
        ...prevState,
        selectedWaypoint: icon,
        waypointActionPosition: {
          x: x,
          y: y,
        },
        selectedWaypointInfo: {
          lineIndex,
          waypointIndex,
          isSavedLine,
          isIcon: true, // Add flag to indicate this is an icon
          iconId: icon.id,
        },
        // Clear other selections
        selectedLineForActions: null,
        lineActionPosition: null,
        exactClickPosition: null,
        showModal: false,
      }));
    } else {
      // Handle normal icon right-click
      handleRightClickOnIcon(icon);
    }
  };

  const removeSelectedLine = () => {
    if (!mapState.selectedLineForActions) return;

    const { line, index, isSavedLine } = mapState.selectedLineForActions;

    if (isSavedLine) {
      // Remove from savedPolylines in localStorage
      const savedPolylines =
        JSON.parse(localStorage.getItem("savedPolylines")) || [];
      const updatedSavedPolylines = savedPolylines.filter(
        (polyline) => polyline.id !== line.id
      );

      // Update localStorage
      localStorage.setItem(
        "savedPolylines",
        JSON.stringify(updatedSavedPolylines)
      );

      setMapState((prevState) => ({
        ...prevState,
        savedPolylines: updatedSavedPolylines,
        selectedLineForActions: null,
        lineActionPosition: null,
        fiberLines: prevState.showSavedRoutes
          ? updatedSavedPolylines
          : prevState.fiberLines,
      }));
    } else {
      // Remove from current fiberLines
      const updatedFiberLines = mapState.fiberLines.filter(
        (currentLine) => currentLine.id !== line.id
      );

      setMapState((prevState) => ({
        ...prevState,
        fiberLines: updatedFiberLines,
        selectedLineForActions: null,
        lineActionPosition: null,
      }));
    }
  };

  const handleMarkerDragEnd = (index, e) => {
    const updatedIcons = [...mapState.imageIcons];
    updatedIcons[index] = {
      ...updatedIcons[index],
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    };

    // After updating the icon position, update the state
    setMapState((prevState) => ({
      ...prevState,
      imageIcons: updatedIcons, // This should immediately update the state
    }));
  };

  const generateUniqueId = () => {
    return `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addFiberLine = () => {
    const { rightClickMarker } = mapState;
    if (!rightClickMarker) return;

    const fiberLineStart = {
      lat: rightClickMarker.lat,
      lng: rightClickMarker.lng,
    };

    const fiberLineEnd = {
      lat: rightClickMarker.lat + 0.001, // Offset for demonstration
      lng: rightClickMarker.lng + 0.001,
    };

    const newFiberLine = {
      id: generateUniqueId(),
      from: fiberLineStart,
      to: fiberLineEnd,
      waypoints: [], // Add initial waypoint
    };

    setMapState((prevState) => ({
      ...prevState,
      fiberLines: [...prevState.fiberLines, newFiberLine],
      showModal: false,
      selectedPoint: null,
      rightClickMarker: null,
    }));
  };

  // Handle dragging of the start marker (line.from)
  const handleStartMarkerDragEnd = (index, e) => {
    const updatedLines = [...mapState.fiberLines];
    updatedLines[index].from = { lat: e.latLng.lat(), lng: e.latLng.lng() };

    setMapState((prevState) => ({
      ...prevState,
      fiberLines: updatedLines,
    }));
  };

  // Handle dragging of the end marker (line.to)
  const handleEndMarkerDragEnd = (index, e) => {
    const updatedLines = [...mapState.fiberLines];
    updatedLines[index].to = { lat: e.latLng.lat(), lng: e.latLng.lng() };

    setMapState((prevState) => ({
      ...prevState,
      fiberLines: updatedLines,
    }));
  };

  const handleWaypointDragEnd = (lineIndex, waypointIndex, e) => {
    setMapState((prevState) => {
      const updatedLines = prevState.fiberLines.map((line, index) => {
        if (index === lineIndex) {
          // Create a copy of existing waypoints
          const updatedWaypoints = [...(line.waypoints || [])];

          // Update the specific waypoint
          updatedWaypoints[waypointIndex] = {
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
          };

          // Return a new line object with updated waypoints
          return {
            ...line,
            waypoints: updatedWaypoints,
          };
        }
        return line;
      });

      return {
        ...prevState,
        fiberLines: updatedLines,
      };
    });
  };

  const saveRoute = () => {
    // Save polylines
    if (mapState.fiberLines.length > 0) {
      const polylinesToSave = mapState.fiberLines.map((line, index) => ({
        id: line.id || generateUniqueId(), // Ensure each line has a unique ID
        from: { ...line.from },
        to: { ...line.to },
        waypoints: line.waypoints ? [...line.waypoints] : [], // Deep copy waypoints
        createdAt: new Date().toISOString(),
        strokeColor: "#0000FF",
      }));

      const savedPolylines =
        JSON.parse(localStorage.getItem("savedPolylines")) || [];

      // Remove duplicates and merge
      const updatedSavedPolylines = [
        ...savedPolylines.filter(
          (existing) =>
            !polylinesToSave.some((newLine) => newLine.id === existing.id)
        ),
        ...polylinesToSave,
      ];

      localStorage.setItem(
        "savedPolylines",
        JSON.stringify(updatedSavedPolylines)
      );

      setMapState((prevState) => ({
        ...prevState,
        savedPolylines: updatedSavedPolylines,
        showSavedRoutes: true,
        fiberLines: updatedSavedPolylines.map((polyline) => ({
          ...polyline,
          strokeColor: "#0000FF",
        })),
      }));
    }

    // Save icons (existing logic remains the same)
    if (mapState.imageIcons.length > 0) {
      const iconsToSave = mapState.imageIcons.map((icon, index) => ({
        id: `icon-${Date.now()}-${index}`,
        lat: icon.lat,
        lng: icon.lng,
        type: icon.type,
        imageUrl: icon.imageUrl, // Save custom image URL if present
        createdAt: new Date().toISOString(),
      }));

      const savedIcons = JSON.parse(localStorage.getItem("savedIcons")) || [];
      const updatedSavedIcons = [...savedIcons, ...iconsToSave];
      localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));

      setMapState((prevState) => ({
        ...prevState,
        savedIcons: updatedSavedIcons,
        imageIcons: updatedSavedIcons.map((icon) => ({
          lat: icon.lat,
          lng: icon.lng,
          type: icon.type,
          imageUrl: icon.imageUrl,
          id: icon.id,
        })),
      }));
    }

    // Alert only if something was saved
    if (mapState.fiberLines.length > 0 || mapState.imageIcons.length > 0) {
      alert("Polylines and Icons saved successfully!");
    } else {
      alert("No routes or icons to save!");
    }
  };

  // Update useEffect to load saved polygons
  useEffect(() => {
    const savedPolylines =
      JSON.parse(localStorage.getItem("savedPolylines")) || [];
    const savedIcons = JSON.parse(localStorage.getItem("savedIcons")) || [];
    const savedPolygons =
      JSON.parse(localStorage.getItem("savedPolygons")) || [];

    setMapState((prevState) => ({
      ...prevState,
      savedPolylines,
      savedIcons,
      savedPolygons,
    }));
  }, []);

  const togglePreviousRoutes = () => {
    setMapState((prevState) => {
      const showSaved = !prevState.showSavedRoutes;
      return {
        ...prevState,
        showSavedRoutes: showSaved,
        isSavedRoutesEditable: false,
        // Directly use savedPolylines when showing routes
        fiberLines: showSaved
          ? prevState.savedPolylines.map((polyline) => ({
              ...polyline, // Spread the entire polyline object
              strokeColor: "#0000FF",
            }))
          : [],
        imageIcons: showSaved
          ? prevState.savedIcons.map((icon) => ({
              lat: icon.lat,
              lng: icon.lng,
              type: icon.type,
              imageUrl: icon.imageUrl, // Include custom image URL if present
              id: icon.id,
            }))
          : [],

        // Clear any selection when toggling routes
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      };
    });
  };

  const resetMap = () => {
    setMapState({
      savedRoutes: mapState.savedRoutes,
      showSavedRoutes: false,
      nextNumber: 1,
      selectedType: null,
      showModal: false,
      selectedPoint: null,
      rightClickMarker: null,
      fiberLines: [],
      imageIcons: [],
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,

      polygons: [],
      isDrawingPolygon: false,
      currentPolygonPoints: [],
      showSavedPolygons: false,
      selectedPolygon: null,
      polygonActionPosition: null,
    });
  };

  // Updated function to handle dragging saved icons
  const handleSavedIconDragEnd = (iconId, e) => {
    setMapState((prevState) => {
      // Find and update the specific icon by its ID
      const updatedSavedIcons = prevState.savedIcons.map((icon) =>
        icon.id === iconId
          ? {
              ...icon,
              lat: e.latLng.lat(),
              lng: e.latLng.lng(),
            }
          : icon
      );

      // Update localStorage with the entire updated array
      localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));

      return {
        ...prevState,
        savedIcons: updatedSavedIcons,
        // Update imageIcons if saved routes are showing
        imageIcons: prevState.showSavedRoutes
          ? updatedSavedIcons.map((icon) => ({
              lat: icon.lat,
              lng: icon.lng,
              type: icon.type,
              imageUrl: icon.imageUrl,
              id: icon.id,
            }))
          : prevState.imageIcons,
      };
    });
  };

  // Updated function to handle dragging saved polyline points
  const handleSavedPolylinePointDragEnd = (polylineId, pointType, e) => {
    setMapState((prevState) => {
      // Find and update the specific polyline by its ID
      const updatedSavedPolylines = prevState.savedPolylines.map((polyline) =>
        polyline.id === polylineId
          ? {
              ...polyline,
              [pointType]: {
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
              },
            }
          : polyline
      );

      // Update localStorage with the entire updated array
      localStorage.setItem(
        "savedPolylines",
        JSON.stringify(updatedSavedPolylines)
      );

      return {
        ...prevState,
        savedPolylines: updatedSavedPolylines,
        // Update fiberLines if saved routes are currently displayed
        fiberLines: prevState.showSavedRoutes
          ? updatedSavedPolylines.map((polyline) => ({
              from: polyline.from,
              to: polyline.to,
              id: polyline.id,
              waypoints: polyline.waypoints || [],
              strokeColor: "#0000FF",
            }))
          : prevState.fiberLines,
      };
    });
  };

  const handleSavedPolylineWaypointDragEnd = (polylineId, waypointIndex, e) => {
    setMapState((prevState) => {
      // Create updated saved polylines with the moved waypoint
      const updatedSavedPolylines = prevState.savedPolylines.map((polyline) =>
        polyline.id === polylineId
          ? {
              ...polyline,
              waypoints: polyline.waypoints.map((waypoint, index) =>
                index === waypointIndex
                  ? {
                      lat: e.latLng.lat(),
                      lng: e.latLng.lng(),
                    }
                  : waypoint
              ),
            }
          : polyline
      );

      // Update localStorage immediately
      localStorage.setItem(
        "savedPolylines",
        JSON.stringify(updatedSavedPolylines)
      );

      return {
        ...prevState,
        savedPolylines: updatedSavedPolylines,
        // Update fiberLines to reflect the new waypoint positions
        ...(prevState.showSavedRoutes
          ? {
              fiberLines: updatedSavedPolylines.map((polyline) => ({
                ...polyline,
                strokeColor: "#0000FF", // Ensure consistent color
              })),
            }
          : {}),
      };
    });
  };

  // New function to toggle editability of saved routes
  const toggleSavedRoutesEditability = () => {
    setMapState((prevState) => ({
      ...prevState,
      isSavedRoutesEditable: !prevState.isSavedRoutesEditable,
    }));
  };

  // Function to close the waypoint action window
  const closeWaypointActions = () => {
    setMapState((prevState) => ({
      ...prevState,
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
    }));
  };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    <>
      <div>
        <button onClick={resetMap}>Reset Map</button>
        <button onClick={saveRoute}>Save Route</button>
        <button onClick={togglePreviousRoutes}>
          {mapState.showSavedRoutes
            ? "Hide Previous Routes"
            : "Show Previous Routes"}
        </button>
        <button onClick={togglePolygonDrawing}>
          {mapState.isDrawingPolygon ? "Cancel Polygon" : "Draw Polygon"}
        </button>
        {/* {mapState.isPolygonClosed && (
          <button onClick={savePolygon}>Save Polygon</button> // Add save button when closed
        )} */}
        <button onClick={toggleSavedPolygons}>
          {mapState.showSavedPolygons
            ? "Hide Saved Polygons"
            : "Show Saved Polygons"}
        </button>
      </div>

      {/* Hidden file input for device icon upload */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileSelection}
      />

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={7}
        onLoad={onMapLoad}
        // onRightClick={handleMapRightClick}
        options={{
          styles: mapStyles,
          disableDefaultUI: false,
        }}
        onClick={mapState.isDrawingPolygon ? handleMapClick : undefined}
        // onClick={handleMapClick} // Simplified to always use handleMapClick
        onRightClick={
          !mapState.isDrawingPolygon ? handleMapRightClick : undefined
        }
        onMouseMove={mapState.isDrawingPolygon ? handleMouseMove : undefined}
      >
        {/* Replace the multiple mapState.polygons.map sections with this single */}

        {mapState.polygons.map((polygon, index) => (
          <PolygonF
            key={polygon.id}
            path={polygon.path}
            options={{
              fillColor: "#FFFF00",
              fillOpacity: 0.35,
              strokeColor: "#00FF00",
              strokeOpacity: 1.0,
              strokeWeight: 2,
            }}
            onClick={(e) => handlePolygonClick(polygon, index, false, e)}
          />
        ))}

        {mapState.isDrawingPolygon &&
          mapState.currentPolygonPoints.length > 0 && (
            <>
              {mapState.isPolygonClosed ? (
                <PolygonF
                  path={mapState.currentPolygonPoints}
                  options={{
                    fillColor: "#FFFF00",
                    fillOpacity: 0.35,
                    strokeColor: "#00FF00",
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                  }}
                  onClick={(e) => {
                    const newPolygon = {
                      id: `temp-${Date.now()}`,
                      path: [...mapState.currentPolygonPoints],
                    };
                    handlePolygonClick(
                      newPolygon,
                      mapState.polygons.length,
                      false,
                      e
                    );
                  }}
                />
              ) : (
                <>
                  <PolylineF
                    path={mapState.currentPolygonPoints}
                    options={{
                      strokeColor: "#00FF00",
                      strokeOpacity: 1.0,
                      strokeWeight: 2,
                      geodesic: true,
                    }}
                  />
                  {mapState.mousePosition && (
                    <PolylineF
                      path={[
                        mapState.currentPolygonPoints[
                          mapState.currentPolygonPoints.length - 1
                        ],
                        mapState.mousePosition,
                      ]}
                      options={{
                        strokeColor: "#00FF00",
                        strokeOpacity: 0.7,
                        strokeWeight: 2,
                        geodesic: true,
                      }}
                    />
                  )}
                  {mapState.currentPolygonPoints.length >= 2 &&
                    !mapState.mousePosition && (
                      <PolylineF
                        path={[
                          mapState.currentPolygonPoints[
                            mapState.currentPolygonPoints.length - 1
                          ],
                          mapState.currentPolygonPoints[0],
                        ]}
                        options={{
                          strokeColor: "#00FF00",
                          strokeOpacity: 0.5,
                          strokeWeight: 2,
                          geodesic: true,
                        }}
                      />
                    )}
                </>
              )}
              {/* Keep markers visible whether closed or not */}
              {mapState.currentPolygonPoints.map((point, index) => (
                <MarkerF
                  key={`drawing-point-${index}-${point.lat}-${point.lng}`}
                  position={point}
                  draggable={true}
                  onDragEnd={(e) => handlePointDrag(index, e)}
                  icon={{
                    url:
                      index === 0 ? "/img/location.jpg" : "/img/location.jpg",
                    scaledSize: new google.maps.Size(20, 20),
                  }}
                  onClick={() => handleMarkerClick(index)}
                />
              ))}
            </>
          )}

        {mapState.showSavedPolygons &&
          mapState.savedPolygons.map((polygon, index) => (
            <PolygonF
              key={polygon.id}
              path={polygon.path}
              options={{
                fillColor: "#0000FF",
                fillOpacity: 0.35,
                strokeColor: "#0000FF",
                strokeOpacity: 1.0,
                strokeWeight: 2,
              }}
              onClick={(e) => handlePolygonClick(polygon, index, true, e)}
            />
          ))}

        {mapState.selectedPolygon && mapState.polygonActionPosition && (
          <div
            className="polygon-action-modal"
            style={{
              position: "absolute",
              top: `${mapState.polygonActionPosition.y - 100}px`,
              left: `${mapState.polygonActionPosition.x}px`,
              background: "white",
              borderRadius: "8px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
              padding: "8px",
              zIndex: 1000,
            }}
          >
            <div
              className="action-buttons"
              style={{ display: "flex", gap: "8px" }}
            >
              {!mapState.selectedPolygon.isSaved && (
                <button
                  onClick={savePolygon}
                  title="Save Polygon"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={20} className="text-green-500" />
                </button>
              )}
              {mapState.selectedPolygon.isSaved && (
                <button
                  onClick={editPolygon}
                  title="Edit Polygon"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  <Edit2 size={20} className="text-blue-500" />
                </button>
              )}
              <button
                onClick={deletePolygon}
                title="Delete Polygon"
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={20} className="text-red-500" />
              </button>
              <button
                onClick={() =>
                  setMapState((prev) => ({
                    ...prev,
                    selectedPolygon: null,
                    polygonActionPosition: null,
                  }))
                }
                title="Close"
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "20px", color: "#666" }}>×</span>
              </button>
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "-5px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid white",
              }}
            />
          </div>
        )}

        {mapState.imageIcons.map((icon, index) => (
          <MarkerF
            key={`image-icon-${icon.id}-${index}`}
            position={{ lat: icon.lat, lng: icon.lng }}
            draggable={true}
            icon={{
              url: icon.imageUrl || iconImages[icon.type],
              scaledSize: new google.maps.Size(30, 30),
            }}
            onDragEnd={(e) => handleMarkerDragEnd(index, e)}
            onClick={(e) => (icon.linkedTo ? handleIconClick(icon, e) : null)}
            onRightClick={() => handleRightClickOnIcon(icon)}
          />
        ))}
        {mapState.rightClickMarker && (
          <MarkerF
            key={`right-click-${mapState.rightClickMarker.lat}-${mapState.rightClickMarker.lng}`}
            position={mapState.rightClickMarker}
            icon={{
              url: "/img/location.jpg",
              scaledSize: new google.maps.Size(20, 20),
            }}
          />
        )}
        {/* Render saved icons */}
        {mapState.showSavedRoutes &&
          mapState.savedIcons.map((icon, index) => (
            <MarkerF
              // key={icon.id || `saved-icon-${index}`}
              key={`saved-icon-${icon.id || index}`} // Use icon.id or index to ensure uniqueness
              position={{ lat: icon.lat, lng: icon.lng }}
              icon={{
                url: icon.imageUrl || iconImages[icon.type],
                scaledSize: new google.maps.Size(30, 30),
              }}
            />
          ))}
        {/* Current Fiber Lines with Waypoints */}
        {mapState.fiberLines.map((line, index) => {
          const fullPath = [line.from, ...(line.waypoints || []), line.to];

          return (
            <React.Fragment key={line.id || `fiber-line-${index}`}>
              <PolylineF
                path={fullPath}
                options={{
                  strokeColor: line.strokeColor || "#FF0000",
                  strokeOpacity: 1.0,
                  strokeWeight: 2,
                  editable: false,
                }}
                onClick={(e) => {
                  // Add this to prevent conflicts with waypoint clicks
                  e.domEvent.stopPropagation();
                  handleLineClick(line, index, false, e);
                }}
              />
              {/* This is the existing floating modal in your code, slightly refined */}
              {mapState.selectedLineForActions &&
                mapState.exactClickPosition && (
                  <div
                    className="line-action-modal"
                    style={{
                      top: `${mapState.exactClickPosition.y - 95}px`,
                      left: `${mapState.exactClickPosition.x}px`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="line-action-item" onClick={addWaypoint}>
                      <Plus size={20} className="text-gray-600" />
                      <span className="line-action-tooltip">Add Waypoint</span>
                    </div>

                    <div
                      className="line-action-item"
                      onClick={removeSelectedLine}
                    >
                      <Trash2 size={20} className="text-red-500" />
                      <span className="line-action-tooltip">Delete Line</span>
                    </div>

                    <div
                      className="line-action-item"
                      onClick={() =>
                        setMapState((prev) => ({
                          ...prev,
                          selectedLineForActions: null,
                          lineActionPosition: null,
                          exactClickPosition: null,
                        }))
                      }
                    >
                      <span className="line-action-close">&times;</span>
                      <span className="line-action-tooltip">Close</span>
                    </div>

                    <div className="modal-spike"></div>
                  </div>
                )}
              {/* Waypoint Markers with Drag Functionality */}
              {(line.waypoints || []).map((waypoint, waypointIndex) => (
                <React.Fragment key={`waypoint-${index}-${waypointIndex}`}>
                  <MarkerF
                    position={waypoint}
                    draggable
                    onDragEnd={(e) =>
                      handleWaypointDragEnd(index, waypointIndex, e)
                    }
                    icon={{
                      url: "/img/location.jpg",
                      scaledSize: new google.maps.Size(15, 15),
                    }}
                    onClick={(e) => {
                      console.log("Marker clicked:", waypoint);
                      // Stop propagation to prevent other click handlers from firing
                      if (e.domEvent) e.domEvent.stopPropagation();
                      handleWaypointClick(
                        index,
                        waypointIndex,
                        false,
                        waypoint,
                        e
                      );
                    }}
                  />
                </React.Fragment>
              ))}

              {/* Way points modal */}

              {mapState.selectedWaypoint && mapState.waypointActionPosition && (
                <div
                  className="line-action-modal"
                  style={{
                    top: `${mapState.waypointActionPosition.y - 100}px`,
                    left: `${mapState.waypointActionPosition.x - 74}px`,
                  }}
                >
                  {/* Remove Waypoint Button */}
                  <div
                    className="line-action-item"
                    onClick={removeSelectedWaypoint}
                  >
                    <Trash2 size={20} color="red" />
                    <span className="line-action-tooltip">Remove</span>
                  </div>

                  {/* Add Device Icon Button */}
                  <div
                    className="line-action-item"
                    onClick={openDeviceIconSelection}
                  >
                    <Plus size={20} color="blue" />
                    <span className="line-action-tooltip">Device</span>
                  </div>

                  {/* Close Button */}
                  <div
                    className="line-action-item"
                    onClick={closeWaypointActions}
                  >
                    <span className="close-icon">&times;</span>
                    <span className="line-action-tooltip">Close</span>
                  </div>

                  <div className="modal-spike"></div>
                </div>
              )}

              {/* Start and End Markers */}
              <MarkerF
                position={line.from}
                draggable
                onDragEnd={(e) => handleStartMarkerDragEnd(index, e)}
                icon={{
                  url: "/img/location.jpg",
                  scaledSize: new google.maps.Size(20, 20),
                }}
              />
              <MarkerF
                position={line.to}
                draggable
                onDragEnd={(e) => handleEndMarkerDragEnd(index, e)}
                icon={{
                  url: "/img/location.jpg",
                  scaledSize: new google.maps.Size(20, 20),
                }}
              />
            </React.Fragment>
          );
        })}
        {/* Saved Polylines with Waypoints */}
        {mapState.showSavedRoutes &&
          mapState.savedPolylines.map((polyline, index) => {
            const fullPath = [
              polyline.from,
              ...(polyline.waypoints || []),
              polyline.to,
            ];

            return (
              <React.Fragment
                key={`saved-polyline-${polyline.id || polylineIndex}`}
              >
                <PolylineF
                  path={fullPath}
                  options={{
                    strokeColor: "#0000FF",
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                  }}
                  onClick={(e) => handleLineClick(polyline, index, true, e)}
                />

                {/* Waypoint Markers for Saved Polylines */}
                {(polyline.waypoints || []).map((waypoint, waypointIndex) => (
                  <MarkerF
                    key={`saved-waypoint-${index}-${waypointIndex}`}
                    position={waypoint}
                    icon={{
                      url: "/img/location.jpg",
                      scaledSize: new google.maps.Size(15, 15),
                    }}
                    onClick={(e) =>
                      handleWaypointClick(
                        index,
                        waypointIndex,
                        true,
                        waypoint,
                        e
                      )
                    }
                  />
                ))}
              </React.Fragment>
            );
          })}
        {/* Saved Icons with Drag Functionality */}
        {mapState.showSavedRoutes &&
          mapState.savedIcons.map((icon) => (
            <MarkerF
              key={icon.id || `saved-icon-${index}`}
              position={{ lat: icon.lat, lng: icon.lng }}
              icon={{
                url: icon.imageUrl || iconImages[icon.type],
                scaledSize: new google.maps.Size(30, 30),
              }}
              draggable={mapState.isSavedRoutesEditable}
              onClick={(e) => (icon.linkedTo ? handleIconClick(icon, e) : null)}
              onDragEnd={
                mapState.isSavedRoutesEditable
                  ? (e) => handleSavedIconDragEnd(icon.id, e)
                  : undefined
              }
            />
          ))}
        {/* Saved Polylines with Editable Waypoints */}
        {mapState.showSavedRoutes &&
          mapState.savedPolylines.map((polyline, polylineIndex) => {
            const fullPath = [
              polyline.from,
              ...(polyline.waypoints || []),
              polyline.to,
            ];

            return (
              <React.Fragment
                key={polyline.id || `saved-polyline-${polylineIndex}`}
              >
                <PolylineF
                  path={fullPath}
                  options={{
                    strokeColor: "#0000FF",
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                  }}
                  onClick={(e) =>
                    handleLineClick(polyline, polylineIndex, true, e)
                  }
                />

                {/* Start and End Markers */}
                <MarkerF
                  position={polyline.from}
                  draggable={mapState.isSavedRoutesEditable}
                  onDragEnd={
                    mapState.isSavedRoutesEditable
                      ? (e) =>
                          handleSavedPolylinePointDragEnd(
                            polyline.id,
                            "from",
                            e
                          )
                      : undefined
                  }
                  icon={{
                    url: "/img/location.jpg",
                    scaledSize: new google.maps.Size(20, 20),
                  }}
                />

                <MarkerF
                  position={polyline.to}
                  draggable={mapState.isSavedRoutesEditable}
                  onDragEnd={
                    mapState.isSavedRoutesEditable
                      ? (e) =>
                          handleSavedPolylinePointDragEnd(polyline.id, "to", e)
                      : undefined
                  }
                  icon={{
                    url: "/img/location.jpg",
                    scaledSize: new google.maps.Size(20, 20),
                  }}
                />

                {/* Waypoint Markers */}
                {(polyline.waypoints || []).map((waypoint, waypointIndex) => (
                  <MarkerF
                    key={`saved-waypoint-${polylineIndex}-${waypointIndex}`}
                    position={waypoint}
                    draggable={mapState.isSavedRoutesEditable}
                    onDragEnd={
                      mapState.isSavedRoutesEditable
                        ? (e) =>
                            handleSavedPolylineWaypointDragEnd(
                              polyline.id,
                              waypointIndex,
                              e
                            )
                        : undefined
                    }
                    icon={{
                      url: "/img/location.jpg",
                      scaledSize: new google.maps.Size(15, 15),
                    }}
                    onClick={(e) =>
                      handleWaypointClick(
                        polylineIndex,
                        waypointIndex,
                        true,
                        waypoint,
                        e
                      )
                    }
                  />
                ))}
              </React.Fragment>
            );
          })}
      </GoogleMap>

      {mapState.showModal && mapState.selectedPoint && (
        <div
          className="modal"
          style={{
            top: `${mapState.selectedPoint.y - 110}px`,
            left: `${mapState.selectedPoint.x - 210}px`,
          }}
        >
          <button
            className="modal-close"
            onClick={() =>
              setMapState((prevState) => ({
                ...prevState,
                showModal: false,
                rightClickMarker: null,
              }))
            }
          >
            &times;
          </button>

          <p className="modal-title">Select a type:</p>

          <div className="modal-buttons">
            {Object.keys(iconImages).map((type) => (
              <button
                key={type}
                onClick={() => handleSelection(type)}
                className="modal-button"
              >
                {type}
              </button>
            ))}

            <button className="modal-button" onClick={addFiberLine}>
              Add Fiber
            </button>
          </div>
          <div className="modal-spike"></div>
        </div>
      )}
    </>
  );
};

export default MyMapV10;
