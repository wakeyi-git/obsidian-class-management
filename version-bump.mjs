import fs from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: npm run version -- 1.0.1");
  process.exit(1);
}

const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const versions = readJson("versions.json");

manifest.version = version;
packageJson.version = version;
packageLock.version = version;
if (packageLock.packages?.[""]) packageLock.packages[""].version = version;
versions[version] = manifest.minAppVersion;

writeJson("manifest.json", manifest);
writeJson("package.json", packageJson);
writeJson("package-lock.json", packageLock);
writeJson("versions.json", versions);
console.log(`Version updated to ${version}. Update CHANGELOG.md, then run npm run check.`);

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
