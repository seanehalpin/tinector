'use strict';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

// ---------------------------------------------------------------------------
// 0) Plugin Setup & Constants
// ---------------------------------------------------------------------------
figma.skipInvisibleInstanceChildren = true;
const minusHeight = 40;
const UI_WIDTH = 240;
const UI_MIN_HEIGHT = 300 - minusHeight;
let connections = [];
// ---------------------------------------------------------------------------
// 1) Load/Save
// ---------------------------------------------------------------------------
function loadConnections() {
    try {
        const data = figma.root.getPluginData("instance-connections");
        return data ? JSON.parse(data) : [];
    }
    catch (error) {
        console.error("Error loading connections:", error);
        return [];
    }
}
function saveConnections(connections) {
    try {
        figma.root.setPluginData("instance-connections", JSON.stringify(connections));
    }
    catch (error) {
        console.error("Error saving connections:", error);
        figma.ui.postMessage({ type: "ERROR", message: "Failed to save connections" });
    }
}
// ---------------------------------------------------------------------------
// 2) Generate line name
// ---------------------------------------------------------------------------
function generateLineName(sourceId, targetId) {
    return __awaiter(this, void 0, void 0, function* () {
        const source = (yield figma.getNodeByIdAsync(sourceId));
        const target = (yield figma.getNodeByIdAsync(targetId));
        const sourceName = (source === null || source === void 0 ? void 0 : source.name) || "Instance";
        const targetName = (target === null || target === void 0 ? void 0 : target.name) || "Instance";
        let baseName = `${sourceName} → ${targetName}`;
        let name = baseName;
        let counter = 1;
        while (connections.some((conn) => conn.name === name)) {
            name = `${baseName} (${counter})`;
            counter++;
        }
        return name;
    });
}
// ---------------------------------------------------------------------------
// 3) Recursive search for nested "Icon" instance
// ---------------------------------------------------------------------------
function findNestedIcon(node) {
    if (node.type === "INSTANCE" && node.name === "Icon")
        return node;
    if ("children" in node) {
        for (const child of node.children) {
            const found = findNestedIcon(child);
            if (found)
                return found;
        }
    }
    return null;
}
// ---------------------------------------------------------------------------
// 4) Get connector centers (top & bottom) using absoluteTransform
// ---------------------------------------------------------------------------
function getIconConnectorCenters(icon) {
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
function getSolidFillRGBA(node) {
    const fills = node.fills;
    if (fills && Array.isArray(fills)) {
        for (const fill of fills) {
            if (fill.type === "SOLID") {
                const rgba = Object.assign(Object.assign({}, fill.color), { a: fill.opacity !== undefined ? fill.opacity : 1 });
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
function createConnectionLine(sourceInstance, targetInstance) {
    return __awaiter(this, void 0, void 0, function* () {
        const line = figma.createVector();
        // Use nested "Icon" if available; otherwise, use the instance itself.
        const sourceIcon = findNestedIcon(sourceInstance) || sourceInstance;
        const targetIcon = findNestedIcon(targetInstance) || targetInstance;
        const sourceCenters = getIconConnectorCenters(sourceIcon);
        const targetCenters = getIconConnectorCenters(targetIcon);
        // Decide which connector to use based on vertical ordering.
        let sourceConnector, targetConnector;
        if (sourceCenters.bottom.y <= targetCenters.top.y) {
            sourceConnector = sourceCenters.bottom;
            targetConnector = targetCenters.top;
        }
        else if (sourceCenters.top.y >= targetCenters.bottom.y) {
            sourceConnector = sourceCenters.top;
            targetConnector = targetCenters.bottom;
        }
        else {
            sourceConnector = sourceCenters.bottom;
            targetConnector = targetCenters.top;
        }
        // Add a 20px vertical tip so the line isn’t flush with the icon.
        let vertTip = 20;
        let extendedSourcePt;
        let extendedTargetPt;
        if (sourceConnector === sourceCenters.bottom) {
            extendedSourcePt = { x: sourceConnector.x, y: sourceConnector.y + vertTip };
        }
        else {
            extendedSourcePt = { x: sourceConnector.x, y: sourceConnector.y - vertTip };
        }
        if (targetConnector === targetCenters.top) {
            extendedTargetPt = { x: targetConnector.x, y: targetConnector.y - vertTip };
        }
        else {
            extendedTargetPt = { x: targetConnector.x, y: targetConnector.y + vertTip };
        }
        // Build the 4-vertex path.
        const vertices = [sourceConnector, extendedSourcePt, extendedTargetPt, targetConnector];
        const xs = vertices.map(v => v.x);
        const ys = vertices.map(v => v.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        // Set the vector node's position.
        line.x = minX;
        line.y = minY;
        // Compute the bounding box dimensions.
        const nodeWidth = maxX - minX;
        // Ensure safe width: if width is nearly 0, set safeWidth to 1.
        const safeWidth = Math.abs(nodeWidth) < 0.001 ? 1 : nodeWidth;
        // Convert vertices to local coordinates.
        const localVertices = vertices.map(v => ({ x: v.x - minX, y: v.y - minY }));
        const segments = [
            { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
            { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
            { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        ];
        yield line.setVectorNetworkAsync({ vertices: localVertices, segments, regions: [] });
        // --------------------------------------------------------------
        // Compute the gradient transform.
        // Convert global connector positions to local coordinates.
        const localStart = { x: sourceConnector.x - minX, y: sourceConnector.y - minY };
        const localEnd = { x: targetConnector.x - minX, y: targetConnector.y - minY };
        // If horizontal difference is nearly 0, force a minimal horizontal difference.
        let effectiveLocalEnd = Object.assign({}, localEnd);
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
            [normDx, perpX, normStartX],
            [normDy, perpY, normStartY]
        ];
        // Get the fill colors (as RGBA, including opacity) from the source and target icons.
        const sourceRGBA = getSolidFillRGBA(sourceIcon);
        const targetRGBA = getSolidFillRGBA(targetIcon);
        const gradientStops = [
            { position: 0, color: Object.assign({}, sourceRGBA) },
            { position: 1, color: Object.assign({}, targetRGBA) }
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
        line.cornerRadius = 12;
        line.fills = [];
        // Reassign strokes to force re-render.
        line.strokes = JSON.parse(JSON.stringify(line.strokes));
        figma.currentPage.appendChild(line);
        return line;
    });
}
// ---------------------------------------------------------------------------
// 7) Re-create an existing connection line (remove old, create new)
// ---------------------------------------------------------------------------
function redoConnectionLine(conn) {
    return __awaiter(this, void 0, void 0, function* () {
        const oldLine = yield figma.getNodeByIdAsync(conn.lineId);
        if (oldLine)
            oldLine.remove();
        const sourceInstance = (yield figma.getNodeByIdAsync(conn.sourceId));
        const targetInstance = (yield figma.getNodeByIdAsync(conn.targetId));
        if (sourceInstance && targetInstance) {
            const newLine = yield createConnectionLine(sourceInstance, targetInstance);
            conn.lineId = newLine.id;
        }
    });
}
// ---------------------------------------------------------------------------
// 8) Validate a connection (ensure both nodes are valid instances)
// ---------------------------------------------------------------------------
function isConnectionValid(connection) {
    return __awaiter(this, void 0, void 0, function* () {
        const sourceNode = yield figma.getNodeByIdAsync(connection.sourceId);
        const targetNode = yield figma.getNodeByIdAsync(connection.targetId);
        return Boolean(sourceNode && targetNode &&
            sourceNode.type === "INSTANCE" &&
            targetNode.type === "INSTANCE");
    });
}
// ---------------------------------------------------------------------------
// 9) Main Plugin Code
// ---------------------------------------------------------------------------
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield figma.loadAllPagesAsync();
    figma.showUI(__html__, { themeColors: true, width: UI_WIDTH, height: UI_MIN_HEIGHT });
    connections = loadConnections();
    const validityArray = yield Promise.all(connections.map(conn => isConnectionValid(conn)));
    connections = connections.filter((_, i) => validityArray[i]);
    for (const conn of connections) {
        const existingLine = yield figma.getNodeByIdAsync(conn.lineId);
        if (!existingLine) {
            const sourceInstance = (yield figma.getNodeByIdAsync(conn.sourceId));
            const targetInstance = (yield figma.getNodeByIdAsync(conn.targetId));
            if (sourceInstance && targetInstance) {
                const line = yield createConnectionLine(sourceInstance, targetInstance);
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
            const inst = node;
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
                rgba // add the fill color
            };
        });
        figma.ui.postMessage({ type: "INSTANCES_SELECTED", instances: selectedInstances });
    });
    figma.on("documentchange", (event) => __awaiter(void 0, void 0, void 0, function* () {
        let needsUpdate = false;
        const tasks = event.documentChanges.map((change) => __awaiter(void 0, void 0, void 0, function* () {
            if (change.type === "PROPERTY_CHANGE" &&
                change.node.type === "INSTANCE" &&
                (change.properties.includes("x") ||
                    change.properties.includes("y") ||
                    change.properties.includes("absoluteTransform"))) {
                const instance = change.node;
                if (findNestedIcon(instance)) {
                    const instanceId = instance.id;
                    const affected = connections.filter(conn => conn.sourceId === instanceId || conn.targetId === instanceId);
                    if (affected.length > 0) {
                        needsUpdate = true;
                        for (const conn of affected) {
                            yield redoConnectionLine(conn);
                        }
                    }
                }
            }
        }));
        yield Promise.all(tasks);
        if (needsUpdate) {
            saveConnections(connections);
            figma.ui.postMessage({ type: "CONNECTIONS_UPDATED", connections });
        }
    }));
    figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
        if (msg.type === "CREATE_CONNECTION") {
            const sourceInstance = (yield figma.getNodeByIdAsync(msg.sourceId));
            const targetInstance = (yield figma.getNodeByIdAsync(msg.targetId));
            if (!sourceInstance || !targetInstance) {
                figma.ui.postMessage({ type: "ERROR", message: "Invalid instances selected" });
                return;
            }
            const line = yield createConnectionLine(sourceInstance, targetInstance);
            const connection = {
                sourceId: msg.sourceId,
                targetId: msg.targetId,
                name: yield generateLineName(msg.sourceId, msg.targetId),
                lineId: line.id
            };
            // Also send the fill colors to the UI.
            const sourceIcon = findNestedIcon(sourceInstance) || sourceInstance;
            const targetIcon = findNestedIcon(targetInstance) || targetInstance;
            const sourceRGBA = getSolidFillRGBA(sourceIcon);
            const targetRGBA = getSolidFillRGBA(targetIcon);
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
                const line = yield figma.getNodeByIdAsync(conn.lineId);
                if (line)
                    line.remove();
                connections = connections.filter(c => c.name !== msg.connectionName);
                saveConnections(connections);
                figma.ui.postMessage({ type: "CONNECTIONS_UPDATED", connections });
                figma.notify("Connection deleted");
            }
        }
    });
}))();
