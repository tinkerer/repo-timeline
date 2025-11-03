import { Sphere, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FileNode } from "../types";

interface FileNode3DProps {
	node: FileNode;
	onClick?: (node: FileNode) => void;
}

export const FileNode3D = memo(function FileNode3D({ node, onClick }: FileNode3DProps) {
	const meshRef = useRef<THREE.Mesh>(null);
	const [transitionOpacity, setTransitionOpacity] = useState(1);
	const [animatedRadius, setAnimatedRadius] = useState(0);
	const transitionStartTime = useRef<number | null>(null);
	const deletionStartTime = useRef<number | null>(null);

	// Calculate target radius based on LOG of file size
	// Directories get a fixed size, files scale with their size
	const targetRadius =
		node.type === "directory"
			? 3.0 // Fixed size for directories
			: Math.max(2.0, Math.min(15, Math.log10(node.size + 1) * 4));

	// Initialize animated radius
	useEffect(() => {
		if (node.fileStatus === "added") {
			// New files start at 0 and grow
			setAnimatedRadius(0);
		} else if (node.fileStatus === "deleted") {
			// Deleted files start at previous size
			const prevRadius = Math.max(
				2.0,
				Math.min(15, Math.log10((node.previousSize || 100) + 1) * 4),
			);
			setAnimatedRadius(prevRadius);
			deletionStartTime.current = Date.now();
		} else {
			// Normal files use target size
			setAnimatedRadius(targetRadius);
		}
	}, [node.fileStatus, node.previousSize, targetRadius]);

	// Base color based on file type - directories bright blue, files green
	const baseColor = node.type === "directory" ? "#60a5fa" : "#10b981";

	// Determine transition color based on file status and size change
	let transitionColor: string | null = null;
	if (node.fileStatus === "moved") {
		transitionColor = "#eab308"; // Yellow for moved files
	} else if (node.sizeChange === "increase") {
		transitionColor = "#ef4444"; // Red for size increase
	} else if (node.sizeChange === "decrease") {
		transitionColor = "#22c55e"; // Green for size decrease
	}

	// Reset transition timer when node changes
	useEffect(() => {
		if (
			(node.sizeChange && node.sizeChange !== "unchanged") ||
			node.fileStatus === "moved"
		) {
			transitionStartTime.current = Date.now();
			setTransitionOpacity(1);
		}
	}, [node.sizeChange, node.fileStatus]);

	// Animate transitions and deletions
	useFrame(() => {
		const fadeDuration = 3000; // 3 seconds

		// Handle color transition fade-out
		if (transitionStartTime.current) {
			const elapsed = Date.now() - transitionStartTime.current;

			if (elapsed < fadeDuration) {
				setTransitionOpacity(1 - elapsed / fadeDuration);
			} else {
				setTransitionOpacity(0);
				transitionStartTime.current = null;
			}
		}

		// Handle deletion animation (shrink to zero)
		if (deletionStartTime.current) {
			const elapsed = Date.now() - deletionStartTime.current;
			const shrinkDuration = 2000; // 2 seconds to shrink

			if (elapsed < shrinkDuration) {
				const prevRadius = Math.max(
					2.0,
					Math.min(15, Math.log10((node.previousSize || 100) + 1) * 4),
				);
				setAnimatedRadius(prevRadius * (1 - elapsed / shrinkDuration));
			} else {
				setAnimatedRadius(0);
				deletionStartTime.current = null;
			}
		} else if (node.fileStatus === "added") {
			// Handle addition animation (grow from zero)
			const growDuration = 1000; // 1 second to grow
			if (animatedRadius < targetRadius) {
				setAnimatedRadius((prev) => {
					const newRadius = prev + (targetRadius / growDuration) * 16; // ~60fps
					return Math.min(newRadius, targetRadius);
				});
			}
		}
	});

	const handleClick = useCallback(() => {
		if (onClick) {
			onClick(node);
		}
	}, [onClick, node]);

	// Calculate final color by blending base color with transition color
	const finalColor =
		transitionColor && transitionOpacity > 0
			? new THREE.Color(baseColor).lerp(
					new THREE.Color(transitionColor),
					transitionOpacity,
				)
			: new THREE.Color(baseColor);

	// Use animated radius for rendering
	const displayRadius = animatedRadius;

	// Don't render if radius is too small (fully deleted)
	if (displayRadius < 0.01) {
		return null;
	}

	// Use different shapes for directories vs files
	const isDirectory = node.type === "directory";

	return (
		<group position={[node.x || 0, node.y || 0, node.z || 0]}>
			{isDirectory ? (
				// Directories as octahedrons (8-sided diamond shape)
				<mesh ref={meshRef} onClick={handleClick}>
					<octahedronGeometry args={[displayRadius, 0]} />
					<meshStandardMaterial
						color={finalColor}
						emissive={finalColor}
						emissiveIntensity={transitionOpacity > 0 ? 0.5 : 0.3}
						roughness={0.4}
						metalness={0.6}
						transparent={node.fileStatus === "deleted"}
						opacity={node.fileStatus === "deleted" ? 0.5 : 1.0}
					/>
				</mesh>
			) : (
				// Files as spheres
				<Sphere
					ref={meshRef}
					args={[displayRadius, 16, 16]}
					onClick={handleClick}
				>
					<meshStandardMaterial
						color={finalColor}
						emissive={finalColor}
						emissiveIntensity={transitionOpacity > 0 ? 0.5 : 0.2}
						roughness={0.5}
						metalness={0.5}
						transparent={node.fileStatus === "deleted"}
						opacity={node.fileStatus === "deleted" ? 0.5 : 1.0}
					/>
				</Sphere>
			)}
			{displayRadius > 0.3 && (
				<Text
					position={[0, displayRadius + 1, 0]}
					fontSize={0.8}
					color="white"
					anchorX="center"
					anchorY="middle"
				>
					{node.name}
				</Text>
			)}
		</group>
	);
});
