import { Document, ResponseContext } from "../../bot";

type ZipSplitInfo = { fileIndex: number; totalSplitCount: number };

// the ZIP can be sent either as single .zip file or splitted into multiple files (.zip.1o3 .zip.2o3 .zip.3o3)
export async function askForBlogZip(ctx: ResponseContext) {
	let parts: Buffer[] | undefined;

	const loadBuffer = async (document: Document) => {
		const file = await ctx.downloadDocument(document);
		return await file.buffer();
	};

	return await ctx.askForMessage<{ postName: string; zipBuffer: Buffer }>(
		"Upload a blog .zip file",
		{
			accept: async (msg, reject) => {
				if (!msg.document) {
					return reject("Must send a zip file!");
				}

				if (msg.document.file_name.endsWith(".zip")) {
					const postName = msg.document.file_name.split(".")[0];
					return { postName, zipBuffer: await loadBuffer(msg.document) };
				}

				const zipSplitInfo = getZipSplitInfoFromFilename(msg.document.file_name);
				if (!zipSplitInfo) {
					return reject("Must be .zip or .zip.1o3 (for example) file!");
				}

				if (!parts) {
					parts = Array(zipSplitInfo.totalSplitCount).fill(undefined);
				}

				parts[zipSplitInfo.fileIndex - 1] = await loadBuffer(msg.document);
				if (parts.every(part => Boolean(part))) {
					const postName = msg.document.file_name.split(".")[0];
					return { postName, zipBuffer: Buffer.concat(parts) };
				}

				const missingParts = parts
					.map((value, index) => (value ? "" : index + 1 + "o" + parts!.length))
					.filter(x => x);

				return reject(
					`${missingParts.length > 1 ? "Parts " : "Part "} ${missingParts.join(", ")} missing!`
				);
			}
		},
		"edit"
	);
}

function getZipSplitInfoFromFilename(filename: string): ZipSplitInfo | undefined {
	const SplitZipRegex = /.*\do\d$/g;
	if (!filename.match(SplitZipRegex)) {
		return undefined;
	}

	const filenameParts = filename.split(".");
	const extension = filenameParts[filenameParts.length - 1]; // "2o3" for example == "part 2 of 3"

	const extensionXofY = extension.split("o");
	if (extensionXofY.length !== 2) return undefined;

	return {
		fileIndex: parseInt(extensionXofY[0]),
		totalSplitCount: parseInt(extensionXofY[1])
	};
}
