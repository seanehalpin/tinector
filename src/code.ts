// ---------------------------------------------------------------------------
// 0) Plugin Setup & Constants
// ---------------------------------------------------------------------------
figma.skipInvisibleInstanceChildren = true;

const minusHeight = 40;
const UI_WIDTH = 240;
const UI_MIN_HEIGHT = 300 - minusHeight;
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
    const data = figma.root.getPluginData("instance-connections");
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error loading connections:", error);
    return [];
  }
}

function saveConnections(connections: Connection[]): void {
  try {
    figma.root.setPluginData("instance-connections", JSON.stringify(connections));
  } catch (error) {
    console.error("Error saving connections:", error);
    figma.ui.postMessage({ type: "ERROR", message: "Failed to save connections" });
  }
}

// ---------------------------------------------------------------------------
// 2) Generate line name
// ---------------------------------------------------------------------------
async function generateLineName(sourceId: string, targetId: string): Promise<string> {
  const source = (await figma.getNodeByIdAsync(sourceId)) as InstanceNode;
  const target = (await figma.getNodeByIdAsync(targetId)) as InstanceNode;
  const sourceName = source?.name || "Instance";
  const targetName = target?.name || "Instance";
  let baseName = `${sourceName} → ${targetName}`;
  let name = baseName;
  let counter = 1;
  while (connections.some((conn) => conn.name === name)) {
    name = `${baseName} (${counter})`;
    counter++;
  }
  return name;
}

// ---------------------------------------------------------------------------
// 3) Recursive search for nested "Icon" instance
// ---------------------------------------------------------------------------
function findNestedIcon(node: BaseNode): InstanceNode | null {
  if (node.type === "INSTANCE" && node.name === "Icon") return node as InstanceNode;
  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      const found = findNestedIcon(child);
      if (found) return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4) Get connector centers (top & bottom) using absoluteTransform
// ---------------------------------------------------------------------------
function getIconConnectorCenters(icon: InstanceNode): { top: { x: number; y: number }, bottom: { x: number; y: number } } {
  const t = icon.absoluteTransform;
  const absX = t[0][2], absY = t[1][2];
  return {
    top: { x: absX + icon.width / 2, y: absY },
    bottom: { x: absX + icon.width / 2, y: absY + icon.height }
  };
}

// ---------------------------------------------------------------------------
// 5) Helper: Get the first solid fill color as RGBA from an instance
// ---------------------------------------------------------------------------
function getSolidFillRGBA(node: InstanceNode): RGBA {
  const fills = node.fills;
  if (fills && Array.isArray(fills)) {
    for (const fill of fills) {
      if (fill.type === "SOLID") {
        const rgba = { ...fill.color, a: fill.opacity !== undefined ? fill.opacity : 1 };
        // Optionally send to UI for debugging:
        figma.ui.postMessage({ type: "SOLID_FILL_RGBA", rgba });
        return rgba;
      }
    }
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

// ---------------------------------------------------------------------------
// 6) Create a new connection line between two instances (4 vertices)
// ---------------------------------------------------------------------------
async function createConnectionLine(sourceInstance: InstanceNode, targetInstance: InstanceNode): Promise<VectorNode> {
  const line = figma.createVector();

  // Use nested "Icon" if available; otherwise, use the instance itself.
  const sourceIcon = findNestedIcon(sourceInstance) || sourceInstance;
  const targetIcon = findNestedIcon(targetInstance) || targetInstance;

  const sourceCenters = getIconConnectorCenters(sourceIcon as InstanceNode);
  const targetCenters = getIconConnectorCenters(targetIcon as InstanceNode);

  // Decide which connector to use based on vertical ordering.
  let sourceConnector, targetConnector;
  if (sourceCenters.bottom.y <= targetCenters.top.y) {
    sourceConnector = sourceCenters.bottom;
    targetConnector = targetCenters.top;
  } else if (sourceCenters.top.y >= targetCenters.bottom.y) {
    sourceConnector = sourceCenters.top;
    targetConnector = targetCenters.bottom;
  } else {
    sourceConnector = sourceCenters.bottom;
    targetConnector = targetCenters.top;
  }

  // Add a 20px vertical tip so the line isn’t flush with the icon.
  let vertTip = 20;
  let extendedSourcePt: { x: number; y: number };
  let extendedTargetPt: { x: number; y: number };
  if (sourceConnector === sourceCenters.bottom) {
    extendedSourcePt = { x: sourceConnector.x, y: sourceConnector.y + vertTip };
  } else {
    extendedSourcePt = { x: sourceConnector.x, y: sourceConnector.y - vertTip };
  }
  if (targetConnector === targetCenters.top) {
    extendedTargetPt = { x: targetConnector.x, y: targetConnector.y - vertTip };
  } else {
    extendedTargetPt = { x: targetConnector.x, y: targetConnector.y + vertTip };
  }

  // Build the 4-vertex path.
  const vertices = [ sourceConnector, extendedSourcePt, extendedTargetPt, targetConnector ];
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  
  // Set the vector node's position.
  line.x = minX;
  line.y = minY;
  
  // Compute the bounding box dimensions.
  const nodeWidth = maxX - minX;
  const nodeHeight = maxY - minY;
  // Ensure safe width: if width is nearly 0, set safeWidth to 1.
  const safeWidth = Math.abs(nodeWidth) < 0.001 ? 1 : nodeWidth;

  // Convert vertices to local coordinates.
  const localVertices = vertices.map(v => ({ x: v.x - minX, y: v.y - minY }));
  const segments = [
    { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
  ];
  await line.setVectorNetworkAsync({ vertices: localVertices, segments, regions: [] });

  // --------------------------------------------------------------
  // Compute the gradient transform.
  // Convert global connector positions to local coordinates.
  const localStart = { x: sourceConnector.x - minX, y: sourceConnector.y - minY };
  const localEnd = { x: targetConnector.x - minX, y: targetConnector.y - minY };

  // If horizontal difference is nearly 0, force a minimal horizontal difference.
  let effectiveLocalEnd = { ...localEnd };
  if (Math.abs(localEnd.x - localStart.x) < 0.001) {
    effectiveLocalEnd.x = localStart.x + 0.0001;
  }

  const dx = effectiveLocalEnd.x - localStart.x;
  const dy = effectiveLocalEnd.y - localStart.y;
  
  // Normalize the differences by safeWidth.
  const normDx = dx / safeWidth;
  const normDy = dy / safeWidth;
  const normStartX = localStart.x / safeWidth;
  const normStartY = localStart.y / safeWidth;

  // Compute a tiny perpendicular offset.
  const factor = 0.001;
  const perpX = -normDy * factor;
  const perpY = normDx * factor;

  const gradientTransform = [
    [ normDx, perpX, normStartX ],
    [ normDy, perpY, normStartY ]
  ];

  // Get the fill colors (as RGBA, including opacity) from the source and target icons.
  const sourceRGBA = getSolidFillRGBA(sourceIcon as InstanceNode);
  const targetRGBA = getSolidFillRGBA(targetIcon as InstanceNode);

  const gradientStops = [
    { position: 0, color: { ...sourceRGBA } },
    { position: 1, color: { ...targetRGBA } }
  ];

  // Update the stroke property with a new array reference to trigger re-render.
  line.strokes = [{
    type: "GRADIENT_LINEAR",
    gradientTransform: gradientTransform,
    gradientStops: gradientStops
  }];

  // Additional styling.
  line.strokeWeight = 2;
  line.strokeCap = "ROUND";
  line.strokeJoin = "ROUND";
  (line as any).cornerRadius = 12;
  line.fills = [];

  // Reassign strokes to force re-render.
  line.strokes = JSON.parse(JSON.stringify(line.strokes));

  figma.currentPage.appendChild(line);
  return line;
}

// ---------------------------------------------------------------------------
// 7) Re-create an existing connection line (remove old, create new)
// ---------------------------------------------------------------------------
async function redoConnectionLine(conn: Connection) {
  const oldLine = await figma.getNodeByIdAsync(conn.lineId);
  if (oldLine) oldLine.remove();
  const sourceInstance = (await figma.getNodeByIdAsync(conn.sourceId)) as InstanceNode;
  const targetInstance = (await figma.getNodeByIdAsync(conn.targetId)) as InstanceNode;
  if (sourceInstance && targetInstance) {
    const newLine = await createConnectionLine(sourceInstance, targetInstance);
    conn.lineId = newLine.id;
  }
}

// ---------------------------------------------------------------------------
// 8) Validate a connection (ensure both nodes are valid instances)
// ---------------------------------------------------------------------------
async function isConnectionValid(connection: Connection): Promise<boolean> {
  const sourceNode = await figma.getNodeByIdAsync(connection.sourceId);
  const targetNode = await figma.getNodeByIdAsync(connection.targetId);
  return Boolean(sourceNode && targetNode &&
    sourceNode.type === "INSTANCE" &&
    targetNode.type === "INSTANCE");
}

// ---------------------------------------------------------------------------
// 9) Main Plugin Code
// ---------------------------------------------------------------------------
(async () => {
  await figma.loadAllPagesAsync();
  figma.showUI(__html__, { themeColors: true, width: UI_WIDTH, height: UI_MIN_HEIGHT });
  connections = loadConnections();
  const validityArray = await Promise.all(connections.map(conn => isConnectionValid(conn)));
  connections = connections.filter((_, i) => validityArray[i]);
  for (const conn of connections) {
    const existingLine = await figma.getNodeByIdAsync(conn.lineId);
    if (!existingLine) {
      const sourceInstance = (await figma.getNodeByIdAsync(conn.sourceId)) as InstanceNode;
      const targetInstance = (await figma.getNodeByIdAsync(conn.targetId)) as InstanceNode;
      if (sourceInstance && targetInstance) {
        const line = await createConnectionLine(sourceInstance, targetInstance);
        conn.lineId = line.id;
      }
    }
  }
  saveConnections(connections);
  figma.ui.postMessage({ type: "CONNECTIONS_UPDATED", connections });
  
  // -------------------------------------------------------------------------
  // Update selection message to include the icon color (RGBA) from each instance.
  // -------------------------------------------------------------------------
  figma.on("selectionchange", () => {
    const selectedInstances = figma.currentPage.selection
      .filter(node => node.type === "INSTANCE")
      .map(node => {
        const inst = node as InstanceNode;
        // Use nested "Icon" if available, otherwise fallback to the instance itself.
        const icon = findNestedIcon(inst) || inst;
        const rgba = getSolidFillRGBA(icon);
        return { 
          id: inst.id, 
          name: inst.name, 
          x: inst.x, 
          y: inst.y, 
          width: inst.width, 
          height: inst.height,
          rgba  // add the fill color
        };
      });
    figma.ui.postMessage({ type: "INSTANCES_SELECTED", instances: selectedInstances });
  });
  
  figma.on("documentchange", async event => {
    let needsUpdate = false;
    const tasks = event.documentChanges.map(async change => {
      if (
        change.type === "PROPERTY_CHANGE" &&
        change.node.type === "INSTANCE" &&
        (change.properties.includes("x") ||
         change.properties.includes("y") ||
         change.properties.includes("absoluteTransform"))
      ) {
        const instance = change.node as InstanceNode;
        if (findNestedIcon(instance)) {
          const instanceId = instance.id;
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
      figma.ui.postMessage({ type: "CONNECTIONS_UPDATED", connections });
    }
  });
  
  figma.ui.onmessage = async msg => {
    if (msg.type === "CREATE_CONNECTION") {
      const sourceInstance = (await figma.getNodeByIdAsync(msg.sourceId)) as InstanceNode;
      const targetInstance = (await figma.getNodeByIdAsync(msg.targetId)) as InstanceNode;
      if (!sourceInstance || !targetInstance) {
        figma.ui.postMessage({ type: "ERROR", message: "Invalid instances selected" });
        return;
      }
      const line = await createConnectionLine(sourceInstance, targetInstance);
      const connection: Connection = {
        sourceId: msg.sourceId,
        targetId: msg.targetId,
        name: await generateLineName(msg.sourceId, msg.targetId),
        lineId: line.id
      };

      // Also send the fill colors to the UI.
      const sourceIcon = findNestedIcon(sourceInstance) || sourceInstance;
      const targetIcon = findNestedIcon(targetInstance) || targetInstance;
      const sourceRGBA = getSolidFillRGBA(sourceIcon as InstanceNode);
      const targetRGBA = getSolidFillRGBA(targetIcon as InstanceNode);

      figma.ui.postMessage({
        type: "NEW_CONNECTION",
        connection,
        sourceRGBA,
        targetRGBA
      });
      connections.push(connection);
      saveConnections(connections);
      figma.ui.postMessage({ type: "CONNECTIONS_UPDATED", connections });
      figma.notify("Connection created");
    }
    if (msg.type === "DELETE_CONNECTION") {
      const conn = connections.find(c => c.name === msg.connectionName);
      if (conn) {
        const line = await figma.getNodeByIdAsync(conn.lineId);
        if (line) line.remove();
        connections = connections.filter(c => c.name !== msg.connectionName);
        saveConnections(connections);
        figma.ui.postMessage({ type: "CONNECTIONS_UPDATED", connections });
        figma.notify("Connection deleted");
      }
    }
  };
})();
