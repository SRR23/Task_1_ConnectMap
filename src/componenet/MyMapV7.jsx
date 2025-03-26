import React, { useState, useEffect, useCallback } from "react";
import {
  GoogleMap,
  useLoadScript,
  MarkerF,
  PolylineF,
} from "@react-google-maps/api";

import { Trash2 } from "lucide-react"; // Import delete icon

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

const MyMapV7 = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const iconImages = {
    BTS: "/img/BTS.png",
    Termination: "/img/Termination.png",
    Splitter: "/img/Splitter.png",
    ONU: "/img/ONU.png",
  };

  const [mapState, setMapState] = useState({
    // selectedPoints: [],
    savedRoutes: [],
    nextNumber: 1,
    selectedType: null,
    showModal: false,
    selectedPoint: null,
    rightClickMarker: null,
    fiberLines: [],
    imageIcons: [],
    // directions: null,
    // totalDistance: null,
    showSavedRoutes: false,
    // hoveredLineIndex: null, 
    savedPolylines: [], // New field to store individually saved polylines
    selectedLine: null, // Added to track the selected line
    selectedLineId: null, // Added to track the selected line's unique ID
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

  // Modified handleRightClickOnLine to work with both current and saved polylines
  const handleRightClickOnLine = (line, index, isSavedLine = false, e) => {
    e.domEvent.preventDefault();
    const clickedPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
      x: e.domEvent.clientX,
      y: e.domEvent.clientY,
    };

    setMapState((prevState) => ({
      ...prevState,
      selectedLine: index,
      selectedLineId: line.id, // Store the unique ID of the selected line
      selectedPoint: clickedPoint,
      showModal: true,
    }));

    console.log("Selected Line:", line, "Index:", index);
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

    // Calculate an intermediate waypoint
    const waypoint = {
      lat: (fiberLineStart.lat + fiberLineEnd.lat) / 2,
      lng: (fiberLineStart.lng + fiberLineEnd.lng) / 2,
    };

    const newFiberLine = {
      id: mapState.fiberLines.length,
      from: fiberLineStart,
      to: fiberLineEnd,
      waypoints: [waypoint], // Add initial waypoint
    };

    setMapState((prevState) => ({
      ...prevState,
      fiberLines: [...prevState.fiberLines, newFiberLine],
      showModal: false,
      selectedPoint: null,
      rightClickMarker: null,
    }));
  };

  const handlePolylineEdit = (index, path) => {
    const updatedLines = mapState.fiberLines.map((line, i) =>
      i === index
        ? {
            ...line,
            from: { lat: path.getAt(0).lat(), lng: path.getAt(0).lng() },
            to: {
              lat: path.getAt(path.getLength() - 1).lat(),
              lng: path.getAt(path.getLength() - 1).lng(),
            },
          }
        : line
    );
    setMapState((prevState) => ({
      ...prevState,
      fiberLines: updatedLines,
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


  // New function to handle waypoint addition and movement
  const handleWaypointDragEnd = (lineIndex, waypointIndex, e) => {
    setMapState((prevState) => {
      const updatedLines = prevState.fiberLines.map((line, index) => {
        if (index === lineIndex) {
          const updatedWaypoints = [...line.waypoints];
          updatedWaypoints[waypointIndex] = {
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
          };
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

  // Modified saveRoute function
  const saveRoute = () => {
    // Save polylines
    if (mapState.fiberLines.length > 0) {
      const polylinesToSave = mapState.fiberLines.map((line, index) => ({
        id: `polyline-${Date.now()}-${index}`,
        from: { ...line.from }, 
        to: { ...line.to },
        waypoints: line.waypoints || [], // Save waypoints
        createdAt: new Date().toISOString(),
        strokeColor: "#0000FF", // Ensure blue color when saving
      }));

      const savedPolylines = JSON.parse(localStorage.getItem("savedPolylines")) || [];
      const updatedSavedPolylines = [...savedPolylines, ...polylinesToSave];
      localStorage.setItem("savedPolylines", JSON.stringify(updatedSavedPolylines));

      setMapState((prevState) => ({
        ...prevState,
        savedPolylines: updatedSavedPolylines,
        // Automatically show saved routes and update the state
        showSavedRoutes: true,
        fiberLines: updatedSavedPolylines.map(polyline => ({
          from: polyline.from,
          to: polyline.to,
          id: polyline.id,
          waypoints: polyline.waypoints || [],
          strokeColor: "#0000FF", // Ensure blue color
        })),
      }));
    }

    // Save icons
    if (mapState.imageIcons.length > 0) {
      const iconsToSave = mapState.imageIcons.map((icon, index) => ({
        id: `icon-${Date.now()}-${index}`,
        lat: icon.lat,
        lng: icon.lng,
        type: icon.type,
        createdAt: new Date().toISOString(),
      }));

      const savedIcons = JSON.parse(localStorage.getItem("savedIcons")) || [];
      const updatedSavedIcons = [...savedIcons, ...iconsToSave];
      localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));

      setMapState((prevState) => ({
        ...prevState,
        savedIcons: updatedSavedIcons,
        // Automatically show saved icons
        imageIcons: updatedSavedIcons.map(icon => ({
          lat: icon.lat,
          lng: icon.lng,
          type: icon.type,
          id: icon.id
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
    const savedPolylines = JSON.parse(localStorage.getItem("savedPolylines")) || [];
    
    // Load saved icons from localStorage
    const savedIcons = JSON.parse(localStorage.getItem("savedIcons")) || [];

    setMapState((prevState) => ({
      ...prevState,
      savedPolylines: savedPolylines,
      savedIcons: savedIcons,
    }));
  }, []);

  // Update togglePreviousRoutes to handle both polylines and icons
  const togglePreviousRoutes = () => {
    setMapState((prevState) => {
      const showSaved = !prevState.showSavedRoutes;
      return {
        ...prevState,
        showSavedRoutes: showSaved,
        fiberLines: showSaved
          ? prevState.savedPolylines.map(polyline => ({
              from: polyline.from,
              to: polyline.to,
              id: polyline.id,
              waypoints: polyline.waypoints || [],
              strokeColor: "#0000FF" // Add blue color for saved polylines
            }))
          : [],
        imageIcons: showSaved
          ? prevState.savedIcons.map(icon => ({
              lat: icon.lat,
              lng: icon.lng,
              type: icon.type,
              id: icon.id
            }))
          : [],
      };
    });
  };



  useEffect(() => {
    // This effect will run every time mapState changes
    // You can check if changes occurred in the fiberLines or imageIcons
    console.log("State has been updated", mapState);
  }, [mapState]); // This will run whenever mapState changes


  // Updated removeSelectedLine to handle both current and saved polylines
  const removeSelectedLine = () => {
    if (mapState.selectedLineId === null) {
      console.log("No line selected for deletion.");
      return;
    }

    // Remove from current fiberLines
    const updatedFiberLines = mapState.fiberLines.filter(
      (line) => line.id !== mapState.selectedLineId
    );

    // Remove from savedPolylines in localStorage
    const savedPolylines = JSON.parse(localStorage.getItem("savedPolylines")) || [];
    const updatedSavedPolylines = savedPolylines.filter(
      (polyline) => polyline.id !== mapState.selectedLineId
    );
    
    // Update localStorage
    localStorage.setItem("savedPolylines", JSON.stringify(updatedSavedPolylines));

    // Update state
    setMapState((prevState) => ({
      ...prevState,
      fiberLines: updatedFiberLines,
      savedPolylines: updatedSavedPolylines,
      selectedLine: null,
      selectedLineId: null,
      showModal: false,
    }));
  };

  useEffect(() => {
    console.log("Selected Line:", mapState.selectedLine);
  }, [mapState.selectedLine]);

  const resetMap = () => {
    setMapState({
      // selectedPoints: [],
      // directions: null,
      savedRoutes: mapState.savedRoutes,
      showSavedRoutes: false,
      nextNumber: 1,
      // totalDistance: null,
      selectedType: null,
      showModal: false,
      selectedPoint: null,
      rightClickMarker: null,
      fiberLines: [],
      imageIcons: [],
    });
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
      </div>

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
              url: iconImages[icon.type],
              scaledSize: new google.maps.Size(30, 30),
            }}
            onDragEnd={(e) => handleMarkerDragEnd(index, e)}
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
              key={icon.id || `saved-icon-${index}`}
              position={{ lat: icon.lat, lng: icon.lng }}
              icon={{
                url: iconImages[icon.type],
                scaledSize: new google.maps.Size(30, 30),
              }}
            />
          ))}

        {/* Saved Polylines */}
        {/* {mapState.showSavedRoutes &&
          mapState.savedPolylines.map((polyline, index) => (
            <PolylineF
              key={polyline.id || `saved-polyline-${index}`}
              path={[polyline.from, polyline.to]}
              options={{
                strokeColor: "#0000FF",
                strokeOpacity: 1.0,
                strokeWeight: 2,
              }}
              onRightClick={(e) => handleRightClickOnLine(polyline, index, true, e)}
            />
          ))} */}

        {/* Current Fiber Lines with Waypoints */}
        {mapState.fiberLines.map((line, index) => {
          const fullPath = [
            line.from, 
            ...(line.waypoints || []), 
            line.to
          ];

          return (
            <React.Fragment key={line.id || `fiber-line-${index}`}>
              <PolylineF
                path={fullPath}
                options={{
                  strokeColor: line.strokeColor || "#FF0000",
                  strokeOpacity: 1.0,
                  strokeWeight: 2,
                  editable: true,
                }}
                onRightClick={(e) => handleRightClickOnLine(line, index, false, e)}
              />

              {/* Waypoint Markers with Drag Functionality */}
              {(line.waypoints || []).map((waypoint, waypointIndex) => (
                <MarkerF
                  key={`waypoint-${index}-${waypointIndex}`}
                  position={waypoint}
                  draggable
                  onDragEnd={(e) => handleWaypointDragEnd(index, waypointIndex, e)}
                  icon={{
                    url: "/img/location.jpg",
                    scaledSize: new google.maps.Size(15, 15),
                  }}
                />
              ))}

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
              polyline.to
            ];

            return (
              <React.Fragment key={polyline.id || `saved-polyline-${index}`}>
                <PolylineF
                  path={fullPath}
                  options={{
                    strokeColor: "#0000FF",
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                  }}
                  onRightClick={(e) => handleRightClickOnLine(polyline, index, true, e)}
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
            left: `${mapState.selectedPoint.x - 238}px`,
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
            <button className="modal-button" onClick={removeSelectedLine}>
              <Trash2 size={20} />
            </button>
          </div>

          <div className="modal-spike"></div>
        </div>
      )}
    </>
  );
};

export default MyMapV7;
