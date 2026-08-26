// tests/employee.test.js
//
// These tests hit the real Express app (via Supertest, no real network
// port needed) against a real Postgres database. That means Postgres
// must be running and reachable before `npm test` runs — in Jenkins,
// that's why "Docker Compose Up" (or at least starting Postgres) happens
// before this stage in a full pipeline, and locally you just need
// `docker compose up postgres` running first.
//
// We run tests with --runInBand (see package.json) so they execute one
// at a time in order, since each test depends on state created by the
// previous one (the created employee's id).

const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/db");

let createdId;
const testEmail = `test.employee.${Date.now()}@example.com`;

describe("Employee CRUD API", () => {
  afterAll(async () => {
    // Clean up the test row and close the pool so Jest can exit cleanly.
    if (createdId) {
      await pool.query("DELETE FROM employees WHERE id = $1", [createdId]);
    }
    await pool.end();
  });

  test("POST /api/employees creates an employee", async () => {
    const res = await request(app).post("/api/employees").send({
      name: "Ada Lovelace",
      email: testEmail,
      department: "Engineering",
      salary: 95000,
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.name).toBe("Ada Lovelace");

    createdId = res.body.id;
  });

  test("GET /api/employees returns a list including the new employee", async () => {
    const res = await request(app).get("/api/employees");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((e) => e.id === createdId)).toBe(true);
  });

  test("GET /api/employees/:id returns the created employee", async () => {
    const res = await request(app).get(`/api/employees/${createdId}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testEmail);
  });

  test("PUT /api/employees/:id updates the employee", async () => {
    const res = await request(app)
      .put(`/api/employees/${createdId}`)
      .send({ department: "Platform Engineering", salary: 101000 });

    expect(res.status).toBe(200);
    expect(res.body.department).toBe("Platform Engineering");
    expect(Number(res.body.salary)).toBe(101000);
  });

  test("DELETE /api/employees/:id deletes the employee", async () => {
    const res = await request(app).delete(`/api/employees/${createdId}`);
    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/api/employees/${createdId}`);
    expect(getRes.status).toBe(404);

    createdId = null; // already deleted, skip afterAll cleanup
  });
});
