
const { pool } = require("../config/db");


// =========================================================
// CREATE ORDER
// =========================================================

exports.createOrder = async (req, res) => {

    const connection =
        await pool.getConnection();


    try {

        const userId =
            req.user.userId;


        await connection.beginTransaction();


        // Get cart

        const [cartItems] =
            await connection.execute(

                `
                SELECT
                    cart_items.product_id,
                    cart_items.quantity,
                    products.price,
                    products.stock

                FROM cart_items

                JOIN products
                    ON products.id =
                    cart_items.product_id

                WHERE cart_items.user_id = ?

                FOR UPDATE
                `,

                [userId]

            );


        if (cartItems.length === 0) {

            await connection.rollback();

            return res.status(400).json({

                success: false,

                message: "Cart is empty"

            });

        }


        let totalAmount = 0;


        for (const item of cartItems) {

            if (
                item.stock <
                item.quantity
            ) {

                await connection.rollback();

                return res.status(400).json({

                    success: false,

                    message:
                        "Insufficient stock"

                });

            }


            totalAmount +=
                Number(item.price) *
                Number(item.quantity);

        }


        // Create order

        const [orderResult] =
            await connection.execute(

                `
                INSERT INTO orders
                (
                    user_id,
                    total_amount,
                    status
                )
                VALUES (?, ?, 'PENDING')
                `,

                [

                    userId,

                    totalAmount

                ]

            );


        const orderId =
            orderResult.insertId;


        // Insert order items

        for (const item of cartItems) {

            await connection.execute(

                `
                INSERT INTO order_items
                (
                    order_id,
                    product_id,
                    quantity,
                    price
                )
                VALUES (?, ?, ?, ?)
                `,

                [

                    orderId,

                    item.product_id,

                    item.quantity,

                    item.price

                ]

            );


            // Reduce stock

            await connection.execute(

                `
                UPDATE products

                SET stock =
                    stock - ?

                WHERE id = ?
                `,

                [

                    item.quantity,

                    item.product_id

                ]

            );

        }


        // Clear cart

        await connection.execute(

            "DELETE FROM cart_items WHERE user_id = ?",

            [userId]

        );


        await connection.commit();


        res.status(201).json({

            success: true,

            message: "Order created",

            orderId,

            totalAmount

        });


    } catch (error) {

        await connection.rollback();


        res.status(500).json({

            success: false,

            message: error.message

        });


    } finally {

        connection.release();

    }

};


// =========================================================
// GET MY ORDERS
// =========================================================

exports.getOrders = async (req, res) => {

    try {

        const userId =
            req.user.userId;


        const [orders] =
            await pool.execute(

                `
                SELECT *
                FROM orders

                WHERE user_id = ?

                ORDER BY created_at DESC
                `,

                [userId]

            );


        res.json({

            success: true,

            orders

        });


    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =========================================================
// GET ORDER DETAILS
// =========================================================

exports.getOrderById = async (req, res) => {

    try {

        const userId =
            req.user.userId;


        const { id } =
            req.params;


        const [orders] =
            await pool.execute(

                `
                SELECT *
                FROM orders

                WHERE id = ?
                AND user_id = ?
                `,

                [

                    id,

                    userId

                ]

            );


        if (orders.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Order not found"

            });

        }


        const [items] =
            await pool.execute(

                `
                SELECT
                    order_items.*,
                    products.name

                FROM order_items

                JOIN products
                    ON products.id =
                    order_items.product_id

                WHERE order_id = ?
                `,

                [id]

            );


        res.json({

            success: true,

            order: orders[0],

            items

        });


    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};
