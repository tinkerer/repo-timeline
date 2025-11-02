import { FileEdge, FileNode } from "../types";

export interface ForceSimulationConfig {
	strength: number;
	distance: number;
	iterations: number;
}

export class ForceSimulation {
	private nodes: FileNode[];
	private edges: FileEdge[];
	private config: ForceSimulationConfig;

	constructor(
		nodes: FileNode[],
		edges: FileEdge[],
		config: Partial<ForceSimulationConfig> = {},
	) {
		this.nodes = nodes;
		this.edges = edges;
		this.config = {
			strength: config.strength || 0.1,
			distance: config.distance || 50,
			iterations: config.iterations || 100,
		};

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

		// Update positions
		const damping = 0.9;
		this.nodes.forEach((node) => {
			if (
				node.vx !== undefined &&
				node.vy !== undefined &&
				node.vz !== undefined
			) {
				node.vx *= damping;
				node.vy *= damping;
				node.vz *= damping;

				node.x! += node.vx;
				node.y! += node.vy;
				node.z! += node.vz;
			}
		});
	}

	private applySpringForces() {
		const nodeMap = new Map(this.nodes.map((n) => [n.id, n]));

		this.edges.forEach((edge) => {
			const source = nodeMap.get(edge.source);
			const target = nodeMap.get(edge.target);

			if (!source || !target) return;

			const dx = target.x! - source.x!;
			const dy = target.y! - source.y!;
			const dz = target.z! - source.z!;
			const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

			const force = (distance - this.config.distance) * this.config.strength;

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
		const repulsionStrength = 1000;

		for (let i = 0; i < this.nodes.length; i++) {
			for (let j = i + 1; j < this.nodes.length; j++) {
				const nodeA = this.nodes[i];
				const nodeB = this.nodes[j];

				const dx = nodeB.x! - nodeA.x!;
				const dy = nodeB.y! - nodeA.y!;
				const dz = nodeB.z! - nodeA.z!;
				const distanceSquared = dx * dx + dy * dy + dz * dz;
				const distance = Math.sqrt(distanceSquared) || 1;

				const force = repulsionStrength / distanceSquared;

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
