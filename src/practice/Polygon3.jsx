import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  GoogleMap,
  LoadScript,
  PolygonF as GooglePolygon,
  PolylineF,
  MarkerF,
} from '@react-google-maps/api';

import { Edit, Trash, Eye, MoreVertical } from 'lucide-react';

const libraries = ['drawing'];

const Polygon3 = () => {
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [polygons, setPolygons] = useState(() => {
    const saved = localStorage.getItem('polygons');
    return saved ? JSON.parse(saved) : [];
  });
  const [polygonName, setPolygonName] = useState('');
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
    localStorage.setItem('polygons', JSON.stringify(polygons));
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

  const mapContainerStyle = {
    width: 'calc(100% - 200px)',
    height: '100vh',
    marginLeft: '200px',
  };

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
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
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
    if (!coordinates || coordinates.length === 0) return { lat: 51.505, lng: -0.09 };
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

  const handleMapClick = useCallback((e) => {
    if (!drawing || isDragging) return;

    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    };

    if (points.length >= 2 && isNearStartingPoint(newPoint)) {
      setIsPolygonClosed(true);
      return;
    }

    setPoints(prevPoints => [...prevPoints, newPoint]);
    setIsPolygonClosed(false);
  }, [drawing, isDragging, points]);

  const handleMouseMove = useCallback((e) => {
    if (drawing && !isDragging && !isPolygonClosed) {
      setCurrentMousePosition({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      });
    }
  }, [drawing, isDragging, isPolygonClosed]);

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
    setPolygonName('');
    setEditingIndex(null);
    setIntermediatePoints([]);
  };

  const handleSavePolygon = () => {
    if (points.length > 2 && isPolygonClosed && polygonName) {
      const newPolygon = {
        name: polygonName,
        coordinates: [...points],
      };
      setPolygons(prev => {
        const updatedPolygons = editingIndex !== null
          ? prev.map((poly, i) => (i === editingIndex ? newPolygon : poly))
          : [...prev, newPolygon];
        localStorage.setItem('polygons', JSON.stringify(updatedPolygons));
        return updatedPolygons;
      });
      setDrawing(false);
      setPoints([]);
      setPolygonName('');
      setCurrentMousePosition(null);
      setIsPolygonClosed(false);
      setPreviewIndex(null);
      setEditingIndex(null);
      setIntermediatePoints([]);
    } else if (!isPolygonClosed) {
      alert('Please close the polygon by clicking near the starting point.');
    } else if (!polygonName) {
      alert('Please provide a name for the polygon.');
    } else {
      alert('Please add at least 3 points, close the polygon, and provide a name.');
    }
  };

  const handleEditPolygon = (index) => {
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
    setPolygonName('');
    setCurrentMousePosition(null);
    setIsPolygonClosed(false);
    setPreviewIndex(null);
    setEditingIndex(null);
    setIntermediatePoints([]);
  };

  const handleDeletePolygon = (index) => {
    setPolygons(prev => {
      const updatedPolygons = prev.filter((_, i) => i !== index);
      localStorage.setItem('polygons', JSON.stringify(updatedPolygons));
      return updatedPolygons;
    });
    if (previewIndex === index) {
      setPreviewIndex(null);
    } else if (previewIndex > index) {
      setPreviewIndex(prev => prev - 1);
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
    if (drawing && points.length > 0 && currentMousePosition && !isPolygonClosed) {
      return [points[points.length - 1], currentMousePosition];
    }
    return [];
  };

  const handleMarkerDrag = useCallback((index, event) => {
    const newPoint = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };
    setPoints(prevPoints => {
      const newPoints = [...prevPoints];
      newPoints[index] = newPoint;
      return newPoints;
    });
  }, []);

  const handleIntermediateDragEnd = useCallback((index) => {
    setIsDragging(false);
    const draggedPoint = intermediatePoints[index];
    const { segmentStart, segmentEnd } = draggedPoint;

    // Insert the dragged intermediate point into the points array
    setPoints(prevPoints => {
      const newPoints = [...prevPoints];
      newPoints.splice(segmentStart + 1, 0, draggedPoint.position);
      return newPoints;
    });

    // Recalculate intermediate points after insertion
    updateIntermediatePoints();
  }, [intermediatePoints, updateIntermediatePoints]);

  const handleIntermediateDrag = useCallback((index, event) => {
    const newPosition = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };

    setIntermediatePoints(prevPoints => {
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
  

  // const Sidebar = () => (
  //   <div style={{ width: '200px', position: 'absolute', left: 0, top: 0, bottom: 0, background: '#fff', padding: '10px', overflowY: 'auto' }}>
  //     <h3>Saved Polygons</h3>
  //     {polygons.length === 0 ? (
  //       <p>No polygons saved yet</p>
  //     ) : (
  //       <ul style={{ listStyleType: 'none', padding: '0' }}>
  //         {polygons.map((poly, index) => (
  //           <li key={index} style={{ marginBottom: '10px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}>
  //             <strong>{poly.name}</strong>
  //             <div style={{ marginTop: '5px' }}>
  //               <button onClick={() => handleEditPolygon(index)}>Edit</button>
  //               <button onClick={() => handleDeletePolygon(index)} style={{ marginLeft: '5px' }}>Delete</button>
  //               <button onClick={() => handlePreviewToggle(index)} style={{ marginLeft: '5px' }}>
  //                 {previewIndex === index ? 'Hide' : 'Preview'}
  //               </button>
  //             </div>
  //           </li>
  //         ))}
  //       </ul>
  //     )}
  //   </div>
  // );

  const Sidebar = () => {
    const [openMenuIndex, setOpenMenuIndex] = useState(null);
  
    const toggleMenu = (index) => {
      console.log('Toggling menu for index:', index); // Debug log
      setOpenMenuIndex(openMenuIndex === index ? null : index);
    };
  
    return (
      <div style={{
        width: '250px',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        background: '#f8f9fa',
        padding: '20px',
        overflowY: 'auto',
        boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
        fontFamily: 'Arial, sans-serif',
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#333' }}>
          Saved Polygons
        </h3>
        {polygons.length === 0 ? (
          <p style={{ color: '#666', fontSize: '14px' }}>No polygons saved yet</p>
        ) : (
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {polygons.map((poly, index) => (
              <li
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px',
                  marginBottom: '10px',
                  background: '#fff',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={() => toggleMenu(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#666',
                    }}
                    title="More options"
                  >
                    <MoreVertical size={20} />
                  </button>
                  <span style={{ fontSize: '15px', color: '#333', fontWeight: '500', marginLeft: '10px' }}>
                    {poly.name}
                  </span>
                </div>
                {openMenuIndex === index && (
                  <div style={{
                    position: 'absolute',
                    right: '10px',
                    top: '40px',
                    background: '#fff',
                    borderRadius: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '120px',
                  }}>
                    <button
                      onClick={() => {
                        handleEditPolygon(index);
                        setOpenMenuIndex(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#333',
                      }}
                    >
                      <Edit size={16} style={{ marginRight: '8px' }} />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleDeletePolygon(index);
                        setOpenMenuIndex(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#333',
                      }}
                    >
                      <Trash size={16} style={{ marginRight: '8px' }} />
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        handlePreviewToggle(index);
                        setOpenMenuIndex(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#333',
                      }}
                    >
                      <Eye size={16} style={{ marginRight: '8px' }} />
                      {previewIndex === index ? 'Hide' : 'Preview'}
                    </button>
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
    <div style={{ position: 'relative', height: '100vh' }}>
      <Sidebar />
      <LoadScript
        googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
        libraries={libraries}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={mapOptions.zoom}
          options={mapOptions}
          onClick={handleMapClick}
          onMouseMove={handleMouseMove}
          onLoad={handleMapLoad}
          onDragEnd={handleMapDrag}
        >
          {drawing && (
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '220px',
              background: 'rgba(255,255,255,0.8)',
              padding: '5px',
              zIndex: 1000,
              borderRadius: '4px'
            }}>
              {isPolygonClosed ? 'Polygon Closed - Ready to Save' : 'Drawing Mode Active - Click to add points'}
              {drawing && points.length > 0 && <div style={{ fontSize: '12px', marginTop: '2px' }}>Drag circles to adjust points</div>}
            </div>
          )}

          {!drawing && previewIndex !== null && (
            <GooglePolygon
              key={`polygon-${previewIndex}`}
              paths={polygons[previewIndex].coordinates}
              options={{
                fillColor: '#FF0000',
                fillOpacity: 0.35,
                strokeColor: '#FF0000',
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
                    fillColor: '#0000FF',
                    fillOpacity: 0.35,
                    strokeColor: '#0000FF',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                  }}
                />
              ) : (
                <PolylineF
                  path={points}
                  options={{
                    strokeColor: '#0000FF',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                  }}
                />
              )}
            </>
          )}

          {drawing && points.length > 0 && points.map((point, index) => (
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
                fillColor: index === 0 ? '#FF0000' : '#0000FF',
                fillOpacity: 1,
                strokeColor: index === 0 ? '#FF0000' : '#0000FF',
                strokeOpacity: 1,
                strokeWeight: 2,
                scale: 7,
              }}
              zIndex={1000 + index}
              title={index === 0 ? "Click to close polygon" : `Point ${index + 1}`}
            />
          ))}

          {drawing && intermediatePoints.length > 0 && intermediatePoints.map((point, index) => (
            <MarkerF
              key={`intermediate-${index}`}
              position={point.position}
              draggable={true}
              onDrag={handleIntermediateDrag.bind(null, index)}
              onDragEnd={handleIntermediateDragEnd.bind(null, index)}
              onDragStart={() => setIsDragging(true)}
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                fillColor: '#00FF00',
                fillOpacity: 1,
                strokeColor: '#00FF00',
                strokeOpacity: 1,
                strokeWeight: 2,
                scale: 5,
              }}
              zIndex={900 + index}
              title={`Control Point ${index + 1}`}
            />
          ))}

          {drawing && points.length > 0 && currentMousePosition && !isPolygonClosed && !isDragging && (
            <PolylineF
              path={getRubberBandPath()}
              options={{
                strokeColor: '#0000FF',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                strokeDasharray: [2, 2],
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>

      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        background: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      }}>
        {!drawing ? (
          <button
            onClick={handlePolygonIconClick}
            style={{
              padding: '5px 10px',
              backgroundColor: '#4285F4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Start Drawing Polygon
          </button>
        ) : (
          <div>
            <div style={{ marginBottom: '10px', fontWeight: 'bold', color: isPolygonClosed ? '#0F9D58' : '#4285F4' }}>
              {isPolygonClosed ? 'Polygon Closed - Ready to Save' : 'Drawing Mode Active'}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="polygonName" style={{ display: 'block', marginBottom: '5px' }}>
                Polygon Name:
              </label>
              <input
                id="polygonName"
                type="text"
                value={polygonName}
                onChange={(e) => setPolygonName(e.target.value)}
                placeholder="Enter polygon name"
                style={{ width: '100%', padding: '5px' }}
              />
            </div>
            
            <div>
              <button
                onClick={handleSavePolygon}
                disabled={!(points.length > 2 && isPolygonClosed && polygonName)}
                style={{
                  padding: '5px 10px',
                  backgroundColor: (points.length > 2 && isPolygonClosed && polygonName) ? '#0F9D58' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  marginRight: '5px',
                }}
              >
                Save Polygon
              </button>
              <button
                onClick={handleCancelDrawing}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#DB4437',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                Cancel
              </button>
            </div>
            
            <div style={{ marginTop: '10px', fontSize: '14px' }}>
              <div>Points: {points.length}</div>
              {points.length < 3 && <div style={{ color: 'orange' }}>Need at least 3 points</div>}
              {points.length >= 3 && !isPolygonClosed && (
                <div style={{ color: '#4285F4' }}>
                  Click on first point (red marker) to close polygon
                </div>
              )}
              {isPolygonClosed && !polygonName && (
                <div style={{ color: 'orange' }}>
                  Enter a name to save
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Polygon3;