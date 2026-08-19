require("dotenv").config();

const express = require("express");

const { connectDB } = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();

app.use(express.json());

// Stamps every response with the container hostname that
// handled it — useful for confirming nginx is actually
// spreading traffic across scaled api replicas.
app.use((req, res, next) => {

    res.set("X-Served-By", process.env.HOSTNAME || "unknown");

    next();

});

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "E-Commerce API Running"
    });
});

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "E-Commerce API Running"
    });
});

app.get("/health2", (req, res) => {
    res.json({
        success: true,
        message: "E-Commerce API Running"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {

    connectDB();

    app.listen(PORT, () => {
        console.log("Server running on port:", PORT);
    });

}

module.exports = app;