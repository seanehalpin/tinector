// ---------------------------------------------------------------------------
// 0) Plugin Setup & Constants
// ---------------------------------------------------------------------------
figma.skipInvisibleInstanceChildren = true;

const minusHeight = 40;
const UI_WIDTH = 240;
const UI_MIN_HEIGHT = 400 - minusHeight;
const UI_MAX_HEIGHT = 800;

interface Connection {
  sourceId: string;
  targetId: string;
  name: string;
  lineId: string;
}

let connections: Connection[] = [];

// ---------------------------------------------------------------------------
// 1) Load/Save
// ---------------------------------------------------------------------------
function loadConnections(): Connection[] {
  try {
    const data = figma.root.getPluginData('instance-connections');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading connections:', error);
    return [];
  }
}

function saveConnections(connections: Connection[]): void {
  try {
    figma.root.setPluginData('instance-connections', JSON.stringify(connections));
  } catch (error) {
    console.error('Error saving connections:', error);
    figma.ui.postMessage({
      type: 'ERROR',
      message: 'Failed to save connections'
    });
  }
}

// ---------------------------------------------------------------------------
// 2) Generate line name
// ---------------------------------------------------------------------------
async function generateLineName(sourceId: string, targetId: string): Promise<string> {
  const source = await figma.getNodeByIdAsync(sourceId) as InstanceNode;
  const target = await figma.getNodeByIdAsync(targetId) as InstanceNode;
  
  const sourceName = source?.name || 'Instance';
  const targetName = target?.name || 'Instance';
  
  let baseName = `${sourceName} → ${targetName}`;
  let name = baseName;
  let counter = 1;
  
  while (connections.some(conn => conn.name === name)) {
    name = `${baseName} (${counter})`;
    counter++;
  }
  
  return name;
}

// ---------------------------------------------------------------------------
// 3) Recursive search for nested "Icon" instance
// ---------------------------------------------------------------------------
function findNestedIcon(node: BaseNode): InstanceNode | null {
  // If this node is an instance named "Icon", return it.
  if (node.type === 'INSTANCE' && node.name === 'Icon') {
    return node as InstanceNode;
  }
  // If the node has children, search recursively.
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      const found = findNestedIcon(child);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4) Get connector centers (top & bottom of the Icon)
//    Now using absoluteTransform for correct positioning
// ---------------------------------------------------------------------------
function getIconConnectorCenters(icon: InstanceNode): { 
  top: { x: number; y: number }, 
  bottom: { x: number; y: number } 
} {
  // Get the absolute transform of the icon.
  const transform = icon.absoluteTransform;
  const absX = transform[0][2];
  const absY = transform[1][2];

  return {
    top: { x: absX + icon.width / 2, y: absY },
    bottom: { x: absX + icon.width / 2, y: absY + icon.height }
  };
}

// ---------------------------------------------------------------------------
// 5) Build a two-corner (Z-shaped) connector
// ---------------------------------------------------------------------------
function buildTwoCornerShape(
  start: { x: number, y: number },
  end: { x: number, y: number }
): { vertices: { x: number, y: number }[], segments: { start: number, end: number }[] } {
  // The middle x is halfway between start.x and end.x.
  const midX = (start.x + end.x) / 2;
  const corner1 = { x: midX, y: start.y };
  const corner2 = { x: midX, y: end.y };

  const vertices = [start, corner1, corner2, end];
  const segments = [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
    { start: 2, end: 3 }
  ];

  return { vertices, segments };
}

// ---------------------------------------------------------------------------
// 6) Adjust vertices from absolute → local coordinates
// ---------------------------------------------------------------------------
function adjustVertices(vertices: { x: number, y: number }[], vector: VectorNode): { x: number, y: number }[] {
  if (vertices.length === 0) return vertices;
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  // Position the vector node at the top-left of the bounding box.
  vector.x = minX;
  vector.y = minY;
  // Return vertices as local coordinates.
  return vertices.map(v => ({
    x: v.x - minX,
    y: v.y - minY
  }));
}

// ---------------------------------------------------------------------------
// 7) Create a new connection line between two instances
// ---------------------------------------------------------------------------
async function createConnectionLine(sourceInstance: InstanceNode, targetInstance: InstanceNode): Promise<VectorNode> {
  const line = figma.createVector();

  // Find the nested "Icon" in each instance (fallback to the instance itself if not found)
  const sourceIcon = findNestedIcon(sourceInstance) || sourceInstance;
  const targetIcon = findNestedIcon(targetInstance) || targetInstance;

  // Compute absolute top & bottom centers for each Icon.
  const sourceCenters = getIconConnectorCenters(sourceIcon as InstanceNode);
  const targetCenters = getIconConnectorCenters(targetIcon as InstanceNode);

  let sourcePt, targetPt;
  // Choose connector points based on vertical positions:
  if (sourceCenters.bottom.y <= targetCenters.top.y) {
    // Source is above target: connect source bottom to target top.
    sourcePt = sourceCenters.bottom;
    targetPt = targetCenters.top;
  } else if (sourceCenters.top.y >= targetCenters.bottom.y) {
    // Source is below target: connect source top to target bottom.
    sourcePt = sourceCenters.top;
    targetPt = targetCenters.bottom;
  } else {
    // Overlapping vertically: choose defaults.
    sourcePt = sourceCenters.bottom;
    targetPt = targetCenters.top;
  }

  // Build the two-corner (Z-shaped) path.
  const { vertices, segments } = buildTwoCornerShape(sourcePt, targetPt);
  const localVertices = adjustVertices(vertices, line);

  // Build the vector network.
  await line.setVectorNetworkAsync({
    vertices: localVertices,
    segments: segments.map(s => ({
      start: s.start,
      end: s.end,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })),
    regions: []
  });

  // Apply styling.
  line.strokes = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0.5 } }];
  line.strokeWeight = 2;
  line.strokeCap = "ROUND";
  line.strokeAlign = "CENTER";
  line.fills = [];

  figma.currentPage.appendChild(line);
  return line;
}

// ---------------------------------------------------------------------------
// 8) Re-create an existing connection line (remove old, create new)
// ---------------------------------------------------------------------------
async function redoConnectionLine(conn: Connection) {
  const oldLine = await figma.getNodeByIdAsync(conn.lineId);
  if (oldLine) oldLine.remove();

  const sourceInstance = await figma.getNodeByIdAsync(conn.sourceId) as InstanceNode;
  const targetInstance = await figma.getNodeByIdAsync(conn.targetId) as InstanceNode;

  if (sourceInstance && targetInstance) {
    const newLine = await createConnectionLine(sourceInstance, targetInstance);
    conn.lineId = newLine.id;
  }
}

// ---------------------------------------------------------------------------
// 9) Validate a connection (ensure both nodes are valid instances)
// ---------------------------------------------------------------------------
async function isConnectionValid(connection: Connection): Promise<boolean> {
  const sourceNode = await figma.getNodeByIdAsync(connection.sourceId);
  const targetNode = await figma.getNodeByIdAsync(connection.targetId);
  return Boolean(
    sourceNode && targetNode &&
    sourceNode.type === 'INSTANCE' &&
    targetNode.type === 'INSTANCE'
  );
}

// ---------------------------------------------------------------------------
// 10) Main Plugin Code
// ---------------------------------------------------------------------------
(async () => {
  await figma.loadAllPagesAsync();

  figma.showUI(__html__, {
    themeColors: true,
    width: UI_WIDTH,
    height: UI_MIN_HEIGHT
  });

  // Load existing connections.
  connections = loadConnections();

  // Filter out invalid connections.
  const validityArray = await Promise.all(connections.map(conn => isConnectionValid(conn)));
  connections = connections.filter((_, i) => validityArray[i]);

  // Ensure connection lines exist for each valid connection.
  for (const conn of connections) {
    const existingLine = await figma.getNodeByIdAsync(conn.lineId);
    if (!existingLine) {
      const sourceInstance = await figma.getNodeByIdAsync(conn.sourceId) as InstanceNode;
      const targetInstance = await figma.getNodeByIdAsync(conn.targetId) as InstanceNode;
      if (sourceInstance && targetInstance) {
        const line = await createConnectionLine(sourceInstance, targetInstance);
        conn.lineId = line.id;
      }
    }
  }

  saveConnections(connections);

  // Listen for selection changes (filtering for instances).
  figma.on('selectionchange', () => {
    const selectedInstances = figma.currentPage.selection
      .filter(node => node.type === 'INSTANCE')
      .map(node => {
        const inst = node as InstanceNode;
        return {
          id: inst.id,
          name: inst.name,
          x: inst.x,
          y: inst.y,
          width: inst.width,
          height: inst.height
        };
      });
    figma.ui.postMessage({
      type: 'INSTANCES_SELECTED',
      instances: selectedInstances
    });
  });

  // Listen for instance movements / property changes.
  figma.on('documentchange', async event => {
    let needsUpdate = false;
    console.log('Document change:', event);

    const tasks = event.documentChanges.map(async change => {
      if (
        change.type === 'PROPERTY_CHANGE' &&
        change.node.type === 'INSTANCE' &&
        (
          change.properties.includes("x") ||
          change.properties.includes("y") ||
          change.properties.includes("absoluteTransform")
        )
      ) {
        const instance = change.node as InstanceNode;
        // Only update if this instance (or one of its nested nodes) contains an "Icon"
        if (findNestedIcon(instance)) {
          const instanceId = instance.id;
          // Find connections that use this instance.
          const affected = connections.filter(conn =>
            conn.sourceId === instanceId || conn.targetId === instanceId
          );
          if (affected.length > 0) {
            needsUpdate = true;
            for (const conn of affected) {
              await redoConnectionLine(conn);
            }
          }
        }
      }
    });

    await Promise.all(tasks);

    if (needsUpdate) {
      saveConnections(connections);
      figma.ui.postMessage({
        type: 'CONNECTIONS_UPDATED',
        connections
      });
    }
  });

  // Initial UI message.
  figma.ui.postMessage({
    type: 'CONNECTIONS_UPDATED',
    connections
  });

  // Listen for messages from the UI.
  figma.ui.onmessage = async msg => {
    if (msg.type === 'CREATE_CONNECTION') {
      const sourceInstance = await figma.getNodeByIdAsync(msg.sourceId) as InstanceNode;
      const targetInstance = await figma.getNodeByIdAsync(msg.targetId) as InstanceNode;

      if (!sourceInstance || !targetInstance) {
        figma.ui.postMessage({ type: 'ERROR', message: 'Invalid instances selected' });
        return;
      }

      const line = await createConnectionLine(sourceInstance, targetInstance);
      const connection: Connection = {
        sourceId: msg.sourceId,
        targetId: msg.targetId,
        name: await generateLineName(msg.sourceId, msg.targetId),
        lineId: line.id
      };

      connections.push(connection);
      saveConnections(connections);

      figma.ui.postMessage({
        type: 'CONNECTIONS_UPDATED',
        connections
      });
    }

    if (msg.type === 'DELETE_CONNECTION') {
      const conn = connections.find(c => c.name === msg.connectionName);
      if (conn) {
        const line = await figma.getNodeByIdAsync(conn.lineId);
        if (line) line.remove();

        connections = connections.filter(c => c.name !== msg.connectionName);
        saveConnections(connections);

        figma.ui.postMessage({
          type: 'CONNECTIONS_UPDATED',
          connections
        });
      }
    }
  };
})();
