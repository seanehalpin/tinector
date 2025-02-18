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
const UI_MIN_HEIGHT = 400 - minusHeight;
let connections = [];
// ---------------------------------------------------------------------------
// 1) Load/Save
// ---------------------------------------------------------------------------
function loadConnections() {
    try {
        const data = figma.root.getPluginData('instance-connections');
        return data ? JSON.parse(data) : [];
    }
    catch (error) {
        console.error('Error loading connections:', error);
        return [];
    }
}
function saveConnections(connections) {
    try {
        figma.root.setPluginData('instance-connections', JSON.stringify(connections));
    }
    catch (error) {
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
function generateLineName(sourceId, targetId) {
    return __awaiter(this, void 0, void 0, function* () {
        const source = yield figma.getNodeByIdAsync(sourceId);
        const target = yield figma.getNodeByIdAsync(targetId);
        const sourceName = (source === null || source === void 0 ? void 0 : source.name) || 'Instance';
        const targetName = (target === null || target === void 0 ? void 0 : target.name) || 'Instance';
        let baseName = `${sourceName} → ${targetName}`;
        let name = baseName;
        let counter = 1;
        while (connections.some(conn => conn.name === name)) {
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
    // If this node is an instance named "Icon", return it.
    if (node.type === 'INSTANCE' && node.name === 'Icon') {
        return node;
    }
    // If the node has children, search recursively.
    if ('children' in node) {
        for (const child of node.children) {
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
function getIconConnectorCenters(icon) {
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
function buildTwoCornerShape(start, end) {
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
function adjustVertices(vertices, vector) {
    if (vertices.length === 0)
        return vertices;
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
function createConnectionLine(sourceInstance, targetInstance) {
    return __awaiter(this, void 0, void 0, function* () {
        const line = figma.createVector();
        // Find the nested "Icon" in each instance (fallback to the instance itself if not found)
        const sourceIcon = findNestedIcon(sourceInstance) || sourceInstance;
        const targetIcon = findNestedIcon(targetInstance) || targetInstance;
        // Compute absolute top & bottom centers for each Icon.
        const sourceCenters = getIconConnectorCenters(sourceIcon);
        const targetCenters = getIconConnectorCenters(targetIcon);
        let sourcePt, targetPt;
        // Choose connector points based on vertical positions:
        if (sourceCenters.bottom.y <= targetCenters.top.y) {
            // Source is above target: connect source bottom to target top.
            sourcePt = sourceCenters.bottom;
            targetPt = targetCenters.top;
        }
        else if (sourceCenters.top.y >= targetCenters.bottom.y) {
            // Source is below target: connect source top to target bottom.
            sourcePt = sourceCenters.top;
            targetPt = targetCenters.bottom;
        }
        else {
            // Overlapping vertically: choose defaults.
            sourcePt = sourceCenters.bottom;
            targetPt = targetCenters.top;
        }
        // Build the two-corner (Z-shaped) path.
        const { vertices, segments } = buildTwoCornerShape(sourcePt, targetPt);
        const localVertices = adjustVertices(vertices, line);
        // Build the vector network.
        yield line.setVectorNetworkAsync({
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
    });
}
// ---------------------------------------------------------------------------
// 8) Re-create an existing connection line (remove old, create new)
// ---------------------------------------------------------------------------
function redoConnectionLine(conn) {
    return __awaiter(this, void 0, void 0, function* () {
        const oldLine = yield figma.getNodeByIdAsync(conn.lineId);
        if (oldLine)
            oldLine.remove();
        const sourceInstance = yield figma.getNodeByIdAsync(conn.sourceId);
        const targetInstance = yield figma.getNodeByIdAsync(conn.targetId);
        if (sourceInstance && targetInstance) {
            const newLine = yield createConnectionLine(sourceInstance, targetInstance);
            conn.lineId = newLine.id;
        }
    });
}
// ---------------------------------------------------------------------------
// 9) Validate a connection (ensure both nodes are valid instances)
// ---------------------------------------------------------------------------
function isConnectionValid(connection) {
    return __awaiter(this, void 0, void 0, function* () {
        const sourceNode = yield figma.getNodeByIdAsync(connection.sourceId);
        const targetNode = yield figma.getNodeByIdAsync(connection.targetId);
        return Boolean(sourceNode && targetNode &&
            sourceNode.type === 'INSTANCE' &&
            targetNode.type === 'INSTANCE');
    });
}
// ---------------------------------------------------------------------------
// 10) Main Plugin Code
// ---------------------------------------------------------------------------
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield figma.loadAllPagesAsync();
    figma.showUI(__html__, {
        themeColors: true,
        width: UI_WIDTH,
        height: UI_MIN_HEIGHT
    });
    // Load existing connections.
    connections = loadConnections();
    // Filter out invalid connections.
    const validityArray = yield Promise.all(connections.map(conn => isConnectionValid(conn)));
    connections = connections.filter((_, i) => validityArray[i]);
    // Ensure connection lines exist for each valid connection.
    for (const conn of connections) {
        const existingLine = yield figma.getNodeByIdAsync(conn.lineId);
        if (!existingLine) {
            const sourceInstance = yield figma.getNodeByIdAsync(conn.sourceId);
            const targetInstance = yield figma.getNodeByIdAsync(conn.targetId);
            if (sourceInstance && targetInstance) {
                const line = yield createConnectionLine(sourceInstance, targetInstance);
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
            const inst = node;
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
    figma.on('documentchange', (event) => __awaiter(void 0, void 0, void 0, function* () {
        let needsUpdate = false;
        console.log('Document change:', event);
        const tasks = event.documentChanges.map((change) => __awaiter(void 0, void 0, void 0, function* () {
            if (change.type === 'PROPERTY_CHANGE' &&
                change.node.type === 'INSTANCE' &&
                (change.properties.includes("x") ||
                    change.properties.includes("y") ||
                    change.properties.includes("absoluteTransform"))) {
                const instance = change.node;
                // Only update if this instance (or one of its nested nodes) contains an "Icon"
                if (findNestedIcon(instance)) {
                    const instanceId = instance.id;
                    // Find connections that use this instance.
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
            figma.ui.postMessage({
                type: 'CONNECTIONS_UPDATED',
                connections
            });
        }
    }));
    // Initial UI message.
    figma.ui.postMessage({
        type: 'CONNECTIONS_UPDATED',
        connections
    });
    // Listen for messages from the UI.
    figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
        if (msg.type === 'CREATE_CONNECTION') {
            const sourceInstance = yield figma.getNodeByIdAsync(msg.sourceId);
            const targetInstance = yield figma.getNodeByIdAsync(msg.targetId);
            if (!sourceInstance || !targetInstance) {
                figma.ui.postMessage({ type: 'ERROR', message: 'Invalid instances selected' });
                return;
            }
            const line = yield createConnectionLine(sourceInstance, targetInstance);
            const connection = {
                sourceId: msg.sourceId,
                targetId: msg.targetId,
                name: yield generateLineName(msg.sourceId, msg.targetId),
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
                const line = yield figma.getNodeByIdAsync(conn.lineId);
                if (line)
                    line.remove();
                connections = connections.filter(c => c.name !== msg.connectionName);
                saveConnections(connections);
                figma.ui.postMessage({
                    type: 'CONNECTIONS_UPDATED',
                    connections
                });
            }
        }
    });
}))();
