import { useCallback } from "react";

export const useMapInteractions = ({ mapState, setMapState, generateUniqueId }) => {
  // Handle right-click on the map to show context menu
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
      setMapState((prev) => ({
        ...prev,
        selectedPoint: clickedPoint,
        rightClickMarker: clickedPoint,
        showModal: true,
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      }));
    },
    [mapState.nextNumber]
  );

  // Handle selection of an icon type from the context menu
  const handleSelection = useCallback(
    (type) => {
      const { selectedPoint, nextNumber } = mapState;
      setMapState((prev) => ({
        ...prev,
        selectedType: type,
        showModal: false,
        imageIcons: [
          ...prev.imageIcons.filter(
            (icon) =>
              icon.lat !== selectedPoint.lat || icon.lng !== selectedPoint.lng
          ),
          { ...selectedPoint, type, id: nextNumber },
        ],
        nextNumber: nextNumber + 1,
        rightClickMarker: null,
      }));
    },
    [mapState]
  );


  const handleRightClickOnIcon = useCallback(
    (icon, e) => {
      if (e && e.domEvent) {
        e.domEvent.preventDefault();
      }
      // Only proceed if not saved or if saved and editable
      if (!icon.linkedTo?.isSavedLine || mapState.isSavedRoutesEditable) {
        if (icon.linkedTo) {
          const { lineIndex, waypointIndex, isSavedLine } = icon.linkedTo;
          const x = e?.domEvent?.clientX || 0;
          const y = e?.domEvent?.clientY || 0;
          setMapState((prev) => ({
            ...prev,
            selectedWaypoint: icon,
            waypointActionPosition: { x, y },
            selectedWaypointInfo: {
              lineIndex,
              waypointIndex,
              isSavedLine,
              isIcon: true,
              iconId: icon.id,
            },
            selectedPoint: null,
            rightClickMarker: null,
            showModal: false,
            selectedLineForActions: null,
            lineActionPosition: null,
            exactClickPosition: null,
          }));
        } else {
          setMapState((prev) => ({
            ...prev,
            selectedPoint: { ...icon, x: e?.domEvent?.clientX, y: e?.domEvent?.clientY },
            rightClickMarker: icon,
            showModal: true,
            selectedLineForActions: null,
            lineActionPosition: null,
            exactClickPosition: null,
            selectedWaypoint: null,
            waypointActionPosition: null,
            selectedWaypointInfo: null,
          }));
        }
      }
    },
    [mapState.isSavedRoutesEditable]
  );

  // Handle click on a line (fiber or saved polyline)
  const handleLineClick = useCallback(
    (line, index, isSavedLine = false, e) => {
      if (e.domEvent) {
        e.domEvent.preventDefault();
      }

      if (
        !isSavedLine ||
        (mapState.showSavedRoutes &&
          (mapState.isSavedRoutesEditable || !isSavedLine))
      ) {
        const clickedLatLng = e.latLng;
        const x = e.domEvent.clientX;
        const y = e.domEvent.clientY;

        setMapState((prev) => ({
          ...prev,
          selectedLineForActions: { line, index, isSavedLine },
          lineActionPosition: {
            lat: clickedLatLng.lat(),
            lng: clickedLatLng.lng(),
            x,
            y,
          },
          exactClickPosition: { lat: clickedLatLng.lat(), lng: clickedLatLng.lng(), x, y },
          selectedWaypoint: null,
          waypointActionPosition: null,
          selectedWaypointInfo: null,
        }));
      }
    },
    [mapState.showSavedRoutes, mapState.isSavedRoutesEditable]
  );

  const addWaypoint = useCallback(() => {
    if (!mapState.selectedLineForActions) return;

    const { line, index, isSavedLine } = mapState.selectedLineForActions;

    setMapState((prev) => {
      const updatedLines = isSavedLine ? prev.savedPolylines : prev.fiberLines;

      const updatedLinesWithWaypoint = updatedLines.map((currentLine, currentIndex) => {
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
      });

      // If editing saved routes, update both savedPolylines and fiberLines
      const newState = {
        ...prev,
        ...(isSavedLine
          ? { savedPolylines: updatedLinesWithWaypoint }
          : { fiberLines: updatedLinesWithWaypoint }),
        selectedLineForActions: null,
        lineActionPosition: null,
        exactClickPosition: null,
      };

      if (isSavedLine && prev.showSavedRoutes) {
        newState.fiberLines = updatedLinesWithWaypoint; // Sync fiberLines with savedPolylines
        localStorage.setItem("savedPolylines", JSON.stringify(updatedLinesWithWaypoint));
      }

      return newState;
    });
  }, [mapState.selectedLineForActions, mapState.showSavedRoutes]);

  // Handle click on a waypoint
  const handleWaypointClick = useCallback(
    (lineIndex, waypointIndex, isSavedLine = false, waypoint, e) => {
      if (e && e.domEvent) {
        e.domEvent.preventDefault();
        e.domEvent.stopPropagation();
      }

      if (
        !isSavedLine ||
        (mapState.showSavedRoutes && mapState.isSavedRoutesEditable)
      ) {
        const x = e && e.domEvent ? e.domEvent.clientX : 0;
        const y = e && e.domEvent ? e.domEvent.clientY : 0;

        setMapState((prev) => ({
          ...prev,
          selectedLineForActions: null,
          lineActionPosition: null,
          exactClickPosition: null,
          showModal: false,
          selectedWaypoint: waypoint,
          waypointActionPosition: { x, y },
          selectedWaypointInfo: { lineIndex, waypointIndex, isSavedLine },
        }));
      }
    },
    [mapState.showSavedRoutes, mapState.isSavedRoutesEditable]
  );

  const removeSelectedWaypoint = useCallback(() => {
    if (!mapState.selectedWaypointInfo) return;

    const { lineIndex, waypointIndex, isSavedLine } = mapState.selectedWaypointInfo;

    setMapState((prev) => {
      const targetArray = isSavedLine ? prev.savedPolylines : prev.fiberLines;

      if (!targetArray[lineIndex] || !targetArray[lineIndex].waypoints) {
        return prev;
      }

      const updatedLines = targetArray.map((line, idx) => {
        if (idx === lineIndex) {
          const updatedWaypoints = line.waypoints.filter(
            (_, wIdx) => wIdx !== waypointIndex
          );
          return { ...line, waypoints: updatedWaypoints };
        }
        return line;
      });

      // Find and remove the associated image icon if it exists
      const waypointToRemove = targetArray[lineIndex].waypoints[waypointIndex];
      const updatedImageIcons = prev.imageIcons.filter(
        (icon) => !(icon.lat === waypointToRemove.lat && icon.lng === waypointToRemove.lng)
      );
      const updatedSavedIcons = prev.savedIcons.filter(
        (icon) => !(icon.lat === waypointToRemove.lat && icon.lng === waypointToRemove.lng)
      );

      const newState = {
        ...prev,
        ...(isSavedLine
          ? { savedPolylines: updatedLines }
          : { fiberLines: updatedLines }),
        imageIcons: updatedImageIcons,
        savedIcons: updatedSavedIcons,
        selectedWaypoint: null,
        waypointActionPosition: null,
        selectedWaypointInfo: null,
      };

      if (isSavedLine && prev.showSavedRoutes) {
        newState.fiberLines = updatedLines;
        localStorage.setItem("savedPolylines", JSON.stringify(updatedLines));
        localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));
      }

      return newState;
    });
  }, [mapState.selectedWaypointInfo, mapState.showSavedRoutes]);


  const removeSelectedLine = useCallback(() => {
    if (!mapState.selectedLineForActions) return;

    const { line, index, isSavedLine } = mapState.selectedLineForActions;

    setMapState((prev) => {
      let updatedLines;
      if (isSavedLine) {
        updatedLines = prev.savedPolylines.filter(
          (polyline) => polyline.id !== line.id
        );
        localStorage.setItem("savedPolylines", JSON.stringify(updatedLines));
      } else {
        updatedLines = prev.fiberLines.filter(
          (currentLine) => currentLine.id !== line.id
        );
      }

      // If editing saved routes, update both savedPolylines and fiberLines
      const newState = {
        ...prev,
        ...(isSavedLine
          ? { savedPolylines: updatedLines }
          : { fiberLines: updatedLines }),
        selectedLineForActions: null,
        lineActionPosition: null,
        exactClickPosition: null,
      };

      if (isSavedLine && prev.showSavedRoutes) {
        newState.fiberLines = updatedLines; // Sync fiberLines with savedPolylines
      }

      return newState;
    });
  }, [mapState.selectedLineForActions, mapState.fiberLines, mapState.showSavedRoutes]);

  // Handle dragging of an icon marker
  const handleMarkerDragEnd = useCallback(
    (index, e) => {
      const updatedIcons = [...mapState.imageIcons];
      updatedIcons[index] = {
        ...updatedIcons[index],
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };

      setMapState((prev) => ({
        ...prev,
        imageIcons: updatedIcons,
      }));
    },
    [mapState.imageIcons]
  );

  // Add a new fiber line
  const addFiberLine = useCallback(() => {
    const { rightClickMarker } = mapState;
    if (!rightClickMarker) return;

    const fiberLineStart = { lat: rightClickMarker.lat, lng: rightClickMarker.lng };
    const fiberLineEnd = {
      lat: rightClickMarker.lat + 0.001,
      lng: rightClickMarker.lng + 0.001,
    };

    const newFiberLine = {
      id: generateUniqueId(),
      from: fiberLineStart,
      to: fiberLineEnd,
      waypoints: [],
    };

    setMapState((prev) => ({
      ...prev,
      fiberLines: [...prev.fiberLines, newFiberLine],
      showModal: false,
      selectedPoint: null,
      rightClickMarker: null,
    }));
  }, [mapState.rightClickMarker, generateUniqueId]);

  // Handle dragging of the start marker of a fiber line
  const handleStartMarkerDragEnd = useCallback(
    (index, e) => {
      const updatedLines = [...mapState.fiberLines];
      updatedLines[index].from = { lat: e.latLng.lat(), lng: e.latLng.lng() };

      setMapState((prev) => ({
        ...prev,
        fiberLines: updatedLines,
      }));
    },
    [mapState.fiberLines]
  );

  // Handle dragging of the end marker of a fiber line
  const handleEndMarkerDragEnd = useCallback(
    (index, e) => {
      const updatedLines = [...mapState.fiberLines];
      updatedLines[index].to = { lat: e.latLng.lat(), lng: e.latLng.lng() };

      setMapState((prev) => ({
        ...prev,
        fiberLines: updatedLines,
      }));
    },
    [mapState.fiberLines]
  );

  // Handle dragging of a waypoint in a fiber line
  const handleWaypointDragEnd = useCallback(
    (lineIndex, waypointIndex, e) => {
      setMapState((prev) => {
        const updatedLines = prev.fiberLines.map((line, index) => {
          if (index === lineIndex) {
            const updatedWaypoints = [...(line.waypoints || [])];
            updatedWaypoints[waypointIndex] = {
              lat: e.latLng.lat(),
              lng: e.latLng.lng(),
            };
            return { ...line, waypoints: updatedWaypoints };
          }
          return line;
        });

        return { ...prev, fiberLines: updatedLines };
      });
    },
    []
  );

  // Handle dragging of saved icons
  const handleSavedIconDragEnd = useCallback(
    (iconId, e) => {
      setMapState((prev) => {
        const updatedSavedIcons = prev.savedIcons.map((icon) =>
          icon.id === iconId
            ? { ...icon, lat: e.latLng.lat(), lng: e.latLng.lng() }
            : icon
        );

        localStorage.setItem("savedIcons", JSON.stringify(updatedSavedIcons));

        return {
          ...prev,
          savedIcons: updatedSavedIcons,
          imageIcons: prev.showSavedRoutes
            ? updatedSavedIcons.map((icon) => ({
                lat: icon.lat,
                lng: icon.lng,
                type: icon.type,
                imageUrl: icon.imageUrl,
                id: icon.id,
              }))
            : prev.imageIcons,
        };
      });
    },
    []
  );

  // Handle dragging of saved polyline points (from/to)
  const handleSavedPolylinePointDragEnd = useCallback(
    (polylineId, pointType, e) => {
      setMapState((prev) => {
        const updatedSavedPolylines = prev.savedPolylines.map((polyline) =>
          polyline.id === polylineId
            ? {
                ...polyline,
                [pointType]: { lat: e.latLng.lat(), lng: e.latLng.lng() },
              }
            : polyline
        );

        localStorage.setItem("savedPolylines", JSON.stringify(updatedSavedPolylines));

        return {
          ...prev,
          savedPolylines: updatedSavedPolylines,
          fiberLines: prev.showSavedRoutes
            ? updatedSavedPolylines.map((polyline) => ({
                from: polyline.from,
                to: polyline.to,
                id: polyline.id,
                waypoints: polyline.waypoints || [],
                strokeColor: "#0000FF",
              }))
            : prev.fiberLines,
        };
      });
    },
    []
  );

  // Handle dragging of saved polyline waypoints
  const handleSavedPolylineWaypointDragEnd = useCallback(
    (polylineId, waypointIndex, e) => {
      setMapState((prev) => {
        const updatedSavedPolylines = prev.savedPolylines.map((polyline) =>
          polyline.id === polylineId
            ? {
                ...polyline,
                waypoints: polyline.waypoints.map((waypoint, index) =>
                  index === waypointIndex
                    ? { lat: e.latLng.lat(), lng: e.latLng.lng() }
                    : waypoint
                ),
              }
            : polyline
        );

        localStorage.setItem("savedPolylines", JSON.stringify(updatedSavedPolylines));

        return {
          ...prev,
          savedPolylines: updatedSavedPolylines,
          fiberLines: prev.showSavedRoutes
            ? updatedSavedPolylines.map((polyline) => ({
                ...polyline,
                strokeColor: "#0000FF",
              }))
            : prev.fiberLines,
        };
      });
    },
    []
  );


  const handleIconClick = useCallback(
    (icon, e) => {
      if (e && e.domEvent) {
        e.domEvent.preventDefault();
        e.domEvent.stopPropagation();
      }
      // Only proceed if not saved or if saved and editable
      if (!icon.linkedTo?.isSavedLine || mapState.isSavedRoutesEditable) {
        if (icon.linkedTo) {
          const { lineIndex, waypointIndex, isSavedLine } = icon.linkedTo;
          const x = e && e.domEvent ? e.domEvent.clientX : 0;
          const y = e && e.domEvent ? e.domEvent.clientY : 0;
          setMapState((prev) => ({
            ...prev,
            selectedWaypoint: icon,
            waypointActionPosition: { x, y },
            selectedWaypointInfo: {
              lineIndex,
              waypointIndex,
              isSavedLine,
              isIcon: true,
              iconId: icon.id,
            },
            selectedLineForActions: null,
            lineActionPosition: null,
            exactClickPosition: null,
            showModal: false,
          }));
        } else {
          setMapState((prev) => ({
            ...prev,
            selectedPoint: { ...icon, x: e?.domEvent?.clientX, y: e?.domEvent?.clientY },
            rightClickMarker: icon,
            showModal: true,
            selectedLineForActions: null,
            lineActionPosition: null,
            exactClickPosition: null,
            selectedWaypoint: null,
            waypointActionPosition: null,
            selectedWaypointInfo: null,
          }));
        }
      }
    },
    [mapState.isSavedRoutesEditable]
  );

  return {
    handleMapRightClick,
    handleSelection,
    handleRightClickOnIcon,
    handleLineClick,
    addWaypoint,
    handleWaypointClick,
    removeSelectedWaypoint,
    removeSelectedLine,
    handleMarkerDragEnd,
    addFiberLine,
    handleStartMarkerDragEnd,
    handleEndMarkerDragEnd,
    handleWaypointDragEnd,
    handleSavedIconDragEnd,
    handleSavedPolylinePointDragEnd,
    handleSavedPolylineWaypointDragEnd,
    handleIconClick,
  };
};