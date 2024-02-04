// communication:
// run => output
// predict => prediction

import type { PluginOption, WebSocketClient } from "vite";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import pc from "picocolors";
import ansiRegex from "ansi-regex";

import Replicate from "replicate";

type Options = {
  /**
   * Replicate API key
   */
  apiKey: string;
  /**
   * Test image filename for dry run.
   * Place it somewhere in the sketch directory. ie. `output/`
   */
  testImg?: string;
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
  testImg: "",
  saveOutput: true,
  log: true,
  outDir: "./output",
};

const { gray, green, yellow } = pc;

const prefix = () => {
  return `${gray(new Date().toLocaleTimeString())} ${green(`[ssam-replicate]`)}`;
};

const removeAnsi = (str: string) => {
  return str.replace(ansiRegex(), "");
};

export const ssamReplicate = (opts: Options): PluginOption => ({
  name: "ssam-replicate",
  apply: "serve",
  configureServer(server) {
    const { log, testImg, saveOutput, outDir, apiKey } = {
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

        client.send("ssam:log", {
          msg: removeAnsi(`${prefix()} Running model..`),
        });

        if (!dryRun) {
          try {
            // prediction object has a lot of metadata.
            let prediction = await replicate.predictions.create({
              version,
              input,
            });
            prediction = await replicate.wait(prediction);

            client.send("ssam:log", {
              msg: removeAnsi(`${prefix()} Output generated.`),
            });
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
            console.error(e);
            client.send("ssam:warn", {
              msg: removeAnsi(`${prefix()} ${e}`),
            });
          }
        } else {
          const output = [testImg];
          client.send("ssam:log", {
            msg: removeAnsi(
              `${prefix()} This is a dry run. No request is sent to Replicate API.`,
            ),
          });
          client.send("ssam:replicate-prediction", { output });
        }
      },
    );

    server.ws.on(
      "ssam:replicate-run",
      async (data, client: WebSocketClient) => {
        createDir(outDir);

        const { model, input, dryRun = true } = data;

        client.send("ssam:log", {
          msg: removeAnsi(`${prefix()} Running model..`),
        });
        if (!dryRun) {
          try {
            // .run() only returns output.
            const output = (await replicate.run(model, { input })) as string[];

            client.send("ssam:log", {
              msg: removeAnsi(`${prefix()} Output generated.`),
            });
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
            console.error(e);
            client.send("ssam:warn", {
              msg: removeAnsi(`${prefix()} ${e}`),
            });
          }
        } else {
          const output = [testImg];
          client.send("ssam:log", {
            msg: removeAnsi(
              `${prefix()} This is a dry run. No request is sent to Replicate API.`,
            ),
          });
          client.send("ssam:replicate-output", output);
        }
      },
    );
  },
});

const createDir = (outDir: string) => {
  // create outDir if not exists
  if (!fs.existsSync(outDir)) {
    fs.promises
      .mkdir(outDir)
      .then(() => {
        const msg = `${prefix()} created a new directory at ${path.resolve(
          outDir,
        )}`;
        console.log(msg);
      })
      .catch((err) => {
        console.error(`${prefix()} ${yellow(`${err}`)}`);
      });
  }
};

const saveRemoteFile = async ({
  url,
  client,
  id,
  log,
  outDir,
}: {
  url: string;
  client: WebSocketClient;
  id?: string;
  log: boolean;
  outDir: string;
}) => {
  const parsedUrl = new URL(url); // Use URL constructor for parsing
  const filename = parsedUrl.pathname.split("/").pop()!;
  const filePath = path.resolve(
    outDir,
    id
      ? `${formatDatetime(new Date())}-${id}-${filename}`
      : `${formatDatetime(new Date())}-${filename}`,
  );

  try {
    await new Promise<void>((resolve, reject) => {
      https.get(url, (res) => {
        res
          .pipe(fs.createWriteStream(filePath))
          .on("close", () => {
            const msg = `${prefix()} ${filePath} exported`;
            log &&
              client.send("ssam:log", {
                msg: removeAnsi(msg),
              });
            console.log(msg);
            return resolve();
          })
          .on("error", (e) => {
            const msg = `${prefix()} ${yellow(e.message)}`;
            log &&
              client.send("ssam:warn", {
                msg: removeAnsi(msg),
              });
            console.error(msg);
            return reject(e);
          });
      });
    });
  } catch (e) {
    console.error(`${prefix()} ${yellow(`${e}`)}`);
  }
};

/**
 * get current local datetime
 *
 * @param date
 * @returns formatted string ex. "2022.12.29-14.22.34"
 */
const formatDatetime = (date: Date) => {
  const offset = date.getTimezoneOffset();
  date.setMinutes(date.getMinutes() - offset);
  const isoString = date.toISOString();
  const [, yyyy, mo, dd, hh, mm, ss] = isoString.match(
    /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
  )!;
  return `${yyyy}.${mo}.${dd}-${hh}.${mm}.${ss}`;
};
