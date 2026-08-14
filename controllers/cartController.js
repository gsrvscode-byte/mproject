
const { pool } = require("../config/db");


// =========================================================
// GET CART
// =========================================================

exports.getCart = async (req, res) => {

    try {

        const userId =
            req.user.userId;


        const [items] =
            await pool.execute(

                `
                SELECT
                    cart_items.id,
                    products.id AS product_id,
                    products.name,
                    products.price,
                    cart_items.quantity,

                    (
                        products.price *
                        cart_items.quantity
                    ) AS subtotal

                FROM cart_items

                JOIN products
                    ON products.id =
                    cart_items.product_id

                WHERE cart_items.user_id = ?

                ORDER BY cart_items.id DESC
                `,

                [userId]

            );


        let total = 0;


        items.forEach(item => {

            total +=
                Number(item.subtotal);

        });


        res.json({

            success: true,

            items,

            total

        });


    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =========================================================
// ADD TO CART
// =========================================================

exports.addToCart = async (req, res) => {

    try {

        const userId =
            req.user.userId;


        const {
            productId,
            quantity = 1
        } = req.body;


        if (!productId) {

            return res.status(400).json({

                success: false,

                message: "productId required"

            });

        }


        // Check product

        const [products] =
            await pool.execute(

                "SELECT * FROM products WHERE id = ?",

                [productId]

            );


        if (products.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Product not found"

            });

        }


        const product =
            products[0];


        if (product.stock < quantity) {

            return res.status(400).json({

                success: false,

                message: "Insufficient stock"

            });

        }


        // Check existing cart item

        const [existing] =
            await pool.execute(

                `
                SELECT *
                FROM cart_items
                WHERE user_id = ?
                AND product_id = ?
                `,

                [
                    userId,
                    productId
                ]

            );


        if (existing.length > 0) {

            await pool.execute(

                `
                UPDATE cart_items
                SET quantity = quantity + ?
                WHERE user_id = ?
                AND product_id = ?
                `,

                [

                    quantity,

                    userId,

                    productId

                ]

            );

        } else {

            await pool.execute(

                `
                INSERT INTO cart_items
                (
                    user_id,
                    product_id,
                    quantity
                )
                VALUES (?, ?, ?)
                `,

                [

                    userId,

                    productId,

                    quantity

                ]

            );

        }


        res.json({

            success: true,

            message: "Product added to cart"

        });


    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =========================================================
// REMOVE CART ITEM
// =========================================================

exports.removeFromCart = async (req, res) => {

    try {

        const userId =
            req.user.userId;


        const { productId } =
            req.params;


        const [result] =
            await pool.execute(

                `
                DELETE FROM cart_items
                WHERE user_id = ?
                AND product_id = ?
                `,

                [

                    userId,

                    productId

                ]

            );


        if (result.affectedRows === 0) {

            return res.status(404).json({

                success: false,

                message: "Cart item not found"

            });

        }


        res.json({

            success: true,

            message: "Product removed from cart"

        });


    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};
