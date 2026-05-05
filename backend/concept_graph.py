import networkx as nx
import json
from pathlib import Path

class ConceptGraphEngine:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.node_data = {}
        self._load_graph()

    def _load_graph(self):
        # Load the JSON file
        path = Path(__file__).parent / "concept_graph.json"
        with open(path) as f:
            data = json.load(f)
        
        # Add every concept as a node
        for node in data["nodes"]:
            self.graph.add_node(node["id"])
            self.node_data[node["id"]] = node
        
        # Add every dependency as an edge
        # Edge means: "source must be learned before target"
        for edge in data["edges"]:
            self.graph.add_edge(edge["source"], edge["target"])

    def find_root_gaps(self, broken_concept_id: str) -> list:
        """
        If a student doesn't understand 'convection',
        this traces back to find the REAL root cause
        e.g. they never learned 'density' in Class 5
        """
        if broken_concept_id not in self.graph:
            return [broken_concept_id]
        
        # Get all prerequisites of this concept
        ancestors = list(nx.ancestors(self.graph, broken_concept_id))
        
        if not ancestors:
            # This concept itself is the root — no prerequisites
            return [broken_concept_id]
        
        # Find the deepest ones (those with no prerequisites themselves)
        root_gaps = []
        for ancestor in ancestors:
            predecessors = list(self.graph.predecessors(ancestor))
            if not predecessors:
                root_gaps.append(ancestor)
        
        return root_gaps if root_gaps else [broken_concept_id]

    def get_propagation_risks(self, broken_concept_id: str) -> list:
        """
        If density is broken, what future topics will ALSO fail?
        Returns: pressure, buoyancy, convection, atmosphere
        """
        if broken_concept_id not in self.graph:
            return []
        descendants = list(nx.descendants(self.graph, broken_concept_id))
        return [self.node_data.get(d, {}).get("label", d) for d in descendants]

    def get_node_info(self, concept_id: str) -> dict:
        return self.node_data.get(concept_id, {
            "id": concept_id,
            "label": concept_id,
            "class": 0,
            "subject": "Unknown"
        })

    def get_all_nodes_with_edges(self) -> dict:
        """Return everything needed for the D3 graph visualization"""
        nodes = [{"id": k, **v} for k, v in self.node_data.items()]
        edges = [{"source": u, "target": v} for u, v in self.graph.edges()]
        return {"nodes": nodes, "edges": edges}

# Create one instance that gets reused everywhere
engine = ConceptGraphEngine()