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

const MyMapV19 = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const iconImages = {
    BTS: "/img/BTS.png",
    Termination: "/img/Termination.png",
    Splitter: "/img/Splitter.png",
    ONU: "/img/ONU.png",
  };

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
    hasEditedCables: false, // Track if savedPolylines were edited
    updatedDevices: [], // New property to track devices with updated coordinates

    // New state for port form
    showDeviceForm: false,
    deviceFormData: null,
    deviceForm: {
      deviceName: "",
      description: "",
      deviceModelId: "",
      ports: [
        { name: "", position: 1 },
        { name: "", position: 2 },
      ],
      name: "",
      hostname: "",
      community: "",
    },

    // New state for port selection
    showPortDropdown: false,
    portDropdownPosition: null,
    portDropdownDevice: null,
    portDropdownPorts: [],
    selectedPortId: null,
    portDropdownEnd: null, // 'start' or 'end'
    tempCable: null,
    startPortId: null,
    endPortId: null,
    allPorts: [], // Initialize as empty array

    showFiberForm: false, // New state for fiber form modal
    fiberFormData: {
      name: "",
      type: "Fiber", // Default type or allow selection
    },
    cableSaveAttempted: false, // New flag to prevent duplicate saves

    showDeviceModal: false, // Controls device modal visibility
    selectedDevice: null, // Stores the clicked device (icon)
    deviceModalPosition: null, // Stores modal position { x, y }
  });

  // New state for device types fetched from backend
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [allPorts, setAllPorts] = useState([]); // Initialize as empty array

  // // Fetch device types on component mount
  useEffect(() => {
    const fetchDeviceTypes = async () => {
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/api/v1/device-types"
        );
        if (!response.ok) {
          throw new Error("Failed to fetch device types");
        }
        const data = await response.json();
        setDeviceTypes(data);
      } catch (error) {
        console.error("Error fetching device types:", error);
        alert("Failed to load device types from the server.");
      }
    };

    fetchDeviceTypes();
  }, []);

  // Fetch Devices (Reusable Function)
  const fetchDevices = async () => {
    try {
      console.log("Fetching devices from http://127.0.0.1:8000/api/v1/devices");
      const response = await fetch("http://127.0.0.1:8000/api/v1/devices");
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      const devices = await response.json();
      console.log("API Response - Devices:", devices);

      const allPorts = devices.flatMap((device) =>
        device.port_device.map((port) => ({
          id: port.id,
          name: port.name,
          position: port.position,
          device_id: device.id,
        }))
      );
      console.log("Extracted allPorts:", allPorts);

      const fetchedIcons = devices
        .filter((device) => {
          const hasValidCoords =
            device.latitude != null &&
            device.longitude != null &&
            !isNaN(device.latitude) &&
            !isNaN(device.longitude);
          if (!hasValidCoords) {
            console.warn(
              `Skipping device ${device.name} with invalid coordinates: lat=${device.latitude}, lng=${device.longitude}`
            );
          }
          return hasValidCoords;
        })
        .map((device) => ({
          lat: device.latitude,
          lng: device.longitude,
          type: device.device_type.name,
          id: `icon-api-${device.id}`,
          imageUrl: device.device_type.icon
            ? `http://127.0.0.1:8000${device.device_type.icon}`
            : "/img/default-icon.png",
          splitterRatio: device.device_type.name === "Splitter" ? "" : null,
          name: device.device_type.name === "Splitter" ? "" : null,
          nextLineNumber: device.device_type.name === "Splitter" ? 1 : null,
          deviceId: device.id,
          portIds: device.port_device.map((port) => port.id),
        }));

      console.log("Fetched Icons for imageIcons:", fetchedIcons);

      setMapState((prevState) => {
        console.log("Updating imageIcons and allPorts state with:", {
          fetchedIcons,
          allPorts,
        });
        return {
          ...prevState,
          imageIcons: fetchedIcons,
          allPorts,
          nextNumber: fetchedIcons.length + 1,
        };
      });

      setAllPorts(allPorts); // Update allPorts state
    } catch (error) {
      console.error("Error fetching devices:", error.message);
      alert("Failed to load devices from the server: " + error.message);
    }
  };

  // Fetch Devices on Mount
  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchCables = async () => {
    try {
      console.log(
        "Fetching cables from http://127.0.0.1:8000/api/v1/interface"
      );
      const response = await fetch("http://127.0.0.1:8000/api/v1/interface", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const cables = await response.json();
      console.log("API Response - Cables:", cables);

      // Map cables to savedPolylines format
      const fetchedPolylines = cables
        .filter((cableInterface) => {
          const hasValidCoords =
            cableInterface.cable &&
            cableInterface.cable.path &&
            cableInterface.cable.path.coords &&
            Array.isArray(cableInterface.cable.path.coords) &&
            cableInterface.cable.path.coords.length >= 2 &&
            cableInterface.cable.path.coords.every(
              (coord) =>
                Array.isArray(coord) &&
                coord.length === 2 &&
                !isNaN(parseFloat(coord[0])) &&
                !isNaN(parseFloat(coord[1]))
            );
          if (!hasValidCoords) {
            console.warn(
              `Skipping cable ${
                cableInterface.cable?.name || cableInterface.id
              } with invalid coordinates`
            );
          }
          return hasValidCoords;
        })
        .map((cableInterface) => {
          const coords = cableInterface.cable.path.coords;
          const from = {
            lat: parseFloat(coords[0][0]),
            lng: parseFloat(coords[0][1]),
          };
          const to = {
            lat: parseFloat(coords[coords.length - 1][0]),
            lng: parseFloat(coords[coords.length - 1][1]),
          };
          const waypoints = coords.slice(1, -1).map((coord) => ({
            lat: parseFloat(coord[0]),
            lng: parseFloat(coord[1]),
          }));

          return {
            id: `cable-${cableInterface.id}`,
            name: cableInterface.cable.name || `Cable-${cableInterface.id}`,
            from,
            to,
            waypoints,
            createdAt: Date.now(), // API doesn't provide created_at
            startDeviceId: cableInterface.start.device.id || null,
            endDeviceId: cableInterface.end.device.id || null,
            startPortId: cableInterface.start.id || null,
            endPortId: cableInterface.end.id || null,
            startPortName: cableInterface.start.name || null,
            endPortName: cableInterface.end.name || null,
          };
        });

      console.log("Fetched Polylines for savedPolylines:", fetchedPolylines);

      setMapState((prevState) => ({
        ...prevState,
        savedPolylines: fetchedPolylines,
        showSavedRoutes: true, // Show saved routes by default
      }));
    } catch (error) {
      console.error("Error fetching cables:", error.message);
      alert("Failed to load cables from the server: " + error.message);
    }
  };

  // Fetch cables on component mount
  useEffect(() => {
    fetchCables();
  }, []); // Empty dependency array to run once on mount

  const saveCableToInterface = async (cable) => {
    try {
      const payload = {
        start: {
          device_id: cable.startDeviceId,
          port_id: cable.startPortId,
        },
        end: {
          device_id: cable.endDeviceId,
          port_id: cable.endPortId,
        },
        cable: {
          name: cable.name || `Cable-${Date.now()}`,
          type: cable.type.toLowerCase(),
          path: {
            coords: [
              [cable.from.lat, cable.from.lng],
              ...(cable.waypoints || []).map((wp) => [wp.lat, wp.lng]),
              [cable.to.lat, cable.to.lng],
            ],
          },
        },
      };

      console.log(
        "Sending POST to /api/v1/interface with payload:",
        JSON.stringify(payload, null, 2)
      );

      const response = await fetch("http://127.0.0.1:8000/api/v1/interface", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log("Raw response:", responseText);

      if (!response.ok) {
        throw new Error(
          `Failed to save cable: ${response.status} ${response.statusText} - ${responseText}`
        );
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (error) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      console.log("Cable saved successfully:", responseData);

      // Ensure the backend returns an 'id' field
      if (!responseData.id) {
        throw new Error("Backend response missing 'id' field");
      }

      // Create the new cable object with the backend-provided interface ID
      const newCable = {
        id: `cable-${responseData.id}`, // Use the actual interface ID (e.g., cable-18)
        name:
          responseData.cable?.name || cable.name || `Cable-${responseData.id}`,
        from: {
          lat:
            parseFloat(responseData.cable?.path?.coords[0][0]) ||
            cable.from.lat,
          lng:
            parseFloat(responseData.cable?.path?.coords[0][1]) ||
            cable.from.lng,
        },
        to: {
          lat:
            parseFloat(
              responseData.cable?.path?.coords[
                responseData.cable?.path?.coords.length - 1
              ][0]
            ) || cable.to.lat,
          lng:
            parseFloat(
              responseData.cable?.path?.coords[
                responseData.cable?.path?.coords.length - 1
              ][1]
            ) || cable.to.lng,
        },
        waypoints:
          responseData.cable?.path?.coords?.slice(1, -1).map((coord) => ({
            lat: parseFloat(coord[0]),
            lng: parseFloat(coord[1]),
          })) ||
          cable.waypoints ||
          [],
        createdAt: Date.now(),
        startDeviceId: responseData.start?.device?.id || cable.startDeviceId,
        endDeviceId: responseData.end?.device?.id || cable.endDeviceId,
        startPortId: responseData.start?.id || cable.startPortId,
        endPortId: responseData.end?.id || cable.endPortId,
        startPortName: responseData.start?.name || cable.startPortName,
        endPortName: responseData.end?.name || cable.endPortName,
      };

      // Update savedPolylines with the new cable
      setMapState((prevState) => {
        // Remove the temporary cable from fiberLines
        const updatedFiberLines = prevState.fiberLines.filter(
          (l) => l.id !== cable.id
        );
        // Add the new cable to savedPolylines
        const updatedSavedPolylines = [...prevState.savedPolylines, newCable];

        // Update localStorage
        localStorage.setItem(
          "savedPolylines",
          JSON.stringify(updatedSavedPolylines)
        );

        console.log("Updated savedPolylines with new cable:", newCable);

        return {
          ...prevState,
          fiberLines: updatedFiberLines,
          savedPolylines: updatedSavedPolylines,
          cableSaveAttempted: true,
          selectedLineForActions: null,
          lineActionPosition: null,
          exactClickPosition: null,
          tempCable: null,
        };
      });

      return responseData;
    } catch (error) {
      console.error("Error saving cable to interface:", error);
      alert(`Failed to save cable: ${error.message}`);
      throw error;
    }
  };


  // const patchCableToInterface = async (cable) => {
  //   try {
  //     const interfaceId = cable.id.split("-")[1]; // Extract Interface ID (e.g., "18" from "cable-18")
  //     console.log("Attempting to patch cable with interfaceId:", interfaceId);
  //     const payload = {
  //       cable: {
  //         path: {
  //           coords: [
  //             [cable.from.lat, cable.from.lng],
  //             ...(cable.waypoints || []).map((wp) => [wp.lat, wp.lng]),
  //             [cable.to.lat, cable.to.lng],
  //           ],
  //         },
  //       },
  //     };
  //     console.log("PATCH payload:", JSON.stringify(payload, null, 2));
  //     const response = await fetch(
  //       `http://127.0.0.1:8000/api/v1/interface/${interfaceId}`,
  //       {
  //         method: "PATCH",
  //         headers: {
  //           "Content-Type": "application/json",
  //           Accept: "application/json",
  //         },
  //         body: JSON.stringify(payload),
  //       }
  //     );
  //     const responseText = await response.text();
  //     console.log("PATCH response:", responseText);
  //     if (!response.ok) {
  //       throw new Error(
  //         `Failed to update cable path: ${response.status} ${response.statusText} - ${responseText}`
  //       );
  //     }
  //     const responseData = JSON.parse(responseText);
  //     console.log("Cable path updated successfully:", responseData);
  //     return responseData;
  //   } catch (error) {
  //     console.error("Error updating cable path:", error);
  //     throw error;
  //   }
  // };

  const patchCableToInterface = async (cable) => {
  try {
    const interfaceId = cable.id.split("-")[1]; // Extract Interface ID (e.g., "18" from "cable-18")
    console.log("Attempting to patch cable with interfaceId:", interfaceId);
    const payload = {
      cable: {
        path: {
          coords: [
            [cable.from.lat, cable.from.lng],
            ...(cable.waypoints || []).map((wp) => [wp.lat, wp.lng]),
            [cable.to.lat, cable.to.lng],
          ],
        },
      },
    };
    console.log("PATCH payload:", JSON.stringify(payload, null, 2));
    const response = await fetch(
      `http://127.0.0.1:8000/api/v1/interface/${interfaceId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const responseText = await response.text();
    console.log("PATCH response:", responseText);
    if (!response.ok) {
      throw new Error(
        `Failed to update cable path: ${response.status} ${response.statusText} - ${responseText}`
      );
    }
    const responseData = JSON.parse(responseText);
    console.log("Cable path updated successfully:", responseData);

    // Save updated savedPolylines to localStorage after successful backend update
    setMapState((prevState) => {
      const updatedSavedPolylines = prevState.savedPolylines.map(
        (polyline, idx) =>
          idx === prevState.selectedLineForActions.index
            ? { ...polyline, hasEditedCables: false } // Clear edited flag
            : polyline
      );
      localStorage.setItem(
        "savedPolylines",
        JSON.stringify(updatedSavedPolylines)
      );
      return {
        ...prevState,
        savedPolylines: updatedSavedPolylines,
        hasEditedCables: false, // Clear global edited flag
      };
    });

    return responseData;
  } catch (error) {
    console.error("Error updating cable path:", error);
    throw error;
  }
};

  const removeSavedSelectedLine = async () => {
    if (
      !mapState.selectedLineForActions ||
      !isInteractionAllowed(mapState.selectedLineForActions.isSavedLine)
    ) {
      console.warn("No line selected or interaction not allowed");
      return;
    }

    const { index, isSavedLine } = mapState.selectedLineForActions;
    const line = isSavedLine
      ? mapState.savedPolylines[index]
      : mapState.fiberLines[index];

    try {
      // Handle deletion for saved lines (backend cables)
      if (isSavedLine && line.id && line.id.startsWith("cable-")) {
        const interfaceId = line.id.split("-")[1]; // Extract interface ID (e.g., "18" from "cable-18")
        console.log(`Sending DELETE request for interface ID: ${interfaceId}`);

        const response = await fetch(
          `http://127.0.0.1:8000/api/v1/interface/${interfaceId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(
            `Failed to delete cable: ${response.status} ${response.statusText} - ${errorData}`
          );
        }

        console.log(`Cable ${interfaceId} deleted successfully from backend`);
      }

      // Update frontend state
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
          updatedFiberLines = prevState.fiberLines.filter(
            (_, i) => i !== index
          );
        }

        // Sync savedIcons with imageIcons
        updatedSavedIcons = updatedImageIcons.map((icon) => ({
          ...(updatedSavedIcons.find((si) => si.id === icon.id) || {}),
          ...icon,
        }));

        if (isSavedLine) {
          localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
        }

        const newState = {
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

        console.log("Frontend state updated after line deletion:", {
          savedPolylines: newState.savedPolylines.length,
          fiberLines: newState.fiberLines.length,
        });

        return newState;
      });

      alert("Line deleted successfully!");
    } catch (error) {
      console.error("Error deleting line:", error.message);
      alert(`Failed to delete line: ${error.message}`);
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
    return !isSavedLine || isSavedLine;
  };

  const findNearestIcon = (lat, lng) => {
    const threshold = 0.0001; // Reduced threshold for precise snapping
    console.log("findNearestIcon called with:", { lat, lng });
    const nearest = mapState.imageIcons.find((icon) => {
      const latDiff = Math.abs(icon.lat - lat);
      const lngDiff = Math.abs(icon.lng - lng);
      console.log(
        `Checking icon ${icon.id} (${icon.type}): latDiff=${latDiff}, lngDiff=${lngDiff}`
      );
      return latDiff < threshold && lngDiff < threshold;
    });
    console.log("Nearest icon:", nearest);
    return nearest;
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

  const handleSelection = (type, icon) => {
    const { selectedPoint, nextNumber } = mapState;
    console.log(
      "handleSelection called with type:",
      type,
      "at point:",
      selectedPoint
    );

    if (!selectedPoint) {
      console.error("No selected point for device or fiber creation");
      alert("Error: No point selected for creation.");
      return;
    }

    // Fix imageUrl to use full backend URL or local fallback
    const validImageUrl =
      icon && typeof icon === "string"
        ? icon.startsWith("/media/")
          ? `http://127.0.0.1:8000${icon}`
          : icon
        : "/img/default-icon.png";
    console.log("Valid Image URL:", validImageUrl);

    const selectedDevice = deviceTypes.find((device) => device.name === type);

    if (type === "Add Fiber") {
      console.log("Adding fiber line at:", selectedPoint);
      // const newLine = {
      //   id: `fiber-${Date.now()}`,
      //   from: { lat: selectedPoint.lat, lng: selectedPoint.lng },
      //   to: {
      //     lat: selectedPoint.lat + 0.001,
      //     lng: selectedPoint.lng + 0.001,
      //   },
      //   waypoints: [],
      //   createdAt: Date.now(),
      //   startDeviceId: null,
      //   endDeviceId: null,
      //   startPortId: null,
      //   endPortId: null,
      //   startPortName: null,
      //   endPortName: null,
      // };
      setMapState((prevState) => ({
        ...prevState,
        // fiberLines: [...prevState.fiberLines, newLine],
        showModal: false,
        rightClickMarker: selectedPoint, // Preserve rightClickMarker
        // selectedPoint: null,
        showFiberForm: true,
        fiberFormData: {
          name: "",
          type: "Fiber",
        },
      }));
    } else if (selectedDevice) {
      if (type === "OLT" || type === "ONU" || type === "Splitter") {
        console.log(`Showing device form for ${type}`);
        setMapState((prevState) => ({
          ...prevState,
          showModal: false,
          rightClickMarker: null,
          showDeviceForm: true,
          deviceFormData: {
            device: selectedDevice,
            lat: selectedPoint.lat,
            lng: selectedPoint.lng,
            nextNumber,
            type,
            imageUrl: validImageUrl, // Use corrected URL
          },
          deviceForm: {
            deviceName: `${type}-${nextNumber}`,
            description: "",
            deviceModelId: "",
            ports: [
              { name: `Port 1-${type}-${nextNumber}`, position: 1 },
              { name: `Port 2-${type}-${nextNumber}`, position: 2 },
            ],
            name: `${selectedPoint.lat.toFixed(2)}-${type}`,
            hostname: type === "OLT" ? "192.168.1.1" : "",
            community: type === "OLT" ? "public" : "",
          },
        }));
      } else {
        console.log(`Creating device of type ${type}`);
      }
    } else {
      console.error(`Device type "${type}" not found in deviceTypes`);
      alert(`Error: Device type "${type}" not found.`);
      setMapState((prevState) => ({
        ...prevState,
        showModal: false,
        rightClickMarker: null,
        selectedPoint: null,
      }));
    }
  };

  const handleDeviceFormSubmit = async (e) => {
    e.preventDefault();
    const { deviceFormData, deviceForm, nextNumber } = mapState;
    if (!deviceFormData) {
      console.error("No deviceFormData available");
      alert("Error: Device form data is missing.");
      return;
    }

    // Validate form inputs
    if (!deviceForm.deviceName.trim()) {
      alert("Device name is required.");
      return;
    }
    if (!deviceForm.description.trim()) {
      alert("Description is required.");
      return;
    }
    if (!deviceForm.deviceModelId) {
      alert("Device model ID is required.");
      return;
    }
    if (deviceForm.ports.some((port) => !port.name.trim())) {
      alert("All port names are required.");
      return;
    }
    if (!deviceForm.name.trim()) {
      alert(`${deviceFormData.type} name is required.`);
      return;
    }
    if (deviceFormData.type === "OLT") {
      if (!deviceForm.hostname.trim()) {
        alert("Hostname is required for OLT.");
        return;
      }
      if (!deviceForm.community.trim()) {
        alert("Community is required for OLT.");
        return;
      }
    }

    try {
      const payload = {
        device: {
          name: deviceForm.deviceName,
          description: deviceForm.description,
          device_type_id: deviceFormData.device.id,
          device_model_id: parseInt(deviceForm.deviceModelId),
          latitude: deviceFormData.lat,
          longitude: deviceFormData.lng,
          ports: deviceForm.ports.map((port) => ({
            name: port.name,
            position: port.position,
          })),
        },
        name: deviceForm.name,
        ...(deviceFormData.type === "OLT" && {
          hostname: deviceForm.hostname,
          community: deviceForm.community,
        }),
      };

      const endpointMap = {
        OLT: "http://127.0.0.1:8000/api/v1/olt",
        ONU: "http://127.0.0.1:8000/api/v1/onu",
        Splitter: "http://127.0.0.1:8000/api/v1/splitter",
      };

      const endpoint = endpointMap[deviceFormData.type] || "";
      if (!endpoint) {
        throw new Error(`Invalid device type: ${deviceFormData.type}`);
      }

      console.log("Sending payload to", endpoint, ":", payload);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to create ${deviceFormData.type}: ${
            errorData.message || response.statusText
          }`
        );
      }

      const deviceData = await response.json();
      console.log("API response:", {
        deviceData,
        createdDeviceId: deviceData.device_id,
        createdPortIds: deviceData.ports
          ? deviceData.ports.map((port) => port.id)
          : [],
      });

      const createdDeviceId = deviceData.device_id;
      const createdPortIds = deviceData.ports
        ? deviceData.ports.map((port) => port.id)
        : [];

      // Fetch updated devices and ports immediately after creation
      await fetchDevices();

      // Update state to include the new device
      setMapState((prevState) => {
        if (
          isNaN(deviceFormData.lat) ||
          isNaN(deviceFormData.lng) ||
          deviceFormData.lat === null ||
          deviceFormData.lng === null
        ) {
          console.error("Invalid coordinates:", {
            lat: deviceFormData.lat,
            lng: deviceFormData.lng,
          });
          alert("Error: Invalid coordinates for device placement.");
          return prevState;
        }

        // Note: imageIcons and allPorts are already updated by fetchDevices
        const newState = {
          ...prevState,
          showDeviceForm: false,
          deviceFormData: null,
          deviceForm: {
            deviceName: "",
            description: "",
            deviceModelId: "",
            ports: [
              { name: "", position: 1 },
              { name: "", position: 2 },
            ],
            name: "",
            hostname: "",
            community: "",
          },
          rightClickMarker: null,
        };

        console.log("New state after device creation:", newState);
        return newState;
      });

      alert(`${deviceFormData.type} created successfully!`);
    } catch (error) {
      console.error(`Error creating ${deviceFormData.type}:`, error);
      alert(`Failed to create ${deviceFormData.type}: ${error.message}`);
    }
  };

  const handleDeviceFormInputChange = (field, value) => {
    setMapState((prevState) => ({
      ...prevState,
      deviceForm: {
        ...prevState.deviceForm,
        [field]: value,
      },
    }));
  };

  const handlePortChange = (index, field, value) => {
    setMapState((prevState) => {
      const updatedPorts = [...prevState.deviceForm.ports];
      updatedPorts[index] = {
        ...updatedPorts[index],
        [field]: field === "position" ? parseInt(value) : value,
      };
      return {
        ...prevState,
        deviceForm: {
          ...prevState.deviceForm,
          ports: updatedPorts,
        },
      };
    });
  };

  const addPort = () => {
    setMapState((prevState) => ({
      ...prevState,
      deviceForm: {
        ...prevState.deviceForm,
        ports: [
          ...prevState.deviceForm.ports,
          {
            name: "",
            position: prevState.deviceForm.ports.length + 1,
          },
        ],
      },
    }));
  };

  const removePort = (index) => {
    setMapState((prevState) => {
      const updatedPorts = prevState.deviceForm.ports
        .filter((_, i) => i !== index)
        .map((port, i) => ({
          ...port,
          position: i + 1,
        }));
      return {
        ...prevState,
        deviceForm: {
          ...prevState.deviceForm,
          ports: updatedPorts,
        },
      };
    });
  };

  useEffect(() => {
    console.log("Current imageIcons state:", mapState.imageIcons);
  }, [mapState.imageIcons]);

  const handlePortSelection = (e) => {
    e.preventDefault();
    const { selectedPortId, portDropdownEnd, tempCable } = mapState;
    if (!selectedPortId || !tempCable) {
      console.error("No port selected or tempCable missing", {
        selectedPortId,
        tempCable,
      });
      return;
    }

    setMapState((prevState) => {
      if (
        (portDropdownEnd === "start" && prevState.tempCable?.startPortId) ||
        (portDropdownEnd === "end" && prevState.tempCable?.endPortId)
      ) {
        console.warn(
          "Port already selected for this end, skipping duplicate processing"
        );
        return prevState;
      }

      const updatedLines = [...prevState.fiberLines];
      const lineIndex = updatedLines.findIndex(
        (line) => line.id === tempCable.id
      );
      if (lineIndex === -1) {
        console.error(
          "Fiber line not found:",
          tempCable.id,
          "fiberLines:",
          updatedLines
        );
        return prevState;
      }

      const selectedPort = prevState.allPorts.find(
        (port) => port.id === parseInt(selectedPortId)
      );
      updatedLines[lineIndex] = {
        ...updatedLines[lineIndex],
        [portDropdownEnd === "start" ? "startPortId" : "endPortId"]:
          selectedPortId,
        [portDropdownEnd === "start" ? "startPortName" : "endPortName"]:
          selectedPort ? selectedPort.name : `Port-${selectedPortId}`,
        [portDropdownEnd === "start" ? "startDeviceId" : "endDeviceId"]:
          prevState.portDropdownDevice
            ? prevState.portDropdownDevice.deviceId
            : null,
      };

      const updatedLine = updatedLines[lineIndex];
      console.log("Updated line after port selection:", {
        lineId: updatedLine.id,
        startPortId: updatedLine.startPortId,
        endPortId: updatedLine.endPortId,
        startDeviceId: updatedLine.startDeviceId,
        endDeviceId: updatedLine.endDeviceId,
      });

      return {
        ...prevState,
        fiberLines: updatedLines,
        showPortDropdown: false,
        portDropdownPosition: null,
        portDropdownDevice: null,
        portDropdownPorts: [],
        selectedPortId: null,
        portDropdownEnd: null,
        tempCable: { ...updatedLine }, // Ensure deep copy to avoid reference issues
      };
    });
  };

  const handlePortDropdownChange = (portId) => {
    setMapState((prevState) => ({
      ...prevState,
      selectedPortId: portId,
    }));
  };

  const closePortDropdown = () => {
    setMapState((prevState) => ({
      ...prevState,
      showPortDropdown: false,
      portDropdownPosition: null,
      portDropdownDevice: null,
      portDropdownPorts: [],
      selectedPortId: null,
      portDropdownEnd: null,
      tempCable: null,
      drawingSource: null,
      startPortId: null,
      endPortId: null,
    }));
  };

  const handleRightClickOnIcon = (icon, e) => {
    if (e && e.domEvent) {
      // Check for right-click (mouse button 2)
      if (e.domEvent.button !== 2) return; // Ignore non-right-clicks
      e.domEvent.preventDefault();
      e.domEvent.stopPropagation();
    }

    // Check if the icon is saved (from API or savedIcons)
    const isSavedIcon =
      icon.id.startsWith("icon-api-") ||
      mapState.savedIcons.some((savedIcon) => savedIcon.id === icon.id);
    if (isSavedIcon && !mapState.isSavedRoutesEditable) return;

    setMapState((prevState) => ({
      ...prevState,
      selectedPoint: { ...icon, x: e.domEvent.clientX, y: e.domEvent.clientY },
      rightClickMarker: icon,
      showModal: true,
      selectedWaypoint: icon,
      selectedWaypointInfo: { isIcon: true, iconId: icon.id },
      waypointActionPosition: { x: e.domEvent.clientX, y: e.domEvent.clientY },
    }));
  };

  // const handleLineClick = (line, index, isSavedLine = false, e) => {
  //   console.log("handleLineClick called:", {
  //     lineId: line.id,
  //     index,
  //     isSavedLine,
  //     event: e,
  //     from: line.from,
  //     to: line.to,
  //     snappedFrom: isSnappedToIcon(line.from.lat, line.from.lng),
  //     snappedTo: isSnappedToIcon(line.to.lat, line.to.lng),
  //   });

  //   if (e.domEvent) {
  //     e.domEvent.stopPropagation();
  //     e.domEvent.preventDefault();
  //   } else {
  //     console.warn("e.domEvent is undefined, event may be synthetic");
  //   }

  //   const clickedLatLng = e.latLng || {
  //     lat: line.from.lat,
  //     lng: line.from.lng,
  //   };
  //   if (!e.latLng) {
  //     console.warn(
  //       "e.latLng is undefined, using fallback position:",
  //       clickedLatLng
  //     );
  //   }
  //   const x = e.domEvent ? e.domEvent.clientX : window.innerWidth / 2;
  //   const y = e.domEvent ? e.domEvent.clientY : window.innerHeight / 2;

  //   console.log("Setting modal position:", {
  //     lat: clickedLatLng.lat(),
  //     lng: clickedLatLng.lng(),
  //     x,
  //     y,
  //   });

  //   setMapState((prevState) => {
  //     const newState = {
  //       ...prevState,
  //       selectedLineForActions: { line, index, isSavedLine },
  //       lineActionPosition: {
  //         lat: clickedLatLng.lat(),
  //         lng: clickedLatLng.lng(),
  //         x,
  //         y,
  //       },
  //       exactClickPosition: {
  //         lat: clickedLatLng.lat(),
  //         lng: clickedLatLng.lng(),
  //         x,
  //         y,
  //       },
  //       selectedWaypoint: null,
  //       waypointActionPosition: null,
  //       selectedWaypointInfo: null,
  //     };
  //     console.log("State updated for modal:", {
  //       selectedLineForActions: newState.selectedLineForActions,
  //       lineActionPosition: newState.lineActionPosition,
  //       exactClickPosition: newState.exactClickPosition,
  //     });
  //     return newState;
  //   });
  // };

  const handleLineClick = (line, index, isSavedLine = false, e) => {
    console.log("handleLineClick called:", {
      lineId: line.id,
      index,
      isSavedLine,
      event: e,
      from: line.from,
      to: line.to,
      snappedFrom: isSnappedToIcon(line.from.lat, line.from.lng),
      snappedTo: isSnappedToIcon(line.to.lat, line.to.lng),
    });

    if (e.domEvent) {
      e.domEvent.stopPropagation();
      e.domEvent.preventDefault();
    } else {
      console.warn("e.domEvent is undefined, event may be synthetic");
    }

    // Verify if the line is actually a saved polyline
    const verifiedIsSavedLine = mapState.savedPolylines.some(
      (polyline) => polyline.id === line.id
    );

    const clickedLatLng = e.latLng || {
      lat: line.from.lat,
      lng: line.from.lng,
    };
    const x = e.domEvent ? e.domEvent.clientX : window.innerWidth / 2;
    const y = e.domEvent ? e.domEvent.clientY : window.innerHeight / 2;

    console.log("Setting modal position:", {
      lat: clickedLatLng.lat(),
      lng: clickedLatLng.lng(),
      x,
      y,
      verifiedIsSavedLine,
    });

    setMapState((prevState) => {
      const newState = {
        ...prevState,
        selectedLineForActions: {
          line,
          index,
          isSavedLine: verifiedIsSavedLine,
        },
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
      };
      console.log("State updated for modal:", {
        selectedLineForActions: newState.selectedLineForActions,
        lineActionPosition: newState.lineActionPosition,
        exactClickPosition: newState.exactClickPosition,
      });
      return newState;
    });
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

  const removeSelectedWaypoint = async () => {
    if (
      !mapState.selectedWaypointInfo ||
      !isInteractionAllowed(mapState.selectedWaypointInfo.isSavedLine)
    )
      return;

    const { lineIndex, waypointIndex, isSavedLine } =
      mapState.selectedWaypointInfo;

    try {
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

        // If it's a saved line, update the cable in the backend
        if (isSavedLine) {
          const line = updatedLines[lineIndex];
          if (line.id && line.id.startsWith("cable-")) {
            const cableId = line.id.split("-")[1];
            const payload = {
              name: line.name || `Cable-${line.id}`,
              type: "Fiber",
              path: {
                from: { lat: line.from.lat, lng: line.from.lng },
                waypoints: line.waypoints
                  ? line.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }))
                  : [],
                to: { lat: line.to.lat, lng: line.to.lng },
              },
            };

            // Send PUT request to update the cable
            fetch(`http://127.0.0.1:8000/api/cables/${cableId}/`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            })
              .then((response) => {
                if (!response.ok) {
                  response.json().then((errorData) => {
                    console.error(
                      `Failed to update cable ${cableId}:`,
                      errorData.message || response.statusText
                    );
                    alert(`Failed to update cable: ${errorData.message}`);
                  });
                } else {
                  console.log(`Cable ${cableId} updated with new waypoints`);
                }
              })
              .catch((error) => {
                console.error("Error updating cable:", error);
                alert(`Failed to update cable: ${error.message}`);
              });
          }

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
    } catch (error) {
      console.error("Error removing waypoint:", error);
      alert(`Failed to remove waypoint: ${error.message}`);
    }
  };

  const handleIconClick = (icon, e) => {
    if (e && e.domEvent) {
      // Check for left-click (mouse button 0)
      if (e.domEvent.button !== 0) return; // Ignore non-left-clicks
      e.domEvent.preventDefault();
      e.domEvent.stopPropagation();
    }

    // Check if the icon is saved (from API or savedIcons)
    // const isSavedIcon =
    //   icon.id.startsWith("icon-api-") ||
    //   mapState.savedIcons.some((savedIcon) => savedIcon.id === icon.id);
    // if (isSavedIcon && !mapState.isSavedRoutesEditable) return;

    const x = e.domEvent.clientX;
    const y = e.domEvent.clientY;

    // Show generic device modal for all devices
    setMapState((prevState) => ({
      ...prevState,
      selectedLineForActions: null,
      lineActionPosition: null,
      exactClickPosition: null,
      showModal: false,
      showDeviceModal: true, // Show device modal
      selectedDevice: icon, // Set the clicked device
      deviceModalPosition: { x, y }, // Store modal position
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
    }));
  };

  const removeSelectedIcon = async () => {
    if (!mapState.selectedDevice) {
      console.error("No device selected for removal");
      alert("Error: No device selected for removal.");
      return;
    }

    const iconId = mapState.selectedDevice.id;
    const isApiDevice = iconId.startsWith("icon-api-");
    let deviceId;

    if (isApiDevice) {
      deviceId = iconId.split("-")[2]; // Extract deviceId (e.g., "1" from "icon-api-1")
    } else {
      deviceId = iconId; // For non-API devices, use the full ID
    }

    try {
      // Find the device in imageIcons
      const device = mapState.imageIcons.find((icon) => icon.id === iconId);
      if (!device) {
        throw new Error(`Device with ID ${iconId} not found in imageIcons`);
      }

      // Delete from backend if it's an API device
      if (isApiDevice) {
        const endpointMap = {
          OLT: `http://127.0.0.1:8000/api/v1/olt/${deviceId}`,
          ONU: `http://127.0.0.1:8000/api/v1/onu/${deviceId}`,
          Splitter: `http://127.0.0.1:8000/api/v1/splitter/${deviceId}`,
          Termination: `http://127.0.0.1:8000/api/v1/termination/${deviceId}`,
        };

        const endpoint = endpointMap[device.type];
        if (!endpoint) {
          throw new Error(`Invalid device type: ${device.type}`);
        }

        console.log(`Sending DELETE request to ${endpoint}`);
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(
            `Failed to delete device: ${response.status} ${response.statusText} - ${errorData}`
          );
        }

        console.log(`Device ${deviceId} deleted successfully from backend`);
      }

      // Update frontend state
      setMapState((prevState) => {
        const updatedImageIcons = prevState.imageIcons.filter(
          (icon) => icon.id !== iconId
        );
        const updatedSavedIcons = prevState.savedIcons.filter(
          (icon) => icon.id !== iconId
        );

        // Update localStorage if saved routes are shown
        if (prevState.showSavedRoutes) {
          localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
        }

        return {
          ...prevState,
          imageIcons: updatedImageIcons,
          savedIcons: updatedSavedIcons,
          showDeviceModal: false,
          selectedDevice: null,
          deviceModalPosition: null,
          updatedDevices: prevState.updatedDevices.filter(
            (device) => device.deviceId !== deviceId
          ),
        };
      });

      alert("Device removed successfully!");
    } catch (error) {
      console.error("Error removing device:", error.message);
      alert(`Failed to remove device: ${error.message}`);
    }
  };
  // Save device changes (e.g., updated coordinates)
  const saveDeviceChanges = async () => {
    if (!mapState.selectedDevice) return;

    const { selectedDevice } = mapState;

    try {
      // If the device is from the API, update it in the backend
      if (selectedDevice.id.startsWith("icon-api-")) {
        const deviceId = selectedDevice.id.split("-")[2];
        const payload = {
          latitude: selectedDevice.lat,
          longitude: selectedDevice.lng,
          // Add other fields if needed (e.g., name)
        };

        const endpointMap = {
          OLT: `http://127.0.0.1:8000/api/v1/olt/${deviceId}`,
          ONU: `http://127.0.0.1:8000/api/v1/onu/${deviceId}`,
          Splitter: `http://127.0.0.1:8000/api/v1/splitter/${deviceId}`,
          // Termination: `http://127.0.0.1:8000/api/v1/termination/${deviceId}`,
        };

        const endpoint = endpointMap[selectedDevice.type];
        if (!endpoint) {
          throw new Error(`Invalid device type: ${selectedDevice.type}`);
        }

        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(
            `Failed to update device: ${response.status} ${response.statusText} - ${errorData}`
          );
        }

        console.log(`Device ${deviceId} updated successfully`);
      }

      // Update local state
      setMapState((prevState) => {
        const updatedImageIcons = prevState.imageIcons.map((icon) =>
          icon.id === selectedDevice.id ? { ...icon } : icon
        );
        const updatedSavedIcons = prevState.savedIcons.map((icon) =>
          icon.id === selectedDevice.id ? { ...icon } : icon
        );

        if (prevState.showSavedRoutes) {
          localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
        }

        return {
          ...prevState,
          imageIcons: updatedImageIcons,
          savedIcons: updatedSavedIcons,
          showDeviceModal: false,
          selectedDevice: null,
          deviceModalPosition: null,
          updatedDevices: prevState.updatedDevices.filter(
            (device) => device.deviceId !== selectedDevice.id.split("-")[2]
          ),
        };
      });

      alert("Device saved successfully!");
    } catch (error) {
      console.error("Error saving device:", error.message);
      alert(`Failed to save device: ${error.message}`);
    }
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

  const removeSelectedLine = async () => {
    if (
      !mapState.selectedLineForActions ||
      !isInteractionAllowed(mapState.selectedLineForActions.isSavedLine)
    )
      return;

    const { index, isSavedLine } = mapState.selectedLineForActions;
    const line = isSavedLine
      ? mapState.savedPolylines[index]
      : mapState.fiberLines[index];

    try {
      // If the line is a saved cable, delete it from the backend
      if (isSavedLine && line.id && line.id.startsWith("cable-")) {
        const cableId = line.id.split("-")[1];
        await deleteCable(cableId);
      }

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
          updatedFiberLines = prevState.fiberLines.filter(
            (_, i) => i !== index
          );
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
    } catch (error) {
      // Error handled in deleteCable
    }
  };

  const handleMarkerDragEnd = (iconId, e) => {
    // if (mapState.showSavedRoutes && !mapState.isSavedRoutesEditable) return;

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
      let updatedDevices = [...prevState.updatedDevices];

      // If the icon is from the API, track it for update
      if (iconId.startsWith("icon-api-")) {
        const deviceId = iconId.split("-")[2];
        const existingUpdateIndex = updatedDevices.findIndex(
          (device) => device.deviceId === deviceId
        );
        if (existingUpdateIndex !== -1) {
          // Update existing entry
          updatedDevices[existingUpdateIndex] = {
            deviceId,
            lat: newLat,
            lng: newLng,
          };
        } else {
          // Add new entry
          updatedDevices.push({
            deviceId,
            lat: newLat,
            lng: newLng,
          });
        }
      }

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
        updatedDevices, // Store updated devices
      };
    });
  };

  const generateUniqueId = () => {
    return `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addFiberLine = () => {
    const { rightClickMarker, fiberFormData } = mapState;
    if (!rightClickMarker) {
      console.error("No rightClickMarker set for addFiberLine");
      alert("Error: No point selected for fiber creation.");
      return;
    }
    if (!fiberFormData.name.trim()) {
      alert("Fiber name cannot be empty.");
      return;
    }
    if (!fiberFormData.type.trim()) {
      alert("Fiber type cannot be empty.");
      return;
    }

    console.log(
      "addFiberLine called with rightClickMarker:",
      rightClickMarker,
      "and form data:",
      fiberFormData
    );

    const newFiberLine = {
      id: generateUniqueId(),
      from: { lat: rightClickMarker.lat, lng: rightClickMarker.lng },
      to: {
        lat: rightClickMarker.lat + 0.001,
        lng: rightClickMarker.lng + 0.001,
      },
      waypoints: [],
      createdAt: Date.now(),
      name: fiberFormData.name || `Fiber-${Date.now()}`,
      type: fiberFormData.type.trim(),
      startDeviceId: null,
      endDeviceId: null,
      startPortId: null,
      endPortId: null,
      startPortName: null,
      endPortName: null,
    };

    setMapState((prevState) => {
      console.log("Creating new fiber line:", newFiberLine);
      return {
        ...prevState,
        fiberLines: [...prevState.fiberLines, newFiberLine],
        showModal: false,
        showFiberForm: false,
        selectedPoint: null,
        rightClickMarker: null,
        fiberFormData: { name: "", type: "Fiber" },
        tempCable: newFiberLine, // Set tempCable to track the new fiber line
        showPortDropdown: false,
        portDropdownPosition: null,
        portDropdownDevice: null,
        portDropdownPorts: [],
        selectedPortId: null,
      };
    });
  };

  useEffect(() => {
    console.log("showPortDropdown state:", {
      showPortDropdown: mapState.showPortDropdown,
      portDropdownPosition: mapState.portDropdownPosition,
      portDropdownDevice: mapState.portDropdownDevice,
      portDropdownPorts: mapState.portDropdownPorts,
    });
  }, [mapState.showPortDropdown, mapState.portDropdownPosition]);

  const handleStartMarkerDragEnd = (index, e) => {
    console.log("handleStartMarkerDragEnd triggered for line index:", index);
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    console.log("Drag end coordinates:", { newLat, newLng });

    const nearestIcon = findNearestIcon(newLat, newLng);
    console.log("Nearest icon:", nearestIcon);

    setMapState((prevState) => {
      const updatedLines = [...prevState.fiberLines];
      const line = updatedLines[index];
      if (!line) {
        console.error("Line not found at index:", index);
        return prevState;
      }

      const newFrom = nearestIcon
        ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
        : { lat: newLat, lng: newLng };
      console.log("New from position:", newFrom);

      updatedLines[index] = {
        ...line,
        from: newFrom,
        createdAt: Date.now(),
        startDeviceId: nearestIcon ? nearestIcon.deviceId : null,
        startPortId: null,
        startPortName: null,
      };
      console.log("Updated line:", updatedLines[index]);

      // Clear tempCable to prevent shadow
      const newState = {
        ...prevState,
        fiberLines: updatedLines,
        tempCable: null, // Clear tempCable to avoid rendering stale line
        showPortDropdown: false,
        portDropdownPosition: null,
        portDropdownDevice: null,
        portDropdownPorts: [],
        selectedPortId: null,
      };

      // Show port dropdown if snapped to a device with ports
      if (nearestIcon && nearestIcon.portIds?.length > 0) {
        const devicePorts = prevState.allPorts.filter((port) =>
          nearestIcon.portIds.includes(port.id)
        );
        console.log("Filtered device ports:", devicePorts);

        if (devicePorts.length > 0) {
          const dropdownX = e.domEvent?.clientX || window.innerWidth / 2;
          const dropdownY = e.domEvent?.clientY || window.innerHeight / 2;
          console.log("Showing port dropdown at:", {
            x: dropdownX,
            y: dropdownY,
          });

          return {
            ...newState,
            showPortDropdown: true,
            portDropdownPosition: { x: dropdownX, y: dropdownY },
            portDropdownDevice: nearestIcon,
            portDropdownPorts: devicePorts,
            portDropdownEnd: "start",
            tempCable: updatedLines[index], // Set tempCable to the updated line
          };
        } else {
          console.warn(
            "No matching ports found for device portIds:",
            nearestIcon.portIds
          );
          alert("No ports available for this device.");
        }
      }

      return newState;
    });
  };

  const handleEndMarkerDragEnd = (index, e) => {
    console.log("handleEndMarkerDragEnd triggered for line index:", index);
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    console.log("Drag end coordinates:", { newLat, newLng });

    const nearestIcon = findNearestIcon(newLat, newLng);
    console.log("Nearest icon:", nearestIcon);

    setMapState((prevState) => {
      const updatedLines = [...prevState.fiberLines];
      const line = updatedLines[index];
      if (!line) {
        console.error("Line not found at index:", index);
        return prevState;
      }

      const newTo = nearestIcon
        ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
        : { lat: newLat, lng: newLng };
      console.log("New to position:", newTo);

      updatedLines[index] = {
        ...line,
        to: newTo,
        createdAt: Date.now(),
        endDeviceId: nearestIcon ? nearestIcon.deviceId : null,
        endPortId: null,
        endPortName: null,
      };
      console.log("Updated line:", updatedLines[index]);

      // Clear tempCable to prevent shadow
      const newState = {
        ...prevState,
        fiberLines: updatedLines,
        tempCable: null, // Clear tempCable to avoid rendering stale line
        showPortDropdown: false,
        portDropdownPosition: null,
        portDropdownDevice: null,
        portDropdownPorts: [],
        selectedPortId: null,
      };

      // Show port dropdown if snapped to a device with ports
      if (nearestIcon && nearestIcon.portIds?.length > 0) {
        const devicePorts = prevState.allPorts.filter((port) =>
          nearestIcon.portIds.includes(port.id)
        );
        console.log("Filtered device ports:", devicePorts);

        if (devicePorts.length > 0) {
          const dropdownX = e.domEvent?.clientX || window.innerWidth / 2;
          const dropdownY = e.domEvent?.clientY || window.innerHeight / 2;
          console.log("Showing port dropdown at:", {
            x: dropdownX,
            y: dropdownY,
          });

          return {
            ...newState,
            showPortDropdown: true,
            portDropdownPosition: { x: dropdownX, y: dropdownY },
            portDropdownDevice: nearestIcon,
            portDropdownPorts: devicePorts,
            portDropdownEnd: "end",
            tempCable: updatedLines[index], // Set tempCable to the updated line
          };
        } else {
          console.warn(
            "No matching ports found for device portIds:",
            nearestIcon.portIds
          );
          alert("No ports available for this device.");
        }
      }

      return newState;
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
            tempCable: null, // Clear tempCable to avoid shadow
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
      console.log(
        "Updated line with new waypoint:",
        updatedFiberLines[lineIndex]
      );

      return {
        ...prevState,
        fiberLines: updatedFiberLines,
        tempCable: null, // Clear tempCable to avoid shadow
      };
    });
  };

  const saveRoute = async () => {};

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

  // const resetMap = () => {
  //   setMapState({
  //     savedRoutes: mapState.savedRoutes,
  //     showSavedRoutes: false,
  //     nextNumber: 1,
  //     selectedType: null,
  //     showModal: false,
  //     selectedPoint: null,
  //     rightClickMarker: null,
  //     fiberLines: [],
  //     imageIcons: [],
  //     selectedWaypoint: null,
  //     waypointActionPosition: null,
  //     selectedWaypointInfo: null,
  //     showSplitterModal: false,
  //     selectedSplitter: null,
  //     splitterRatio: "",
  //     splitterInput: "",
  //     editingLineId: null,
  //     tempLineName: "",
  //   });
  // };

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

  const handleSavedPolylinePointDragEnd = (polylineId, pointType, e) => {
    // if (!mapState.isSavedRoutesEditable) return;

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
                [`${pointType}DeviceId`]: nearestIcon.deviceId,
                [`${pointType}PortId`]:
                  nearestIcon.portIds.length > 0
                    ? nearestIcon.portIds[0]
                    : null,
              };
            }
          }

          polylineUpdated = true;
          return {
            ...polyline,
            [pointType]: { lat: newLat, lng: newLng },
            createdAt: polyline.createdAt || Date.now(),
            [`${pointType}DeviceId`]: nearestIcon ? nearestIcon.deviceId : null,
            [`${pointType}PortId`]:
              nearestIcon && nearestIcon.portIds.length > 0
                ? nearestIcon.portIds[0]
                : null,
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

  // const handleSavedPolylineWaypointDragEnd = (polylineId, waypointIndex, e) => {
  //   const newLat = e.latLng.lat();
  //   const newLng = e.latLng.lng();
  //   const nearestIcon = findNearestIcon(newLat, newLng);

  //   setMapState((prevState) => {
  //     // Deep copy to ensure immutability
  //     const updatedSavedPolylines = prevState.savedPolylines.map(
  //       (polyline) => ({
  //         ...polyline,
  //         waypoints: polyline.waypoints ? [...polyline.waypoints] : [],
  //       })
  //     );

  //     let polylineUpdated = false;
  //     let updatedImageIcons = [...prevState.imageIcons];
  //     let updatedSavedIcons = [...prevState.savedIcons];

  //     const newSavedPolylines = updatedSavedPolylines.map((polyline) => {
  //       if (polyline.id !== polylineId || !polyline.waypoints) {
  //         return polyline;
  //       }

  //       // Check if waypoint already exists at the new position to prevent duplication
  //       const waypointExistsAtPosition = polyline.waypoints.some(
  //         (wp, idx) =>
  //           idx !== waypointIndex &&
  //           Math.abs(wp.lat - newLat) < 0.0001 &&
  //           Math.abs(wp.lng - newLng) < 0.0001
  //       );

  //       if (waypointExistsAtPosition) {
  //         console.warn(
  //           `Waypoint at index ${waypointIndex} already exists at position (${newLat}, ${newLng}). Skipping update to prevent duplication.`
  //         );
  //         return polyline;
  //       }

  //       // Handle splitter snapping
  //       if (
  //         nearestIcon &&
  //         nearestIcon.type === "Splitter" &&
  //         nearestIcon.splitterRatio
  //       ) {
  //         const splitNum = getRatioNumber(nearestIcon.splitterRatio);
  //         const connectedLines = getConnectedLinesCount(nearestIcon);

  //         // Check if the waypoint is already snapped to this splitter
  //         const isAlreadySnapped =
  //           polyline.waypoints[waypointIndex] &&
  //           Math.abs(polyline.waypoints[waypointIndex].lat - nearestIcon.lat) <
  //             0.0001 &&
  //           Math.abs(polyline.waypoints[waypointIndex].lng - nearestIcon.lng) <
  //             0.0001;

  //         if (connectedLines >= splitNum && !isAlreadySnapped) {
  //           alert(
  //             `Cannot connect more lines. Splitter ratio limit (${nearestIcon.splitterRatio} = ${splitNum}) reached.`
  //           );
  //           return polyline;
  //         }

  //         if (!isAlreadySnapped) {
  //           console.log("Saved waypoint connected to splitter:", {
  //             polylineId,
  //             waypointIndex,
  //             splitterId: nearestIcon.id,
  //             ratio: nearestIcon.splitterRatio,
  //           });
  //           const splitter = prevState.imageIcons.find(
  //             (icon) => icon.id === nearestIcon.id
  //           );
  //           const lineNumber = splitter.nextLineNumber || 1;
  //           const newLineName = `Line ${lineNumber}`;

  //           // Update imageIcons and savedIcons for splitter
  //           updatedImageIcons = updatedImageIcons.map((icon) =>
  //             icon.id === nearestIcon.id
  //               ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
  //               : icon
  //           );
  //           updatedSavedIcons = updatedSavedIcons.map((icon) =>
  //             icon.id === nearestIcon.id
  //               ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
  //               : icon
  //           );

  //           polylineUpdated = true;
  //           return {
  //             ...polyline,
  //             waypoints: polyline.waypoints.map((waypoint, index) =>
  //               index === waypointIndex
  //                 ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
  //                 : waypoint
  //             ),
  //             name: newLineName,
  //             createdAt: polyline.createdAt || Date.now(),
  //           };
  //         }
  //       }

  //       // Update waypoint position
  //       polylineUpdated = true;
  //       return {
  //         ...polyline,
  //         waypoints: polyline.waypoints.map((waypoint, index) =>
  //           index === waypointIndex ? { lat: newLat, lng: newLng } : waypoint
  //         ),
  //         createdAt: polyline.createdAt || Date.now(),
  //       };
  //     });

  //     if (!polylineUpdated) {
  //       return prevState;
  //     }

  //     // Update localStorage
  //     localStorage.setItem("savedPolylines", JSON.stringify(newSavedPolylines));

  //     return {
  //       ...prevState,
  //       savedPolylines: newSavedPolylines,
  //       fiberLines: prevState.showSavedRoutes
  //         ? newSavedPolylines
  //         : prevState.fiberLines,
  //       imageIcons: updatedImageIcons,
  //       savedIcons: updatedSavedIcons,
  //     };
  //   });
  // };


  const handleSavedPolylineWaypointDragEnd = (polylineId, waypointIndex, e) => {
  const newLat = e.latLng.lat();
  const newLng = e.latLng.lng();
  const nearestIcon = findNearestIcon(newLat, newLng);

  setMapState((prevState) => {
    // Deep copy to ensure immutability
    const updatedSavedPolylines = prevState.savedPolylines.map((polyline) => ({
      ...polyline,
      waypoints: polyline.waypoints ? [...polyline.waypoints] : [],
    }));

    let polylineUpdated = false;
    let updatedImageIcons = [...prevState.imageIcons];
    let updatedSavedIcons = [...prevState.savedIcons];

    const newSavedPolylines = updatedSavedPolylines.map((polyline) => {
      if (polyline.id !== polylineId || !polyline.waypoints) {
        return polyline;
      }

      // Check if waypoint already exists at the new position (excluding current waypoint)
      const waypointExistsAtPosition = polyline.waypoints.some(
        (wp, idx) =>
          idx !== waypointIndex &&
          Math.abs(wp.lat - newLat) < 0.00001 && // Tighter threshold
          Math.abs(wp.lng - newLng) < 0.00001
      );

      if (waypointExistsAtPosition) {
        console.warn(
          `Waypoint at index ${waypointIndex} would overlap with existing waypoint at (${newLat}, ${newLng}). Skipping update.`
        );
        return polyline;
      }

      // Check if the position has changed significantly
      const currentWaypoint = polyline.waypoints[waypointIndex];
      if (
        currentWaypoint &&
        Math.abs(currentWaypoint.lat - newLat) < 0.00001 &&
        Math.abs(currentWaypoint.lng - newLng) < 0.00001
      ) {
        console.log(
          `Waypoint at index ${waypointIndex} has not moved significantly. Skipping update.`
        );
        return polyline;
      }

      // Handle splitter snapping
      if (
        nearestIcon &&
        nearestIcon.type === "Splitter" &&
        nearestIcon.splitterRatio
      ) {
        const splitNum = getRatioNumber(nearestIcon.splitterRatio);
        const connectedLines = getConnectedLinesCount(nearestIcon);

        // Check if the waypoint is already snapped to this splitter
        const isAlreadySnapped =
          currentWaypoint &&
          Math.abs(currentWaypoint.lat - nearestIcon.lat) < 0.00001 &&
          Math.abs(currentWaypoint.lng - nearestIcon.lng) < 0.00001;

        if (connectedLines >= splitNum && !isAlreadySnapped) {
          alert(
            `Cannot connect more lines. Splitter ratio limit (${nearestIcon.splitterRatio} = ${splitNum}) reached.`
          );
          return polyline;
        }

        if (!isAlreadySnapped) {
          console.log("Saved waypoint snapping to splitter:", {
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

          // Update imageIcons and savedIcons for splitter
          updatedImageIcons = updatedImageIcons.map((icon) =>
            icon.id === nearestIcon.id
              ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
              : icon
          );
          updatedSavedIcons = updatedSavedIcons.map((icon) =>
            icon.id === nearestIcon.id
              ? { ...icon, nextLineNumber: (icon.nextLineNumber || 1) + 1 }
              : icon
          );

          polylineUpdated = true;
          return {
            ...polyline,
            waypoints: polyline.waypoints.map((waypoint, index) =>
              index === waypointIndex
                ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
                : waypoint
            ),
            name: newLineName,
            createdAt: polyline.createdAt || Date.now(),
            hasEditedCables: true, // Mark as edited
          };
        }
      }

      // Update waypoint position
      console.log(
        `Updating waypoint ${waypointIndex} for polyline ${polylineId} to (${newLat}, ${newLng})`
      );
      polylineUpdated = true;
      return {
        ...polyline,
        waypoints: polyline.waypoints.map((waypoint, index) =>
          index === waypointIndex ? { lat: newLat, lng: newLng } : waypoint
        ),
        createdAt: polyline.createdAt || Date.now(),
        hasEditedCables: true, // Mark as edited
      };
    });

    if (!polylineUpdated) {
      console.log(`No update needed for polyline ${polylineId}`);
      return prevState;
    }

    console.log("Updated savedPolylines:", newSavedPolylines);

    return {
      ...prevState,
      savedPolylines: newSavedPolylines,
      fiberLines: prevState.showSavedRoutes
        ? newSavedPolylines
        : prevState.fiberLines,
      imageIcons: updatedImageIcons,
      savedIcons: updatedSavedIcons,
      hasEditedCables: true, // Mark state as having unsaved changes
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
        imgSrc: "/img/Save.png",
        tooltip: "Save Route",
        onClick: saveRoute,
      },
      {
        imgSrc: mapState.isSavedRoutesEditable
          ? "/img/Edit-not.png"
          : "/img/Edit.png",
        tooltip: mapState.isSavedRoutesEditable
          ? "Save Before Disable Editing"
          : "Enable Editing",
        onClick: toggleSavedRoutesEditability,
      },
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

    // Cleanup on unmount
    return () => {
      if (mapRef.current && window.google) {
        mapRef.current.controls[
          window.google.maps.ControlPosition.TOP_CENTER
        ].clear();
      }
    };
  }, [mapState.isSavedRoutesEditable, saveRoute, toggleSavedRoutesEditability]);

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
        {mapState.imageIcons.map((icon) => {
          console.log("Rendering MarkerF for icon:", icon);
          const isSavedIcon =
            icon.id.startsWith("icon-api-") ||
            mapState.savedIcons.some((savedIcon) => savedIcon.id === icon.id);
          const isDraggable = isSavedIcon
            ? mapState.isSavedRoutesEditable
            : true;

          return (
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
              onRightClick={(e) => handleRightClickOnIcon(icon, e)}
              onClick={(e) => handleIconClick(icon, e)}
            />
          );
        })}

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
                  zIndex: 100,
                }}
                // onClick={(e) => {
                //   e.domEvent.stopPropagation();
                //   handleLineClick(line, index, false, e);
                // }}

                onClick={(e) => {
                  console.log("Fiber PolylineF clicked:", {
                    lineId: line.id,
                    index,
                    isSavedLine: false,
                    event: e,
                  });
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
                    {/* Add Save Icon if both ports are connected and line is not saved */}
                    {!mapState.selectedLineForActions.isSavedLine &&
                      mapState.selectedLineForActions.line.startPortId &&
                      mapState.selectedLineForActions.line.endPortId && (
                        <div
                          className="line-action-item"
                          onClick={() => {
                            const { line } = mapState.selectedLineForActions;
                            saveCableToInterface(line)
                              .then(() => {
                                alert("Cable saved successfully!");
                                setMapState((prevState) => {
                                  // Move line to savedPolylines
                                  const updatedFiberLines =
                                    prevState.fiberLines.filter(
                                      (l) => l.id !== line.id
                                    );
                                  const updatedSavedPolylines = [
                                    ...prevState.savedPolylines,
                                    { ...line, id: `cable-${Date.now()}` }, // Simulate API cable ID
                                  ];
                                  localStorage.setItem(
                                    "savedPolylines",
                                    JSON.stringify(updatedSavedPolylines)
                                  );
                                  return {
                                    ...prevState,
                                    fiberLines: updatedFiberLines,
                                    savedPolylines: updatedSavedPolylines,
                                    selectedLineForActions: null,
                                    lineActionPosition: null,
                                    exactClickPosition: null,
                                    tempCable: null,
                                    cableSaveAttempted: true,
                                  };
                                });
                              })
                              .catch((error) => {
                                alert(`Failed to save cable: ${error.message}`);
                              });
                          }}
                        >
                          <Save size={20} className="text-blue-500" />
                          <span className="line-action-tooltip">Save Line</span>
                        </div>
                      )}
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

        {/* Render Saved Polylines (Fetched Cables) */}
        {mapState.savedPolylines.map((polyline, index) => {
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
                  strokeColor: "#FF0000",
                  strokeOpacity: 1.0,
                  strokeWeight: 2,
                }}
                // onClick={(e) => handleLineClick(polyline, index, true, e)}

                onClick={(e) => {
                  console.log("Fiber PolylineF clicked:", {
                    lineId: polyline.id,
                    index,
                    isSavedLine: true,
                    event: e,
                  });
                  e.domEvent.stopPropagation();
                  handleLineClick(polyline, index, true, e);
                }}
              />

              {/* Line Action Modal for Saved Polylines */}
              {mapState.selectedLineForActions &&
                mapState.exactClickPosition &&
                mapState.selectedLineForActions.index === index &&
                mapState.selectedLineForActions.isSavedLine && (
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
                      onClick={removeSavedSelectedLine}
                    >
                      <Trash2 size={20} className="text-red-500" />
                      <span className="line-action-tooltip">Delete Line</span>
                    </div>
                    {/* Always show Save button if both ports are connected */}
                    {mapState.selectedLineForActions.line.startPortId &&
                      mapState.selectedLineForActions.line.endPortId && (
                        <div
                          className="line-action-item"
                          onClick={() => {
                            const { line } = mapState.selectedLineForActions;
                            patchCableToInterface(line)
                              .then(() => {
                                alert("Cable updated successfully!");
                                setMapState((prevState) => {
                                  const updatedSavedPolylines =
                                    prevState.savedPolylines.map(
                                      (polyline, idx) =>
                                        idx ===
                                        mapState.selectedLineForActions.index
                                          ? { ...polyline }
                                          : polyline
                                    );
                                  localStorage.setItem(
                                    "savedPolylines",
                                    JSON.stringify(updatedSavedPolylines)
                                  );
                                  return {
                                    ...prevState,
                                    savedPolylines: updatedSavedPolylines,
                                    selectedLineForActions: null,
                                    lineActionPosition: null,
                                    exactClickPosition: null,
                                  };
                                });
                              })
                              .catch((error) => {
                                alert(
                                  `Failed to update cable: ${error.message}`
                                );
                              });
                          }}
                        >
                          <Save size={20} className="text-blue-500" />
                          <span className="line-action-tooltip">
                            Save Changes
                          </span>
                        </div>
                      )}
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

              {/* Waypoint Markers */}
              {(polyline.waypoints || []).map((waypoint, waypointIndex) =>
                !isWaypointOverlaidBySplitter(waypoint) ? (
                  <MarkerF
                    key={`saved-waypoint-${polyline.id}-${waypointIndex}`}
                    position={waypoint}
                    draggable={true}
                    onDragEnd={(e) =>
                      handleSavedPolylineWaypointDragEnd(
                        polyline.id,
                        waypointIndex,
                        e
                      )
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

              {/* Start and End Markers */}
              {!isSnappedToIcon(polyline.from.lat, polyline.from.lng) && (
                <MarkerF
                  key={`saved-start-${polyline.id}`}
                  position={polyline.from}
                  draggable={true}
                  onDragEnd={(e) =>
                    handleSavedPolylinePointDragEnd(polyline.id, "from", e)
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
                  draggable={true}
                  onDragEnd={(e) =>
                    handleSavedPolylinePointDragEnd(polyline.id, "to", e)
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

        {mapState.tempCable && (
          <PolylineF
            path={[
              mapState.tempCable.from,
              ...(mapState.tempCable.waypoints || []),
              mapState.tempCable.to,
            ]}
            options={{
              strokeColor: "#FF0000",
              strokeOpacity: 0.5,
              strokeWeight: 2,
            }}
          />
        )}

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
      </GoogleMap>

      {/* Connect device types api  */}
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
                key={device.name}
                onClick={() => handleSelection(device.name, device.icon)}
                className="modal-button"
              >
                {device.name}
              </button>
            ))}
            <button
              className="modal-button"
              onClick={() => handleSelection("Add Fiber", null)} // Trigger form via handleSelection
            >
              Add Fiber
            </button>
          </div>
          <div className="modal-spike"></div>
        </div>
      )}

      {/* Fiber Form Modal */}
      {mapState.showFiberForm && mapState.rightClickMarker && (
        <div
          className="fiber-form-modal"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            zIndex: 1000,
            width: "300px",
          }}
        >
          <h3 className="text-lg font-semibold mb-4">Create Fiber Line</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addFiberLine();
            }}
          >
            <div className="mb-3">
              <label className="block text-sm font-medium">Fiber Name</label>
              <input
                type="text"
                value={mapState.fiberFormData.name}
                onChange={(e) =>
                  setMapState((prevState) => ({
                    ...prevState,
                    fiberFormData: {
                      ...prevState.fiberFormData,
                      name: e.target.value,
                    },
                  }))
                }
                className="w-full p-2 border rounded"
                placeholder="Enter fiber name"
                required
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Type</label>
              <input
                type="text"
                value={mapState.fiberFormData.type}
                onChange={(e) =>
                  setMapState((prevState) => ({
                    ...prevState,
                    fiberFormData: {
                      ...prevState.fiberFormData,
                      type: e.target.value,
                    },
                  }))
                }
                className="w-full p-2 border rounded"
                placeholder="Enter fiber type (e.g., Fiber, Copper)"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setMapState((prevState) => ({
                    ...prevState,
                    showFiberForm: false,
                    rightClickMarker: null,
                    fiberFormData: { name: "", type: "Fiber" },
                  }))
                }
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      )}

      {mapState.showDeviceModal &&
        mapState.selectedDevice &&
        mapState.deviceModalPosition && (
          <div
            className="line-action-modal"
            style={{
              top: `${mapState.deviceModalPosition.y - 95}px`,
              left: `${mapState.deviceModalPosition.x}px`,
              transform: "translateX(-50%)",
              zIndex: 1000,
            }}
          >
            <div className="line-action-item" onClick={removeSelectedIcon}>
              <Trash2 size={20} className="text-red-500" />
              <span className="line-action-tooltip">Remove Device</span>
            </div>
            <div className="line-action-item" onClick={saveDeviceChanges}>
              <Save size={20} className="text-blue-500" />
              <span className="line-action-tooltip">Save Device</span>
            </div>
            <div
              className="line-action-item"
              onClick={() =>
                setMapState((prev) => ({
                  ...prev,
                  showDeviceModal: false,
                  selectedDevice: null,
                  deviceModalPosition: null,
                }))
              }
            >
              <span className="line-action-close">×</span>
              <span className="line-action-tooltip">Close</span>
            </div>
            <div className="modal-spike"></div>
          </div>
        )}

      {mapState.showDeviceForm && mapState.deviceFormData && (
        <div
          className="device-form-modal"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
            zIndex: 1000,
            width: "400px",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <h3 className="text-lg font-semibold mb-4">
            Create {mapState.deviceFormData.type} Device
          </h3>
          <form onSubmit={handleDeviceFormSubmit}>
            <div className="mb-3">
              <label className="block text-sm font-medium">Device Name</label>
              <input
                type="text"
                value={mapState.deviceForm.deviceName}
                onChange={(e) =>
                  handleDeviceFormInputChange("deviceName", e.target.value)
                }
                className="w-full p-2 border rounded"
                placeholder="Enter device name"
                required
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Description</label>
              <textarea
                value={mapState.deviceForm.description}
                onChange={(e) =>
                  handleDeviceFormInputChange("description", e.target.value)
                }
                className="w-full p-2 border rounded"
                placeholder="Enter description"
                required
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Device Model ID
              </label>
              <input
                type="number"
                value={mapState.deviceForm.deviceModelId}
                onChange={(e) =>
                  handleDeviceFormInputChange("deviceModelId", e.target.value)
                }
                className="w-full p-2 border rounded"
                placeholder="Enter device model ID"
                required
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                {mapState.deviceFormData.type} Name
              </label>
              <input
                type="text"
                value={mapState.deviceForm.name}
                onChange={(e) =>
                  handleDeviceFormInputChange("name", e.target.value)
                }
                className="w-full p-2 border rounded"
                placeholder={`Enter ${mapState.deviceFormData.type} name`}
                required
              />
            </div>
            {mapState.deviceFormData.type === "OLT" && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium">Hostname</label>
                  <input
                    type="text"
                    value={mapState.deviceForm.hostname}
                    onChange={(e) =>
                      handleDeviceFormInputChange("hostname", e.target.value)
                    }
                    className="w-full p-2 border rounded"
                    placeholder="Enter hostname"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium">Community</label>
                  <input
                    type="text"
                    value={mapState.deviceForm.community}
                    onChange={(e) =>
                      handleDeviceFormInputChange("community", e.target.value)
                    }
                    className="w-full p-2 border rounded"
                    placeholder="Enter community"
                    required
                  />
                </div>
              </>
            )}
            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">Ports</label>
              {mapState.deviceForm.ports.map((port, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={port.name}
                    onChange={(e) =>
                      handlePortChange(index, "name", e.target.value)
                    }
                    className="flex-1 p-2 border rounded"
                    placeholder={`Port ${index + 1} name`}
                    required
                  />
                  <input
                    type="number"
                    value={port.position}
                    onChange={(e) =>
                      handlePortChange(index, "position", e.target.value)
                    }
                    className="w-20 p-2 border rounded"
                    placeholder="Position"
                    required
                  />
                  {mapState.deviceForm.ports.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePort(index)}
                      className="p-2 text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addPort}
                className="mt-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Add Port
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setMapState((prevState) => ({
                    ...prevState,
                    showDeviceForm: false,
                    deviceFormData: null,
                    deviceForm: {
                      deviceName: "",
                      description: "",
                      deviceModelId: "",
                      ports: [
                        { name: "", position: 1 },
                        { name: "", position: 2 },
                      ],
                      name: "",
                      hostname: "",
                      community: "",
                    },
                    rightClickMarker: null,
                  }))
                }
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Port Dropdown Modal for Cable */}
      {mapState.showPortDropdown &&
        mapState.portDropdownPosition &&
        mapState.portDropdownDevice && (
          <div
            className="port-dropdown-modal"
            style={{
              position: "fixed",
              top: `${mapState.portDropdownPosition.y - 180}px`, // Adjusted to avoid overlap
              left: `${mapState.portDropdownPosition.x - 100}px`,
              background: "white",
              padding: "15px",
              borderRadius: "8px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              zIndex: 1000,
              width: "220px",
            }}
          >
            <h3 className="text-md font-semibold mb-3">
              Select Port for {mapState.portDropdownDevice.type} (
              {mapState.portDropdownEnd === "start" ? "Start" : "End"})
            </h3>
            <form onSubmit={handlePortSelection}>
              <div className="mb-3">
                <select
                  value={mapState.selectedPortId || ""}
                  onChange={(e) => handlePortDropdownChange(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="">Select a port</option>
                  {mapState.portDropdownPorts.length > 0 ? (
                    mapState.portDropdownPorts.map((port) => (
                      <option key={port.id} value={port.id}>
                        {port.name || `Port ${port.position}`}
                      </option>
                    ))
                  ) : (
                    <option disabled>No ports available</option>
                  )}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closePortDropdown}
                  className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!mapState.selectedPortId}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  Select
                </button>
              </div>
            </form>
          </div>
        )}
    </>
  );
};

export default MyMapV19;
