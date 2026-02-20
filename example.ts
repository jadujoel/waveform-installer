import { Waveform } from "./index.ts";
export async function example() {
  await Waveform.$`--version`;
}

if (import.meta.main) {
  await example();
}
