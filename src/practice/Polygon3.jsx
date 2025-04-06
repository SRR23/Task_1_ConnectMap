import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  GoogleMap,
  LoadScript,
  PolygonF as GooglePolygon,
  PolylineF,
  MarkerF,
} from '@react-google-maps/api';

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
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 51.505, lng: -0.09 });
  const [editingIndex, setEditingIndex] = useState(null);
  const [intermediatePoints, setIntermediatePoints] = useState([]);
  const mapRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('polygons', JSON.stringify(polygons));
    console.log('Polygons saved to localStorage:', polygons);
  }, [polygons]);

  useEffect(() => {
    console.log("Drawing state:", drawing);
    console.log("Points:", points);
    console.log("Polygon closed:", isPolygonClosed);
    console.log("IsDragging:", isDragging);
    console.log("Intermediate Points:", intermediatePoints);
  }, [drawing, points, isPolygonClosed, isDragging, intermediatePoints]);

  const updateIntermediatePoints = useCallback(() => {
    if (points.length > 1) {
      const newIntermediatePoints = [];
      for (let i = 0; i < points.length - 1; i++) {
        newIntermediatePoints.push({
          position: calculateMidpoint(points[i], points[i + 1]),
          segmentStart: i,
          segmentEnd: i + 1,
          isDragged: false
        });
      }
      if (isPolygonClosed && points.length > 2) {
        newIntermediatePoints.push({
          position: calculateMidpoint(points[points.length - 1], points[0]),
          segmentStart: points.length - 1,
          segmentEnd: 0,
          isDragged: false
        });
      }
      setIntermediatePoints(prev => {
        const updatedPoints = newIntermediatePoints.map(newPoint => {
          const existing = prev.find(p => 
            p.segmentStart === newPoint.segmentStart && 
            p.segmentEnd === newPoint.segmentEnd
          );
          return existing && existing.isDragged ? { ...existing } : newPoint;
        });
        return updatedPoints;
      });
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
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000;
  };

  const calculateMidpoint = (point1, point2) => {
    return {
      lat: (point1.lat + point2.lat) / 2,
      lng: (point1.lng + point2.lng) / 2
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
      console.log('Start marker clicked, closing polygon');
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
        intermediateCoordinates: intermediatePoints.map(ip => ({
          position: { ...ip.position },
          segmentStart: ip.segmentStart,
          segmentEnd: ip.segmentEnd,
          isDragged: ip.isDragged || false
        })),
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
      console.log('Saved Polygon:', newPolygon);
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
    setIntermediatePoints(polygonToEdit.intermediateCoordinates || []);
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

  const getPreviewPath = (polygon) => {
    const { coordinates, intermediateCoordinates } = polygon;
    const adjustedPath = [];
    coordinates.forEach((point, index) => {
      adjustedPath.push(point);
      const segmentIntermediates = intermediateCoordinates.filter(ip => ip.segmentStart === index);
      segmentIntermediates.forEach(ip => adjustedPath.push(ip.position));
    });
    return adjustedPath;
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
        isDragged: true
      };
      return newIntermediatePoints;
    });
  }, []);

  const getAdjustedPath = () => {
    if (!drawing || points.length < 1) return points;

    const adjustedPath = [];
    points.forEach((point, index) => {
      adjustedPath.push(point);
      const segmentIntermediates = intermediatePoints.filter(ip => ip.segmentStart === index);
      segmentIntermediates.forEach(ip => adjustedPath.push(ip.position));
    });
    return adjustedPath;
  };

  const handlePointDragStart = useCallback((index) => {
    setSelectedPointIndex(index);
    setIsDragging(true);
    setCurrentMousePosition(null);
  }, []);

  const handlePointDragEnd = useCallback(() => {
    setSelectedPointIndex(null);
    setIsDragging(false);
    if (points.length >= 3 && editingIndex === null) {
      setIsPolygonClosed(true);
    }
  }, [points.length, editingIndex]);

  const Sidebar = () => (
    <div style={{ width: '200px', position: 'absolute', left: 0, top: 0, bottom: 0, background: '#fff', padding: '10px', overflowY: 'auto' }}>
      <h3>Saved Polygons</h3>
      {polygons.length === 0 ? (
        <p>No polygons saved yet</p>
      ) : (
        <ul style={{ listStyleType: 'none', padding: '0' }}>
          {polygons.map((poly, index) => (
            <li key={index} style={{ marginBottom: '10px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <strong>{poly.name}</strong>
              <div style={{ marginTop: '5px' }}>
                <button onClick={() => handleEditPolygon(index)}>Edit</button>
                <button 
                  onClick={() => handleDeletePolygon(index)}
                  style={{ marginLeft: '5px' }}
                >
                  Delete
                </button>
                <button 
                  onClick={() => handlePreviewToggle(index)}
                  style={{ marginLeft: '5px' }}
                >
                  {previewIndex === index ? 'Hide' : 'Preview'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

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
              paths={getPreviewPath(polygons[previewIndex])}
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
                  paths={getAdjustedPath()}
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
                  path={getAdjustedPath()}
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
              onDragStart={handlePointDragStart.bind(null, index)}
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
              onDragStart={() => setIsDragging(true)}
              onDragEnd={() => setIsDragging(false)}
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