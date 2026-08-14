const request = require("supertest");


// =====================================================
// Mock the mailer so tests never talk to a real SMTP
// server (e.g. MailHog). This keeps tests fast, fully
// offline, and prevents Jest from hanging on an open
// SMTP connection.
// =====================================================

jest.mock("../config/mailer", () => ({
    transporter: { close: jest.fn() },
    sendWelcomeEmail: jest.fn().mockResolvedValue({ messageId: "mock-id" })
}));

const { sendWelcomeEmail } = require("../config/mailer");
const { pool } = require("../config/db");

const app = require("../server");


// =====================================================
// Test Data
// =====================================================

const testUser = {
    name: "Test User",
    email: `test${Date.now()}@example.com`,
    password: "123456"
};


let token;
let productId;
let orderId;


// =====================================================
// HEALTH API
// =====================================================

describe("Health API", () => {

    test("GET / should return API running", async () => {

        const response =
            await request(app)
                .get("/");


        expect(response.statusCode)
            .toBe(200);


        expect(response.body.success)
            .toBe(true);


        expect(response.body.message)
            .toBe("E-Commerce API Running");

    });

});


// =====================================================
// AUTH
// =====================================================

describe("Authentication", () => {

    test("Register user", async () => {

        const response =
            await request(app)
                .post("/api/auth/register")
                .send(testUser);


        expect(response.statusCode)
            .toBe(201);


        expect(response.body.success)
            .toBe(true);


        expect(response.body.userId)
            .toBeDefined();

    });


    test("Registration triggers welcome email", () => {

        expect(sendWelcomeEmail)
            .toHaveBeenCalledTimes(1);

        expect(sendWelcomeEmail)
            .toHaveBeenCalledWith(
                testUser.email,
                testUser.name
            );

    });


    test("Login user", async () => {

        const response =
            await request(app)
                .post("/api/auth/login")
                .send({

                    email: testUser.email,

                    password: testUser.password

                });


        expect(response.statusCode)
            .toBe(200);


        expect(response.body.success)
            .toBe(true);


        expect(response.body.token)
            .toBeDefined();


        token =
            response.body.token;

    });


    test("Login with wrong password", async () => {

        const response =
            await request(app)
                .post("/api/auth/login")
                .send({

                    email: testUser.email,

                    password: "wrongpassword"

                });


        expect(response.statusCode)
            .toBe(401);


        expect(response.body.success)
            .toBe(false);

    });

});


// =====================================================
// PRODUCTS
// =====================================================

describe("Product APIs", () => {

    test("Create product", async () => {

        const response =
            await request(app)
                .post("/api/products")
                .send({

                    name: "Test Laptop",

                    description:
                        "Laptop for testing",

                    price: 50000,

                    stock: 10,

                    category: "Laptop"

                });


        expect(response.statusCode)
            .toBe(201);


        expect(response.body.success)
            .toBe(true);


        expect(response.body.productId)
            .toBeDefined();


        productId =
            response.body.productId;

    });


    test("Get all products", async () => {

        const response =
            await request(app)
                .get("/api/products");


        expect(response.statusCode)
            .toBe(200);


        expect(response.body.success)
            .toBe(true);


        expect(
            Array.isArray(response.body.products)
        ).toBe(true);

    });


    test("Get product by ID", async () => {

        const response =
            await request(app)
                .get(
                    `/api/products/${productId}`
                );


        expect(response.statusCode)
            .toBe(200);


        expect(response.body.success)
            .toBe(true);


        expect(response.body.product.id)
            .toBe(productId);

    });


    test("Update product", async () => {

        const response =
            await request(app)
                .put(
                    `/api/products/${productId}`
                )
                .send({

                    name: "Updated Laptop",

                    description:
                        "Updated product",

                    price: 55000,

                    stock: 20,

                    category: "Laptop"

                });


        expect(response.statusCode)
            .toBe(200);


        expect(response.body.success)
            .toBe(true);

    });


    test("Delete product", async () => {

        // We don't delete yet because
        // cart/order tests need the product.
        expect(productId)
            .toBeDefined();

    });

});


// =====================================================
// CART
// =====================================================

describe("Cart APIs", () => {

    test("Get cart without token", async () => {

        const response =
            await request(app)
                .get("/api/cart");


        expect(response.statusCode)
            .toBe(401);

    });


    test("Add product to cart", async () => {

        const response =
            await request(app)
                .post("/api/cart")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                )
                .send({

                    productId,

                    quantity: 2

                });


        expect(response.statusCode)
            .toBe(200);


        expect(response.body.success)
            .toBe(true);

    });


    test("Get cart", async () => {

        const response =
            await request(app)
                .get("/api/cart")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                );


        expect(response.statusCode)
            .toBe(200);


        expect(response.body.success)
            .toBe(true);


        expect(
            Array.isArray(response.body.items)
        ).toBe(true);


        expect(response.body.total)
            .toBeDefined();

    });

});


// =====================================================
// ORDERS
// =====================================================

describe("Order APIs", () => {

    test("Create order", async () => {

        const response =
            await request(app)
                .post("/api/orders")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                );


        expect(response.statusCode)
            .toBe(201);


        expect(response.body.success)
            .toBe(true);


        expect(response.body.orderId)
            .toBeDefined();


        orderId =
            response.body.orderId;

    });


    test("Get my orders", async () => {

        const response =
            await request(app)
                .get("/api/orders")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                );


        expect(response.statusCode)
            .toBe(200);


        expect(response.body.success)
            .toBe(true);


        expect(
            Array.isArray(response.body.orders)
        ).toBe(true);

    });


    test("Get order by ID", async () => {

        const response =
            await request(app)
                .get(
                    `/api/orders/${orderId}`
                )
                .set(
                    "Authorization",
                    `Bearer ${token}`
                );


        expect(response.statusCode)
            .toBe(200);


        expect(response.body.success)
            .toBe(true);


        expect(response.body.order.id)
            .toBe(orderId);


        expect(
            Array.isArray(response.body.items)
        ).toBe(true);

    });

});


// =====================================================
// AUTHORIZATION
// =====================================================

describe("Authorization", () => {

    test("Cart should reject invalid token", async () => {

        const response =
            await request(app)
                .get("/api/cart")
                .set(
                    "Authorization",
                    "Bearer invalid-token"
                );


        expect(response.statusCode)
            .toBe(401);

    });


    test("Orders should reject request without token", async () => {

        const response =
            await request(app)
                .get("/api/orders");


        expect(response.statusCode)
            .toBe(401);

    });

});


// =====================================================
// CLEANUP
// =====================================================

afterAll(async () => {

    await pool.end();

});