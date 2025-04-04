import React from "react"
import { PolylineF, MarkerF } from "@react-google-maps/api";

const MapPolylines = ({
  lines,
  onLineClick,
  onWaypointDragEnd,
  onWaypointClick,
  onStartMarkerDragEnd,
  onEndMarkerDragEnd,
  isSaved = false,
  isEditable = false,
  onSavedPolylinePointDragEnd,
  onSavedPolylineWaypointDragEnd,
  hideWaypointsWithIcons = [],
  hasLinkedIcon,
}) => {
  // No-op function to prevent errors when events are disabled
  const noop = () => {};

  return (
    <>
      {lines.map((line, index) => (
        <React.Fragment key={line.id}>
          <PolylineF
            path={[
              line.from,
              ...(line.waypoints || []),
              line.to,
            ]}
            options={{
              strokeColor: isSaved ? "#0000FF" : "#FF0000",
              strokeOpacity: 1.0,
              strokeWeight: 2,
            }}
            onClick={
              isSaved && !isEditable
                ? noop // Do nothing if saved and not editable
                : (e) => onLineClick(line, index, isSaved, e)
            }
          />
          <MarkerF
            position={line.from}
            draggable={isEditable || !isSaved}
            onDragEnd={
              isSaved && !isEditable
                ? noop
                : (e) =>
                    isSaved && isEditable
                      ? onSavedPolylinePointDragEnd(line.id, "from", e)
                      : onStartMarkerDragEnd(index, e)
            }
            icon={{
              url: "/img/location.jpg",
              scaledSize: new google.maps.Size(20, 20),
            }}
          />
          <MarkerF
            position={line.to}
            draggable={isEditable || !isSaved}
            onDragEnd={
              isSaved && !isEditable
                ? noop
                : (e) =>
                    isSaved && isEditable
                      ? onSavedPolylinePointDragEnd(line.id, "to", e)
                      : onEndMarkerDragEnd(index, e)
            }
            icon={{
              url: "/img/location.jpg",
              scaledSize: new google.maps.Size(20, 20),
            }}
          />
          {(line.waypoints || []).map(
            (waypoint, wIndex) =>
              !hasLinkedIcon(waypoint.lat, waypoint.lng, hideWaypointsWithIcons) && (
                <MarkerF
                  key={`${line.id}-waypoint-${wIndex}`}
                  position={waypoint}
                  draggable={isEditable || !isSaved}
                  onDragEnd={
                    isSaved && !isEditable
                      ? noop
                      : (e) =>
                          isSaved && isEditable
                            ? onSavedPolylineWaypointDragEnd(line.id, wIndex, e)
                            : onWaypointDragEnd(index, wIndex, e)
                  }
                  onClick={
                    isSaved && !isEditable
                      ? noop
                      : (e) => onWaypointClick(index, wIndex, isSaved, waypoint, e)
                  }
                  icon={{
                    url: "/img/location.jpg",
                    scaledSize: new google.maps.Size(15, 15),
                  }}
                />
              )
          )}
        </React.Fragment>
      ))}
    </>
  );
};

export default MapPolylines;
