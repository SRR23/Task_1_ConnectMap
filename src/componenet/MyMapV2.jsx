import React, { useState, useEffect, useCallback } from "react";
import {
  GoogleMap,
  useLoadScript,
  DirectionsRenderer,
  MarkerF,
} from "@react-google-maps/api";

const containerStyle = { width: "100%", height: "600px" };
const center = { lat: 23.685, lng: 90.3563 };

const mapStyles = [
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ visibility: "off" }], // Hides unnecessary borders
  },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [
      { visibility: "on" }, // Ensures the Bangladesh border is visible
      { color: "#2c3e50" }, // Red color for clear visibility
      { weight: 2 }, // Thick border
    ],
  },
  {
    featureType: "poi",
    elementType: "all",
    stylers: [{ visibility: "off" }], // Hides points of interest
  },
  {
    featureType: "transit",
    elementType: "all",
    stylers: [{ visibility: "off" }], // Hides transit stops
  },
  {
    featureType: "landscape",
    elementType: "all",
    stylers: [{ visibility: "simplified" }], // Hides parks, grass, etc.
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ visibility: "simplified" }], // Keeps roads visible
  },
  {
    featureType: "water",
    elementType: "all",
    stylers: [{ visibility: "simplified" }], // Hides water bodies
  },
];

const districts = [
  { id: 1, name: "Dhaka", lat: 23.8103, lng: 90.4125 },
  { id: 2, name: "Chattogram", lat: 22.3569, lng: 91.7832 },
  { id: 3, name: "Khulna", lat: 22.8456, lng: 89.5403 },
  { id: 4, name: "Rajshahi", lat: 24.3636, lng: 88.6241 },
  { id: 5, name: "Sylhet", lat: 24.8949, lng: 91.8687 },
  { id: 6, name: "Barishal", lat: 22.701, lng: 90.3535 },
  { id: 7, name: "Rangpur", lat: 25.7439, lng: 89.2752 },
  { id: 8, name: "Mymensingh", lat: 24.7471, lng: 90.4203 },
];

const MyMap = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // Define your icons for each type
  const iconImages = {
    BTS: "/img/BTS.png", // Replace with actual URL or path to your icon
    Termination: "/img/Termination.png",
    Splitter: "/img/Splitter.png",
    ONU: "/img/ONU.png",
  };

  const [mapState, setMapState] = useState({
    selectedPoints: [],
    directions: null,
    savedRoutes: [],
    showSavedRoutes: false,
    nextNumber: 1,
    totalDistance: null,
    selectedType: null,
    showModal: false,
    selectedPoint: null,
    rightClickMarker: null, // Track the right-click marker
  });

  useEffect(() => {
    const storedRoutes = JSON.parse(localStorage.getItem("savedRoutes")) || [];
    setMapState((prevState) => ({
      ...prevState,
      savedRoutes: storedRoutes,
    }));
  }, []);

  const handleMapRightClick = useCallback(
    (e) => {
      // console.log("Right-click detected at:", e.latLng.lat(), e.latLng.lng());
      // console.log(
      //   "Client coordinates:",
      //   e.domEvent.clientX,
      //   e.domEvent.clientY
      // );

      e.domEvent.preventDefault(); // Prevent default right-click behavior

      const clickedPoint = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        number: mapState.nextNumber,
        x: e.domEvent.clientX, // Ensure these values are correct
        y: e.domEvent.clientY,
      };

      setMapState((prevState) => ({
        ...prevState,
        selectedPoint: clickedPoint,
        showModal: true,
        rightClickMarker: clickedPoint, // Store the marker
      }));
    },
    [mapState.nextNumber]
  );

  // close modal
  const handleClose = () => {
    setMapState((prevState) => ({
      ...prevState,
      showModal: false,
      rightClickMarker: null, // Reset right-click marker
    }));
  };

  const handleSelection = (type) => {
    if (!mapState.selectedPoint) return;
    setMapState((prevState) => ({
      ...prevState,
      showModal: false,
      selectedType: type,
    }));

    const newPoint = { ...mapState.selectedPoint, type };
    const updatedPoints = [...mapState.selectedPoints, newPoint];
    setMapState((prevState) => ({
      ...prevState,
      selectedPoints: updatedPoints,
      nextNumber: prevState.nextNumber + 1,
    }));
    updateDirections(updatedPoints);
  };

  const updateDirections = (points) => {
    if (points.length >= 2) {
      const waypoints = points.slice(1, -1).map((point) => ({
        location: point,
        stopover: true,
      }));

      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: points[0],
          destination: points[points.length - 1],
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK") {
            const totalDistanceMeters = result.routes[0].legs.reduce(
              (sum, leg) => sum + leg.distance.value,
              0
            );
            setMapState((prevState) => ({
              ...prevState,
              directions: result,
              totalDistance: (totalDistanceMeters / 1000).toFixed(2),
            }));
          }
        }
      );
    }
  };

  const saveRoute = () => {
    if (mapState.selectedPoints.length >= 2 && mapState.directions) {
      const newRoute = {
        points: mapState.selectedPoints,
        directions: mapState.directions,
      };
      const updatedRoutes = [...mapState.savedRoutes, newRoute];
      setMapState((prevState) => ({
        ...prevState,
        savedRoutes: updatedRoutes,
      }));
      localStorage.setItem("savedRoutes", JSON.stringify(updatedRoutes));
      alert("Route saved successfully!");
    }
  };

  const togglePreviousRoutes = () => {
    setMapState((prevState) => {
      const updatedState = {
        ...prevState,
        showSavedRoutes: !prevState.showSavedRoutes,
      };

      if (updatedState.showSavedRoutes && updatedState.savedRoutes.length > 0) {
        // Set selectedPoints from the last added saved route dynamically
        updatedState.selectedPoints =
          updatedState.savedRoutes[updatedState.savedRoutes.length - 1].points;
      } else {
        // Otherwise, clear the selected points
        updatedState.selectedPoints = [];
      }

      return updatedState;
    });
  };

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
      rightClickMarker: null, // Reset right-click marker
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

      {mapState.totalDistance && (
        <h3>Total Distance: {mapState.totalDistance} km</h3>
      )}

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={7}
        onRightClick={handleMapRightClick} // Now it works on right-click
        options={{
          styles: mapStyles, // Apply the custom style here
          disableDefaultUI: false, // Keep controls visible
        }}
      >
        {/* Render district markers ONLY if the user hasn't started selecting a route */}
        {mapState.selectedPoints.length === 0 &&
          districts.map((district) => (
            <MarkerF
              key={district.id}
              position={district}
              title={district.name}
            />
          ))}

        {/* Add right-click marker */}
        {mapState.rightClickMarker && (
          <MarkerF
            position={{
              lat: mapState.rightClickMarker.lat,
              lng: mapState.rightClickMarker.lng,
            }}
            icon={{
              url: "/img/location.jpg", // Add an icon for the right-click marker
              scaledSize: new google.maps.Size(20, 20),
            }}
          />
        )}

        {mapState.directions && (
          <DirectionsRenderer
            directions={mapState.directions}
            options={{ suppressMarkers: true }}
          />
        )}

        {/* Custom Markers for Directions */}
        {mapState.selectedPoints.map((point, index) => (
          <MarkerF
            key={`waypoint-${index}`}
            position={{ lat: point.lat, lng: point.lng }}
            icon={{
              url: iconImages[point.type], // Use selected type’s icon
              scaledSize: new google.maps.Size(30, 30), // Adjust icon size
            }}
          />
        ))}

        {mapState.showSavedRoutes &&
          mapState.savedRoutes.map((route, index) => (
            <DirectionsRenderer
              key={index}
              directions={route.directions}
              options={{ suppressMarkers: true }}
            />
          ))}
      </GoogleMap>

      {mapState.showModal && mapState.selectedPoint && (
        <div
          className="modal"
          style={{
            top: `${mapState.selectedPoint.y - 110}px`,
            left: `${mapState.selectedPoint.x - 162}px`,
          }}
        >
          <button className="modal-close" onClick={handleClose}>
            &times;
          </button>

          <p className="modal-title">Select a type:</p>

          {/* Wrapping buttons in a div to ensure spacing */}
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
          </div>
          {/* Spike added here */}
          <div className="modal-spike"></div>
        </div>
      )}
    </>
  );
};

export default MyMap;
