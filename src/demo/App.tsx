import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RepoInput } from "../components/RepoInput";
import { TestScene } from "../components/TestScene";
import "../index.css";
import { RepoWrapper } from "./RepoWrapper";

// Set to true to show test scene instead of normal app
const SHOW_TEST_SCENE = false;

function App() {
	if (SHOW_TEST_SCENE) {
		return <TestScene />;
	}

	return (
		<BrowserRouter basename="/repo-timeline">
			<div className="w-screen h-screen flex flex-col">
				<div className="flex-1 overflow-hidden">
					<Routes>
						<Route path="/" element={<RepoInput />} />
						<Route path="/:owner/:repo" element={<RepoWrapper />} />
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</div>
				<footer className="bg-slate-800 text-slate-400 text-xs py-1 px-3 flex justify-between items-center">
					<span>
						Build: {__GIT_HASH__} • {new Date(__BUILD_TIME__).toLocaleString()}
					</span>
				</footer>
			</div>
		</BrowserRouter>
	);
}

export default App;
