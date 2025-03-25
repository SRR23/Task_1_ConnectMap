import React, { useState, useEffect, useCallback } from "react";
import {
  GoogleMap,
  useLoadScript,
  MarkerF,
  PolylineF,
} from "@react-google-maps/api";

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

const MyMapV5 = () => {
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
    selectedPoints: [],
    savedRoutes: [],
    nextNumber: 1,
    selectedType: null,
    showModal: false,
    selectedPoint: null,
    rightClickMarker: null,
    fiberLines: [],
    imageIcons: [],
    directions: null,
    totalDistance: null,
    showSavedRoutes: false,
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

  const handleRightClickOnIcon = (icon) => {
    setMapState((prevState) => ({
      ...prevState,
      selectedPoint: icon,
      rightClickMarker: icon,
      showModal: true,
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

    const newFiberLine = {
      id: mapState.fiberLines.length,
      from: fiberLineStart,
      to: fiberLineEnd,
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

  // Function to save the route after the state has updated
  const saveRoute = () => {
    // We need to access the current updated state here.
    const updatedFiberLines = mapState.fiberLines.map((line) => ({
      from: { ...line.from }, // Ensure a deep copy to prevent mutation issues
      to: { ...line.to },
    }));

    const updatedImageIcons = mapState.imageIcons.map((icon) => ({
      lat: icon.lat,
      lng: icon.lng,
      type: icon.type,
      id: icon.id,
    }));

    const newRoute = {
      fiberLines: updatedFiberLines,
      imageIcons: updatedImageIcons,
    };

    // Save the new route into localStorage
    setMapState((prevState) => {
      const updatedRoutes = [...prevState.savedRoutes, newRoute];
      localStorage.setItem("savedRoutes", JSON.stringify(updatedRoutes));
      return {
        ...prevState,
        savedRoutes: updatedRoutes,
      };
    });

    alert("Route saved successfully!");
  };

  const togglePreviousRoutes = () => {
    setMapState((prevState) => {
      const showSaved = !prevState.showSavedRoutes;
      return {
        ...prevState,
        showSavedRoutes: showSaved,
        fiberLines: showSaved
          ? prevState.savedRoutes.flatMap((route) => route.fiberLines)
          : [],
        imageIcons: showSaved
          ? prevState.savedRoutes.flatMap((route) => route.imageIcons)
          : [],
      };
    });
  };

  useEffect(() => {
    // Load the saved routes from localStorage when the component is mounted
    const savedRoutes = JSON.parse(localStorage.getItem("savedRoutes")) || [];
    setMapState((prevState) => ({
      ...prevState,
      savedRoutes: savedRoutes,
    }));
  }, []); // Empty dependency array ensures this effect runs only once when the component mounts
  

  useEffect(() => {
    // This effect will run every time mapState changes
    // You can check if changes occurred in the fiberLines or imageIcons
    console.log("State has been updated", mapState);
  }, [mapState]); // This will run whenever mapState changes

  const resetMap = () => {
    setMapState({
      selectedPoints: [],
      directions: null,
      savedRoutes: mapState.savedRoutes,
      showSavedRoutes: false,
      nextNumber: 1,
      totalDistance: null,
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

        {mapState.showSavedRoutes &&
          mapState.savedRoutes.map((route, routeIndex) => (
            <React.Fragment key={`saved-route-${routeIndex}`}>
              {route.fiberLines.map((line, lineIndex) => (
                <PolylineF
                  key={`saved-fiber-${routeIndex}-${lineIndex}`} // Unique key
                  path={[line.from, line.to]}
                  options={{
                    strokeColor: "#0000FF",
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                  }}
                />
              ))}
              {route.imageIcons.map((icon, iconIndex) => (
                <MarkerF
                  key={`saved-icon-${routeIndex}-${iconIndex}`} // Unique key
                  position={{ lat: icon.lat, lng: icon.lng }}
                  icon={{
                    url: iconImages[icon.type],
                    scaledSize: new google.maps.Size(30, 30),
                  }}
                />
              ))}
            </React.Fragment>
          ))}

        {mapState.fiberLines.map((line, index) => {
          // Check if line.id exists, else fallback to index
          const lineId = line.id || `fiber-line-${index}`; // Use index if id is undefined

          return (
            <React.Fragment key={lineId}>
              <PolylineF
                path={[line.from, line.to]}
                options={{
                  strokeColor: "#FF0000",
                  strokeOpacity: 1.0,
                  strokeWeight: 2,
                  editable: true, // Allows dragging the polyline
                }}
                onLoad={(polyline) => {
                  const path = polyline.getPath();
                  path.addListener("set_at", () =>
                    handlePolylineEdit(index, path)
                  );
                  path.addListener("insert_at", () =>
                    handlePolylineEdit(index, path)
                  );
                }}
                onUnmount={(polyline) => {
                  const path = polyline.getPath();
                  google.maps.event.clearInstanceListeners(path);
                }}
              />

              {/* Start Marker (line.from) */}
              <MarkerF
                position={line.from}
                draggable
                onDragEnd={(e) => handleStartMarkerDragEnd(index, e)}
                icon={{
                  url: "/img/location.jpg", // Replace with your custom icon URL
                  scaledSize: new google.maps.Size(20, 20), // Size of the icon (adjust as needed)
                }}
              />

              {/* End Marker (line.to) */}
              <MarkerF
                position={line.to}
                draggable
                onDragEnd={(e) => handleEndMarkerDragEnd(index, e)}
                icon={{
                  url: "/img/location.jpg", // Replace with your custom icon URL
                  scaledSize: new google.maps.Size(20, 20), // Size of the icon (adjust as needed)
                }}
              />
            </React.Fragment>
          );
        })}
      </GoogleMap>

      {mapState.showModal && mapState.selectedPoint && (
        <div
          className="modal"
          style={{
            top: `${mapState.selectedPoint.y - 110}px`,
            left: `${mapState.selectedPoint.x - 209}px`,
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

export default MyMapV5;
