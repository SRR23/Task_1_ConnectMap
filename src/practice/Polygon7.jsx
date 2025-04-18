import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  GoogleMap,
  LoadScript,
  PolygonF as GooglePolygon,
  PolylineF,
  MarkerF,
} from "@react-google-maps/api";
import {
  Edit,
  Trash,
  Trash2,
  Plus,
  Eye,
  MoreVertical,
  Lock,
  Unlock,
} from "lucide-react";

import "reactflow/dist/style.css";
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  Handle,
} from "reactflow";

const CustomNode = React.memo(({ data }) => {
  return (
    <div
      style={{
        width: 180, // Increased from 130px
        height: 40, // Increased from 30px
        backgroundColor: data.color,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6, // Smoother corners
        cursor: "pointer",
        fontSize: 16, // Larger text
        fontWeight: "bold", // Bolder text
        padding: "0 12px", // More padding for text
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)", // Subtle shadow
        transition: "transform 0.2s, box-shadow 0.2s", // Smooth hover
        ":hover": {
          transform: "scale(1.05)", // Slight scale on hover
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)", // Stronger shadow on hover
        },
      }}
    >
      {data.label}
      {data.side === "left" && (
        <Handle
          type="source"
          position="right"
          id="right"
          style={{
            right: -6, // Adjusted for larger node
            top: "50%",
            transform: "translateY(-50%)",
            width: 12, // Larger handle
            height: 12,
            background: "transparent",
            border: "1px solid #333", // Subtle border for visibility
          }}
        />
      )}
      {data.side === "right" && (
        <Handle
          type="target"
          position="left"
          id="left"
          style={{
            left: -6, // Adjusted for larger node
            top: "50%",
            transform: "translateY(-50%)",
            width: 12,
            height: 12,
            background: "transparent",
            border: "1px solid #333", // Subtle border
          }}
        />
      )}
      {data.side === "temp" && (
        <Handle
          type="target"
          position="left"
          id="temp"
          style={{
            left: -6,
            top: "50%",
            transform: "translateY(-50%)",
            width: 12,
            height: 12,
            background: "transparent",
            border: "1px solid #333", // Subtle border
          }}
        />
      )}
    </div>
  );
});

// Define nodeTypes outside the component
const nodeTypes = { custom: CustomNode };

// const containerStyle = { width: "100%", height: "600px" };
const center = { lat: 23.685, lng: 90.3563 };

const libraries = ["drawing"];

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

const Polygon7 = () => {
  const iconImages = {
    BTS: "/img/bts.svg",
    Termination: "/img/termination-box.svg",
    Splitter: "/img/splitter.svg",
    ONU: "/img/ONU.png",
  };

  const terminationColors = [
    { number: 1, value: "#FF9999" }, // Light Red
    { number: 2, value: "#9999FF" }, // Light Blue
    { number: 3, value: "#99FF99" }, // Light Green
    { number: 4, value: "#FFFF99" }, // Light Yellow
    { number: 5, value: "#D699D6" }, // Light Purple
  ];

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

  const mapRef = useRef(null);
  const flowRef = useRef(null); // Ref to track ReactFlow container

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [drawingSource, setDrawingSource] = useState(null); // Track source node ID

  // Ensure ReactFlow container is available after mount
  // useEffect(() => {
  //   if (mapState.showTerminationModal && flowRef.current) {
  //     // console.log("ReactFlow container ref:", flowRef.current);
  //     const flowEl = flowRef.current.querySelector(".reactflow");
  //     // console.log("Found .reactflow:", flowEl);
  //   }
  // }, [mapState.showTerminationModal]);

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

    if (icon.type === "Splitter") {
      if (!icon.ratioSetTimestamp) return 0;
      return mapState.fiberLines.filter(
        (line) =>
          line.createdAt > icon.ratioSetTimestamp &&
          ((line.from.lat === icon.lat && line.from.lng === icon.lng) ||
            (line.to.lat === icon.lat && line.to.lng === icon.lng) ||
            (line.waypoints &&
              line.waypoints.some(
                (wp) => wp.lat === icon.lat && wp.lng === icon.lng
              )))
      ).length;
    }
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

  const handleSelection = (type) => {
    const { selectedPoint, nextNumber } = mapState;
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
          splitterRatio: type === "Splitter" ? "" : null,
          name: type === "Splitter" ? "" : null,
          nextLineNumber: type === "Splitter" ? 1 : null,
        },
      ],
      nextNumber: nextNumber + 1,
      rightClickMarker: null,
    }));
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
      // Deep clone the target arrays
      const updatedFiberLines = prevState.fiberLines.map((l) => ({
        ...l,
        waypoints: l.waypoints ? [...l.waypoints] : [],
      }));
      const updatedSavedPolylines = prevState.savedPolylines.map((l) => ({
        ...l,
        waypoints: l.waypoints ? [...l.waypoints] : [],
      }));

      // Calculate the new waypoint position
      const lastPoint =
        line.waypoints && line.waypoints.length > 0
          ? line.waypoints[line.waypoints.length - 1]
          : line.to;

      const midpoint = {
        lat: (line.from.lat + lastPoint.lat) / 2,
        lng: (line.from.lng + lastPoint.lng) / 2,
      };

      // Update the target line with the new waypoint
      const updatedLine = {
        ...line,
        waypoints: line.waypoints ? [...line.waypoints, midpoint] : [midpoint],
      };

      if (isSavedLine) {
        updatedSavedPolylines[index] = updatedLine;
        localStorage.setItem(
          "savedPolylines",
          JSON.stringify(updatedSavedPolylines)
        );
        // If showing saved routes, sync fiberLines
        if (prevState.showSavedRoutes) {
          updatedFiberLines[index] = updatedLine;
        }
      } else {
        updatedFiberLines[index] = updatedLine;
      }

      return {
        ...prevState,
        fiberLines: updatedFiberLines,
        savedPolylines: isSavedLine
          ? updatedSavedPolylines
          : prevState.savedPolylines,
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
          // console.log("Line start connected to splitter:", {
          //   lineId: line.id,
          //   splitterId: nearestIcon.id,
          //   ratio: nearestIcon.splitterRatio,
          // });
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
          // console.log("Line end connected to splitter:", {
          //   lineId: line.id,
          //   splitterId: nearestIcon.id,
          //   ratio: nearestIcon.splitterRatio,
          // });
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
          // console.log("Waypoint connected to splitter:", {
          //   lineId: line.id,
          //   waypointIndex,
          //   splitterId: nearestIcon.id,
          //   ratio: nearestIcon.splitterRatio,
          // });
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
      fiberLines: !prevState.showSavedRoutes
        ? prevState.savedPolylines.map((line) => ({
            ...line,
            from: { ...line.from },
            to: { ...line.to },
            waypoints: line.waypoints ? [...line.waypoints] : [],
          }))
        : [],
      imageIcons: !prevState.showSavedRoutes ? prevState.savedIcons : [],
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
    }));
  };

  const initializeNodesAndEdges = useCallback(
    (selectedTermination) => {
      // Calculate sensible positions
      const leftX = 50; // Left nodes x position
      const rightX = 450; // Right nodes x position
      const verticalSpacing = 50; // Space between nodes vertically
      const startY = 40; // Starting Y position

      const leftNodes = terminationColors.map((color, index) => ({
        id: `left-${color.number}`,
        type: "custom",
        position: { x: leftX, y: startY + index * verticalSpacing },
        data: { label: `${color.number}`, color: color.value, side: "left" },
      }));

      const rightNodes = terminationColors.map((color, index) => ({
        id: `right-${color.number}`,
        type: "custom",
        position: { x: rightX, y: startY + index * verticalSpacing },
        data: { label: `${color.number}`, color: color.value, side: "right" },
      }));

      const initialNodes = [...leftNodes, ...rightNodes];
      setNodes(initialNodes);

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
    },
    [mapState.terminationConnections, setNodes, setEdges]
  );

  const handleNodeClick = useCallback(
    (event, node) => {
      if (
        node.data.side === "left" &&
        !drawingSource &&
        !mapState.tempConnection
      ) {
        setDrawingSource(node.id);
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
          return updatedNodes;
        });
      }
    },
    [drawingSource, mapState.tempConnection, setEdges, setNodes]
  );

  const handleTerminationMouseMove = useCallback(
    (e) => {
      if (!drawingSource) return;

      // const rect = flowEl.getBoundingClientRect();

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

        return updatedEdges;
      });
    },
    [drawingSource, setNodes, setEdges]
  );

  const saveTerminationConnection = useCallback(() => {
    if (!mapState.tempConnection) {
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
      // Deep clone savedPolylines and fiberLines
      const updatedSavedPolylines = prevState.savedPolylines.map(
        (polyline) => ({
          ...polyline,
          from: { ...polyline.from },
          to: { ...polyline.to },
          waypoints: polyline.waypoints ? [...polyline.waypoints] : [],
        })
      );
      const updatedFiberLines = prevState.fiberLines.map((polyline) => ({
        ...polyline,
        from: { ...polyline.from },
        to: { ...polyline.to },
        waypoints: polyline.waypoints ? [...polyline.waypoints] : [],
      }));

      let polylineUpdated = false;
      let newLineName = null;

      // Update the specific polyline
      const newSavedPolylines = updatedSavedPolylines.map((polyline, index) => {
        if (polyline.id === polylineId && polyline.waypoints) {
          polylineUpdated = true;

          // Check if snapping to a splitter
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
              // console.log("Saved waypoint connected to splitter:", {
              //   polylineId,
              //   waypointIndex,
              //   splitterId: nearestIcon.id,
              //   ratio: nearestIcon.splitterRatio,
              // });
              const splitter = prevState.imageIcons.find(
                (icon) => icon.id === nearestIcon.id
              );
              const lineNumber = splitter.nextLineNumber || 1;
              newLineName = `Line ${lineNumber}`;

              // Update fiberLines if showing saved routes
              if (prevState.showSavedRoutes) {
                updatedFiberLines[index] = {
                  ...updatedFiberLines[index],
                  waypoints: updatedFiberLines[index].waypoints.map((wp, idx) =>
                    idx === waypointIndex
                      ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
                      : wp
                  ),
                  name: newLineName,
                  createdAt: polyline.createdAt || Date.now(),
                };
              }

              return {
                ...polyline,
                waypoints: polyline.waypoints.map((wp, idx) =>
                  idx === waypointIndex
                    ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
                    : wp
                ),
                name: newLineName,
                createdAt: polyline.createdAt || Date.now(),
              };
            }
          }

          // Update waypoint position
          if (prevState.showSavedRoutes) {
            updatedFiberLines[index] = {
              ...updatedFiberLines[index],
              waypoints: updatedFiberLines[index].waypoints.map((wp, idx) =>
                idx === waypointIndex ? { lat: newLat, lng: newLng } : wp
              ),
              createdAt: polyline.createdAt || Date.now(),
            };
          }

          return {
            ...polyline,
            waypoints: polyline.waypoints.map((wp, idx) =>
              idx === waypointIndex ? { lat: newLat, lng: newLng } : wp
            ),
            createdAt: polyline.createdAt || Date.now(),
          };
        }
        return polyline;
      });

      if (!polylineUpdated) return prevState;

      // Update imageIcons and savedIcons if connected to a splitter
      const updatedImageIcons =
        nearestIcon && nearestIcon.type === "Splitter"
          ? prevState.imageIcons.map((icon) =>
              icon.id === nearestIcon.id
                ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
                : icon
            )
          : prevState.imageIcons;

      const updatedSavedIcons = prevState.savedIcons.map((icon) =>
        icon.id === nearestIcon?.id
          ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
          : icon
      );

      // Update any splitters linked to this waypoint
      const polylineIndex = prevState.savedPolylines.findIndex(
        (p) => p.id === polylineId
      );
      const updatedImageIconsWithSplitters = updatedImageIcons.map((icon) =>
        icon.type === "Splitter" &&
        icon.linkedLineIndex !== undefined &&
        icon.linkedWaypointIndex !== undefined &&
        icon.isSavedLine &&
        icon.linkedLineIndex === polylineIndex &&
        icon.linkedWaypointIndex === waypointIndex
          ? {
              ...icon,
              lat: nearestIcon ? nearestIcon.lat : newLat,
              lng: nearestIcon ? nearestIcon.lng : newLng,
            }
          : icon
      );

      const updatedSavedIconsWithSplitters = updatedSavedIcons.map((icon) =>
        icon.type === "Splitter" &&
        icon.linkedLineIndex !== undefined &&
        icon.linkedWaypointIndex !== undefined &&
        icon.isSavedLine &&
        icon.linkedLineIndex === polylineIndex &&
        icon.linkedWaypointIndex === waypointIndex
          ? {
              ...icon,
              lat: nearestIcon ? nearestIcon.lat : newLat,
              lng: nearestIcon ? nearestIcon.lng : newLng,
            }
          : icon
      );

      // Persist to localStorage
      localStorage.setItem("savedPolylines", JSON.stringify(newSavedPolylines));
      localStorage.setItem(
        "savedIcons",
        JSON.stringify(updatedSavedIconsWithSplitters)
      );

      return {
        ...prevState,
        savedPolylines: newSavedPolylines,
        fiberLines: prevState.showSavedRoutes
          ? updatedFiberLines
          : prevState.fiberLines,
        imageIcons: updatedImageIconsWithSplitters,
        savedIcons: updatedSavedIconsWithSplitters,
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
  // const onMapLoad = useCallback((map) => {
  //   mapRef.current = map;
  // }, []);

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
      // {
      //   imgSrc: "/img/Reset.jpg", // Ensure this file exists in your public/img folder
      //   tooltip: "Reset Map",
      //   onClick: resetMap,
      // },
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
    // resetMap,
    saveRoute,
    togglePreviousRoutes,
    toggleSavedRoutesEditability,
  ]);

  useEffect(() => {
    localStorage.setItem("polygons", JSON.stringify(mapState.polygons));
  }, [mapState.polygons]);

  const updateIntermediatePoints = useCallback(() => {
    if (mapState.points.length > 1) {
      const newIntermediatePoints = [];
      for (let i = 0; i < mapState.points.length - 1; i++) {
        newIntermediatePoints.push({
          position: calculateMidpoint(
            mapState.points[i],
            mapState.points[i + 1]
          ),
          segmentStart: i,
          segmentEnd: i + 1,
        });
      }
      if (mapState.isPolygonClosed && mapState.points.length > 2) {
        newIntermediatePoints.push({
          position: calculateMidpoint(
            mapState.points[mapState.points.length - 1],
            mapState.points[0]
          ),
          segmentStart: mapState.points.length - 1,
          segmentEnd: 0,
        });
      }
      setMapState((prev) => ({
        ...prev,
        intermediatePoints: newIntermediatePoints,
      }));
    } else {
      setMapState((prev) => ({ ...prev, intermediatePoints: [] }));
    }
  }, [mapState.points, mapState.isPolygonClosed]);

  useEffect(() => {
    updateIntermediatePoints();
  }, [mapState.points, mapState.isPolygonClosed, updateIntermediatePoints]);

  // const mapOptions = {
  //   zoom: 13,
  //   clickableIcons: false,
  // };

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
      setMapState((prev) => ({ ...prev, isPolygonClosed: true }));
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
        setMapState((prev) => ({ ...prev, isPolygonClosed: true }));
        return;
      }

      setMapState((prev) => ({
        ...prev,
        points: [...prev.points, newPoint],
        isPolygonClosed: false,
      }));
    },
    [mapState.drawing, mapState.isDragging, mapState.points]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (
        mapState.drawing &&
        !mapState.isDragging &&
        !mapState.isPolygonClosed
      ) {
        setMapState((prev) => ({
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
    setMapState((prev) => ({ ...prev, isMapLoaded: true }));
  }, []);

  const handleMapDrag = useCallback(() => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      setMapState((prev) => ({
        ...prev,
        mapCenter: {
          lat: center.lat(),
          lng: center.lng(),
        },
      }));
    }
  }, []);

  const handlePolygonIconClick = () => {
    setMapState((prev) => ({
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
    if (
      mapState.points.length > 2 &&
      mapState.isPolygonClosed &&
      mapState.polygonName
    ) {
      const newPolygon = {
        name: mapState.polygonName,
        coordinates: [...mapState.points],
        locked: false,
      };
      setMapState((prev) => {
        const updatedPolygons =
          prev.editingIndex !== null
            ? prev.polygons.map((poly, i) =>
                i === prev.editingIndex ? newPolygon : poly
              )
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
    setMapState((prev) => ({
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
    setMapState((prev) => ({
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

    setMapState((prev) => {
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
    setMapState((prev) => {
      const newPreviewIndex = prev.previewIndex === index ? null : index;
      const centroid =
        prev.previewIndex !== index
          ? calculateCentroid(prev.polygons[index].coordinates)
          : prev.mapCenter;
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
      return [
        mapState.points[mapState.points.length - 1],
        mapState.currentMousePosition,
      ];
    }
    return [];
  };

  const handleMarkerDrag = useCallback((index, event) => {
    const newPoint = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };
    setMapState((prev) => {
      const newPoints = [...prev.points];
      newPoints[index] = newPoint;
      return { ...prev, points: newPoints };
    });
  }, []);

  const handleIntermediateDragEnd = useCallback(
    (index) => {
      setMapState((prev) => {
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
    setMapState((prev) => {
      const newIntermediatePoints = [...prev.intermediatePoints];
      newIntermediatePoints[index] = {
        ...newIntermediatePoints[index],
        position: newPosition,
      };
      return { ...prev, intermediatePoints: newIntermediatePoints };
    });
  }, []);

  const handlePointDragStart = useCallback(() => {
    setMapState((prev) => ({
      ...prev,
      isDragging: true,
      currentMousePosition: null,
    }));
  }, []);

  const handlePointDragEnd = useCallback(() => {
    setMapState((prev) => ({
      ...prev,
      isDragging: false,
      isPolygonClosed:
        prev.points.length >= 3 && prev.editingIndex === null
          ? true
          : prev.isPolygonClosed,
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
          center={center}
          zoom={7}
          onClick={handleMapClick}
          onRightClick={handleMapRightClick}
          onMouseMove={handleMouseMove}
          onLoad={handleMapLoad}
          onDragEnd={handleMapDrag}
          options={{ styles: mapStyles, disableDefaultUI: false }}
        >
          {/* Polyline Start */}
          {mapState.imageIcons.map((icon) => (
            <MarkerF
              key={icon.id}
              position={{ lat: icon.lat, lng: icon.lng }}
              draggable={
                mapState.isSavedRoutesEditable || !mapState.showSavedRoutes
              }
              icon={{
                url: icon.imageUrl || iconImages[icon.type],
                scaledSize: new google.maps.Size(30, 30),
                anchor: new google.maps.Point(15, 15),
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
                        top: `${mapState.exactClickPosition.y - 80}px`,
                        left: `${mapState.exactClickPosition.x - 207}px`,
                        transform: "translateX(-50%)",
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

                  {(polyline.waypoints || []).map((waypoint, waypointIndex) => {
                    const isOverlaid = isWaypointOverlaidBySplitter(waypoint);
                    // console.log(
                    //   `Rendering waypoint ${waypointIndex} for polyline ${polyline.id}:`,
                    //   {
                    //     position: waypoint,
                    //     isOverlaid,
                    //   }
                    // );
                    return !isOverlaid ? (
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
                    ) : null;
                  })}
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
                top: `${mapState.waypointActionPosition.y - 80}px`,
                left: `${mapState.waypointActionPosition.x - 274}px`,
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
                <div
                  className="line-action-item"
                  onClick={addSplitterAtWaypoint}
                >
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
                top: `${mapState.waypointActionPosition.y - 260}px`,
                left: `${mapState.waypointActionPosition.x - 450}px`,
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
                  <button
                    onClick={closeSplitterModal}
                    className="btn btn-close"
                  >
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
                bottom: "0px", // Anchor to bottom
                left: "0px", // Align to left
                width: "100%", // Full map width
                height: "350px", // Increased height
              }}
            >
              <div
                className="termination-modal-content"
                style={{ height: "100%" }}
              >
                <div
                  className="flow-container"
                  style={{ width: "100%", height: "80%", position: "relative" }} // 80% of 350px = 280px
                >
                  {/* Title positioned as an overlay on the left side */}
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      left: "10px",
                      zIndex: 10,
                      background: "rgba(255, 255, 255, 0.7)", // Semi-transparent background
                      padding: "5px 8px",
                      borderRadius: "4px",
                      fontWeight: "bold",
                      fontSize: "14px",
                    }}
                  >
                    Termination Box
                  </div>

                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={handleNodeClick}
                    onPaneMouseMove={handleTerminationMouseMove}
                    nodeTypes={nodeTypes}
                    fitView
                    nodesDraggable={false}
                    nodesConnectable={false}
                    zoomOnScroll={false}
                    panOnScroll={false}
                    panOnDrag={false}
                    preventScrolling={false}
                    style={{ width: "100%", height: "100%" }}
                    proOptions={{ hideAttribution: true }}
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
            </div>
          )}

          {/* Polygon Start */}
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
                onDragStart={() =>
                  setMapState((prev) => ({ ...prev, isDragging: true }))
                }
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

      {mapState.showModal && mapState.selectedPoint && (
        <div
          className="modal"
          style={{
            top: `${mapState.selectedPoint.y - 110}px`,
            left: `${mapState.selectedPoint.x - 218}px`,
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
            {Object.keys(iconImages).map((type) => (
              <button
                key={type}
                onClick={() => handleSelection(type)}
                className="modal-button"
              >
                {type}
              </button>
            ))}
            <button className="modal-button" onClick={addFiberLine}>
              Add Fiber
            </button>
          </div>
          <div className="modal-spike"></div>
        </div>
      )}

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
              className={`status-text ${
                mapState.isPolygonClosed ? "closed" : "active"
              }`}
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
                onChange={(e) =>
                  setMapState((prev) => ({
                    ...prev,
                    polygonName: e.target.value,
                  }))
                }
                placeholder="Enter polygon name"
              />
            </div>

            <div className="button-group">
              <button
                onClick={handleSavePolygon}
                disabled={
                  !(
                    mapState.points.length > 2 &&
                    mapState.isPolygonClosed &&
                    mapState.polygonName
                  )
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

export default Polygon7;
