// The same flat program executed at many cursor lines.
//@line 0
//@line -3
//@line 1
//@line 13
//@line 14
//@line 15
//@line 16
//@line 17
//@line 19
//@line 21
//@line 24
//@line 25
//@line 500
double w = 100;
double h = w / 2;
FdPoint3d p0(0, 0, 0);
FdPoint3d p1 = p0 + vx * w;
makeSimpleTube(p0, p1, w, h, cpx);
if (w > 50) {
    h = h + 1;
    makeSimpleTube(p1, p1 + vz * h, 10, 10, 3);
}
for (int i = 0; i < 2; i++) {
    FdPoint3d q = p1 + vy * (i * 10.0);
    makeSimpleTube(q, q + vx, h, i, 3);
}
double done = h + w;
