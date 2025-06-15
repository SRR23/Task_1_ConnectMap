import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useLoadScript } from "@react-google-maps/api";
import MapComponent from "../Map/MapComponent";
import FiberFormModal from "../Modal/FiberFormModal";
import DeviceModal from "../Modal/DeviceModal";
import DeviceFormModal from "../Modal/DeviceFormModal";
import PortDropdownModal from "../Modal/PortDropdownModal";
import ContextMenuModal from "../Modal/ContextMenuModal";
import ControlPanel from "../ControlPanel/ControlPanel";
import WaypointActionModal from "../Modal/WaypointActionModal";
import debounce from "lodash/debounce";

// Define API endpoints for device types
const DEVICE_ENDPOINTS = {
  OLT: "http://localhost:8000/api/v1/olt",
  ONU: "http://localhost:8000/api/v1/onu",
  Splitter: "http://localhost:8000/api/v1/splitter",
};

const FiberMapPage = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const mapRef = useRef(null);

  // State declarations
  const [savedPolylines, setSavedPolylines] = useState([]);
  const [fiberLines, setFiberLines] = useState([]);
  const [imageIcons, setImageIcons] = useState([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(true);
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
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [previousCableState, setPreviousCableState] = useState(null);

  // Centralized error handler
  const handleApiError = useCallback((error, message) => {
    console.error(message, error);
    alert(`${message}: ${error.message}`);
  }, []);

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

      // Only update states if there are changes
      setImageIcons((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(icons)) return prev;
        return icons;
      });
      setAllPorts((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(ports)) return prev;
        return ports;
      });
      setNextNumber((prev) => {
        const newNextNumber = icons.length + 1;
        if (prev === newNextNumber) return prev;
        return newNextNumber;
      });

      return true;
    } catch (error) {
      handleApiError(error, "Error fetching devices");
      throw error;
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
            type: cable.cable.type || "Fiber",
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
            startDeviceId: cable.start?.device.id || null,
            endDeviceId: cable.end?.device.id || null,
            startPortId: cable.start?.id || null,
            endPortId: cable.end?.id || null,
            startPortName: cable.start?.name || null,
            endPortName: cable.end?.name || null,
          };
        });

      const usedPortIds = cables
        .filter((cable) => cable.start?.id || cable.end?.id)
        .flatMap((cable) => [cable.start?.id, cable.end?.id])
        .filter((id) => id != null);

      // Only update states if there are changes
      setSavedPolylines((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(polylines)) return prev;
        return polylines;
      });
      setUsedPorts((prev) => {
        const newUsedPorts = [...new Set(usedPortIds)];
        if (JSON.stringify(prev) === JSON.stringify(newUsedPorts)) return prev;
        return newUsedPorts;
      });

      // Only preserve incomplete cables in modifiedCables
      setModifiedCables((prev) => {
        const updated = {};
        Object.entries(prev).forEach(([cableId, cable]) => {
          if (!cable.startPortId || !cable.endPortId) {
            updated[cableId] = { ...cable, hasEditedCables: false };
          }
        });
        if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
        return updated;
      });

      return true;
    } catch (error) {
      handleApiError(error, "Error fetching cables");
      throw error;
    }
  }, [handleApiError]);

  // Save a single device position
  const saveDevicePosition = useCallback(
    async (device, deviceIcon) => {
      const endpoint = DEVICE_ENDPOINTS[deviceIcon.type];
      if (!endpoint) {
        console.warn(`Invalid device type for deviceId: ${device.deviceId}`);
        return false;
      }

      const payload = {
        latitude: device.lat,
        longitude: device.lng,
      };

      try {
        const response = await fetch(`${endpoint}/${device.deviceId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to update device ${device.deviceId}: ${response.status}`
          );
        }
        return true;
      } catch (error) {
        handleApiError(error, `Error saving device ${device.deviceId}`);
        return false;
      }
    },
    [handleApiError]
  );

  // Save all updated device positions
  const saveUpdatedDevices = useCallback(async () => {
    const savePromises = updatedDevices.map(async (device) => {
      const deviceIcon = imageIcons.find(
        (icon) => icon.deviceId === device.deviceId
      );
      if (!deviceIcon) {
        // console.warn(`Device icon not found for deviceId: ${device.deviceId}`);
        return false;
      }
      const success = await saveDevicePosition(device, deviceIcon);
      if (success) {
        // console.log(`Successfully saved device ${device.deviceId}`);
      }
      return success;
    });

    const results = await Promise.all(savePromises);
    return results.every((result) => result);
  }, [updatedDevices, imageIcons, saveDevicePosition]);

  // Prepare payload for a cable
  const prepareCablePayload = useCallback(
    (line) => ({
      start: { device_id: line.startDeviceId, port_id: line.startPortId },
      end: { device_id: line.endDeviceId, port_id: line.endPortId },
      cable: {
        name: line.name || `Cable-${Date.now()}`,
        type: line.type.toLowerCase(),
        path: {
          coords: [
            [line.from.lat, line.from.lng],
            ...(line.waypoints || []).map((wp) => [wp.lat, wp.lng]),
            [line.to.lat, line.to.lng],
          ],
        },
      },
    }),
    []
  );

  // Save a single new cable
  const saveNewCable = useCallback(
    async (line) => {
      const payload = prepareCablePayload(line);
      try {
        const response = await fetch("http://localhost:8000/api/v1/interface", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to save cable ${line.name || "Unnamed"}: ${response.status}`
          );
        }

        if (line.startPortId || line.endPortId) {
          setUsedPorts((prev) => [
            ...new Set([
              ...prev,
              ...(line.startPortId ? [line.startPortId] : []),
              ...(line.endPortId ? [line.endPortId] : []),
            ]),
          ]);
        }
        return true;
      } catch (error) {
        handleApiError(error, `Error saving cable ${line.name || "Unnamed"}`);
        return false;
      }
    },
    [prepareCablePayload, handleApiError]
  );

  // Save all new fiber lines
  const saveNewFiberLines = useCallback(async () => {
    const cablesToSave = fiberLines.filter(
      (line) => line.startPortId && line.endPortId
    );
    const cablesToKeep = fiberLines.filter(
      (line) => !line.startPortId || !line.endPortId
    );

    const savePromises = cablesToSave.map((line) => saveNewCable(line));
    const results = await Promise.all(savePromises);

    if (results.every((result) => result)) {
      // Remove saved cables from fiberLines immediately
      setFiberLines(cablesToKeep);
      return true;
    }
    // Keep all cables if save fails to prevent data loss
    return false;
  }, [fiberLines, saveNewCable]);

  // Save a single modified cable
  const saveModifiedCable = useCallback(
    async (cableId, cable) => {
      if (!cable.hasEditedCables || !cable.startPortId || !cable.endPortId) {
        return true; // Skip cables that haven't been edited or are incomplete
      }

      const interfaceId = cableId.split("-")[1];
      const payload = prepareCablePayload(cable);

      try {
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

        if (!response.ok) {
          throw new Error(
            `Failed to update cable ${cable.name || "Unnamed"}: ${response.status}`
          );
        }
        return true;
      } catch (error) {
        handleApiError(
          error,
          `Error updating cable ${cable.name || "Unnamed"}`
        );
        return false;
      }
    },
    [prepareCablePayload, handleApiError]
  );

  // Save all modified cables
  const saveModifiedCablesFn = useCallback(async () => {
    const savePromises = Object.entries(modifiedCables).map(
      ([cableId, cable]) => saveModifiedCable(cableId, cable)
    );
    const results = await Promise.all(savePromises);

    return results.every((result) => result);
  }, [modifiedCables, saveModifiedCable]);

  // Main auto-save orchestration
  const autoSave = useCallback(async () => {
    try {
      setIsAutoSaving(true);

      const devicesSaved = await saveUpdatedDevices();
      const newCablesSaved = await saveNewFiberLines();
      const modifiedCablesSaved = await saveModifiedCablesFn();

      if (devicesSaved && newCablesSaved && modifiedCablesSaved) {
        // Fetch new data before clearing states
        const [devicesFetched, cablesFetched] = await Promise.all([
          fetchDevices(),
          fetchCables(),
        ]);

        if (devicesFetched && cablesFetched) {
          // Clear states only if fetches are successful
          setUpdatedDevices([]);
          setSelectedLineForActions(null);
          setLineActionPosition(null);
          setExactClickPosition(null);
          setTempCable(null);
          // Clear modifiedCables for successfully saved or irrelevant cables
          setModifiedCables((prev) => {
            const updated = {};
            Object.entries(prev).forEach(([cableId, cable]) => {
              // Only keep incomplete cables that were edited but not saved
              if (!cable.startPortId || !cable.endPortId) {
                updated[cableId] = { ...cable, hasEditedCables: false };
              }
            });
            return updated;
          });
          setHasEditedCables(false); // Reset hasEditedCables
        } else {
          throw new Error("Failed to fetch updated data after saving");
        }
      } else {
        throw new Error("One or more save operations failed");
      }
    } catch (error) {
      handleApiError(error, "Error during auto-save");
    } finally {
      setIsAutoSaving(false);
    }
  }, [
    saveUpdatedDevices,
    saveNewFiberLines,
    saveModifiedCablesFn,
    fetchDevices,
    fetchCables,
    handleApiError,
  ]);

  // Debounced auto-save
  const debouncedAutoSave = useMemo(() => debounce(autoSave, 1000), [autoSave]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedAutoSave.cancel();
    };
  }, [debouncedAutoSave]);

  // Trigger auto-save when necessary
  useEffect(() => {
    const hasCablesToSave =
      fiberLines.some((line) => line.startPortId && line.endPortId) ||
      Object.values(modifiedCables).some(
        (cable) => cable.startPortId && cable.endPortId && cable.hasEditedCables
      ) ||
      updatedDevices.length > 0;

    if (hasCablesToSave && !isAutoSaving) {
      // console.log("Triggering autoSave due to:", {
      //   fiberLines: fiberLines.length,
      //   modifiedCables: Object.keys(modifiedCables).length,
      //   updatedDevices: updatedDevices.length,
      // });

      debouncedAutoSave();
    }
  }, [
    fiberLines,
    modifiedCables,
    updatedDevices,
    debouncedAutoSave,
    isAutoSaving,
  ]);

  // Delete saved polyline
  const removeSavedSelectedLine = useCallback(async () => {
    if (!selectedLineForActions) return;
    const { index, isSavedLine } = selectedLineForActions;
    if (!isSavedLine) return;
    const line = savedPolylines[index];
    if (!window.confirm(`Are you sure you want to delete cable ${line.type}?`))
      return;

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
      debouncedAutoSave();
    } catch (error) {
      handleApiError(error, "Error deleting line");
    }
  }, [
    selectedLineForActions,
    savedPolylines,
    handleApiError,
    debouncedAutoSave,
  ]);

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
          // deviceName: `${type}-${nextNumber}`,
          deviceName: "",
          description: "",
          deviceModelId: "",
          // ports: [
          //   { name: `Port 1-${type}-${nextNumber}`, position: 1 },
          //   { name: `Port 2-${type}-${nextNumber}`, position: 2 },
          // ],
          ports: [
            { name: "Port 1", position: 1 },
            { name: "Port 2", position: 2 },
          ],
          // name: `${selectedPoint.lat.toFixed(2)}-${type}`,
          name: "",
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
        debouncedAutoSave();

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
      } catch (error) {
        handleApiError(error, `Error creating ${deviceFormData.type}`);
      }
    },
    [
      deviceFormData,
      deviceForm,
      fetchDevices,
      handleApiError,
      debouncedAutoSave,
    ]
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

      const selectedPort = allPorts.find(
        (port) => port.id === parseInt(selectedPortId)
      );

      if (tempCable.id.startsWith("cable-")) {
        // Handle saved polylines
        setModifiedCables((prev) => {
          const baseCable =
            prev[tempCable.id] ||
            savedPolylines.find((p) => p.id === tempCable.id);
          if (!baseCable) return prev;

          const updatedCable = {
            ...baseCable,
            [`${portDropdownEnd === "start" ? "start" : "end"}DeviceId`]:
              portDropdownDevice?.deviceId || null,
            [`${portDropdownEnd === "start" ? "start" : "end"}PortId`]:
              selectedPortId,
            [`${portDropdownEnd === "start" ? "start" : "end"}PortName`]:
              selectedPort?.name || `Port-${selectedPortId}`,
            hasEditedCables: true,
          };

          return {
            ...prev,
            [tempCable.id]: updatedCable,
          };
        });
        setHasEditedCables(true);
      } else {
        // Handle new fiber lines
        setFiberLines((prev) => {
          const updatedLines = prev.map((line) => {
            if (line.id !== tempCable.id) return line;

            const updatedLine = {
              ...line,
              [`${portDropdownEnd === "start" ? "start" : "end"}PortId`]:
                selectedPortId,
              [`${portDropdownEnd === "start" ? "start" : "end"}PortName`]:
                selectedPort?.name || `Port-${selectedPortId}`,
              [`${portDropdownEnd === "start" ? "start" : "end"}DeviceId`]:
                portDropdownDevice?.deviceId || null,
            };

            return updatedLine;
          });

          return updatedLines;
        });
      }

      // Clear previous state after successful port selection
      setPreviousCableState(null);

      // Close port dropdown
      setShowPortDropdown(false);
      setPortDropdownPosition(null);
      setPortDropdownDevice(null);
      setPortDropdownPorts([]);
      setSelectedPortId(null);
      setPortDropdownEnd(null);
      setTempCable(null);
    },
    [
      selectedPortId,
      tempCable,
      allPorts,
      portDropdownEnd,
      portDropdownDevice,
      savedPolylines,
    ]
  );

  // Handle port dropdown change
  const handlePortDropdownChange = useCallback((portId) => {
    setSelectedPortId(portId);
  }, []);

  // Close port dropdown
  // const closePortDropdown = useCallback(() => {
  //   if (tempCable && !selectedPortId) {
  //     // alert("Port selection is required to connect the cable to a device.");
  //     if (previousCableState) {
  //       if (tempCable.id.startsWith("cable-")) {
  //         // Revert modified saved polyline
  //         setModifiedCables((prev) => {
  //           const updated = { ...prev };
  //           updated[tempCable.id] = {
  //             ...previousCableState,
  //             hasEditedCables: true,
  //           };
  //           return updated;
  //         });
  //         setHasEditedCables(true);
  //       } else {
  //         // Revert new fiber line
  //         setFiberLines((prev) =>
  //           prev.map((line) =>
  //             line.id === tempCable.id ? { ...previousCableState } : line
  //           )
  //         );
  //       }
  //     }
  //   }

  //   setShowPortDropdown(false);
  //   setPortDropdownPosition(null);
  //   setPortDropdownDevice(null);
  //   setPortDropdownPorts([]);
  //   setSelectedPortId(null);
  //   setPortDropdownEnd(null);
  //   setTempCable(null);
  //   setPreviousCableState(null);
  // }, [tempCable, selectedPortId, previousCableState]);

  const closePortDropdown = useCallback(() => {
    // Show alert if a cable is being edited and the modal is open (indicating cancellation)
    if (tempCable && showPortDropdown) {
      // alert("Port selection is required to connect the cable to a device.");
      if (previousCableState) {
        if (tempCable.id.startsWith("cable-")) {
          // Revert modified saved polyline
          setModifiedCables((prev) => {
            const updated = { ...prev };
            updated[tempCable.id] = {
              ...previousCableState,
              hasEditedCables: true,
            };
            return updated;
          });
          setHasEditedCables(true);
        } else {
          // Revert new fiber line
          setFiberLines((prev) =>
            prev.map((line) =>
              line.id === tempCable.id ? { ...previousCableState } : line
            )
          );
        }
      }
    }

    // Clear modal-related states
    setShowPortDropdown(false);
    setPortDropdownPosition(null);
    setPortDropdownDevice(null);
    setPortDropdownPorts([]);
    setSelectedPortId(null);
    setPortDropdownEnd(null);
    setTempCable(null);
    setPreviousCableState(null);
  }, [tempCable, showPortDropdown, previousCableState]);

  // Handle right-click on icon
  const handleRightClickOnIcon = useCallback((icon, e) => {
    if (e.domEvent.button !== 2) return;
    e.domEvent.preventDefault();
    e.domEvent.stopPropagation();

    setSelectedPoint({
      ...icon,
      x: e.domEvent.clientX,
      y: e.domEvent.clientY,
    });
    setRightClickMarker(icon);
    setShowModal(true);
  }, []);

  // Handle line click
  const handleLineClick = useCallback((line, index, isSavedLine, e) => {
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
  }, []);

  // Add waypoint
  const addWaypoint = useCallback(() => {
    if (!selectedLineForActions || !exactClickPosition) return;
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
            type: baseCable.type || "Fiber",
            hasEditedCables: true,
          },
        };
      });
      setHasEditedCables(true);
    } else {
      setFiberLines((prev) => {
        const updatedLines = [...prev];
        const updatedWaypoints = updatedLines[index].waypoints
          ? [...prev[index].waypoints]
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
  }, [selectedLineForActions, exactClickPosition, modifiedCables]);

  // Handle waypoint click
  const handleWaypointClick = useCallback(
    (line, index, waypointIndex, isSavedLine, e) => {
      e.domEvent.stopPropagation();
      setSelectedWaypoint({
        line,
        lineIndex: index,
        waypointIndex,
        isSavedLine,
        position: {
          x: e.domEvent.clientX,
          y: e.domEvent.clientY,
        },
      });
    },
    []
  );

  // Remove waypoint
  const removeWaypoint = useCallback(() => {
    if (!selectedWaypoint) return;
    const { line, lineIndex, waypointIndex, isSavedLine } = selectedWaypoint;

    if (isSavedLine) {
      setModifiedCables((prev) => {
        const baseCable =
          prev[line.id] || savedPolylines.find((p) => p.id === line.id);
        if (!baseCable || !baseCable.waypoints) return prev;
        const updatedWaypoints = baseCable.waypoints.filter(
          (_, idx) => idx !== waypointIndex
        );
        return {
          ...prev,
          [line.id]: {
            ...baseCable,
            waypoints: updatedWaypoints,
            type: baseCable.type || "Fiber",
            hasEditedCables: true,
          },
        };
      });
      setHasEditedCables(true);
    } else {
      setFiberLines((prev) => {
        const updatedLines = [...prev];
        const line = updatedLines[lineIndex];
        if (!line || !line.waypoints) return prev;
        updatedLines[lineIndex] = {
          ...line,
          waypoints: line.waypoints.filter((_, idx) => idx !== waypointIndex),
        };
        return updatedLines;
      });
    }
    setSelectedWaypoint(null);
  }, [selectedWaypoint, savedPolylines]);

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
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedDevice.type} device?`
      )
    )
      return;
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
      debouncedAutoSave();
    } catch (error) {
      handleApiError(error, "Error removing device");
    }
  }, [selectedDevice, handleApiError, debouncedAutoSave]);

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(
    (iconId, e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();

      setImageIcons((prev) => {
        const draggedIcon = prev.find((icon) => icon.id === iconId);
        if (!draggedIcon) {
          console.warn(`No icon found for id: ${iconId}`);
          return prev;
        }

        // Update imageIcons with new position
        const updatedIcons = prev.map((icon) =>
          icon.id === iconId ? { ...icon, lat: newLat, lng: newLng } : icon
        );

        // Update updatedDevices
        const deviceId = draggedIcon.deviceId;
        setUpdatedDevices((prevDevices) => {
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

        // Update connected cables
        setSavedPolylines((prev) =>
          prev.map((polyline) => {
            let updatedPolyline = { ...polyline };
            let hasChanges = false;
            if (
              polyline.startDeviceId === draggedIcon.deviceId &&
              isSnappedToIcon(polyline.from.lat, polyline.from.lng)
            ) {
              updatedPolyline.from = { lat: newLat, lng: newLng };
              hasChanges = true;
            }
            if (
              polyline.endDeviceId === draggedIcon.deviceId &&
              isSnappedToIcon(polyline.to.lat, polyline.to.lng)
            ) {
              updatedPolyline.to = { lat: newLat, lng: newLng };
              hasChanges = true;
            }
            if (polyline.waypoints) {
              const updatedWaypoints = polyline.waypoints.map((wp) =>
                isSnappedToIcon(wp.lat, wp.lng) &&
                findNearestIcon(wp.lat, wp.lng)?.deviceId ===
                  draggedIcon.deviceId
                  ? { lat: newLat, lng: newLng }
                  : wp
              );
              if (
                updatedWaypoints.some(
                  (wp, i) =>
                    wp.lat !== polyline.waypoints[i]?.lat ||
                    wp.lng !== polyline.waypoints[i]?.lng
                )
              ) {
                updatedPolyline.waypoints = updatedWaypoints;
                hasChanges = true;
              }
            }
            if (hasChanges) {
              setModifiedCables((prev) => ({
                ...prev,
                [polyline.id]: {
                  ...polyline,
                  from: updatedPolyline.from,
                  to: updatedPolyline.to,
                  waypoints: updatedPolyline.waypoints,
                  type: polyline.type || "Fiber",
                  hasEditedCables: true,
                },
              }));
              setHasEditedCables(true);
            }
            return updatedPolyline;
          })
        );

        setFiberLines((prevLines) =>
          prevLines.map((line) => {
            let updatedLine = { ...line };
            let hasChanges = false;
            if (
              line.startDeviceId === draggedIcon.deviceId &&
              isSnappedToIcon(line.from.lat, line.from.lng)
            ) {
              updatedLine.from = { lat: newLat, lng: newLng };
              hasChanges = true;
            }
            if (
              line.endDeviceId === draggedIcon.deviceId &&
              isSnappedToIcon(line.to.lat, line.to.lng)
            ) {
              updatedLine.to = { lat: newLat, lng: newLng };
              hasChanges = true;
            }
            if (line.waypoints) {
              const updatedWaypoints = line.waypoints.map((wp) =>
                isSnappedToIcon(wp.lat, wp.lng) &&
                findNearestIcon(wp.lat, wp.lng)?.deviceId ===
                  draggedIcon.deviceId
                  ? { lat: newLat, lng: newLng }
                  : wp
              );
              if (
                updatedWaypoints.some(
                  (wp, i) =>
                    wp.lat !== line.waypoints[i]?.lat ||
                    wp.lng !== line.waypoints[i]?.lng
                )
              ) {
                updatedLine.waypoints = updatedWaypoints;
                hasChanges = true;
              }
            }
            return updatedLine;
          })
        );

        return updatedIcons;
      });
    },
    [isSnappedToIcon, findNearestIcon]
  );

  // Generate unique ID
  const generateUniqueId = useCallback(
    () => `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    []
  );

  // Add fiber line
  const addFiberLine = useCallback(() => {
    if (!rightClickMarker || !fiberFormData.type.trim()) {
      alert("Fiber type is required.");
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
      if (showPortDropdown && tempCable && !tempCable.startPortId) {
        alert(
          "Please select a port for the current connection before connecting the other end."
        );
        if (previousCableState && tempCable.id === previousCableState.id) {
          setFiberLines((prev) =>
            prev.map((line) =>
              line.id === tempCable.id
                ? {
                    ...previousCableState,
                    from: { ...previousCableState.from },
                    to: { ...previousCableState.to },
                    waypoints: previousCableState.waypoints
                      ? [...previousCableState.waypoints]
                      : [],
                  }
                : line
            )
          );
          setTempCable({
            ...previousCableState,
            from: { ...previousCableState.from },
            to: { ...previousCableState.to },
            waypoints: previousCableState.waypoints
              ? [...previousCableState.waypoints]
              : [],
          });
          setShowPortDropdown(false);
          setPortDropdownPosition(null);
          setPortDropdownDevice(null);
          setPortDropdownPorts([]);
          setSelectedPortId(null);
          setPortDropdownEnd(null);
          setPreviousCableState(null);
        }
        return;
      }

      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      const nearestIcon = findNearestIcon(newLat, newLng);

      setFiberLines((prev) => {
        const updatedLines = [...prev];
        const line = updatedLines[index];
        if (!line) return prev;

        setPreviousCableState({
          ...line,
          from: { ...line.from },
          to: { ...line.to },
        });

        const newFrom = nearestIcon
          ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
          : { lat: newLat, lng: newLng };

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
            setTempCable({
              ...line,
              from: newFrom,
              startDeviceId: nearestIcon?.deviceId || null,
              startPortId: null,
              startPortName: null,
            });
            updatedLines[index] = {
              ...line,
              from: newFrom,
              startDeviceId: nearestIcon?.deviceId || null,
              startPortId: null,
              startPortName: null,
            };
          } else {
            alert(
              "No available ports on this device. Please select another device."
            );
            if (previousCableState) {
              updatedLines[index] = {
                ...previousCableState,
                from: { ...previousCableState.from },
                to: { ...previousCableState.to },
                waypoints: previousCableState.waypoints
                  ? [...previousCableState.waypoints]
                  : [],
              };
              setTempCable({
                ...previousCableState,
                from: { ...previousCableState.from },
                to: { ...previousCableState.to },
                waypoints: previousCableState.waypoints
                  ? [...previousCableState.waypoints]
                  : [],
              });
            } else {
              setTempCable(null);
            }
            setShowPortDropdown(false);
            setPortDropdownPosition(null);
            setPortDropdownDevice(null);
            setPortDropdownPorts([]);
            setSelectedPortId(null);
            setPortDropdownEnd(null);
            setPreviousCableState(null);
            return updatedLines;
          }
        } else {
          updatedLines[index] = {
            ...line,
            from: newFrom,
            startDeviceId: null,
            startPortId: null,
            startPortName: null,
          };
          setShowPortDropdown(false);
          setPortDropdownPosition(null);
          setPortDropdownDevice(null);
          setPortDropdownPorts([]);
          setSelectedPortId(null);
          setTempCable(null);
          setPreviousCableState(null);
        }
        return updatedLines;
      });
    },
    [
      findNearestIcon,
      allPorts,
      usedPorts,
      showPortDropdown,
      tempCable,
      previousCableState,
    ]
  );

  // Handle end marker drag end
  const handleEndMarkerDragEnd = useCallback(
    (index, e) => {
      if (showPortDropdown && tempCable && !tempCable.endPortId) {
        alert(
          "Please select a port for the current connection before connecting the other end."
        );
        if (previousCableState && tempCable.id === previousCableState.id) {
          setFiberLines((prev) =>
            prev.map((line) =>
              line.id === tempCable.id
                ? {
                    ...previousCableState,
                    from: { ...previousCableState.from },
                    to: { ...previousCableState.to },
                    waypoints: previousCableState.waypoints
                      ? [...previousCableState.waypoints]
                      : [],
                  }
                : line
            )
          );
          setTempCable({
            ...previousCableState,
            from: { ...previousCableState.from },
            to: { ...previousCableState.to },
            waypoints: previousCableState.waypoints
              ? [...previousCableState.waypoints]
              : [],
          });
          setShowPortDropdown(false);
          setPortDropdownPosition(null);
          setPortDropdownDevice(null);
          setPortDropdownPorts([]);
          setSelectedPortId(null);
          setPortDropdownEnd(null);
          setPreviousCableState(null);
        }
        return;
      }

      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      const nearestIcon = findNearestIcon(newLat, newLng);

      setFiberLines((prev) => {
        const updatedLines = [...prev];
        const line = updatedLines[index];
        if (!line) return prev;

        setPreviousCableState({
          ...line,
          from: { ...line.from },
          to: { ...line.to },
        });

        const newTo = nearestIcon
          ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
          : { lat: newLat, lng: newLng };

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
            setTempCable({
              ...line,
              to: newTo,
              endDeviceId: nearestIcon?.deviceId || null,
              endPortId: null,
              endPortName: null,
            });
            updatedLines[index] = {
              ...line,
              to: newTo,
              endDeviceId: nearestIcon?.deviceId || null,
              endPortId: null,
              endPortName: null,
            };
          } else {
            alert(
              "No available ports on this device. Please select another device."
            );
            if (previousCableState) {
              updatedLines[index] = {
                ...previousCableState,
                from: { ...previousCableState.from },
                to: { ...previousCableState.to },
                waypoints: previousCableState.waypoints
                  ? [...previousCableState.waypoints]
                  : [],
              };
              setTempCable({
                ...previousCableState,
                from: { ...previousCableState.from },
                to: { ...previousCableState.to },
                waypoints: previousCableState.waypoints
                  ? [...previousCableState.waypoints]
                  : [],
              });
            } else {
              setTempCable(null);
            }
            setShowPortDropdown(false);
            setPortDropdownPosition(null);
            setPortDropdownDevice(null);
            setPortDropdownPorts([]);
            setSelectedPortId(null);
            setPortDropdownEnd(null);
            setPreviousCableState(null);
            return updatedLines;
          }
        } else {
          updatedLines[index] = {
            ...line,
            to: newTo,
            endDeviceId: null,
            endPortId: null,
            endPortName: null,
          };
          setShowPortDropdown(false);
          setPortDropdownPosition(null);
          setPortDropdownDevice(null);
          setPortDropdownPorts([]);
          setSelectedPortId(null);
          setTempCable(null);
          setPreviousCableState(null);
        }
        return updatedLines;
      });
    },
    [
      findNearestIcon,
      allPorts,
      usedPorts,
      showPortDropdown,
      tempCable,
      previousCableState,
    ]
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
      if (
        showPortDropdown &&
        tempCable &&
        ((pointType === "from" && !tempCable.endPortId) ||
          (pointType === "to" && !tempCable.startPortId))
      ) {
        alert(
          "Please select a port for the current connection before connecting the other end."
        );
        if (previousCableState && tempCable.id === previousCableState.id) {
          setModifiedCables((prev) => {
            const updated = { ...prev };
            updated[tempCable.id] = {
              ...previousCableState,
              from: { ...previousCableState.from },
              to: { ...previousCableState.to },
              waypoints: previousCableState.waypoints
                ? [...previousCableState.waypoints]
                : [],
              hasEditedCables: false, // Reset hasEditedCables
            };
            return updated;
          });
          setHasEditedCables(false); // Reset hasEditedCables
          setTempCable({
            ...previousCableState,
            from: { ...previousCableState.from },
            to: { ...previousCableState.to },
            waypoints: previousCableState.waypoints
              ? [...previousCableState.waypoints]
              : [],
          });
          setShowPortDropdown(false);
          setPortDropdownPosition(null);
          setPortDropdownDevice(null);
          setPortDropdownPorts([]);
          setSelectedPortId(null);
          setPortDropdownEnd(null);
          setPreviousCableState(null);
        }
        return;
      }

      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      const nearestIcon = findNearestIcon(newLat, newLng);

      setModifiedCables((prev) => {
        const baseCable =
          prev[polylineId] || savedPolylines.find((p) => p.id === polylineId);
        if (!baseCable) return prev;

        setPreviousCableState({
          ...baseCable,
          from: { ...baseCable.from },
          to: { ...baseCable.to },
        });

        const newPosition = nearestIcon
          ? { lat: nearestIcon.lat, lng: nearestIcon.lng }
          : { lat: newLat, lng: newLng };

        if (nearestIcon?.portIds?.length > 0) {
          const devicePorts = allPorts.filter(
            (port) =>
              nearestIcon.portIds.includes(port.id) &&
              !usedPorts.includes(port.id)
          );
          if (devicePorts.length > 0) {
            const updatedCable = {
              ...baseCable,
              [pointType]: newPosition,
              [`${pointType}DeviceId`]: nearestIcon?.deviceId || null,
              type: baseCable.type || "Fiber",
              hasEditedCables: true,
            };
            if (!nearestIcon) {
              updatedCable[`${pointType}PortId`] = null;
              updatedCable[`${pointType}PortName`] = null;
            }
            setShowPortDropdown(true);
            setPortDropdownPosition({
              x: e.domEvent?.clientX || window.innerWidth / 2,
              y: e.domEvent?.clientY || window.innerHeight / 2,
            });
            setPortDropdownDevice(nearestIcon);
            setPortDropdownPorts(devicePorts);
            setPortDropdownEnd(pointType);
            setTempCable({
              id: polylineId,
              [pointType]: newPosition,
              [`${pointType}DeviceId`]: nearestIcon?.deviceId || null,
            });
            setHasEditedCables(true);
            return {
              ...prev,
              [polylineId]: updatedCable,
            };
          } else {
            alert(
              "No available ports on this device. Please select another device."
            );
            if (previousCableState) {
              const updatedCable = {
                ...previousCableState,
                from: { ...previousCableState.from },
                to: { ...previousCableState.to },
                waypoints: previousCableState.waypoints
                  ? [...previousCableState.waypoints]
                  : [],
                hasEditedCables: false, // Reset hasEditedCables
              };
              setHasEditedCables(false); // Reset hasEditedCables
              setTempCable({
                ...previousCableState,
                from: { ...previousCableState.from },
                to: { ...previousCableState.to },
                waypoints: previousCableState.waypoints
                  ? [...previousCableState.waypoints]
                  : [],
              });
              return {
                ...prev,
                [polylineId]: updatedCable,
              };
            } else {
              setTempCable(null);
              return prev;
            }
          }
        } else {
          const updatedCable = {
            ...baseCable,
            [pointType]: newPosition,
            [`${pointType}DeviceId`]: null,
            [`${pointType}PortId`]: null,
            [`${pointType}PortName`]: null,
            type: baseCable.type || "Fiber",
            hasEditedCables: true, // Keep hasEditedCables true for valid edits
          };
          setHasEditedCables(true);
          setShowPortDropdown(false);
          setPortDropdownPosition(null);
          setPortDropdownDevice(null);
          setPortDropdownPorts([]);
          setSelectedPortId(null);
          setTempCable(null);
          setPreviousCableState(null);
          return {
            ...prev,
            [polylineId]: updatedCable,
          };
        }
      });
    },
    [
      findNearestIcon,
      savedPolylines,
      allPorts,
      usedPorts,
      showPortDropdown,
      tempCable,
      previousCableState,
    ]
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
            type: baseCable.type || "Fiber",
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

  useEffect(() => {
    fetchDevices();
    fetchCables();
  }, [fetchDevices, fetchCables]);

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading Maps...</div>;

  return (
    <>
      <MapComponent
        imageIcons={imageIcons}
        fiberLines={fiberLines}
        savedPolylines={savedPolylines}
        rightClickMarker={rightClickMarker}
        showSavedRoutes={showSavedRoutes}
        selectedLineForActions={selectedLineForActions}
        exactClickPosition={exactClickPosition}
        modifiedCables={modifiedCables}
        isSnappedToIcon={isSnappedToIcon}
        handleMapRightClick={handleMapRightClick}
        handleRightClickOnIcon={handleRightClickOnIcon}
        handleIconClick={handleIconClick}
        handleLineClick={handleLineClick}
        handleMarkerDragEnd={handleMarkerDragEnd}
        handleStartMarkerDragEnd={handleStartMarkerDragEnd}
        handleEndMarkerDragEnd={handleEndMarkerDragEnd}
        handleWaypointDragEnd={handleWaypointDragEnd}
        handleSavedPolylinePointDragEnd={handleSavedPolylinePointDragEnd}
        handleSavedPolylineWaypointDragEnd={handleSavedPolylineWaypointDragEnd}
        addWaypoint={addWaypoint}
        removeSavedSelectedLine={removeSavedSelectedLine}
        setFiberLines={setFiberLines}
        setSelectedLineForActions={setSelectedLineForActions}
        setLineActionPosition={setLineActionPosition}
        setExactClickPosition={setExactClickPosition}
        setModifiedCables={setModifiedCables}
        setHasEditedCables={setHasEditedCables}
        onMapLoad={onMapLoad}
        handleWaypointClick={handleWaypointClick}
      />
      <ContextMenuModal
        isVisible={showModal}
        selectedPoint={selectedPoint}
        deviceTypes={deviceTypes}
        handleSelection={handleSelection}
        onClose={() => {
          setShowModal(false);
          setRightClickMarker(null);
        }}
      />
      <FiberFormModal
        isVisible={showFiberForm}
        rightClickMarker={rightClickMarker}
        fiberFormData={fiberFormData}
        setFiberFormData={setFiberFormData}
        onSubmit={addFiberLine}
        onCancel={() => {
          setShowFiberForm(false);
          setRightClickMarker(null);
          setFiberFormData({ name: "", type: "Fiber" });
        }}
      />
      <DeviceModal
        isVisible={showDeviceModal}
        selectedDevice={selectedDevice}
        deviceModalPosition={deviceModalPosition}
        onRemove={removeSelectedIcon}
        onClose={() => {
          setShowDeviceModal(false);
          setSelectedDevice(null);
          setDeviceModalPosition(null);
        }}
      />
      <DeviceFormModal
        isVisible={showDeviceForm}
        deviceFormData={deviceFormData}
        deviceForm={deviceForm}
        deviceTypes={deviceTypes}
        handleDeviceFormSubmit={handleDeviceFormSubmit}
        handleDeviceFormInputChange={handleDeviceFormInputChange}
        handlePortChange={handlePortChange}
        addPort={addPort}
        removePort={removePort}
        onCancel={() => {
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
        }}
      />
      <PortDropdownModal
        isVisible={showPortDropdown}
        portDropdownPosition={portDropdownPosition}
        portDropdownDevice={portDropdownDevice}
        ports={portDropdownPorts || []}
        selectedPortId={selectedPortId}
        portDropdownEnd={portDropdownEnd}
        handlePortSelection={handlePortSelection}
        handlePortDropdownChange={handlePortDropdownChange}
        onCancel={closePortDropdown}
      />
      <WaypointActionModal
        isVisible={!!selectedWaypoint}
        selectedWaypoint={selectedWaypoint}
        onRemove={removeWaypoint}
        onClose={() => setSelectedWaypoint(null)}
      />
      <ControlPanel
        showSavedRoutes={showSavedRoutes}
        setShowSavedRoutes={setShowSavedRoutes}
        isAutoSaving={isAutoSaving}
        hasEditedCables={hasEditedCables}
        fiberLines={fiberLines}
      />
    </>
  );
};

export default FiberMapPage;
