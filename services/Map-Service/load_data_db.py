from sqlalchemy.orm import Session
from database import SessionLocal, init_db
from models import Node, Edge, Closure, Tile, POI, Seat, Gate

def load_sample_data():
    """Load stadium data with REAL GPS COORDINATES (Estádio do Dragão)."""
    
    # Initialize database tables
    init_db()
    db: Session = SessionLocal()
    
    try:
        # ==================== NODES (GPS COORDINATES) ====================
        # Coordenadas reais mapeadas sobre a bancada Sul e Este do Dragão
        # X = Latitude, Y = Longitude
        
        nodes_data = [
            # --- LEVEL 0 (Piso Térreo / Corredor Principal) ---
            # Corredor Sul (Do lado esquerdo para o direito)
            {"id": "N1", "x": 41.161300, "y": -8.584500, "level": 0, "type": "normal"},
            {"id": "N2", "x": 41.161350, "y": -8.584000, "level": 0, "type": "normal"},
            {"id": "N3", "x": 41.161400, "y": -8.583500, "level": 0, "type": "normal"},
            {"id": "N4", "x": 41.161450, "y": -8.583000, "level": 0, "type": "normal"}, # Perto das escadas
            {"id": "N5", "x": 41.161500, "y": -8.582500, "level": 0, "type": "normal"},

            # Entradas (Gates) - Conexões verticais para fora
            {"id": "N6", "x": 41.161100, "y": -8.584000, "level": 0, "type": "normal"}, # Perto da Gate 1
            {"id": "N7", "x": 41.161200, "y": -8.583000, "level": 0, "type": "normal"}, # Perto da Gate 2

            # Corredor Interior (Mais perto do relvado)
            {"id": "N8", "x": 41.161500, "y": -8.584500, "level": 0, "type": "normal"},
            {"id": "N9", "x": 41.161600, "y": -8.583500, "level": 0, "type": "normal"},
            {"id": "N10", "x": 41.161700, "y": -8.582500, "level": 0, "type": "normal"},

            # --- STAIRS (Escadas de Ligação) ---
            # Base das escadas (Nível 0) - Perto do N4
            {"id": "N15", "x": 41.161550, "y": -8.583000, "level": 0, "type": "stairs"},
            # Topo das escadas (Nível 1) - Mesma coordenada GPS, nível diferente
            {"id": "N16", "x": 41.161550, "y": -8.583000, "level": 1, "type": "stairs"},

            # --- LEVEL 1 (Piso Superior) ---
            {"id": "N17", "x": 41.161400, "y": -8.584500, "level": 1, "type": "normal"},
            {"id": "N18", "x": 41.161550, "y": -8.583500, "level": 1, "type": "normal"},
            {"id": "N19", "x": 41.161700, "y": -8.582500, "level": 1, "type": "normal"},
        ]
        
        for node_data in nodes_data:
            node = Node(**node_data)
            db.add(node)
        
        print(f"✓ Loaded {len(nodes_data)} nodes (GPS)")

        # ==================== EDGES (Arestas / Caminhos) ====================
        # Recriar as ligações baseadas nos IDs novos
        
        edges_data = [
            # --- Piso 0: Corredor Principal ---
            {"id": "E1", "from_id": "N1", "to_id": "N2", "weight": 50.0},
            {"id": "E2", "from_id": "N2", "to_id": "N1", "weight": 50.0},
            {"id": "E3", "from_id": "N2", "to_id": "N3", "weight": 50.0},
            {"id": "E4", "from_id": "N3", "to_id": "N2", "weight": 50.0},
            {"id": "E5", "from_id": "N3", "to_id": "N4", "weight": 50.0},
            {"id": "E6", "from_id": "N4", "to_id": "N3", "weight": 50.0},
            {"id": "E7", "from_id": "N4", "to_id": "N5", "weight": 50.0},
            {"id": "E8", "from_id": "N5", "to_id": "N4", "weight": 50.0},

            # --- Piso 0: Ligações às Portas (Gates) ---
            {"id": "E9", "from_id": "N2", "to_id": "N6", "weight": 20.0},
            {"id": "E10", "from_id": "N6", "to_id": "N2", "weight": 20.0},
            {"id": "E11", "from_id": "N4", "to_id": "N7", "weight": 20.0},
            {"id": "E12", "from_id": "N7", "to_id": "N4", "weight": 20.0},

            # --- Piso 0: Ligações Transversais (Corredor Interior) ---
            {"id": "E13", "from_id": "N1", "to_id": "N8", "weight": 30.0},
            {"id": "E14", "from_id": "N8", "to_id": "N1", "weight": 30.0},
            {"id": "E15", "from_id": "N3", "to_id": "N9", "weight": 30.0},
            {"id": "E16", "from_id": "N9", "to_id": "N3", "weight": 30.0},
            {"id": "E17", "from_id": "N5", "to_id": "N10", "weight": 30.0},
            {"id": "E18", "from_id": "N10", "to_id": "N5", "weight": 30.0},

            # --- Escadas (Conexão Vertical) ---
            # Do corredor (N4) para a base da escada (N15)
            {"id": "E19", "from_id": "N4", "to_id": "N15", "weight": 10.0},
            {"id": "E20", "from_id": "N15", "to_id": "N4", "weight": 10.0},
            # Subir (N15 -> N16)
            {"id": "E21", "from_id": "N15", "to_id": "N16", "weight": 15.0}, 
            # Descer (N16 -> N15)
            {"id": "E22", "from_id": "N16", "to_id": "N15", "weight": 15.0}, 

            # --- Piso 1: Corredor Superior ---
            {"id": "E23", "from_id": "N17", "to_id": "N18", "weight": 60.0},
            {"id": "E24", "from_id": "N18", "to_id": "N17", "weight": 60.0},
            {"id": "E25", "from_id": "N18", "to_id": "N19", "weight": 60.0},
            {"id": "E26", "from_id": "N19", "to_id": "N18", "weight": 60.0},
            # Da escada (N16) para o corredor (N18)
            {"id": "E27", "from_id": "N16", "to_id": "N18", "weight": 10.0},
            {"id": "E28", "from_id": "N18", "to_id": "N16", "weight": 10.0},
        ]
        
        for edge_data in edges_data:
            edge = Edge(**edge_data)
            db.add(edge)
            
        print(f"✓ Loaded {len(edges_data)} edges (Connected)")

        # ==================== GATES (GPS) ====================
        gates_data = [
            {"id": "Gate-1", "gate_number": "1", "x": 41.161000, "y": -8.584000, "level": 0},
            {"id": "Gate-2", "gate_number": "2", "x": 41.161100, "y": -8.583000, "level": 0},
        ]
        
        for gate_data in gates_data:
            gate = Gate(**gate_data)
            db.add(gate)
            
        print(f"✓ Loaded {len(gates_data)} gates")

        # ==================== POIs (Lixeiras e Serviços) ====================
        # Pontos de interesse com GPS real
        
        pois_data = [
            # Lixeiras (O que queres ver no mapa)
            {"id": "Bin-1", "name": "Recycle Bin A", "category": "bin", "x": 41.161350, "y": -8.584200, "level": 0},
            {"id": "Bin-2", "name": "General Waste", "category": "bin", "x": 41.161450, "y": -8.583200, "level": 0},
            {"id": "Bin-3", "name": "Recycle Bin Upper", "category": "bin", "x": 41.161550, "y": -8.583500, "level": 1},

            # Casas de Banho
            {"id": "WC-1", "name": "WC South", "category": "restroom", "x": 41.161600, "y": -8.584400, "level": 0},
            
            # Bar
            {"id": "Bar-1", "name": "Super Bock Bar", "category": "bar", "x": 41.161700, "y": -8.582600, "level": 0},
        ]
        
        for poi_data in pois_data:
            poi = POI(**poi_data)
            db.add(poi)
            
        print(f"✓ Loaded {len(pois_data)} POIs")

        # ==================== SEATS (Exemplo Pequeno) ====================
        seats_data = []
        # Cria um pequeno bloco de cadeiras perto da zona central
        for row in range(1, 4):
            for num in range(1, 5):
                seats_data.append({
                    "id": f"S-{row}-{num}", 
                    "block": "A", 
                    "row": row, 
                    "number": num,
                    # Coordenadas ajustadas ligeiramente por fila
                    "x": 41.161800 + (row * 0.00002), 
                    "y": -8.584000 + (num * 0.00002), 
                    "level": 0
                })

        for seat_data in seats_data:
            seat = Seat(**seat_data)
            db.add(seat)
            
        print(f"✓ Loaded {len(seats_data)} seats")

        # ==================== TILES (Opcional) ====================
        # Mantemos vazio ou com dados mínimos para não dar erro
        tiles_data = []
        for tile_data in tiles_data:
            tile = Tile(**tile_data)
            db.add(tile)

        # ==================== CLOSURES (Vazio) ====================
        closures_data = []
        for closure_data in closures_data:
            closure = Closure(**closure_data)
            db.add(closure)
        
        # Guardar tudo na BD
        db.commit()
        print("\n✅ All stadium data loaded successfully (GPS COORDINATES)!")
        print("\n✨ Graph is now FULLY CONNECTED!")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error loading data: {str(e)}")
        raise
    finally:
        db.close()


def clear_all_data():
    """Clear all data from the database."""
    db: Session = SessionLocal()
    try:
        # A ordem de deleção é importante por causa das Foreign Keys
        db.query(Closure).delete()
        db.query(Edge).delete()
        db.query(Tile).delete()
        db.query(POI).delete()
        db.query(Seat).delete()
        db.query(Gate).delete()
        db.query(Node).delete()
        db.commit()
        print("✓ All data cleared from database")
    except Exception as e:
        db.rollback()
        print(f"❌ Error clearing data: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    # Permite correr o script manualmente com flag --clear
    if len(sys.argv) > 1 and sys.argv[1] == "--clear":
        print("🗑️  Clearing all data...")
        clear_all_data()
    else:
        print("📥 Loading stadium data...")
        load_sample_data()
        print("\n✨ Done! Server ready.")