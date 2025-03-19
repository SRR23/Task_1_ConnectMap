import React, { useState, useEffect, useCallback } from "react";
import {
  GoogleMap,
  useLoadScript,
  Polyline,
  MarkerF,
} from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "600px",
};

const center = { lat: 23.685, lng: 90.3563 };
const libraries = [];

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

const calculateDistance = (point1, point2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2); // Distance in km
};

const MyMap = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [map, setMap] = useState(null);
  const [polylines, setPolylines] = useState([]);
  const [currentPolyline, setCurrentPolyline] = useState([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  const [mapPolylines, setMapPolylines] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [lastPoint, setLastPoint] = useState(null);
  const [distance, setDistance] = useState(null);
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [shortestDistance, setShortestDistance] = useState(null);

  useEffect(() => {
    const savedPolylines = JSON.parse(localStorage.getItem("polylines")) || [];
    setPolylines(savedPolylines);

    const savedStartPoint = JSON.parse(localStorage.getItem("startPoint"));
    const savedLastPoint = JSON.parse(localStorage.getItem("lastPoint"));

    if (savedStartPoint) setStartPoint(savedStartPoint);
    if (savedLastPoint) setLastPoint(savedLastPoint);
  }, []);

  const handleMapClick = useCallback(
    (e) => {
      const newPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };

      if (selectedPoints.length < 2) {
        setSelectedPoints((prev) => [...prev, newPoint]);
      } else {
        setSelectedPoints([newPoint]);
      }

      setCurrentPolyline((prev) => {
        if (prev.length === 0 && startPoint === null) {
          setStartPoint(newPoint);
          localStorage.setItem("startPoint", JSON.stringify(newPoint));
        }
        return [...prev, newPoint];
      });
    },
    [startPoint, selectedPoints]
  );

  useEffect(() => {
    if (selectedPoints.length === 2) {
      setShortestDistance(calculateDistance(selectedPoints[0], selectedPoints[1]));
    }
  }, [selectedPoints]);

  useEffect(() => {
    if (showSavedRoutes && map) {
      mapPolylines.forEach((polyline) => polyline.setMap(null));
      const newPolylines = polylines.map((path) => {
        const polyline = new window.google.maps.Polyline({
          path,
          strokeColor: "#0000FF",
          strokeWeight: 3,
        });
        polyline.setMap(map);
        return polyline;
      });
      setMapPolylines(newPolylines);
    } else {
      mapPolylines.forEach((polyline) => polyline.setMap(null));
      setMapPolylines([]);
    }
  }, [showSavedRoutes, polylines, map]);

  const saveCurrentRoute = () => {
    if (currentPolyline.length > 1) {
      const updatedPolylines = [...polylines, currentPolyline];
      setPolylines(updatedPolylines);
      localStorage.setItem("polylines", JSON.stringify(updatedPolylines));

      const lastPoint = currentPolyline[currentPolyline.length - 1];
      localStorage.setItem("lastPoint", JSON.stringify(lastPoint));
      setLastPoint(lastPoint);

      setCurrentPolyline([]);
      alert("Route saved!");
    } else {
      alert("You need at least two points to save a route.");
    }
  };

  const toggleSavedRoutes = () => {
    setShowSavedRoutes((prev) => !prev);
  };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    <>
      <div>
        <button onClick={() => setCurrentPolyline([])}>Delete Current Route</button>
        <button onClick={toggleSavedRoutes}>
          {showSavedRoutes ? "Hide Previous Routes" : "Show Previous Routes"}
        </button>
        <button onClick={saveCurrentRoute}>Save This Route</button>
        <button onClick={() => setSelectedPoints([])}>Reset Selection</button>
      </div>
      {distance && <p>Last Route Distance: {distance} km</p>}
      {shortestDistance && <p>Selected Points Distance: {shortestDistance} km</p>}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={7}
        onLoad={(map) => setMap(map)}
        onClick={handleMapClick}
      >
        {districts.map((district) => (
          <MarkerF
            key={district.id}
            position={{ lat: district.lat, lng: district.lng }}
            title={district.name}
          />
        ))}
        {currentPolyline.length > 0 && (
          <Polyline
            path={currentPolyline}
            options={{ strokeColor: "#FF0000", strokeWeight: 3 }}
          />
        )}
        {startPoint && <MarkerF position={startPoint} title="Start Point" />}
        {lastPoint && <MarkerF position={lastPoint} title="Last Saved Point" />}
        {selectedPoints.map((point, index) => (
          <MarkerF key={index} position={point} title={`Point ${index + 1}`} />
        ))}
      </GoogleMap>
    </>
  );
};

export default MyMap;
