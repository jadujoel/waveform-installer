import { Waveform } from "@jadujoel/waveform-installer";

export async function main(): Promise<void> {
	console.log("Generating waveform...");
	const result = await Waveform.generate({ input: "tone.wav" });
  console.log(`Waveform generated at: ${result}`);
	console.log("Done!");
}

if (import.meta.main) {
	await main();
}
