
const { pool } = require("../config/db");


// =========================================================
// GET ALL PRODUCTS
// =========================================================

exports.getProducts = async (req, res) => {

    try {

        const [products] =
            await pool.execute(
                "SELECT * FROM products ORDER BY id DESC"
            );

        res.json({

            success: true,

            products

        });

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =========================================================
// GET PRODUCT BY ID
// =========================================================

exports.getProductById = async (req, res) => {

    try {

        const { id } = req.params;

        const [products] =
            await pool.execute(

                "SELECT * FROM products WHERE id = ?",

                [id]

            );

        if (products.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Product not found"

            });

        }

        res.json({

            success: true,

            product: products[0]

        });

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =========================================================
// CREATE PRODUCT
// =========================================================

exports.createProduct = async (req, res) => {

    try {

        const {
            name,
            description,
            price,
            stock = 0,
            category
        } = req.body;

        if (!name || price === undefined) {

            return res.status(400).json({

                success: false,

                message: "name and price are required"

            });

        }

        const [result] =
            await pool.execute(

                `
                INSERT INTO products
                (name, description, price, stock, category)
                VALUES (?, ?, ?, ?, ?)
                `,

                [
                    name,
                    description || null,
                    price,
                    stock,
                    category || null
                ]

            );

        res.status(201).json({

            success: true,

            message: "Product created successfully",

            productId: result.insertId

        });

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =========================================================
// UPDATE PRODUCT
// =========================================================

exports.updateProduct = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            name,
            description,
            price,
            stock,
            category
        } = req.body;

        const [existing] =
            await pool.execute(

                "SELECT * FROM products WHERE id = ?",

                [id]

            );

        if (existing.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Product not found"

            });

        }

        const current = existing[0];

        await pool.execute(

            `
            UPDATE products
            SET name = ?,
                description = ?,
                price = ?,
                stock = ?,
                category = ?
            WHERE id = ?
            `,

            [
                name ?? current.name,
                description ?? current.description,
                price ?? current.price,
                stock ?? current.stock,
                category ?? current.category,
                id
            ]

        );

        res.json({

            success: true,

            message: "Product updated successfully"

        });

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// =========================================================
// DELETE PRODUCT
// =========================================================

exports.deleteProduct = async (req, res) => {

    try {

        const { id } = req.params;

        const [result] =
            await pool.execute(

                "DELETE FROM products WHERE id = ?",

                [id]

            );

        if (result.affectedRows === 0) {

            return res.status(404).json({

                success: false,

                message: "Product not found"

            });

        }

        res.json({

            success: true,

            message: "Product deleted successfully"

        });

    } catch (error) {

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};
