"""
Graph Engine Service - API Compatibility Analysis with Dijkstra's Algorithm

Implements a weighted graph of API compatibility scores and finds optimal
integration paths between any two APIs using Dijkstra's shortest path algorithm.
"""
import heapq
from typing import Dict, List, Tuple, Set, Any, Optional


# =============================================================================
# STEP 1: Define 15 API Nodes with realistic parameters
# =============================================================================

API_NODES: List[Dict[str, Any]] = [
    {
        "name": "OpenWeatherMap",
        "category": "weather",
        "input_params": ["city", "lat", "lon", "units"],
        "output_fields": ["temperature", "humidity", "wind_speed", "weather_condition"]
    },
    {
        "name": "NASA",
        "category": "space",
        "input_params": ["date", "api_key", "count"],
        "output_fields": ["image_url", "title", "explanation", "media_type"]
    },
    {
        "name": "GitHub",
        "category": "developer",
        "input_params": ["username", "repo", "token", "language"],
        "output_fields": ["repo_name", "stars", "forks", "commits", "language"]
    },
    {
        "name": "Twitter",
        "category": "social",
        "input_params": ["query", "user_id", "tweet_id", "bearer_token"],
        "output_fields": ["tweet_text", "likes", "retweets", "username", "timestamp"]
    },
    {
        "name": "Stripe",
        "category": "payments",
        "input_params": ["amount", "currency", "customer_id", "api_key"],
        "output_fields": ["payment_id", "status", "receipt_url", "amount_charged"]
    },
    {
        "name": "Twilio",
        "category": "communication",
        "input_params": ["phone_number", "message", "from_number", "api_key"],
        "output_fields": ["message_sid", "status", "date_sent", "error_code"]
    },
    {
        "name": "SendGrid",
        "category": "communication",
        "input_params": ["email", "subject", "message", "api_key"],
        "output_fields": ["message_id", "status", "delivered", "timestamp"]
    },
    {
        "name": "Spotify",
        "category": "music",
        "input_params": ["artist", "track", "playlist_id", "access_token"],
        "output_fields": ["track_name", "artist_name", "duration_ms", "popularity", "preview_url"]
    },
    {
        "name": "Google Maps",
        "category": "location",
        "input_params": ["address", "lat", "lon", "api_key"],
        "output_fields": ["formatted_address", "lat", "lon", "place_id", "rating"]
    },
    {
        "name": "CoinGecko",
        "category": "crypto",
        "input_params": ["coin_id", "currency", "days"],
        "output_fields": ["price", "market_cap", "volume", "price_change_24h"]
    },
    {
        "name": "Reddit",
        "category": "social",
        "input_params": ["subreddit", "query", "sort", "limit"],
        "output_fields": ["post_title", "upvotes", "comments", "url", "author"]
    },
    {
        "name": "Slack",
        "category": "communication",
        "input_params": ["channel", "message", "token", "webhook_url"],
        "output_fields": ["message_ts", "channel_id", "status", "permalink"]
    },
    {
        "name": "Discord",
        "category": "communication",
        "input_params": ["channel_id", "message", "token", "guild_id"],
        "output_fields": ["message_id", "timestamp", "author", "status"]
    },
    {
        "name": "NewsAPI",
        "category": "news",
        "input_params": ["query", "country", "category", "api_key"],
        "output_fields": ["headline", "source", "url", "published_at", "description"]
    },
    {
        "name": "OpenAI",
        "category": "AI",
        "input_params": ["prompt", "model", "temperature", "max_tokens", "api_key"],
        "output_fields": ["response_text", "tokens_used", "model", "finish_reason"]
    },
]

# Build lookup dict for fast access by name
API_LOOKUP: Dict[str, Dict[str, Any]] = {api["name"]: api for api in API_NODES}

# Set of all valid API names
VALID_API_NAMES: Set[str] = set(API_LOOKUP.keys())


# =============================================================================
# STEP 2: Compatibility Score Function
# =============================================================================

def calculate_score(api1: Dict[str, Any], api2: Dict[str, Any]) -> Tuple[int, str]:
    """
    Calculate compatibility score between two APIs.
    
    Scoring:
    - +40 if same category
    - +10 per shared input_param, capped at 30 total
    - +10 per shared output_field, capped at 30 total
    
    Maximum possible score: 100
    
    Returns:
        Tuple of (score, reason_string)
    """
    score = 0
    reasons: List[str] = []
    
    # Category match: +40 points
    if api1["category"] == api2["category"]:
        score += 40
        reasons.append(f"Same category: {api1['category']}")
    
    # Shared input parameters: +10 each, max 30
    input_set1 = set(api1["input_params"])
    input_set2 = set(api2["input_params"])
    shared_inputs = input_set1 & input_set2
    
    if shared_inputs:
        input_score = min(len(shared_inputs) * 10, 30)
        score += input_score
        reasons.append(f"Shared inputs ({len(shared_inputs)}): {', '.join(sorted(shared_inputs))}")
    
    # Shared output fields: +10 each, max 30
    output_set1 = set(api1["output_fields"])
    output_set2 = set(api2["output_fields"])
    shared_outputs = output_set1 & output_set2
    
    if shared_outputs:
        output_score = min(len(shared_outputs) * 10, 30)
        score += output_score
        reasons.append(f"Shared outputs ({len(shared_outputs)}): {', '.join(sorted(shared_outputs))}")
    
    # Cross-compatibility: output of one can feed input of other
    # api1 outputs → api2 inputs
    output_to_input_1 = output_set1 & input_set2
    # api2 outputs → api1 inputs
    output_to_input_2 = output_set2 & input_set1
    
    cross_matches = output_to_input_1 | output_to_input_2
    if cross_matches and not shared_inputs and not shared_outputs:
        # Only add this reason if it provides new info
        reasons.append(f"Data pipeline potential: {', '.join(sorted(cross_matches))}")
    
    # Build reason string
    if reasons:
        reason = "; ".join(reasons)
    else:
        reason = f"Different domains: {api1['category']} vs {api2['category']}"
    
    return (score, reason)


# =============================================================================
# STEP 3: Build Full Adjacency Graph
# =============================================================================

def build_adjacency_graph() -> Dict[str, Dict[str, Dict[str, int]]]:
    """
    Build weighted adjacency graph for all 15 APIs.
    
    Structure: graph[api_name][other_api_name] = {"score": int, "weight": int}
    
    Weight = 100 - score (lower weight = better path for Dijkstra)
    Builds all 15x15 combinations excluding self-loops.
    """
    graph: Dict[str, Dict[str, Dict[str, int]]] = {}
    
    for api1 in API_NODES:
        api1_name = api1["name"]
        graph[api1_name] = {}
        
        for api2 in API_NODES:
            api2_name = api2["name"]
            
            # Skip self-loops
            if api1_name == api2_name:
                continue
            
            score, _ = calculate_score(api1, api2)
            weight = 100 - score  # Lower weight = better path
            
            graph[api1_name][api2_name] = {
                "score": score,
                "weight": weight
            }
    
    return graph


# Pre-build the graph at module load time for performance
ADJACENCY_GRAPH: Dict[str, Dict[str, Dict[str, int]]] = build_adjacency_graph()


# =============================================================================
# STEP 4: Dijkstra's Algorithm Implementation
# =============================================================================

def find_best_path(start: str, end: str) -> Dict[str, Any]:
    """
    Find the optimal integration path between two APIs using Dijkstra's algorithm.
    
    Uses minimum weight (100 - score) to find the path with highest compatibility.
    
    Args:
        start: Starting API name
        end: Target API name
        
    Returns:
        {
            "path": ["API1", "API2", "API3"],
            "total_score": int,      # average compatibility along path
            "hops": int,             # number of edges in path
            "edge_scores": [{"from": str, "to": str, "score": int}]
        }
    """
    if start not in VALID_API_NAMES:
        return {"error": f"Unknown API: {start}"}
    if end not in VALID_API_NAMES:
        return {"error": f"Unknown API: {end}"}
    
    # Same API - direct connection
    if start == end:
        return {
            "path": [start],
            "total_score": 100,
            "hops": 0,
            "edge_scores": []
        }
    
    # Dijkstra's algorithm using min-heap
    # Priority queue: (cumulative_weight, current_node, path)
    heap: List[Tuple[int, str, List[str]]] = [(0, start, [start])]
    
    # Track visited nodes
    visited: Set[str] = set()
    
    # Track best distance to each node
    distances: Dict[str, int] = {api: float('inf') for api in VALID_API_NAMES}
    distances[start] = 0
    
    # Track predecessor for path reconstruction
    predecessors: Dict[str, Optional[str]] = {api: None for api in VALID_API_NAMES}
    
    while heap:
        current_weight, current_node, current_path = heapq.heappop(heap)
        
        # Skip if already visited with better path
        if current_node in visited:
            continue
        
        visited.add(current_node)
        
        # Found destination
        if current_node == end:
            # Build edge scores
            edge_scores: List[Dict[str, Any]] = []
            total_score_sum = 0
            
            for i in range(len(current_path) - 1):
                from_api = current_path[i]
                to_api = current_path[i + 1]
                edge_data = ADJACENCY_GRAPH[from_api][to_api]
                edge_score = edge_data["score"]
                
                edge_scores.append({
                    "from": from_api,
                    "to": to_api,
                    "score": edge_score
                })
                total_score_sum += edge_score
            
            # Calculate average score along path
            hops = len(current_path) - 1
            avg_score = total_score_sum // hops if hops > 0 else 100
            
            return {
                "path": current_path,
                "total_score": avg_score,
                "hops": hops,
                "edge_scores": edge_scores
            }
        
        # Explore neighbors
        for neighbor, edge_data in ADJACENCY_GRAPH[current_node].items():
            if neighbor in visited:
                continue
            
            new_weight = current_weight + edge_data["weight"]
            
            if new_weight < distances[neighbor]:
                distances[neighbor] = new_weight
                predecessors[neighbor] = current_node
                new_path = current_path + [neighbor]
                heapq.heappush(heap, (new_weight, neighbor, new_path))
    
    # No path found (shouldn't happen in fully connected graph)
    return {
        "path": [],
        "total_score": 0,
        "hops": 0,
        "edge_scores": [],
        "error": "No path found"
    }


# =============================================================================
# STEP 5: Main Compatibility Function for API Endpoint
# =============================================================================

def check_compatibility(api1_name: str, api2_name: str) -> Dict[str, Any]:
    """
    Check compatibility between two APIs.
    
    Validates inputs, calculates direct score, and finds optimal path.
    
    Args:
        api1_name: First API name
        api2_name: Second API name
        
    Returns:
        {
            "score": int,
            "path": list,
            "hops": int,
            "reason": str,
            "edge_scores": list,
            "status": "success" | "error"
        }
    """
    # Normalize names
    api1_name = api1_name.strip()
    api2_name = api2_name.strip()
    
    # Validate API 1 exists
    if api1_name not in VALID_API_NAMES:
        return {
            "score": 0,
            "path": [],
            "hops": 0,
            "reason": f"Unknown API: '{api1_name}'. Valid APIs: {', '.join(sorted(VALID_API_NAMES))}",
            "edge_scores": [],
            "status": "error"
        }
    
    # Validate API 2 exists
    if api2_name not in VALID_API_NAMES:
        return {
            "score": 0,
            "path": [],
            "hops": 0,
            "reason": f"Unknown API: '{api2_name}'. Valid APIs: {', '.join(sorted(VALID_API_NAMES))}",
            "edge_scores": [],
            "status": "error"
        }
    
    # Same API check
    if api1_name == api2_name:
        return {
            "score": 100,
            "path": [api1_name],
            "hops": 0,
            "reason": f"{api1_name} is fully compatible with itself",
            "edge_scores": [],
            "status": "success"
        }
    
    # Get API data
    api1 = API_LOOKUP[api1_name]
    api2 = API_LOOKUP[api2_name]
    
    # Calculate direct score and reason
    direct_score, reason = calculate_score(api1, api2)
    
    # Find best path using Dijkstra
    path_result = find_best_path(api1_name, api2_name)
    
    if "error" in path_result:
        return {
            "score": direct_score,
            "path": [api1_name, api2_name],
            "hops": 1,
            "reason": reason,
            "edge_scores": [{"from": api1_name, "to": api2_name, "score": direct_score}],
            "status": "success"
        }
    
    # Check if direct path is best or if there's a better indirect path
    direct_weight = ADJACENCY_GRAPH[api1_name][api2_name]["weight"]
    path_total_weight = sum(
        ADJACENCY_GRAPH[path_result["path"][i]][path_result["path"][i+1]]["weight"]
        for i in range(len(path_result["path"]) - 1)
    )
    
    # If Dijkstra found a better indirect path, note it
    if path_result["hops"] > 1 and path_total_weight < direct_weight:
        reason += f" | Better path via {' → '.join(path_result['path'])} (avg score: {path_result['total_score']})"
    
    return {
        "score": direct_score,
        "path": path_result["path"],
        "hops": path_result["hops"],
        "reason": reason,
        "edge_scores": path_result["edge_scores"],
        "status": "success"
    }


def get_all_apis() -> List[Dict[str, Any]]:
    """Get list of all API nodes with their metadata."""
    return API_NODES.copy()


def get_api_names() -> List[str]:
    """Get sorted list of all valid API names."""
    return sorted(list(VALID_API_NAMES))


def get_graph_stats() -> Dict[str, Any]:
    """Get statistics about the compatibility graph."""
    total_edges = sum(len(neighbors) for neighbors in ADJACENCY_GRAPH.values())
    
    all_scores = []
    for api1_neighbors in ADJACENCY_GRAPH.values():
        for edge_data in api1_neighbors.values():
            all_scores.append(edge_data["score"])
    
    avg_score = sum(all_scores) / len(all_scores) if all_scores else 0
    max_score = max(all_scores) if all_scores else 0
    min_score = min(all_scores) if all_scores else 0
    
    return {
        "total_nodes": len(API_NODES),
        "total_edges": total_edges,
        "avg_compatibility_score": round(avg_score, 2),
        "max_compatibility_score": max_score,
        "min_compatibility_score": min_score,
        "categories": list(set(api["category"] for api in API_NODES))
    }


class GraphEngine:
    """Compatibility wrapper class for legacy imports."""

    def check_compatibility(self, api1_name: str, api2_name: str) -> Dict[str, Any]:
        return check_compatibility(api1_name, api2_name)

    def get_all_apis(self) -> List[Dict[str, Any]]:
        return get_all_apis()

    def get_api_names(self) -> List[str]:
        return get_api_names()

    def get_graph_stats(self) -> Dict[str, Any]:
        return get_graph_stats()


graph_engine = GraphEngine()
