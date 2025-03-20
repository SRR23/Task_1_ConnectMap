import React, { useState, useEffect, useCallback } from "react";
import {
  GoogleMap,
  useLoadScript,
  DirectionsRenderer,
  MarkerF,
} from "@react-google-maps/api";

const containerStyle = { width: "100%", height: "600px" };
const center = { lat: 23.685, lng: 90.3563 };

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
  });

  useEffect(() => {
    const storedRoutes = JSON.parse(localStorage.getItem("savedRoutes")) || [];
    setMapState((prevState) => ({
      ...prevState,
      savedRoutes: storedRoutes,
    }));
  }, []);

  const handleMapClick = useCallback(
    (e) => {
      const clickedPoint = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        number: mapState.nextNumber,
      };
      setMapState((prevState) => ({
        ...prevState,
        selectedPoint: clickedPoint,
        showModal: true,
      }));
    },
    [mapState.nextNumber]
  );

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

  // const togglePreviousRoutes = () => {
  //   setMapState((prevState) => {
  //     const updatedState = {
  //       ...prevState,
  //       showSavedRoutes: !prevState.showSavedRoutes,
  //     };
  //     if (updatedState.showSavedRoutes && updatedState.savedRoutes.length > 0) {
  //       // If showing saved routes, set selectedPoints from the first saved route
  //       updatedState.selectedPoints = updatedState.savedRoutes[0].points;
  //     } else {
  //       // Otherwise clear the selected points
  //       updatedState.selectedPoints = [];
  //     }
  //     return updatedState;
  //   });
  // };


  const togglePreviousRoutes = () => {
    setMapState((prevState) => {
        const updatedState = {
            ...prevState,
            showSavedRoutes: !prevState.showSavedRoutes,
        };

        if (updatedState.showSavedRoutes && updatedState.savedRoutes.length > 0) {
            // Set selectedPoints from the last added saved route dynamically
            updatedState.selectedPoints = updatedState.savedRoutes[updatedState.savedRoutes.length - 1].points;
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
        onClick={handleMapClick}
      >
        {districts.map((district) => (
          <MarkerF
            key={district.id}
            position={district}
            title={district.name}
          />
        ))}

        {mapState.selectedPoints.map((point, index) => (
          <MarkerF
            key={index}
            position={{ lat: point.lat, lng: point.lng }}
            label={{ text: `${index + 1}`, color: "white", fontWeight: "bold" }}
            icon={{
              url: iconImages[point.type], // Use the icon based on the type
              scaledSize: new google.maps.Size(30, 30), // Adjust the icon size
            }}
          />
        ))}

        {mapState.directions && (
          <DirectionsRenderer directions={mapState.directions} />
        )}

        {mapState.showSavedRoutes &&
          mapState.savedRoutes.map((route, index) => (
            <DirectionsRenderer key={index} directions={route.directions} />
          ))}
      </GoogleMap>

      {mapState.showModal && (
        <div className="modal">
          <p>Select a type:</p>
          <button onClick={() => handleSelection("BTS")}>Add BTS</button>
          <button onClick={() => handleSelection("Termination")}>
            Add Termination
          </button>
          <button onClick={() => handleSelection("Splitter")}>
            Add Splitter
          </button>
          <button onClick={() => handleSelection("ONU")}>Add ONU</button>
        </div>
      )}
    </>
  );
};

export default MyMap;
