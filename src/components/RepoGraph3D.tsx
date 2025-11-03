import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileEdge, FileNode } from "../types";
import { ForceSimulation } from "../utils/forceSimulation";
import { FileEdge3D } from "./FileEdge3D";
import { FileNode3D } from "./FileNode3D";

interface RepoGraph3DProps {
	nodes: FileNode[];
	edges: FileEdge[];
	onNodeClick?: (node: FileNode) => void;
}

export function RepoGraph3D({ nodes, edges, onNodeClick }: RepoGraph3DProps) {
	const [simulationNodes, setSimulationNodes] = useState<FileNode[]>(nodes);
	const [contextLost, setContextLost] = useState(false);
	const simulationRef = useRef<ForceSimulation | null>(null);
	const animationFrameRef = useRef<number>();
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const previousNodesRef = useRef<Map<string, FileNode>>(new Map());

	useEffect(() => {
		// Create a deep copy of nodes to avoid mutating props
		const nodesCopy = nodes.map((n) => ({ ...n }));

		// Preserve positions from previous state for nodes that existed before
		const previousNodes = previousNodesRef.current;
		let hasNewNodes = false;
		nodesCopy.forEach((node) => {
			const prevNode = previousNodes.get(node.id);
			if (prevNode) {
				// Preserve position and velocity from previous state
				node.x = prevNode.x;
				node.y = prevNode.y;
				node.z = prevNode.z;
				node.vx = prevNode.vx;
				node.vy = prevNode.vy;
				node.vz = prevNode.vz;
			} else {
				hasNewNodes = true;
			}
		});

		// Initialize or update simulation with tuned parameters
		simulationRef.current = new ForceSimulation(nodesCopy, edges, {
			strength: 1.0, // Spring stiffness (10x stronger to pull nodes closer)
			distance: 15, // Ideal spring distance (reduced for tighter layout)
			iterations: 500, // More iterations for better convergence
		});

		// Run simulation - fewer iterations if we're just adjusting existing nodes
		let iterations = 0;
		const maxIterations = hasNewNodes || previousNodes.size === 0 ? 500 : 200;

		const simulate = () => {
			if (!simulationRef.current || iterations >= maxIterations) {
				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current);
				}
				// Update previous nodes reference when simulation completes
				if (simulationRef.current) {
					const finalNodes = simulationRef.current.getNodes();
					previousNodesRef.current = new Map(
						finalNodes.map((n) => [n.id, { ...n }]),
					);
				}
				return;
			}

			simulationRef.current.tick();
			const currentNodes = simulationRef.current.getNodes();
			setSimulationNodes([...currentNodes]);
			iterations++;

			// Slow down the simulation over time for smooth convergence
			if (iterations < 150) {
				// Fast initial settling
				animationFrameRef.current = requestAnimationFrame(simulate);
			} else if (iterations < 300) {
				// Medium speed
				if (iterations % 2 === 0) {
					animationFrameRef.current = requestAnimationFrame(simulate);
				}
			} else {
				// Slow refinement
				if (iterations % 3 === 0) {
					animationFrameRef.current = requestAnimationFrame(simulate);
				}
			}
		};

		simulate();

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
			// Save final positions even if simulation is interrupted
			if (simulationRef.current) {
				const finalNodes = simulationRef.current.getNodes();
				previousNodesRef.current = new Map(
					finalNodes.map((n) => [n.id, { ...n }]),
				);
			}
		};
	}, [nodes, edges]);

	// Handle WebGL context loss/restore
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const handleContextLost = (event: Event) => {
			event.preventDefault();
			console.warn("WebGL context lost, attempting recovery...");
			setContextLost(true);
		};

		const handleContextRestored = () => {
			console.log("WebGL context restored");
			setContextLost(false);
		};

		canvas.addEventListener("webglcontextlost", handleContextLost);
		canvas.addEventListener("webglcontextrestored", handleContextRestored);

		return () => {
			canvas.removeEventListener("webglcontextlost", handleContextLost);
			canvas.removeEventListener("webglcontextrestored", handleContextRestored);
		};
	}, []);

	const nodeMap = useMemo(
		() => new Map(simulationNodes.map((n) => [n.id, n])),
		[simulationNodes],
	);

	if (contextLost) {
		return (
			<div
				style={{
					width: "100%",
					height: "100%",
					background: "#0f172a",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#94a3b8",
				}}
			>
				<div style={{ textAlign: "center" }}>
					<div style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
						⚠️ WebGL Context Lost
					</div>
					<div style={{ fontSize: "0.9rem" }}>
						The 3D visualization is recovering...
					</div>
					<button
						onClick={() => window.location.reload()}
						style={{
							marginTop: "1rem",
							padding: "0.5rem 1rem",
							background: "#3b82f6",
							color: "white",
							border: "none",
							borderRadius: "0.375rem",
							cursor: "pointer",
						}}
					>
						Reload Page
					</button>
				</div>
			</div>
		);
	}

	return (
		<Canvas
			ref={(canvas) => {
				if (canvas) {
					canvasRef.current = canvas as unknown as HTMLCanvasElement;
				}
			}}
			camera={{ position: [0, 0, 200], fov: 75 }}
			style={{ background: "#0f172a" }}
			gl={{
				powerPreference: "high-performance",
				antialias: true,
				alpha: false,
				preserveDrawingBuffer: false,
			}}
		>
			<ambientLight intensity={0.5} />
			<pointLight position={[100, 100, 100]} intensity={1} />
			<pointLight position={[-100, -100, -100]} intensity={0.5} />

			{/* Render edges first so they appear behind nodes */}
			{edges.map((edge, i) => (
				<FileEdge3D key={`edge-${i}`} edge={edge} nodes={nodeMap} />
			))}

			{/* Render nodes */}
			{simulationNodes.map((node) => (
				<FileNode3D key={node.id} node={node} onClick={onNodeClick} />
			))}

			<OrbitControls
				enableDamping
				dampingFactor={0.05}
				rotateSpeed={0.5}
				zoomSpeed={0.5}
			/>
		</Canvas>
	);
}
