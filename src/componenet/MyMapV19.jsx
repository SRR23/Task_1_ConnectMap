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
  });

  // New state for device types fetched from backend
  const [deviceTypes, setDeviceTypes] = useState([]);

  // Fetch device types on component mount
  useEffect(() => {
    const fetchDeviceTypes = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/device-types/");
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

  const createDevice = async (device, lat, lng, nextNumber) => {
    const uniqueName = `${device.name}-${nextNumber}`;
    try {
      const devicePayload = {
        name: uniqueName,
        device_type_id: device.id,
        latitude: lat,
        longitude: lng,
      };

      const deviceResponse = await fetch("http://127.0.0.1:8000/api/devices/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(devicePayload),
      });

      if (!deviceResponse.ok) {
        const errorData = await deviceResponse.json();
        throw new Error(
          `Failed to create device: ${
            errorData.message || deviceResponse.statusText
          }`
        );
      }

      const deviceData = await deviceResponse.json();
      const createdDeviceId = deviceData.id;

      // Create default ports
      const defaultPorts = [{ name: `Port1-${uniqueName}`, position: 1 }];
      const createdPortIds = [];

      for (const port of defaultPorts) {
        const portPayload = {
          name: port.name,
          position: port.position,
          device_id: createdDeviceId,
        };

        const portResponse = await fetch("http://127.0.0.1:8000/api/ports/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(portPayload),
        });

        if (!portResponse.ok) {
          const errorData = await portResponse.json();
          throw new Error(
            `Failed to create port: ${
              errorData.message || portResponse.statusText
            }`
          );
        }

        const portData = await portResponse.json();
        createdPortIds.push(portData.id);
      }

      // Handle OLT or ONU creation (unchanged)
      const deviceTypeMap = {
        OLT: {
          endpoint: "http://127.0.0.1:8000/api/olts/",
          payload: {
            name: uniqueName,
            device_id: createdDeviceId,
            hostname: "",
            community: "",
          },
        },
        ONU: {
          endpoint: "http://127.0.0.1:8000/api/onus/",
          payload: {
            name: uniqueName,
            device_id: createdDeviceId,
          },
        },
      };

      const deviceType = device.name.toUpperCase();
      if (deviceTypeMap[deviceType]) {
        const { endpoint, payload } = deviceTypeMap[deviceType];
        const typeResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!typeResponse.ok) {
          const errorData = await typeResponse.json();
          throw new Error(
            `Failed to create ${deviceType}: ${
              errorData.message || typeResponse.statusText
            }`
          );
        }
      }

      return { ...deviceData, portIds: createdPortIds };
    } catch (error) {
      console.error("Error creating device or related entities:", error);
      alert(`Failed to create device or related entities: ${error.message}`);
      throw error;
    }
  };

  // Fetch devices from the backend and update state

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/devices/");
        if (!response.ok) {
          throw new Error(`Failed to fetch devices: ${response.statusText}`);
        }
        const devices = await response.json();

        const fetchedIcons = devices
          .filter((device) => {
            const hasValidCoords =
              device.latitude != null &&
              device.longitude != null &&
              !isNaN(device.latitude) &&
              !isNaN(device.longitude);
            if (!hasValidCoords) {
              console.warn(
                `Skipping device ${device.name} with invalid coordinates`
              );
            }
            return hasValidCoords;
          })
          .map((device) => ({
            lat: device.latitude,
            lng: device.longitude,
            type: device.device_type.name,
            id: `icon-api-${device.id}`,
            imageUrl: device.device_type.icon || "/img/default-icon.png",
            splitterRatio: device.device_type.name === "Splitter" ? "" : null,
            name: device.device_type.name === "Splitter" ? "" : null,
            nextLineNumber: device.device_type.name === "Splitter" ? 1 : null,
            deviceId: device.id,
            portIds: device.ports.map((port) => port.id), // Include port IDs
          }));

        setMapState((prevState) => ({
          ...prevState,
          imageIcons: fetchedIcons,
          nextNumber: fetchedIcons.length + 1,
        }));
      } catch (error) {
        console.error("Error fetching devices:", error);
        alert("Failed to load devices from the server.");
      }
    };

    fetchDevices();
  }, []);

  const updateDevice = async (deviceId, lat, lng) => {
    try {
      // Fetch the current device data to get existing fields
      const fetchResponse = await fetch(
        `http://127.0.0.1:8000/api/devices/${deviceId}/`
      );
      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json();
        throw new Error(
          `Failed to fetch device: ${
            errorData.message || fetchResponse.statusText
          }`
        );
      }
      const deviceData = await fetchResponse.json();

      // Prepare the payload with all required fields
      const payload = {
        name: deviceData.name, // Preserve existing name
        device_type_id: deviceData.device_type.id, // Preserve device_type_id
        latitude: lat, // Update latitude
        longitude: lng, // Update longitude
        port_ids: deviceData.ports.map((port) => port.id) || [3], // Preserve or default port_ids
      };

      console.log("Updating device with payload:", payload); // Debug payload

      const response = await fetch(
        `http://127.0.0.1:8000/api/devices/${deviceId}/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to update device: ${errorData.message || response.statusText}`
        );
      }

      const data = await response.json();
      console.log(`Device ${deviceId} updated:`, data);
      return data;
    } catch (error) {
      console.error("Error updating device:", error);
      alert(`Failed to update device: ${error.message}`);
      throw error;
    }
  };

  const saveCable = async (line) => {
    try {
      const path = {
        from: { lat: line.from.lat, lng: line.from.lng },
        waypoints: line.waypoints
          ? line.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }))
          : [],
        to: { lat: line.to.lat, lng: line.to.lng },
      };

      const payload = {
        name: line.name || `Cable-${line.id || Date.now()}`,
        type: "Fiber",
        path: path,
      };

      const isExistingCable = line.id && line.id.startsWith("cable-");
      const cableId = isExistingCable ? line.id.split("-")[1] : null;
      const url = isExistingCable
        ? `http://127.0.0.1:8000/api/cables/${cableId}/`
        : "http://127.0.0.1:8000/api/cables/";
      const method = isExistingCable ? "PUT" : "POST";

      const cableResponse = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!cableResponse.ok) {
        const errorData = await cableResponse.json();
        throw new Error(
          `Failed to ${isExistingCable ? "update" : "save"} cable ${line.id}: ${
            errorData.message || cableResponse.statusText
          }`
        );
      }

      const cableData = await cableResponse.json();
      console.log(`Cable ${isExistingCable ? "updated" : "saved"}:`, cableData);

      // Validate port IDs
      if (!line.startPortId || !line.endPortId) {
        // console.warn(`Missing port IDs for cable ${cableData.id}:`, {
        //   startPortId: line.startPortId,
        //   endPortId: line.endPortId,
        // });

        // Optionally, fetch or create ports for the devices
        const startDeviceId = line.startDeviceId;
        const endDeviceId = line.endDeviceId;

        if (startDeviceId && !line.startPortId) {
          const port = await createOrFetchPort(startDeviceId, cableData.id);
          line.startPortId = port.id;
        }
        if (endDeviceId && !line.endPortId) {
          const port = await createOrFetchPort(endDeviceId, cableData.id);
          line.endPortId = port.id;
        }

        // If still no valid port IDs, throw an error
        // if (!line.startPortId || !line.endPortId) {
        //   throw new Error(
        //     `Cannot save interface for cable ${cableData.id}: Missing valid port IDs`
        //   );
        // }
      }

      const interfacePayload = {
        name: `Interface-${cableData.id}-${Date.now()}`,
        start: line.startPortId,
        end: line.endPortId,
        cable_id: cableData.id,
      };

      console.log("Interface payload:", interfacePayload); // Debug payload

      const interfaceResponse = await fetch(
        "http://127.0.0.1:8000/api/interfaces/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(interfacePayload),
        }
      );

      // if (!interfaceResponse.ok) {
      //   const errorData = await interfaceResponse.json();
      //   throw new Error(
      //     `Failed to save interface for cable ${cableData.id}: ${
      //       errorData.message || interfaceResponse.statusText
      //     }`
      //   );
      // }

      const interfaceData = await interfaceResponse.json();
      console.log("Interface saved:", interfaceData);

      return { cable: cableData, interface: interfaceData };
    } catch (error) {
      console.error(
        `Error ${line.id ? "updating" : "saving"} cable or interface:`,
        error
      );
      throw error;
    }
  };

  useEffect(() => {
    const fetchCables = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/cables/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `Failed to fetch cables: ${
              errorData.message || response.statusText
            }`
          );
        }

        const cables = await response.json();
        console.log("Fetched cables:", cables);

        const fetchedPolylines = cables
          .filter((cable) => {
            const hasValidCoords =
              cable.path &&
              cable.path.from &&
              cable.path.to &&
              !isNaN(parseFloat(cable.path.from.lat)) &&
              !isNaN(parseFloat(cable.path.from.lng)) &&
              !isNaN(parseFloat(cable.path.to.lat)) &&
              !isNaN(parseFloat(cable.path.to.lng));
            if (!hasValidCoords) {
              console.warn(
                `Skipping cable ${cable.name} with invalid coordinates`
              );
            }
            return hasValidCoords;
          })
          .map((cable) => ({
            id: `cable-${cable.id}`, // Prefix to avoid conflicts
            name: cable.name || `Cable-${cable.id}`,
            from: {
              lat: parseFloat(cable.path.from.lat),
              lng: parseFloat(cable.path.from.lng),
            },
            to: {
              lat: parseFloat(cable.path.to.lat),
              lng: parseFloat(cable.path.to.lng),
            },
            waypoints: Array.isArray(cable.path.waypoints)
              ? cable.path.waypoints
                  .filter(
                    (wp) =>
                      !isNaN(parseFloat(wp.lat)) && !isNaN(parseFloat(wp.lng))
                  )
                  .map((wp) => ({
                    lat: parseFloat(wp.lat),
                    lng: parseFloat(wp.lng),
                  }))
              : [],
            createdAt: Date.now(), // Adjust if backend provides timestamp
            // strokeColor: "#0000FF", // Match saveRoute
          }));

        setMapState((prevState) => ({
          ...prevState,
          savedPolylines: fetchedPolylines,
          // fiberLines: prevState.showSavedRoutes ? fetchedPolylines : prevState.fiberLines,
        }));
      } catch (error) {
        console.error("Error fetching cables:", error);
        alert("Failed to load cables from the server.");
      }
    };

    fetchCables();
  }, []);

  // New function to delete a device
  const deleteDevice = async (deviceId) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/devices/${deviceId}/`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to delete device: ${errorData.message || response.statusText}`
        );
      }

      console.log(`Device ${deviceId} deleted successfully`);
    } catch (error) {
      console.error("Error deleting device:", error);
      alert(`Failed to delete device: ${error.message}`);
      throw error;
    }
  };

  // New function to delete a cable
  const deleteCable = async (cableId) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/cables/${cableId}/`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to delete cable: ${errorData.message || response.statusText}`
        );
      }

      console.log(`Cable ${cableId} deleted successfully`);
    } catch (error) {
      console.error("Error deleting cable:", error);
      alert(`Failed to delete cable: ${error.message}`);
      throw error;
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
    return !isSavedLine || mapState.isSavedRoutesEditable;
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

  // Modify it for API call to get image URL
  const handleSelection = async (type, icon) => {
    const { selectedPoint, nextNumber } = mapState;
    const validImageUrl =
      icon && typeof icon === "string" ? icon : "/img/default-icon.png";
    const selectedDevice = deviceTypes.find((device) => device.name === type);

    if (!selectedDevice) {
      console.error(`Device type "${type}" not found in deviceTypes`);
      alert(`Error: Device type "${type}" not found.`);
      return;
    }

    try {
      const deviceData = await createDevice(
        selectedDevice,
        selectedPoint.lat,
        selectedPoint.lng,
        nextNumber
      );

      setMapState((prevState) => ({
        ...prevState,
        selectedType: type,
        showModal: false,
        imageIcons: [
          ...prevState.imageIcons,
          {
            ...selectedPoint,
            type,
            id: `icon-api-${deviceData.id}`,
            imageUrl: validImageUrl,
            splitterRatio: type === "Splitter" ? "" : null,
            name: type === "Splitter" ? "" : null,
            nextLineNumber: type === "Splitter" ? 1 : null,
            deviceId: deviceData.id,
            portIds: deviceData.portIds || [], // Store port IDs
          },
        ],
        nextNumber: nextNumber + 1,
        rightClickMarker: null,
      }));
    } catch (error) {
      // Error handled in createDevice
    }
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
    const isSavedIcon =
      icon.id.startsWith("icon-api-") ||
      mapState.savedIcons.some((savedIcon) => savedIcon.id === icon.id);
    if (isSavedIcon && !mapState.isSavedRoutesEditable) return;

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
          // showModal: true,
          selectedWaypoint: icon,
          waypointActionPosition: { x, y },
          selectedWaypointInfo: { isIcon: true, iconId: icon.id },
        }));
      }
    }
  };

  const removeSelectedIcon = async () => {
    if (!mapState.selectedWaypointInfo || !mapState.selectedWaypointInfo.isIcon)
      return;
    if (mapState.showSavedRoutes && !mapState.isSavedRoutesEditable) return;

    const { iconId } = mapState.selectedWaypointInfo;

    try {
      // If the icon is from the API, delete it from the backend
      if (iconId.startsWith("icon-api-")) {
        const deviceId = iconId.split("-")[2];
        await deleteDevice(deviceId);
      }

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
    } catch (error) {
      // Error handled in deleteDevice
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
    const { rightClickMarker } = mapState;
    if (!rightClickMarker) return;

    const nearestIcon = findNearestIcon(
      rightClickMarker.lat,
      rightClickMarker.lng
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
      name: "",
      startDeviceId: nearestIcon ? nearestIcon.deviceId : null,
      startPortId:
        nearestIcon && nearestIcon.portIds.length > 0
          ? nearestIcon.portIds[0]
          : null,
      endDeviceId: null,
      endPortId: null,
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
            startDeviceId: nearestIcon.deviceId,
            startPortId:
              nearestIcon.portIds.length > 0 ? nearestIcon.portIds[0] : null,
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
        startDeviceId: nearestIcon ? nearestIcon.deviceId : null,
        startPortId:
          nearestIcon && nearestIcon.portIds.length > 0
            ? nearestIcon.portIds[0]
            : null,
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
            endDeviceId: nearestIcon.deviceId,
            endPortId:
              nearestIcon.portIds.length > 0 ? nearestIcon.portIds[0] : null,
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
        endDeviceId: nearestIcon ? nearestIcon.deviceId : null,
        endPortId:
          nearestIcon && nearestIcon.portIds.length > 0
            ? nearestIcon.portIds[0]
            : null,
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

  const saveRoute = async () => {
    try {
      const cablesToSave = mapState.isSavedRoutesEditable
        ? [...mapState.savedPolylines]
        : [...mapState.fiberLines];

      const updatedDevices = mapState.updatedDevices;
      if (updatedDevices.length > 0) {
        const deviceUpdateResults = await Promise.all(
          updatedDevices.map(async (device) => {
            try {
              await updateDevice(device.deviceId, device.lat, device.lng);
              return { deviceId: device.deviceId, success: true };
            } catch (error) {
              console.error(
                `Failed to update device ${device.deviceId}:`,
                error
              );
              return { deviceId: device.deviceId, success: false, error };
            }
          })
        );

        const failedUpdates = deviceUpdateResults.filter(
          (result) => !result.success
        );
        if (failedUpdates.length > 0) {
          console.warn("Some device updates failed:", failedUpdates);
          alert(
            `Some devices failed to update: ${failedUpdates
              .map((f) => `Device ${f.deviceId}: ${f.error.message}`)
              .join(", ")}`
          );
        }
      }

      if (cablesToSave.length > 0) {
        const savedCables = await Promise.all(
          cablesToSave.map((line) =>
            saveCable({
              ...line,
              startPortId: line.startPortId || line.fromPortId, // Handle both fiberLines and savedPolylines
              endPortId: line.endPortId || line.toPortId,
            })
          )
        );
        console.log("All cables processed:", savedCables);
      } else {
        console.log("No cables to save.");
      }

      const response = await fetch("http://127.0.0.1:8000/api/cables/");
      if (!response.ok) {
        throw new Error("Failed to fetch updated cables");
      }
      const cables = await response.json();
      const fetchedPolylines = cables
        .filter((cable) => {
          const hasValidCoords =
            cable.path &&
            cable.path.from &&
            cable.path.to &&
            !isNaN(parseFloat(cable.path.from.lat)) &&
            !isNaN(parseFloat(cable.path.from.lng)) &&
            !isNaN(parseFloat(cable.path.to.lat)) &&
            !isNaN(parseFloat(cable.path.to.lng));
          return hasValidCoords;
        })
        .map((cable) => ({
          id: `cable-${cable.id}`,
          name: cable.name || `Cable-${cable.id}`,
          from: {
            lat: parseFloat(cable.path.from.lat),
            lng: parseFloat(cable.path.from.lng),
          },
          to: {
            lat: parseFloat(cable.path.to.lat),
            lng: parseFloat(cable.path.to.lng),
          },
          waypoints: Array.isArray(cable.path.waypoints)
            ? cable.path.waypoints
                .filter(
                  (wp) =>
                    !isNaN(parseFloat(wp.lat)) && !isNaN(parseFloat(wp.lng))
                )
                .map((wp) => ({
                  lat: parseFloat(wp.lat),
                  lng: parseFloat(wp.lng),
                }))
            : [],
          createdAt: cable.created_at
            ? new Date(cable.created_at).getTime()
            : Date.now(),
          // Note: Port IDs are not fetched from cables; they are managed via interfaces
        }));

      setMapState((prevState) => ({
        ...prevState,
        fiberLines: [],
        savedPolylines: fetchedPolylines,
        showSavedRoutes: true,
        isSavedRoutesEditable: false,
        updatedDevices: [],
      }));

      alert("Polylines and devices saved successfully!");
    } catch (error) {
      console.error("Error saving routes or devices:", error);
      alert(`Failed to save routes or devices: ${error.message}`);
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
          // Check if the icon is saved (from API or savedIcons)
          const isSavedIcon =
            icon.id.startsWith("icon-api-") ||
            mapState.savedIcons.some((savedIcon) => savedIcon.id === icon.id);

          // Only allow dragging if edit mode is enabled for saved icons; non-saved icons are always draggable
          const isDraggable = isSavedIcon
            ? mapState.isSavedRoutesEditable
            : true;

          return (
            <MarkerF
              key={icon.id}
              position={{ lat: icon.lat, lng: icon.lng }}
              draggable={isDraggable}
              icon={{
                url: icon.imageUrl || "/img/default-icon.png", // Fallback
                scaledSize: new google.maps.Size(30, 30),
                anchor: new google.maps.Point(15, 15),
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
                onClick={(e) => handleLineClick(polyline, index, true, e)}
              />

              {/* Line Action Modal for Saved Polylines */}
              {mapState.selectedLineForActions &&
                mapState.exactClickPosition &&
                mapState.selectedLineForActions.index === index &&
                mapState.selectedLineForActions.isSavedLine &&
                mapState.isSavedRoutesEditable && (
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

              {/* Waypoint Markers */}
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

              {/* Start and End Markers */}
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
                          handleSavedPolylinePointDragEnd(polyline.id, "to", e)
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

export default MyMapV19;
