


import React, { useState } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { DrawingManager } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "600px",
};

// Center the map in Bangladesh
const center = { lat: 23.685, lng: 90.3563 };

const districts = [
  { id: 1, name: "Dhaka", lat: 23.8103, lng: 90.4125 },
  { id: 2, name: "Chattogram", lat: 22.3569, lng: 91.7832 },
  { id: 3, name: "Khulna", lat: 22.8456, lng: 89.5403 },
  { id: 4, name: "Rajshahi", lat: 24.3636, lng: 88.6241 },
  { id: 5, name: "Sylhet", lat: 24.8949, lng: 91.8687 },
  { id: 6, name: "Barishal", lat: 22.7010, lng: 90.3535 },
  { id: 7, name: "Rangpur", lat: 25.7439, lng: 89.2752 },
  { id: 8, name: "Mymensingh", lat: 24.7471, lng: 90.4203 },
  { id: 9, name: "Cox's Bazar", lat: 21.4272, lng: 92.0058 },
  { id: 10, name: "Comilla", lat: 23.4607, lng: 91.1809 },
  { id: 11, name: "Jessore", lat: 23.1664, lng: 89.2081 },
  { id: 12, name: "Narayanganj", lat: 23.6238, lng: 90.5000 },
  { id: 13, name: "Bogra", lat: 24.8465, lng: 89.3773 },
  { id: 14, name: "Tangail", lat: 24.2513, lng: 89.9164 },
  { id: 15, name: "Pabna", lat: 23.9985, lng: 89.2334 },
];

const MyMap = () => {
  const [map, setMap] = useState(null);

  return (
    <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={["drawing"]}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={7}
        onLoad={(map) => setMap(map)}
      >
        {/* Show all district markers */}
        {districts.map((district) => (
          <Marker 
            key={district.id} 
            position={{ lat: district.lat, lng: district.lng }} 
            title={district.name} 
          />
        ))}

        {/* Drawing Manager for manually drawing lines and shapes */}
        <DrawingManager
          options={{
            drawingControl: true,
            drawingControlOptions: {
              position: window.google?.maps.ControlPosition.TOP_CENTER,
              drawingModes: ["polyline", "polygon", "rectangle", "circle"],
            },
            polylineOptions: {
              strokeColor: "#FF0000",
              strokeOpacity: 1.0,
              strokeWeight: 3,
            },
            polygonOptions: {
              fillColor: "#00FF00",
              fillOpacity: 0.5,
              strokeWeight: 2,
              clickable: true,
              editable: true,
            },
          }}
        />
      </GoogleMap>
    </LoadScript>
  );
};

export default MyMap;
