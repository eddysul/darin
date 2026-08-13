import { readFileSync } from "node:fs";

const app = JSON.parse(readFileSync("app.json", "utf8"));
const infoPlist = readFileSync("ios/Darin/Info.plist", "utf8");
const project = readFileSync("ios/Darin.xcodeproj/project.pbxproj", "utf8");

const iosBuildNumber = String(app.expo?.ios?.buildNumber ?? "");
const androidVersionCode = Number(app.expo?.android?.versionCode);
const xcodeVersions = [...project.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)]
  .map((match) => match[1].trim());
const infoUsesXcodeVersion = /<key>CFBundleVersion<\/key>\s*<string>\$\(CURRENT_PROJECT_VERSION\)<\/string>/.test(
  infoPlist,
);

const errors = [];
if (!/^\d+$/.test(iosBuildNumber)) errors.push("app.json ios.buildNumber must be numeric");
if (!Number.isInteger(androidVersionCode) || androidVersionCode <= 0) {
  errors.push("app.json android.versionCode must be a positive integer");
}
if (!xcodeVersions.length) errors.push("Xcode CURRENT_PROJECT_VERSION was not found");
if (xcodeVersions.some((value) => value !== iosBuildNumber)) {
  errors.push(
    `Xcode CURRENT_PROJECT_VERSION (${[...new Set(xcodeVersions)].join(", ")}) does not match app.json iOS buildNumber (${iosBuildNumber})`,
  );
}
if (!infoUsesXcodeVersion) {
  errors.push("Info.plist CFBundleVersion must reference $(CURRENT_PROJECT_VERSION)");
}
if (String(androidVersionCode) !== iosBuildNumber) {
  errors.push(`Android versionCode (${androidVersionCode}) does not match iOS buildNumber (${iosBuildNumber})`);
}

if (errors.length) {
  console.error("Build version guard failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Build version guard passed: app=${app.expo.version}, iOS=${iosBuildNumber}, Xcode=${xcodeVersions[0]}, Android=${androidVersionCode}`,
);
