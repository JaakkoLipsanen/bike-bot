import * as JsZip from 'jszip';
import * as awsHelper from '../../aws-helper';
import { ResponseContext } from '../../bot';

export async function downloadBlogPost(ctx: ResponseContext, postName: string): Promise<void> {
    const msg = await ctx.sendText(`Starting the download...`);
    const updateMessagePercentage = (percentage: number) => {
        ctx.editMessageText(msg, `Downloading '${postName}' *${percentage}% done*`);
    };	

    const allPosts = await awsHelper.getBlogPostInfos();
    const post = allPosts.find(post => post.name === postName);

    if(!post) {
        ctx.editMessageText(msg, `Post '${postName}' not found!`);
        return;
    }

    const zip = await zipAwsFilesWithPrefix(`cycle/blog/posts/${post.name}/`, (currentFileNumber, totalFileCount) => {
        updateMessagePercentage(Math.round(currentFileNumber / totalFileCount * 100));
    });	

    ctx.editMessageText(msg, "Uploading to Telegram...");
    await ctx.sendDocument(zip, undefined, { filename: `${post.name}.zip` });
    ctx.editMessageText(msg, "Done!");
}

async function zipAwsFilesWithPrefix(prefix: string, fileZippedCallback: (fileNumber: number, totalFileCount: number) => void) {
    const files = await awsHelper.listFiles(prefix);

    const zipper = new JsZip();
    let zippedFiles = 0;
    for(const { key } of files) {
        if(!key) continue;

        const file = await awsHelper.loadFile<Buffer>(key);
        if(!file) continue;
        
        const outputFileName = key.substr(prefix.length);
        zipper.file("/" + outputFileName, file);

        fileZippedCallback(zippedFiles++, files.length);
    }

    return await zipper.generateAsync({type: "nodebuffer"}) as Buffer;
}