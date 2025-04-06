import React from "react";
import { Trash2, Plus } from "lucide-react";

const WaypointActions = ({
  position,
  onRemoveWaypoint,
  onAddDeviceIcon,
  onClose,
}) => {
  if (!position) return null;

  return (
    <div
      className="line-action-modal"
      style={{
        top: `${position.y - 75}px`,
        left: `${position.x - 222}px`,
        position: "absolute",
        zIndex: 1000,
      }}
    >
      {/* Remove Waypoint Button */}
      <div className="line-action-item" onClick={onRemoveWaypoint}>
        <Trash2 size={20} color="red" />
        <span className="line-action-tooltip">Remove</span>
      </div>

      {/* Add Device Icon Button */}
      <div className="line-action-item" onClick={onAddDeviceIcon}>
        <Plus size={20} color="blue" />
        <span className="line-action-tooltip">Device</span>
      </div>

      {/* Close Button */}
      <div className="line-action-item" onClick={onClose}>
        <span className="close-icon">×</span>
        <span className="line-action-tooltip">Close</span>
      </div>

      <div className="modal-spike"></div>
    </div>
  );
};

export default WaypointActions;