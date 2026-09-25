import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("dist");
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/poker/")) {
      res.writeHead(404);
      res.end();
      return;
    }
    const path = resolve(
      root,
      decodeURIComponent(url.pathname.slice(7)) || "index.html",
    );
    if (
      path !== root &&
      !path.startsWith(root + "/") &&
      !path.startsWith(root + "\\")
    )
      throw Error("path");
    const contents = await readFile(path);
    res.writeHead(200, {
      "Content-Type":
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".json": "application/json",
          ".css": "text/css",
          ".svg": "image/svg+xml",
        }[extname(path)] || "application/octet-stream",
    });
    res.end(contents);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(4173, "127.0.0.1");
