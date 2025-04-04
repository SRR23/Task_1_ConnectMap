import { MarkerF } from "@react-google-maps/api";
import { iconImages } from "../constants/iconImages";

const MapMarkers = ({
  icons,
  onDragEnd,
  onRightClick,
  onClick,
  isSaved = false,
  isEditable = false,
  onSavedIconDragEnd,
}) => (
  <>
    {icons.map((icon, index) => (
      <MarkerF
        key={`image-icon-${icon.id}-${index}`}
        position={{ lat: icon.lat, lng: icon.lng }}
        draggable={isEditable || !isSaved} // Draggable only if not saved or editable
        icon={{
          url: icon.imageUrl || iconImages[icon.type],
          scaledSize: new google.maps.Size(30, 30),
        }}
        onDragEnd={(e) => (isSaved && isEditable ? onSavedIconDragEnd(icon.id, e) : onDragEnd(index, e))}
        onRightClick={isSaved && !isEditable ? null : (e) => onRightClick(icon, e)} // Disable if saved and not editable
        onClick={isSaved && !isEditable ? null : (e) => onClick(icon, e)} // Disable if saved and not editable
      />
    ))}
  </>
);

export default MapMarkers;