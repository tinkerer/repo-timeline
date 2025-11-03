import { memo, useMemo } from "react";
import * as THREE from "three";
import { FileEdge, FileNode } from "../types";

interface FileEdge3DProps {
	edge: FileEdge;
	nodes: Map<string, FileNode>;
}

export const FileEdge3D = memo(function FileEdge3D({ edge, nodes }: FileEdge3DProps) {
	const source = nodes.get(edge.source);
	const target = nodes.get(edge.target);

	const { geometry, color } = useMemo(() => {
		if (!source || !target) return { geometry: null, color: "#ffffff" };

		// Calculate node radii (same logic as FileNode3D)
		const sourceRadius =
			source.type === "directory"
				? 3.0
				: Math.max(2.0, Math.min(15, Math.log10(source.size + 1) * 4));
		const targetRadius =
			target.type === "directory"
				? 3.0
				: Math.max(2.0, Math.min(15, Math.log10(target.size + 1) * 4));

		const sourcePos = new THREE.Vector3(
			source.x || 0,
			source.y || 0,
			source.z || 0,
		);
		const targetPos = new THREE.Vector3(
			target.x || 0,
			target.y || 0,
			target.z || 0,
		);

		// Calculate direction vector
		const direction = new THREE.Vector3().subVectors(targetPos, sourcePos);
		const distance = direction.length();

		if (distance === 0) return { geometry: null, color: "#ffffff" };

		direction.normalize();

		// Shorten the edge to stop at node surfaces
		const start = sourcePos
			.clone()
			.add(direction.clone().multiplyScalar(sourceRadius));
		const end = targetPos
			.clone()
			.sub(direction.clone().multiplyScalar(targetRadius));

		// Create a tube geometry for the edge with visible thickness
		const path = new THREE.LineCurve3(start, end);
		const geometry = new THREE.TubeGeometry(path, 1, 0.3, 8, false);

		// Bright colors for visibility against dark background
		// Parent relationships (directory structure) in white
		// Other edge types (dependencies, etc) in bright cyan
		const color = edge.type === "parent" ? "#ffffff" : "#22d3ee";

		return { geometry, color };
	}, [source, target, edge.type]);

	if (!source || !target || !geometry) return null;

	return (
		<mesh geometry={geometry}>
			<meshBasicMaterial color={color} opacity={0.8} transparent />
		</mesh>
	);
});
