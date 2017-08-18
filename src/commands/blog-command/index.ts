import * as JsZip from 'jszip'; 
import { Command } from '../../bot';
import ResponseContext from '../../bot/response-context';
import * as awsHelper from '../../aws-helper';

export default class GpsCommand extends Command {
	constructor(ctx: ResponseContext, ...args: any[]) {
		super(ctx, ...args);
	}

	async run(ctx: ResponseContext, params: string[]) {
		if(params.length >= 1) {
			if(params[0] === "list") return this.listPosts(ctx);
			if(params.length >= 2) {
				if(params[0] === "dl") return this.downloadPost(ctx, params[1]);
			}
		}
	}

	private async listPosts(ctx: ResponseContext) {
		const currentTour = await awsHelper.getCurrentTour();
		const allPosts = await awsHelper.getBlogPostInfos();
		
		const currentTourPosts = allPosts.filter(post => post.tripDirectoryName === currentTour.directoryName);
		const blogPostListStr = currentTourPosts.length > 0 ? 
			"\n" + currentTourPosts.map(post => `*${post.name}* _(days ${post.dayRange})_`).join("\n") :
			"_No posts for this tour_";

		ctx.sendText(`*Posts for trip ${currentTour.name}:*\n` + blogPostListStr);
	}

	private async downloadPost(ctx: ResponseContext, postName: string): Promise<void> {
		const allPosts = await awsHelper.getBlogPostInfos();

		const post = allPosts.find(post => post.name === postName);
		if(!post) {
			ctx.sendText(`Post '${postName}' not found!`);
			return;
		}

		const zip = await this.zipAwsFilesWithPrefix(`cycle/blog/posts/${post.name}/`);
		ctx.sendDocument(zip, undefined, { filename: `${post.name}.zip` });
	}

	private async zipAwsFilesWithPrefix(prefix: string) {
		const files = await awsHelper.listFiles(prefix);

		const zipper = new JsZip();
		for(const { key } of files) {
			if(!key) continue;

			const file = await awsHelper.loadFile<Buffer>(key);
			if(!file) continue;
			
			const outputFileName = key.substr(prefix.length);
			zipper.file("/" + outputFileName, file);
		}

		return await zipper.generateAsync({type: "nodebuffer"}) as Buffer;
	}
}