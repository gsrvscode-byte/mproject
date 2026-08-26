// src/controllers/employeeController.js
//
// Route handlers only. All SQL is parameterized ($1, $2, ...) so user
// input is never concatenated into a query string — this prevents SQL
// injection. pg substitutes the values safely under the hood.

const pool = require("../config/db");

async function createEmployee(req, res, next) {
  try {
    const { name, email, department, salary } = req.body;

    if (!name || !email || !department || salary === undefined) {
      return res.status(400).json({ error: "name, email, department and salary are required" });
    }

    const result = await pool.query(
      `INSERT INTO employees (name, email, department, salary)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, department, salary, created_at`,
      [name, email, department, salary]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      // unique_violation on the email column
      return res.status(409).json({ error: "An employee with this email already exists" });
    }
    next(err);
  }
}

async function getEmployees(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, name, email, department, salary, created_at
       FROM employees ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

async function getEmployee(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, name, email, department, salary, created_at
       FROM employees WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Employee ${id} not found` });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateEmployee(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, department, salary } = req.body;

    const result = await pool.query(
      `UPDATE employees
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           department = COALESCE($3, department),
           salary = COALESCE($4, salary)
       WHERE id = $5
       RETURNING id, name, email, department, salary, created_at`,
      [name, email, department, salary, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Employee ${id} not found` });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "An employee with this email already exists" });
    }
    next(err);
  }
}

async function deleteEmployee(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM employees WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Employee ${id} not found` });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createEmployee,
  getEmployees,
  getEmployee,
  updateEmployee,
  deleteEmployee,
};
