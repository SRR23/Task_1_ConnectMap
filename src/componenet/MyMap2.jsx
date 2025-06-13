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
import { Trash2, Plus, Save, Eye, EyeOff, Lock, Unlock } from "lucide-react";

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

const MyMap = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const mapRef = useRef(null);

  // State variables
  const [savedPolylines, setSavedPolylines] = useState([]);
  const [fiberLines, setFiberLines] = useState([]);
  const [imageIcons, setImageIcons] = useState([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(true);
  const [isSavedRoutesEditable, setIsSavedRoutesEditable] = useState(false);
  const [selectedLineForActions, setSelectedLineForActions] = useState(null);
  const [lineActionPosition, setLineActionPosition] = useState(null);
  const [exactClickPosition, setExactClickPosition] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [rightClickMarker, setRightClickMarker] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showFiberForm, setShowFiberForm] = useState(false);
  const [fiberFormData, setFiberFormData] = useState({
    name: "",
    type: "Fiber",
  });
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [deviceFormData, setDeviceFormData] = useState(null);
  const [deviceForm, setDeviceForm] = useState({
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
  });
  const [showPortDropdown, setShowPortDropdown] = useState(false);
  const [portDropdownPosition, setPortDropdownPosition] = useState(null);
  const [portDropdownDevice, setPortDropdownDevice] = useState(null);
  const [portDropdownPorts, setPortDropdownPorts] = useState([]);
  const [selectedPortId, setSelectedPortId] = useState(null);
  const [portDropdownEnd, setPortDropdownEnd] = useState(null);
  const [tempCable, setTempCable] = useState(null);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceModalPosition, setDeviceModalPosition] = useState(null);
  const [modifiedCables, setModifiedCables] = useState({});
  const [nextNumber, setNextNumber] = useState(1);
  const [allPorts, setAllPorts] = useState([]);
  const [hasEditedCables, setHasEditedCables] = useState(false);
  const [updatedDevices, setUpdatedDevices] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [deviceModels, setDeviceModels] = useState([]);
  const [usedPorts, setUsedPorts] = useState([]);

  // Centralized error handler
  const handleApiError = useCallback((error, message) => {
    console.error(message, error);
    alert(`${message}: ${error.message}`);
  }, []);

  // Fetch device types and models
  useEffect(() => {
    const fetchDeviceTypes = async () => {
      try {
        const response = await fetch(
          "http://localhost:8000/api/v1/device-types"
        );
        if (!response.ok) throw new Error("Failed to fetch device types");
        setDeviceTypes(await response.json());
      } catch (error) {
        handleApiError(error, "Error fetching device types");
      }
    };

    const fetchDeviceModels = async () => {
      try {
        const response = await fetch(
          "http://localhost:8000/api/v1/device-models"
        );
        if (!response.ok) throw new Error("Failed to fetch device models");
        setDeviceModels(await response.json());
      } catch (error) {
        handleApiError(error, "Error fetching device models");
      }
    };

    fetchDeviceTypes();
    fetchDeviceModels();
  }, [handleApiError]);

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:8000/api/v1/devices");
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      const devices = await response.json();

      const ports = devices.flatMap((device) =>
        device.port_device.map((port) => ({
          id: port.id,
          name: port.name,
          position: port.position,
          device_id: device.id,
        }))
      );

      const icons = devices
        .filter((device) => device.latitude != null && device.longitude != null)
        .map((device) => ({
          lat: device.latitude,
          lng: device.longitude,
          type: device.device_type.name,
          id: `icon-api-${device.id}`,
          imageUrl: device.device_type.icon
            ? `http://localhost:8000${device.device_type.icon}`
            : "/img/default-icon.png",
          deviceId: device.id,
          portIds: device.port_device.map((port) => port.id),
        }));

      setImageIcons(icons);
      setAllPorts(ports);
      setNextNumber(icons.length + 1);
      setModifiedCables({});
    } catch (error) {
      handleApiError(error, "Error fetching devices");
    }
  }, [handleApiError]);

  // Fetch cables
  const fetchCables = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:8000/api/v1/interface");
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      const cables = await response.json();

      const polylines = cables
        .filter((cable) => cable.cable?.path?.coords?.length >= 2)
        .map((cable) => {
          const coords = cable.cable.path.coords;
          return {
            id: `cable-${cable.id}`,
            cableId: cable.cable.id,
            name: cable.cable.name || `Cable-${cable.id}`,
            from: {
              lat: parseFloat(coords[0][0]),
              lng: parseFloat(coords[0][1]),
            },
            to: {
              lat: parseFloat(coords[coords.length - 1][0]),
              lng: parseFloat(coords[coords.length - 1][1]),
            },
            waypoints: coords.slice(1, -1).map((coord) => ({
              lat: parseFloat(coord[0]),
              lng: parseFloat(coord[1]),
            })),
            startDeviceId: cable.start.device.id || null,
            endDeviceId: cable.end.device.id || null,
            startPortId: cable.start.id || null,
            endPortId: cable.end.id || null,
            startPortName: cable.start.name || null,
            endPortName: cable.end.name || null,
          };
        });

      const usedPortIds = cables
        .filter((cable) => cable.start?.id || cable.end?.id)
        .flatMap((cable) => [cable.start?.id, cable.end?.id])
        .filter((id) => id != null);
      setUsedPorts([...new Set(usedPortIds)]);

      setSavedPolylines(polylines);
      setModifiedCables({});
    } catch (error) {
      handleApiError(error, "Error fetching cables");
    }
  }, [handleApiError]);

  useEffect(() => {
    fetchDevices();
    fetchCables();
  }, [fetchDevices, fetchCables]);

  // Save all new and edited cables
  const saveAllCables = useCallback(async () => {
    try {
      // Save new fiber lines
      for (const line of fiberLines) {
        if (!line.startPortId || !line.endPortId) {
          alert(`Cable ${line.name} is missing port connections. Skipping...`);
          continue;
        }
        const payload = {
          start: { device_id: line.startDeviceId, port_id: line.startPortId },
          end: { device_id: line.endDeviceId, port_id: line.endPortId },
          cable: {
            name: line.name,
            type: line.type.toLowerCase(),
            path: {
              coords: [
                [line.from.lat, line.from.lng],
                ...(line.waypoints || []).map((wp) => [wp.lat, wp.lng]),
                [line.to.lat, line.to.lng],
              ],
            },
          },
        };
        const response = await fetch("http://localhost:8000/api/v1/interface", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok)
          throw new Error(
            `Failed to save cable ${line.name}: ${response.status}`
          );
        setUsedPorts((prev) => [
          ...prev,
          ...(line.startPortId ? [line.startPortId] : []),
          ...(line.endPortId ? [line.endPortId] : []),
        ]);
      }

      // Save edited cables
      for (const cableId in modifiedCables) {
        const cable = modifiedCables[cableId];
        if (!cable.hasEditedCables) continue;
        const interfaceId = cable.id.split("-")[1];
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
        const response = await fetch(
          `http://localhost:8000/api/v1/interface/${interfaceId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok)
          throw new Error(
            `Failed to update cable ${cable.name}: ${response.status}`
          );
      }

      // Reset states and refresh data
      setFiberLines([]);
      setModifiedCables({});
      setSelectedLineForActions(null);
      setLineActionPosition(null);
      setExactClickPosition(null);
      setTempCable(null);
      setHasEditedCables(false);
      await fetchCables();
      alert("All cables saved successfully!");
    } catch (error) {
      handleApiError(error, "Error saving all cables");
    }
  }, [fiberLines, modifiedCables, fetchCables, handleApiError]);

  // Delete saved polyline
  const removeSavedSelectedLine = useCallback(async () => {
    if (!selectedLineForActions || !isSavedRoutesEditable) return;
    const { index, isSavedLine } = selectedLineForActions;
    if (!isSavedLine) return;

    const line = savedPolylines[index];
    try {
      const response = await fetch(
        `http://localhost:8000/api/v1/interface/${line.cableId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (!response.ok)
        throw new Error(`Failed to delete cable: ${response.status}`);

      setUsedPorts((prev) =>
        prev.filter(
          (portId) => portId !== line.startPortId && portId !== line.endPortId
        )
      );

      setSavedPolylines((prev) => prev.filter((_, i) => i !== index));
      setModifiedCables((prev) => {
        const updated = { ...prev };
        delete updated[line.id];
        return updated;
      });
      setSelectedLineForActions(null);
      setLineActionPosition(null);
      setExactClickPosition(null);
      alert("Line deleted successfully!");
    } catch (error) {
      handleApiError(error, "Error deleting line");
    }
  }, [
    selectedLineForActions,
    isSavedRoutesEditable,
    savedPolylines,
    handleApiError,
  ]);

  // Check if interaction is allowed
  const isInteractionAllowed = useCallback(
    (isSavedLine) => !isSavedLine || isSavedRoutesEditable,
    [isSavedRoutesEditable]
  );

  // Find nearest icon
  const findNearestIcon = useCallback(
    (lat, lng) => {
      const threshold = 0.0001;
      return imageIcons.find(
        (icon) =>
          Math.abs(icon.lat - lat) < threshold &&
          Math.abs(icon.lng - lng) < threshold
      );
    },
    [imageIcons]
  );

  const isSnappedToIcon = useCallback(
    (lat, lng) => !!findNearestIcon(lat, lng),
    [findNearestIcon]
  );

  // Handle map right-click
  const handleMapRightClick = useCallback((e) => {
    e.domEvent.preventDefault();
    const clickedPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
      x: e.domEvent.clientX,
      y: e.domEvent.clientY,
    };
    setSelectedPoint(clickedPoint);
    setRightClickMarker(clickedPoint);
    setShowModal(true);
    setModifiedCables((prev) => ({ ...prev }));
  }, []);

  // Handle device or fiber selection
  const handleSelection = useCallback(
    (type, icon) => {
      if (!selectedPoint) return;

      const validImageUrl = icon?.startsWith("/media/")
        ? `http://127.0.0.1:8000${icon}`
        : icon || "/img/default-icon.png";

      const selectedDevice = deviceTypes.find((device) => device.name === type);

      if (type === "Add Fiber") {
        setShowModal(false);
        setRightClickMarker(selectedPoint);
        setShowFiberForm(true);
        setFiberFormData({ name: "", type: "Fiber" });
      } else if (selectedDevice) {
        setShowModal(false);
        setRightClickMarker(null);
        setShowDeviceForm(true);
        setDeviceFormData({
          device: selectedDevice,
          lat: selectedPoint.lat,
          lng: selectedPoint.lng,
          nextNumber,
          type,
          imageUrl: validImageUrl,
        });
        setDeviceForm({
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
        });
      } else {
        setShowModal(false);
        setRightClickMarker(null);
        setSelectedPoint(null);
        alert(`Device type "${type}" not found.`);
      }
    },
    [selectedPoint, deviceTypes, nextNumber]
  );

  // Handle device form submission
  const handleDeviceFormSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!deviceFormData) return;

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
          OLT: "http://localhost:8000/api/v1/olt",
          ONU: "http://localhost:8000/api/v1/onu",
          Splitter: "http://localhost:8000/api/v1/splitter",
        };

        const endpoint = endpointMap[deviceFormData.type];
        if (!endpoint)
          throw new Error(`Invalid device type: ${deviceFormData.type}`);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok)
          throw new Error(`Failed to create ${deviceFormData.type}`);
        await fetchDevices();

        setShowDeviceForm(false);
        setDeviceFormData(null);
        setDeviceForm({
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
        });
        setRightClickMarker(null);
        alert(`${deviceFormData.type} created successfully!`);
      } catch (error) {
        handleApiError(error, `Error creating ${deviceFormData.type}`);
      }
    },
    [deviceFormData, deviceForm, fetchDevices, handleApiError]
  );

  // Handle device form input changes
  const handleDeviceFormInputChange = useCallback((field, value) => {
    setDeviceForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Handle port changes
  const handlePortChange = useCallback((index, field, value) => {
    setDeviceForm((prev) => {
      const updatedPorts = [...prev.ports];
      updatedPorts[index] = {
        ...updatedPorts[index],
        [field]: field === "position" ? parseInt(value) : value,
      };
      return { ...prev, ports: updatedPorts };
    });
  }, []);

  // Add port
  const addPort = useCallback(() => {
    setDeviceForm((prev) => ({
      ...prev,
      ports: [...prev.ports, { name: "", position: prev.ports.length + 1 }],
    }));
  }, []);

  // Remove port
  const removePort = useCallback((index) => {
    setDeviceForm((prev) => {
      const updatedPorts = prev.ports
        .filter((_, i) => i !== index)
        .map((port, i) => ({ ...port, position: i + 1 }));
      return { ...prev, ports: updatedPorts };
    });
  }, []);

  // Handle port selection
  const handlePortSelection = useCallback(
    (e) => {
      e.preventDefault();
      if (!selectedPortId || !tempCable) return;

      setFiberLines((prev) => {
        const updatedLines = [...prev];
        const lineIndex = updatedLines.findIndex(
          (line) => line.id === tempCable.id
        );
        if (lineIndex === -1) return prev;

        const selectedPort = allPorts.find(
          (port) => port.id === parseInt(selectedPortId)
        );
        updatedLines[lineIndex] = {
          ...updatedLines[lineIndex],
          [portDropdownEnd === "start" ? "startPortId" : "endPortId"]:
            selectedPortId,
          [portDropdownEnd === "start" ? "startPortName" : "endPortName"]:
            selectedPort?.name || `Port-${selectedPortId}`,
          [portDropdownEnd === "start" ? "startDeviceId" : "endDeviceId"]:
            portDropdownDevice?.deviceId || null,
        };

        return updatedLines;
      });

      setShowPortDropdown(false);
      setPortDropdownPosition(null);
      setPortDropdownDevice(null);
      setPortDropdownPorts([]);
      setSelectedPortId(null);
      setPortDropdownEnd(null);
      setTempCable(null);
    },
    [selectedPortId, tempCable, allPorts, portDropdownEnd, portDropdownDevice]
  );

  // Handle port dropdown change
  const handlePortDropdownChange = useCallback((portId) => {
    setSelectedPortId(portId);
  }, []);

  // Close port dropdown
  const closePortDropdown = useCallback(() => {
    setShowPortDropdown(false);
    setPortDropdownPosition(null);
    setPortDropdownDevice(null);
    setPortDropdownPorts([]);
    setSelectedPortId(null);
    setPortDropdownEnd(null);
    setTempCable(null);
  }, []);

  // Handle right-click on icon
  const handleRightClickOnIcon = useCallback(
    (icon, e) => {
      if (e.domEvent.button !== 2) return;
      e.domEvent.preventDefault();
      e.domEvent.stopPropagation();

      if (icon.id.startsWith("icon-api-") && !isSavedRoutesEditable) return;

      setSelectedPoint({
        ...icon,
        x: e.domEvent.clientX,
        y: e.domEvent.clientY,
      });
      setRightClickMarker(icon);
      setShowModal(true);
    },
    [isSavedRoutesEditable]
  );

  // Handle line click
  const handleLineClick = useCallback(
    (line, index, isSavedLine, e) => {
      if (isSavedLine && !isSavedRoutesEditable) return;

      e.domEvent.stopPropagation();
      e.domEvent.preventDefault();

      const clickedLatLng = e.latLng;
      const x = e.domEvent.clientX;
      const y = e.domEvent.clientY;

      setSelectedLineForActions({ line, index, isSavedLine });
      setLineActionPosition({
        lat: clickedLatLng.lat(),
        lng: clickedLatLng.lng(),
        x,
        y,
      });
      setExactClickPosition({
        lat: clickedLatLng.lat(),
        lng: clickedLatLng.lng(),
        x,
        y,
      });

      setModifiedCables((prev) => ({ ...prev }));
    },
    [isSavedRoutesEditable]
  );

  // Add waypoint
  const addWaypoint = useCallback(() => {
    if (
      !selectedLineForActions ||
      !isInteractionAllowed(selectedLineForActions.isSavedLine) ||
      !exactClickPosition
    )
      return;
    const { line, index, isSavedLine } = selectedLineForActions;
    const clickPoint = {
      lat: exactClickPosition.lat,
      lng: exactClickPosition.lng,
    };

    const getDistanceToSegment = (point, start, end) => {
      const dx = end.lng - start.lng;
      const dy = end.lat - start.lat;
      const lenSquared = dx * dx + dy * dy;
      if (lenSquared === 0)
        return Math.sqrt(
          (point.lat - start.lat) ** 2 + (point.lng - start.lng) ** 2
        );

      let t =
        ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) /
        lenSquared;
      t = Math.max(0, Math.min(1, t));
      const projection = {
        lat: start.lat + t * dy,
        lng: start.lng + t * dx,
      };
      return Math.sqrt(
        (point.lat - projection.lat) ** 2 + (point.lng - projection.lng) ** 2
      );
    };

    const baseCable =
      isSavedLine && modifiedCables[line.id] ? modifiedCables[line.id] : line;
    const fullPath = [
      baseCable.from,
      ...(baseCable.waypoints || []),
      baseCable.to,
    ];

    let minDistance = Infinity;
    let insertIndex = 0;
    for (let i = 0; i < fullPath.length - 1; i++) {
      const distance = getDistanceToSegment(
        clickPoint,
        fullPath[i],
        fullPath[i + 1]
      );
      if (distance < minDistance) {
        minDistance = distance;
        insertIndex = i + 1;
      }
    }

    if (isSavedLine) {
      setModifiedCables((prev) => {
        const updatedWaypoints = [...(baseCable.waypoints || [])];
        updatedWaypoints.splice(insertIndex - 1, 0, clickPoint);
        return {
          ...prev,
          [line.id]: {
            ...baseCable,
            waypoints: updatedWaypoints,
            hasEditedCables: true,
          },
        };
      });
      setHasEditedCables(true);
    } else {
      setFiberLines((prev) => {
        const updatedLines = [...prev];
        const updatedWaypoints = updatedLines[index].waypoints
          ? [...updatedLines[index].waypoints]
          : [];
        updatedWaypoints.splice(insertIndex - 1, 0, clickPoint);
        updatedLines[index] = {
          ...updatedLines[index],
          waypoints: updatedWaypoints,
        };
        return updatedLines;
      });
    }

    setSelectedLineForActions(null);
    setLineActionPosition(null);
    setExactClickPosition(null);
  }, [
    selectedLineForActions,
    isInteractionAllowed,
    exactClickPosition,
    modifiedCables,
  ]);

  // Handle icon click
  const handleIconClick = useCallback((icon, e) => {
    if (e.domEvent.button !== 0) return;
    e.domEvent.preventDefault();
    e.domEvent.stopPropagation();

    setShowDeviceModal(true);
    setSelectedDevice(icon);
    setDeviceModalPosition({ x: e.domEvent.clientX, y: e.domEvent.clientY });
    setSelectedLineForActions(null);
    setLineActionPosition(null);
    setExactClickPosition(null);
    setShowModal(false);
  }, []);

  // Remove selected icon
  const removeSelectedIcon = useCallback(async () => {
    if (!selectedDevice) return;
    const iconId = selectedDevice.id;
    const isApiDevice = iconId.startsWith("icon-api-");
    const deviceId = isApiDevice ? iconId.split("-")[2] : iconId;

    try {
      if (isApiDevice) {
        const endpointMap = {
          OLT: `http://localhost:8000/api/v1/olt/${deviceId}`,
          ONU: `http://localhost:8000/api/v1/onu/${deviceId}`,
          Splitter: `http://localhost:8000/api/v1/splitter/${deviceId}`,
        };
        const endpoint = endpointMap[selectedDevice.type];
        if (!endpoint) throw new Error(`Invalid device type`);

        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });
        if (!response.ok) throw new Error(`Failed to delete device`);
      }

      setImageIcons((prev) => prev.filter((icon) => icon.id !== iconId));
      setShowDeviceModal(false);
      setSelectedDevice(null);
      setDeviceModalPosition(null);
      setUpdatedDevices((prev) =>
        prev.filter((device) => device.deviceId !== deviceId)
      );
      alert("Device removed successfully!");
    } catch (error) {
      handleApiError(error, "Error removing device");
    }
  }, [selectedDevice, handleApiError]);

  // Save device changes
  const saveDeviceChanges = useCallback(async () => {
    if (!selectedDevice) return;

    try {
      if (selectedDevice.id.startsWith("icon-api-")) {
        const deviceId = selectedDevice.id.split("-")[2];
        const payload = {
          latitude: selectedDevice.lat,
          longitude: selectedDevice.lng,
        };
        const endpointMap = {
          OLT: `http://localhost:8000/api/v1/olt/${deviceId}`,
          ONU: `http://localhost:8000/api/v1/onu/${deviceId}`,
          Splitter: `http://localhost:8000/api/v1/splitter/${deviceId}`,
        };
        const endpoint = endpointMap[selectedDevice.type];
        if (!endpoint) throw new Error(`Invalid device type`);

        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Failed to update device`);

        setImageIcons((prev) =>
          prev.map((icon) =>
            icon.id === selectedDevice.id ? { ...icon } : icon
          )
        );
        setSavedPolylines((prev) =>
          prev.map((polyline) => {
            let updatedPolyline = { ...polyline };
            if (
              polyline.startDeviceId === selectedDevice.deviceId &&
              isSnappedToIcon(polyline.from.lat, polyline.from.lng)
            ) {
              updatedPolyline.from = {
                lat: selectedDevice.lat,
                lng: selectedDevice.lng,
              };
            }
            if (
              polyline.endDeviceId === selectedDevice.deviceId &&
              isSnappedToIcon(polyline.to.lat, polyline.to.lng)
            ) {
              updatedPolyline.to = {
                lat: selectedDevice.lat,
                lng: selectedDevice.lng,
              };
            }
            if (polyline.waypoints) {
              updatedPolyline.waypoints = polyline.waypoints.map((wp) =>
                isSnappedToIcon(wp.lat, wp.lng) &&
                findNearestIcon(wp.lat, wp.lng)?.deviceId ===
                  selectedDevice.deviceId
                  ? { lat: selectedDevice.lat, lng: selectedDevice.lng }
                  : wp
              );
            }
            return updatedPolyline;
          })
        );
        setModifiedCables((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((cableId) => {
            const cable = updated[cableId];
            if (
              cable.startDeviceId === selectedDevice.deviceId &&
              isSnappedToIcon(cable.from.lat, cable.from.lng)
            ) {
              updated[cableId] = {
                ...cable,
                from: { lat: selectedDevice.lat, lng: selectedDevice.lng },
              };
            }
            if (
              cable.endDeviceId === selectedDevice.deviceId &&
              isSnappedToIcon(cable.to.lat, cable.to.lng)
            ) {
              updated[cableId] = {
                ...cable,
                to: { lat: selectedDevice.lat, lng: selectedDevice.lng },
              };
            }
            if (cable.waypoints) {
              updated[cableId] = {
                ...cable,
                waypoints: cable.waypoints.map((wp) =>
                  isSnappedToIcon(wp.lat, wp.lng) &&
                  findNearestIcon(wp.lat, wp.lng)?.deviceId ===
                    selectedDevice.deviceId
                    ? { lat: selectedDevice.lat, lng: selectedDevice.lng }
                    : wp
                ),
              };
            }
          });
          return updated;
        });
        setShowDeviceModal(false);
        setSelectedDevice(null);
        setDeviceModalPosition(null);
        setUpdatedDevices((prev) =>
          prev.filter(
            (device) => device.deviceId !== selectedDevice.id.split("-")[2]
          )
        );
        alert("Device saved successfully!");
      }
    } catch (error) {
      handleApiError(error, "Error saving device");
    }
  }, [selectedDevice, isSnappedToIcon, findNearestIcon, handleApiError]);

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(
    (iconId, e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();

      setImageIcons((prev) => {
        const draggedIcon = prev.find((icon) => icon.id === iconId);
        const updatedIcons = prev.map((icon) =>
          icon.id === iconId ? { ...icon, lat: newLat, lng: newLng } : icon
        );

        setUpdatedDevices((prevDevices) => {
          const deviceId = iconId.startsWith("icon-api-")
            ? iconId.split("-")[2]
            : iconId;
          const existingUpdateIndex = prevDevices.findIndex(
            (device) => device.deviceId === deviceId
          );
          const updated = [...prevDevices];
          if (existingUpdateIndex !== -1) {
            updated[existingUpdateIndex] = {
              deviceId,
              lat: newLat,
              lng: newLng,
            };
          } else {
            updated.push({ deviceId, lat: newLat, lng: newLng });
          }
          return updated;
        });

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

        setFiberLines((prevLines) => updateLines(prevLines));
        setModifiedCables((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((cableId) => {
            updated[cableId] = updateLines([updated[cableId]])[0];
          });
          return updated;
        });
        setSavedPolylines((prev) => updateLines(prev));
        setHasEditedCables((prev) => true);

        return updatedIcons;
      });
    },
    [isSnappedToIcon]
  );

  // Generate unique ID
  const generateUniqueId = useCallback(
    () => `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    []
  );

  // Add fiber line
  const addFiberLine = useCallback(() => {
    if (
      !rightClickMarker ||
      !fiberFormData.name.trim() ||
      !fiberFormData.type.trim()
    ) {
      alert("Fiber name and type are required.");
      return;
    }

    const newFiberLine = {
      id: generateUniqueId(),
      from: { lat: rightClickMarker.lat, lng: rightClickMarker.lng },
      to: {
        lat: rightClickMarker.lat + 0.001,
        lng: rightClickMarker.lng + 0.001,
      },
      waypoints: [],
      createdAt: Date.now(),
      name: fiberFormData.name,
      type: fiberFormData.type,
      startDeviceId: null,
      endDeviceId: null,
      startPortId: null,
      endPortId: null,
      startPortName: null,
      endPortName: null,
    };

    setFiberLines((prev) => [...prev, newFiberLine]);
    setShowModal(false);
    setShowFiberForm(false);
    setSelectedPoint(null);
    setRightClickMarker(null);
    setFiberFormData({ name: "", type: "Fiber" });
    setTempCable(newFiberLine);
  }, [rightClickMarker, fiberFormData, generateUniqueId]);

  // Handle start marker drag end
  const handleStartMarkerDragEnd = useCallback(
    (index, e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      const nearestIcon = findNearestIcon(newLat, newLng);

      setFiberLines((prev) => {
        const updatedLines = [...prev];
        const line = updatedLines[index];
        if (!line) return prev;

        const newFrom = nearestIcon
          ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
          : { lat: newLat, lng: newLng };
        updatedLines[index] = {
          ...line,
          from: newFrom,
          startDeviceId: nearestIcon?.deviceId || null,
          startPortId: null,
          startPortName: null,
        };

        if (nearestIcon?.portIds?.length > 0) {
          const devicePorts = allPorts.filter(
            (port) =>
              nearestIcon.portIds.includes(port.id) &&
              !usedPorts.includes(port.id)
          );
          if (devicePorts.length > 0) {
            setShowPortDropdown(true);
            setPortDropdownPosition({
              x: e.domEvent?.clientX || window.innerWidth / 2,
              y: e.domEvent?.clientY || window.innerHeight / 2,
            });
            setPortDropdownDevice(nearestIcon);
            setPortDropdownPorts(devicePorts);
            setPortDropdownEnd("start");
            setTempCable(updatedLines[index]);
          }
        } else {
          setShowPortDropdown(false);
          setPortDropdownPosition(null);
          setPortDropdownDevice(null);
          setPortDropdownPorts([]);
          setSelectedPortId(null);
          setTempCable(null);
        }
        return updatedLines;
      });
    },
    [findNearestIcon, allPorts, usedPorts]
  );

  // Handle end marker drag end
  const handleEndMarkerDragEnd = useCallback(
    (index, e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      const nearestIcon = findNearestIcon(newLat, newLng);

      setFiberLines((prev) => {
        const updatedLines = [...prev];
        const line = updatedLines[index];
        if (!line) return prev;

        const newTo = nearestIcon
          ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
          : { lat: newLat, lng: newLng };
        updatedLines[index] = {
          ...line,
          to: newTo,
          endDeviceId: nearestIcon?.deviceId || null,
          endPortId: null,
          endPortName: null,
        };

        if (nearestIcon?.portIds?.length > 0) {
          const devicePorts = allPorts.filter(
            (port) =>
              nearestIcon.portIds.includes(port.id) &&
              !usedPorts.includes(port.id)
          );
          if (devicePorts.length > 0) {
            setShowPortDropdown(true);
            setPortDropdownPosition({
              x: e.domEvent?.clientX || window.innerWidth / 2,
              y: e.domEvent?.clientY || window.innerHeight / 2,
            });
            setPortDropdownDevice(nearestIcon);
            setPortDropdownPorts(devicePorts);
            setPortDropdownEnd("end");
            setTempCable(updatedLines[index]);
          }
        } else {
          setShowPortDropdown(false);
          setPortDropdownPosition(null);
          setPortDropdownDevice(null);
          setPortDropdownPorts([]);
          setSelectedPortId(null);
          setTempCable(null);
        }
        return updatedLines;
      });
    },
    [findNearestIcon, allPorts, usedPorts]
  );

  // Handle waypoint drag end
  const handleWaypointDragEnd = useCallback(
    (lineIndex, waypointIndex, e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      const nearestIcon = findNearestIcon(newLat, newLng);

      setFiberLines((prev) => {
        const updatedLines = [...prev];
        const line = updatedLines[lineIndex];
        const newWaypoint = nearestIcon
          ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
          : { lat: newLat, lng: newLng };

        updatedLines[lineIndex] = {
          ...line,
          waypoints: line.waypoints.map((wp, idx) =>
            idx === waypointIndex ? newWaypoint : wp
          ),
        };

        setTempCable(null);
        return updatedLines;
      });
    },
    [findNearestIcon]
  );

  // Handle saved polyline point drag end
  const handleSavedPolylinePointDragEnd = useCallback(
    (polylineId, pointType, e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      const nearestIcon = findNearestIcon(newLat, newLng);

      setModifiedCables((prev) => {
        const baseCable =
          prev[polylineId] || savedPolylines.find((p) => p.id === polylineId);
        if (!baseCable) return prev;

        return {
          ...prev,
          [polylineId]: {
            ...baseCable,
            [pointType]: nearestIcon
              ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
              : { lat: newLat, lng: newLng },
            [`${pointType}DeviceId`]: nearestIcon?.deviceId || null,
            [`${pointType}PortId`]: nearestIcon?.portIds?.[0] || null,
            hasEditedCables: true,
          },
        };
      });
      setHasEditedCables(true);
    },
    [findNearestIcon, savedPolylines]
  );

  // Handle saved polyline waypoint drag end
  const handleSavedPolylineWaypointDragEnd = useCallback(
    (polylineId, waypointIndex, e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      const nearestIcon = findNearestIcon(newLat, newLng);

      setModifiedCables((prev) => {
        const baseCable =
          prev[polylineId] || savedPolylines.find((p) => p.id === polylineId);
        if (!baseCable || !baseCable.waypoints) return prev;

        const newWaypoint = nearestIcon
          ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
          : { lat: newLat, lng: newLng };
        return {
          ...prev,
          [polylineId]: {
            ...baseCable,
            waypoints: baseCable.waypoints.map((wp, idx) =>
              idx === waypointIndex ? newWaypoint : wp
            ),
            hasEditedCables: true,
          },
        };
      });
      setHasEditedCables(true);
    },
    [findNearestIcon, savedPolylines]
  );

  // Map load handler
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  if (loadError)
    return (
      <div className="text-danger text-center p-4">Error loading maps</div>
    );
  if (!isLoaded)
    return (
      <div className="text-secondary text-center p-4">Loading Maps...</div>
    );

  return (
    <>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={7}
        onRightClick={handleMapRightClick}
        options={{ styles: mapStyles, disableDefaultUI: false }}
        onLoad={onMapLoad}
      >
        {imageIcons.map((icon) => (
          <MarkerF
            key={icon.id}
            position={{ lat: icon.lat, lng: icon.lng }}
            draggable={isSavedRoutesEditable}
            icon={{
              url: icon.imageUrl || "/img/default-icon.png",
              scaledSize: new window.google.maps.Size(30, 30),
              anchor: new window.google.maps.Point(15, 15),
            }}
            onDragEnd={(e) => handleMarkerDragEnd(icon.id, e)}
            onRightClick={(e) => handleRightClickOnIcon(icon, e)}
            onClick={(e) => handleIconClick(icon, e)}
          />
        ))}

        {rightClickMarker && (
          <MarkerF
            key={`right-click-${rightClickMarker.lat}-${rightClickMarker.lng}`}
            position={rightClickMarker}
            icon={{
              url: "/img/location.jpg",
              scaledSize: new window.google.maps.Size(20, 20),
            }}
          />
        )}

        {fiberLines.map((line, index) => {
          const fullPath = [line.from, ...(line.waypoints || []), line.to];
          return (
            <React.Fragment key={line.id}>
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
              {selectedLineForActions &&
                exactClickPosition &&
                !selectedLineForActions.isSavedLine &&
                selectedLineForActions.index === index && (
                  <div
                    className="line-action-modal"
                    style={{
                      top: `${exactClickPosition.y - 95}px`,
                      left: `${exactClickPosition.x}px`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="line-action-item" onClick={addWaypoint}>
                      <Plus size={20} className="text-gray-600" />
                      <span className="line-action-tooltip">Add Waypoint</span>
                    </div>
                    <div
                      className="line-action-item"
                      onClick={() =>
                        setFiberLines((prev) =>
                          prev.filter((_, i) => i !== index)
                        ) ||
                        setSelectedLineForActions(null) ||
                        setLineActionPosition(null) ||
                        setExactClickPosition(null)
                      }
                    >
                      <Trash2 size={20} className="text-red-500" />
                      <span className="line-action-tooltip">Delete Line</span>
                    </div>
                    <div
                      className="line-action-item"
                      onClick={() =>
                        setSelectedLineForActions(null) ||
                        setLineActionPosition(null) ||
                        setExactClickPosition(null)
                      }
                    >
                      <span className="line-action-close">×</span>
                      <span className="line-action-tooltip">Close</span>
                    </div>
                    <div className="modal-spike"></div>
                  </div>
                )}
              {(line.waypoints || []).map((waypoint, waypointIndex) => (
                <MarkerF
                  key={`waypoint-${line.id}-${waypointIndex}-${waypoint.lat}-${waypoint.lng}`}
                  position={waypoint}
                  draggable={true}
                  onDragEnd={(e) =>
                    handleWaypointDragEnd(index, waypointIndex, e)
                  }
                  icon={{
                    url: "/img/location.jpg",
                    scaledSize: new window.google.maps.Size(15, 15),
                  }}
                />
              ))}
              {!isSnappedToIcon(line.from.lat, line.from.lng) && (
                <MarkerF
                  key={`start-${line.id}`}
                  position={line.from}
                  draggable={true}
                  onDragEnd={(e) => handleStartMarkerDragEnd(index, e)}
                  icon={{
                    url: "/img/location.jpg",
                    scaledSize: new window.google.maps.Size(20, 20),
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
                    scaledSize: new window.google.maps.Size(20, 20),
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

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
                <PolylineF
                  path={fullPath}
                  options={{
                    strokeColor: "#FF0000",
                    strokeOpacity: 1.0,
                    strokeWeight: 2,
                  }}
                  onClick={(e) => handleLineClick(polyline, index, true, e)}
                />
                {selectedLineForActions &&
                  exactClickPosition &&
                  selectedLineForActions.isSavedLine &&
                  selectedLineForActions.index === index && (
                    <div
                      className="line-action-modal"
                      style={{
                        top: `${exactClickPosition.y - 95}px`,
                        left: `${exactClickPosition.x}px`,
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
                {(displayPolyline.waypoints || []).map(
                  (waypoint, waypointIndex) => (
                    <MarkerF
                      key={`saved-waypoint-${polyline.id}-${waypointIndex}-${waypoint.lat}-${waypoint.lng}`}
                      position={waypoint}
                      draggable={isSavedRoutesEditable}
                      onDragEnd={(e) =>
                        handleSavedPolylineWaypointDragEnd(
                          polyline.id,
                          waypointIndex,
                          e
                        )
                      }
                      icon={{
                        url: "/img/location.jpg",
                        scaledSize: new window.google.maps.Size(15, 15),
                      }}
                    />
                  )
                )}
                {!isSnappedToIcon(
                  displayPolyline.from.lat,
                  displayPolyline.from.lng
                ) && (
                  <MarkerF
                    key={`saved-start-${polyline.id}`}
                    position={displayPolyline.from}
                    draggable={isSavedRoutesEditable}
                    onDragEnd={(e) =>
                      handleSavedPolylinePointDragEnd(polyline.id, "from", e)
                    }
                    icon={{
                      url: "/img/location.jpg",
                      scaledSize: new window.google.maps.Size(20, 20),
                    }}
                  />
                )}
                {!isSnappedToIcon(
                  displayPolyline.to.lat,
                  displayPolyline.to.lng
                ) && (
                  <MarkerF
                    key={`saved-end-${polyline.id}`}
                    position={displayPolyline.to}
                    draggable={isSavedRoutesEditable}
                    onDragEnd={(e) =>
                      handleSavedPolylinePointDragEnd(polyline.id, "to", e)
                    }
                    icon={{
                      url: "/img/location.jpg",
                      scaledSize: new window.google.maps.Size(20, 20),
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
      </GoogleMap>

      {showModal && selectedPoint && (
        <div
          className="modal"
          style={{
            top: `${selectedPoint.y - 110}px`,
            left: `${selectedPoint.x - 210}px`,
          }}
        >
          <button
            className="modal-close"
            onClick={() => setShowModal(false) || setRightClickMarker(null)}
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
              onClick={() => handleSelection("Add Fiber", null)}
            >
              Add Fiber
            </button>
          </div>
          <div className="modal-spike"></div>
        </div>
      )}

      {showFiberForm && rightClickMarker && (
        <div className="fiber-form-modal">
          <h3>Create Fiber Line</h3>
          <div>
            <label htmlFor="fiberName">Name</label>
            <input
              type="text"
              id="fiberName"
              value={fiberFormData.name}
              onChange={(e) =>
                setFiberFormData((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              placeholder="Name"
              required
            />
          </div>
          <div>
            <label htmlFor="fiberType">Type</label>
            <input
              type="text"
              id="fiberType"
              value={fiberFormData.type}
              onChange={(e) =>
                setFiberFormData((prev) => ({
                  ...prev,
                  type: e.target.value,
                }))
              }
              placeholder="Type (e.g., Fiber, Copper)"
              required
            />
          </div>
          <div className="fiber-form-buttons">
            <button
              type="button"
              onClick={() =>
                setShowFiberForm(false) ||
                setRightClickMarker(null) ||
                setFiberFormData({ name: "", type: "Fiber" })
              }
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addFiberLine}
              className="submit-button"
            >
              <Save size={12} />
              Submit
            </button>
          </div>
        </div>
      )}

      {showDeviceModal && selectedDevice && deviceModalPosition && (
        <div
          className="line-action-modal"
          style={{
            top: `${deviceModalPosition.y - 95}px`,
            left: `${deviceModalPosition.x}px`,
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
              setShowDeviceModal(false) ||
              setSelectedDevice(null) ||
              setDeviceModalPosition(null)
            }
          >
            <span className="line-action-close">×</span>
            <span className="line-action-tooltip">Close</span>
          </div>
          <div className="modal-spike"></div>
        </div>
      )}

      {showDeviceForm && deviceFormData && (
        <div className="device-form-modal">
          <h3>Create {deviceFormData.type} Device</h3>
          <div>
            <label htmlFor="deviceName">Device Name</label>
            <input
              type="text"
              id="deviceName"
              value={deviceForm.deviceName}
              onChange={(e) =>
                handleDeviceFormInputChange("deviceName", e.target.value)
              }
              placeholder="Device name"
              required
            />
          </div>
          <div>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={deviceForm.description}
              onChange={(e) =>
                handleDeviceFormInputChange("description", e.target.value)
              }
              placeholder="Description"
              required
            />
          </div>
          <div>
            <label htmlFor="deviceModelId">Model</label>
            <select
              id="deviceModelId"
              value={deviceForm.deviceModelId}
              onChange={(e) =>
                handleDeviceFormInputChange("deviceModelId", e.target.value)
              }
              required
            >
              <option value="">Select model</option>
              {deviceTypes
                .find((deviceType) => deviceType.name === deviceFormData.type)
                ?.device_models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.vendor})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="name">{deviceFormData.type} Name</label>
            <input
              type="text"
              id="name"
              value={deviceForm.name}
              onChange={(e) =>
                handleDeviceFormInputChange("name", e.target.value)
              }
              placeholder={`${deviceFormData.type} name`}
              required
            />
          </div>
          {deviceFormData.type === "OLT" && (
            <>
              <div>
                <label htmlFor="hostname">Hostname</label>
                <input
                  type="text"
                  id="hostname"
                  value={deviceForm.hostname}
                  onChange={(e) =>
                    handleDeviceFormInputChange("hostname", e.target.value)
                  }
                  placeholder="Hostname"
                  required
                />
              </div>
              <div>
                <label htmlFor="community">Community</label>
                <input
                  type="text"
                  id="community"
                  value={deviceForm.community}
                  onChange={(e) =>
                    handleDeviceFormInputChange("community", e.target.value)
                  }
                  placeholder="Community"
                  required
                />
              </div>
            </>
          )}
          <div>
            <label>Ports</label>
            <div className="port-section">
              {deviceForm.ports.map((port, index) => (
                <div key={index} className="port-row">
                  <input
                    type="text"
                    value={port.name}
                    onChange={(e) =>
                      handlePortChange(index, "name", e.target.value)
                    }
                    placeholder={`Port ${index + 1}`}
                    required
                  />
                  <input
                    type="number"
                    value={port.position}
                    onChange={(e) =>
                      handlePortChange(index, "position", e.target.value)
                    }
                    placeholder="Pos"
                    required
                  />
                  {deviceForm.ports.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePort(index)}
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addPort} className="add-port-button">
              <Plus size={14} />
              Add Port
            </button>
          </div>
          <div className="form-buttons">
            <button
              type="button"
              onClick={() =>
                setShowDeviceForm(false) ||
                setDeviceFormData(null) ||
                setDeviceForm({
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
                }) ||
                setRightClickMarker(null)
              }
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeviceFormSubmit}
              className="submit-button"
            >
              <Save size={14} />
              Submit
            </button>
          </div>
        </div>
      )}

      {showPortDropdown && portDropdownPosition && portDropdownDevice && (
        <div
          className="port-dropdown-modal"
          style={{
            position: "fixed",
            top: `${portDropdownPosition.y - 180}px`,
            left: `${portDropdownPosition.x - 100}px`,
          }}
        >
          <h3>
            Select Port for {portDropdownDevice.type} (
            {portDropdownEnd === "start" ? "Start" : "End"})
          </h3>
          <div>
            <label htmlFor="portSelect">Port</label>
            <select
              id="portSelect"
              value={selectedPortId || ""}
              onChange={(e) => handlePortDropdownChange(e.target.value)}
              required
            >
              <option value="">Select port</option>
              {portDropdownPorts.map((port) => (
                <option key={port.id} value={port.id}>
                  {port.name || `Port ${port.position}`}
                </option>
              ))}
            </select>
          </div>
          <div className="port-form-buttons">
            <button
              type="button"
              onClick={closePortDropdown}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePortSelection}
              disabled={!selectedPortId}
              className="select-button"
            >
              <Save size={12} />
              Select
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          backgroundColor: "white",
          padding: "10px",
          borderRadius: "5px",
          boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
          zIndex: 1000,
        }}
      >
        <button
          onClick={() => setShowSavedRoutes((prev) => !prev)}
          className="flex items-center gap-2 p-2 m-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          {showSavedRoutes ? <EyeOff /> : <Eye />}
          {showSavedRoutes ? " Hide Saved Routes" : " Show Saved Routes"}
        </button>
        <button
          onClick={() => setIsSavedRoutesEditable((prev) => !prev)}
          className="flex items-center gap-2 p-2 m-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          {isSavedRoutesEditable ? <Lock /> : <Unlock />}
          {isSavedRoutesEditable
            ? " Disable Cable Editing"
            : " Enable Cable Editing"}
        </button>
        <button
          onClick={saveAllCables}
          className="flex items-center gap-2 p-2 m-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
          disabled={!fiberLines.length && !hasEditedCables}
        >
          <Save size={16} />
          Save All Cables
        </button>
      </div>
    </>
  );
};

export default MyMap;
