import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  GoogleMap,
  useLoadScript,
  MarkerF,
  PolylineF,
} from "@react-google-maps/api";
import {
  Trash2,
  Plus,
  Edit,
  Save,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from "lucide-react";

import "reactflow/dist/style.css";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
} from "reactflow";

// Custom Node Component
const CustomNode = React.memo(({ data }) => {
  return (
    <div
      style={{
        width: 130,
        height: 30,
        backgroundColor: data.color,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 14,
      }}
    >
      {data.label}
      {data.side === "left" && (
        <Handle
          type="source"
          position="right"
          id="right"
          style={{
            right: -5, // Slightly outside node
            top: "50%",
            transform: "translateY(-50%)",
            width: 10,
            height: 10,
            background: "transparent",
          }}
        />
      )}
      {data.side === "right" && (
        <Handle
          type="target"
          position="left"
          id="left"
          style={{
            left: -5,
            top: "50%",
            transform: "translateY(-50%)",
            width: 10,
            height: 10,
            background: "transparent",
          }}
        />
      )}
      {data.side === "temp" && (
        <Handle
          type="target"
          position="left"
          id="temp"
          style={{
            left: -5,
            top: "50%",
            transform: "translateY(-50%)",
            width: 10,
            height: 10,
            background: "transparent",
          }}
        />
      )}
    </div>
  );
});

// Define nodeTypes outside the component
const nodeTypes = { custom: CustomNode };
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
    stylers: [{ visibility: "off" }],
  },
];

const MyMapV18 = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // const iconImages = {
  //   BTS: "/img/BTS.png",
  //   Termination: "/img/Termination.png",
  //   Splitter: "/img/Splitter.png",
  //   ONU: "/img/ONU.png",
  // };

  const terminationColors = [
    { number: 1, value: "#FF0000" }, // Red
    { number: 2, value: "#0000FF" }, // Blue
    { number: 3, value: "#00FF00" }, // Green
    { number: 4, value: "#FFFF00" }, // Yellow
    { number: 5, value: "#800080" }, // Purple
  ];

  const mapRef = useRef(null); // Ref to store map instance
  const flowRef = useRef(null); // Ref to track ReactFlow container

  const [mapState, setMapState] = useState({
    savedRoutes: [],
    nextNumber: 1,
    selectedType: null,
    showModal: false,
    selectedPoint: null,
    rightClickMarker: null,
    fiberLines: [],
    imageIcons: [],
    showSavedRoutes: false,
    savedPolylines: [],
    savedIcons: [],
    selectedLineForActions: null,
    lineActionPosition: null,
    exactClickPosition: null,
    selectedWaypoint: null,
    waypointActionPosition: null,
    selectedWaypointInfo: null,
    isSavedRoutesEditable: false,
    showSplitterModal: false,
    selectedSplitter: null,
    splitterRatio: "",
    splitterInput: "",
    editingLineId: null,
    tempLineName: "",

    showTerminationModal: false,
    selectedTermination: null,
    terminationConnections: [], // Persistent connections: [{ terminationId, leftColor, rightColor }]
    tempConnection: null, // Temporary line: { leftColor, rightColor } or null
  });

  // Add state for device types
  const [deviceTypes, setDeviceTypes] = useState([]);

  // Fetch device types from API
  useEffect(() => {
    fetch("http://localhost:8000/api/device-types/")
      .then((response) => response.json())
      .then((data) => {
        console.log("Fetched device types:", data);
        setDeviceTypes(data);
      })
      .catch((error) => {
        console.error("Error fetching device types:", error);
      });
  }, []);

  // Function to handle device creation API call
  const createDevice = async (deviceUuid, latitude, longitude) => {
    try {
      const payload = {
        device_type_uuid: deviceUuid,
        latitude: Number(latitude.toFixed(4)), // Round to 4 decimal places
        longitude: Number(longitude.toFixed(4)), // Round to 4 decimal places
      };
      console.log("Sending payload:", payload); // Log payload

      const response = await fetch(
        "http://localhost:8000/api/devices/create/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error:", errorData);
        throw new Error("Failed to create device");
      }

      return true;
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to add device.");
      return false;
    }
  };

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [drawingSource, setDrawingSource] = useState(null); // Track source node ID

  // Ensure ReactFlow container is available after mount
  useEffect(() => {
    if (mapState.showTerminationModal && flowRef.current) {
      console.log("ReactFlow container ref:", flowRef.current);
      const flowEl = flowRef.current.querySelector(".reactflow");
      console.log("Found .reactflow:", flowEl);
    }
  }, [mapState.showTerminationModal]);

  const isInteractionAllowed = (isSavedLine) => {
    return (
      !isSavedLine ||
      (mapState.showSavedRoutes && mapState.isSavedRoutesEditable)
    );
  };

  const findNearestIcon = (lat, lng) => {
    const threshold = 0.0005;
    return mapState.imageIcons.find((icon) => {
      const latDiff = Math.abs(icon.lat - lat);
      const lngDiff = Math.abs(icon.lng - lng);
      return latDiff < threshold && lngDiff < threshold;
    });
  };

  const isSnappedToIcon = (lat, lng) => {
    return !!findNearestIcon(lat, lng);
  };

  const getRatioNumber = (ratio) => {
    if (!ratio || ratio === "") return 0;
    const [_, num] = ratio.split(":").map(Number);
    return num;
  };

  const getConnectedLinesCount = (icon) => {
    if (icon.type === "Termination") {
      return mapState.fiberLines.filter(
        (line) =>
          (line.from.lat === icon.lat && line.from.lng === icon.lng) ||
          (line.to.lat === icon.lat && line.to.lng === icon.lng) ||
          (line.waypoints &&
            line.waypoints.some(
              (wp) => wp.lat === icon.lat && wp.lng === wp.lng
            ))
      ).length;
    }

    if (!icon.ratioSetTimestamp) return 0;
    return mapState.fiberLines.filter(
      (line) =>
        line.createdAt > splitter.ratioSetTimestamp &&
        ((line.from.lat === splitter.lat && line.from.lng === splitter.lng) ||
          (line.to.lat === splitter.lat && line.to.lng === splitter.lng) ||
          (line.waypoints &&
            line.waypoints.some(
              (wp) => wp.lat === splitter.lat && wp.lng === splitter.lng
            )))
    ).length;
  };

  const getConnectedLines = (splitter) => {
    if (!splitter.ratioSetTimestamp) return [];
    return mapState.fiberLines.filter(
      (line) =>
        line.createdAt > splitter.ratioSetTimestamp &&
        ((line.from.lat === splitter.lat && line.from.lng === splitter.lng) ||
          (line.to.lat === splitter.lat && line.to.lng === splitter.lng) ||
          (line.waypoints &&
            line.waypoints.some(
              (wp) => wp.lat === splitter.lat && wp.lng === splitter.lng
            )))
    );
  };

  const getAvailableRatios = (splitter) => {
    const ratios = ["1:2", "1:4", "1:8", "1:16", "1:32"];
    const connectedCount = getConnectedLinesCount(splitter);
    return ratios.filter((ratio) => {
      const ratioNum = getRatioNumber(ratio);
      return ratioNum >= connectedCount;
    });
  };

  const handleMapRightClick = useCallback(
    (e) => {
      e.domEvent.preventDefault();
      if (mapState.showSavedRoutes && !mapState.isSavedRoutesEditable) return;

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
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      }));
    },
    [
      mapState.nextNumber,
      mapState.showSavedRoutes,
      mapState.isSavedRoutesEditable,
    ]
  );

  // Update handleSelection to pass only necessary parameters
  const handleSelection = async (type, iconUrl, deviceUuid) => {
    const { selectedPoint, nextNumber } = mapState;

    // Send POST request to create device
    const isDeviceCreated = await createDevice(
      deviceUuid,
      selectedPoint.lat,
      selectedPoint.lng
    );

    if (isDeviceCreated) {
      // Update map state only if API call is successful
      setMapState((prevState) => ({
        ...prevState,
        selectedType: type,
        showModal: false,
        imageIcons: [
          ...prevState.imageIcons,
          {
            ...selectedPoint,
            type,
            id: `icon-${nextNumber}`,
            imageUrl: iconUrl, // Keep iconUrl for map display
          },
        ],
        nextNumber: nextNumber + 1,
        rightClickMarker: null,
      }));
    }
  };

  const handleRightClickOnIcon = (icon, e) => {
    e.domEvent.preventDefault();
    if (mapState.showSavedRoutes && !mapState.isSavedRoutesEditable) return;

    setMapState((prevState) => ({
      ...prevState,
      selectedPoint: { ...icon, x: e.domEvent.clientX, y: e.domEvent.clientY },
      rightClickMarker: icon,
      showModal: true,
    }));
  };

  const handleLineClick = (line, index, isSavedLine = false, e) => {
    if (e.domEvent) {
      e.domEvent.preventDefault();
    }

    if (isInteractionAllowed(isSavedLine)) {
      const clickedLatLng = e.latLng;
      const x = e.domEvent.clientX;
      const y = e.domEvent.clientY;

      setMapState((prevState) => ({
        ...prevState,
        selectedLineForActions: { line, index, isSavedLine },
        lineActionPosition: {
          lat: clickedLatLng.lat(),
          lng: clickedLatLng.lng(),
          x,
          y,
        },
        exactClickPosition: {
          lat: clickedLatLng.lat(),
          lng: clickedLatLng.lng(),
          x,
          y,
        },
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      }));
    }
  };

  const removeConnectedLine = (lineId) => {
    setMapState((prevState) => {
      const updatedFiberLines = prevState.fiberLines.filter(
        (line) => line.id !== lineId
      );
      const updatedSavedPolylines = prevState.savedPolylines.filter(
        (line) => line.id !== lineId
      );
      const connectedLines = getConnectedLines(
        prevState.selectedSplitter
      ).filter((line) => line.id !== lineId);
      const updatedImageIcons = prevState.imageIcons.map((icon) =>
        icon.id === prevState.selectedSplitter?.id &&
        connectedLines.length === 0
          ? { ...icon, nextLineNumber: 1 }
          : icon
      );
      const updatedSavedIcons = prevState.savedIcons.map((icon) =>
        icon.id === prevState.selectedSplitter?.id &&
        connectedLines.length === 0
          ? { ...icon, nextLineNumber: 1 }
          : icon
      );
      if (prevState.showSavedRoutes) {
        localStorage.setItem(
          "savedPolylines",
          JSON.stringify(updatedSavedPolylines)
        );
        localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
      }
      return {
        ...prevState,
        fiberLines: updatedFiberLines,
        savedPolylines: updatedSavedPolylines,
        imageIcons: updatedImageIcons,
        savedIcons: updatedSavedIcons,
        editingLineId: null,
        tempLineName: "",
      };
    });
  };

  const handleEditLine = (lineId, currentName) => {
    setMapState((prevState) => ({
      ...prevState,
      editingLineId: lineId,
      tempLineName: currentName || "",
    }));
  };

  const handleLineNameChange = (e) => {
    setMapState((prevState) => ({
      ...prevState,
      tempLineName: e.target.value,
    }));
  };

  const handleSave = () => {
    if (mapState.editingLineId) {
      setMapState((prevState) => {
        const updatedFiberLines = prevState.fiberLines.map((line) =>
          line.id === prevState.editingLineId
            ? { ...line, name: prevState.tempLineName }
            : line
        );
        const updatedSavedPolylines = prevState.savedPolylines.map((line) =>
          line.id === prevState.editingLineId
            ? { ...line, name: prevState.tempLineName }
            : line
        );
        if (prevState.showSavedRoutes) {
          localStorage.setItem(
            "savedPolylines",
            JSON.stringify(updatedSavedPolylines)
          );
        }
        return {
          ...prevState,
          fiberLines: updatedFiberLines,
          savedPolylines: updatedSavedPolylines,
          editingLineId: null,
          tempLineName: "",
        };
      });
    }
  };

  const addWaypoint = () => {
    if (
      !mapState.selectedLineForActions ||
      !isInteractionAllowed(mapState.selectedLineForActions.isSavedLine)
    )
      return;

    const { line, index, isSavedLine } = mapState.selectedLineForActions;

    setMapState((prevState) => {
      const updatedLines = isSavedLine
        ? prevState.savedPolylines
        : prevState.fiberLines;

      const updatedLinesWithWaypoint = updatedLines.map(
        (currentLine, currentIndex) => {
          if (currentIndex === index) {
            const lastPoint =
              currentLine.waypoints && currentLine.waypoints.length > 0
                ? currentLine.waypoints[currentLine.waypoints.length - 1]
                : currentLine.to;

            const midpoint = {
              lat: (currentLine.from.lat + lastPoint.lat) / 2,
              lng: (currentLine.from.lng + lastPoint.lng) / 2,
            };

            const updatedWaypoints = currentLine.waypoints
              ? [...currentLine.waypoints, midpoint]
              : [midpoint];

            return { ...currentLine, waypoints: updatedWaypoints };
          }
          return currentLine;
        }
      );

      if (isSavedLine) {
        localStorage.setItem(
          "savedPolylines",
          JSON.stringify(updatedLinesWithWaypoint)
        );
      }

      return {
        ...prevState,
        ...(isSavedLine
          ? { savedPolylines: updatedLinesWithWaypoint }
          : { fiberLines: updatedLinesWithWaypoint }),
        selectedLineForActions: null,
        lineActionPosition: null,
        exactClickPosition: null,
      };
    });
  };

  const handleWaypointClick = (
    lineIndex,
    waypointIndex,
    isSavedLine = false,
    waypoint,
    e
  ) => {
    if (e && e.domEvent) {
      e.domEvent.preventDefault();
      e.domEvent.stopPropagation();
    }

    if (isInteractionAllowed(isSavedLine)) {
      const x = e.domEvent.clientX;
      const y = e.domEvent.clientY;

      setMapState((prevState) => ({
        ...prevState,
        selectedLineForActions: null,
        lineActionPosition: null,
        exactClickPosition: null,
        showModal: false,
        selectedWaypoint: waypoint,
        waypointActionPosition: { x, y },
        selectedWaypointInfo: { lineIndex, waypointIndex, isSavedLine },
      }));
    }
  };

  const removeSelectedWaypoint = () => {
    if (
      !mapState.selectedWaypointInfo ||
      !isInteractionAllowed(mapState.selectedWaypointInfo.isSavedLine)
    )
      return;

    const { lineIndex, waypointIndex, isSavedLine } =
      mapState.selectedWaypointInfo;

    setMapState((prevState) => {
      const targetArray = isSavedLine
        ? prevState.savedPolylines
        : prevState.fiberLines;
      const updatedLines = targetArray.map((line, idx) => {
        if (idx === lineIndex && line.waypoints) {
          const updatedWaypoints = line.waypoints.filter(
            (_, wIdx) => wIdx !== waypointIndex
          );
          return { ...line, waypoints: updatedWaypoints };
        }
        return line;
      });

      const updatedImageIcons = prevState.imageIcons.filter(
        (icon) =>
          !(
            icon.lat === prevState.selectedWaypoint.lat &&
            icon.lng === prevState.selectedWaypoint.lng
          )
      );
      const updatedSavedIcons = prevState.savedIcons.filter(
        (icon) =>
          !(
            icon.lat === prevState.selectedWaypoint.lat &&
            icon.lng === prevState.selectedWaypoint.lng
          )
      );

      if (isSavedLine) {
        localStorage.setItem("savedPolylines", JSON.stringify(updatedLines));
        localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
      }

      return {
        ...prevState,
        ...(isSavedLine
          ? {
              savedPolylines: updatedLines,
              fiberLines: prevState.showSavedRoutes
                ? updatedLines
                : prevState.fiberLines,
              savedIcons: updatedSavedIcons,
            }
          : { fiberLines: updatedLines }),
        imageIcons: updatedImageIcons,
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      };
    });
  };

  const handleIconClick = (icon, e) => {
    if (e && e.domEvent) {
      e.domEvent.preventDefault();
      e.domEvent.stopPropagation();
    }

    if (mapState.isSavedRoutesEditable || !mapState.showSavedRoutes) {
      const x = e.domEvent.clientX;
      const y = e.domEvent.clientY;

      if (icon.type === "Splitter") {
        setMapState((prevState) => ({
          ...prevState,
          selectedLineForActions: null,
          lineActionPosition: null,
          exactClickPosition: null,
          showModal: false,
          selectedSplitter: icon,
          showSplitterModal: true,
          splitterRatio: icon.splitterRatio || "",
          splitterInput: icon.name || "",
          waypointActionPosition: { x, y },
          editingLineId: null,
          tempLineName: "",
        }));
      } else if (icon.type === "Termination") {
        setMapState((prevState) => ({
          ...prevState,
          selectedLineForActions: null,
          lineActionPosition: null,
          exactClickPosition: null,
          showModal: false,
          showTerminationModal: true,
          selectedTermination: icon,
          pendingConnection: { leftColor: null, rightColor: null },
          waypointActionPosition: { x, y },
        }));
        initializeNodesAndEdges(icon);
        setDrawingSource(null);
      } else {
        setMapState((prevState) => ({
          ...prevState,
          selectedLineForActions: null,
          lineActionPosition: null,
          exactClickPosition: null,
          showModal: false,
          selectedWaypoint: icon,
          waypointActionPosition: { x, y },
          selectedWaypointInfo: { isIcon: true, iconId: icon.id },
        }));
      }
    }
  };

  const removeSelectedIcon = () => {
    if (!mapState.selectedWaypointInfo || !mapState.selectedWaypointInfo.isIcon)
      return;
    if (mapState.showSavedRoutes && !mapState.isSavedRoutesEditable) return;

    const { iconId } = mapState.selectedWaypointInfo;

    setMapState((prevState) => {
      const updatedImageIcons = prevState.imageIcons.filter(
        (icon) => icon.id !== iconId
      );
      const updatedSavedIcons = prevState.savedIcons.filter(
        (icon) => icon.id !== iconId
      );

      if (prevState.showSavedRoutes) {
        localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
      }

      return {
        ...prevState,
        imageIcons: updatedImageIcons,
        savedIcons: updatedSavedIcons,
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      };
    });
  };

  const addSplitterAtWaypoint = () => {
    if (
      !mapState.selectedWaypointInfo ||
      !isInteractionAllowed(mapState.selectedWaypointInfo.isSavedLine)
    )
      return;

    const { lineIndex, waypointIndex, isSavedLine } =
      mapState.selectedWaypointInfo;
    const targetArray = isSavedLine
      ? mapState.savedPolylines
      : mapState.fiberLines;
    const waypoint = targetArray[lineIndex].waypoints[waypointIndex];

    const newSplitter = {
      lat: waypoint.lat,
      lng: waypoint.lng,
      type: "Splitter",
      id: `icon-${mapState.nextNumber}`,
      splitterRatio: "",
      name: "",
      nextLineNumber: 1,
      linkedLineIndex: lineIndex,
      linkedWaypointIndex: waypointIndex,
      isSavedLine: isSavedLine,
    };

    setMapState((prevState) => {
      const updatedImageIcons = [...prevState.imageIcons, newSplitter];
      const updatedSavedIcons = isSavedLine
        ? [...prevState.savedIcons, newSplitter]
        : prevState.savedIcons;

      if (isSavedLine) {
        localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
      }

      return {
        ...prevState,
        imageIcons: updatedImageIcons,
        savedIcons: updatedSavedIcons,
        nextNumber: prevState.nextNumber + 1,
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      };
    });
  };

  const removeSelectedLine = () => {
    if (
      !mapState.selectedLineForActions ||
      !isInteractionAllowed(mapState.selectedLineForActions.isSavedLine)
    )
      return;

    const { index, isSavedLine } = mapState.selectedLineForActions;

    setMapState((prevState) => {
      let updatedFiberLines = [...prevState.fiberLines];
      let updatedSavedPolylines = [...prevState.savedPolylines];
      let updatedImageIcons = [...prevState.imageIcons];
      let updatedSavedIcons = [...prevState.savedIcons];

      if (isSavedLine) {
        updatedSavedPolylines = prevState.savedPolylines.filter(
          (_, i) => i !== index
        );
        localStorage.setItem(
          "savedPolylines",
          JSON.stringify(updatedSavedPolylines)
        );
      } else {
        updatedFiberLines = prevState.fiberLines.filter((_, i) => i !== index);
      }

      updatedSavedIcons = updatedImageIcons.map((icon) => ({
        ...(updatedSavedIcons.find((si) => si.id === icon.id) || {}),
        ...icon,
      }));

      if (isSavedLine) {
        localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
      }

      return {
        ...prevState,
        savedPolylines: updatedSavedPolylines,
        fiberLines: isSavedLine
          ? prevState.showSavedRoutes
            ? updatedSavedPolylines
            : prevState.fiberLines
          : updatedFiberLines,
        imageIcons: updatedImageIcons,
        savedIcons: updatedSavedIcons,
        selectedLineForActions: null,
        lineActionPosition: null,
        exactClickPosition: null,
      };
    });
  };

  const handleMarkerDragEnd = (iconId, e) => {
    if (mapState.showSavedRoutes && !mapState.isSavedRoutesEditable) return;

    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();

    setMapState((prevState) => {
      const draggedIcon = prevState.imageIcons.find(
        (icon) => icon.id === iconId
      );
      const updatedImageIcons = prevState.imageIcons.map((icon) =>
        icon.id === iconId ? { ...icon, lat: newLat, lng: newLng } : icon
      );

      let updatedSavedIcons = [...prevState.savedIcons];
      if (prevState.showSavedRoutes) {
        updatedSavedIcons = prevState.savedIcons.map((icon) =>
          icon.id === iconId ? { ...icon, lat: newLat, lng: newLng } : icon
        );
        localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
      }

      let updatedFiberLines = [...prevState.fiberLines];
      let updatedSavedPolylines = [...prevState.savedPolylines];

      if (
        draggedIcon.type === "Splitter" &&
        draggedIcon.linkedLineIndex !== undefined &&
        draggedIcon.linkedWaypointIndex !== undefined
      ) {
        const targetArray = draggedIcon.isSavedLine
          ? updatedSavedPolylines
          : updatedFiberLines;
        targetArray[draggedIcon.linkedLineIndex] = {
          ...targetArray[draggedIcon.linkedLineIndex],
          waypoints: targetArray[draggedIcon.linkedLineIndex].waypoints.map(
            (wp, idx) =>
              idx === draggedIcon.linkedWaypointIndex
                ? { lat: newLat, lng: newLng }
                : wp
          ),
        };
        if (draggedIcon.isSavedLine) {
          localStorage.setItem(
            "savedPolylines",
            JSON.stringify(updatedSavedPolylines)
          );
        }
      }

      const updateLines = (lines) =>
        lines.map((line) => {
          let updatedLine = { ...line };

          if (
            isSnappedToIcon(line.from.lat, line.from.lng) &&
            line.from.lat === draggedIcon.lat &&
            line.from.lng === draggedIcon.lng
          ) {
            updatedLine.from = { lat: newLat, lng: newLng };
          }

          if (
            isSnappedToIcon(line.to.lat, line.to.lng) &&
            line.to.lat === draggedIcon.lat &&
            line.to.lng === draggedIcon.lng
          ) {
            updatedLine.to = { lat: newLat, lng: newLng };
          }

          if (line.waypoints) {
            updatedLine.waypoints = line.waypoints.map((wp) =>
              wp.lat === draggedIcon.lat && wp.lng === draggedIcon.lng
                ? { lat: newLat, lng: newLng }
                : wp
            );
          }

          return updatedLine;
        });

      updatedFiberLines = updateLines(updatedFiberLines);
      updatedSavedPolylines = updateLines(updatedSavedPolylines);

      if (prevState.showSavedRoutes) {
        localStorage.setItem(
          "savedPolylines",
          JSON.stringify(updatedSavedPolylines)
        );
      }

      return {
        ...prevState,
        imageIcons: updatedImageIcons,
        savedIcons: updatedSavedIcons,
        fiberLines: updatedFiberLines,
        savedPolylines: updatedSavedPolylines,
      };
    });
  };

  const generateUniqueId = () => {
    return `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleSplitterRatioChange = (e) => {
    const newRatio = e.target.value;
    if (newRatio === "") return;

    const connectedLines = getConnectedLinesCount(mapState.selectedSplitter);
    const newRatioNum = getRatioNumber(newRatio);

    if (newRatioNum < connectedLines) {
      alert(
        `Cannot select ${newRatio}. It must be at least equal to the number of connected lines (${connectedLines}).`
      );
      return;
    }

    const timestamp = mapState.selectedSplitter.ratioSetTimestamp || Date.now();
    setMapState((prevState) => ({
      ...prevState,
      splitterRatio: newRatio,
      imageIcons: prevState.imageIcons.map((icon) =>
        icon.id === prevState.selectedSplitter?.id
          ? { ...icon, splitterRatio: newRatio, ratioSetTimestamp: timestamp }
          : icon
      ),
      savedIcons: prevState.savedIcons.map((icon) =>
        icon.id === prevState.selectedSplitter?.id
          ? { ...icon, splitterRatio: newRatio, ratioSetTimestamp: timestamp }
          : icon
      ),
    }));
  };

  const closeSplitterModal = () => {
    setMapState((prevState) => ({
      ...prevState,
      showSplitterModal: false,
      selectedSplitter: null,
      splitterInput: "",
      editingLineId: null,
      tempLineName: "",
    }));
  };

  const handleSplitterInputChange = (e) => {
    const newName = e.target.value;
    setMapState((prevState) => ({
      ...prevState,
      splitterInput: newName,
      imageIcons: prevState.imageIcons.map((icon) =>
        icon.id === prevState.selectedSplitter?.id
          ? { ...icon, name: newName }
          : icon
      ),
      savedIcons: prevState.savedIcons.map((icon) =>
        icon.id === prevState.selectedSplitter?.id
          ? { ...icon, name: newName }
          : icon
      ),
    }));
  };

  const addFiberLine = () => {
    const { rightClickMarker } = mapState;
    if (!rightClickMarker) return;

    const newFiberLine = {
      id: generateUniqueId(),
      from: { lat: rightClickMarker.lat, lng: rightClickMarker.lng },
      to: {
        lat: rightClickMarker.lat + 0.001,
        lng: rightClickMarker.lng + 0.001,
      },
      waypoints: [],
      createdAt: Date.now(),
      name: "",
    };

    setMapState((prevState) => ({
      ...prevState,
      fiberLines: [...prevState.fiberLines, newFiberLine],
      showModal: false,
      selectedPoint: null,
      rightClickMarker: null,
    }));
  };

  const handleStartMarkerDragEnd = (index, e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const nearestIcon = findNearestIcon(newLat, newLng);

    setMapState((prevState) => {
      const updatedLines = [...prevState.fiberLines];
      const line = updatedLines[index];
      const newFrom = nearestIcon
        ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
        : { lat: newLat, lng: newLng };

      if (nearestIcon && nearestIcon.type === "Termination") {
        const connectedLines = getConnectedLinesCount(nearestIcon);
        if (
          connectedLines >= 2 &&
          !isSnappedToIcon(line.from.lat, line.from.lng)
        ) {
          alert(
            "Cannot connect more lines. Termination box allows only 2 connections."
          );
          return prevState;
        }
      } else if (
        nearestIcon &&
        nearestIcon.type === "Splitter" &&
        nearestIcon.splitterRatio
      ) {
        const splitNum = getRatioNumber(nearestIcon.splitterRatio);
        const connectedLines = getConnectedLinesCount(nearestIcon);

        if (
          connectedLines >= splitNum &&
          !isSnappedToIcon(line.from.lat, line.from.lng)
        ) {
          alert(
            `Cannot connect more lines. Splitter ratio limit (${nearestIcon.splitterRatio}) reached.`
          );
          return prevState;
        }

        if (!isSnappedToIcon(line.from.lat, line.from.lng)) {
          console.log("Line start connected to splitter:", {
            lineId: line.id,
            splitterId: nearestIcon.id,
            ratio: nearestIcon.splitterRatio,
          });
          const splitter = prevState.imageIcons.find(
            (icon) => icon.id === nearestIcon.id
          );
          const lineNumber = splitter.nextLineNumber || 1;
          const newLineName = `Line ${lineNumber}`;
          updatedLines[index] = {
            ...line,
            from: newFrom,
            name: newLineName,
            createdAt: Date.now(),
          };
          const updatedImageIcons = prevState.imageIcons.map((icon) =>
            icon.id === nearestIcon.id
              ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
              : icon
          );
          return {
            ...prevState,
            fiberLines: updatedLines,
            imageIcons: updatedImageIcons,
          };
        }
      }

      updatedLines[index] = {
        ...line,
        from: newFrom,
        createdAt: line.createdAt || Date.now(),
      };
      return { ...prevState, fiberLines: updatedLines };
    });
  };

  const handleEndMarkerDragEnd = (index, e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const nearestIcon = findNearestIcon(newLat, newLng);

    setMapState((prevState) => {
      const updatedLines = [...prevState.fiberLines];
      const line = updatedLines[index];
      const newTo = nearestIcon
        ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
        : { lat: newLat, lng: newLng };

      if (nearestIcon && nearestIcon.type === "Termination") {
        const connectedLines = getConnectedLinesCount(nearestIcon);
        if (connectedLines >= 2 && !isSnappedToIcon(line.to.lat, line.to.lng)) {
          alert(
            "Cannot connect more lines. Termination box allows only 2 connections."
          );
          return prevState;
        }
      } else if (
        nearestIcon &&
        nearestIcon.type === "Splitter" &&
        nearestIcon.splitterRatio
      ) {
        const splitNum = getRatioNumber(nearestIcon.splitterRatio);
        const connectedLines = getConnectedLinesCount(nearestIcon);

        if (
          connectedLines >= splitNum &&
          !isSnappedToIcon(line.to.lat, line.to.lng)
        ) {
          alert(
            `Cannot connect more lines. Splitter ratio limit (${nearestIcon.splitterRatio}) reached.`
          );
          return prevState;
        }

        if (!isSnappedToIcon(line.to.lat, line.to.lng)) {
          console.log("Line end connected to splitter:", {
            lineId: line.id,
            splitterId: nearestIcon.id,
            ratio: nearestIcon.splitterRatio,
          });
          const splitter = prevState.imageIcons.find(
            (icon) => icon.id === nearestIcon.id
          );
          const lineNumber = splitter.nextLineNumber || 1;
          const newLineName = `Line ${lineNumber}`;
          updatedLines[index] = {
            ...line,
            to: newTo,
            name: newLineName,
            createdAt: Date.now(),
          };
          const updatedImageIcons = prevState.imageIcons.map((icon) =>
            icon.id === nearestIcon.id
              ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
              : icon
          );
          return {
            ...prevState,
            fiberLines: updatedLines,
            imageIcons: updatedImageIcons,
          };
        }
      }

      updatedLines[index] = {
        ...line,
        to: newTo,
        createdAt: line.createdAt || Date.now(),
      };
      return { ...prevState, fiberLines: updatedLines };
    });
  };

  const handleWaypointDragEnd = (lineIndex, waypointIndex, e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const nearestIcon = findNearestIcon(newLat, newLng);

    setMapState((prevState) => {
      const updatedFiberLines = [...prevState.fiberLines];
      const line = updatedFiberLines[lineIndex];
      const newWaypoint = nearestIcon
        ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
        : { lat: newLat, lng: newLng };

      if (
        nearestIcon &&
        nearestIcon.type === "Splitter" &&
        nearestIcon.splitterRatio
      ) {
        const splitNum = getRatioNumber(nearestIcon.splitterRatio);
        const connectedLines = getConnectedLinesCount(nearestIcon);

        if (
          connectedLines >= splitNum &&
          !line.waypoints.some(
            (wp, idx) =>
              idx === waypointIndex &&
              wp.lat === nearestIcon.lat &&
              wp.lng === nearestIcon.lng
          )
        ) {
          alert(
            `Cannot connect more lines. Splitter ratio limit (${nearestIcon.splitterRatio}) reached.`
          );
          return prevState;
        }

        const updatedWaypoints = line.waypoints.map((wp, idx) =>
          idx === waypointIndex ? newWaypoint : wp
        );

        if (
          !line.waypoints.some(
            (wp, idx) =>
              idx === waypointIndex &&
              wp.lat === nearestIcon.lat &&
              wp.lng === nearestIcon.lng
          )
        ) {
          console.log("Waypoint connected to splitter:", {
            lineId: line.id,
            waypointIndex,
            splitterId: nearestIcon.id,
            ratio: nearestIcon.splitterRatio,
          });
          const splitter = prevState.imageIcons.find(
            (icon) => icon.id === nearestIcon.id
          );
          const lineNumber = splitter.nextLineNumber || 1;
          const newLineName = `Line ${lineNumber}`;
          updatedFiberLines[lineIndex] = {
            ...line,
            waypoints: updatedWaypoints,
            name: newLineName,
            createdAt: Date.now(),
          };
          const updatedImageIcons = prevState.imageIcons.map((icon) =>
            icon.id === nearestIcon.id
              ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
              : icon
          );
          return {
            ...prevState,
            fiberLines: updatedFiberLines,
            imageIcons: updatedImageIcons,
          };
        }
      }

      updatedFiberLines[lineIndex] = {
        ...line,
        waypoints: line.waypoints.map((wp, idx) =>
          idx === waypointIndex ? newWaypoint : wp
        ),
        createdAt: line.createdAt || Date.now(),
      };
      return { ...prevState, fiberLines: updatedFiberLines };
    });
  };

  const saveRoute = () => {
    if (mapState.fiberLines.length > 0) {
      const polylinesToSave = mapState.fiberLines.map((line) => ({
        id: line.id || generateUniqueId(),
        from: { ...line.from },
        to: { ...line.to },
        waypoints: line.waypoints ? [...line.waypoints] : [],
        createdAt: line.createdAt || Date.now(),
        strokeColor: "#0000FF",
        name: line.name || "",
      }));

      const savedPolylines =
        JSON.parse(localStorage.getItem("savedPolylines")) || [];
      const updatedSavedPolylines = [
        ...savedPolylines.filter(
          (existing) =>
            !polylinesToSave.some((newLine) => newLine.id === existing.id)
        ),
        ...polylinesToSave,
      ];

      localStorage.setItem(
        "savedPolylines",
        JSON.stringify(updatedSavedPolylines)
      );

      setMapState((prevState) => ({
        ...prevState,
        savedPolylines: updatedSavedPolylines,
        showSavedRoutes: true,
        fiberLines: updatedSavedPolylines.map((polyline) => ({
          ...polyline,
          strokeColor: "#0000FF",
        })),
      }));
    }

    if (mapState.imageIcons.length > 0) {
      const iconsToSave = mapState.imageIcons.map((icon, index) => ({
        id: icon.id || `icon-${Date.now()}-${index}`,
        lat: icon.lat,
        lng: icon.lng,
        type: icon.type,
        imageUrl: icon.imageUrl,
        splitterRatio: icon.splitterRatio,
        ratioSetTimestamp: icon.ratioSetTimestamp,
        linkedLineIndex: icon.linkedLineIndex,
        linkedWaypointIndex: icon.linkedWaypointIndex,
        isSavedLine: icon.isSavedLine,
        name: icon.name || "",
        nextLineNumber: icon.nextLineNumber || null,
        createdAt: new Date().toISOString(),
      }));

      const savedIcons = JSON.parse(localStorage.getItem("savedIcons")) || [];
      const updatedSavedIcons = [
        ...savedIcons.filter(
          (existing) =>
            !iconsToSave.some((newIcon) => newIcon.id === existing.id)
        ),
        ...iconsToSave,
      ];
      localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));

      setMapState((prevState) => ({
        ...prevState,
        savedIcons: updatedSavedIcons,
        imageIcons: updatedSavedIcons.map((icon) => ({
          lat: icon.lat,
          lng: icon.lng,
          type: icon.type,
          imageUrl: icon.imageUrl,
          id: icon.id,
          splitterRatio: icon.splitterRatio,
          ratioSetTimestamp: icon.ratioSetTimestamp,
          linkedLineIndex: icon.linkedLineIndex,
          linkedWaypointIndex: icon.linkedWaypointIndex,
          isSavedLine: icon.isSavedLine,
          name: icon.name,
          nextLineNumber: icon.nextLineNumber,
        })),
      }));
    }

    if (mapState.fiberLines.length > 0 || mapState.imageIcons.length > 0) {
      alert("Polylines and Icons saved successfully!");
    } else {
      alert("No routes or icons to save!");
    }
  };

  useEffect(() => {
    const savedPolylines =
      JSON.parse(localStorage.getItem("savedPolylines")) || [];
    const savedIcons = JSON.parse(localStorage.getItem("savedIcons")) || [];

    setMapState((prevState) => ({
      ...prevState,
      savedPolylines: savedPolylines.map((line) => ({
        ...line,
        name: line.name || "",
      })),
      savedIcons,
      imageIcons: savedIcons.map((icon) => ({
        ...icon,
        splitterRatio:
          icon.splitterRatio || (icon.type === "Splitter" ? "" : null),
        ratioSetTimestamp: icon.ratioSetTimestamp,
        linkedLineIndex: icon.linkedLineIndex,
        linkedWaypointIndex: icon.linkedWaypointIndex,
        isSavedLine: icon.isSavedLine,
        name: icon.name || "",
        nextLineNumber:
          icon.nextLineNumber || (icon.type === "Splitter" ? 1 : null),
      })),
    }));
  }, []);

  const togglePreviousRoutes = () => {
    setMapState((prevState) => ({
      ...prevState,
      showSavedRoutes: !prevState.showSavedRoutes,
      isSavedRoutesEditable: false,
      fiberLines: !prevState.showSavedRoutes ? prevState.savedPolylines : [],
      imageIcons: !prevState.showSavedRoutes ? prevState.savedIcons : [],
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
    }));
  };

  const resetMap = () => {
    setMapState({
      savedRoutes: mapState.savedRoutes,
      showSavedRoutes: false,
      nextNumber: 1,
      selectedType: null,
      showModal: false,
      selectedPoint: null,
      rightClickMarker: null,
      fiberLines: [],
      imageIcons: [],
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
      showSplitterModal: false,
      selectedSplitter: null,
      splitterRatio: "",
      splitterInput: "",
      editingLineId: null,
      tempLineName: "",
    });
  };

  const initializeNodesAndEdges = useCallback(
    (selectedTermination) => {
      // console.log("Initializing nodes for termination:", selectedTermination.id);
      const leftNodes = terminationColors.map((color, index) => ({
        id: `left-${color.number}`,
        type: "custom",
        position: { x: 10, y: 40 + index * 50 },
        data: { label: `${color.number}`, color: color.value, side: "left" },
      }));

      const rightNodes = terminationColors.map((color, index) => ({
        id: `right-${color.number}`,
        type: "custom",
        position: { x: 290, y: 40 + index * 50 },
        data: { label: `${color.number}`, color: color.value, side: "right" },
      }));

      const initialNodes = [...leftNodes, ...rightNodes];
      setNodes(initialNodes);
      // console.log("Initial nodes set:", initialNodes);

      const prevEdges = mapState.terminationConnections
        .filter((conn) => conn.terminationId === selectedTermination.id)
        .map((conn, index) => {
          const leftIndex = terminationColors.findIndex(
            (c) => c.value === conn.leftColor
          );
          const rightIndex = terminationColors.findIndex(
            (c) => c.value === conn.rightColor
          );
          return {
            id: `edge-${index}`,
            source: `left-${leftIndex + 1}`,
            target: `right-${rightIndex + 1}`,
            sourceHandle: "right",
            targetHandle: "left",
            style: { stroke: "black", strokeWidth: 2 },
          };
        });

      setEdges(prevEdges);
      // console.log("Initial edges set:", prevEdges);
    },
    [mapState.terminationConnections, setNodes, setEdges]
  );

  const handleNodeClick = useCallback(
    (event, node) => {
      // console.log("Node clicked:", node.id, node.data);
      if (
        node.data.side === "left" &&
        !drawingSource &&
        !mapState.tempConnection
      ) {
        setDrawingSource(node.id);
        // console.log("Drawing source set to:", node.id);
      } else if (node.data.side === "right" && drawingSource) {
        console.log("Connecting:", drawingSource, "to", node.id);
        const newEdge = {
          id: `edge-${Date.now()}`,
          source: drawingSource,
          target: node.id,
          sourceHandle: "right",
          targetHandle: "left",
          style: { stroke: "black", strokeWidth: 2 },
        };
        setEdges((eds) => {
          const updatedEdges = [
            ...eds.filter((e) => e.id !== "drawing-edge"),
            newEdge,
          ];
          // console.log("Edges updated:", updatedEdges);
          return updatedEdges;
        });
        setMapState((prevState) => ({
          ...prevState,
          tempConnection: {
            source: drawingSource,
            target: node.id,
            sourceHandle: "right",
            targetHandle: "left",
          },
        }));
        setDrawingSource(null);
        setNodes((nds) => {
          const updatedNodes = nds.filter((n) => n.id !== "temp");
          // console.log("Nodes updated (temp removed):", updatedNodes);
          return updatedNodes;
        });
      }
    },
    [drawingSource, mapState.tempConnection, setEdges, setNodes]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!drawingSource) return;
      // console.log("Mouse move detected, drawingSource:", drawingSource);
      // const flowEl = flowRef.current?.querySelector(".reactflow");
      // if (!flowEl) {
      //   console.warn("React Flow container not found");
      //   return;
      // }
      const rect = flowEl.getBoundingClientRect();
      // console.log("Flow container rect:", rect);

      const tempNode = {
        id: "temp",
        type: "custom",
        position: {
          x: e.clientX - rect.left - 5,
          y: e.clientY - rect.top - 5,
        },
        data: { label: "", color: "transparent", side: "temp" },
      };

      setNodes((nds) => {
        const others = nds.filter((n) => n.id !== "temp");
        const updatedNodes = [...others, tempNode];
        // console.log("Temp node updated:", tempNode);
        return updatedNodes;
      });

      setEdges((eds) => {
        const others = eds.filter((e) => e.id !== "drawing-edge");
        const drawingEdge = {
          id: "drawing-edge",
          source: drawingSource,
          sourceHandle: "right",
          target: "temp",
          targetHandle: "temp",
          animated: true,
          style: { stroke: "black", strokeWidth: 2 },
        };
        const updatedEdges = [...others, drawingEdge];
        // console.log("Drawing edge updated:", drawingEdge);
        return updatedEdges;
      });
    },
    [drawingSource, setNodes, setEdges]
  );

  const saveTerminationConnection = useCallback(() => {
    if (!mapState.tempConnection) {
      // console.log("No temp connection, closing modal");
      setMapState((prevState) => ({
        ...prevState,
        showTerminationModal: false,
        selectedTermination: null,
        tempConnection: null,
      }));
      setNodes([]);
      setEdges([]);
      setDrawingSource(null);
      return;
    }

    const leftNumber = parseInt(mapState.tempConnection.source.split("-")[1]);
    const rightNumber = parseInt(mapState.tempConnection.target.split("-")[1]);
    const newConnection = {
      terminationId: mapState.selectedTermination.id,
      leftColor: terminationColors[leftNumber - 1].value,
      rightColor: terminationColors[rightNumber - 1].value,
    };

    console.log("Saving connection:", newConnection);
    setMapState((prevState) => ({
      ...prevState,
      terminationConnections: [
        ...prevState.terminationConnections,
        newConnection,
      ],
      showTerminationModal: false,
      selectedTermination: null,
      tempConnection: null,
    }));
    setNodes([]);
    setEdges([]);
    setDrawingSource(null);
  }, [
    mapState.tempConnection,
    mapState.selectedTermination,
    setNodes,
    setEdges,
  ]);

  const closeTerminationModal = useCallback(() => {
    console.log("Closing termination modal");
    setMapState((prevState) => ({
      ...prevState,
      showTerminationModal: false,
      selectedTermination: null,
      tempConnection: null,
    }));
    setNodes([]);
    setEdges([]);
    setDrawingSource(null);
  }, [setNodes, setEdges]);

  const handleSavedPolylinePointDragEnd = (polylineId, pointType, e) => {
    if (!mapState.isSavedRoutesEditable) return;

    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const nearestIcon = findNearestIcon(newLat, newLng);

    setMapState((prevState) => {
      const updatedSavedPolylines = prevState.savedPolylines.map(
        (polyline) => ({
          ...polyline,
          from: { ...polyline.from },
          to: { ...polyline.to },
          waypoints: polyline.waypoints ? [...polyline.waypoints] : [],
        })
      );

      let polylineUpdated = false;

      const newSavedPolylines = updatedSavedPolylines.map((polyline) => {
        if (polyline.id === polylineId) {
          if (
            nearestIcon &&
            nearestIcon.type === "Splitter" &&
            nearestIcon.ratioSetTimestamp
          ) {
            const splitNum = getRatioNumber(nearestIcon.splitterRatio);
            const connectedLines = getConnectedLinesCount(nearestIcon);

            if (
              connectedLines >= splitNum &&
              !isSnappedToIcon(polyline[pointType].lat, polyline[pointType].lng)
            ) {
              alert(
                `Cannot connect more lines. Splitter ratio limit (${nearestIcon.splitterRatio} = ${splitNum}) reached.`
              );
              return polyline;
            }

            if (
              !isSnappedToIcon(polyline[pointType].lat, polyline[pointType].lng)
            ) {
              console.log(
                `Saved polyline ${pointType} connected to splitter:`,
                {
                  polylineId,
                  splitterId: nearestIcon.id,
                  ratio: nearestIcon.splitterRatio,
                }
              );
              const splitter = prevState.imageIcons.find(
                (icon) => icon.id === nearestIcon.id
              );
              const lineNumber = splitter.nextLineNumber || 1;
              const newLineName = `Line ${lineNumber}`;
              polylineUpdated = true;
              return {
                ...polyline,
                [pointType]: {
                  lat: nearestIcon.lat,
                  lng: nearestIcon.lng,
                },
                name: newLineName,
                createdAt: polyline.createdAt || Date.now(),
              };
            }
          }

          polylineUpdated = true;
          return {
            ...polyline,
            [pointType]: { lat: newLat, lng: newLng },
            createdAt: polyline.createdAt || Date.now(),
          };
        }
        return polyline;
      });

      if (!polylineUpdated) return prevState;

      const updatedImageIcons =
        nearestIcon && nearestIcon.type === "Splitter"
          ? prevState.imageIcons.map((icon) =>
              icon.id === nearestIcon.id
                ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
                : icon
            )
          : prevState.imageIcons;

      localStorage.setItem("savedPolylines", JSON.stringify(newSavedPolylines));

      return {
        ...prevState,
        savedPolylines: newSavedPolylines,
        fiberLines: prevState.showSavedRoutes
          ? newSavedPolylines
          : prevState.fiberLines,
        imageIcons: updatedImageIcons,
        savedIcons: prevState.savedIcons.map((icon) =>
          icon.id === nearestIcon?.id
            ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
            : icon
        ),
      };
    });
  };

  const handleSavedPolylineWaypointDragEnd = (polylineId, waypointIndex, e) => {
    if (!mapState.isSavedRoutesEditable) return;

    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const nearestIcon = findNearestIcon(newLat, newLng);

    setMapState((prevState) => {
      const updatedSavedPolylines = prevState.savedPolylines.map((polyline) => {
        if (polyline.id === polylineId && polyline.waypoints) {
          if (
            nearestIcon &&
            nearestIcon.type === "Splitter" &&
            nearestIcon.ratioSetTimestamp
          ) {
            const splitNum = getRatioNumber(nearestIcon.splitterRatio);
            const connectedLines = getConnectedLinesCount(nearestIcon);

            if (
              connectedLines >= splitNum &&
              !polyline.waypoints.some(
                (wp, idx) =>
                  idx === waypointIndex &&
                  wp.lat === nearestIcon.lat &&
                  wp.lng === nearestIcon.lng
              )
            ) {
              alert(
                `Cannot connect more lines. Splitter ratio limit (${nearestIcon.splitterRatio} = ${splitNum}) reached.`
              );
              return polyline;
            }

            if (
              !polyline.waypoints.some(
                (wp, idx) =>
                  idx === waypointIndex &&
                  wp.lat === nearestIcon.lat &&
                  wp.lng === nearestIcon.lng
              )
            ) {
              console.log("Saved waypoint connected to splitter:", {
                polylineId,
                waypointIndex,
                splitterId: nearestIcon.id,
                ratio: nearestIcon.splitterRatio,
              });
              const splitter = prevState.imageIcons.find(
                (icon) => icon.id === nearestIcon.id
              );
              const lineNumber = splitter.nextLineNumber || 1;
              const newLineName = `Line ${lineNumber}`;
              return {
                ...polyline,
                waypoints: polyline.waypoints.map((waypoint, index) =>
                  index === waypointIndex
                    ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
                    : waypoint
                ),
                name: newLineName,
                createdAt: polyline.createdAt || Date.now(),
              };
            }
          }

          return {
            ...polyline,
            waypoints: polyline.waypoints.map((waypoint, index) =>
              index === waypointIndex ? { lat: newLat, lng: newLng } : waypoint
            ),
          };
        }
        return polyline;
      });

      const updatedImageIcons =
        nearestIcon && nearestIcon.type === "Splitter"
          ? prevState.imageIcons.map((icon) =>
              icon.id === nearestIcon.id
                ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
                : icon
            )
          : prevState.imageIcons;

      localStorage.setItem(
        "savedPolylines",
        JSON.stringify(updatedSavedPolylines)
      );

      return {
        ...prevState,
        savedPolylines: updatedSavedPolylines,
        fiberLines: prevState.showSavedRoutes
          ? updatedSavedPolylines
          : prevState.fiberLines,
        imageIcons: updatedImageIcons,
        savedIcons: prevState.savedIcons.map((icon) =>
          icon.id === nearestIcon?.id
            ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
            : icon
        ),
      };
    });
  };

  const toggleSavedRoutesEditability = () => {
    setMapState((prevState) => ({
      ...prevState,
      isSavedRoutesEditable: !prevState.isSavedRoutesEditable,
    }));
  };

  const closeWaypointActions = () => {
    setMapState((prevState) => ({
      ...prevState,
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
    }));
  };

  const isWaypointOverlaidBySplitter = (waypoint) => {
    return mapState.imageIcons.some(
      (icon) =>
        icon.type === "Splitter" &&
        Math.abs(icon.lat - waypoint.lat) < 0.0001 &&
        Math.abs(icon.lng - waypoint.lng) < 0.0001
    );
  };

  // Handle map load to store map instance
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Add custom controls when map loads
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Clear existing controls to prevent duplicates
    mapRef.current.controls[
      window.google.maps.ControlPosition.TOP_CENTER
    ].clear();

    const controlDiv = document.createElement("div");
    controlDiv.className = "map-controls";

    const buttons = [
      {
        imgSrc: "/img/Reset.jpg", // Ensure this file exists in your public/img folder
        tooltip: "Reset Map",
        onClick: resetMap,
      },
      {
        imgSrc: "/img/Save.png",
        tooltip: "Save Route",
        onClick: saveRoute,
      },
      {
        imgSrc: mapState.showSavedRoutes
          ? "/img/Eye-close.png"
          : "/img/Eye.png",
        tooltip: mapState.showSavedRoutes
          ? "Hide Previous Routes"
          : "Show Previous Routes",
        onClick: togglePreviousRoutes,
      },
      ...(mapState.showSavedRoutes
        ? [
            {
              imgSrc: mapState.isSavedRoutesEditable
                ? "/img/Edit-not.png"
                : "/img/Edit.png",
              tooltip: mapState.isSavedRoutesEditable
                ? "Disable Editing"
                : "Enable Editing",
              onClick: toggleSavedRoutesEditability,
            },
          ]
        : []),
    ];

    buttons.forEach(({ imgSrc, tooltip, onClick }) => {
      const button = document.createElement("button");
      button.className = "map-control-button";
      if (imgSrc) {
        const img = document.createElement("img");
        img.src = imgSrc;
        img.style.width = "20px";
        img.style.height = "20px";
        button.appendChild(img);
      }
      button.title = tooltip;
      button.addEventListener("click", onClick);
      controlDiv.appendChild(button);
    });
    // Add control to TOP_CENTER
    mapRef.current.controls[window.google.maps.ControlPosition.TOP_CENTER].push(
      controlDiv
    );

    // Debug log
    console.log("Controls added:", controlDiv);

    // Cleanup on unmount or state change
    return () => {
      if (mapRef.current && window.google) {
        mapRef.current.controls[
          window.google.maps.ControlPosition.TOP_CENTER
        ].clear();
      }
    };
  }, [
    mapState.showSavedRoutes,
    mapState.isSavedRoutesEditable,
    resetMap,
    saveRoute,
    togglePreviousRoutes,
    toggleSavedRoutesEditability,
  ]);

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    <>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={7}
        onRightClick={handleMapRightClick}
        options={{ styles: mapStyles, disableDefaultUI: false }}
        onLoad={onMapLoad} // Add onLoad handler
      >
        {/* Update MarkerF to use dynamic icon URL */}
        {mapState.imageIcons.map((icon) => (
          <MarkerF
            key={icon.id}
            position={{ lat: icon.lat, lng: icon.lng }}
            draggable={
              mapState.isSavedRoutesEditable || !mapState.showSavedRoutes
            }
            icon={{
              url: icon.imageUrl,
              scaledSize: new google.maps.Size(30, 30),
            }}
            onDragEnd={(e) => handleMarkerDragEnd(icon.id, e)}
            onRightClick={(e) => handleRightClickOnIcon(icon, e)}
            onClick={(e) => handleIconClick(icon, e)}
          />
        ))}
        {mapState.rightClickMarker && (
          <MarkerF
            key={`right-click-${mapState.rightClickMarker.lat}-${mapState.rightClickMarker.lng}`}
            position={mapState.rightClickMarker}
            icon={{
              url: "/img/location.jpg",
              scaledSize: new google.maps.Size(20, 20),
            }}
          />
        )}
        {mapState.fiberLines.map((line, index) => {
          const fullPath = [line.from, ...(line.waypoints || []), line.to];
          return (
            <React.Fragment key={line.id || `fiber-line-${index}`}>
              <PolylineF
                path={fullPath}
                options={{
                  strokeColor: line.strokeColor || "#FF0000",
                  strokeOpacity: 1.0,
                  strokeWeight: 2,
                }}
                onClick={(e) => {
                  e.domEvent.stopPropagation();
                  handleLineClick(line, index, false, e);
                }}
              />

              {mapState.selectedLineForActions &&
                mapState.exactClickPosition && (
                  <div
                    className="line-action-modal"
                    style={{
                      top: `${mapState.exactClickPosition.y - 95}px`,
                      left: `${mapState.exactClickPosition.x}px`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="line-action-item" onClick={addWaypoint}>
                      <Plus size={20} className="text-gray-600" />
                      <span className="line-action-tooltip">Add Waypoint</span>
                    </div>
                    <div
                      className="line-action-item"
                      onClick={removeSelectedLine}
                    >
                      <Trash2 size={20} className="text-red-500" />
                      <span className="line-action-tooltip">Delete Line</span>
                    </div>
                    <div
                      className="line-action-item"
                      onClick={() =>
                        setMapState((prev) => ({
                          ...prev,
                          selectedLineForActions: null,
                          lineActionPosition: null,
                          exactClickPosition: null,
                        }))
                      }
                    >
                      <span className="line-action-close">×</span>
                      <span className="line-action-tooltip">Close</span>
                    </div>
                    <div className="modal-spike"></div>
                  </div>
                )}

              {(line.waypoints || []).map((waypoint, waypointIndex) =>
                !isWaypointOverlaidBySplitter(waypoint) ? (
                  <MarkerF
                    key={`waypoint-${line.id}-${waypointIndex}`}
                    position={waypoint}
                    draggable={true}
                    onDragEnd={(e) =>
                      handleWaypointDragEnd(index, waypointIndex, e)
                    }
                    icon={{
                      url: "/img/location.jpg",
                      scaledSize: new google.maps.Size(15, 15),
                    }}
                    onClick={(e) => {
                      e.domEvent.stopPropagation();
                      handleWaypointClick(
                        index,
                        waypointIndex,
                        false,
                        waypoint,
                        e
                      );
                    }}
                  />
                ) : null
              )}
              {!isSnappedToIcon(line.from.lat, line.from.lng) && (
                <MarkerF
                  key={`start-${line.id}`}
                  position={line.from}
                  draggable={true}
                  onDragEnd={(e) => handleStartMarkerDragEnd(index, e)}
                  icon={{
                    url: "/img/location.jpg",
                    scaledSize: new google.maps.Size(20, 20),
                  }}
                />
              )}
              {!isSnappedToIcon(line.to.lat, line.to.lng) && (
                <MarkerF
                  key={`end-${line.id}`}
                  position={line.to}
                  draggable={true}
                  onDragEnd={(e) => handleEndMarkerDragEnd(index, e)}
                  icon={{
                    url: "/img/location.jpg",
                    scaledSize: new google.maps.Size(20, 20),
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
        {mapState.showSavedRoutes &&
          mapState.savedPolylines.map((polyline, index) => {
            const fullPath = [
              polyline.from,
              ...(polyline.waypoints || []),
              polyline.to,
            ];
            return (
              <React.Fragment key={`saved-polyline-${polyline.id}`}>
                <PolylineF
                  path={fullPath}
                  options={{
                    strokeColor: "#0000FF",
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                  }}
                  onClick={(e) => handleLineClick(polyline, index, true, e)}
                />

                {(polyline.waypoints || []).map((waypoint, waypointIndex) =>
                  !isWaypointOverlaidBySplitter(waypoint) ? (
                    <MarkerF
                      key={`saved-waypoint-${polyline.id}-${waypointIndex}`}
                      position={waypoint}
                      draggable={mapState.isSavedRoutesEditable}
                      onDragEnd={
                        mapState.isSavedRoutesEditable
                          ? (e) =>
                              handleSavedPolylineWaypointDragEnd(
                                polyline.id,
                                waypointIndex,
                                e
                              )
                          : undefined
                      }
                      icon={{
                        url: "/img/location.jpg",
                        scaledSize: new google.maps.Size(15, 15),
                      }}
                      onClick={(e) =>
                        handleWaypointClick(
                          index,
                          waypointIndex,
                          true,
                          waypoint,
                          e
                        )
                      }
                    />
                  ) : null
                )}
                {!isSnappedToIcon(polyline.from.lat, polyline.from.lng) && (
                  <MarkerF
                    key={`saved-start-${polyline.id}`}
                    position={polyline.from}
                    draggable={mapState.isSavedRoutesEditable}
                    onDragEnd={
                      mapState.isSavedRoutesEditable
                        ? (e) =>
                            handleSavedPolylinePointDragEnd(
                              polyline.id,
                              "from",
                              e
                            )
                        : undefined
                    }
                    icon={{
                      url: "/img/location.jpg",
                      scaledSize: new google.maps.Size(20, 20),
                    }}
                  />
                )}
                {!isSnappedToIcon(polyline.to.lat, polyline.to.lng) && (
                  <MarkerF
                    key={`saved-end-${polyline.id}`}
                    position={polyline.to}
                    draggable={mapState.isSavedRoutesEditable}
                    onDragEnd={
                      mapState.isSavedRoutesEditable
                        ? (e) =>
                            handleSavedPolylinePointDragEnd(
                              polyline.id,
                              "to",
                              e
                            )
                        : undefined
                    }
                    icon={{
                      url: "/img/location.jpg",
                      scaledSize: new google.maps.Size(20, 20),
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        {mapState.selectedWaypoint && mapState.waypointActionPosition && (
          <div
            className="line-action-modal"
            style={{
              top: `${mapState.waypointActionPosition.y - 100}px`,
              left: `${mapState.waypointActionPosition.x - 74}px`,
            }}
          >
            <div
              className="line-action-item"
              onClick={
                mapState.selectedWaypointInfo?.isIcon
                  ? removeSelectedIcon
                  : removeSelectedWaypoint
              }
            >
              <Trash2 size={20} color="red" />
              <span className="line-action-tooltip">Remove</span>
            </div>
            {!mapState.selectedWaypointInfo?.isIcon && (
              <div className="line-action-item" onClick={addSplitterAtWaypoint}>
                <Plus size={20} color="blue" />
                <span className="line-action-tooltip">Add Splitter</span>
              </div>
            )}
            <div className="line-action-item" onClick={closeWaypointActions}>
              <span className="close-icon">×</span>
              <span className="line-action-tooltip">Close</span>
            </div>
            <div className="modal-spike"></div>
          </div>
        )}
        {mapState.showSplitterModal && mapState.selectedSplitter && (
          <div
            className="splitter-modal"
            style={{
              top: `${mapState.waypointActionPosition.y - 270}px`,
              left: `${mapState.waypointActionPosition.x - 245}px`,
            }}
          >
            <div className="splitter-form">
              <div className="form-group">
                <label htmlFor="splitter-name" className="form-label">
                  Splitter Name
                </label>
                <input
                  id="splitter-name"
                  type="text"
                  value={mapState.splitterInput}
                  onChange={handleSplitterInputChange}
                  placeholder="Enter splitter name"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="splitter-ratio" className="form-label">
                  Splitter Ratio
                </label>
                <select
                  id="splitter-ratio"
                  value={mapState.splitterRatio}
                  onChange={handleSplitterRatioChange}
                  className="form-select"
                >
                  <option value="" disabled>
                    Choose a ratio
                  </option>
                  {getAvailableRatios(mapState.selectedSplitter).map(
                    (ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="form-footer">
                <button onClick={handleSave} className="btn btn-save">
                  Save
                </button>
                <button onClick={closeSplitterModal} className="btn btn-close">
                  Close
                </button>
              </div>
            </div>

            <div className="connected-lines-panel">
              <h4 className="panel-heading">Connected Lines</h4>
              <div className="connected-lines-list">
                {getConnectedLines(mapState.selectedSplitter).length > 0 ? (
                  getConnectedLines(mapState.selectedSplitter).map((line) => (
                    <div key={line.id} className="line-item">
                      {mapState.editingLineId === line.id ? (
                        <input
                          type="text"
                          value={mapState.tempLineName}
                          onChange={handleLineNameChange}
                          className="form-input"
                        />
                      ) : (
                        <span className="line-name">
                          {line.name || "Unnamed Line"}
                        </span>
                      )}
                      <div>
                        <button
                          onClick={() => handleEditLine(line.id, line.name)}
                          className="btn btn-edit"
                        >
                          <Edit size={16} color="#007bff" />
                        </button>
                        <button
                          onClick={() => removeConnectedLine(line.id)}
                          className="btn btn-delete"
                        >
                          <Trash2 size={16} color="#dc3545" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-lines-message">No connected lines</p>
                )}
              </div>
            </div>
            <div className="modal-spike"></div>
          </div>
        )}
        {mapState.showTerminationModal && mapState.selectedTermination && (
          <div
            className="termination-modal"
            style={{
              top: `${mapState.waypointActionPosition.y - 200}px`,
              left: `${mapState.waypointActionPosition.x - 350}px`,
              width: "400px",
              height: "300px",
            }}
          >
            <div
              className="termination-modal-content"
              style={{ height: "100%" }}
            >
              <div
                className="flow-container"
                style={{ width: "100%", height: "80%" }}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={handleNodeClick}
                  onPaneMouseMove={handleMouseMove}
                  nodeTypes={nodeTypes}
                  fitView
                  nodesDraggable={false}
                  nodesConnectable={false}
                  zoomOnScroll={false}
                  panOnScroll={false}
                  panOnDrag={false}
                  preventScrolling={false}
                  style={{ width: "100%", height: "100%" }}
                  proOptions={{ hideAttribution: true }} // Hide attribution as previously resolved
                >
                  <Background />
                </ReactFlow>
              </div>
              <div className="modal-footer">
                <button
                  onClick={saveTerminationConnection}
                  className="btn btn-save"
                >
                  Save
                </button>
                <button
                  onClick={closeTerminationModal}
                  className="btn btn-close"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="modal-spike"></div>
          </div>
        )}
      </GoogleMap>
      {/* Update modal to pass device UUID to handleSelection */}
      {mapState.showModal && mapState.selectedPoint && (
        <div
          className="modal"
          style={{
            top: `${mapState.selectedPoint.y - 110}px`,
            left: `${mapState.selectedPoint.x - 210}px`,
          }}
        >
          <button
            className="modal-close"
            onClick={() =>
              setMapState((prevState) => ({
                ...prevState,
                showModal: false,
                rightClickMarker: null,
              }))
            }
          >
            ×
          </button>
          <p className="modal-title">Select a type:</p>
          <div className="modal-buttons">
            {deviceTypes.map((device) => (
              <button
                key={device.uuid}
                onClick={() =>
                  handleSelection(device.model, device.icon, device.uuid)
                }
                className="modal-button"
              >
                {device.model}
              </button>
            ))}
            <button className="modal-button" onClick={addFiberLine}>
              Add Fiber
            </button>
          </div>
          <div className="modal-spike"></div>
        </div>
      )}
    </>
  );
};

export default MyMapV18;
