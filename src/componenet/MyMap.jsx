import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  MarkerF,
  PolylineF,
} from "@react-google-maps/api";

import { Trash2, Plus } from "lucide-react"; // Import delete icon

const containerStyle = { width: "100%", height: "600px" };
const center = { lat: 23.685, lng: 90.3563 };

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

const MyMap = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const fileInputRef = useRef(null);

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
  });

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
        // Clear any selected waypoint when right-clicking on the map
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

    // Only proceed if:
    // 1. It's a saved line AND saved routes are being shown
    // 2. Saved routes are editable OR this is a current (non-saved) line
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

    // Only allow actions on waypoints if:
    // 1. It's a regular line OR
    // 2. It's a saved line AND saved routes are being shown AND are editable
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

      // This is no longer needed since we're doing a complete state update above
      // setTimeout(() => {
      //   console.log("Updated state after timeout:", mapState.selectedWaypoint);
      // }, 100);
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
        iconId: icon.id
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

  // Modify useEffect to load both saved polylines and icons
  useEffect(() => {
    // Load saved polylines from localStorage
    const savedPolylines =
      JSON.parse(localStorage.getItem("savedPolylines")) || [];

    // Load saved icons from localStorage
    const savedIcons = JSON.parse(localStorage.getItem("savedIcons")) || [];

    setMapState((prevState) => ({
      ...prevState,
      savedPolylines: savedPolylines,
      savedIcons: savedIcons,
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

  // useEffect(() => {
  //   // This effect will run every time mapState changes
  //   // You can check if changes occurred in the fiberLines or imageIcons
  //   console.log("State has been updated", mapState);
  // }, [mapState]); // This will run whenever mapState changes

  // useEffect(() => {
  //   console.log("Selected Line:", mapState.selectedLine);
  // }, [mapState.selectedLine]);

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
        {mapState.showSavedRoutes && (
          <button onClick={toggleSavedRoutesEditability}>
            {mapState.isSavedRoutesEditable
              ? "Disable Editing Saved Routes"
              : "Enable Editing Saved Routes"}
          </button>
        )}
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
        onRightClick={handleMapRightClick}
        options={{
          styles: mapStyles,
          disableDefaultUI: false,
        }}
      >
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
            onClick={(e) => icon.linkedTo ? handleIconClick(icon, e) : null}
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
              onClick={(e) => icon.linkedTo ? handleIconClick(icon, e) : null}
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

            {/* New Remove Button */}
            {/* <button className="modal-button" onClick={removeSelectedLine}>
              <Trash2 size={20} />
            </button> */}
          </div>

          <div className="modal-spike"></div>
        </div>
      )}
    </>
  );
};

export default MyMap;
