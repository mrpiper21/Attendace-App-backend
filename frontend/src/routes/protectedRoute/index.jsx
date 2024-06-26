import { Routes, Route } from "react-router-dom";
import AttendanceRouter from "./attendance/AttendanceRouter";
import EmployeeRoute from "./employee/EmployeeRoute";
import ReportRouter from "./report/ReportRouter";
import TaskRouter from "./task/TaskRouter";

import LeaveRouter from "./leave/LeaveRouter";
import DashboardRoute from "./dashboard";

export const ProtectedRoutes = () => {
  return (
    <Routes>
      <Route path="/attendance/*" element={<AttendanceRouter />} />
      <Route path="/employee/*" element={<EmployeeRoute />} />
      <Route path="/report/*" element={<ReportRouter />} />
      <Route path="/leave/*" element={<LeaveRouter />} />
      <Route path="/task/*" element={<TaskRouter />} />
      <Route path="*" element={<DashboardRoute />} />
    </Routes>
  );
};
