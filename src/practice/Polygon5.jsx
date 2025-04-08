import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  GoogleMap,
  LoadScript,
  PolygonF as GooglePolygon,
  PolylineF,
  MarkerF,
} from "@react-google-maps/api";
import { Edit, Trash, Eye, MoreVertical, Lock, Unlock } from "lucide-react";

const libraries = ["drawing"];

const Polygon5 = () => {
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState([]);

  const [polygons, setPolygons] = useState(() => {
    const saved = localStorage.getItem("polygons");
    return saved ? JSON.parse(saved) : [];
  });

  const [polygonName, setPolygonName] = useState("");
  const [currentMousePosition, setCurrentMousePosition] = useState(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isPolygonClosed, setIsPolygonClosed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 51.505, lng: -0.09 });
  const [editingIndex, setEditingIndex] = useState(null);
  const [intermediatePoints, setIntermediatePoints] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("polygons", JSON.stringify(polygons));
  }, [polygons]);

  const updateIntermediatePoints = useCallback(() => {
    if (points.length > 1) {
      const newIntermediatePoints = [];
      for (let i = 0; i < points.length - 1; i++) {
        newIntermediatePoints.push({
          position: calculateMidpoint(points[i], points[i + 1]),
          segmentStart: i,
          segmentEnd: i + 1,
        });
      }
      if (isPolygonClosed && points.length > 2) {
        newIntermediatePoints.push({
          position: calculateMidpoint(points[points.length - 1], points[0]),
          segmentStart: points.length - 1,
          segmentEnd: 0,
        });
      }
      setIntermediatePoints(newIntermediatePoints);
    } else {
      setIntermediatePoints([]);
    }
  }, [points, isPolygonClosed]);

  useEffect(() => {
    updateIntermediatePoints();
  }, [points, isPolygonClosed, updateIntermediatePoints]);

  const mapOptions = {
    zoom: 13,
    clickableIcons: false,
  };

  const calculateDistance = (point1, point2) => {
    const lat1 = point1.lat;
    const lng1 = point1.lng;
    const lat2 = point2.lat;
    const lng2 = point2.lng;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
  };

  const calculateMidpoint = (point1, point2) => {
    return {
      lat: (point1.lat + point2.lat) / 2,
      lng: (point1.lng + point2.lng) / 2,
    };
  };

  const isNearStartingPoint = (point) => {
    if (points.length === 0) return false;
    const startPoint = points[0];
    const distance = calculateDistance(startPoint, point);
    return distance < 50;
  };

  const calculateCentroid = (coordinates) => {
    if (!coordinates || coordinates.length === 0)
      return { lat: 51.505, lng: -0.09 };
    const n = coordinates.length;
    const centroid = coordinates.reduce(
      (acc, point) => ({
        lat: acc.lat + point.lat,
        lng: acc.lng + point.lng,
      }),
      { lat: 0, lng: 0 }
    );
    return {
      lat: centroid.lat / n,
      lng: centroid.lng / n,
    };
  };

  const handleStartMarkerClick = useCallback(() => {
    if (drawing && points.length >= 3) {
      setIsPolygonClosed(true);
    }
  }, [drawing, points.length]);

  const handleMapClick = useCallback(
    (e) => {
      if (!drawing || isDragging) return;

      const newPoint = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };

      if (points.length >= 2 && isNearStartingPoint(newPoint)) {
        setIsPolygonClosed(true);
        return;
      }

      setPoints((prevPoints) => [...prevPoints, newPoint]);
      setIsPolygonClosed(false);
    },
    [drawing, isDragging, points]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (drawing && !isDragging && !isPolygonClosed) {
        setCurrentMousePosition({
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        });
      }
    },
    [drawing, isDragging, isPolygonClosed]
  );

  const handleMapLoad = useCallback((map) => {
    mapRef.current = map;
    setIsMapLoaded(true);
  }, []);

  const handleMapDrag = useCallback(() => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      setMapCenter({
        lat: center.lat(),
        lng: center.lng(),
      });
    }
  }, []);

  const handlePolygonIconClick = () => {
    setDrawing(true);
    setPoints([]);
    setIsPolygonClosed(false);
    setCurrentMousePosition(null);
    setPreviewIndex(null);
    setPolygonName("");
    setEditingIndex(null);
    setIntermediatePoints([]);
  };

  const handleSavePolygon = () => {
    if (points.length > 2 && isPolygonClosed && polygonName) {
      const newPolygon = {
        name: polygonName,
        coordinates: [...points],
        locked: false,
      };
      setPolygons((prev) => {
        const updatedPolygons =
          editingIndex !== null
            ? prev.map((poly, i) => (i === editingIndex ? newPolygon : poly))
            : [...prev, newPolygon];
        localStorage.setItem("polygons", JSON.stringify(updatedPolygons));
        return updatedPolygons;
      });
      setDrawing(false);
      setPoints([]);
      setPolygonName("");
      setCurrentMousePosition(null);
      setIsPolygonClosed(false);
      setPreviewIndex(null);
      setEditingIndex(null);
      setIntermediatePoints([]);
    } else if (!isPolygonClosed) {
      alert("Please close the polygon by clicking near the starting point.");
    } else if (!polygonName) {
      alert("Please provide a name for the polygon.");
    } else {
      alert(
        "Please add at least 3 points, close the polygon, and provide a name."
      );
    }
  };

  const handleEditPolygon = (index) => {
    if (polygons[index].locked) {
      alert("This polygon is locked and cannot be edited.");
      return;
    }

    const polygonToEdit = polygons[index];
    setPoints(polygonToEdit.coordinates);
    setPolygonName(polygonToEdit.name);
    setDrawing(true);
    setIsPolygonClosed(true);
    setPreviewIndex(null);
    setEditingIndex(index);
  };

  const handleCancelDrawing = () => {
    setDrawing(false);
    setPoints([]);
    setPolygonName("");
    setCurrentMousePosition(null);
    setIsPolygonClosed(false);
    setPreviewIndex(null);
    setEditingIndex(null);
    setIntermediatePoints([]);
  };

  const handleDeletePolygon = (index) => {
    if (polygons[index].locked) {
      alert("This polygon is locked and cannot be deleted.");
      return;
    }

    setPolygons((prev) => {
      const updatedPolygons = prev.filter((_, i) => i !== index);
      localStorage.setItem("polygons", JSON.stringify(updatedPolygons));
      return updatedPolygons;
    });
    if (previewIndex === index) {
      setPreviewIndex(null);
    } else if (previewIndex > index) {
      setPreviewIndex((prev) => prev - 1);
    }
  };

  const handlePreviewToggle = (index) => {
    if (previewIndex === index) {
      setPreviewIndex(null);
    } else {
      setPreviewIndex(index);
      const centroid = calculateCentroid(polygons[index].coordinates);
      setMapCenter(centroid);
    }
  };

  const getRubberBandPath = () => {
    if (
      drawing &&
      points.length > 0 &&
      currentMousePosition &&
      !isPolygonClosed
    ) {
      return [points[points.length - 1], currentMousePosition];
    }
    return [];
  };

  const handleMarkerDrag = useCallback((index, event) => {
    const newPoint = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };
    setPoints((prevPoints) => {
      const newPoints = [...prevPoints];
      newPoints[index] = newPoint;
      return newPoints;
    });
  }, []);

  const handleIntermediateDragEnd = useCallback(
    (index) => {
      setIsDragging(false);
      const draggedPoint = intermediatePoints[index];
      const { segmentStart, segmentEnd } = draggedPoint;

      setPoints((prevPoints) => {
        const newPoints = [...prevPoints];
        newPoints.splice(segmentStart + 1, 0, draggedPoint.position);
        return newPoints;
      });

      updateIntermediatePoints();
    },
    [intermediatePoints, updateIntermediatePoints]
  );

  const handleIntermediateDrag = useCallback((index, event) => {
    const newPosition = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };

    setIntermediatePoints((prevPoints) => {
      const newIntermediatePoints = [...prevPoints];
      newIntermediatePoints[index] = {
        ...newIntermediatePoints[index],
        position: newPosition,
      };
      return newIntermediatePoints;
    });
  }, []);

  const handlePointDragStart = useCallback(() => {
    setIsDragging(true);
    setCurrentMousePosition(null);
  }, []);

  const handlePointDragEnd = useCallback(() => {
    setIsDragging(false);
    if (points.length >= 3 && editingIndex === null) {
      setIsPolygonClosed(true);
    }
  }, [points.length, editingIndex]);

  const Sidebar = () => {
    const [openMenuIndex, setOpenMenuIndex] = useState(null);

    const toggleMenu = (index) => {
      setOpenMenuIndex(openMenuIndex === index ? null : index);
    };

    const handleLockToggle = (index) => {
      setPolygons((prev) => {
        const updatedPolygons = prev.map((poly, i) =>
          i === index ? { ...poly, locked: !poly.locked } : poly
        );
        console.log("Locked state:", updatedPolygons[index].locked); // Debug
        localStorage.setItem("polygons", JSON.stringify(updatedPolygons));
        return updatedPolygons;
      });
      setOpenMenuIndex(null);
    };

    return (
      <div className="sidebar">
        <h3>Saved Polygons</h3>
        {polygons.length === 0 ? (
          <p>No polygons saved yet</p>
        ) : (
          <ul>
            {polygons.map((poly, index) => (
              <li key={index} className="polygon-item">
                <div className="polygon-item-content">
                  <button
                    onClick={() => toggleMenu(index)}
                    className="menu-toggle"
                    title="More options"
                  >
                    <MoreVertical size={20} />
                  </button>
                  <span>
                    {poly.name}{" "}
                    {poly.locked && <Lock size={14} className="lock-icon" />}
                  </span>
                  <button
                    onClick={() => handleLockToggle(index)}
                    className="lock-toggle-btn"
                    title={poly.locked ? "Unlock" : "Lock"}
                  >
                    {poly.locked ? <Unlock size={16} /> : <Lock size={16} />}
                  </button>
                </div>
                {openMenuIndex === index && (
                  <div className="dropdown-menu">
                    <button
                      onClick={() => {
                        handleEditPolygon(index);
                        setOpenMenuIndex(null);
                      }}
                    >
                      <Edit size={16} /> Edit
                    </button>
                    <button
                      onClick={() => {
                        handleDeletePolygon(index);
                        setOpenMenuIndex(null);
                      }}
                    >
                      <Trash size={16} /> Delete
                    </button>
                    <button
                      onClick={() => {
                        handlePreviewToggle(index);
                        setOpenMenuIndex(null);
                      }}
                    >
                      <Eye size={16} />{" "}
                      {previewIndex === index ? "Hide" : "Preview"}
                    </button>
                    {/* Optional: Keep this in dropdown too */}
                    {/* <button onClick={() => handleLockToggle(index)}>
                      {poly.locked ? (
                        <>
                          <Unlock size={16} /> Unlock
                        </>
                      ) : (
                        <>
                          <Lock size={16} /> Lock
                        </>
                      )}
                    </button> */}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="container">
      <Sidebar />
      <LoadScript
        googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
        libraries={libraries}
      >
        <GoogleMap
          mapContainerClassName="map-container"
          center={mapCenter}
          zoom={mapOptions.zoom}
          options={mapOptions}
          onClick={handleMapClick}
          onMouseMove={handleMouseMove}
          onLoad={handleMapLoad}
          onDragEnd={handleMapDrag}
        >
          {drawing && (
            <div className="drawing-status">
              {isPolygonClosed
                ? "Polygon Closed - Ready to Save"
                : "Drawing Mode Active - Click to add points"}
              {drawing && points.length > 0 && (
                <div className="drawing-tip">Drag circles to adjust points</div>
              )}
            </div>
          )}

          {!drawing && previewIndex !== null && (
            <GooglePolygon
              key={`polygon-${previewIndex}`}
              paths={polygons[previewIndex].coordinates}
              options={{
                fillColor: "#FF0000",
                fillOpacity: 0.35,
                strokeColor: "#FF0000",
                strokeOpacity: 0.8,
                strokeWeight: 2,
              }}
            />
          )}

          {drawing && points.length > 0 && (
            <>
              {isPolygonClosed ? (
                <GooglePolygon
                  paths={points}
                  options={{
                    fillColor: "#0000FF",
                    fillOpacity: 0.35,
                    strokeColor: "#0000FF",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                  }}
                />
              ) : (
                <PolylineF
                  path={points}
                  options={{
                    strokeColor: "#0000FF",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                  }}
                />
              )}
            </>
          )}

          {drawing &&
            points.length > 0 &&
            points.map((point, index) => (
              <MarkerF
                key={`point-${index}`}
                position={point}
                draggable={true}
                onDrag={handleMarkerDrag.bind(null, index)}
                onDragStart={handlePointDragStart}
                onDragEnd={handlePointDragEnd}
                onClick={index === 0 ? handleStartMarkerClick : undefined}
                clickable={index === 0}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                  fillColor: index === 0 ? "#FF0000" : "#0000FF",
                  fillOpacity: 1,
                  strokeColor: index === 0 ? "#FF0000" : "#0000FF",
                  strokeOpacity: 1,
                  strokeWeight: 2,
                  scale: 7,
                }}
                zIndex={1000 + index}
                title={
                  index === 0 ? "Click to close polygon" : `Point ${index + 1}`
                }
              />
            ))}

          {drawing &&
            intermediatePoints.length > 0 &&
            intermediatePoints.map((point, index) => (
              <MarkerF
                key={`intermediate-${index}`}
                position={point.position}
                draggable={true}
                onDrag={handleIntermediateDrag.bind(null, index)}
                onDragEnd={handleIntermediateDragEnd.bind(null, index)}
                onDragStart={() => setIsDragging(true)}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                  fillColor: "#00FF00",
                  fillOpacity: 1,
                  strokeColor: "#00FF00",
                  strokeOpacity: 1,
                  strokeWeight: 2,
                  scale: 5,
                }}
                zIndex={900 + index}
                title={`Control Point ${index + 1}`}
              />
            ))}

          {drawing &&
            points.length > 0 &&
            currentMousePosition &&
            !isPolygonClosed &&
            !isDragging && (
              <PolylineF
                path={getRubberBandPath()}
                options={{
                  strokeColor: "#0000FF",
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  strokeDasharray: [2, 2],
                }}
              />
            )}
        </GoogleMap>
      </LoadScript>

      <div className="controls">
        {!drawing ? (
          <button
            onClick={handlePolygonIconClick}
            className="start-drawing-btn"
          >
            Start Drawing Polygon
          </button>
        ) : (
          <div className="drawing-controls">
            <div
              className={`status-text ${isPolygonClosed ? "closed" : "active"}`}
            >
              {isPolygonClosed
                ? "Polygon Closed - Ready to Save"
                : "Drawing Mode Active"}
            </div>
            <div className="input-container">
              <label htmlFor="polygonName">Polygon Name:</label>
              <input
                id="polygonName"
                type="text"
                value={polygonName}
                onChange={(e) => setPolygonName(e.target.value)}
                placeholder="Enter polygon name"
              />
            </div>

            <div className="button-group">
              <button
                onClick={handleSavePolygon}
                disabled={
                  !(points.length > 2 && isPolygonClosed && polygonName)
                }
                className="save-btn"
              >
                Save Polygon
              </button>
              <button onClick={handleCancelDrawing} className="cancel-btn">
                Cancel
              </button>
            </div>

            <div className="info">
              <div>Points: {points.length}</div>
              {points.length < 3 && (
                <div className="warning">Need at least 3 points</div>
              )}
              {points.length >= 3 && !isPolygonClosed && (
                <div className="instruction">
                  Click on first point (red marker) to close polygon
                </div>
              )}
              {isPolygonClosed && !polygonName && (
                <div className="warning">Enter a name to save</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Polygon5;
