import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import pc from "picocolors";
import ansiRegex from "ansi-regex";
import { WebSocketClient } from "vite";

const { gray, green, yellow } = pc;

export const prefix = () => {
  return `${gray(new Date().toLocaleTimeString())} ${green(`[ssam-replicate]`)}`;
};

export const removeAnsi = (str: string) => {
  return str.replace(ansiRegex(), "");
};

export const createDir = (outDir: string) => {
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

export const saveRemoteFile = async ({
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
export const formatDatetime = (date: Date) => {
  const offset = date.getTimezoneOffset();
  date.setMinutes(date.getMinutes() - offset);
  const isoString = date.toISOString();
  const [, yyyy, mo, dd, hh, mm, ss] = isoString.match(
    /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
  )!;
  return `${yyyy}.${mo}.${dd}-${hh}.${mm}.${ss}`;
};
