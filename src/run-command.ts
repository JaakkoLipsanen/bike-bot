import * as dotenv from "dotenv-safe";
import * as fs from "fs";
import * as path from "path";

import CliResponseContext from "./bot/response-context/cli";
import { uploadBlogPost, BlogPostZip } from "./commands/blog-command/blog-upload";

const useDotEnv = !process.env.NO_DOT_ENV;
if (useDotEnv) {
	dotenv.load({ allowEmptyValues: true });
}

const commands = [{ name: "blog-upload", execute: blogUpload }];
const run = async () => {
	const { _: passedArguments } = require("minimist")(process.argv.slice(2));

	try {
		const [commandName, ...args] = passedArguments;
		const command = commands.filter(c => c.name === commandName)[0];
		if (!command) {
			console.error(`Unknown command '${commandName}'`);
			console.error(`Supported commands:\n${commands.map(c => `'${c.name}'`).join(",")}`);
			return;
		}

		await command.execute(args);
	} catch (err) {
		console.error("Something went wrong", err);
	} finally {
		process.exit();
	}
};

async function blogUpload(args: string[]) {
	const zip = getBlogZip(args);
	if (zip) {
		await uploadBlogPost(new CliResponseContext(), zip);
	}
}

function getBlogZip(args: string[]): BlogPostZip | null {
	if (args.length === 0) {
		console.error("Error: the blog post .zip path must be supplied as the argument");
		return null;
	}

	const name = path.basename(args[0]);
	if (!name.endsWith(".zip")) {
		console.error("Error: supplied path does not point to a .zip file");
		return null;
	}

	return { postName: path.basename(name, ".zip"), zipBuffer: fs.readFileSync(args[0]) };
}

run();
