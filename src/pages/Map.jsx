// import React, { useRef } from "react";
// import { useLoadScript, MarkerF } from "@react-google-maps/api";
// import { useMapState } from "../hooks/useMapState";
// import { useMapInteractions } from "../hooks/useMapInteractions";
// import { useMapPersistence } from "../hooks/useMapPersistence";
// import MapContainer from "../components/MapContainer";
// import MapControls from "../components/MapControls";
// import MapMarkers from "../components/MapMarkers";
// import MapPolylines from "../components/MapPolylines";
// import ContextMenu from "../components/ContextMenu";
// import WaypointActions from "../components/WaypointActions";
// import LineActions from "../components/LineActions";
// import { iconImages } from "../constants/iconImages";
// import MapLayout from "../layout/MapLayout";

// const Map = () => {
//   const { isLoaded, loadError } = useLoadScript({
//     googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
//   });
//   const fileInputRef = useRef(null);

//   const { mapState, setMapState } = useMapState();
//   const generateUniqueId = () =>
//     `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
//   const {
//     handleMapRightClick,
//     handleSelection,
//     addFiberLine,
//     handleLineClick,
//     addWaypoint,
//     handleWaypointClick,
//     removeSelectedWaypoint,
//     removeSelectedLine,
//     handleMarkerDragEnd,
//     handleStartMarkerDragEnd,
//     handleEndMarkerDragEnd,
//     handleWaypointDragEnd,
//     handleRightClickOnIcon,
//     handleSavedIconDragEnd,
//     handleSavedPolylinePointDragEnd,
//     handleSavedPolylineWaypointDragEnd,
//     handleIconClick,
//   } = useMapInteractions({ mapState, setMapState, generateUniqueId });
//   const { saveRoute } = useMapPersistence({ mapState, setMapState });

//   const resetMap = () => {
//     setMapState((prev) => ({
//       ...prev,
//       fiberLines: [],
//       imageIcons: [],
//       showModal: false,
//       rightClickMarker: null,
//       nextNumber: 1,
//     }));
//   };

//   // const togglePreviousRoutes = () => {
//   //   setMapState((prev) => ({
//   //     ...prev,
//   //     showSavedRoutes: !prev.showSavedRoutes,
//   //     fiberLines: !prev.showSavedRoutes ? prev.savedPolylines : [],
//   //     imageIcons: !prev.showSavedRoutes ? prev.savedIcons : [],
//   //   }));
//   // };

//   const togglePreviousRoutes = () => {
//     setMapState((prev) => {
//       const newState = {
//         ...prev,
//         showSavedRoutes: !prev.showSavedRoutes,
//         fiberLines: !prev.showSavedRoutes ? prev.savedPolylines : [],
//         imageIcons: !prev.showSavedRoutes ? prev.savedIcons : [],
//       };
//       console.log("Toggled routes:", {
//         savedIcons: newState.showSavedRoutes ? newState.savedIcons : [],
//       });
//       return newState;
//     });
//   };

//   const toggleSavedRoutesEditability = () => {
//     setMapState((prev) => ({
//       ...prev,
//       isSavedRoutesEditable: !prev.isSavedRoutesEditable,
//     }));
//   };

//   const handleAddDeviceIcon = () => {
//     if (fileInputRef.current) {
//       fileInputRef.current.click();
//     }
//   };

//   const handleFileSelection = (e) => {
//     const file = e.target.files[0];
//     if (!file || !mapState.selectedWaypointInfo) return;

//     const { lineIndex, waypointIndex, isSavedLine } =
//       mapState.selectedWaypointInfo;
//     const targetArray = isSavedLine
//       ? mapState.savedPolylines
//       : mapState.fiberLines;
//     const waypoint = targetArray[lineIndex].waypoints[waypointIndex];
//     const imageUrl = URL.createObjectURL(file);

//     const newIcon = {
//       lat: waypoint.lat,
//       lng: waypoint.lng,
//       type: "Custom",
//       id: `custom-icon-${Date.now()}`,
//       imageUrl,
//       linkedTo: { lineIndex, waypointIndex, isSavedLine }, // Ensure linkedTo is always added
//     };

//     console.log("Added icon:", newIcon); // Verify linkedTo is present

//     setMapState((prev) => ({
//       ...prev,
//       imageIcons: [...prev.imageIcons, newIcon],
//       selectedWaypoint: null,
//       waypointActionPosition: null,
//       selectedWaypointInfo: null,
//     }));
//   };

//   const hasLinkedIcon = (lat, lng, icons) => {
//     return icons.some((icon) => icon.lat === lat && icon.lng === lng);
//   };

//   if (loadError) return <div>Error loading maps</div>;
//   if (!isLoaded) return <div>Loading Maps...</div>;


//   return (
//     <MapLayout
//       sidebar={
//         <MapControls
//           resetMap={resetMap}
//           saveRoute={saveRoute}
//           togglePreviousRoutes={togglePreviousRoutes}
//           showSavedRoutes={mapState.showSavedRoutes}
//           toggleSavedRoutesEditability={toggleSavedRoutesEditability}
//           isSavedRoutesEditable={mapState.isSavedRoutesEditable}
//         />
//       }
//       content={
//         <>
//           <input
//             type="file"
//             ref={fileInputRef}
//             style={{ display: "none" }}
//             accept="image/*"
//             onChange={handleFileSelection}
//           />
//           <MapContainer onRightClick={handleMapRightClick}>
//             <MapMarkers
//               icons={mapState.imageIcons}
//               onDragEnd={handleMarkerDragEnd}
//               onRightClick={handleRightClickOnIcon}
//               onClick={handleIconClick}
//               isSaved={false}
//               isEditable={true}
//             />
//             {mapState.showSavedRoutes && (
//               <MapMarkers
//                 icons={mapState.savedIcons}
//                 onDragEnd={handleMarkerDragEnd}
//                 onRightClick={
//                   mapState.isSavedRoutesEditable ? handleRightClickOnIcon : null
//                 }
//                 onClick={
//                   mapState.isSavedRoutesEditable ? handleIconClick : null
//                 }
//                 isSaved={true}
//                 isEditable={mapState.isSavedRoutesEditable}
//                 onSavedIconDragEnd={handleSavedIconDragEnd}
//               />
//             )}
//             {mapState.rightClickMarker && (
//               <MarkerF
//                 position={mapState.rightClickMarker}
//                 icon={{
//                   url: "/img/location.jpg",
//                   scaledSize: new google.maps.Size(20, 20),
//                 }}
//               />
//             )}
//             <MapPolylines
//               lines={mapState.fiberLines}
//               onLineClick={handleLineClick}
//               onWaypointDragEnd={handleWaypointDragEnd}
//               onWaypointClick={handleWaypointClick}
//               onStartMarkerDragEnd={handleStartMarkerDragEnd}
//               onEndMarkerDragEnd={handleEndMarkerDragEnd}
//               isSaved={false}
//               isEditable={true}
//               hideWaypointsWithIcons={mapState.imageIcons}
//               hasLinkedIcon={hasLinkedIcon}
//             />
//             {mapState.showSavedRoutes && (
//               <MapPolylines
//                 lines={mapState.savedPolylines}
//                 onLineClick={handleLineClick}
//                 onWaypointDragEnd={handleWaypointDragEnd}
//                 onWaypointClick={handleWaypointClick}
//                 onStartMarkerDragEnd={handleStartMarkerDragEnd}
//                 onEndMarkerDragEnd={handleEndMarkerDragEnd}
//                 isSaved={true}
//                 isEditable={mapState.isSavedRoutesEditable}
//                 onSavedPolylinePointDragEnd={handleSavedPolylinePointDragEnd}
//                 onSavedPolylineWaypointDragEnd={
//                   handleSavedPolylineWaypointDragEnd
//                 }
//                 hideWaypointsWithIcons={mapState.savedIcons}
//                 hasLinkedIcon={hasLinkedIcon}
//               />
//             )}
//           </MapContainer>
//           <ContextMenu
//             show={mapState.showModal && !mapState.waypointActionPosition}
//             position={mapState.selectedPoint}
//             onClose={() =>
//               setMapState((prev) => ({
//                 ...prev,
//                 showModal: false,
//                 rightClickMarker: null,
//               }))
//             }
//             onSelect={(type) =>
//               type === "Add Fiber" ? addFiberLine() : handleSelection(type)
//             }
//             options={[...Object.keys(iconImages), "Add Fiber"]}
//           />
//           <WaypointActions
//             position={mapState.waypointActionPosition}
//             onRemoveWaypoint={removeSelectedWaypoint}
//             onAddDeviceIcon={handleAddDeviceIcon}
//             onClose={() =>
//               setMapState((prev) => ({
//                 ...prev,
//                 selectedWaypoint: null,
//                 waypointActionPosition: null,
//                 selectedWaypointInfo: null,
//               }))
//             }
//           />
//           <LineActions
//             position={mapState.exactClickPosition}
//             onAddWaypoint={addWaypoint}
//             onRemoveLine={removeSelectedLine}
//             onClose={() =>
//               setMapState((prev) => ({
//                 ...prev,
//                 selectedLineForActions: null,
//                 lineActionPosition: null,
//                 exactClickPosition: null,
//               }))
//             }
//           />
//         </>
//       }
//     />
//   );
// };

// export default Map;

// import React, { useRef } from "react";
// import { useLoadScript, MarkerF } from "@react-google-maps/api";
// import { useMapState } from "../hooks/useMapState";
// import { useMapInteractions } from "../hooks/useMapInteractions";
// import { useMapPersistence } from "../hooks/useMapPersistence";
// import MapContainer from "../components/MapContainer";
// import MapControls from "../components/MapControls";
// import MapMarkers from "../components/MapMarkers";
// import MapPolylines from "../components/MapPolylines";
// import ContextMenu from "../components/ContextMenu";
// import WaypointActions from "../components/WaypointActions";
// import LineActions from "../components/LineActions";
// import { iconImages } from "../constants/iconImages";

// const Map = () => {
//   const { isLoaded, loadError } = useLoadScript({
//     googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
//   });
//   const fileInputRef = useRef(null);

//   const { mapState, setMapState } = useMapState();
//   const generateUniqueId = () =>
//     `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

//   const {
//     handleMapRightClick,
//     handleSelection,
//     addFiberLine,
//     handleLineClick,
//     addWaypoint,
//     handleWaypointClick,
//     removeSelectedWaypoint,
//     removeSelectedLine,
//     handleMarkerDragEnd,
//     handleStartMarkerDragEnd,
//     handleEndMarkerDragEnd,
//     handleWaypointDragEnd,
//     handleRightClickOnIcon,
//     handleSavedIconDragEnd,
//     handleSavedPolylinePointDragEnd,
//     handleSavedPolylineWaypointDragEnd,
//     handleIconClick,
//   } = useMapInteractions({ mapState, setMapState, generateUniqueId });

//   const { saveRoute } = useMapPersistence({ mapState, setMapState });

//   const resetMap = () => {
//     setMapState((prev) => ({
//       ...prev,
//       fiberLines: [],
//       imageIcons: [],
//       showModal: false,
//       rightClickMarker: null,
//       nextNumber: 1,
//     }));
//   };

//   const togglePreviousRoutes = () => {
//     setMapState((prev) => ({
//       ...prev,
//       showSavedRoutes: !prev.showSavedRoutes,
//       fiberLines: !prev.showSavedRoutes ? prev.savedPolylines : [],
//       imageIcons: !prev.showSavedRoutes ? prev.savedIcons : [],
//     }));
//   };

//   const toggleSavedRoutesEditability = () => {
//     setMapState((prev) => ({
//       ...prev,
//       isSavedRoutesEditable: !prev.isSavedRoutesEditable,
//     }));
//   };

//   const handleAddDeviceIcon = () => {
//     fileInputRef.current?.click();
//   };

//   const handleFileSelection = (e) => {
//     const file = e.target.files[0];
//     if (!file || !mapState.selectedWaypointInfo) return;

//     const { lineIndex, waypointIndex, isSavedLine } = mapState.selectedWaypointInfo;
//     const targetArray = isSavedLine ? mapState.savedPolylines : mapState.fiberLines;
//     const waypoint = targetArray[lineIndex].waypoints[waypointIndex];
//     const imageUrl = URL.createObjectURL(file);

//     const newIcon = {
//       lat: waypoint.lat,
//       lng: waypoint.lng,
//       type: "Custom",
//       id: `custom-icon-${Date.now()}`,
//       imageUrl,
//       linkedTo: { lineIndex, waypointIndex, isSavedLine },
//     };

//     setMapState((prev) => ({
//       ...prev,
//       imageIcons: [...prev.imageIcons, newIcon],
//       selectedWaypoint: null,
//       waypointActionPosition: null,
//       selectedWaypointInfo: null,
//     }));
//   };

//   const hasLinkedIcon = (lat, lng, icons) =>
//     icons.some((icon) => icon.lat === lat && icon.lng === lng);

//   if (loadError) return <div>Error loading maps</div>;
//   if (!isLoaded) return <div>Loading Maps...</div>;

//   return (
//     <>
//       <input
//         type="file"
//         ref={fileInputRef}
//         style={{ display: "none" }}
//         accept="image/*"
//         onChange={handleFileSelection}
//       />
//       <MapControls
//         resetMap={resetMap}
//         saveRoute={saveRoute}
//         togglePreviousRoutes={togglePreviousRoutes}
//         showSavedRoutes={mapState.showSavedRoutes}
//         toggleSavedRoutesEditability={toggleSavedRoutesEditability}
//         isSavedRoutesEditable={mapState.isSavedRoutesEditable}
//       />
//       <MapContainer onRightClick={handleMapRightClick}>
//         <MapMarkers
//           icons={mapState.imageIcons}
//           onDragEnd={handleMarkerDragEnd}
//           onRightClick={handleRightClickOnIcon}
//           onClick={handleIconClick}
//           isSaved={false}
//           isEditable={true}
//         />
//         {mapState.showSavedRoutes && (
//           <MapMarkers
//             icons={mapState.savedIcons}
//             onDragEnd={handleMarkerDragEnd}
//             onRightClick={mapState.isSavedRoutesEditable ? handleRightClickOnIcon : null}
//             onClick={mapState.isSavedRoutesEditable ? handleIconClick : null}
//             isSaved={true}
//             isEditable={mapState.isSavedRoutesEditable}
//             onSavedIconDragEnd={handleSavedIconDragEnd}
//           />
//         )}
//         {mapState.rightClickMarker && (
//           <MarkerF
//             position={mapState.rightClickMarker}
//             icon={{
//               url: "/img/location.jpg",
//               scaledSize: new google.maps.Size(20, 20),
//             }}
//           />
//         )}
//         <MapPolylines
//           lines={mapState.fiberLines}
//           onLineClick={handleLineClick}
//           onWaypointDragEnd={handleWaypointDragEnd}
//           onWaypointClick={handleWaypointClick}
//           onStartMarkerDragEnd={handleStartMarkerDragEnd}
//           onEndMarkerDragEnd={handleEndMarkerDragEnd}
//           isSaved={false}
//           isEditable={true}
//           hideWaypointsWithIcons={mapState.imageIcons}
//           hasLinkedIcon={hasLinkedIcon}
//         />
//         {mapState.showSavedRoutes && (
//           <MapPolylines
//             lines={mapState.savedPolylines}
//             onLineClick={handleLineClick}
//             onWaypointDragEnd={handleWaypointDragEnd}
//             onWaypointClick={handleWaypointClick}
//             onStartMarkerDragEnd={handleStartMarkerDragEnd}
//             onEndMarkerDragEnd={handleEndMarkerDragEnd}
//             isSaved={true}
//             isEditable={mapState.isSavedRoutesEditable}
//             onSavedPolylinePointDragEnd={handleSavedPolylinePointDragEnd}
//             onSavedPolylineWaypointDragEnd={handleSavedPolylineWaypointDragEnd}
//             hideWaypointsWithIcons={mapState.savedIcons}
//             hasLinkedIcon={hasLinkedIcon}
//           />
//         )}
//       </MapContainer>
//       <ContextMenu
//         show={mapState.showModal && !mapState.waypointActionPosition}
//         position={mapState.selectedPoint}
//         onClose={() =>
//           setMapState((prev) => ({
//             ...prev,
//             showModal: false,
//             rightClickMarker: null,
//           }))
//         }
//         onSelect={(type) =>
//           type === "Add Fiber" ? addFiberLine() : handleSelection(type)
//         }
//         options={[...Object.keys(iconImages), "Add Fiber"]}
//       />
//       <WaypointActions
//         position={mapState.waypointActionPosition}
//         onRemoveWaypoint={removeSelectedWaypoint}
//         onAddDeviceIcon={handleAddDeviceIcon}
//         onClose={() =>
//           setMapState((prev) => ({
//             ...prev,
//             selectedWaypoint: null,
//             waypointActionPosition: null,
//             selectedWaypointInfo: null,
//           }))
//         }
//       />
//       <LineActions
//         position={mapState.exactClickPosition}
//         onAddWaypoint={addWaypoint}
//         onRemoveLine={removeSelectedLine}
//         onClose={() =>
//           setMapState((prev) => ({
//             ...prev,
//             selectedLineForActions: null,
//             lineActionPosition: null,
//             exactClickPosition: null,
//           }))
//         }
//       />
//     </>
//   );
// };

// export default Map;

import React, { useRef } from "react";
import { useLoadScript, MarkerF } from "@react-google-maps/api";
import { useMapState } from "../hooks/useMapState";
import { useMapInteractions } from "../hooks/useMapInteractions";
import { useMapPersistence } from "../hooks/useMapPersistence";
import MapContainer from "../components/MapContainer";
import MapControls from "../components/MapControls";
import MapMarkers from "../components/MapMarkers";
import MapPolylines from "../components/MapPolylines";
import ContextMenu from "../components/ContextMenu";
import WaypointActions from "../components/WaypointActions";
import LineActions from "../components/LineActions";
import { iconImages } from "../constants/iconImages";

const Map = () => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });
  const fileInputRef = useRef(null);

  const { mapState, setMapState } = useMapState();
  const generateUniqueId = () =>
    `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const {
    handleMapRightClick,
    handleSelection,
    addFiberLine,
    handleLineClick,
    addWaypoint,
    handleWaypointClick,
    removeSelectedWaypoint,
    removeSelectedLine,
    handleMarkerDragEnd,
    handleStartMarkerDragEnd,
    handleEndMarkerDragEnd,
    handleWaypointDragEnd,
    handleRightClickOnIcon,
    handleSavedIconDragEnd,
    handleSavedPolylinePointDragEnd,
    handleSavedPolylineWaypointDragEnd,
    handleIconClick,
  } = useMapInteractions({ mapState, setMapState, generateUniqueId });

  const { saveRoute } = useMapPersistence({ mapState, setMapState });

  const resetMap = () => {
    setMapState((prev) => ({
      ...prev,
      fiberLines: [],
      imageIcons: [],
      showModal: false,
      rightClickMarker: null,
      nextNumber: 1,
    }));
  };

  const togglePreviousRoutes = () => {
    setMapState((prev) => ({
      ...prev,
      showSavedRoutes: !prev.showSavedRoutes,
      fiberLines: !prev.showSavedRoutes ? prev.savedPolylines : [],
      imageIcons: !prev.showSavedRoutes ? prev.savedIcons : [],
    }));
  };

  const toggleSavedRoutesEditability = () => {
    setMapState((prev) => ({
      ...prev,
      isSavedRoutesEditable: !prev.isSavedRoutesEditable,
    }));
  };

  const handleAddDeviceIcon = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = (e) => {
    const file = e.target.files[0];
    if (!file || !mapState.selectedWaypointInfo) return;

    const { lineIndex, waypointIndex, isSavedLine } = mapState.selectedWaypointInfo;
    const targetArray = isSavedLine ? mapState.savedPolylines : mapState.fiberLines;
    const waypoint = targetArray[lineIndex].waypoints[waypointIndex];
    const imageUrl = URL.createObjectURL(file);

    const newIcon = {
      lat: waypoint.lat,
      lng: waypoint.lng,
      type: "Custom",
      id: `custom-icon-${Date.now()}`,
      imageUrl,
      linkedTo: { lineIndex, waypointIndex, isSavedLine },
    };

    setMapState((prev) => ({
      ...prev,
      imageIcons: [...prev.imageIcons, newIcon],
      selectedWaypoint: null,
      waypointActionPosition: null,
      selectedWaypointInfo: null,
    }));
  };

  const hasLinkedIcon = (lat, lng, icons) =>
    icons.some((icon) => icon.lat === lat && icon.lng === lng);

  if (loadError) return { sidebar: null, content: <div>Error loading maps</div> };
  if (!isLoaded) return { sidebar: null, content: <div>Loading Maps...</div> };

  const sidebar = (
    <MapControls
      resetMap={resetMap}
      saveRoute={saveRoute}
      togglePreviousRoutes={togglePreviousRoutes}
      showSavedRoutes={mapState.showSavedRoutes}
      toggleSavedRoutesEditability={toggleSavedRoutesEditability}
      isSavedRoutesEditable={mapState.isSavedRoutesEditable}
    />
  );

  const content = (
    <>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileSelection}
      />
      <MapContainer onRightClick={handleMapRightClick}>
        <MapMarkers
          icons={mapState.imageIcons}
          onDragEnd={handleMarkerDragEnd}
          onRightClick={handleRightClickOnIcon}
          onClick={handleIconClick}
          isSaved={false}
          isEditable={true}
        />
        {mapState.showSavedRoutes && (
          <MapMarkers
            icons={mapState.savedIcons}
            onDragEnd={handleMarkerDragEnd}
            onRightClick={mapState.isSavedRoutesEditable ? handleRightClickOnIcon : null}
            onClick={mapState.isSavedRoutesEditable ? handleIconClick : null}
           铭isSaved={true}
            isEditable={mapState.isSavedRoutesEditable}
            onSavedIconDragEnd={handleSavedIconDragEnd}
          />
        )}
        {mapState.rightClickMarker && (
          <MarkerF
            position={mapState.rightClickMarker}
            icon={{
              url: "/img/location.jpg",
              scaledSize: new google.maps.Size(20, 20),
            }}
          />
        )}
        <MapPolylines
          lines={mapState.fiberLines}
          onLineClick={handleLineClick}
          onWaypointDragEnd={handleWaypointDragEnd}
          onWaypointClick={handleWaypointClick}
          onStartMarkerDragEnd={handleStartMarkerDragEnd}
          onEndMarkerDragEnd={handleEndMarkerDragEnd}
          isSaved={false}
          isEditable={true}
          hideWaypointsWithIcons={mapState.imageIcons}
          hasLinkedIcon={hasLinkedIcon}
        />
        {mapState.showSavedRoutes && (
          <MapPolylines
            lines={mapState.savedPolylines}
            onLineClick={handleLineClick}
            onWaypointDragEnd={handleWaypointDragEnd}
            onWaypointClick={handleWaypointClick}
            onStartMarkerDragEnd={handleStartMarkerDragEnd}
            onEndMarkerDragEnd={handleEndMarkerDragEnd}
            isSaved={true}
            isEditable={mapState.isSavedRoutesEditable}
            onSavedPolylinePointDragEnd={handleSavedPolylinePointDragEnd}
            onSavedPolylineWaypointDragEnd={handleSavedPolylineWaypointDragEnd}
            hideWaypointsWithIcons={mapState.savedIcons}
            hasLinkedIcon={hasLinkedIcon}
          />
        )}
      </MapContainer>
      <ContextMenu
        show={mapState.showModal && !mapState.waypointActionPosition}
        position={mapState.selectedPoint}
        onClose={() =>
          setMapState((prev) => ({
            ...prev,
            showModal: false,
            rightClickMarker: null,
          }))
        }
        onSelect={(type) =>
          type === "Add Fiber" ? addFiberLine() : handleSelection(type)
        }
        options={[...Object.keys(iconImages), "Add Fiber"]}
      />
      <WaypointActions
        position={mapState.waypointActionPosition}
        onRemoveWaypoint={removeSelectedWaypoint}
        onAddDeviceIcon={handleAddDeviceIcon}
        onClose={() =>
          setMapState((prev) => ({
            ...prev,
            selectedWaypoint: null,
            waypointActionPosition: null,
            selectedWaypointInfo: null,
          }))
        }
      />
      <LineActions
        position={mapState.exactClickPosition}
        onAddWaypoint={addWaypoint}
        onRemoveLine={removeSelectedLine}
        onClose={() =>
          setMapState((prev) => ({
            ...prev,
            selectedLineForActions: null,
            lineActionPosition: null,
            exactClickPosition: null,
          }))
        }
      />
    </>
  );

  return { sidebar, content };
};

export default Map;