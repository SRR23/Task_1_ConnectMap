

const ContextMenu = ({ show, position, onClose, onSelect, options }) =>
  show &&
  position && (
    <div
      className="modal"
      style={{ top: position.y - 116, left: position.x - 418 }}
    >
      <button className="modal-close" onClick={onClose}>
        ×
      </button>
      <p className="modal-title">Select a type:</p>
      <div className="modal-buttons">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onSelect(option)}
            className="modal-button"
          >
            {option}
          </button>
        ))}
      </div>
      <div className="modal-spike"></div>
    </div>
  );

export default ContextMenu;
