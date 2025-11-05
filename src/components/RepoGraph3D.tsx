import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { FileEdge, FileNode } from "../types";
import { ForceSimulation } from "../utils/forceSimulation";
import { FileEdge3D } from "./FileEdge3D";
import { FileNode3D } from "./FileNode3D";

interface RepoGraph3DProps {
	nodes: FileNode[];
	edges: FileEdge[];
	onNodeClick?: (node: FileNode) => void;
	onNodeDoubleClick?: (node: FileNode) => void;
}

export interface RepoGraph3DHandle {
	resetCamera: () => void;
	focusOnNode: (node: FileNode) => void;
}

// Camera controller for smooth zoom animations
interface CameraControllerProps {
	focusTarget: { node: FileNode; nodes: FileNode[]; edges: FileEdge[] } | null;
	onFocusComplete: () => void;
}

function CameraController({
	focusTarget,
	onFocusComplete,
}: CameraControllerProps) {
	const { camera, controls } = useThree();
	const animatingRef = useRef(false);
	const startPosition = useRef(new THREE.Vector3());
	const startTarget = useRef(new THREE.Vector3());
	const endPosition = useRef(new THREE.Vector3());
	const endTarget = useRef(new THREE.Vector3());
	const animationProgress = useRef(0);

	useEffect(() => {
		if (!focusTarget || animatingRef.current) return;

		const { node, nodes, edges } = focusTarget;
		const orbitControls = controls as OrbitControlsImpl;

		// Calculate target position and camera position based on node type
		const nodePosition = new THREE.Vector3(
			node.x || 0,
			node.y || 0,
			node.z || 0,
		);

		let cameraDistance = 50; // Default distance for single file

		if (node.type === "directory") {
			// Find all children of this directory
			const childIds = edges
				.filter((edge) => edge.source === node.id)
				.map((edge) => edge.target);

			const children = nodes.filter((n) => childIds.includes(n.id));

			if (children.length > 0) {
				// Calculate bounding box of all children
				const bounds = new THREE.Box3();
				children.forEach((child) => {
					bounds.expandByPoint(
						new THREE.Vector3(child.x || 0, child.y || 0, child.z || 0),
					);
				});

				// Include the directory node itself
				bounds.expandByPoint(nodePosition);

				// Calculate size of bounding box
				const size = new THREE.Vector3();
				bounds.getSize(size);
				const maxDim = Math.max(size.x, size.y, size.z);

				// Set camera distance based on bounding box size
				// Use a multiplier to ensure all nodes are visible
				cameraDistance = Math.max(maxDim * 1.5, 50);

				// Update target to center of bounding box
				bounds.getCenter(nodePosition);
			}
		}

		// Calculate camera position (move camera back along the view direction)
		const currentDirection = new THREE.Vector3();
		camera.getWorldDirection(currentDirection);
		const cameraPosition = nodePosition
			.clone()
			.sub(currentDirection.multiplyScalar(-cameraDistance));

		// Store start and end positions for animation
		startPosition.current.copy(camera.position);
		startTarget.current.copy(orbitControls.target);
		endPosition.current.copy(cameraPosition);
		endTarget.current.copy(nodePosition);
		animationProgress.current = 0;
		animatingRef.current = true;

		// Animate camera
		const animationDuration = 1000; // 1 second
		const startTime = Date.now();

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / animationDuration, 1);

			// Use ease-in-out function for smooth animation
			const easeProgress =
				progress < 0.5
					? 2 * progress * progress
					: 1 - Math.pow(-2 * progress + 2, 2) / 2;

			// Interpolate camera position and target
			camera.position.lerpVectors(
				startPosition.current,
				endPosition.current,
				easeProgress,
			);
			orbitControls.target.lerpVectors(
				startTarget.current,
				endTarget.current,
				easeProgress,
			);
			orbitControls.update();

			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				animatingRef.current = false;
				onFocusComplete();
			}
		};

		animate();
	}, [focusTarget, camera, controls, onFocusComplete]);

	return null;
}

export const RepoGraph3D = forwardRef<RepoGraph3DHandle, RepoGraph3DProps>(
	function RepoGraph3D({ nodes, edges, onNodeClick, onNodeDoubleClick }, ref) {
		const [simulationNodes, setSimulationNodes] = useState<FileNode[]>(nodes);
		const [contextLost, setContextLost] = useState(false);
		const [focusTarget, setFocusTarget] = useState<{
			node: FileNode;
			nodes: FileNode[];
			edges: FileEdge[];
		} | null>(null);
		const simulationRef = useRef<ForceSimulation | null>(null);
		const animationFrameRef = useRef<number>();
		const canvasRef = useRef<HTMLCanvasElement | null>(null);
		const previousNodesRef = useRef<Map<string, FileNode>>(new Map());
		const orbitControlsRef = useRef<OrbitControlsImpl>(null);

		// Expose reset function and focus function to parent
		useImperativeHandle(ref, () => ({
			resetCamera: () => {
				if (orbitControlsRef.current) {
					orbitControlsRef.current.reset();
				}
			},
			focusOnNode: (node: FileNode) => {
				setFocusTarget({ node, nodes: simulationNodes, edges });
			},
		}));

		useEffect(() => {
			// Create a deep copy of nodes to avoid mutating props
			const nodesCopy = nodes.map((n) => ({ ...n }));

			// Separate deleted nodes from active nodes
			const deletedNodes: FileNode[] = [];
			const activeNodes: FileNode[] = [];

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

				// Separate deleted nodes - they keep their positions and don't participate in simulation
				if (node.fileStatus === "deleted") {
					deletedNodes.push(node);
				} else {
					activeNodes.push(node);
				}
			});

			// Initialize or update simulation with only active nodes (not deleted)
			simulationRef.current = new ForceSimulation(activeNodes, edges, {
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
					// Include both active and deleted nodes
					if (simulationRef.current) {
						const finalNodes = simulationRef.current.getNodes();
						const allNodes = [...finalNodes, ...deletedNodes];
						previousNodesRef.current = new Map(
							allNodes.map((n) => [n.id, { ...n }]),
						);
					}
					return;
				}

				simulationRef.current.tick();
				const currentNodes = simulationRef.current.getNodes();
				// Combine simulated nodes with deleted nodes (which stay in place)
				const allNodes = [...currentNodes, ...deletedNodes];
				setSimulationNodes(allNodes);
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
				// Include both active and deleted nodes
				if (simulationRef.current) {
					const finalNodes = simulationRef.current.getNodes();
					const allNodes = [...finalNodes, ...deletedNodes];
					previousNodesRef.current = new Map(
						allNodes.map((n) => [n.id, { ...n }]),
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
				canvas.removeEventListener(
					"webglcontextrestored",
					handleContextRestored,
				);
			};
		}, []);

		// No memoization - recalculate nodeMap on every render
		const nodeMap = new Map(simulationNodes.map((n) => [n.id, n]));

		// Debug: Log nodes and edges on first render
		// Debug logging removed - was flooding console during autoload testing
		// if (simulationNodes.length > 0 && edges.length > 0) {
		// 	const dirs = simulationNodes.filter(n => n.type === "directory");
		// 	const rootNode = simulationNodes.find(n => n.id === "/" || n.path === "/");
		// 	const rootEdges = edges.filter(e => e.source === "/");
		// 	const dirEdges = rootEdges.filter(e => {
		// 		const target = simulationNodes.find(n => n.id === e.target);
		// 		return target?.type === "directory";
		// 	});
		// 	console.log(`📊 GRAPH STATE: ${simulationNodes.length} nodes, ${dirs.length} dirs, ${edges.length} edges`);
		// 	console.log(`🏠 Root node:`, rootNode);
		// 	console.log(`🔗 Edges from root: ${rootEdges.length} total, ${dirEdges.length} to directories`);
		// 	console.log(`   Targets:`, rootEdges.map(e => e.target));
		// }

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
				camera={{ position: [0, 0, 200], fov: 75, near: 0.1, far: 10000 }}
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
				{edges.map((edge, i) => {
					const source = nodeMap.get(edge.source);
					const target = nodeMap.get(edge.target);
					// Include node positions in key to force re-render when positions change
					const key = `edge-${i}-${source?.x?.toFixed(1) ?? 0}-${source?.y?.toFixed(1) ?? 0}-${target?.x?.toFixed(1) ?? 0}-${target?.y?.toFixed(1) ?? 0}`;
					return <FileEdge3D key={key} edge={edge} nodes={nodeMap} />;
				})}

				{/* Render nodes */}
				{simulationNodes.map((node) => (
					<FileNode3D
						key={node.id}
						node={node}
						onClick={onNodeClick}
						onDoubleClick={onNodeDoubleClick}
					/>
				))}

				<OrbitControls
					ref={orbitControlsRef}
					enableDamping
					dampingFactor={0.05}
					rotateSpeed={0.5}
					zoomSpeed={0.5}
				/>

				{/* Camera controller for smooth zoom animations */}
				<CameraController
					focusTarget={focusTarget}
					onFocusComplete={() => setFocusTarget(null)}
				/>
			</Canvas>
		);
	},
);
