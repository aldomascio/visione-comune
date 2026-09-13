import { argon2, randomBytes, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { createInterface } from "node:readline/promises";

const argon2Async = promisify(argon2);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to create an admin user.");
  process.exit(1);
}

const emailArg = readFlag("--email");
const passwordArg = readFlag("--password");
const email = normalizeEmail(emailArg ?? (await promptVisible("Email amministratore: ")));
const password = passwordArg ?? (await promptHidden("Password amministratore: "));

try {
  validateEmail(email);
  validatePassword(password);

  const passwordHash = await hashPassword(password);
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const existing = await sql`select id from admin_users where email = ${email} limit 1`;

    if (existing.length > 0) {
      console.error("Admin gia esistente per questa email.");
      process.exit(1);
    }

    await sql`
      insert into admin_users (id, email, password_hash, role, active)
      values (${randomUUID()}, ${email}, ${passwordHash}, 'admin', true)
    `;
    console.log(`Admin creato: ${email}`);
  } finally {
    await sql.end();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Errore durante la creazione admin.");
  process.exitCode = 1;
}

function readFlag(name) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function promptVisible(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

async function promptHidden(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return promptVisible(question);
  }

  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  let value = "";

  return new Promise((resolve) => {
    const onData = (char) => {
      if (char === "\u0003") {
        process.stdout.write("\n");
        process.exit(130);
      }

      if (char === "\r" || char === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
        return;
      }

      if (char === "\u007f") {
        value = value.slice(0, -1);
        return;
      }

      value += char;
    };

    process.stdin.on("data", onData);
  });
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function validateEmail(email) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Email amministratore non valida.");
  }
}

function validatePassword(password) {
  if (password.length < 12) {
    throw new Error("La password deve contenere almeno 12 caratteri.");
  }
}

async function hashPassword(password) {
  const nonce = randomBytes(16);
  const derivedKey = await argon2Async("argon2id", {
    message: password,
    nonce,
    memory: 65_536,
    passes: 3,
    parallelism: 1,
    tagLength: 32
  });

  return [
    "argon2id",
    "v=19",
    "m=65536,t=3,p=1",
    nonce.toString("base64url"),
    derivedKey.toString("base64url")
  ].join("$");
}
