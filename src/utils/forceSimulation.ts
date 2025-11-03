import { FileEdge, FileNode } from "../types";

export interface ForceSimulationConfig {
	strength: number;
	distance: number;
	iterations: number;
}

export class ForceSimulation {
	private nodes: FileNode[];
	private edges: FileEdge[];

	constructor(
		nodes: FileNode[],
		edges: FileEdge[],
		_config: Partial<ForceSimulationConfig> = {},
	) {
		this.nodes = nodes;
		this.edges = edges;
		// Config parameters are now hardcoded in the force methods for better tuning

		this.initializePositions();
	}

	private initializePositions() {
		// Initialize nodes with random positions if not set
		this.nodes.forEach((node) => {
			if (
				node.x === undefined ||
				node.y === undefined ||
				node.z === undefined
			) {
				const angle1 = Math.random() * Math.PI * 2;
				const angle2 = Math.random() * Math.PI * 2;
				const radius = 100 + Math.random() * 100;

				node.x = radius * Math.sin(angle1) * Math.cos(angle2);
				node.y = radius * Math.sin(angle1) * Math.sin(angle2);
				node.z = radius * Math.cos(angle1);
				node.vx = 0;
				node.vy = 0;
				node.vz = 0;
			}
		});
	}

	tick() {
		// Apply forces
		this.applySpringForces();
		this.applyRepulsionForces();
		this.applyCenteringForce();

		// Update positions with velocity damping
		const damping = 0.85; // Slightly more damping for stability
		this.nodes.forEach((node) => {
			if (
				node.vx !== undefined &&
				node.vy !== undefined &&
				node.vz !== undefined
			) {
				// Apply damping
				node.vx *= damping;
				node.vy *= damping;
				node.vz *= damping;

				// Limit maximum velocity to prevent instability
				const maxVelocity = 10;
				const velocityMagnitude = Math.sqrt(
					node.vx * node.vx + node.vy * node.vy + node.vz * node.vz,
				);
				if (velocityMagnitude > maxVelocity) {
					const scale = maxVelocity / velocityMagnitude;
					node.vx *= scale;
					node.vy *= scale;
					node.vz *= scale;
				}

				// Update positions
				node.x! += node.vx;
				node.y! += node.vy;
				node.z! += node.vz;
			}
		});
	}

	private applySpringForces() {
		const nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
		const springStrength = 0.1; // Spring stiffness
		const idealDistance = 30; // Ideal distance between parent and child

		this.edges.forEach((edge) => {
			const source = nodeMap.get(edge.source);
			const target = nodeMap.get(edge.target);

			if (!source || !target) return;

			// Calculate radii for both nodes
			const radiusSource = Math.max(
				0.5,
				Math.min(5, Math.log10(source.size + 1) * 1.2),
			);
			const radiusTarget = Math.max(
				0.5,
				Math.min(5, Math.log10(target.size + 1) * 1.2),
			);

			const dx = target.x! - source.x!;
			const dy = target.y! - source.y!;
			const dz = target.z! - source.z!;
			const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

			// Ideal distance should account for node sizes plus some spacing
			const targetDistance = radiusSource + radiusTarget + idealDistance;

			// Spring force: proportional to displacement from ideal distance
			const displacement = distance - targetDistance;
			const force = displacement * springStrength;

			const fx = (dx / distance) * force;
			const fy = (dy / distance) * force;
			const fz = (dz / distance) * force;

			source.vx! += fx;
			source.vy! += fy;
			source.vz! += fz;

			target.vx! -= fx;
			target.vy! -= fy;
			target.vz! -= fz;
		});
	}

	private applyRepulsionForces() {
		const repulsionStrength = 5000; // Increased for stronger repulsion

		for (let i = 0; i < this.nodes.length; i++) {
			for (let j = i + 1; j < this.nodes.length; j++) {
				const nodeA = this.nodes[i];
				const nodeB = this.nodes[j];

				// Calculate radii based on log of file size (same as rendering)
				const radiusA = Math.max(
					0.5,
					Math.min(5, Math.log10(nodeA.size + 1) * 1.2),
				);
				const radiusB = Math.max(
					0.5,
					Math.min(5, Math.log10(nodeB.size + 1) * 1.2),
				);

				const dx = nodeB.x! - nodeA.x!;
				const dy = nodeB.y! - nodeA.y!;
				const dz = nodeB.z! - nodeA.z!;
				const distanceSquared = dx * dx + dy * dy + dz * dz;
				const distance = Math.sqrt(distanceSquared) || 1;

				// Sum of radii - this is the minimum distance before overlap
				const minDistance = radiusA + radiusB;

				// Apply stronger force when nodes are closer than their combined radii
				// Use inverse square law but with radius-aware distance
				const effectiveDistance = Math.max(distance - minDistance, 1);
				const force =
					(repulsionStrength * (radiusA + radiusB)) /
					(effectiveDistance * effectiveDistance);

				const fx = (dx / distance) * force;
				const fy = (dy / distance) * force;
				const fz = (dz / distance) * force;

				nodeA.vx! -= fx;
				nodeA.vy! -= fy;
				nodeA.vz! -= fz;

				nodeB.vx! += fx;
				nodeB.vy! += fy;
				nodeB.vz! += fz;
			}
		}
	}

	private applyCenteringForce() {
		const centeringStrength = 0.01;

		this.nodes.forEach((node) => {
			node.vx! -= node.x! * centeringStrength;
			node.vy! -= node.y! * centeringStrength;
			node.vz! -= node.z! * centeringStrength;
		});
	}

	getNodes(): FileNode[] {
		return this.nodes;
	}

	getEdges(): FileEdge[] {
		return this.edges;
	}
}
