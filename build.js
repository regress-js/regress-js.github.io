const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "dist");

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  write: false
}).then(result => {
  const js = result.outputFiles[0].text;
  const css = fs.readFileSync("src/style.css", "utf-8");
  const html = fs.readFileSync("src/index.html", "utf-8")
    .replace('/**css**/', css)
    .replace('/**js**/', js);
  fs.writeFileSync(path.join(distDir, "index.html"), html);
}).catch(() => process.exit(1));
