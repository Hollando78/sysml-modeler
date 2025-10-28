# SysML Modeler

A standalone SysML v2 modeling tool with Neo4j backend, based on Airgen's architecture and integrated with sysml-reactflow for visualization.

## Features

- **SysML v2 Compliant**: Supports 60+ element types and 30+ relationship types
- **Viewpoint-Based Modeling**: Filter and work with specific diagram types (Requirements, Structural, Behavioral, etc.)
- **Neo4j Backend**: Powerful graph database for storing and querying models
- **Interactive Canvas**: Drag-and-drop modeling with automatic layout support
- **Model Browser**: Tree view of all elements, filtered by viewpoint
- **Custom Toolbars**: Context-sensitive tools based on selected viewpoint

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Frontend (React + Vite)            │
│  ┌───────────────────────────────────────────┐  │
│  │  sysml-reactflow (Visualization)          │  │
│  │  React Query (State Management)           │  │
│  │  Viewpoint Context (Filtering)            │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                       ↕ REST API
┌─────────────────────────────────────────────────┐
│           Backend (Express + TypeScript)        │
│  ┌───────────────────────────────────────────┐  │
│  │  SysML Model Service                      │  │
│  │  Viewpoint Service                        │  │
│  │  Mapper (SysML ↔ Neo4j)                  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                       ↕ Cypher
┌─────────────────────────────────────────────────┐
│              Neo4j 5.x Database                 │
│  - SysML Elements (Nodes)                       │
│  - Relationships (Edges)                        │
│  - Version History                              │
└─────────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js** 20+ (for local development)
- **Docker** and **Docker Compose** (recommended for deployment)
- **Neo4j** 5.x (included in Docker setup)

## Quick Start

### Option 1: Docker Compose (Recommended)

1. **Clone the repository** (or navigate to the project directory):
   ```bash
   cd /root/sysml-modeler
   ```

2. **Start all services**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001/api/sysml
   - Neo4j Browser: http://localhost:7474 (username: `neo4j`, password: `password`)

4. **Stop services**:
   ```bash
   docker-compose down
   ```

### Option 2: Local Development

1. **Start Neo4j** (using Docker):
   ```bash
   docker run -d \
     --name sysml-neo4j \
     -p 7474:7474 -p 7687:7687 \
     -e NEO4J_AUTH=neo4j/password \
     neo4j:5.25.0
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build sysml-reactflow** (if not already built):
   ```bash
   cd /root/sysml-reactflow
   npm install
   npm run build
   cd /root/sysml-modeler
   ```

4. **Start backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

5. **Start frontend** (in a new terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001/api/sysml

## Project Structure

```
sysml-modeler/
├── backend/
│   ├── src/
│   │   ├── config/           # Configuration
│   │   ├── services/
│   │   │   ├── neo4j/        # Neo4j driver & connection
│   │   │   └── sysml/        # SysML services
│   │   │       ├── mapper.ts          # SysML ↔ Neo4j mapping
│   │   │       ├── model-service.ts   # CRUD operations
│   │   │       └── viewpoints.ts      # Viewpoint definitions
│   │   ├── routes/           # Express API routes
│   │   └── index.ts          # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── sysml/
│   │   │       ├── ModelBrowser.tsx      # Element tree view
│   │   │       ├── ViewpointSelector.tsx # Viewpoint dropdown
│   │   │       ├── SysMLToolbar.tsx      # Context-sensitive toolbar
│   │   │       ├── SysMLCanvas.tsx       # Canvas with sysml-reactflow
│   │   │       └── SysMLModelingView.tsx # Main layout
│   │   ├── hooks/            # React Query hooks
│   │   ├── lib/              # API client & context
│   │   ├── types/            # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Model Operations
- `GET /api/sysml/model?viewpoint={id}` - Fetch model (optionally filtered by viewpoint)
- `POST /api/sysml/elements` - Create element
- `PATCH /api/sysml/elements/:id` - Update element
- `DELETE /api/sysml/elements/:id` - Delete element

### Relationship Operations
- `POST /api/sysml/relationships` - Create relationship
- `DELETE /api/sysml/relationships/:id` - Delete relationship

### Viewpoint Operations
- `GET /api/sysml/viewpoints` - List all viewpoints
- `GET /api/sysml/viewpoints/:id/types` - Get available types for viewpoint

### Position Management
- `PATCH /api/sysml/elements/:id/position` - Update element position for a viewpoint

## Usage Guide

### 1. Select a Viewpoint

Use the **Viewpoint Selector** dropdown in the header to filter the model:
- **Structural Definition** - Part/action/port definitions
- **Usage Structure** - Part/port/action usages
- **Behavior & Control** - Actions and control flows
- **State** - State machines and transitions
- **Requirement** - Requirements and traceability
- **Interaction** - Sequence diagrams

### 2. Browse Elements

The **Model Browser** on the left shows all elements in the current viewpoint:
- Elements are grouped by type
- Click to expand/collapse groups
- Use search to filter elements

### 3. Create Elements

1. Select a viewpoint
2. Click an element type button in the toolbar
3. Click on the canvas where you want to place it
4. Enter the element name in the prompt

### 4. Create Relationships

1. Select a viewpoint
2. Click a relationship type button in the toolbar
3. Click the source element
4. Click the target element

### 5. Move Elements

- Click "Select" in the toolbar
- Drag elements on the canvas
- Positions are automatically saved per viewpoint

## Configuration

### Backend Environment Variables

Edit `backend/.env`:

```env
# Server
PORT=3001
CORS_ORIGIN=http://localhost:5173

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j
```

### Frontend Configuration

Edit `frontend/vite.config.ts` for proxy settings:

```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

## Data Model

### Neo4j Schema

**Node Labels:**
- `:SysMLElement` (base label for all elements)
- `:PartDefinition`, `:PartUsage`
- `:RequirementDefinition`, `:RequirementUsage`
- `:ActionDefinition`, `:ActionUsage`
- `:StateDefinition`, `:StateUsage`
- ... and 60+ more types

**Relationship Types:**
- `:SATISFY`, `:VERIFY`, `:REFINE`
- `:SPECIALIZATION`, `:COMPOSITION`, `:AGGREGATION`
- `:CONTROL_FLOW`, `:ITEM_FLOW`, `:ACTION_FLOW`
- `:TRANSITION`, `:MESSAGE`
- ... and 30+ more types

**Node Properties:**
```cypher
{
  id: string,
  name: string,
  description: string,
  stereotype: string,
  status: 'draft' | 'reviewed' | 'approved' | 'deprecated',
  attributes: JSON,  // Complex properties as JSON
  ports: JSON,
  layoutPositions: JSON,  // {viewpointId: {x, y}}
  createdAt: datetime,
  updatedAt: datetime
}
```

## Supported SysML v2 Viewpoints

| Viewpoint | Node Types | Relationship Types | Use Case |
|-----------|------------|-------------------|----------|
| **Structural Definition** | part-definition, action-definition, port-definition, item-definition | specialization, definition, dependency | Block Definition Diagrams (BDD) |
| **Usage Structure** | part-usage, port-usage, action-usage, item-usage | definition, dependency, allocate | Internal Block Diagrams (IBD) |
| **Behavior & Control** | action-definition, action-usage, activity-control | control-flow, action-flow | Activity Diagrams |
| **State** | state-machine, state, state-definition, state-usage | transition | State Machine Diagrams |
| **Requirement** | requirement-definition, requirement-usage | satisfy, verify, refine | Requirements Diagrams |
| **Interaction** | sequence-lifeline | message | Sequence Diagrams |

## Development

### Run Tests

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

### Build for Production

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

### Database Management

**Clear all data:**
```cypher
MATCH (n:SysMLElement)
DETACH DELETE n
```

**View all elements:**
```cypher
MATCH (n:SysMLElement)
RETURN n
LIMIT 25
```

**Export model:**
```cypher
CALL apoc.export.json.all("sysml-model.json", {})
```

## Troubleshooting

### Neo4j Connection Failed

- Check if Neo4j is running: `docker ps | grep neo4j`
- Verify credentials in backend/.env
- Check Neo4j logs: `docker logs sysml-neo4j`

### Frontend Can't Connect to Backend

- Verify backend is running on port 3001
- Check CORS settings in backend/src/config/index.ts
- Open browser console for detailed errors

### Elements Not Appearing

- Check Neo4j Browser to verify data exists
- Verify viewpoint filter is correct
- Check browser console for API errors

## Future Enhancements

- [ ] Drag-and-drop from Model Browser to Canvas
- [ ] Properties panel for editing element details
- [ ] Automatic layout with ELK.js integration
- [ ] Export to PNG/SVG
- [ ] Import from SysML v2 text format
- [ ] Multi-diagram support
- [ ] Version history and undo/redo
- [ ] Collaborative editing with WebSockets
- [ ] Package management and hierarchies
- [ ] Validation and consistency checking

## License

MIT

## Acknowledgments

- Based on [Airgen](https://github.com/your-org/airgen) architecture
- Visualization powered by [sysml-reactflow](https://github.com/Hollando78/SysML-reactflow)
- Built with [React Flow](https://reactflow.dev/)
- Database by [Neo4j](https://neo4j.com/)
