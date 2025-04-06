import React from "react";
import { Trash2, Plus } from "lucide-react";

const LineActions = ({
  position,
  onAddWaypoint,
  onRemoveLine,
  onClose,
}) => {
  if (!position) return null;

  return (
    <div
      className="line-action-modal"
      style={{
        top: `${position.y - 75}px`,
        left: `${position.x - 158}px`,
        transform: "translateX(-50%)",
        position: "absolute",
        zIndex: 1000,
      }}
    >
      <div className="line-action-item" onClick={onAddWaypoint}>
        <Plus size={20} className="text-gray-600" />
        <span className="line-action-tooltip">Add Waypoint</span>
      </div>
      <div className="line-action-item" onClick={onRemoveLine}>
        <Trash2 size={20} className="text-red-500" />
        <span className="line-action-tooltip">Delete Line</span>
      </div>
      <div className="line-action-item" onClick={onClose}>
        <span className="line-action-close">×</span>
        <span className="line-action-tooltip">Close</span>
      </div>
      <div className="modal-spike"></div>
    </div>
  );
};

export default LineActions;