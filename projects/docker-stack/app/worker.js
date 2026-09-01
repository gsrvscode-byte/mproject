require("dotenv").config();

const amqp = require("amqplib");
const nodemailer = require("nodemailer");

const RABBIT_URL = `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST || "rabbitmq"}:${process.env.RABBITMQ_PORT_INTERNAL || 5672}`;
const REGISTER_QUEUE = "user_registered";

// MailHog: a dummy local SMTP server + web UI, does not send real email.
// Web UI: http://localhost:8025
const transporter = nodemailer.createTransport({
  host: process.env.MAILHOG_HOST || "mailhog",
  port: Number(process.env.MAILHOG_SMTP_PORT) || 1025,
  secure: false,
  ignoreTLS: true,
});

async function sendWelcomeEmail(user) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "no-reply@example.com",
    to: user.email,
    subject: "Welcome!",
    text: `Hi ${user.name}, thanks for registering. Your account (id: ${user.id}) is ready.`,
    html: `<p>Hi <strong>${user.name}</strong>,</p><p>Thanks for registering. Your account (id: ${user.id}) is ready.</p>`,
  });
}

async function retryConnect(fn, label, attempts = 15, delayMs = 2000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      console.log(`[worker] ${label} not ready (attempt ${i}/${attempts}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(`${label} never became ready`);
}

async function start() {
  const connection = await retryConnect(
    () => amqp.connect(RABBIT_URL),
    "RabbitMQ"
  );
  const channel = await connection.createChannel();
  await channel.assertQueue(REGISTER_QUEUE, { durable: true });
  channel.prefetch(1);

  console.log(`[worker] Waiting for messages on '${REGISTER_QUEUE}'...`);

  channel.consume(REGISTER_QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const user = JSON.parse(msg.content.toString());
      console.log(`[worker] Sending welcome email to ${user.email}`);
      await sendWelcomeEmail(user);
      console.log(`[worker] Email sent to ${user.email} (check http://localhost:8025)`);
      channel.ack(msg);
    } catch (err) {
      console.error("[worker] Failed to process message:", err.message);
      // requeue once; drop after that to avoid infinite loops
      channel.nack(msg, false, false);
    }
  });
}

start().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
