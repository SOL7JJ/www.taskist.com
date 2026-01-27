import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./Landing.jsx";
import TaskApp from "./TaskApp.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<TaskApp />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
