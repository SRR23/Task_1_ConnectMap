import React, { useState, useEffect, useCallback, useRef } from "react";
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

  const mapRef = useRef(null);

  const [mapState, setMapState] = useState({
    savedPolylines: [],
    fiberLines: [],
    imageIcons: [],
    showSavedRoutes: true,
    isSavedRoutesEditable: false,
    selectedLineForActions: null,
    lineActionPosition: null,
    exactClickPosition: null,
    selectedWaypoint: null,
    waypointActionPosition: null,
    selectedWaypointInfo: null,
    showModal: false,
    selectedPoint: null,
    rightClickMarker: null,
    showFiberForm: false,
    fiberFormData: { name: "", type: "Fiber" },
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
    showPortDropdown: false,
    portDropdownPosition: null,
    portDropdownDevice: null,
    portDropdownPorts: [],
    selectedPortId: null,
    portDropdownEnd: null,
    tempCable: null,
    showDeviceModal: false,
    selectedDevice: null,
    deviceModalPosition: null,
    tempModifiedCable: null,
    nextNumber: 1,
    allPorts: [],
    hasEditedCables: false,
    updatedDevices: [],
  });

  const [deviceTypes, setDeviceTypes] = useState([]);
  const [allPorts, setAllPorts] = useState([]);

  useEffect(() => {
    const fetchDeviceTypes = async () => {
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/api/v1/device-types"
        );
        if (!response.ok) throw new Error("Failed to fetch device types");
        const data = await response.json();
        setDeviceTypes(data);
      } catch (error) {
        console.error("Error fetching device types:", error);
        alert("Failed to load device types.");
      }
    };
    fetchDeviceTypes();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/devices");
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      const devices = await response.json();

      const allPorts = devices.flatMap((device) =>
        device.port_device.map((port) => ({
          id: port.id,
          name: port.name,
          position: port.position,
          device_id: device.id,
        }))
      );

      const fetchedIcons = devices
        .filter((device) => device.latitude != null && device.longitude != null)
        .map((device) => ({
          lat: device.latitude,
          lng: device.longitude,
          type: device.device_type.name,
          id: `icon-api-${device.id}`,
          imageUrl: device.device_type.icon
            ? `http://127.0.0.1:8000${device.device_type.icon}`
            : "/img/default-icon.png",
          deviceId: device.id,
          portIds: device.port_device.map((port) => port.id),
        }));

      setMapState((prevState) => ({
        ...prevState,
        imageIcons: fetchedIcons,
        allPorts,
        nextNumber: fetchedIcons.length + 1,
        tempModifiedCable: null,
      }));
      setAllPorts(allPorts);
    } catch (error) {
      console.error("Error fetching devices:", error);
      alert("Failed to load devices.");
    }
  };

  const fetchCables = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/interface");
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      const cables = await response.json();

      const fetchedPolylines = cables
        .filter(
          (cableInterface) => cableInterface.cable?.path?.coords?.length >= 2
        )
        .map((cableInterface) => {
          const coords = cableInterface.cable.path.coords;
          return {
            id: `cable-${cableInterface.id}`,
            cableId: cableInterface.cable.id,
            name: cableInterface.cable.name || `Cable-${cableInterface.id}`,
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
            startDeviceId: cableInterface.start.device.id || null,
            endDeviceId: cableInterface.end.device.id || null,
            startPortId: cableInterface.start.id || null,
            endPortId: cableInterface.end.id || null,
            startPortName: cableInterface.start.name || null,
            endPortName: cableInterface.end.name || null,
          };
        });

      setMapState((prevState) => ({
        ...prevState,
        savedPolylines: fetchedPolylines,
        tempModifiedCable: null,
      }));
    } catch (error) {
      console.error("Error fetching cables:", error);
      alert("Failed to load cables.");
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchCables();
  }, []);

  const saveCableToInterface = async (cable) => {
    try {
      const payload = {
        start: { device_id: cable.startDeviceId, port_id: cable.startPortId },
        end: { device_id: cable.endDeviceId, port_id: cable.endPortId },
        cable: {
          name: cable.name,
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

      const response = await fetch("http://127.0.0.1:8000/api/v1/interface", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok)
        throw new Error(`Failed to save cable: ${response.status}`);
      const responseData = await response.json();

      setMapState((prevState) => ({
        ...prevState,
        fiberLines: prevState.fiberLines.filter((l) => l.id !== cable.id),
        selectedLineForActions: null,
        lineActionPosition: null,
        exactClickPosition: null,
        tempCable: null,
        tempModifiedCable: null,
      }));

      await fetchCables();
      return responseData;
    } catch (error) {
      console.error("Error saving cable:", error);
      alert(`Failed to save cable: ${error.message}`);
      throw error;
    }
  };

  const patchCableToInterface = async (cable) => {
    try {
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

      if (!response.ok)
        throw new Error(`Failed to update cable: ${response.status}`);

      setMapState((prevState) => {
        const updatedSavedPolylines = prevState.savedPolylines.map((polyline) =>
          polyline.id === cable.id
            ? { ...cable, hasEditedCables: false }
            : polyline
        );
        return {
          ...prevState,
          savedPolylines: updatedSavedPolylines,
          tempModifiedCable: null,
          selectedLineForActions: null,
          lineActionPosition: null,
          exactClickPosition: null,
          hasEditedCables: false,
        };
      });

      return await response.json();
    } catch (error) {
      console.error("Error updating cable:", error);
      alert(`Failed to update cable: ${error.message}`);
      throw error;
    }
  }; 

  const removeSavedSelectedLine = async () => {
    if (!mapState.selectedLineForActions || !mapState.isSavedRoutesEditable)
      return;
    const { index, isSavedLine } = mapState.selectedLineForActions;
    if (!isSavedLine) return;

    const line = mapState.savedPolylines[index];
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/v1/interface/${line.cableId}`,
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

      setMapState((prevState) => ({
        ...prevState,
        savedPolylines: prevState.savedPolylines.filter((_, i) => i !== index),
        selectedLineForActions: null,
        lineActionPosition: null,
        exactClickPosition: null,
        tempModifiedCable: null,
      }));
      alert("Line deleted successfully!");
    } catch (error) {
      console.error("Error deleting line:", error);
      alert(`Failed to delete line: ${error.message}`);
    }
  };

  const isInteractionAllowed = (isSavedLine) =>
    !isSavedLine || mapState.isSavedRoutesEditable;

  const findNearestIcon = (lat, lng) => {
    const threshold = 0.0001;
    return mapState.imageIcons.find(
      (icon) =>
        Math.abs(icon.lat - lat) < threshold &&
        Math.abs(icon.lng - lng) < threshold
    );
  };

  const isSnappedToIcon = (lat, lng) => !!findNearestIcon(lat, lng);

  const handleMapRightClick = useCallback((e) => {
    e.domEvent.preventDefault();
    const clickedPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
      x: e.domEvent.clientX,
      y: e.domEvent.clientY,
    };
    setMapState((prevState) => ({
      ...prevState,
      selectedPoint: clickedPoint,
      rightClickMarker: clickedPoint,
      showModal: true,
      tempModifiedCable: null,
    }));
  }, []);

  const handleSelection = (type, icon) => {
    const { selectedPoint, nextNumber } = mapState;
    if (!selectedPoint) return;

    const validImageUrl = icon?.startsWith("/media/")
      ? `http://127.0.0.1:8000${icon}`
      : icon || "/img/default-icon.png";

    const selectedDevice = deviceTypes.find((device) => device.name === type);

    if (type === "Add Fiber") {
      setMapState((prevState) => ({
        ...prevState,
        showModal: false,
        rightClickMarker: selectedPoint,
        showFiberForm: true,
        fiberFormData: { name: "", type: "Fiber" },
        tempModifiedCable: null,
      }));
    } else if (selectedDevice) {
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
          imageUrl: validImageUrl,
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
        tempModifiedCable: null,
      }));
    } else {
      setMapState((prevState) => ({
        ...prevState,
        showModal: false,
        rightClickMarker: null,
        selectedPoint: null,
        tempModifiedCable: null,
      }));
      alert(`Device type "${type}" not found.`);
    }
  };

  const handleDeviceFormSubmit = async (e) => {
    e.preventDefault();
    const { deviceFormData, deviceForm } = mapState;
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
        OLT: "http://127.0.0.1:8000/api/v1/olt",
        ONU: "http://127.0.0.1:8000/api/v1/onu",
        Splitter: "http://127.0.0.1:8000/api/v1/splitter",
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
        tempModifiedCable: null,
      }));
      alert(`${deviceFormData.type} created successfully!`);
    } catch (error) {
      console.error(`Error creating ${deviceFormData.type}:`, error);
      alert(`Failed to create ${deviceFormData.type}: ${error.message}`);
    }
  };

  const handleDeviceFormInputChange = (field, value) => {
    setMapState((prevState) => ({
      ...prevState,
      deviceForm: { ...prevState.deviceForm, [field]: value },
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
        deviceForm: { ...prevState.deviceForm, ports: updatedPorts },
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
          { name: "", position: prevState.deviceForm.ports.length + 1 },
        ],
      },
    }));
  };

  const removePort = (index) => {
    setMapState((prevState) => {
      const updatedPorts = prevState.deviceForm.ports
        .filter((_, i) => i !== index)
        .map((port, i) => ({ ...port, position: i + 1 }));
      return {
        ...prevState,
        deviceForm: { ...prevState.deviceForm, ports: updatedPorts },
      };
    });
  };

  const handlePortSelection = (e) => {
    e.preventDefault();
    const { selectedPortId, portDropdownEnd, tempCable } = mapState;
    if (!selectedPortId || !tempCable) return;

    setMapState((prevState) => {
      const updatedLines = [...prevState.fiberLines];
      const lineIndex = updatedLines.findIndex(
        (line) => line.id === tempCable.id
      );
      if (lineIndex === -1) return prevState;

      const selectedPort = prevState.allPorts.find(
        (port) => port.id === parseInt(selectedPortId)
      );
      updatedLines[lineIndex] = {
        ...updatedLines[lineIndex],
        [portDropdownEnd === "start" ? "startPortId" : "endPortId"]:
          selectedPortId,
        [portDropdownEnd === "start" ? "startPortName" : "endPortName"]:
          selectedPort?.name || `Port-${selectedPortId}`,
        [portDropdownEnd === "start" ? "startDeviceId" : "endDeviceId"]:
          prevState.portDropdownDevice?.deviceId || null,
      };

      return {
        ...prevState,
        fiberLines: updatedLines,
        showPortDropdown: false,
        portDropdownPosition: null,
        portDropdownDevice: null,
        portDropdownPorts: [],
        selectedPortId: null,
        portDropdownEnd: null,
        tempCable: { ...updatedLines[lineIndex] },
        tempModifiedCable: null,
      };
    });
  };

  const handlePortDropdownChange = (portId) => {
    setMapState((prevState) => ({ ...prevState, selectedPortId: portId }));
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
      tempModifiedCable: null,
    }));
  };

  const handleRightClickOnIcon = (icon, e) => {
    if (e.domEvent.button !== 2) return;
    e.domEvent.preventDefault();
    e.domEvent.stopPropagation();

    if (icon.id.startsWith("icon-api-") && !mapState.isSavedRoutesEditable)
      return;

    setMapState((prevState) => ({
      ...prevState,
      selectedPoint: { ...icon, x: e.domEvent.clientX, y: e.domEvent.clientY },
      rightClickMarker: icon,
      showModal: true,
      selectedWaypoint: icon,
      selectedWaypointInfo: { isIcon: true, iconId: icon.id },
      waypointActionPosition: { x: e.domEvent.clientX, y: e.domEvent.clientY },
      tempModifiedCable: null,
    }));
  };

  const handleLineClick = (line, index, isSavedLine, e) => {
    e.domEvent.stopPropagation();
    e.domEvent.preventDefault();

    const clickedLatLng = e.latLng;
    const x = e.domEvent.clientX;
    const y = e.domEvent.clientY;

    setMapState((prevState) => {
      // Preserve tempModifiedCable if it exists and matches the clicked line
      const tempModifiedCable =
        prevState.tempModifiedCable?.id === line.id
          ? prevState.tempModifiedCable
          : isSavedLine
          ? { ...line }
          : null;

      return {
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
        tempModifiedCable,
      };
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
      if (isSavedLine) {
        const updatedCable = prevState.tempModifiedCable || { ...line };
        const lastPoint = updatedCable.waypoints?.length
          ? updatedCable.waypoints[updatedCable.waypoints.length - 1]
          : updatedCable.to;
        const midpoint = {
          lat: (updatedCable.from.lat + lastPoint.lat) / 2,
          lng: (updatedCable.from.lng + lastPoint.lng) / 2,
        };
        const updatedWaypoints = updatedCable.waypoints
          ? [...updatedCable.waypoints, midpoint]
          : [midpoint];

        return {
          ...prevState,
          tempModifiedCable: {
            ...updatedCable,
            waypoints: updatedWaypoints,
            hasEditedCables: true,
          },
          selectedLineForActions: null,
          lineActionPosition: null,
          exactClickPosition: null,
        };
      } else {
        const updatedLines = [...prevState.fiberLines];
        const lastPoint = updatedLines[index].waypoints?.length
          ? updatedLines[index].waypoints[
              updatedLines[index].waypoints.length - 1
            ]
          : updatedLines[index].to;
        const midpoint = {
          lat: (updatedLines[index].from.lat + lastPoint.lat) / 2,
          lng: (updatedLines[index].from.lng + lastPoint.lng) / 2,
        };
        const updatedWaypoints = updatedLines[index].waypoints
          ? [...updatedLines[index].waypoints, midpoint]
          : [midpoint];

        updatedLines[index] = {
          ...updatedLines[index],
          waypoints: updatedWaypoints,
        };
        return {
          ...prevState,
          fiberLines: updatedLines,
          selectedLineForActions: null,
          lineActionPosition: null,
          exactClickPosition: null,
        };
      }
    });
  };

  const handleWaypointClick = (
    lineIndex,
    waypointIndex,
    isSavedLine,
    waypoint,
    e
  ) => {
    e.domEvent.preventDefault();
    e.domEvent.stopPropagation();

    if (!isInteractionAllowed(isSavedLine)) return;

    setMapState((prevState) => ({
      ...prevState,
      selectedLineForActions: null,
      lineActionPosition: null,
      exactClickPosition: null,
      showModal: false,
      selectedWaypoint: waypoint,
      waypointActionPosition: { x: e.domEvent.clientX, y: e.domEvent.clientY },
      selectedWaypointInfo: { lineIndex, waypointIndex, isSavedLine },
      tempModifiedCable: isSavedLine
        ? { ...prevState.savedPolylines[lineIndex] }
        : null,
    }));
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
      if (isSavedLine) {
        const updatedCable = prevState.tempModifiedCable || {
          ...prevState.savedPolylines[lineIndex],
        };
        const updatedWaypoints = updatedCable.waypoints.filter(
          (_, wIdx) => wIdx !== waypointIndex
        );
        return {
          ...prevState,
          tempModifiedCable: {
            ...updatedCable,
            waypoints: updatedWaypoints,
            hasEditedCables: true,
          },
          selectedWaypoint: null,
          waypointActionPosition: null,
          selectedWaypointInfo: null,
        };
      } else {
        const updatedLines = [...prevState.fiberLines];
        updatedLines[lineIndex] = {
          ...updatedLines[lineIndex],
          waypoints: updatedLines[lineIndex].waypoints.filter(
            (_, wIdx) => wIdx !== waypointIndex
          ),
        };
        return {
          ...prevState,
          fiberLines: updatedLines,
          selectedWaypoint: null,
          waypointActionPosition: null,
          selectedWaypointInfo: null,
        };
      }
    });
  };

  const handleIconClick = (icon, e) => {
    if (e.domEvent.button !== 0) return;
    e.domEvent.preventDefault();
    e.domEvent.stopPropagation();

    setMapState((prevState) => ({
      ...prevState,
      showDeviceModal: true,
      selectedDevice: icon,
      deviceModalPosition: { x: e.domEvent.clientX, y: e.domEvent.clientY },
      selectedLineForActions: null,
      lineActionPosition: null,
      exactClickPosition: null,
      showModal: false,
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
      tempModifiedCable: null,
    }));
  };

  const removeSelectedIcon = async () => {
    if (!mapState.selectedDevice) return;
    const iconId = mapState.selectedDevice.id;
    const isApiDevice = iconId.startsWith("icon-api-");
    const deviceId = isApiDevice ? iconId.split("-")[2] : iconId;

    try {
      if (isApiDevice) {
        const endpointMap = {
          OLT: `http://127.0.0.1:8000/api/v1/olt/${deviceId}`,
          ONU: `http://127.0.0.1:8000/api/v1/onu/${deviceId}`,
          Splitter: `http://127.0.0.1:8000/api/v1/splitter/${deviceId}`,
        };
        const endpoint = endpointMap[mapState.selectedDevice.type];
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

      setMapState((prevState) => ({
        ...prevState,
        imageIcons: prevState.imageIcons.filter((icon) => icon.id !== iconId),
        showDeviceModal: false,
        selectedDevice: null,
        deviceModalPosition: null,
        updatedDevices: prevState.updatedDevices.filter(
          (device) => device.deviceId !== deviceId
        ),
        tempModifiedCable: null,
      }));
      alert("Device removed successfully!");
    } catch (error) {
      console.error("Error removing device:", error);
      alert(`Failed to remove device: ${error.message}`);
    }
  };

  const saveDeviceChanges = async () => {
    if (!mapState.selectedDevice) return;
    const { selectedDevice } = mapState;

    try {
      if (selectedDevice.id.startsWith("icon-api-")) {
        const deviceId = selectedDevice.id.split("-")[2];
        const payload = {
          latitude: selectedDevice.lat,
          longitude: selectedDevice.lng,
        };
        const endpointMap = {
          OLT: `http://127.0.0.1:8000/api/v1/olt/${deviceId}`,
          ONU: `http://127.0.0.1:8000/api/v1/onu/${deviceId}`,
          Splitter: `http://127.0.0.1:8000/api/v1/splitter/${deviceId}`,
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
      }

      setMapState((prevState) => ({
        ...prevState,
        imageIcons: prevState.imageIcons.map((icon) =>
          icon.id === selectedDevice.id ? { ...icon } : icon
        ),
        showDeviceModal: false,
        selectedDevice: null,
        deviceModalPosition: null,
        updatedDevices: prevState.updatedDevices.filter(
          (device) => device.deviceId !== selectedDevice.id.split("-")[2]
        ),
        tempModifiedCable: null,
      }));
      alert("Device saved successfully!");
    } catch (error) {
      console.error("Error saving device:", error);
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
    const waypoint = (
      isSavedLine ? mapState.savedPolylines : mapState.fiberLines
    )[lineIndex].waypoints[waypointIndex];

    const newSplitter = {
      lat: waypoint.lat,
      lng: waypoint.lng,
      type: "Splitter",
      id: `icon-${mapState.nextNumber}`,
      imageUrl: "/img/splitter-icon.png",
      deviceId: null,
      portIds: [],
    };

    setMapState((prevState) => ({
      ...prevState,
      imageIcons: [...prevState.imageIcons, newSplitter],
      nextNumber: prevState.nextNumber + 1,
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
      tempModifiedCable: null,
    }));
  };

  const handleMarkerDragEnd = (iconId, e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();

    setMapState((prevState) => {
      const draggedIcon = prevState.imageIcons.find(
        (icon) => icon.id === iconId
      );
      const updatedImageIcons = prevState.imageIcons.map((icon) =>
        icon.id === iconId ? { ...icon, lat: newLat, lng: newLng } : icon
      );

      let updatedDevices = [...prevState.updatedDevices];
      if (iconId.startsWith("icon-api-")) {
        const deviceId = iconId.split("-")[2];
        const existingUpdateIndex = updatedDevices.findIndex(
          (device) => device.deviceId === deviceId
        );
        if (existingUpdateIndex !== -1) {
          updatedDevices[existingUpdateIndex] = {
            deviceId,
            lat: newLat,
            lng: newLng,
          };
        } else {
          updatedDevices.push({ deviceId, lat: newLat, lng: newLng });
        }
      }

      let updatedFiberLines = [...prevState.fiberLines];
      let updatedSavedPolylines = [...prevState.savedPolylines];
      let tempModifiedCable = prevState.tempModifiedCable
        ? { ...prevState.tempModifiedCable }
        : null;

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
      if (tempModifiedCable) {
        tempModifiedCable = updateLines([tempModifiedCable])[0];
      } else {
        updatedSavedPolylines = updateLines(updatedSavedPolylines);
      }

      return {
        ...prevState,
        imageIcons: updatedImageIcons,
        fiberLines: updatedFiberLines,
        savedPolylines: updatedSavedPolylines,
        tempModifiedCable,
        updatedDevices,
        hasEditedCables: tempModifiedCable ? true : prevState.hasEditedCables,
      };
    });
  };

  const generateUniqueId = () =>
    `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addFiberLine = () => {
    const { rightClickMarker, fiberFormData } = mapState;
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

    setMapState((prevState) => ({
      ...prevState,
      fiberLines: [...prevState.fiberLines, newFiberLine],
      showModal: false,
      showFiberForm: false,
      selectedPoint: null,
      rightClickMarker: null,
      fiberFormData: { name: "", type: "Fiber" },
      tempCable: newFiberLine,
      tempModifiedCable: null,
    }));
  };

  const handleStartMarkerDragEnd = (index, e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const nearestIcon = findNearestIcon(newLat, newLng);

    setMapState((prevState) => {
      const updatedLines = [...prevState.fiberLines];
      const line = updatedLines[index];
      if (!line) return prevState;

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

      const newState = {
        ...prevState,
        fiberLines: updatedLines,
        tempCable: null,
        showPortDropdown: false,
        portDropdownPosition: null,
        portDropdownDevice: null,
        portDropdownPorts: [],
        selectedPortId: null,
        tempModifiedCable: null,
      };

      if (nearestIcon?.portIds?.length > 0) {
        const devicePorts = prevState.allPorts.filter((port) =>
          nearestIcon.portIds.includes(port.id)
        );
        if (devicePorts.length > 0) {
          return {
            ...newState,
            showPortDropdown: true,
            portDropdownPosition: {
              x: e.domEvent?.clientX || window.innerWidth / 2,
              y: e.domEvent?.clientY || window.innerHeight / 2,
            },
            portDropdownDevice: nearestIcon,
            portDropdownPorts: devicePorts,
            portDropdownEnd: "start",
            tempCable: updatedLines[index],
          };
        }
      }
      return newState;
    });
  };

  const handleEndMarkerDragEnd = (index, e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const nearestIcon = findNearestIcon(newLat, newLng);

    setMapState((prevState) => {
      const updatedLines = [...prevState.fiberLines];
      const line = updatedLines[index];
      if (!line) return prevState;

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

      const newState = {
        ...prevState,
        fiberLines: updatedLines,
        tempCable: null,
        showPortDropdown: false,
        portDropdownPosition: null,
        portDropdownDevice: null,
        portDropdownPorts: [],
        selectedPortId: null,
        tempModifiedCable: null,
      };

      if (nearestIcon?.portIds?.length > 0) {
        const devicePorts = prevState.allPorts.filter((port) =>
          nearestIcon.portIds.includes(port.id)
        );
        if (devicePorts.length > 0) {
          return {
            ...newState,
            showPortDropdown: true,
            portDropdownPosition: {
              x: e.domEvent?.clientX || window.innerWidth / 2,
              y: e.domEvent?.clientY || window.innerHeight / 2,
            },
            portDropdownDevice: nearestIcon,
            portDropdownPorts: devicePorts,
            portDropdownEnd: "end",
            tempCable: updatedLines[index],
          };
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
      const updatedLines = [...prevState.fiberLines];
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

      return {
        ...prevState,
        fiberLines: updatedLines,
        tempCable: null,
        tempModifiedCable: null,
      };
    });
  };

  const handleSavedPolylinePointDragEnd = (polylineId, pointType, e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const nearestIcon = findNearestIcon(newLat, newLng);

    setMapState((prevState) => {
      let tempModifiedCable =
        prevState.tempModifiedCable ||
        prevState.savedPolylines.find((p) => p.id === polylineId);
      if (!tempModifiedCable) return prevState;

      tempModifiedCable = {
        ...tempModifiedCable,
        [pointType]: nearestIcon
          ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
          : { lat: newLat, lng: newLng },
        [`${pointType}DeviceId`]: nearestIcon?.deviceId || null,
        [`${pointType}PortId`]: nearestIcon?.portIds?.[0] || null,
        hasEditedCables: true,
      };

      return {
        ...prevState,
        tempModifiedCable,
        hasEditedCables: true,
      };
    });
  };

  const handleSavedPolylineWaypointDragEnd = (polylineId, waypointIndex, e) => {
    const newLat = e.latLng.lat();
    const newLng = e.latLng.lng();
    const nearestIcon = findNearestIcon(newLat, newLng);

    setMapState((prevState) => {
      let tempModifiedCable =
        prevState.tempModifiedCable ||
        prevState.savedPolylines.find((p) => p.id === polylineId);
      if (!tempModifiedCable || !tempModifiedCable.waypoints) return prevState;

      const newWaypoint = nearestIcon
        ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
        : { lat: newLat, lng: newLng };
      tempModifiedCable = {
        ...tempModifiedCable,
        waypoints: tempModifiedCable.waypoints.map((wp, idx) =>
          idx === waypointIndex ? newWaypoint : wp
        ),
        hasEditedCables: true,
      };

      return {
        ...prevState,
        tempModifiedCable,
        hasEditedCables: true,
      };
    });
  };

  const closeWaypointActions = () => {
    setMapState((prevState) => ({
      ...prevState,
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
      tempModifiedCable: null,
    }));
  };

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

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
        onLoad={onMapLoad}
      >
        {mapState.imageIcons.map((icon) => (
          <MarkerF
            key={icon.id}
            position={{ lat: icon.lat, lng: icon.lng }}
            draggable={mapState.isSavedRoutesEditable}
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

        {mapState.rightClickMarker && (
          <MarkerF
            key={`right-click-${mapState.rightClickMarker.lat}-${mapState.rightClickMarker.lng}`}
            position={mapState.rightClickMarker}
            icon={{
              url: "/img/location.jpg",
              scaledSize: new window.google.maps.Size(20, 20),
            }}
          />
        )}

        {mapState.fiberLines.map((line, index) => {
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
                onClick={(e) => {
                  e.domEvent.stopPropagation();
                  handleLineClick(line, index, false, e);
                }}
              />
              {mapState.selectedLineForActions &&
                mapState.exactClickPosition &&
                !mapState.selectedLineForActions.isSavedLine &&
                mapState.selectedLineForActions.index === index && (
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
                      onClick={() =>
                        setMapState((prev) => ({
                          ...prev,
                          fiberLines: prev.fiberLines.filter(
                            (_, i) => i !== index
                          ),
                          selectedLineForActions: null,
                          lineActionPosition: null,
                          exactClickPosition: null,
                        }))
                      }
                    >
                      <Trash2 size={20} className="text-red-500" />
                      <span className="line-action-tooltip">Delete Line</span>
                    </div>
                    {line.startPortId && line.endPortId && (
                      <div
                        className="line-action-item"
                        onClick={() =>
                          saveCableToInterface(line)
                            .then(() => alert("Cable saved successfully!"))
                            .catch((error) =>
                              alert(`Failed to save cable: ${error.message}`)
                            )
                        }
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

        {mapState.showSavedRoutes &&
          mapState.savedPolylines.map((polyline, index) => {
            const isModified = mapState.tempModifiedCable?.id === polyline.id;
            const displayPolyline = isModified
              ? mapState.tempModifiedCable
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
                  onClick={(e) => {
                    e.domEvent.stopPropagation();
                    handleLineClick(polyline, index, true, e);
                  }}
                />
                {mapState.selectedLineForActions &&
                  mapState.exactClickPosition &&
                  mapState.selectedLineForActions.isSavedLine &&
                  mapState.selectedLineForActions.index === index && (
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
                      {mapState.tempModifiedCable && (
                        <div
                          className="line-action-item"
                          onClick={() =>
                            patchCableToInterface(mapState.tempModifiedCable)
                              .then(() => alert("Cable updated successfully!"))
                              .catch((error) =>
                                alert(
                                  `Failed to update cable: ${error.message}`
                                )
                              )
                          }
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
                            tempModifiedCable: null,
                          }))
                        }
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
                      draggable={mapState.isSavedRoutesEditable}
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
                  )
                )}
                {!isSnappedToIcon(
                  displayPolyline.from.lat,
                  displayPolyline.from.lng
                ) && (
                  <MarkerF
                    key={`saved-start-${polyline.id}`}
                    position={displayPolyline.from}
                    draggable={mapState.isSavedRoutesEditable}
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
                    draggable={mapState.isSavedRoutesEditable}
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
            {mapState.selectedWaypointInfo?.isSavedLine &&
              mapState.tempModifiedCable && (
                <div
                  className="line-action-item"
                  onClick={() =>
                    patchCableToInterface(mapState.tempModifiedCable)
                      .then(() => alert("Cable updated successfully!"))
                      .catch((error) =>
                        alert(`Failed to update cable: ${error.message}`)
                      )
                  }
                >
                  <Save size={20} className="text-blue-500" />
                  <span className="line-action-tooltip">Save Changes</span>
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
              setMapState((prev) => ({
                ...prev,
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
              onClick={() => handleSelection("Add Fiber", null)}
            >
              Add Fiber
            </button>
          </div>
          <div className="modal-spike"></div>
        </div>
      )}

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
                  setMapState((prev) => ({
                    ...prev,
                    fiberFormData: {
                      ...prev.fiberFormData,
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
                  setMapState((prev) => ({
                    ...prev,
                    fiberFormData: {
                      ...prev.fiberFormData,
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
                  setMapState((prev) => ({
                    ...prev,
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
                  setMapState((prev) => ({
                    ...prev,
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

      {mapState.showPortDropdown &&
        mapState.portDropdownPosition &&
        mapState.portDropdownDevice && (
          <div
            className="port-dropdown-modal"
            style={{
              position: "fixed",
              top: `${mapState.portDropdownPosition.y - 180}px`,
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
          onClick={() =>
            setMapState((prev) => ({
              ...prev,
              showSavedRoutes: !prev.showSavedRoutes,
            }))
          }
          style={{ margin: "5px" }}
        >
          {mapState.showSavedRoutes ? <EyeOff /> : <Eye />}
          {mapState.showSavedRoutes
            ? " Hide Saved Routes"
            : " Show Saved Routes"}
        </button>
        <button
          onClick={() =>
            setMapState((prev) => ({
              ...prev,
              isSavedRoutesEditable: !prev.isSavedRoutesEditable,
              tempModifiedCable: null,
            }))
          }
          style={{ margin: "5px" }}
        >
          {mapState.isSavedRoutesEditable ? <Lock /> : <Unlock />}
          {mapState.isSavedRoutesEditable ? " Lock Editing" : " Unlock Editing"}
        </button>
      </div>
    </>
  );
};

export default MyMapV19;
