import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
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
	const simulationRef = useRef<ForceSimulation | null>(null);
	const animationFrameRef = useRef<number>();

	useEffect(() => {
		// Create a deep copy of nodes to avoid mutating props
		const nodesCopy = nodes.map((n) => ({ ...n }));

		// Initialize or update simulation with tuned parameters
		simulationRef.current = new ForceSimulation(nodesCopy, edges, {
			strength: 0.1, // Spring stiffness
			distance: 30, // Ideal spring distance
			iterations: 500, // More iterations for better convergence
		});

		// Run simulation
		let iterations = 0;
		const maxIterations = 500;

		const simulate = () => {
			if (!simulationRef.current || iterations >= maxIterations) {
				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current);
				}
				return;
			}

			simulationRef.current.tick();
			setSimulationNodes([...simulationRef.current.getNodes()]);
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
		};
	}, [nodes, edges]);

	const nodeMap = new Map(simulationNodes.map((n) => [n.id, n]));

	return (
		<Canvas
			camera={{ position: [0, 0, 200], fov: 75 }}
			style={{ background: "#0f172a" }}
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
