const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "mailhog",
    port: Number(process.env.MAIL_PORT || 1025),
    secure: false
});

async function sendWelcomeEmail(to, name) {

    const mailOptions = {
        from: "noreply@ecommerce.com",
        to: to,
        subject: "Welcome to E-Commerce",
        text: `Hello ${name},

Welcome to our E-Commerce platform.

Your account has been successfully created.

Thank you,
E-Commerce Team
`,
        html: `
            <h2>Welcome ${name}! 🎉</h2>

            <p>
                Your E-Commerce account has been successfully created.
            </p>

            <p>
                You can now login and start shopping.
            </p>

            <br>

            <p>
                Thanks,<br>
                <strong>E-Commerce Team</strong>
            </p>
        `
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent:", info.messageId);

    return info;
}

module.exports = {
    transporter,
    sendWelcomeEmail
};