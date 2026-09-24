// There is no block scope: inner declarations replace outer ones, each
// declaration starts a new variable lifetime (visible in histories).
//@line 999
//@line 7
//@line 13
double x = 1;
FdPoint3d p(0, 0, 0);
makeSimpleTube(p, p + vx * x, x, x, 3);
{
    double x = 2;
    makeSimpleTube(p, p + vx * x, x, x, 3);
    x = 3;
}
makeSimpleTube(p, p + vx * x, x, x, 3);
for (int i = 0; i < 3; i++) {
    double x = i * 10;
    FdPoint3d q = p + vy * x;
    makeSimpleTube(q, q + vz, x, i, 3);
    x += 1;
}
double x = x + 100;
makeSimpleTube(p, p + vx * x, x, x, 3);
