import React from "react";

const MapLayout = ({ sidebar = null, content }) => (
  <div className="layout">
    {sidebar && <div className="sidebar">{sidebar}</div>}
    <div className="content">{content}</div>
  </div>
);

export default MapLayout;