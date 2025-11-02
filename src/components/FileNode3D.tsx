import { Sphere, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FileNode } from "../types";

interface FileNode3DProps {
	node: FileNode;
	onClick?: (node: FileNode) => void;
}

export function FileNode3D({ node, onClick }: FileNode3DProps) {
	const meshRef = useRef<THREE.Mesh>(null);
	const [transitionOpacity, setTransitionOpacity] = useState(1);
	const transitionStartTime = useRef<number | null>(null);

	// Scale node size based on LOG of file size (with some min/max bounds)
	const radius = Math.max(0.5, Math.min(5, Math.log10(node.size + 1) * 1.2));

	// Base color based on file type
	const baseColor = node.type === "directory" ? "#3b82f6" : "#10b981";

	// Transition color based on size change (red=increase, green=decrease)
	const transitionColor =
		node.sizeChange === "increase"
			? "#ef4444"
			: node.sizeChange === "decrease"
				? "#22c55e"
				: null;

	// Reset transition timer when node changes
	useEffect(() => {
		if (node.sizeChange && node.sizeChange !== "unchanged") {
			transitionStartTime.current = Date.now();
			setTransitionOpacity(1);
		}
	}, [node.sizeChange]);

	// Animate the transition fade-out
	useFrame(() => {
		if (transitionStartTime.current) {
			const elapsed = Date.now() - transitionStartTime.current;
			const fadeDuration = 3000; // 3 seconds

			if (elapsed < fadeDuration) {
				setTransitionOpacity(1 - elapsed / fadeDuration);
			} else {
				setTransitionOpacity(0);
				transitionStartTime.current = null;
			}
		}
	});

	const handleClick = () => {
		if (onClick) {
			onClick(node);
		}
	};

	// Calculate final color by blending base color with transition color
	const finalColor =
		transitionColor && transitionOpacity > 0
			? new THREE.Color(baseColor).lerp(
					new THREE.Color(transitionColor),
					transitionOpacity,
				)
			: new THREE.Color(baseColor);

	return (
		<group position={[node.x || 0, node.y || 0, node.z || 0]}>
			<Sphere ref={meshRef} args={[radius, 16, 16]} onClick={handleClick}>
				<meshStandardMaterial
					color={finalColor}
					emissive={finalColor}
					emissiveIntensity={transitionOpacity > 0 ? 0.5 : 0.2}
					roughness={0.5}
					metalness={0.5}
				/>
			</Sphere>
			<Text
				position={[0, radius + 1, 0]}
				fontSize={0.8}
				color="white"
				anchorX="center"
				anchorY="middle"
			>
				{node.name}
			</Text>
		</group>
	);
}
