import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { FileEdge, FileNode } from "../types";
import { FileEdge3D } from "./FileEdge3D";
import { FileNode3D } from "./FileNode3D";

export function TestScene() {
	// Hardcoded test data
	const testNodes: FileNode[] = [
		{
			id: "src",
			path: "src",
			name: "src",
			size: 0,
			type: "directory",
			x: 0,
			y: 0,
			z: 0,
		},
		{
			id: "src/main.ts",
			path: "src/main.ts",
			name: "main.ts",
			size: 1000,
			type: "file",
			x: 50,
			y: 0,
			z: 0,
		},
		{
			id: "src/utils",
			path: "src/utils",
			name: "utils",
			size: 0,
			type: "directory",
			x: 0,
			y: 50,
			z: 0,
		},
		{
			id: "src/utils/helper.ts",
			path: "src/utils/helper.ts",
			name: "helper.ts",
			size: 500,
			type: "file",
			x: 50,
			y: 50,
			z: 0,
		},
	];

	const testEdges: FileEdge[] = [
		{ source: "src", target: "src/main.ts", type: "parent" },
		{ source: "src", target: "src/utils", type: "parent" },
		{ source: "src/utils", target: "src/utils/helper.ts", type: "parent" },
	];

	const nodeMap = new Map(testNodes.map((n) => [n.id, n]));

	console.log(
		"TestScene rendering with:",
		testNodes.length,
		"nodes and",
		testEdges.length,
		"edges",
	);
	console.log("Nodes:", testNodes);
	console.log("Edges:", testEdges);

	return (
		<div style={{ width: "100vw", height: "100vh", background: "#0f172a" }}>
			<Canvas
				camera={{ position: [0, 0, 200], fov: 75 }}
				style={{ background: "#0f172a" }}
			>
				<ambientLight intensity={0.5} />
				<pointLight position={[100, 100, 100]} intensity={1} />
				<pointLight position={[-100, -100, -100]} intensity={0.5} />

				{/* Render edges first */}
				{testEdges.map((edge, i) => (
					<FileEdge3D key={`edge-${i}`} edge={edge} nodes={nodeMap} />
				))}

				{/* Render nodes */}
				{testNodes.map((node) => (
					<FileNode3D key={node.id} node={node} />
				))}

				<OrbitControls
					enableDamping
					dampingFactor={0.05}
					rotateSpeed={0.5}
					zoomSpeed={0.5}
				/>
			</Canvas>
		</div>
	);
}
