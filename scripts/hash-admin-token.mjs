#!/usr/bin/env node
/**
 * Generates a hashed verifier for the owner's admin passcode.
 *
 * Run it, paste the passcode when prompted, then store the printed value as the
 * ADMIN_API_TOKEN_HASH environment variable in the Netlify UI and delete the old
 * plaintext ADMIN_API_TOKEN:
 *
 *   node scripts/hash-admin-token.mjs
 *
 * The passcode is read from stdin rather than argv so it never lands in shell
 * history or a process listing, and it is never echoed or logged. Only the
 * salted verifier is printed; it cannot be replayed as a credential.
 *
 * The output format and parameters must stay in step with
 * netlify/lib/admin-credential.ts, which verifies these values.
 */

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

const DIGEST = "sha512";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const VERIFIER_SCHEME = "pbkdf2-sha512";
const ITERATIONS = 210_000;
const MIN_PASSCODE_LENGTH = 12;
const MAX_PASSCODE_LENGTH = 200;

/** Reads one line from stdin without echoing it back to the terminal. */
function readSecret(promptText) {
  return new Promise((resolve, reject) => {
    process.stderr.write(promptText);

    const input = process.stdin;
    const wasRaw = Boolean(input.isTTY && input.isRaw);

    if (input.isTTY) {
      // Suppress the echo of each keystroke for the duration of the prompt.
      const rl = createInterface({ input, output: process.stderr, terminal: true });
      const originalWrite = rl._writeToOutput?.bind(rl);
      rl._writeToOutput = () => {};
      rl.question("", (answer) => {
        if (originalWrite) rl._writeToOutput = originalWrite;
        rl.close();
        if (input.isRaw !== wasRaw && input.setRawMode) input.setRawMode(wasRaw);
        process.stderr.write("\n");
        resolve(answer);
      });
      rl.on("error", reject);
      return;
    }

    // Piped input (`echo … | node scripts/hash-admin-token.mjs`): read the first line.
    let buffer = "";
    input.setEncoding("utf8");
    input.on("data", (chunk) => {
      buffer += chunk;
    });
    input.on("end", () => resolve(buffer.split("\n")[0] ?? ""));
    input.on("error", reject);
  });
}

const passcode = (await readSecret("Admin passcode (input hidden): ")).trim();

if (passcode.length < MIN_PASSCODE_LENGTH) {
  console.error(`Passcode must be at least ${MIN_PASSCODE_LENGTH} characters. Nothing was written.`);
  process.exit(1);
}

if (passcode.length > MAX_PASSCODE_LENGTH) {
  console.error(`Passcode must be at most ${MAX_PASSCODE_LENGTH} characters. Nothing was written.`);
  process.exit(1);
}

const salt = randomBytes(SALT_LENGTH);
const derived = pbkdf2Sync(passcode.normalize("NFKC"), salt, ITERATIONS, KEY_LENGTH, DIGEST);
const verifier = [VERIFIER_SCHEME, ITERATIONS, salt.toString("base64"), derived.toString("base64")].join("$");

process.stderr.write("\nSet this as ADMIN_API_TOKEN_HASH in your Netlify environment variables,\n");
process.stderr.write("then remove the plaintext ADMIN_API_TOKEN variable:\n\n");
// stdout only, so `node scripts/hash-admin-token.mjs > verifier.txt` captures
// just the value without the surrounding guidance.
console.log(verifier);
