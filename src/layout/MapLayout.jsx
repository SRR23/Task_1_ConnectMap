// import React from "react";

// const MapLayout = ({ sidebar = null, content }) => (
//   <div className="layout">
//     {sidebar && <div className="sidebar">{sidebar}</div>}
//     <div className="content">{content}</div>
//   </div>
// );

// export default MapLayout;

import React from "react";

const MapLayout = ({ sidebar = null, content }) => (
  <div className="layout">
    <div className="sidebar">
      {/* Add your image icon here */}
      <img 
        src="/img/janata-wifi.svg" // Replace with your icon path
        alt="Map Icon"
        className="sidebar-icon"
      />
      {sidebar}
    </div>
    <div className="content">{content}</div>
  </div>
);

export default MapLayout;