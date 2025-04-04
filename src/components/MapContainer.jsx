import { GoogleMap } from "@react-google-maps/api";
import { containerStyle, center, mapStyles } from "../constants/mapStyles";

const MapContainer = ({ children, onRightClick }) => (
  <GoogleMap
    mapContainerStyle={containerStyle}
    center={center}
    zoom={7}
    onRightClick={onRightClick}
    options={{ styles: mapStyles, disableDefaultUI: false }}
  >
    {children}
  </GoogleMap>
);

export default MapContainer;