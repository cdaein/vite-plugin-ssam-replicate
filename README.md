# vite-plugin-ssam-replicate

This is a plugin for [Ssam.js](https://github.com/cdaein/ssam) creative coding helper. It uses [Replicate](https://replicate.com/) Node.js API to generate Stable Diffusion image from your HTML5 Canvas drawing. With this plugin, you don't have to write boilerplate for the backend and focus on your Canvas drawing code.

## Notes

- The plugin only works in the development environment.
- A Replicate online account and an API key are required. You get free inference for first tries, but you will eventually have to pay for the API usage.

## Installation

Create a new sketch with `npm create ssam@latest` and choose the StableDiffusion template. You only need to provide your API key.

If you are not using Ssam, install with the following command:

```sh
npm i -D vite-plugin-ssam-replicate
```

## Setup

1. Create an API key on [Replicate.com](https://replicate.com).
1. Create a `.env.DEV.local` file on the root of the Ssam sketch folder.
1. Add the key as `REPLICATE_API_KEY=abcd1234` as environment variable. **Do not share this key with anyone! You will be charged for images generated with the key.**
1. In `vite.config.ts`, import and add the plugin.

```ts
import { defineConfig, loadEnv } from "vite";
import { ssamReplicate } from "vite-plugin-ssam-replicate";

// Store Replicate API Key in `.env.DEV.local` file. ex. `REPLICATE_API_KEY=abcd1234`
// Then, pass it to the plugin like `apiKey: envVars.REPLICATE_API_KEY`.
// Make sure not to share the key with anyone!
const envVars = loadEnv("DEV", process.cwd(), "REPLICATE_");

export default defineConfig({
  // ... other settings
  plugins: [
    ssamExport(),
    ssamGit(),
    ssamFfmpeg(),
    ssamReplicate({
      /**
      * Replicate API key
      */
      apiKey: string;
      /**
      * Test image filename(s) for dry run.
      * Place it somewhere in the sketch directory. ie. `output/`
      */
      testOutput?: string[];
      /**
      * Save generated output files in `outDir`
      * @default true
      */
      saveOutput?: boolean;
      /**
      * console log in browser
      * @default true
      * */
      log?: boolean;
      /**
      * output directory
      * @default "./output"
      * */
      outDir?: string;
    }),
  ],
});
```

## In your sketch code

For the full example using Ssam, see the `examples/`. You can adapt this code to use without Ssam package if you want.

```ts
// Make sure you know when and where your sketch requests an image.
// don't put this in animation loop unless you want to be charged for all the unnecessary requests!
// ex. in key event listener
if (!(ev.metaKey || ev.ctrlKey || ev.shiftKey) && ev.key === "g") {
  const payload = {
    // set it to `true` when you want to just test out program flow. it doesn't send an API request.
    // set it to `false` when you are ready to start generating images.
    dryRun: true,
    // find a model version from Replicate.com
    // LCM models are fast.
    version: "479633443fc6588e1e8ae764b79cdb3702d0c196e0cb2de6db39ce577383be77",
    // different models have different inputs. check the website.
    input: {
      prompt: "An astronaut in spacesuit on Mars",
      negative_prompt: "",
      // send the current canvas drawing for img2img
      image: canvas.toDataURL(),
      width,
      height,
      num_outputs: 1,
      num_inference_steps: 6,
      guidance_scale: 2,
      prompt_strength: 0.8,
      seed: (Math.random() * 100000000) | 0,
      // ... find more settings on Replicate.com
    },
  };
  // send the message to the plugin to request an image to the API
  // again, be careful not to put this where it may be called multiple times (ie. animation loop)
  import.meta.hot && import.meta.hot.send("ssam:replicate-predict", payload);
}

// API response contains the remote URL. It's up to you what to do with it.
// the plugin save the image to the file system by default.
// you can also display in your canvas for further manipulation.
if (import.meta.hot) {
  import.meta.hot.on("ssam:replicate-prediction", async (prediction) => {
    output = await Promise.all(
      prediction.output.map(async (url: string) => await loadImage(url)),
    );
    render();
  });
}
```

## License

MIT
