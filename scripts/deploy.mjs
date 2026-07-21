import fs from "node:fs";
import path from "node:path";

const files = ["main.js", "manifest.json", "styles.css"];
const target = process.env.CLASS_MANAGEMENT_DEPLOY_DIR || readTargetFromConfig();

if (!target) {
  console.error("Deploy target is not set.");
  console.error('Create .deploy.json with {"target": "<vault>/.obsidian/plugins/class-management"}');
  console.error("or set the CLASS_MANAGEMENT_DEPLOY_DIR environment variable.");
  process.exit(1);
}

const missing = files.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error(`Missing build artifacts: ${missing.join(", ")}. Run npm run build first.`);
  process.exit(1);
}

fs.mkdirSync(target, { recursive: true });
for (const file of files) {
  fs.copyFileSync(file, path.join(target, file));
}
console.log(`Deployed ${files.join(", ")} to ${target}`);

function readTargetFromConfig() {
  if (!fs.existsSync(".deploy.json")) return "";
  try {
    return JSON.parse(fs.readFileSync(".deploy.json", "utf8")).target ?? "";
  } catch {
    return "";
  }
}
