// makeBox: every SDK overload (13, 12, 10/8, 9/7, 6/5, 8/6 and 5/4 parameter
// forms) and makeBoxFromPlanes. count+1 sections, supplied or perpVector()
// upVectors, width along normal x upVector, height along upVector, sides,
// begin/end caps and end connectors.
FdPoint3d p0(0, 0, 0);
FdPoint3d pts3[3] = {p0, p0 + vx * 300, p0 + vx * 500 + vy * 200};
FdVector3d vecs3[3] = {vx, FdVector3d(1, 0.5, 0), FdVector3d(1, 1, 0)};
FdVector3d ups3[3] = {vz, vz, FdVector3d(0, 0.2, 1)};
double w3[3] = {100, 120, 80};
double h3[3] = {50, 60, 40};
bool sides8[8] = {true, true, false, true, true, true, true, false};
bool edges2[2][4] = {{true, true, true, true}, {false, false, false, false}};
FdPoint3d pts2[2] = {FdPoint3d(0, 0, 100), FdPoint3d(0, 0, 400)};
FdVector3d vecs2[2] = {vz, vz};
FdVector3d ups2[2] = {vy, vx};
double w2[2] = {60, 90};
double h2[2] = {30, 45};
bool sides4[4] = {true, false, true, true};
bool conn2[2] = {true, false};
bool conn2b[2] = {false, true};
bool edges1[1][4] = {{true, true, true, true}};
makeBox(2, pts3, vecs3, ups3, w3, h3, sides8, edges2, true, true, 0, 0, 40);
makeBox(2, pts3, vecs3, ups3, w3, h3, sides8, false, true, 1, 2, 25.5);
makeBoxFromPlanes(1, pts2, vecs2, ups2, w2, h2, sides4, true, false, 13, 24, 30);
makeBoxFromPlanes(1, pts2, vecs2, ups2, w2, h2, sides4, 1, 1, 3, 4, 0);
makeBox(1, pts2, vecs2, w2, h2, sides4, edges1, conn2);
makeBox(1, pts2, vecs2, w2, h2, sides4, edges1, conn2b, true, true);
makeBox(1, pts2, vecs2, w2, h2, sides4, conn2);
makeBox(1, pts2, vecs2, w2, h2, sides4, conn2b, false, true);
makeBox(1, pts2, vecs2, 50, 30);
makeBox(1, pts2, vecs2, 50.5, 30.25, false);
makeBox(2, pts3, w3, h3, sides8, conn2);
makeBox(2, pts3, w3, h3, sides8, conn2b, true, false);
makeBox(2, pts3, w3, h3);
makeBox(1, pts2, w2, h2, false);
makeBox(0, pts2, w2, h2, true);
// Connector side codes: 5 = none, 1..4 single sides, 13/24 pairs, other codes
// draw no sleeve; connectorWidth <= 0 draws no sleeve.
makeBox(1, pts2, vecs2, ups2, w2, h2, sides4, false, false, 5, 7, 30);
makeBox(1, pts2, vecs2, ups2, w2, h2, sides4, false, false, 2, 13, -5);
makeBox(1, pts2, vecs2, ups2, w2, h2, sides4, false, false, 0, 0, 12.5);
// Scalar widths for array parameters, short sides array, zero/parallel upVectors.
FdVector3d zeroUps[2] = {FdVector3d(0, 0, 0), vz};
bool shortSides[2] = {false, true};
makeBox(1, pts2, vecs2, ups2, 70, 35, shortSides, false, false, 5, 5, 30);
makeBox(1, pts2, vecs2, zeroUps, w2, h2, sides4, true, true, 5, 5, 30);
// Invalid makeBox inputs: warnings, no mesh.
makeBox(-1, pts2, vecs2, 50, 30);
makeBox(2, pts2, vecs2, 50, 30);
makeBox(1, p0, vecs2, 50, 30);
makeBox(1, pts2, vx, 50, 30);
FdVector3d zeroVecs[2] = {vz, FdVector3d(0, 0, 0)};
makeBox(1, pts2, zeroVecs, 50, 30);
FdVector3d oneUp[1] = {vz};
makeBox(1, pts2, vecs2, oneUp, w2, h2, sides4, false, false, 5, 5, 30);
double shortW[1] = {10};
makeBox(1, pts2, vecs2, ups2, shortW, h2, sides4, false, false, 5, 5, 30);
makeBox(1, pts2, vecs2, ups2, w2, p0, sides4, false, false, 5, 5, 30);
makeBox(1, pts2, vecs2, ups2, w2, h2, p0, false, false, 5, 5, 30);
FdPoint3d samePts[2] = {p0, p0};
makeBox(1, samePts, w2, h2);
makeBox(missingCount, pts2, w2, h2);
makeBox(1, pts2, vecs2, missingWidth, 30);
// Unresolved optional arguments keep the adapter defaults (no caps, side code
// 5, connectorWidth 30); fractional side codes round like std::llround.
makeBox(1, pts2, vecs2, ups2, w2, h2, sides4, missingBegin, true, missingSide, 2.5, missingWidth);
makeBox(1.4, pts2, vecs2, ups2, w2, h2, sides4, true, missingEnd, 0.4, 3.6, 18);
makeBox(1, pts2, vecs2, 40, 20, missingConnectors);
makeBox(1, pts2, w2, h2, missingConnector);
