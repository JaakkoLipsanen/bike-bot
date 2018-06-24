import { Command, ResponseContext } from "../../bot";
import * as awsHelper from "../../aws-helper";

import { uploadBlogPost } from "./blog-upload";
import { downloadBlogPost } from "./blog-download";

export default class BlogCommand extends Command {
	constructor(ctx: ResponseContext, ...args: any[]) {
		super(ctx, ...args);
	}

	async run(ctx: ResponseContext, params: string[]) {
		if (params.length >= 1) {
			switch (params[0]) {
				case "list":
					const listOnlyCurrentTourPosts = params[1] !== "all";
					return this.listPosts(ctx, listOnlyCurrentTourPosts);

				case "dl":
					if (params.length >= 2) {
						return downloadBlogPost(ctx, params[1]);
					}
			}

			ctx.sendText("Unrecognized parameters");
		}

		return uploadBlogPost(ctx);
	}

	private async listPosts(ctx: ResponseContext, listOnlyCurrentTourPosts: boolean) {
		const currentTour = await awsHelper.getCurrentTour();
		const allPosts = await awsHelper.getBlogPostInfos();

		const filteredPosts = listOnlyCurrentTourPosts
			? allPosts.filter(post => post.tripDirectoryName === currentTour.directoryName)
			: allPosts;

		const blogPostListStr =
			filteredPosts.length > 0
				? "\n" + filteredPosts.map(post => `*${post.name}* _(days ${post.dayRange})_`).join("\n")
				: "_No posts for this tour_";

		ctx.sendText(
			`*Posts for ${listOnlyCurrentTourPosts ? `trip ${currentTour.name}` : "all trips"}:*\n` +
				blogPostListStr
		);
	}
}
