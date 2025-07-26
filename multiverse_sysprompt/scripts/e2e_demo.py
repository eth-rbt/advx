import asyncio, time, requests, websockets, json

API = "http://localhost:8000"

def main():
    print("🚀 Starting E2E Demo...")
    
    # 1. Seed a root
    print("🌱 Seeding root node...")
    try:
        response = requests.post(f"{API}/seed", json={"prompt": "How can technology foster peace?"})
        response.raise_for_status()
        root = response.json()["seed_id"]
        print(f"🌱 Seeded root: {root}")
    except Exception as e:
        print(f"❌ Failed to seed: {e}")
        return
    
    # 2. Consume first 3 websocket updates
    print("🔌 Connecting to WebSocket for updates...")
    
    async def listen():
        uri = "ws://localhost:8000/ws"
        try:
            async with websockets.connect(uri) as ws:
                print("📡 Connected to WebSocket, waiting for updates...")
                for i in range(3):
                    try:
                        update = json.loads(await asyncio.wait_for(ws.recv(), timeout=30))
                        print(f"🔔 Update {i+1}: {update}")
                    except asyncio.TimeoutError:
                        print(f"⏰ Timeout waiting for update {i+1}")
                        break
        except Exception as e:
            print(f"❌ WebSocket error: {e}")
    
    asyncio.get_event_loop().run_until_complete(listen())
    
    # 3. Snapshot graph
    print("🖼️ Taking graph snapshot...")
    try:
        graph = requests.get(f"{API}/graph").json()
        print(f"🖼️ Total nodes: {len(graph)}")
        for node in graph[:5]:  # Show first 5 nodes
            print(f"   Node {node['id'][:8]}... at {node['xy']} (score: {node['score']})")
    except Exception as e:
        print(f"❌ Failed to get graph: {e}")
    
    print("✅ Demo complete!")

if __name__ == "__main__":
    main()