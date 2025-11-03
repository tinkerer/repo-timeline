import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { execSync } from "child_process";

// Get git commit hash and build timestamp
const getGitHash = () => {
	try {
		return execSync("git rev-parse --short HEAD").toString().trim();
	} catch {
		return "unknown";
	}
};

const getBuildTime = () => {
	return new Date().toISOString();
};

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	base: "/repo-timeline/",
	define: {
		__GIT_HASH__: JSON.stringify(getGitHash()),
		__BUILD_TIME__: JSON.stringify(getBuildTime()),
	},
});
