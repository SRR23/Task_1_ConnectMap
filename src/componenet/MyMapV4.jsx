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
    stylers: [{ visibility: "off" }], // Hides water bodies
  },
];

const MyMapV4 = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const iconImages = {
    BTS: "/img/BTS.png",
    Termination: "/img/Termination.png",
    Splitter: "/img/Splitter.png",
    ONU: "/img/ONU.png",
  };

  const customIcon = "/img/location.jpg"; // Replace with your custom marker image

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
    fiberPoints: [],
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

  const addFiberLine = () => {
    const { selectedPoint, fiberPoints } = mapState;
    if (!selectedPoint) return;
  
    // Close the modal when "Add Fiber" is clicked
    setMapState((prevState) => ({
      ...prevState,
      showModal: false, // Close the modal
      selectedPoint: null, // Clear the selected point (right-click icon will disappear)
      rightClickMarker: null, // Clear the right-click marker as well
    }));
  
    // 1 km in latitude (since 1 degree latitude = ~111 km)
    const latChange = 1 / 111; // ~0.009009 degrees
  
    // Longitude change to ensure 1 km distance at the current latitude
    const lonChange = 1 / (111 * Math.cos((selectedPoint.lat * Math.PI) / 180));
  
    // Calculate new point 1 km away in both lat and lon
    const newLat = selectedPoint.lat + latChange;
    const newLng = selectedPoint.lng + lonChange;
  
    
  
    const newPoints = [
      ...fiberPoints,
      selectedPoint,
      { lat: newLat, lng: newLng },
    ];
  
    setMapState((prevState) => ({
      ...prevState,
      fiberPoints: newPoints,
    }));
  
    updateDirections(newPoints);
  };


  const updateDirections = (points) => {
    if (points.length < 2) return;

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: points[0],
        destination: points[points.length - 1],
        waypoints: points.slice(1, -1).map((point) => ({
          location: point,
          stopover: true,
        })),
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
  };

  const handleMarkerDragEnd = (index, e) => {
    const updatedPoints = [...mapState.fiberPoints];
    updatedPoints[index] = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setMapState((prevState) => ({
      ...prevState,
      fiberPoints: updatedPoints,
    }));

    updateDirections(updatedPoints);
  };

  const handleSelection = (type) => {
    const { selectedPoint, nextNumber } = mapState;
    setMapState((prevState) => ({
      ...prevState,
      selectedType: type,
      showModal: false,
      selectedPoints: [
        ...prevState.selectedPoints,
        { ...selectedPoint, type, number: nextNumber },
      ],
      nextNumber: nextNumber + 1,
    }));

    updateDirections([...mapState.selectedPoints, { ...selectedPoint, type }]);
  };

  const handleClose = () => {
    setMapState((prevState) => ({
      ...prevState,
      showModal: false,
      rightClickMarker: null,
    }));
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
        updatedState.selectedPoints =
          updatedState.savedRoutes[updatedState.savedRoutes.length - 1].points;
      } else {
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
      rightClickMarker: null,
      fiberPoints: [],
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
        onRightClick={handleMapRightClick}
        options={{
          styles: mapStyles,
          disableDefaultUI: false,
        }}
      >
        {/* Render fiber points as draggable markers with custom icon */}
        {mapState.fiberPoints.map((point, index) => (
          <MarkerF
            key={`fiber-${index}-${point.lat}-${point.lng}`} // Unique key using lat and lng
            position={point}
            draggable={true}
            icon={{
              url: customIcon, // Custom icon
              scaledSize: new google.maps.Size(20, 20), // Custom size 20x20
            }}
            onDragEnd={(e) => handleMarkerDragEnd(index, e)}
          />
        ))}

        {/* Render right-click marker */}
        {mapState.rightClickMarker && (
          <MarkerF
            key={`right-click-${mapState.rightClickMarker.lat}-${mapState.rightClickMarker.lng}`} // Unique key for right-click marker
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

        {mapState.directions && (
          <DirectionsRenderer
            directions={mapState.directions}
            options={{ suppressMarkers: true }}
          />
        )}

        {mapState.selectedPoints.map((point, index) => (
          <MarkerF
            key={`waypoint-${index}-${point.lat}-${point.lng}`} // Unique key using lat and lng
            position={{ lat: point.lat, lng: point.lng }}
            icon={{
              url: iconImages[point.type],
              scaledSize: new google.maps.Size(30, 30),
            }}
          />
        ))}

        {/* Show previously saved routes */}
        {mapState.showSavedRoutes && mapState.savedRoutes.length > 0 &&
          mapState.savedRoutes.map((route, index) => (
            <DirectionsRenderer
              key={`saved-route-${index}`}
              directions={route.directions}
              options={{ suppressMarkers: true }}
            />
          ))
        }
      </GoogleMap>

      {/* Modal for selecting marker type */}
      {mapState.showModal && mapState.selectedPoint && (
        <div
          className="modal"
          style={{
            top: `${mapState.selectedPoint.y - 110}px`,
            left: `${mapState.selectedPoint.x - 209}px`,
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

            {/* Add Fiber Button inside Modal */}
          <button className="modal-button" onClick={addFiberLine}>Add Fiber</button>
          </div>

          <div className="modal-spike"></div>

          
        </div>
      )}
    </>
  );
};

export default MyMapV4;
