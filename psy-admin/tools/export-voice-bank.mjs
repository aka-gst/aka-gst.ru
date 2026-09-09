import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { VOICE_BANK_VERSION, voiceBankEntries } from "../voice-bank.js";

const output = process.argv[2];
if (!output) throw new Error("usage: node export-voice-bank.mjs <output.json>");

const target = resolve(output);
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify({
  version: VOICE_BANK_VERSION,
  voice: "A",
  entries: voiceBankEntries.map(({ id, spokenText }) => ({ id, spokenText })),
}, null, 2)}\n`, "utf8");

console.log(`voice_bank_manifest=${target}`);
console.log(`entries=${voiceBankEntries.length}`);
