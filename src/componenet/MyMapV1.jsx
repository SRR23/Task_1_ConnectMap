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

const MyMapV1 = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const [selectedPoints, setSelectedPoints] = useState([]);
  const [directions, setDirections] = useState(null);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  const [nextNumber, setNextNumber] = useState(1);
  const [totalDistance, setTotalDistance] = useState(null); // 🔹 New State for Distance

  useEffect(() => {
    const storedRoutes = JSON.parse(localStorage.getItem("savedRoutes")) || [];
    setSavedRoutes(storedRoutes);

    let highestNumber = 0;
    storedRoutes.forEach((route) => {
      route.points.forEach((point) => {
        if (point.number > highestNumber) highestNumber = point.number;
      });
    });

    setNextNumber(highestNumber + 1);
  }, []);

  const handleMapClick = useCallback(
    (e) => {
      const newPoint = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        number: nextNumber,
      };

      setSelectedPoints((prev) => [...prev, newPoint]);
      setNextNumber((prev) => prev + 1);

      updateDirections([...selectedPoints, newPoint]);
    },
    [selectedPoints, nextNumber]
  );

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
          waypoints: waypoints,
          optimizeWaypoints: true, // 🔴 Enable shortest route optimization
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK") {
            setDirections(result);

            // 🔹 Calculate total distance (in km)
            const totalDistanceMeters = result.routes[0].legs.reduce(
              (sum, leg) => sum + leg.distance.value,
              0
            );
            const totalDistanceKm = (totalDistanceMeters / 1000).toFixed(2); // Convert to km & keep 2 decimals

            setTotalDistance(totalDistanceKm); // Update state
          } else {
            console.error("Error fetching directions:", status);
          }
        }
      );
    }
  };

  const saveRoute = () => {
    if (selectedPoints.length >= 2 && directions) {
      const newRoute = { points: selectedPoints, directions };
      const updatedRoutes = [...savedRoutes, newRoute];
      setSavedRoutes(updatedRoutes);
      localStorage.setItem("savedRoutes", JSON.stringify(updatedRoutes));
      alert("Route saved successfully!");
    }
  };

  const togglePreviousRoutes = () => {
    if (showSavedRoutes) {
      setShowSavedRoutes(false);
      setSelectedPoints([]);
      setDirections(null);
    } else {
      const storedRoutes =
        JSON.parse(localStorage.getItem("savedRoutes")) || [];
      if (storedRoutes.length > 0) {
        setSavedRoutes(storedRoutes);
        setShowSavedRoutes(true);

        const lastRoute = storedRoutes[storedRoutes.length - 1];
        setSelectedPoints(lastRoute.points);
        setDirections(lastRoute.directions);

        let highestNumber = Math.max(...lastRoute.points.map((p) => p.number));
        setNextNumber(highestNumber + 1);
      }
    }
  };

  const resetMap = () => {
    setSelectedPoints([]);
    setDirections(null);
    setShowSavedRoutes(false);
    setTotalDistance(null); // Reset distance
    setNextNumber(1);
  };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    <>
      <div>
        <button onClick={resetMap}>Reset Map</button>
        <button onClick={saveRoute}>Save Route</button>
        <button onClick={togglePreviousRoutes}>
          {showSavedRoutes ? "Hide Previous Routes" : "Show Previous Routes"}
        </button>
      </div>

      {totalDistance && <h3>Total Distance: {totalDistance} km</h3>}

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={7}
        onClick={handleMapClick}
      >
        {/* District Markers */}
        {districts.map((district) => (
          <MarkerF
            key={district.id}
            position={{ lat: district.lat, lng: district.lng }}
            title={district.name}
          />
        ))}

        {/* Show Current Route Markers */}
        {selectedPoints.map((point, index) => (
          <MarkerF
            key={index}
            position={{ lat: point.lat, lng: point.lng }}
            label={{
              text: `${index + 1}`,
              color: "white",
              fontWeight: "bold",
            }}
          />
        ))}

        {/* Show Current Route */}
        {directions && <DirectionsRenderer directions={directions} />}

        {/* Show Saved Routes */}
        {showSavedRoutes &&
          savedRoutes.map((route, index) => (
            <DirectionsRenderer key={index} directions={route.directions} />
          ))}

        {/* Show Markers for Previous Routes */}
        {showSavedRoutes &&
          savedRoutes.map((route, routeIndex) =>
            route.points.map((point, pointIndex) => (
              <MarkerF
                key={`saved-${routeIndex}-${pointIndex}`}
                position={{ lat: point.lat, lng: point.lng }}
                label={{
                  text: `${pointIndex + 1}`, // Always use numbers (1, 2, 3...)
                  color: "white",
                  fontWeight: "bold",
                }}
              />
            ))
          )}
      </GoogleMap>
    </>
  );
};

export default MyMapV1;
