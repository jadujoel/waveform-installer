import { join } from "node:path";

const binaryName = process.platform === "win32" ? "audiowaveform.exe" : "audiowaveform";

export function getAudiowaveformPath(): string {
	return join(import.meta.dir, ".audiowaveform", binaryName);
}

export async function hasAudiowaveformBinary(): Promise<boolean> {
	return Bun.file(getAudiowaveformPath()).exists();
}

export function getAudiowaveformCommand(args: readonly string[] = []): string[] {
	return [getAudiowaveformPath(), ...args];
}

export async function install(): Promise<string | never> {
	const binary = getAudiowaveformPath();
	if (!Bun.file(binary).exists()) {
		await Bun.$`scripts/install.ts`
	}
	return binary
}

/**
 * Template string literal function that forwards to Bun.$
 */
export async function $(strings: TemplateStringsArray, ...values: unknown[]): Promise<Bun.$.ShellOutput | never> {
	const binary = await install()
	const command = strings.reduce((acc, str, index) => acc + str + String(values[index] ?? ""), "");
	return Bun.$`${binary} ${{ raw: command }}`;
}

export interface GenerateOptions<
TWavFile extends string = string, // `${string}.wav`,
TWaveformFile extends string = string, // `${string}.png` | `${string}.dat`
> {
	readonly input: TWavFile;
	/**
	 * If not provided, the output file will be named after the input file with a .png extension.
	 * @default `${input}.png`
	 */
	readonly output?: TWaveformFile;
	/**
	 * @default 8
	 */
	readonly bits?: 8 | 16;
	/**
	 * @default 64
	 */
	readonly zoom?: number;
}

export async function generate<const TGenerateOptions extends GenerateOptions>(options: TGenerateOptions): Promise<string> {
	const {
		output = `${options.input.replace(".wav", ".png")}`,
	  bits = 8,
		zoom = 64,
 } = options;
	const args = [
		"-i", options.input,
		"-o", output,
		"--bits", bits,
		"--zoom", zoom,
	];
	await Waveform.$`${args.join(" ")}`;
	return output;
}

export const Waveform = {
	$,
	binaryName,
	getAudiowaveformPath,
	getAudiowaveformCommand,
	hasAudiowaveformBinary,
	install,
	generate
};

if (import.meta.main) {
	await install()
	console.log(`Audiowaveform binary is installed at: ${getAudiowaveformPath()}`);
}
