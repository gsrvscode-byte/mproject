
const router = require("express").Router();

const auth =
    require("../middleware/auth");


const {
    createOrder,
    getOrders,
    getOrderById
} = require("../controllers/orderController");


router.post(
    "/",
    auth,
    createOrder
);


router.get(
    "/",
    auth,
    getOrders
);


router.get(
    "/:id",
    auth,
    getOrderById
);


module.exports = router;
