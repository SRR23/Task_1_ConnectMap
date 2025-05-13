import React from 'react';

const AllState = () => {

    // Route Management
const [savedRoutes, setSavedRoutes] = useState([]);
const [nextNumber, setNextNumber] = useState(1);
const [savedPolylines, setSavedPolylines] = useState([]);
const [savedIcons, setSavedIcons] = useState([]);
const [showSavedRoutes, setShowSavedRoutes] = useState(false);
const [isSavedRoutesEditable, setIsSavedRoutesEditable] = useState(false);

// Map Interaction
const [selectedType, setSelectedType] = useState(null);
const [selectedPoint, setSelectedPoint] = useState(null);
const [rightClickMarker, setRightClickMarker] = useState(null);
const [exactClickPosition, setExactClickPosition] = useState(null);
const [fiberLines, setFiberLines] = useState([]);
const [imageIcons, setImageIcons] = useState([]);

// Line Actions
const [selectedLineForActions, setSelectedLineForActions] = useState(null);
const [lineActionPosition, setLineActionPosition] = useState(null);
const [editingLineId, setEditingLineId] = useState(null);
const [tempLineName, setTempLineName] = useState("");

// Waypoint Actions
const [selectedWaypoint, setSelectedWaypoint] = useState(null);
const [waypointActionPosition, setWaypointActionPosition] = useState(null);
const [selectedWaypointInfo, setSelectedWaypointInfo] = useState(null);

// Splitter Modal
const [showSplitterModal, setShowSplitterModal] = useState(false);
const [selectedSplitter, setSelectedSplitter] = useState(null);
const [splitterRatio, setSplitterRatio] = useState("");

// Termination Modal
const [showTerminationModal, setShowTerminationModal] = useState(false);
const [selectedTermination, setSelectedTermination] = useState(null);
const [terminationConnections, setTerminationConnections] = useState([]);
const [tempConnection, setTempConnection] = useState(null);
const [hasEditedCables, setHasEditedCables] = useState(false);

// Device Management
const [updatedDevices, setUpdatedDevices] = useState([]);
const [showDeviceForm, setShowDeviceForm] = useState(false);
const [deviceFormData, setDeviceFormData] = useState(null); // Added deviceFormData
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

// Port Selection
const [showPortDropdown, setShowPortDropdown] = useState(false);
const [portDropdownPosition, setPortDropdownPosition] = useState(null);
const [portDropdownDevice, setPortDropdownDevice] = useState(null);
const [portDropdownPorts, setPortDropdownPorts] = useState([]);
const [selectedPortId, setSelectedPortId] = useState(null);
const [portDropdownEnd, setPortDropdownEnd] = useState(null);
const [tempCable, setTempCable] = useState(null);
const [startPortId, setStartPortId] = useState(null);
const [endPortId, setEndPortId] = useState(null);
const [allPorts, setAllPorts] = useState([]);

// Fiber Form
const [showFiberForm, setShowFiberForm] = useState(false);
const [fiberFormData, setFiberFormData] = useState({
  name: "",
  type: "Fiber",
});
const [cableSaveAttempted, setCableSaveAttempted] = useState(false);


    return (
        <div>
            
        </div>
    );
};

export default AllState;