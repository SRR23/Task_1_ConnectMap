import React, { useState, useCallback, useRef } from "react";
import { GoogleMap, MarkerF, PolylineF } from "@react-google-maps/api";
import { Plus, Trash2 } from "lucide-react";

const containerStyle = { width: "100%", height: "600px" };
const defaultCenter = { lat: 23.7925, lng: 90.4078 }; // Gulshan, Dhaka coordinates
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
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
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

const MapComponent = React.memo(
  ({
    imageIcons,
    fiberLines,
    savedPolylines,
    rightClickMarker,
    showSavedRoutes,
    selectedLineForActions,
    exactClickPosition,
    modifiedCables,
    isSnappedToIcon,
    handleMapRightClick,
    handleIconClick,
    handleLineClick,
    handleMarkerDragEnd,
    handleStartMarkerDragEnd,
    handleEndMarkerDragEnd,
    handleWaypointDragEnd,
    handleSavedPolylinePointDragEnd,
    handleSavedPolylineWaypointDragEnd,
    addWaypoint,
    removeSavedSelectedLine,
    setFiberLines,
    setSelectedLineForActions,
    setLineActionPosition,
    setExactClickPosition,
    setModifiedCables,
    setHasEditedCables,
    onMapLoad,
    handleWaypointClick,
  }) => {
    

    const [searchQuery, setSearchQuery] = useState("");
    const mapRef = useRef(null); // Store map instance

    // Handle map load and geolocation
    const handleMapLoad = useCallback(
      (map) => {
        mapRef.current = map; // Store map instance
        if (onMapLoad) {
          onMapLoad(map);
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              map.setCenter(userLocation);
              map.setZoom(15);
            },
            (error) => {
              console.error("Error getting user location:", error);
              map.setCenter(defaultCenter);
              map.setZoom(15);
            },
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            }
          );
        } else {
          console.error("Geolocation is not supported by this browser.");
          map.setCenter(defaultCenter);
          map.setZoom(15);
        }
      },
      [onMapLoad]
    );

    // Handle search submission
    const handleSearch = useCallback(() => {
      if (!searchQuery.trim()) return;

      // Use Google Maps Geocoding API
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: searchQuery }, (results, status) => {
        if (status === "OK" && results[0]) {
          const location = results[0].geometry.location;
          const newCenter = {
            lat: location.lat(),
            lng: location.lng(),
          };
          mapRef.current.setCenter(newCenter);
          mapRef.current.setZoom(15); // Adjust zoom level for city view
        } else {
          console.error(
            "Geocode was not successful for the following reason:",
            status
          );
          alert("City not found. Please try again.");
        }
      });
    }, [searchQuery]);

    // Handle Enter key press
    const handleKeyPress = (e) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    };


    return (

      <div style={{ position: "relative" }}>
        {/* Search Input Field */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            backgroundColor: "white",
            padding: "5px",
            borderRadius: "4px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter city name"
            style={{
              padding: "8px",
              width: "200px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: "8px 12px",
              marginLeft: "5px",
              backgroundColor: "#4285F4",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </div>

        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={15}
          onRightClick={handleMapRightClick}
          options={{ styles: mapStyles, disableDefaultUI: false }}
          onLoad={handleMapLoad}
        >
          {/* Render Device Icons */}
          {imageIcons.map((icon) => (
            <MarkerF
              key={icon.id}
              position={{ lat: icon.lat, lng: icon.lng }}
              draggable={true}
              icon={{
                url: icon.imageUrl || "/img/default-icon.png",
                scaledSize: new window.google.maps.Size(30, 30),
                anchor: new window.google.maps.Point(15, 15),
              }}
              onDragEnd={(e) => handleMarkerDragEnd(icon.id, e)}
              onClick={(e) => handleIconClick(icon, e)}
            />
          ))}

          {/* Render Right-Click Marker */}
          {rightClickMarker && (
            <MarkerF
              key={`right-click-${rightClickMarker.lat}-${rightClickMarker.lng}`}
              position={rightClickMarker}
              icon={{
                url: "",
                scaledSize: new window.google.maps.Size(20, 20),
              }}
            />
          )}

          {/* Render Temporary Fiber Lines */}
          {fiberLines.map((line, index) => {
            const fullPath = [line.from, ...(line.waypoints || []), line.to];
            return (
              <React.Fragment key={line.id}>
                {/* Invisible Polyline for Click Detection */}
                <PolylineF
                  path={fullPath}
                  options={{
                    strokeColor: "#000000",
                    strokeOpacity: 0,
                    strokeWeight: 20,
                    zIndex: 99,
                  }}
                  onClick={(e) => handleLineClick(line, index, false, e)}
                />
                {/* Visible Polyline */}
                <PolylineF
                  path={fullPath}
                  options={{
                    strokeColor: "#FF0000",
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                    zIndex: 100,
                  }}
                  onClick={(e) => handleLineClick(line, index, false, e)}
                />
                {/* Line Action Modal */}
                {selectedLineForActions &&
                  exactClickPosition &&
                  !selectedLineForActions.isSavedLine &&
                  selectedLineForActions.index === index && (
                    <div
                      className="line-action-modal"
                      style={{
                        position: "absolute",
                        top: `${exactClickPosition.y - 160}px`,
                        left: `${exactClickPosition.x - 285}px`,
                        transform: "translate(-50%, -100%)",
                        zIndex: 1000,
                      }}
                    >
                      <div className="line-action-item" onClick={addWaypoint}>
                        <Plus size={20} className="text-gray-600" />
                        <span className="line-action-tooltip">Add Waypoint</span>
                      </div>
                      <div
                        className="line-action-item"
                        onClick={() => {
                          setFiberLines((prev) =>
                            prev.filter((_, i) => i !== index)
                          );
                          setSelectedLineForActions(null);
                          setLineActionPosition(null);
                          setExactClickPosition(null);
                        }}
                      >
                        <Trash2 size={20} className="text-red-500" />
                        <span className="line-action-tooltip">Delete Line</span>
                      </div>
                      <div
                        className="line-action-item"
                        onClick={() => {
                          setSelectedLineForActions(null);
                          setLineActionPosition(null);
                          setExactClickPosition(null);
                        }}
                      >
                        <span className="line-action-close">×</span>
                        <span className="line-action-tooltip">Close</span>
                      </div>
                      <div className="modal-spike"></div>
                    </div>
                  )}
                {/* Render Waypoints */}
                {(line.waypoints || []).map((waypoint, waypointIndex) => (
                  <MarkerF
                    key={`waypoint-${line.id}-${waypointIndex}-${waypoint.lat}-${waypoint.lng}`}
                    position={waypoint}
                    draggable={true}
                    onDragEnd={(e) =>
                      handleWaypointDragEnd(index, waypointIndex, e)
                    }
                    onClick={(e) =>
                      handleWaypointClick(line, index, waypointIndex, false, e)
                    }

                    icon={{
                      // Define a custom symbol for a round waypoint
                      path: window.google.maps.SymbolPath.CIRCLE, // Built-in circle shape
                      scale: 8, // Size of the circle (adjust as needed)
                      fillColor: '#FFFFFF', // White fill, typical for Google Maps waypoints
                      fillOpacity: 1, // Fully opaque
                      strokeColor: '#000000', // Black border
                      strokeWeight: 2, // Border thickness
                      strokeOpacity: 1, // Fully opaque border
                    }}
                  />
                ))}
                {/* Render Start Marker (if not snapped) */}
                {!isSnappedToIcon(line.from.lat, line.from.lng) && (
                  <MarkerF
                    key={`start-${line.id}`}
                    position={line.from}
                    draggable={true}
                    onDragEnd={(e) => handleStartMarkerDragEnd(index, e)}

                    icon={{
                      // Define a custom symbol for a round waypoint
                      path: window.google.maps.SymbolPath.CIRCLE, // Built-in circle shape
                      scale: 8, // Size of the circle (adjust as needed)
                      fillColor: '#FFFFFF', // White fill, typical for Google Maps waypoints
                      fillOpacity: 1, // Fully opaque
                      strokeColor: '#000000', // Black border
                      strokeWeight: 2, // Border thickness
                      strokeOpacity: 1, // Fully opaque border
                    }}
                  />
                )}
                {/* Render End Marker (if not snapped) */}
                {!isSnappedToIcon(line.to.lat, line.to.lng) && (
                  <MarkerF
                    key={`end-${line.id}`}
                    position={line.to}
                    draggable={true}
                    onDragEnd={(e) => handleEndMarkerDragEnd(index, e)}

                    icon={{
                      // Define a custom symbol for a round waypoint
                      path: window.google.maps.SymbolPath.CIRCLE, // Built-in circle shape
                      scale: 8, // Size of the circle (adjust as needed)
                      fillColor: '#FFFFFF', // White fill, typical for Google Maps waypoints
                      fillOpacity: 1, // Fully opaque
                      strokeColor: '#000000', // Black border
                      strokeWeight: 2, // Border thickness
                      strokeOpacity: 1, // Fully opaque border
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Render Saved Polylines */}
          {showSavedRoutes &&
            savedPolylines.map((polyline, index) => {
              const isModified = !!modifiedCables[polyline.id];
              const displayPolyline = isModified
                ? modifiedCables[polyline.id]
                : polyline;
              const fullPath = [
                displayPolyline.from,
                ...(displayPolyline.waypoints || []),
                displayPolyline.to,
              ];

              return (
                <React.Fragment key={`saved-polyline-${polyline.id}`}>
                  {/* Invisible Polyline for Click Detection */}
                  <PolylineF
                    path={fullPath}
                    options={{
                      strokeColor: "#000000",
                      strokeOpacity: 0,
                      strokeWeight: 20,
                      zIndex: 99,
                    }}
                    onClick={(e) => handleLineClick(polyline, index, true, e)}
                  />
                  {/* Visible Polyline */}
                  <PolylineF
                    path={fullPath}
                    options={{
                      strokeColor: "#0000FF", // Blue for saved lines
                      strokeOpacity: 1.0,
                      strokeWeight: 2,
                      zIndex: 100,
                    }}
                    onClick={(e) => handleLineClick(polyline, index, true, e)}
                  />
                  {/* Line Action Modal */}
                  {selectedLineForActions &&
                    exactClickPosition &&
                    selectedLineForActions.isSavedLine &&
                    selectedLineForActions.index === index && (
                      <div
                        className="line-action-modal"
                        style={{
                          position: "absolute",
                          top: `${exactClickPosition.y - 160}px`,
                          left: `${exactClickPosition.x - 285}px`,
                          transform: "translate(-50%, -100%)",
                          zIndex: 1000,
                        }}
                      >
                        <div className="line-action-item" onClick={addWaypoint}>
                          <Plus size={20} className="text-gray-600" />
                          <span className="line-action-tooltip">
                            Add Waypoint
                          </span>
                        </div>
                        <div
                          className="line-action-item"
                          onClick={removeSavedSelectedLine}
                        >
                          <Trash2 size={20} className="text-red-500" />
                          <span className="line-action-tooltip">Delete Line</span>
                        </div>
                        <div
                          className="line-action-item"
                          onClick={() => {
                            if (isModified) {
                              setModifiedCables((prev) => {
                                const updated = { ...prev };
                                delete updated[polyline.id];
                                return updated;
                              });
                              setHasEditedCables(
                                Object.keys(modifiedCables).length > 1
                              );
                            }
                            setSelectedLineForActions(null);
                            setLineActionPosition(null);
                            setExactClickPosition(null);
                          }}
                        >
                          <span className="line-action-close">×</span>
                          <span className="line-action-tooltip">Close</span>
                        </div>
                        <div className="modal-spike"></div>
                      </div>
                    )}
                  {/* Render Waypoints */}
                  {(displayPolyline.waypoints || []).map(
                    (waypoint, waypointIndex) => (
                      <MarkerF
                        key={`saved-waypoint-${polyline.id}-${waypointIndex}-${waypoint.lat}-${waypoint.lng}`}
                        position={waypoint}
                        draggable={true}
                        onDragEnd={(e) =>
                          handleSavedPolylineWaypointDragEnd(
                            polyline.id,
                            waypointIndex,
                            e
                          )
                        }
                        onClick={(e) =>
                          handleWaypointClick(
                            polyline,
                            index,
                            waypointIndex,
                            true,
                            e
                          )
                        }

                        icon={{
                          // Define a custom symbol for a round waypoint
                          path: window.google.maps.SymbolPath.CIRCLE, // Built-in circle shape
                          scale: 8, // Size of the circle (adjust as needed)
                          fillColor: '#FFFFFF', // White fill, typical for Google Maps waypoints
                          fillOpacity: 1, // Fully opaque
                          strokeColor: '#000000', // Black border
                          strokeWeight: 2, // Border thickness
                          strokeOpacity: 1, // Fully opaque border
                        }}
                      />
                    )
                  )}
                  {/* Render Start Marker (if not snapped) */}
                  {!isSnappedToIcon(
                    displayPolyline.from.lat,
                    displayPolyline.from.lng
                  ) && (
                      <MarkerF
                        key={`saved-start-${polyline.id}`}
                        position={displayPolyline.from}
                        draggable={true}
                        onDragEnd={(e) =>
                          handleSavedPolylinePointDragEnd(polyline.id, "from", e)
                        }

                        icon={{
                          // Define a custom symbol for a round waypoint
                          path: window.google.maps.SymbolPath.CIRCLE, // Built-in circle shape
                          scale: 8, // Size of the circle (adjust as needed)
                          fillColor: '#FFFFFF', // White fill, typical for Google Maps waypoints
                          fillOpacity: 1, // Fully opaque
                          strokeColor: '#000000', // Black border
                          strokeWeight: 2, // Border thickness
                          strokeOpacity: 1, // Fully opaque border
                        }}
                      />
                    )}
                  {/* Render End Marker (if not snapped) */}
                  {!isSnappedToIcon(
                    displayPolyline.to.lat,
                    displayPolyline.to.lng
                  ) && (
                      <MarkerF
                        key={`saved-end-${polyline.id}`}
                        position={displayPolyline.to}
                        draggable={true}
                        onDragEnd={(e) =>
                          handleSavedPolylinePointDragEnd(polyline.id, "to", e)
                        }

                        icon={{
                          // Define a custom symbol for a round waypoint
                          path: window.google.maps.SymbolPath.CIRCLE, // Built-in circle shape
                          scale: 8, // Size of the circle (adjust as needed)
                          fillColor: '#FFFFFF', // White fill, typical for Google Maps waypoints
                          fillOpacity: 1, // Fully opaque
                          strokeColor: '#000000', // Black border
                          strokeWeight: 2, // Border thickness
                          strokeOpacity: 1, // Fully opaque border
                        }}
                      />
                    )}
                </React.Fragment>
              );
            })}
        </GoogleMap>
      </div>
    );
  }
);

export default MapComponent;