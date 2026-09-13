import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const argon2Async = promisify(argon2);
const ARGON2_ALGORITHM = "argon2id";
const ARGON2_VERSION = 19;
const ARGON2_MEMORY = 65_536;
const ARGON2_PASSES = 3;
const ARGON2_PARALLELISM = 1;
const ARGON2_TAG_LENGTH = 32;
const ARGON2_NONCE_LENGTH = 16;

export class InvalidPasswordHashError extends Error {
  constructor() {
    super("Invalid password hash format.");
    this.name = "InvalidPasswordHashError";
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordInput(password);
  const nonce = randomBytes(ARGON2_NONCE_LENGTH);
  const derivedKey = await derivePasswordKey(password, nonce);

  return [
    ARGON2_ALGORITHM,
    `v=${ARGON2_VERSION}`,
    `m=${ARGON2_MEMORY},t=${ARGON2_PASSES},p=${ARGON2_PARALLELISM}`,
    nonce.toString("base64url"),
    derivedKey.toString("base64url")
  ].join("$");
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  assertPasswordInput(password);
  const parsedHash = parsePasswordHash(passwordHash);
  const derivedKey = await derivePasswordKey(password, parsedHash.nonce, parsedHash.params);

  return (
    derivedKey.length === parsedHash.hash.length && timingSafeEqual(derivedKey, parsedHash.hash)
  );
}

function assertPasswordInput(password: string): void {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password is required.");
  }
}

function parsePasswordHash(passwordHash: string): {
  nonce: Buffer;
  hash: Buffer;
  params: Argon2Params;
} {
  const [algorithm, version, params, nonce, hash] = passwordHash.split("$");

  if (algorithm !== ARGON2_ALGORITHM || version !== `v=${ARGON2_VERSION}` || !params || !nonce || !hash) {
    throw new InvalidPasswordHashError();
  }

  const parsedParams = Object.fromEntries(
    params.split(",").map((entry) => {
      const [key, value] = entry.split("=");
      return [key, Number(value)];
    })
  );

  if (
    parsedParams.m !== ARGON2_MEMORY ||
    parsedParams.t !== ARGON2_PASSES ||
    parsedParams.p !== ARGON2_PARALLELISM
  ) {
    throw new InvalidPasswordHashError();
  }

  return {
    nonce: Buffer.from(nonce, "base64url"),
    hash: Buffer.from(hash, "base64url"),
    params: {
      memory: parsedParams.m,
      passes: parsedParams.t,
      parallelism: parsedParams.p,
      tagLength: ARGON2_TAG_LENGTH
    }
  };
}

type Argon2Params = {
  memory: number;
  passes: number;
  parallelism: number;
  tagLength: number;
};

async function derivePasswordKey(
  password: string,
  nonce: Buffer,
  params: Argon2Params = {
    memory: ARGON2_MEMORY,
    passes: ARGON2_PASSES,
    parallelism: ARGON2_PARALLELISM,
    tagLength: ARGON2_TAG_LENGTH
  }
): Promise<Buffer> {
  return argon2Async(ARGON2_ALGORITHM, {
    message: password,
    nonce,
    memory: params.memory,
    passes: params.passes,
    parallelism: params.parallelism,
    tagLength: params.tagLength
  });
}
