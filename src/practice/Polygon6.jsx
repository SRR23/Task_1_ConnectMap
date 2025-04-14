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

const Polygon6 = () => {
  const [mapState, setMapState] = useState({
    drawing: false,
    points: [],
    polygons: (() => {
      const saved = localStorage.getItem("polygons");
      return saved ? JSON.parse(saved) : [];
    })(),
    polygonName: "",
    currentMousePosition: null,
    isMapLoaded: false,
    isPolygonClosed: false,
    isDragging: false,
    previewIndex: null,
    mapCenter: { lat: 51.505, lng: -0.09 },
    editingIndex: null,
    intermediatePoints: [],
  });

  const mapRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("polygons", JSON.stringify(mapState.polygons));
  }, [mapState.polygons]);

  const updateIntermediatePoints = useCallback(() => {
    if (mapState.points.length > 1) {
      const newIntermediatePoints = [];
      for (let i = 0; i < mapState.points.length - 1; i++) {
        newIntermediatePoints.push({
          position: calculateMidpoint(mapState.points[i], mapState.points[i + 1]),
          segmentStart: i,
          segmentEnd: i + 1,
        });
      }
      if (mapState.isPolygonClosed && mapState.points.length > 2) {
        newIntermediatePoints.push({
          position: calculateMidpoint(mapState.points[mapState.points.length - 1], mapState.points[0]),
          segmentStart: mapState.points.length - 1,
          segmentEnd: 0,
        });
      }
      setMapState(prev => ({ ...prev, intermediatePoints: newIntermediatePoints }));
    } else {
      setMapState(prev => ({ ...prev, intermediatePoints: [] }));
    }
  }, [mapState.points, mapState.isPolygonClosed]);

  useEffect(() => {
    updateIntermediatePoints();
  }, [mapState.points, mapState.isPolygonClosed, updateIntermediatePoints]);

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
    if (mapState.points.length === 0) return false;
    const startPoint = mapState.points[0];
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
    if (mapState.drawing && mapState.points.length >= 3) {
      setMapState(prev => ({ ...prev, isPolygonClosed: true }));
    }
  }, [mapState.drawing, mapState.points.length]);

  const handleMapClick = useCallback(
    (e) => {
      if (!mapState.drawing || mapState.isDragging) return;

      const newPoint = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };

      if (mapState.points.length >= 2 && isNearStartingPoint(newPoint)) {
        setMapState(prev => ({ ...prev, isPolygonClosed: true }));
        return;
      }

      setMapState(prev => ({
        ...prev,
        points: [...prev.points, newPoint],
        isPolygonClosed: false,
      }));
    },
    [mapState.drawing, mapState.isDragging, mapState.points]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (mapState.drawing && !mapState.isDragging && !mapState.isPolygonClosed) {
        setMapState(prev => ({
          ...prev,
          currentMousePosition: {
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
          },
        }));
      }
    },
    [mapState.drawing, mapState.isDragging, mapState.isPolygonClosed]
  );

  const handleMapLoad = useCallback((map) => {
    mapRef.current = map;
    setMapState(prev => ({ ...prev, isMapLoaded: true }));
  }, []);

  const handleMapDrag = useCallback(() => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      setMapState(prev => ({
        ...prev,
        mapCenter: {
          lat: center.lat(),
          lng: center.lng(),
        },
      }));
    }
  }, []);

  const handlePolygonIconClick = () => {
    setMapState(prev => ({
      ...prev,
      drawing: true,
      points: [],
      isPolygonClosed: false,
      currentMousePosition: null,
      previewIndex: null,
      polygonName: "",
      editingIndex: null,
      intermediatePoints: [],
    }));
  };

  const handleSavePolygon = () => {
    if (mapState.points.length > 2 && mapState.isPolygonClosed && mapState.polygonName) {
      const newPolygon = {
        name: mapState.polygonName,
        coordinates: [...mapState.points],
        locked: false,
      };
      setMapState(prev => {
        const updatedPolygons =
          prev.editingIndex !== null
            ? prev.polygons.map((poly, i) => (i === prev.editingIndex ? newPolygon : poly))
            : [...prev.polygons, newPolygon];
        localStorage.setItem("polygons", JSON.stringify(updatedPolygons));
        return {
          ...prev,
          polygons: updatedPolygons,
          drawing: false,
          points: [],
          polygonName: "",
          currentMousePosition: null,
          isPolygonClosed: false,
          previewIndex: null,
          editingIndex: null,
          intermediatePoints: [],
        };
      });
    } else if (!mapState.isPolygonClosed) {
      alert("Please close the polygon by clicking near the starting point.");
    } else if (!mapState.polygonName) {
      alert("Please provide a name for the polygon.");
    } else {
      alert(
        "Please add at least 3 points, close the polygon, and provide a name."
      );
    }
  };

  const handleEditPolygon = (index) => {
    if (mapState.polygons[index].locked) {
      alert("This polygon is locked and cannot be edited.");
      return;
    }

    const polygonToEdit = mapState.polygons[index];
    setMapState(prev => ({
      ...prev,
      points: polygonToEdit.coordinates,
      polygonName: polygonToEdit.name,
      drawing: true,
      isPolygonClosed: true,
      previewIndex: null,
      editingIndex: index,
    }));
  };

  const handleCancelDrawing = () => {
    setMapState(prev => ({
      ...prev,
      drawing: false,
      points: [],
      polygonName: "",
      currentMousePosition: null,
      isPolygonClosed: false,
      previewIndex: null,
      editingIndex: null,
      intermediatePoints: [],
    }));
  };

  const handleDeletePolygon = (index) => {
    if (mapState.polygons[index].locked) {
      alert("This polygon is locked and cannot be deleted.");
      return;
    }

    setMapState(prev => {
      const updatedPolygons = prev.polygons.filter((_, i) => i !== index);
      localStorage.setItem("polygons", JSON.stringify(updatedPolygons));
      return {
        ...prev,
        polygons: updatedPolygons,
        previewIndex:
          prev.previewIndex === index
            ? null
            : prev.previewIndex > index
            ? prev.previewIndex - 1
            : prev.previewIndex,
      };
    });
  };

  const handlePreviewToggle = (index) => {
    setMapState(prev => {
      const newPreviewIndex = prev.previewIndex === index ? null: index;
      const centroid = prev.previewIndex !== index ? calculateCentroid(prev.polygons[index].coordinates) : prev.mapCenter;
      return {
        ...prev,
        previewIndex: newPreviewIndex,
        mapCenter: centroid,
      };
    });
  };

  const getRubberBandPath = () => {
    if (
      mapState.drawing &&
      mapState.points.length > 0 &&
      mapState.currentMousePosition &&
      !mapState.isPolygonClosed
    ) {
      return [mapState.points[mapState.points.length - 1], mapState.currentMousePosition];
    }
    return [];
  };

  const handleMarkerDrag = useCallback((index, event) => {
    const newPoint = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };
    setMapState(prev => {
      const newPoints = [...prev.points];
      newPoints[index] = newPoint;
      return { ...prev, points: newPoints };
    });
  }, []);

  const handleIntermediateDragEnd = useCallback(
    (index) => {
      setMapState(prev => {
        const draggedPoint = prev.intermediatePoints[index];
        const { segmentStart, segmentEnd } = draggedPoint;
        const newPoints = [...prev.points];
        newPoints.splice(segmentStart + 1, 0, draggedPoint.position);
        return { ...prev, points: newPoints, isDragging: false };
      });
      updateIntermediatePoints();
    },
    [mapState.intermediatePoints, updateIntermediatePoints]
  );

  const handleIntermediateDrag = useCallback((index, event) => {
    const newPosition = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };
    setMapState(prev => {
      const newIntermediatePoints = [...prev.intermediatePoints];
      newIntermediatePoints[index] = {
        ...newIntermediatePoints[index],
        position: newPosition,
      };
      return { ...prev, intermediatePoints: newIntermediatePoints };
    });
  }, []);

  const handlePointDragStart = useCallback(() => {
    setMapState(prev => ({ ...prev, isDragging: true, currentMousePosition: null }));
  }, []);

  const handlePointDragEnd = useCallback(() => {
    setMapState(prev => ({
      ...prev,
      isDragging: false,
      isPolygonClosed: prev.points.length >= 3 && prev.editingIndex === null ? true : prev.isPolygonClosed,
    }));
  }, [mapState.points.length, mapState.editingIndex]);

  const Sidebar = () => {
    const [openMenuIndex, setOpenMenuIndex] = useState(null);

    const toggleMenu = (index) => {
      setOpenMenuIndex(openMenuIndex === index ? null : index);
    };

    const handleLockToggle = (index) => {
      setMapState((prev) => {
        const updatedPolygons = prev.polygons.map((poly, i) =>
          i === index ? { ...poly, locked: !poly.locked } : poly
        );
        localStorage.setItem("polygons", JSON.stringify(updatedPolygons));
        return { ...prev, polygons: updatedPolygons };
      });
      setOpenMenuIndex(null);
    };

    return (
      <div className="sidebar">
        <img
          src="/img/janata-wifi.svg"
          alt="Sidebar Header"
          className="sidebar-image"
        />
        <hr />
        <h3>Saved Polygons</h3>
        <div className="polygon-list">
          {mapState.polygons.length === 0 ? (
            <p>No polygons saved yet</p>
          ) : (
            <ul>
              {mapState.polygons.map((poly, index) => (
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
                        {mapState.previewIndex === index ? "Hide" : "Preview"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
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
          center={mapState.mapCenter}
          zoom={mapOptions.zoom}
          options={mapOptions}
          onClick={handleMapClick}
          onMouseMove={handleMouseMove}
          onLoad={handleMapLoad}
          onDragEnd={handleMapDrag}
        >
          {mapState.drawing && (
            <div className="drawing-status">
              {mapState.isPolygonClosed
                ? "Polygon Closed - Ready to Save"
                : "Drawing Mode Active - Click to add points"}
              {mapState.drawing && mapState.points.length > 0 && (
                <div className="drawing-tip">Drag circles to adjust points</div>
              )}
            </div>
          )}

          {!mapState.drawing && mapState.previewIndex !== null && (
            <GooglePolygon
              key={`polygon-${mapState.previewIndex}`}
              paths={mapState.polygons[mapState.previewIndex].coordinates}
              options={{
                fillColor: "#FF0000",
                fillOpacity: 0.35,
                strokeColor: "#FF0000",
                strokeOpacity: 0.8,
                strokeWeight: 2,
              }}
            />
          )}

          {mapState.drawing && mapState.points.length > 0 && (
            <>
              {mapState.isPolygonClosed ? (
                <GooglePolygon
                  paths={mapState.points}
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
                  path={mapState.points}
                  options={{
                    strokeColor: "#0000FF",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                  }}
                />
              )}
            </>
          )}

          {mapState.drawing &&
            mapState.points.length > 0 &&
            mapState.points.map((point, index) => (
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

          {mapState.drawing &&
            mapState.intermediatePoints.length > 0 &&
            mapState.intermediatePoints.map((point, index) => (
              <MarkerF
                key={`intermediate-${index}`}
                position={point.position}
                draggable={true}
                onDrag={handleIntermediateDrag.bind(null, index)}
                onDragEnd={handleIntermediateDragEnd.bind(null, index)}
                onDragStart={() => setMapState(prev => ({ ...prev, isDragging: true }))}
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

          {mapState.drawing &&
            mapState.points.length > 0 &&
            mapState.currentMousePosition &&
            !mapState.isPolygonClosed &&
            !mapState.isDragging && (
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
        {!mapState.drawing ? (
          <button
            onClick={handlePolygonIconClick}
            className="start-drawing-btn"
          >
            Start Drawing Polygon
          </button>
        ) : (
          <div className="drawing-controls">
            <div
              className={`status-text ${mapState.isPolygonClosed ? "closed" : "active"}`}
            >
              {mapState.isPolygonClosed
                ? "Polygon Closed - Ready to Save"
                : "Drawing Mode Active"}
            </div>
            <div className="input-container">
              <label htmlFor="polygonName">Polygon Name:</label>
              <input
                id="polygonName"
                type="text"
                value={mapState.polygonName}
                onChange={(e) => setMapState(prev => ({ ...prev, polygonName: e.target.value }))}
                placeholder="Enter polygon name"
              />
            </div>

            <div className="button-group">
              <button
                onClick={handleSavePolygon}
                disabled={
                  !(mapState.points.length > 2 && mapState.isPolygonClosed && mapState.polygonName)
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
              <div>Points: {mapState.points.length}</div>
              {mapState.points.length < 3 && (
                <div className="warning">Need at least 3 points</div>
              )}
              {mapState.points.length >= 3 && !mapState.isPolygonClosed && (
                <div className="instruction">
                  Click on first point (red marker) to close polygon
                </div>
              )}
              {mapState.isPolygonClosed && !mapState.polygonName && (
                <div className="warning">Enter a name to save</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Polygon6;