// src/routes/employeeRoutes.js

const express = require("express");
const router = express.Router();
const controller = require("../controllers/employeeController");

router.post("/employees", controller.createEmployee);
router.get("/employees", controller.getEmployees);
router.get("/employees/:id", controller.getEmployee);
router.put("/employees/:id", controller.updateEmployee);
router.delete("/employees/:id", controller.deleteEmployee);

module.exports = router;
