



const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { pool } = require("../config/db");

const {
    sendWelcomeEmail
} = require("../config/mailer");

// =========================================================
// REGISTER
// =========================================================

exports.register = async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;


        if (!name || !email || !password) {

            return res.status(400).json({
                success: false,
                message: "name, email and password are required"
            });

        }


        // Check existing user

        const [users] =
            await pool.execute(
                "SELECT id FROM users WHERE email = ?",
                [email]
            );


        if (users.length > 0) {

            return res.status(400).json({
                success: false,
                message: "Email already registered"
            });

        }


        // Hash password

        const hashedPassword =
            await bcrypt.hash(password, 10);


        // Create user

        const [result] =
            await pool.execute(
                `
                INSERT INTO users
                (name, email, password)
                VALUES (?, ?, ?)
                `,
                [
                    name,
                    email,
                    hashedPassword
                ]
            );


        // Send welcome email

        await sendWelcomeEmail(
            email,
            name
        );


        res.status(201).json({

            success: true,

            message: "User registered successfully",

            userId: result.insertId

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};

// =========================================================
// LOGIN
// =========================================================

exports.login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required"

            });

        }


        const [users] =
            await pool.execute(

                "SELECT * FROM users WHERE email = ?",

                [email]

            );


        if (users.length === 0) {

            return res.status(401).json({

                success: false,

                message: "Invalid credentials"

            });

        }


        const user = users[0];


        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordMatch) {

            return res.status(401).json({

                success: false,

                message: "Invalid credentials"

            });

        }


        const token =
            jwt.sign(

                {
                    userId: user.id,

                    email: user.email

                },

                process.env.JWT_SECRET,

                {
                    expiresIn: "1d"
                }

            );


        res.json({

            success: true,

            message: "Login successful",

            token

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Server error"

        });

    }

};
