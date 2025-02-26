import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import ansiRegex from "ansi-regex";
import { WebSocketClient } from "vite";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
};

/**
 * @param str - string to print in color
 * @param c - pre-defined color string from `colors` object
 * @returns Original string surrounded by color code and reset code.
 */
export const color = (str: string, c: keyof typeof colors) =>
  `${colors[c]}${str}${colors.reset}`;

export const ssamLog = (
  msg: string,
  client: WebSocketClient,
  clientLog?: boolean,
) => {
  console.log(msg);
  clientLog && client.send("ssam:log", { msg: removeAnsi(msg) });
};

export const ssamWarn = (
  msg: string,
  client: WebSocketClient,
  clientLog?: boolean,
) => {
  console.error(msg);
  clientLog && client.send("ssam:warn", { msg: removeAnsi(msg) });
};

export const prefix = () => {
  return `${color(new Date().toLocaleTimeString(), "gray")} ${color(`[ssam-replicate]`, "green")}`;
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
        console.error(`${prefix()} ${color(`${err}`, "yellow")}`);
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
            const msg = `${prefix()} ${color(e.message, "yellow")}`;
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
    console.error(`${prefix()} ${color(`${e}`, "yellow")}`);
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
