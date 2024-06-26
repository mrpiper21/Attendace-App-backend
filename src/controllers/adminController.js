const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Employee = require("../models/Employee");
const Leave = require("../models/LeaveRequest");
const Notification = require("../models/notifications");
const AttendanceRecord = require("../models/AttendanceReports");
const bodyParser = require("body-parser");
const express = require("express");
const { generateToken } = require("../config/jwt");
const app = express();
app.use(bodyParser.json());
const socketIO = require("socket.io");
const http = require("http");
const moment = require("moment/moment");
// const io = require("socket.io")(http);
const server = http.createServer(app);
const io = socketIO(server, {
  transports: ["websocket"], // Enable only WebSocket transport
});
// const moment = require("moment");

const register = async (req, res) => {
  const { email, staffId, name, password, role } = req.body;
  // Check if the email is already taken
  const existingAdmin = await Employee.findOne({ email, isAdmin: true });
  // Check if employee  Id is already taken
  const existingEmployeeId = await Employee.findOne({ staffId, isAdmin: true });

  if (existingAdmin) {
    return res
      .status(400)
      .json({ message: "Admin with this email already exists." });
  }
  if (existingEmployeeId) {
    return res
      .status(400)
      .json({ message: "Employee with this staff Id already exists." });
  }

  // Hash the password before storing it in the database
  const hashedPassword = await bcrypt.hash(password, 10);
  // console.log(hashedPassword)

  const newAdmin = new Employee({
    email,
    staffId,
    name,
    dateJoined: new Date(),
    role,
    password: hashedPassword,
    isAdmin: true,
  });

  try {
    await newAdmin.save();
    const token = jwt.sign({ userId: newAdmin._id }, "secret-key", {
      expiresIn: "356d",
    });
    const newUser = {
      _id: newAdmin._id,
      email: newAdmin.email,
      name: newAdmin.name,
      role: newAdmin.role,
      password: newAdmin.password,
      isAdmin: newAdmin.isAdmin,
      token: token,
    };

    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).send("Error registering admin.");
  }

  //Login user
};

const login = async (req, res) => {
  const { email, password } = req.body;

  // Find the admin by email and check if they are an admin
  const admin = await Employee.findOne({ email, isAdmin: true });

  if (!admin) {
    return res.status(401).send("Admin not found.");
  }

  // Check the password using bcrypt
  if (bcrypt.compareSync(password, admin.password)) {
    const user = {
      email: admin.email,
      staffId: admin.staffId,
      role: admin.role,
      name: admin.name,
      token: generateToken(admin?.id),
    };
    return res.status(200).json(user);
  } else {
    return res.status(401).send("Invalid password.");
  }
};

// Create employee route
const createEmployee = async (req, res) => {
  const { email, staffId, name, password, role } = req.body;

  // Check if the email is already taken
  const existingEmployee = await Employee.findOne({ email, isAdmin: false });
  const existingEmployeeStaffId = await Employee.findOne({
    staffId,
    isAdmin: false,
  });

  if (existingEmployee) {
    return res.status(400).send("Employee with this email already exists.");
  }
  //Check if the staff id is already taken
  if (existingEmployeeStaffId) {
    return res.status(400).send("Employee with this staffId already exists.");
  }

  // Hash the password before storing it in the database
  const hashedPassword = await bcrypt.hash(password, 10);

  const newEmployee = new Employee({
    email,
    staffId,
    name,
    role,
    password: hashedPassword,
    isAdmin: false,
  });

  try {
    await newEmployee.save();
    res.status(201).send("Employee created successfully.");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating employee.");
  }
};

const getAllEmployees = async (req, res) => {
  const employees = await Employee.find();

  return res.json(employees).status(200);
};
// Admin-only route to get attendance records of all employees
const getAllAttendanceRecords = async (req, res) => {
  try {
    // Retrieve attendance records for all employees
    const records = await AttendanceRecord.find().sort({ timestamp: "desc" });

    res.status(200).json(records);
  } catch (err) {
    console.error("Error retrieving attendance records", err);
    res.status(500).send("Error retrieving attendance records");
  }
};

const getRecordsForClockIn = async (req, res) => {
  const _id = req.params.id;
  try {
    const today = moment().startOf("day").toDate();

    const employee = await Employee.findById(_id);

    // if (!employee) {
    //   return res
    //     .status(201)
    //     .json({ message: `could not fing employee with id ${_d}` });
    // }

    const todaysClockInRecord = await AttendanceRecord.find({
      // employee: employee._id,
      // email: employee.email,
      clockInTime: {
        $gte: today,
        $ne: null,
      },
      clockOutTime: null,
    });

    if (todaysClockInRecord.length === 0) {
      return res.status(201).json({ message: "Not yet clocked in" });
    }

    res.status(200).json(todaysClockInRecord);
  } catch (error) {
    console.error("Error fetching clock in records", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching clock in records" });
  }
};

const getRecordsForClockOut = async (req, res) => {
  const _id = req.params.id;
  try {
    const today = moment().startOf("day").toDate();

    const employee = await Employee.findById(_id);

    if (!employee) {
      return res
        .status(201)
        .json({ message: `could not fing employee with id ${_d}` });
    }

    const todaysClockOutRecord = await AttendanceRecord.find({
      employee: employee._id,
      clockInTime: {
        $gte: today,
        $lt: moment().endOf("day").toDate(),
      },
      clockOutTime: { $ne: null },
    });

    res.status(200).json(todaysClockOutRecord);
  } catch (error) {
    console.error("Error fetching clock out records", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching clock out records" });
  }
};

// Admin-only route to query attendance records for a particular employee
const getSingleRecord = async (req, res) => {
  const { employeeId } = req.body;
  //console.log(employeeId)
  try {
    // Retrieve attendance records for the specified employee
    const records = await AttendanceRecord.find({ employee: employeeId }).sort({
      timestamp: "desc",
    });

    res.status(200).json(records);
  } catch (err) {
    console.error("Error retrieving attendance records", err);
    res.status(500).send("Error retrieving attendance records");
  }
};

const notifications = async (req, res) => {
  const { title, body, to } = req.body;
  try {
    // Create a new notification
    const newNotification = new Notification({
      title,
      body,
      to,
    });

    await newNotification.save();

    // Broadcast the new notification to all connected employees
    //   const notifications = await Notification.find()

    io.emit("newNotification", newNotification);
    res.status(201).json(newNotification);
    console.log(newNotification);
  } catch (err) {
    console.error("Error creating notification", err);
    res.status(500).send("Error creating notification ");
  }
};

// Admin-only route to get attendance records of all employees
const getAllLeaveRequest = async (req, res) => {
  try {
    // Retrieve leave records for all employees
    const leaveRecords = await Leave.find().sort({ timestamp: "desc" });

    res.status(200).json(leaveRecords);
  } catch (err) {
    console.error("Error retrieving leave records", err);
    res.status(500).send("Error retrieving leave records");
  }
};

const updateEmployeeLeaveRequest = async (req, res) => {
  try {
    const { status } = req.body;
    const leaveId = req.params.leaveId;

    // Update the leave request status
    await Leave.findByIdAndUpdate(leaveId, { status });

    res.json({ message: "Leave request updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// app.use("/api/admin", router);

module.exports = {
  register,
  login,
  createEmployee,
  getAllEmployees,
  notifications,
  getRecordsForClockIn,
  getRecordsForClockOut,
  getAllAttendanceRecords,
  getSingleRecord,
  updateEmployeeLeaveRequest,
  getAllLeaveRequest,
  express,
  io,
  server,
  app,
};
