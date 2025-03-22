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
    stylers: [{ visibility: "simplified" }],
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

const MyMapV3 = () => {
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
    directions: null,
    savedRoutes: [],
    showSavedRoutes: false,
    nextNumber: 1,
    totalDistance: null,
    selectedType: null,
    showModal: false,
    selectedPoint: null,
    rightClickMarker: null,
    selectedRouteIndex: null, // Track the index of the selected route
  });

  useEffect(() => {
    const storedRoutes = JSON.parse(localStorage.getItem("savedRoutes")) || [];
    const nextNumber = parseInt(localStorage.getItem("nextNumber")) || 1;
    setMapState((prevState) => ({
      ...prevState,
      savedRoutes: storedRoutes,
      nextNumber: nextNumber,
    }));
  }, []);

  const handleMapRightClick = useCallback(
    (e) => {
      e.domEvent.preventDefault(); // Prevent default right-click behavior

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
        showModal: true,
        rightClickMarker: clickedPoint,
      }));
    },
    [mapState.nextNumber]
  );

  const handleClose = () => {
    setMapState((prevState) => ({
      ...prevState,
      showModal: false,
      rightClickMarker: null,
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

    // Update the selected points state
    setMapState((prevState) => ({
      ...prevState,
      selectedPoints: updatedPoints,
    }));

    // Update the continuous line by recalculating the directions every time a new point is selected
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
        number: mapState.nextNumber, // Save the route with the current number
      };

      let updatedRoutes = [...mapState.savedRoutes];

      if (mapState.selectedRouteIndex !== null) {
        // Extend the existing route
        updatedRoutes[mapState.selectedRouteIndex].points = [
          ...updatedRoutes[mapState.selectedRouteIndex].points,
          ...mapState.selectedPoints,
        ];
        updatedRoutes[mapState.selectedRouteIndex].directions = mapState.directions;
      } else {
        // If it's a new route, just add it to saved routes
        updatedRoutes.push(newRoute);
      }

      setMapState((prevState) => ({
        ...prevState,
        savedRoutes: updatedRoutes,
        selectedPoints: [],
        directions: null,
        selectedRouteIndex: null, // Reset selected route after saving
      }));

      localStorage.setItem("savedRoutes", JSON.stringify(updatedRoutes));

      if (mapState.selectedRouteIndex === null) {
        // Increment the next number only when adding a new route
        const newNextNumber = mapState.nextNumber + 1;
        localStorage.setItem("nextNumber", newNextNumber.toString());
        setMapState((prevState) => ({
          ...prevState,
          nextNumber: newNextNumber,
        }));
      }

      alert("Route saved successfully!");
    }
  };

  const togglePreviousRoutes = () => {
    setMapState((prevState) => ({
      ...prevState,
      showSavedRoutes: !prevState.showSavedRoutes,
    }));
  };

  const resetMap = () => {
    setMapState({
      selectedPoints: [],
      directions: null,
      savedRoutes: mapState.savedRoutes,
      showSavedRoutes: false,
      nextNumber: mapState.nextNumber,
      totalDistance: null,
      selectedType: null,
      showModal: false,
      selectedPoint: null,
      rightClickMarker: null,
      selectedRouteIndex: null, // Reset selected route
    });
  };

  const handleSelectRoute = (routeIndex) => {
    const selectedRoute = mapState.savedRoutes[routeIndex];

    setMapState((prevState) => ({
      ...prevState,
      selectedPoints: selectedRoute.points, // Keep original points
      directions: selectedRoute.directions, // Keep original directions
      selectedRouteIndex: routeIndex, // Set selected route index for extension
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
      </div>

      {mapState.totalDistance && (
        <h3>Total Distance: {mapState.totalDistance} km</h3>
      )}

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
        {mapState.selectedPoints.length === 0 &&
          districts.map((district) => (
            <MarkerF key={district.id} position={district} title={district.name} />
          ))}

        {mapState.rightClickMarker && (
          <MarkerF
            position={{
              lat: mapState.rightClickMarker.lat,
              lng: mapState.rightClickMarker.lng,
            }}
            icon={{
              url: "/img/location.jpg",
              scaledSize: new google.maps.Size(20, 20),
            }}
          />
        )}

        {mapState.selectedPoints.map((point, index) => (
          <MarkerF
            key={`waypoint-${index}`}
            position={{ lat: point.lat, lng: point.lng }}
            icon={{
              url: iconImages[point.type] || "",
              scaledSize: new google.maps.Size(30, 30),
            }}
          />
        ))}

        {mapState.showSavedRoutes &&
          mapState.savedRoutes.map((route, routeIndex) => (
            <React.Fragment key={routeIndex}>
              <button
                style={{
                  position: "absolute",
                  top: `${route.points[0].y}px`,
                  left: `${route.points[0].x}px`,
                  backgroundColor: "white",
                  padding: "5px",
                  border: "1px solid black",
                }}
                onClick={() => handleSelectRoute(routeIndex)}
              >
                Extend Route {route.number}
              </button>

              {route.points.map((point, pointIndex) => (
                <MarkerF
                  key={`saved-waypoint-${routeIndex}-${pointIndex}`}
                  position={{ lat: point.lat, lng: point.lng }}
                  icon={{
                    url: iconImages[point.type],
                    scaledSize: new google.maps.Size(30, 30),
                  }}
                />
              ))}
              <DirectionsRenderer
                directions={route.directions}
                options={{ suppressMarkers: true }}
              />
            </React.Fragment>
          ))}

        {mapState.directions && (
          <DirectionsRenderer
            directions={mapState.directions}
            options={{
              suppressMarkers: true,
            }}
          />
        )}
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
          <div className="modal-spike"></div>
        </div>
      )}
    </>
  );
};

export default MyMapV3;
