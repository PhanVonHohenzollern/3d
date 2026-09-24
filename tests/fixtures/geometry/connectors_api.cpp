// makeConnector: centralPoint/vector/width/height (perpVector up), and the
// upVector overload with connectorWidth (metadata default CONNECTOR_WIDTH is
// not numeric, so the preview keeps its 30 frame width).
FdPoint3d c(0, 0, 0);
makeConnector(c, vx, 100, 50);
makeConnector(c + vy * 200, FdVector3d(0, 1, 1), 80.5, 40);
makeConnector(c, vz, vy, 60, 30);
makeConnector(c, vz, vx, 60, 30, 75);
makeConnector(c, vz, vx, 60, 30, 0);
makeConnector(c, vz, vx, 60, 30, -10);
makeConnector(c, vy, FdVector3d(1, 0, 1), 20, 10, CONNECTOR_WIDTH * 2);
// Unsupported inputs: no mesh; reported as a preview adapter gap.
makeConnector(c, vx * 0, 100, 50);
makeConnector(c, vx, 0, 50);
makeConnector(c, vx, 100, -1);
makeConnector(c, vx, vx * 0, 60, 30);
makeConnector(c, vx, vy, 60, missingHeight);
makeConnector(missingPoint, vx, 100, 50);
