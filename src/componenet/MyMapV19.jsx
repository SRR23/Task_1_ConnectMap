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
    showSaveCableModal: false,
    allPorts: [], // Initialize as empty array
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

  // Fetch devices and ports
  // useEffect(() => {
  //   const fetchDevices = async () => {
  //     try {
  //       const response = await fetch("http://127.0.0.1:8000/api/devices/");
  //       if (!response.ok) {
  //         throw new Error(`Failed to fetch devices: ${response.statusText}`);
  //       }
  //       const devices = await response.json();
  //       console.log("Fetched devices:", devices);
  //       const device105 = devices.find((device) => device.id === 105);
  //       console.log("Device 105 full data:", device105);
  //       console.log("Device 105 ports:", device105?.ports);
  //       const fetchedIcons = devices
  //         .filter((device) => {
  //           const hasValidCoords =
  //             device.latitude != null &&
  //             device.longitude != null &&
  //             !isNaN(device.latitude) &&
  //             !isNaN(device.longitude);
  //           if (!hasValidCoords) {
  //             console.warn(
  //               `Skipping device ${device.name} with invalid coordinates`
  //             );
  //           }
  //           return hasValidCoords;
  //         })
  //         .map((device) => ({
  //           lat: device.latitude,
  //           lng: device.longitude,
  //           type: device.device_type.name,
  //           id: `icon-api-${device.id}`,
  //           imageUrl: device.device_type.icon || "/img/default-icon.png",
  //           splitterRatio: device.device_type.name === "Splitter" ? "" : null,
  //           name: device.device_type.name === "Splitter" ? "" : null,
  //           nextLineNumber: device.device_type.name === "Splitter" ? 1 : null,
  //           deviceId: device.id,
  //           portIds: device.ports.map((port) => port.id),
  //         }));
  //       setMapState((prevState) => ({
  //         ...prevState,
  //         imageIcons: fetchedIcons,
  //         nextNumber: fetchedIcons.length + 1,
  //       }));
  //     } catch (error) {
  //       console.error("Error fetching devices:", error);
  //       alert("Failed to load devices from the server.");
  //     }
  //   };

  //   const fetchPorts = async () => {
  //     try {
  //       const response = await fetch("http://127.0.0.1:8000/api/ports/");
  //       if (!response.ok) throw new Error("Failed to fetch ports");
  //       const ports = await response.json();
  //       setAllPorts(ports);
  //       console.log("Fetched ports:", ports);
  //     } catch (error) {
  //       console.error("Error fetching ports:", error);
  //       setAllPorts([]); // Set to empty array on error
  //     }
  //   };
  //   fetchDevices();
  //   fetchPorts();
  // }, []);

  // useEffect(() => {
  //   const fetchDevices = async () => {
  //     try {
  //       const response = await fetch("http://127.0.0.1:8000/api/devices/");
  //       if (!response.ok) {
  //         throw new Error(`Failed to fetch devices: ${response.statusText}`);
  //       }
  //       const devices = await response.json();
  //       console.log("Fetched devices:", devices);
  //       const oltDevices = devices.filter(
  //         (device) => device.device_type.name === "OLT"
  //       );
  //       console.log(
  //         "OLT devices with ports:",
  //         oltDevices.map((d) => ({
  //           id: d.id,
  //           name: d.name,
  //           portIds: d.ports.map((p) => p.id),
  //           ports: d.ports,
  //         }))
  //       );
  //       const fetchedIcons = devices
  //         .filter((device) => {
  //           const hasValidCoords =
  //             device.latitude != null &&
  //             device.longitude != null &&
  //             !isNaN(device.latitude) &&
  //             !isNaN(device.longitude);
  //           if (!hasValidCoords) {
  //             console.warn(
  //               `Skipping device ${device.name} with invalid coordinates`
  //             );
  //           }
  //           return hasValidCoords;
  //         })
  //         .map((device) => ({
  //           lat: device.latitude,
  //           lng: device.longitude,
  //           type: device.device_type.name,
  //           id: `icon-api-${device.id}`,
  //           imageUrl: device.device_type.icon || "/img/default-icon.png",
  //           splitterRatio: device.device_type.name === "Splitter" ? "" : null,
  //           name: device.device_type.name === "Splitter" ? "" : null,
  //           nextLineNumber: device.device_type.name === "Splitter" ? 1 : null,
  //           deviceId: device.id,
  //           portIds: device.ports.map((port) => port.id),
  //         }));
  //       console.log(
  //         "imageIcons for OLT:",
  //         fetchedIcons.filter((icon) => icon.type === "OLT")
  //       );
  //       setMapState((prevState) => ({
  //         ...prevState,
  //         imageIcons: fetchedIcons,
  //         nextNumber: fetchedIcons.length + 1,
  //       }));
  //     } catch (error) {
  //       console.error("Error fetching devices:", error);
  //       alert("Failed to load devices from the server.");
  //     }
  //   };

  //   const fetchPorts = async () => {
  //     try {
  //       const response = await fetch("http://127.0.0.1:8000/api/ports/");
  //       if (!response.ok) throw new Error("Failed to fetch ports");
  //       const ports = await response.json();
  //       console.log("Fetched ports:", ports);
  //       const oltPorts = ports.filter((port) =>
  //         [38, 39, 40, 41].includes(port.id)
  //       );
  //       console.log("OLT ports (IDs 38-41):", oltPorts);
  //       setMapState((prevState) => ({
  //         ...prevState,
  //         allPorts: ports,
  //       }));
  //     } catch (error) {
  //       console.error("Error fetching ports:", error);
  //       setMapState((prevState) => ({
  //         ...prevState,
  //         allPorts: [],
  //       }));
  //       alert("Failed to load ports from the server.");
  //     }
  //   };
  //   fetchDevices();
  //   fetchPorts();
  // }, []);

  // const updateDevice = async (deviceId, lat, lng) => {
  //   try {
  //     // Fetch the current device data to get existing fields
  //     const fetchResponse = await fetch(
  //       `http://127.0.0.1:8000/api/devices/${deviceId}/`
  //     );
  //     if (!fetchResponse.ok) {
  //       const errorData = await fetchResponse.json();
  //       throw new Error(
  //         `Failed to fetch device: ${
  //           errorData.message || fetchResponse.statusText
  //         }`
  //       );
  //     }
  //     const deviceData = await fetchResponse.json();

  //     // Prepare the payload with all required fields
  //     const payload = {
  //       name: deviceData.name, // Preserve existing name
  //       device_type_id: deviceData.device_type.id, // Preserve device_type_id
  //       latitude: lat, // Update latitude
  //       longitude: lng, // Update longitude
  //       port_ids: deviceData.ports.map((port) => port.id) || [3], // Preserve or default port_ids
  //     };

  //     console.log("Updating device with payload:", payload); // Debug payload

  //     const response = await fetch(
  //       `http://127.0.0.1:8000/api/devices/${deviceId}/`,
  //       {
  //         method: "PUT",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify(payload),
  //       }
  //     );

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(
  //         `Failed to update device: ${errorData.message || response.statusText}`
  //       );
  //     }

  //     const data = await response.json();
  //     console.log(`Device ${deviceId} updated:`, data);
  //     return data;
  //   } catch (error) {
  //     console.error("Error updating device:", error);
  //     alert(`Failed to update device: ${error.message}`);
  //     throw error;
  //   }
  // };

  // const saveCable = async (line) => {
  //   try {
  //     // Validate required fields
  //     if (!line.from || !line.to) {
  //       throw new Error("Cable must have both start and end points");
  //     }

  //     // Validate ports if connected to devices
  //     if (line.startDeviceId && !line.startPortId) {
  //       throw new Error(
  //         "Start port must be selected when connected to a device"
  //       );
  //     }
  //     if (line.endDeviceId && !line.endPortId) {
  //       throw new Error("End port must be selected when connected to a device");
  //     }

  //     // Prepare the path data
  //     const path = {
  //       from: { lat: line.from.lat, lng: line.from.lng },
  //       to: { lat: line.to.lat, lng: line.to.lng },
  //       waypoints: line.waypoints
  //         ? line.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }))
  //         : [],
  //     };

  //     // Prepare the payload
  //     const payload = {
  //       name: line.name || `Cable-${line.id || Date.now()}`,
  //       type: "Fiber",
  //       path: path,
  //       start_port_id: line.startPortId ? parseInt(line.startPortId) : null,
  //       end_port_id: line.endPortId ? parseInt(line.endPortId) : null,
  //       start_device_id: line.startDeviceId
  //         ? parseInt(line.startDeviceId)
  //         : null,
  //       end_device_id: line.endDeviceId ? parseInt(line.endDeviceId) : null,
  //     };

  //     // Determine if we're updating an existing cable or creating a new one
  //     const isExisting = line.id && line.id.startsWith("cable-");
  //     const url = isExisting
  //       ? `http://127.0.0.1:8000/api/cables/${line.id.split("-")[1]}/`
  //       : "http://127.0.0.1:8000/api/cables/";
  //     const method = isExisting ? "PUT" : "POST";

  //     // Save/update the cable
  //     const response = await fetch(url, {
  //       method,
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify(payload),
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(
  //         errorData.message ||
  //           `Failed to ${isExisting ? "update" : "create"} cable`
  //       );
  //     }

  //     const cableData = await response.json();

  //     // Create interface if both ports are specified
  //     if (line.startPortId && line.endPortId) {
  //       const interfacePayload = {
  //         name: `Interface-${cableData.id}-${Date.now()}`, // Add required name field
  //         start: parseInt(line.startPortId), // Use 'start' instead of 'start_port_id'
  //         end: parseInt(line.endPortId), // Use 'end' instead of 'end_port_id'
  //         cable_id: cableData.id,
  //       };

  //       const interfaceResponse = await fetch(
  //         "http://127.0.0.1:8000/api/interfaces/",
  //         {
  //           method: "POST",
  //           headers: {
  //             "Content-Type": "application/json",
  //           },
  //           body: JSON.stringify(interfacePayload),
  //         }
  //       );

  //       if (!interfaceResponse.ok) {
  //         const errorData = await interfaceResponse.json();
  //         throw new Error(
  //           errorData.message || "Failed to create interface connection"
  //         );
  //       }
  //     }

  //     // Update state to move the cable to savedPolylines and clear fiberLines
  //     setMapState((prevState) => ({
  //       ...prevState,
  //       fiberLines: prevState.fiberLines.filter((l) => l.id !== line.id),
  //       savedPolylines: [
  //         ...prevState.savedPolylines,
  //         {
  //           id: `cable-${cableData.id}`,
  //           name: cableData.name,
  //           from: path.from,
  //           to: path.to,
  //           waypoints: path.waypoints,
  //           startPortId: line.startPortId,
  //           endPortId: line.endPortId,
  //           startPortName: line.startPortName,
  //           endPortName: line.endPortName,
  //           startDeviceId: line.startDeviceId,
  //           endDeviceId: line.endDeviceId,
  //           createdAt: Date.now(),
  //         },
  //       ],
  //       showSaveCableModal: false,
  //       tempCable: null,
  //       startPortId: null,
  //       endPortId: null,
  //       startPortName: null,
  //       endPortName: null,
  //       startDeviceId: null,
  //       endDeviceId: null,
  //     }));

  //     return cableData;
  //   } catch (error) {
  //     console.error("Error saving cable:", error);
  //     alert(`Failed to save cable: ${error.message}`);
  //     throw error;
  //   }
  // };

  // useEffect(() => {
  //   const fetchCables = async () => {
  //     try {
  //       const response = await fetch("http://127.0.0.1:8000/api/cables/", {
  //         method: "GET",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //       });

  //       if (!response.ok) {
  //         const errorData = await response.json();
  //         throw new Error(
  //           `Failed to fetch cables: ${
  //             errorData.message || response.statusText
  //           }`
  //         );
  //       }

  //       const cables = await response.json();
  //       console.log("Fetched cables:", cables);

  //       const fetchedPolylines = cables
  //         .filter((cable) => {
  //           const hasValidCoords =
  //             cable.path &&
  //             cable.path.from &&
  //             cable.path.to &&
  //             !isNaN(parseFloat(cable.path.from.lat)) &&
  //             !isNaN(parseFloat(cable.path.from.lng)) &&
  //             !isNaN(parseFloat(cable.path.to.lat)) &&
  //             !isNaN(parseFloat(cable.path.to.lng));
  //           if (!hasValidCoords) {
  //             console.warn(
  //               `Skipping cable ${cable.name} with invalid coordinates`
  //             );
  //           }
  //           return hasValidCoords;
  //         })
  //         .map((cable) => ({
  //           id: `cable-${cable.id}`, // Prefix to avoid conflicts
  //           name: cable.name || `Cable-${cable.id}`,
  //           from: {
  //             lat: parseFloat(cable.path.from.lat),
  //             lng: parseFloat(cable.path.from.lng),
  //           },
  //           to: {
  //             lat: parseFloat(cable.path.to.lat),
  //             lng: parseFloat(cable.path.to.lng),
  //           },
  //           waypoints: Array.isArray(cable.path.waypoints)
  //             ? cable.path.waypoints
  //                 .filter(
  //                   (wp) =>
  //                     !isNaN(parseFloat(wp.lat)) && !isNaN(parseFloat(wp.lng))
  //                 )
  //                 .map((wp) => ({
  //                   lat: parseFloat(wp.lat),
  //                   lng: parseFloat(wp.lng),
  //                 }))
  //             : [],
  //           createdAt: Date.now(), // Adjust if backend provides timestamp
  //           // strokeColor: "#0000FF", // Match saveRoute
  //         }));

  //       setMapState((prevState) => ({
  //         ...prevState,
  //         savedPolylines: fetchedPolylines,
  //         // fiberLines: prevState.showSavedRoutes ? fetchedPolylines : prevState.fiberLines,
  //       }));
  //     } catch (error) {
  //       console.error("Error fetching cables:", error);
  //       alert("Failed to load cables from the server.");
  //     }
  //   };

  //   fetchCables();
  // }, []);

  // New function to delete a device
  // const deleteDevice = async (deviceId) => {
  //   try {
  //     const response = await fetch(
  //       `http://127.0.0.1:8000/api/devices/${deviceId}/`,
  //       {
  //         method: "DELETE",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //       }
  //     );

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(
  //         `Failed to delete device: ${errorData.message || response.statusText}`
  //       );
  //     }

  //     console.log(`Device ${deviceId} deleted successfully`);
  //   } catch (error) {
  //     console.error("Error deleting device:", error);
  //     alert(`Failed to delete device: ${error.message}`);
  //     throw error;
  //   }
  // };

  // New function to delete a cable
  // const deleteCable = async (cableId) => {
  //   try {
  //     const response = await fetch(
  //       `http://127.0.0.1:8000/api/cables/${cableId}/`,
  //       {
  //         method: "DELETE",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //       }
  //     );

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(
  //         `Failed to delete cable: ${errorData.message || response.statusText}`
  //       );
  //     }

  //     console.log(`Cable ${cableId} deleted successfully`);
  //   } catch (error) {
  //     console.error("Error deleting cable:", error);
  //     alert(`Failed to delete cable: ${error.message}`);
  //     throw error;
  //   }
  // };

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

  // const handleSelection = (type, icon) => {
  //   const { selectedPoint, nextNumber } = mapState;
  //   console.log(
  //     "handleSelection called with type:",
  //     type,
  //     "at point:",
  //     selectedPoint
  //   );

  //   if (!selectedPoint) {
  //     console.error("No selected point for device or fiber creation");
  //     alert("Error: No point selected for creation.");
  //     return;
  //   }

  //   const validImageUrl =
  //     icon && typeof icon === "string" ? icon : "/img/default-icon.png";
  //   const selectedDevice = deviceTypes.find((device) => device.name === type);

  //   if (type === "Add Fiber") {
  //     console.log("Adding fiber line at:", selectedPoint);
  //     const newLine = {
  //       id: `fiber-${Date.now()}`,
  //       from: { lat: selectedPoint.lat, lng: selectedPoint.lng },
  //       to: {
  //         lat: selectedPoint.lat + 0.001,
  //         lng: selectedPoint.lng + 0.001,
  //       },
  //       waypoints: [],
  //       createdAt: Date.now(),
  //       startDeviceId: null,
  //       endDeviceId: null,
  //       startPortId: null,
  //       endPortId: null,
  //       startPortName: null,
  //       endPortName: null,
  //     };
  //     setMapState((prevState) => ({
  //       ...prevState,
  //       fiberLines: [...prevState.fiberLines, newLine],
  //       showModal: false,
  //       rightClickMarker: null,
  //       selectedPoint: null,
  //     }));
  //   } else if (selectedDevice) {
  //     if (type === "OLT" || type === "ONU") {
  //       console.log(`Showing device form for ${type}`);
  //       setMapState((prevState) => ({
  //         ...prevState,
  //         showModal: false,
  //         rightClickMarker: null,
  //         showDeviceForm: true,
  //         deviceFormData: {
  //           device: selectedDevice,
  //           lat: selectedPoint.lat,
  //           lng: selectedPoint.lng,
  //           nextNumber,
  //           type,
  //           imageUrl: validImageUrl,
  //         },
  //         deviceForm: {
  //           deviceName: `${type}-${nextNumber}`,
  //           description: "",
  //           deviceModelId: "",
  //           ports: [
  //             { name: `Port 1-${type}-${nextNumber}`, position: 1 },
  //             { name: `Port 2-${type}-${nextNumber}`, position: 2 },
  //           ],
  //           name: `${selectedPoint.lat.toFixed(2)}-${type}`,
  //           hostname: type === "OLT" ? "192.168.1.1" : "",
  //           community: type === "OLT" ? "public" : "",
  //         },
  //       }));
  //     } else {
  //       console.log(`Creating device of type ${type}`);
  //     }
  //   } else {
  //     console.error(`Device type "${type}" not found in deviceTypes`);
  //     alert(`Error: Device type "${type}" not found.`);
  //     setMapState((prevState) => ({
  //       ...prevState,
  //       showModal: false,
  //       rightClickMarker: null,
  //       selectedPoint: null,
  //     }));
  //   }
  // };

  const handleSelection = (type, icon) => {
  const { selectedPoint, nextNumber } = mapState;
  console.log("handleSelection called with type:", type, "at point:", selectedPoint);

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
    const newLine = {
      id: `fiber-${Date.now()}`,
      from: { lat: selectedPoint.lat, lng: selectedPoint.lng },
      to: {
        lat: selectedPoint.lat + 0.001,
        lng: selectedPoint.lng + 0.001,
      },
      waypoints: [],
      createdAt: Date.now(),
      startDeviceId: null,
      endDeviceId: null,
      startPortId: null,
      endPortId: null,
      startPortName: null,
      endPortName: null,
    };
    setMapState((prevState) => ({
      ...prevState,
      fiberLines: [...prevState.fiberLines, newLine],
      showModal: false,
      rightClickMarker: null,
      selectedPoint: null,
    }));
  } else if (selectedDevice) {
    if (type === "OLT" || type === "ONU") {
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

  // const handleDeviceFormSubmit = async (e) => {
  //   e.preventDefault();
  //   const { deviceFormData, deviceForm, nextNumber } = mapState;
  //   if (!deviceFormData) {
  //     console.error("No deviceFormData available");
  //     alert("Error: Device form data is missing.");
  //     return;
  //   }

  //   // Validate form inputs
  //   if (!deviceForm.deviceName.trim()) {
  //     alert("Device name is required.");
  //     return;
  //   }
  //   if (!deviceForm.description.trim()) {
  //     alert("Description is required.");
  //     return;
  //   }
  //   if (!deviceForm.deviceModelId) {
  //     alert("Device model ID is required.");
  //     return;
  //   }
  //   if (deviceForm.ports.some((port) => !port.name.trim())) {
  //     alert("All port names are required.");
  //     return;
  //   }
  //   if (!deviceForm.name.trim()) {
  //     alert(`${deviceFormData.type} name is required.`);
  //     return;
  //   }
  //   if (deviceFormData.type === "OLT") {
  //     if (!deviceForm.hostname.trim()) {
  //       alert("Hostname is required for OLT.");
  //       return;
  //     }
  //     if (!deviceForm.community.trim()) {
  //       alert("Community is required for OLT.");
  //       return;
  //     }
  //   }

  //   try {
  //     const payload = {
  //       device: {
  //         name: deviceForm.deviceName,
  //         description: deviceForm.description,
  //         device_type_id: deviceFormData.device.id,
  //         device_model_id: parseInt(deviceForm.deviceModelId),
  //         latitude: deviceFormData.lat,
  //         longitude: deviceFormData.lng,
  //         ports: deviceForm.ports.map((port) => ({
  //           name: port.name,
  //           position: port.position,
  //         })),
  //       },
  //       name: deviceForm.name,
  //       ...(deviceFormData.type === "OLT" && {
  //         hostname: deviceForm.hostname,
  //         community: deviceForm.community,
  //       }),
  //     };

  //     const endpoint =
  //       deviceFormData.type === "OLT"
  //         ? "http://127.0.0.1:8000/api/v1/olt"
  //         : "http://127.0.0.1:8000/api/v1/onu";

  //     console.log("Sending payload to", endpoint, ":", payload);

  //     const response = await fetch(endpoint, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify(payload),
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(
  //         `Failed to create ${deviceFormData.type}: ${
  //           errorData.message || response.statusText
  //         }`
  //       );
  //     }

  //     const deviceData = await response.json();
  //     console.log("API response:", {
  //       deviceData,
  //       createdDeviceId: deviceData.device_id,
  //       createdPortIds: deviceData.ports
  //         ? deviceData.ports.map((port) => port.id)
  //         : [],
  //     });

  //     const createdDeviceId = deviceData.device_id;
  //     const createdPortIds = deviceData.ports
  //       ? deviceData.ports.map((port) => port.id)
  //       : [];

  //     setMapState((prevState) => {
  //       if (
  //         isNaN(deviceFormData.lat) ||
  //         isNaN(deviceFormData.lng) ||
  //         deviceFormData.lat === null ||
  //         deviceFormData.lng === null
  //       ) {
  //         console.error("Invalid coordinates:", {
  //           lat: deviceFormData.lat,
  //           lng: deviceFormData.lng,
  //         });
  //         alert("Error: Invalid coordinates for device placement.");
  //         return prevState;
  //       }

  //       const newIcon = {
  //         lat: deviceFormData.lat,
  //         lng: deviceFormData.lng,
  //         type: deviceFormData.type,
  //         id: `icon-api-${createdDeviceId}`,
  //         imageUrl: deviceFormData.imageUrl || "/img/default-icon.png",
  //         splitterRatio: null,
  //         name: null,
  //         nextLineNumber: null,
  //         deviceId: createdDeviceId,
  //         portIds: createdPortIds,
  //       };

  //       const newState = {
  //         ...prevState,
  //         showDeviceForm: false,
  //         deviceFormData: null,
  //         deviceForm: {
  //           deviceName: "",
  //           description: "",
  //           deviceModelId: "",
  //           ports: [
  //             { name: "", position: 1 },
  //             { name: "", position: 2 },
  //           ],
  //           name: "",
  //           hostname: "",
  //           community: "",
  //         },
  //         imageIcons: [...prevState.imageIcons, newIcon],
  //         nextNumber: nextNumber + 1,
  //         rightClickMarker: null,
  //       };

  //       console.log("New imageIcons:", newState.imageIcons);
  //       return newState;
  //     });
  //   } catch (error) {
  //     console.error(`Error creating ${deviceFormData.type}:`, error);
  //     alert(`Failed to create ${deviceFormData.type}: ${error.message}`);
  //   }
  // };

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

    const endpoint =
      deviceFormData.type === "OLT"
        ? "http://127.0.0.1:8000/api/v1/olt"
        : "http://127.0.0.1:8000/api/v1/onu";

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

      const newIcon = {
        lat: deviceFormData.lat,
        lng: deviceFormData.lng,
        type: deviceFormData.type,
        id: `icon-api-${createdDeviceId}`,
        imageUrl: deviceFormData.imageUrl || "/img/default-icon.png",
        splitterRatio: null,
        name: null,
        nextLineNumber: null,
        deviceId: createdDeviceId,
        portIds: createdPortIds,
      };

      console.log("New Icon:", newIcon);

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
        imageIcons: [...prevState.imageIcons, newIcon],
        nextNumber: nextNumber + 1,
        rightClickMarker: null,
      };

      console.log("New imageIcons:", newState.imageIcons);
      return newState;
    });
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

  // Fetch devices on component mount
  // useEffect(() => {
  //   const fetchDevices = async () => {
  //     try {
  //       console.log(
  //         "Fetching devices from http://127.0.0.1:8000/api/v1/devices"
  //       );
  //       const response = await fetch("http://127.0.0.1:8000/api/v1/devices");
  //       if (!response.ok) {
  //         throw new Error(`HTTP error! Status: ${response.status}`);
  //       }
  //       const devices = await response.json();
  //       console.log("API Response - Devices:", devices);

  //       // Map devices to imageIcons format
  //       const fetchedIcons = devices
  //         .filter((device) => {
  //           const hasValidCoords =
  //             device.latitude != null &&
  //             device.longitude != null &&
  //             !isNaN(device.latitude) &&
  //             !isNaN(device.longitude);
  //           if (!hasValidCoords) {
  //             console.warn(
  //               `Skipping device ${device.name} with invalid coordinates: lat=${device.latitude}, lng=${device.longitude}`
  //             );
  //           }
  //           return hasValidCoords;
  //         })
  //         .map((device) => {
  //           const icon = {
  //             lat: device.latitude,
  //             lng: device.longitude,
  //             type: device.device_type.name,
  //             id: `icon-api-${device.id}`,
  //             imageUrl: device.device_type.icon || "/img/default-icon.png",
  //             splitterRatio: device.device_type.name === "Splitter" ? "" : null,
  //             name: device.device_type.name === "Splitter" ? "" : null,
  //             nextLineNumber: device.device_type.name === "Splitter" ? 1 : null,
  //             deviceId: device.id,
  //             portIds: device.port_device.map((port) => port.id),
  //           };
  //           console.log("Mapped Icon:", icon);
  //           return icon;
  //         });

  //       console.log("Fetched Icons for imageIcons:", fetchedIcons);

  //       setMapState((prevState) => {
  //         console.log("Updating imageIcons state with:", fetchedIcons);
  //         return {
  //           ...prevState,
  //           imageIcons: fetchedIcons,
  //           nextNumber: fetchedIcons.length + 1,
  //         };
  //       });
  //     } catch (error) {
  //       console.error("Error fetching devices:", error.message);
  //       alert("Failed to load devices from the server: " + error.message);
  //     }
  //   };

  //   fetchDevices();
  // }, []);

  useEffect(() => {
  const fetchDevices = async () => {
    try {
      console.log("Fetching devices from http://127.0.0.1:8000/api/v1/devices");
      const response = await fetch("http://127.0.0.1:8000/api/v1/devices");
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const devices = await response.json();
      console.log("API Response - Devices:", devices);

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
        .map((device) => {
          const icon = {
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
          };
          console.log("Mapped Icon:", icon);
          return icon;
        });

      console.log("Fetched Icons for imageIcons:", fetchedIcons);

      setMapState((prevState) => {
        console.log("Updating imageIcons state with:", fetchedIcons);
        return {
          ...prevState,
          imageIcons: fetchedIcons,
          nextNumber: fetchedIcons.length + 1,
        };
      });
    } catch (error) {
      console.error("Error fetching devices:", error.message);
      alert("Failed to load devices from the server: " + error.message);
    }
  };

  fetchDevices();
}, []);

  useEffect(() => {
    console.log("Current imageIcons state:", mapState.imageIcons);
  }, [mapState.imageIcons]);

  // New function to handle port selection
  const handlePortSelection = (e) => {
    e.preventDefault();
    const { selectedPortId, portDropdownEnd, tempCable } = mapState;
    if (!selectedPortId || !tempCable) return;

    setMapState((prevState) => {
      const updatedLines = [...prevState.fiberLines];
      const lineIndex = updatedLines.findIndex(
        (line) => line.id === tempCable.id
      );
      if (lineIndex === -1) {
        console.error("Fiber line not found:", tempCable.id);
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
      };

      // Check if both start and end ports are selected
      const updatedLine = updatedLines[lineIndex];
      const showSaveCableModal =
        updatedLine.startPortId && updatedLine.endPortId;

      return {
        ...prevState,
        fiberLines: updatedLines,
        showPortDropdown: false,
        portDropdownPosition: null,
        portDropdownDevice: null,
        portDropdownPorts: [],
        selectedPortId: null,
        portDropdownEnd: null,
        tempCable: showSaveCableModal ? null : updatedLine,
        showSaveCableModal,
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

  // Modified addFiberLine to handle port selection
  // Modified addFiberLine to handle port selection and button clicks
  const addFiberLine = () => {
    const { rightClickMarker } = mapState;
    if (!rightClickMarker) {
      console.error("No rightClickMarker set for addFiberLine");
      return;
    }

    console.log("addFiberLine called with rightClickMarker:", rightClickMarker);

    const newFiberLine = {
      id: generateUniqueId(),
      from: { lat: rightClickMarker.lat, lng: rightClickMarker.lng },
      to: {
        lat: rightClickMarker.lat + 0.001, // Slightly offset end point
        lng: rightClickMarker.lng + 0.001,
      },
      waypoints: [],
      createdAt: Date.now(),
      name: "",
      startDeviceId: null, // Do not set until confirmed connection
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
        selectedPoint: null,
        rightClickMarker: null,
        showPortDropdown: false, // Explicitly prevent dropdown
        portDropdownPosition: null,
        portDropdownDevice: null,
        portDropdownPorts: [],
        tempCable: null,
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
        startPortId: null, // Reset until port is selected
        startPortName: null,
      };
      console.log("Updated line:", updatedLines[index]);

      // Show port dropdown only if snapped to a device with ports
      if (
        nearestIcon &&
        nearestIcon.portIds?.length > 0 &&
        Array.isArray(prevState.allPorts)
      ) {
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
            ...prevState,
            fiberLines: updatedLines,
            showPortDropdown: true,
            portDropdownPosition: {
              x: dropdownX,
              y: dropdownY,
            },
            portDropdownDevice: nearestIcon,
            portDropdownPorts: devicePorts,
            portDropdownEnd: "start",
            tempCable: updatedLines[index],
            selectedPortId: null,
          };
        } else {
          console.warn(
            "No matching ports found for device portIds:",
            nearestIcon.portIds
          );
        }
      } else {
        console.log("No port dropdown shown. Conditions:", {
          hasNearestIcon: !!nearestIcon,
          hasPortIds: nearestIcon?.portIds?.length > 0,
          allPortsIsArray: Array.isArray(prevState.allPorts),
        });
      }

      return {
        ...prevState,
        fiberLines: updatedLines,
      };
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

      // Check for termination connection limits
      if (nearestIcon && nearestIcon.type === "Termination") {
        const connectedLines = getConnectedLinesCount(nearestIcon);
        if (connectedLines >= 2 && !isSnappedToIcon(line.to.lat, line.to.lng)) {
          console.warn(
            "Termination box connection limit reached (2 connections)"
          );
          alert("Termination box allows only 2 connections.");
          return prevState;
        }
      }

      // Check for splitter ratio limits
      if (
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
          console.warn(
            `Splitter ratio limit reached (${nearestIcon.splitterRatio})`
          );
          alert(`Splitter ratio limit (${nearestIcon.splitterRatio}) reached.`);
          return prevState;
        }
      }

      updatedLines[index] = {
        ...line,
        to: newTo,
        createdAt: Date.now(),
        endDeviceId: nearestIcon ? nearestIcon.deviceId : null,
        endPortId: null, // Reset until port is selected
        endPortName: null,
      };
      console.log("Updated line:", updatedLines[index]);

      // Show port dropdown only if snapped to a device with ports
      if (
        nearestIcon &&
        nearestIcon.portIds?.length > 0 &&
        Array.isArray(prevState.allPorts)
      ) {
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
            ...prevState,
            fiberLines: updatedLines,
            showPortDropdown: true,
            portDropdownPosition: {
              x: dropdownX,
              y: dropdownY,
            },
            portDropdownDevice: nearestIcon,
            portDropdownPorts: devicePorts,
            portDropdownEnd: "end",
            tempCable: updatedLines[index],
            selectedPortId: null,
          };
        } else {
          console.warn(
            "No matching ports found for device portIds:",
            nearestIcon.portIds
          );
        }
      } else {
        console.log("No port dropdown shown. Conditions:", {
          hasNearestIcon: !!nearestIcon,
          hasPortIds: nearestIcon?.portIds?.length > 0,
          allPortsIsArray: Array.isArray(prevState.allPorts),
        });
      }

      return {
        ...prevState,
        fiberLines: updatedLines,
      };
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
    // try {
    //   const cablesToSave = mapState.isSavedRoutesEditable
    //     ? [...mapState.savedPolylines]
    //     : [...mapState.fiberLines];
    //   const updatedDevices = mapState.updatedDevices;
    //   if (updatedDevices.length > 0) {
    //     const deviceUpdateResults = await Promise.all(
    //       updatedDevices.map(async (device) => {
    //         try {
    //           await updateDevice(device.deviceId, device.lat, device.lng);
    //           return { deviceId: device.deviceId, success: true };
    //         } catch (error) {
    //           console.error(
    //             `Failed to update device ${device.deviceId}:`,
    //             error
    //           );
    //           return { deviceId: device.deviceId, success: false, error };
    //         }
    //       })
    //     );
    //     const failedUpdates = deviceUpdateResults.filter(
    //       (result) => !result.success
    //     );
    //     if (failedUpdates.length > 0) {
    //       console.warn("Some device updates failed:", failedUpdates);
    //       alert(
    //         `Some devices failed to update: ${failedUpdates
    //           .map((f) => `Device ${f.deviceId}: ${f.error.message}`)
    //           .join(", ")}`
    //       );
    //     }
    //   }
    //   if (cablesToSave.length > 0) {
    //     const savedCables = await Promise.all(
    //       cablesToSave.map((line) =>
    //         saveCable({
    //           ...line,
    //           startPortId: line.startPortId || line.fromPortId, // Handle both fiberLines and savedPolylines
    //           endPortId: line.endPortId || line.toPortId,
    //         })
    //       )
    //     );
    //     console.log("All cables processed:", savedCables);
    //   } else {
    //     console.log("No cables to save.");
    //   }
    //   const response = await fetch("http://127.0.0.1:8000/api/cables/");
    //   if (!response.ok) {
    //     throw new Error("Failed to fetch updated cables");
    //   }
    //   const cables = await response.json();
    //   const fetchedPolylines = cables
    //     .filter((cable) => {
    //       const hasValidCoords =
    //         cable.path &&
    //         cable.path.from &&
    //         cable.path.to &&
    //         !isNaN(parseFloat(cable.path.from.lat)) &&
    //         !isNaN(parseFloat(cable.path.from.lng)) &&
    //         !isNaN(parseFloat(cable.path.to.lat)) &&
    //         !isNaN(parseFloat(cable.path.to.lng));
    //       return hasValidCoords;
    //     })
    //     .map((cable) => ({
    //       id: `cable-${cable.id}`,
    //       name: cable.name || `Cable-${cable.id}`,
    //       from: {
    //         lat: parseFloat(cable.path.from.lat),
    //         lng: parseFloat(cable.path.from.lng),
    //       },
    //       to: {
    //         lat: parseFloat(cable.path.to.lat),
    //         lng: parseFloat(cable.path.to.lng),
    //       },
    //       waypoints: Array.isArray(cable.path.waypoints)
    //         ? cable.path.waypoints
    //             .filter(
    //               (wp) =>
    //                 !isNaN(parseFloat(wp.lat)) && !isNaN(parseFloat(wp.lng))
    //             )
    //             .map((wp) => ({
    //               lat: parseFloat(wp.lat),
    //               lng: parseFloat(wp.lng),
    //             }))
    //         : [],
    //       createdAt: cable.created_at
    //         ? new Date(cable.created_at).getTime()
    //         : Date.now(),
    //       // Note: Port IDs are not fetched from cables; they are managed via interfaces
    //     }));
    //   setMapState((prevState) => ({
    //     ...prevState,
    //     fiberLines: [],
    //     savedPolylines: fetchedPolylines,
    //     showSavedRoutes: true,
    //     isSavedRoutesEditable: false,
    //     updatedDevices: [],
    //   }));
    //   alert("Polylines and devices saved successfully!");
    // } catch (error) {
    //   console.error("Error saving routes or devices:", error);
    //   alert(`Failed to save routes or devices: ${error.message}`);
    // }
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
              draggable={isDraggable}
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
            <button className="modal-button" onClick={addFiberLine}>
              Add Fiber
            </button>
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
      {mapState.showPortDropdown && mapState.portDropdownPosition && (
        <>
          {console.log("Attempting to render port dropdown:", {
            showPortDropdown: mapState.showPortDropdown,
            position: mapState.portDropdownPosition,
            device: mapState.portDropdownDevice,
            ports: mapState.portDropdownPorts,
          })}
          <div
            className="port-dropdown-modal"
            style={{
              position: "fixed",
              top: `${mapState.portDropdownPosition.y - 150}px`,
              left: `${mapState.portDropdownPosition.x}px`,
              background: "white",
              padding: "15px",
              borderRadius: "8px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              zIndex: 10000,
              width: "200px",
              border: "2px solid red", // Ensure visibility
            }}
          >
            <h3 className="text-md font-semibold mb-3">
              Select Port for {mapState.portDropdownDevice?.type || "Unknown"} (
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
                  {mapState.portDropdownPorts.map((port) => (
                    <option key={port.id} value={port.id}>
                      {port.name || `Port ${port.position}`}
                    </option>
                  ))}
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
        </>
      )}

      {/* Save Cable Modal */}
      {mapState.showSaveCableModal && mapState.tempCable && (
        <div
          className="save-cable-modal"
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
          <h3 className="text-lg font-semibold mb-4">Save Cable</h3>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setMapState((prevState) => ({
                  ...prevState,
                  showSaveCableModal: false,
                  tempCable: null,
                  startPortId: null,
                  endPortId: null,
                  startPortName: null,
                  endPortName: null,
                  startDeviceId: null,
                  endDeviceId: null,
                }))
              }
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                saveCable(mapState.tempCable)
                  .then(() =>
                    setMapState((prevState) => ({
                      ...prevState,
                      showSaveCableModal: false,
                      tempCable: null,
                      startPortId: null,
                      endPortId: null,
                      startPortName: null,
                      endPortName: null,
                      startDeviceId: null,
                      endDeviceId: null,
                    }))
                  )
                  .catch((error) =>
                    alert(`Failed to save cable: ${error.message}`)
                  )
              }
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default MyMapV19;
