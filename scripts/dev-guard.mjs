import net from "node:net";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "";
const LOCK_PATH = path.join(process.cwd(), ".next", "dev", "lock");

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    if (host) {
      server.listen(port, host);
      return;
    }

    server.listen(port);
  });
}

const available = await canListen(PORT, HOST);

let runningLockPid = null;
if (existsSync(LOCK_PATH)) {
  try {
    const lockData = JSON.parse(readFileSync(LOCK_PATH, "utf8"));
    const lockPid = Number(lockData?.pid);
    if (Number.isInteger(lockPid) && lockPid > 0) {
      try {
        process.kill(lockPid, 0);
        runningLockPid = lockPid;
      } catch {
        runningLockPid = null;
      }
    }
  } catch {
    runningLockPid = null;
  }
}

if (runningLockPid) {
  console.error(
    `[dev-guard] Another Next dev server is already running for this project (pid ${runningLockPid}). Stop it first, then retry npm run dev.`,
  );
  process.exit(1);
}

if (!available) {
  console.error(
    `[dev-guard] Port ${PORT} is already in use. Stop the existing dev server (or set PORT) before running npm run dev.`,
  );
  process.exit(1);
}
