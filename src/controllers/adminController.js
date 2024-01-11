const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Employee = require("../models/Employee");
const Notification = require('../models/notifications');
const AttendanceRecord = require("../models/AttendanceReports");
const bodyParser = require("body-parser");
const express = require('express');
const { generateToken } = require("../config/jwt");
const LeaveRequest = require('../models/LeaveRequest')
const { Socket } = require("dgram");
const app = express();
app.use(bodyParser.json());



const http = require('http').Server(app);
const io = require('socket.io')(http); 



// const moment = require("moment");


const register = async (req, res) => {
  const { email, staffId, name, password, role } = req.body;
  // Check if the email is already taken
  const existingAdmin = await Employee.findOne({ email, isAdmin: true });
  // Check if employee is Id is already taken
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
      token: token
    };

    res.status(201).json(newUser)
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
      token: generateToken(admin?.id)
    };
    return res
      .status(200)
      .json(user);
  } else {
    return res
      .status(401)
      .send("Invalid Staff Id,please use your valid staff.");
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

const getAllLeaveRequests = async (req, res) => {
  try {
    const allReqs = await LeaveRequest.find()
    if (!allReqs) {
      res.json({ msg: "There are no leave Request"})
    }

    res.json(allReqs)
  } catch (err) {
    throw new Error(err)
  }
}

//manage leave request
const manageleaveRequest = async (req, res) => {
  const _Id = req.params.id

  const { Approval, Rejection} = req.body

  //check if there leave request is valid
  const leavereq = await LeaveRequest.findById(_Id)

  if (!leavereq) {
    return res.status(500).json({ err: 'There is no leave request associated with that particular id'})
  }

  try {

    if (Approval) {
      const approved = await leavereq.updateOne({
        status: Approval,
        new: true
      })
      return res.json(approved).status(200)

    } else if (Rejection) {
      const rejected = await leavereq.updateOne({
        status: Rejection,
        new: true
      })
      return res.json(rejected).status(200)
    }

  } catch (err) {
    console.log(err)
  }

}

const notifications = async (req, res) => {
  const { title, body } = req.body;
  try {
    // Create a new notification
    const newNotification = new Notification({
      title,
      body,
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
// app.use("/api/admin", router);

module.exports = { register, 
                    login, 
                    createEmployee, 
                    notifications, 
                    getAllAttendanceRecords,
                    manageleaveRequest,
                    getAllLeaveRequests,
                    getSingleRecord,
                    express,
                    io, 
                    http,
                    app 
                  };