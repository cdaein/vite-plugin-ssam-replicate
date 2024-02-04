// communication:
// run => output
// predict => prediction

// TODO:
// - declare custom event types here (or on the client-side)?

import type { PluginOption, WebSocketClient } from "vite";
import Replicate from "replicate";
import {
  ssamLog,
  createDir,
  prefix,
  removeAnsi,
  saveRemoteFile,
  ssamWarn,
} from "./utils";

type Options = {
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
};

const defaultOptions = {
  testOutput: [""],
  saveOutput: true,
  log: true,
  outDir: "./output",
};

export const ssamReplicate = (opts: Options): PluginOption => ({
  name: "ssam-replicate",
  apply: "serve",
  configureServer(server) {
    const { log, testOutput, saveOutput, outDir, apiKey } = {
      ...defaultOptions,
      ...opts,
    };

    const replicate = new Replicate({
      auth: apiKey,
    });

    server.ws.on(
      "ssam:replicate-predict",
      async (data, client: WebSocketClient) => {
        createDir(outDir);

        const { version, input, dryRun = true } = data;

        ssamLog(`${prefix()} Requesting..`, client, log);

        if (!dryRun) {
          try {
            // prediction object has a lot of metadata.
            let prediction = await replicate.predictions.create({
              version,
              input,
            });
            prediction = await replicate.wait(prediction);

            ssamLog(`${prefix()} Output generated.`, client, log);

            client.send("ssam:replicate-prediction", prediction);

            if (saveOutput) {
              for (const url of prediction.output) {
                await saveRemoteFile({
                  url,
                  client,
                  id: prediction.id,
                  log,
                  outDir,
                });
              }
            }
          } catch (e) {
            ssamWarn(`${prefix()} ${e}`, client, log);
          }
        } else {
          ssamLog(
            `${prefix()} Dry run. No request is sent to Replicate API.`,
            client,
            log,
          );
          client.send("ssam:replicate-prediction", { output: testOutput });
        }
      },
    );

    server.ws.on(
      "ssam:replicate-run",
      async (data, client: WebSocketClient) => {
        createDir(outDir);

        const { model, input, dryRun = true } = data;

        if (!dryRun) {
          try {
            ssamLog(`${prefix()} Requesting..`, client, log);
            // .run() only returns output.
            const output = (await replicate.run(model, { input })) as string[];
            ssamLog(`${prefix()} Output generated.`, client, log);
            client.send("ssam:replicate-output", output);

            if (saveOutput) {
              for (const url of output) {
                await saveRemoteFile({
                  url,
                  client,
                  log,
                  outDir,
                });
              }
            }
          } catch (e) {
            ssamWarn(`${prefix()} ${e}`, client, log);
          }
        } else {
          ssamLog(
            `${prefix()} Dry run. No request sent to Replicate API.`,
            client,
            log,
          );
          client.send("ssam:replicate-output", { output: testOutput });
        }
      },
    );
  },
});
