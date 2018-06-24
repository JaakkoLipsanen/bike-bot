import * as JsZip from "jszip";
import * as gm from "gm";
import * as path from "path";
import * as awsHelper from "../../aws-helper";
import { ResponseContext } from "../../bot";
import { Size } from "../../common";

import { askForBlogZip } from "./zip-helper";

interface ImageResizePreset {
	resolution: Size;
	imageType: "jpg" | "png";
	folderName: string;
}

const BlogImageResizePresets: ImageResizePreset[] = [
	{ folderName: "1080p", resolution: { width: 1920, height: 1080 }, imageType: "jpg" },
	{ folderName: "720p", resolution: { width: 1280, height: 720 }, imageType: "jpg" },
	{ folderName: "480p", resolution: { width: 800, height: 480 }, imageType: "jpg" },
	{ folderName: "360p", resolution: { width: 640, height: 360 }, imageType: "jpg" },
	{ folderName: "240p", resolution: { width: 360, height: 240 }, imageType: "jpg" },
	{ folderName: "10p", resolution: { width: 10, height: 10 }, imageType: "png" }
];

export async function uploadBlogPost(ctx: ResponseContext) {
	const zipper = new JsZip();

	const blogPost = (await askForBlogZip(ctx)).value;
	const blogPostName = blogPost.postName; // todo: check if has invalid characters?

	if (await checkIfPostExists(blogPostName)) {
		if (!(await askIfOverwriteAllowed(ctx, blogPostName))) {
			ctx.sendMessage("Cancelled!");
			return;
		}
	}

	const zip = await zipper.loadAsync(blogPost.zipBuffer);
	const postFile = await zip.file("/post.txt");

	if (!postFile) {
		ctx.sendText("No post.txt found in the .zip, aborting!");
		return;
	}

	const blogPostImages = await zip.filter((path, file) => path.startsWith("/orig/"));
	const statusMessage = await ctx.sendText("Converting...");

	const awsBlogPostPath = `cycle/blog/posts/${blogPostName}`;
	for (const [index, imageFile] of blogPostImages.entries()) {
		const buffer: Buffer = await imageFile.async("nodebuffer");

		const gmBuffer = gm(buffer);
		const imageSize = await new Promise<Size>((resolve, reject) => {
			gmBuffer.size((err: any, size: Size) => {
				if (err) reject(err);
				else resolve(size);
			});
		});

		const imageFileName = path.basename(imageFile.name, path.extname(imageFile.name)); // without extension
		for (const resizePresets of BlogImageResizePresets) {
			const imageAwsPath = `${awsBlogPostPath}/${resizePresets.folderName}/${imageFileName}.${
				resizePresets.imageType
			}`;
			const resizedImageBuffer = await resizeImage(gmBuffer, imageSize, resizePresets);

			await awsHelper.uploadFile(imageAwsPath, resizedImageBuffer);
		}

		ctx.editMessageText(statusMessage, `Converted *${index + 1}/${blogPostImages.length}*`);
	}

	await ctx.editMessageText(statusMessage, `Uploading post.txt & updating posts.txt...`);

	const postFileContent = await postFile.async("string");
	await awsHelper.uploadFile(`${awsBlogPostPath}/post.txt`, postFileContent);
	await appendBlogPostInfoToPostsFile(blogPostName, postFileContent);

	ctx.editMessageText(statusMessage, `*Done!*`);
}

async function resizeImage(gmBuffer: any, originalImageSize: Size, resizePreset: ImageResizePreset) {
	const isLandscapeImage = originalImageSize.width > originalImageSize.height;

	/* swap if in portrait mode */
	let resolution = resizePreset.resolution;
	if (!isLandscapeImage) {
		resolution = { width: resolution.height, height: resolution.width };
	}

	const downscaledImageBuffer = await new Promise<Buffer>((resolve, reject) => {
		gmBuffer
			.resize(resolution.width, resolution.height, ">")
			.toBuffer(resizePreset.imageType, function(err: any, imageBuffer: Buffer) {
				if (err) reject(err);

				resolve(imageBuffer);
			});
	});

	return downscaledImageBuffer;
}

async function appendBlogPostInfoToPostsFile(blogPostName: string, postFileContent: string) {
	const awsBlogPostsFilePath = `cycle/blog/posts.txt`;

	const postFileLines = postFileContent.split(/\r?\n/);
	const findLineValue = (key: string) => {
		const line = postFileLines.find(line => line.startsWith(key));
		if (!line) {
			throw `${key} missing from post.txt`;
		}

		return line.substring(key.length).trim();
	};

	const name = blogPostName;
	const trip = findLineValue("trip:");
	const title = findLineValue("title:");
	const dateRange = findLineValue("date-range:");
	const mainImage = findLineValue("main-image:");

	let postsFileContent = await awsHelper.loadTextFile(awsBlogPostsFilePath);
	postsFileContent += "\n";
	postsFileContent += `${name}|${trip}|${title}|${dateRange}|${mainImage}`;

	await awsHelper.uploadFile(awsBlogPostsFilePath, postsFileContent);
}

async function checkIfPostExists(postName: string) {
	const files = await awsHelper.listFiles(`cycle/blog/posts/${postName}/`);
	return files.length > 0;
}

async function askIfOverwriteAllowed(ctx: ResponseContext, blogPostName: string) {
	const overwrite = await ctx.askForMessage<"y" | "n">(`Post '${blogPostName}' exists, overwrite (y/n)?`, {
		accept: (msg, reject) => {
			if (msg.text && (msg.text.toLowerCase() === "y" || msg.text.toLowerCase() === "n")) {
				return msg.text.toLowerCase();
			}

			return reject("Send either 'y' or 'n' to continue");
		}
	});

	return overwrite.value !== "n";
}
