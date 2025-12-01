// client/src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import WelcomingPage from "./welcomingpage";
import Dashboard from "./Dashboard";

export default function App() {
  return (
    <Router>
      <Routes>

        {/* Welcoming page → default */}
        <Route path="/" element={<WelcomingPage />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

      </Routes>
    </Router>
  );
}
